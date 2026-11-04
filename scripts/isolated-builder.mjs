import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { packBuild } from "./pack-build.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const ACCOUNT = /^[a-f0-9]{32}$/i;
const OWNER = /^[A-Za-z0-9_-]{24,128}$/;
const RUN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const IMAGE = /^sha256:[a-f0-9]{64}$/i;
const DIGEST = /^[a-f0-9]{64}$/i;
const MIN_UID = 1000;
const MAX_LOG = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 25 * 60_000;

function assert(condition, message) {
  if (!condition) throw Error("Unsafe isolated build: " + message);
}

function validateRequest(req, now = Date.now()) {
  assert(req && RUN.test(req.runId) && ACCOUNT.test(req.accountId) &&
    OWNER.test(req.ownerId) && SHA.test(req.sourceSha),
  "invalid owner, account, run ID or exact 40-character Git SHA");
  assert(Number.isSafeInteger(req.expiresAt) &&
    req.expiresAt > now && req.expiresAt <= now + 30 * 60_000,
  "build request must have a short-lived authorization");
  return { ...req, sourceSha: req.sourceSha.toLowerCase() };
}

/**
 * Docker must already have an image with this exact, locally verified image
 * ID. Mutable registry tags and image names are never accepted here.
 * No Cloudflare/GitHub/npm tokens, docker socket, host home or user data mount.
 */
export function dockerBuildSpec({ workspace, image, sourceSha, runId, uid, gid, nonce = randomBytes(8).toString("hex") }) {
  assert(typeof workspace === "string" && path.isAbsolute(workspace) &&
    !/[\r\n,]/.test(workspace) && !workspace.includes("\0"),
  "invalid absolute scratch directory");
  assert(typeof image === "string" && IMAGE.test(image), "immutable Docker image ID sha256:... required");
  assert(typeof sourceSha === "string" && SHA.test(sourceSha), "complete Git SHA required");
  assert(typeof runId === "string" && RUN.test(runId), "valid run UUID required");
  assert(Number.isSafeInteger(uid) && Number.isSafeInteger(gid) &&
    uid >= MIN_UID && uid <= 65534 && gid >= 1 && gid <= 65534,
  "Docker build must run under a non-root service UID/GID");

  assert(/^[a-f0-9]{16}$/i.test(nonce), "container nonce must be random 64-bit hex");
  // Unique nonce prevents a replayed run ID from deleting another live job.
  const containerName = "ifd-" + runId.replaceAll("-", "") + "-" + nonce.toLowerCase();
  const args = [
    "run", "--rm", "--init",
    "--name", containerName,
    "--user", uid + ":" + gid,
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", "256",
    "--memory", "6g", "--memory-swap", "6g",
    "--cpus", "2",
    "--network", "bridge",
    "--ipc", "private", // PID namespace is private by default; --pid=private is invalid Docker syntax.
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=512m,mode=1777",
    "--mount", "type=bind,source=" + workspace + ",target=/work",
    "--workdir", "/work",
    "--env", "IFD_SOURCE_SHA=" + sourceSha.toLowerCase(),
    "--env", "CI=1",
    "--label", "insightflare.deploy.build=true",
    "--label", "insightflare.deploy.run=" + runId,
    image.toLowerCase()
  ];
  return { command: "docker", args, containerName };
}

function minimalDockerClientEnv() {
  // No ambient Cloudflare/GitHub/npm/CI tokens reach the Docker client.
  const allowed = ["PATH", "Path", "HOME", "USERPROFILE", "SystemRoot", "TEMP", "TMP", "TMPDIR"];
  return Object.fromEntries(allowed.filter(key => process.env[key]).map(key => [key, process.env[key]]));
}

