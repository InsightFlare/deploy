import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dockerBuildSpec, withIsolatedBuild } from "../scripts/isolated-builder.mjs";

const SHA = "d".repeat(40);
const ACCOUNT = "a".repeat(32);
const OWNER = "test-builder-user-0123456789abcdef";
const IMAGE = "sha256:" + "b".repeat(64);
const RUN = "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const scratch = path.join(os.tmpdir(), "ifd-test-container");
const uid = process.getuid?.() && process.getuid() >= 1000 ? process.getuid() : 10001;
const gid = process.getgid?.() && process.getgid() >= 1000 ? process.getgid() : 10001;

function request() {
  return { runId: RUN, ownerId: OWNER, accountId: ACCOUNT,
    sourceSha: SHA, expiresAt: Date.now() + 10 * 60_000 };
}
function options(rootDir, overrides = {}) {
  const calls = [];
  let workspace = "";
  return {
    calls,
    workspace: () => workspace,
    deps: {
      rootDir, platform: "linux", uid, gid, image: IMAGE,
      execute: async args => {
        calls.push([...args]);
        if (args[0] === "run") {
          const mount = args[args.indexOf("--mount") + 1];
          workspace = mount.match(/^type=bind,source=(.+),target=\/work$/)?.[1] ?? "";
          await mkdir(path.join(workspace, "checkout"), { recursive: true });
        }
        return "mock completed";
      },
      verify: async ({ sha, root }) => {
        assert.equal(sha, SHA);
        assert.equal(root, path.join(workspace, "checkout"));
        return { pinnedSha: SHA, summary: {
          sourceSha: SHA, digest: "c".repeat(64), moduleCount: 318, assetCount: 309
        } };
      },
      ...overrides
    }
  };
}

describe("dedicated builder Docker invocation contract", () => {
  const spec = () => dockerBuildSpec({ workspace: scratch, sourceSha: SHA,
    image: IMAGE, runId: RUN, uid: 10001, gid: 10001 });

  it("uses pinned image, no Cloudflare tokens, non-root, bounded resources and a single ephemeral work mount", () => {
    const { command, args, containerName } = spec();
    assert.equal(command, "docker");
    assert.match(containerName, /^ifd-[a-f0-9]{32}-[a-f0-9]{16}$/);
    for (const part of ["--rm", "--init", "--read-only", "--cap-drop", "ALL",
      "no-new-privileges", "--pids-limit", "256", "--memory", "6g",
      "--memory-swap", "--cpus", "2", "--tmpfs", "--mount", "--network", "bridge"]) {
      assert.ok(args.includes(part), "missing " + part);
    }
    assert.equal(args[args.indexOf("--user") + 1], "10001:10001");
    assert.equal(args[args.indexOf("--mount") + 1], "type=bind,source=" + scratch + ",target=/work");
    assert.equal(args.at(-1), IMAGE);
    assert.ok(args.includes("IFD_SOURCE_SHA=" + SHA));
    assert.ok(!args.includes("--privileged"));
    assert.ok(!args.includes("--env-file"));
    assert.ok(!args.some(item => /CLOUDFLARE_API_TOKEN|CF_API_TOKEN|GITHUB_TOKEN|NPM_TOKEN|docker\.sock|DOCKER_HOST/.test(item)));
  });

  it("provides an inspect-only CLI that prints arguments without starting Docker", () => {
    const script = new URL("../scripts/isolated-builder.mjs", import.meta.url);
    const result = spawnSync(process.execPath, [fileURLToPath(script), "--inspect", IMAGE, SHA, scratch], {
      encoding: "utf8", shell: false, timeout: 10000
    });
    assert.equal(result.status, 0, result.stderr);
    const spec = JSON.parse(result.stdout);
    assert.equal(spec.realExecution, false);
    assert.equal(spec.hasCloudflareCredentials, false);
    assert.equal(spec.command, "docker");
  });

  it("uses a fresh cleanup identity even when a previously issued run ID is replayed", () => {
    const first = spec();
    const second = spec();
    assert.notEqual(first.containerName, second.containerName);
    assert.equal(first.args[first.args.indexOf("--label") + 1], "insightflare.deploy.build=true");
  });

  it("rejects mutable image tags, root user, malformed IDs and unsafe mount paths", () => {
    const base = { workspace: scratch, sourceSha: SHA, image: IMAGE,
      runId: RUN, uid: 10001, gid: 10001 };
    for (const overrides of [
      { image: "node:24-bookworm-slim" }, { image: "attacker.io/image:latest" },
      { sourceSha: "main" }, { runId: "predictable-id" },
      { uid: 0 }, { gid: 0 }, { workspace: "relative/path" },
      { workspace: scratch + ",source=/etc" }, { workspace: scratch + "\n" }
    ]) {
      assert.throws(() => dockerBuildSpec({ ...base, ...overrides }), /Unsafe isolated build/);
    }
  });

  it("contains a fixed upstream URL and explicit no-prebuild command, never a deploy command", async () => {
    const shell = await readFile(new URL("../builder/entrypoint.sh", import.meta.url), "utf8");
    assert.match(shell, /github\.com\/RavelloH\/InsightFlare\.git/);
    assert.match(shell, /fetch --no-tags --depth=1 origin/);
    assert.match(shell, /--target cf --skip-prebuild/);
    assert.match(shell, /pnpm install --frozen-lockfile --ignore-scripts/);
    assert.doesNotMatch(shell, /wrangler deploy|migrations apply|--remote/);
  });
});