async function dockerCommand(args, timeoutMs) {
  const docker = spawn("docker", args, {
    shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: minimalDockerClientEnv()
  });
  let output = "";
  const collect = chunk => {
    output = (output + chunk.toString("utf8")).slice(-MAX_LOG);
  };
  docker.stdout?.on("data", collect);
  docker.stderr?.on("data", collect);
  const complete = new Promise((resolve, reject) => {
    docker.once("error", reject);
    docker.once("close", code => {
      if (code === 0) return resolve(output);
      // Diagnostics are available ONLY to an explicitly enabled operator
      // (for example, the manual CI smoke). Never return raw logs to a user.
      if (process.env.IFD_BUILDER_DEBUG === "1") {
        const scrubbed = output.slice(-12500)
          .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]")
          .replace(/((?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)\s*[=:]\s*)\S+/gi, "$1[REDACTED]");
        process.stderr.write("Isolated builder debug (local operator only):\n" + scrubbed + "\n");
      }
      reject(Error("Isolated Docker command failed (exit " + code + ")"));
    });
  });
  let timeout;
  const deadline = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => {
      docker.kill();
      reject(Error("Isolated Docker build timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([complete, deadline]);
  } finally {
    clearTimeout(timeout);
  }
}

/** Runs with a disposable private workspace and ALWAYS deletes source and dist. */
export async function withIsolatedBuild(input, receiver, deps = {}) {
  assert(typeof receiver === "function", "a scoped artifact consumer is required");
  const now = deps.now ?? Date.now();
  const request = validateRequest(input, now);
  const image = deps.image;
  assert(IMAGE.test(image ?? ""), "builder image must be pinned to its local sha256 image ID");
  const uid = deps.uid ?? process.getuid?.();
  const gid = deps.gid ?? process.getgid?.();
  const platform = deps.platform ?? process.platform;
  assert(platform === "linux", "isolated Docker builds must run on a dedicated Linux host");
  assert(Number.isSafeInteger(uid) && uid >= MIN_UID && Number.isSafeInteger(gid) && gid >= 1,
    "a non-root Linux builder service account is required");

  const root = deps.rootDir ?? path.join(os.tmpdir(), "insightflare-isolated-builds");
  assert(path.isAbsolute(root) && !/[\r\n,]/.test(root), "unsafe runner scratch root");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const metadata = await lstat(root);
  assert(metadata.isDirectory() && !metadata.isSymbolicLink(), "scratch root cannot be a symlink");
  if (typeof metadata.uid === "number" && (deps.platform ?? process.platform) === "linux" && process.platform === "linux") {
    assert(metadata.uid === uid && (metadata.mode & 0o077) === 0,
      "scratch root must be private and owned by the dedicated builder account");
  }
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 30 * 60_000,
    "unsafe build timeout");
  const privateRoot = await realpath(root);
  const jobRoot = await mkdtemp(path.join(privateRoot, "ifd-run-"));
  const spec = dockerBuildSpec({
    workspace: jobRoot,
    image,
    sourceSha: request.sourceSha,
    runId: request.runId,
    uid, gid
  });
  const execute = deps.execute ?? dockerCommand;
  const verify = deps.verify ?? packBuild;
  let started = false;
  try {
    started = true;
    await execute(spec.args, timeoutMs);
    const artifact = await verify({ root: path.join(jobRoot, "checkout"), sha: request.sourceSha });
    assert(artifact?.pinnedSha === request.sourceSha &&
      artifact.summary?.sourceSha === request.sourceSha &&
      DIGEST.test(artifact.summary?.digest ?? "") &&
      Number.isSafeInteger(artifact.summary?.moduleCount) && artifact.summary.moduleCount > 0 &&
      Number.isSafeInteger(artifact.summary?.assetCount) && artifact.summary.assetCount > 0,
    "builder artifact does not match the reviewed pinned SHA or lacks a valid binary digest");
    const receipt = {
      runId: request.runId,
      accountId: request.accountId,
      sourceSha: request.sourceSha,
      artifactDigest: artifact.summary.digest,
      workerModules: artifact.summary.moduleCount,
      staticAssets: artifact.summary.assetCount,
      provider: "isolated-container",
      deployed: false
    };
    // Only the consumer has access to the ephemeral path or binary buffers.
    // A later stage can use the Cloudflare API after the build container exits.
    return await receiver({ receipt, artifact });
  } finally {
    if (started) {
      // Distinct UUID-scoped container. Clean up after crashes/timeouts too.
      await execute(["rm", "-f", spec.containerName], 12000).catch(() => {});
    }
    await rm(jobRoot, { recursive: true, force: true });
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const [, , flag, image, sha, workspace] = process.argv;
  if (flag !== "--inspect" || !IMAGE.test(image ?? "") || !SHA.test(sha ?? "") ||
      !workspace || !path.isAbsolute(workspace)) {
    process.stderr.write("Usage: node scripts/isolated-builder.mjs --inspect <image-sha256-id> <40-char-git-sha> <absolute-workspace>\n");
    process.exitCode = 2;
  } else {
    const spec = dockerBuildSpec({
      workspace, image, sourceSha: sha, runId: randomUUID(), uid: 10001, gid: 10001
    });
    process.stdout.write(JSON.stringify({
      command: spec.command,
      args: spec.args,
      realExecution: false,
      hasCloudflareCredentials: false
    }, null, 2) + "\n");
  }
}