describe("ephemeral build workspace lifecycle, offline mocks only", () => {
  async function testRoot(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "ifd-runner-tests-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    return root;
  }

  it("delivers only a scoped verified receipt, then clears source/dist and the container", async t => {
    const root = await testRoot(t);
    const { deps, calls, workspace } = options(root);
    let received = false;
    const result = await withIsolatedBuild(request(), async ({ receipt, artifact }) => {
      received = true;
      assert.equal(receipt.sourceSha, SHA);
      assert.equal(receipt.accountId, ACCOUNT);
      assert.equal(receipt.artifactDigest, "c".repeat(64));
      assert.equal(receipt.provider, "isolated-container");
      assert.equal(receipt.deployed, false);
      assert.equal(artifact.summary.moduleCount, 318);
      assert.equal(existsSync(workspace()), true);
      return "accepted";
    }, deps);
    assert.equal(received, true);
    assert.equal(result, "accepted");
    assert.equal(existsSync(workspace()), false);
    assert.equal(calls.filter(c => c[0] === "run").length, 1);
    assert.equal(calls.filter(c => c[0] === "rm" && c[1] === "-f").length, 1);
  });

  it("cleans up even when the consumer throws", async t => {
    const root = await testRoot(t);
    const { deps, calls, workspace } = options(root);
    await assert.rejects(withIsolatedBuild(request(), async () => { throw Error("consumer failed"); }, deps), /consumer failed/);
    assert.equal(existsSync(workspace()), false);
    assert.ok(calls.some(c => c[0] === "rm"));
  });

  it("cleans up failed Docker builds without verifying or publishing anything", async t => {
    const root = await testRoot(t);
    const { deps, calls } = options(root, {
      execute: async args => { calls.push([...args]); if (args[0] === "run") throw Error("Docker build failed"); },
      verify: async () => { throw Error("must not verify"); }
    });
    await assert.rejects(withIsolatedBuild(request(), async () => { throw Error("must not receive"); }, deps), /Docker build failed/);
    assert.ok(calls.some(c => c[0] === "rm" && c[1] === "-f"));
    const folders = await (await import("node:fs/promises")).readdir(root);
    assert.deepEqual(folders, []);
  });

  it("rejects returned artifacts from an unexpected SHA before the consumer sees bytes", async t => {
    const root = await testRoot(t);
    const { deps, workspace } = options(root, {
      verify: async () => ({ pinnedSha: "e".repeat(40), summary: { sourceSha: SHA } })
    });
    let invoked = false;
    await assert.rejects(withIsolatedBuild(request(), async () => { invoked = true; }, deps), /does not match/);
    assert.equal(invoked, false);
    assert.equal(existsSync(workspace()), false);
  });

  it("blocks expired requests before a Docker invocation", async t => {
    const root = await testRoot(t);
    const { deps, calls } = options(root);
    await assert.rejects(withIsolatedBuild({ ...request(), expiresAt: Date.now() - 1 },
      async () => "never", deps), /short-lived authorization/);
    assert.equal(calls.length, 0);
  });

  it("rejects symlinked scratch directories", async t => {
    const base = await testRoot(t);
    const actual = path.join(base, "actual");
    const linked = path.join(base, "linked");
    await mkdir(actual);
    try { await symlink(actual, linked, process.platform === "win32" ? "junction" : "dir"); }
    catch { t.skip("symlink creation is unavailable on this host"); return; }
    const { deps } = options(linked);
    await assert.rejects(withIsolatedBuild(request(), async () => "never", deps), /symlink/);
  });

  it("blocks execution on Windows or an unpinned image", async t => {
    const root = await testRoot(t);
    const { deps } = options(root);
    await assert.rejects(withIsolatedBuild(request(), async () => "never", { ...deps, platform: "win32" }), /dedicated Linux host/);
    await assert.rejects(withIsolatedBuild(request(), async () => "never", { ...deps, image: "node:24" }), /sha256/);
  });
});
