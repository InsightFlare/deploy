import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { init, parse } from "es-module-lexer";

const FULL_SHA = /^[0-9a-f]{40}$/i;
const SAFE_PATH = /^[A-Za-z0-9_.\/-]+$/;
const GENERATOR_OUTPUTS = new Set(["docs/skills.json", "src/routeTree.gen.ts"]);
const WORKER_EXTENSIONS = new Set([".js", ".mjs", ".wasm"]);
const SKIP_SERVER_EXTENSIONS = new Set([".map", ".css", ".woff", ".woff2"]);
const SKIP_ASSET_NAMES = new Set([".assetsignore", ".dev.vars", "wrangler.json"]);
const MIME = new Map([
  [".html", "text/html"], [".htm", "text/html"], [".js", "text/javascript"],
  [".mjs", "text/javascript"], [".css", "text/css"], [".json", "application/json"],
  [".webmanifest", "application/manifest+json"], [".map", "application/json"],
  [".png", "image/png"], [".svg", "image/svg+xml"], [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"],
  [".gif", "image/gif"], [".avif", "image/avif"], [".woff2", "font/woff2"],
  [".woff", "font/woff"], [".ttf", "font/ttf"], [".otf", "font/otf"],
  [".txt", "text/plain"], [".xml", "application/xml"], [".wasm", "application/wasm"]
]);

function fail(message) {
  throw new Error("Unsafe InsightFlare build artifact: " + message);
}

function normalizedRelative(value) {
  const relative = value.replaceAll("\\", "/");
  if (!relative || relative.startsWith("/") || relative.includes(":") ||
      relative.split("/").some(part => !part || part === "." || part === "..") ||
      !SAFE_PATH.test(relative)) {
    fail("invalid relative output path: " + value);
  }
  return relative;
}

async function listFiles(directory, prefix = "") {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = normalizedRelative(prefix ? prefix + "/" + entry.name : entry.name);
    if (entry.isSymbolicLink()) fail("symlinks are forbidden in generated output: " + relative);
    if (entry.isDirectory()) {
      output.push(...await listFiles(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      output.push(relative);
    } else {
      fail("unsupported generated file type: " + relative);
    }
  }
  return output.sort((a, b) => a.localeCompare(b, "en"));
}

function ensureGitSource(root, pinnedSha) {
  const current = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (current.toLowerCase() !== pinnedSha) fail("the checkout's Git HEAD differs from the pinned upstream SHA");
  const changed = execFileSync("git", ["-C", root, "diff", "--name-only", "HEAD", "--"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
  }).split(/\r?\n/).filter(Boolean).map(name => name.replaceAll("\\", "/"));
  if (changed.some(name => !GENERATOR_OUTPUTS.has(name))) {
    fail("the source checkout has changes outside the two known generated outputs: " +
      changed.filter(name => !GENERATOR_OUTPUTS.has(name)).join(", "));
  }
  const untracked = execFileSync("git", ["-C", root, "ls-files", "--others", "--exclude-standard"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
  }).split(/\r?\n/).filter(Boolean).map(name => name.replaceAll("\\", "/"));
  if (untracked.some(name => name !== "dist" && !name.startsWith("dist/"))) {
    fail("the source checkout has unexpected untracked files: " +
      untracked.filter(name => name !== "dist" && !name.startsWith("dist/")).join(", "));
  }
}

function assertConfig(config) {
  if (!config || typeof config !== "object" || config.name !== "insightflare" ||
      config.main !== "index.js" || config.no_bundle !== true ||
      !/^20\d{2}-\d{2}-\d{2}$/.test(config.compatibility_date ?? "") ||
      !Array.isArray(config.compatibility_flags) ||
      config.assets?.directory !== "../client") {
    fail("wrangler build metadata is incompatible with this packager");
  }
  const required = [
    ["durable_objects", "bindings", "INGEST_DO"],
    ["d1_databases", null, "DB"],
    ["kv_namespaces", null, "SITE_SETTINGS_KV"]
  ];
  for (const [section, nested, name] of required) {
    const entries = nested ? config[section]?.[nested] : config[section];
    const found = Array.isArray(entries) ? entries.filter(item => (item.name ?? item.binding) === name) : [];
    if (found.length !== 1) fail("expected exactly one binding for " + name);
  }
  if (!Array.isArray(config.migrations) || config.migrations.length === 0) {
    fail("missing Durable Object migration history");
  }
  const tags = new Set();
  for (const migration of config.migrations) {
    if (typeof migration.tag !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(migration.tag) ||
        tags.has(migration.tag) || !Object.keys(migration).some(key => key !== "tag")) {
      fail("invalid or duplicate Durable Object migration step");
    }
    tags.add(migration.tag);
  }
  return {
    name: config.name,
    mainModule: config.main,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: [...config.compatibility_flags],
    migrations: config.migrations.map(item => structuredClone(item)),
    observedBuildVariables: Object.keys(config.vars ?? {}).sort(),
    cronTriggers: Array.isArray(config.triggers?.crons) ? [...config.triggers.crons] : [],
    observability: config.observability ? structuredClone(config.observability) : undefined
  };
}

async function verifyModuleReferences(modules) {
  await init();
  const byName = new Map(modules.map(item => [item.name, item]));
  let nonLiteralDynamicImports = 0;
  for (const module of modules) {
    if (!module.name.endsWith(".js") && !module.name.endsWith(".mjs")) continue;
    const source = module.content.toString("utf8");
    const [imports] = parse(source, module.name);
    for (const entry of imports) {
      if (typeof entry.specifier !== "string") {
        if (entry.type === "dynamic") nonLiteralDynamicImports++;
        continue;
      }
      const target = entry.specifier;
      if (!target.startsWith(".")) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(module.name), target));
      if (resolved.startsWith("../") || resolved.startsWith("/") || !byName.has(resolved)) {
        fail("Worker module " + module.name + " references missing module " + target);
      }
    }
  }
  return nonLiteralDynamicImports;
}

function contentHash(buffer, relativePath) {
  const ext = path.posix.extname(relativePath).slice(1);
  return createHash("sha256").update(buffer.toString("base64") + ext).digest("hex").slice(0, 32);
}

/**
 * Capture one *locally compiled* and Git-pinned build. No Cloudflare credentials,
 * deployment actions, D1 migrations, shared release store or network calls.
 *
 * @param {{root:string,sha:string,verifyGit?:boolean}} options
 */
export async function packBuild({ root, sha, verifyGit = true }) {
  if (typeof root !== "string" || !root.trim() || typeof sha !== "string" || !FULL_SHA.test(sha)) {
    fail("an absolute checkout path and exact 40-character source SHA are required");
  }
  root = path.resolve(root);
  const pinnedSha = sha.toLowerCase();
  if (verifyGit) ensureGitSource(root, pinnedSha);

  const configPath = path.join(root, "dist", "server", "wrangler.json");
  const config = assertConfig(JSON.parse(await readFile(configPath, "utf8")));
  const serverDir = path.join(root, "dist", "server");
  const clientDir = path.join(root, "dist", "client");
  const serverFiles = await listFiles(serverDir);
  const clientFiles = await listFiles(clientDir);
  const moduleNames = serverFiles.filter(name => {
    if (name === "wrangler.json" || name.startsWith(".vite/")) return false;
    const ext = path.posix.extname(name);
    if (SKIP_SERVER_EXTENSIONS.has(ext)) return false;
    if (!WORKER_EXTENSIONS.has(ext)) fail("unexpected server output: " + name);
    return true;
  });
  if (!moduleNames.includes(config.mainModule)) fail("missing compiled Worker entrypoint");
  if (moduleNames.length > 1000) fail("too many Worker modules");

  const modules = [];
  let moduleBytes = 0;
  for (const name of moduleNames) {
    const content = await readFile(path.join(serverDir, ...name.split("/")));
    if (content.length > 25 * 1024 * 1024) fail("oversize Worker module: " + name);
    moduleBytes += content.length;
    modules.push({ name, contentType: name.endsWith(".wasm") ? "application/wasm" : "application/javascript+module", content });
  }
  if (moduleBytes > 80 * 1024 * 1024) fail("oversize Worker module set");
  const nonLiteralDynamicImports = await verifyModuleReferences(modules);

  const assets = [];
  const hashes = new Map();
  let assetBytes = 0;
  for (const relative of clientFiles) {
    if (SKIP_ASSET_NAMES.has(relative) || relative.endsWith(".map")) continue;
    // Cloudflare asset upload excludes dotfiles unless explicitly handled by Wrangler.
    if (relative.split("/").some(part => part.startsWith("."))) continue;
    const ext = path.posix.extname(relative);
    const contentType = MIME.get(ext);
    if (!contentType) fail("unknown static asset MIME type: " + relative);
    const content = await readFile(path.join(clientDir, ...relative.split("/")));
    if (content.length > 25 * 1024 * 1024) fail("oversize static asset: " + relative);
    assetBytes += content.length;
    const hash = contentHash(content, relative);
    const prior = hashes.get(hash);
    if (prior && (!prior.content.equals(content) || prior.contentType !== contentType)) {
      fail("static asset hash collision or ambiguous MIME: " + relative);
    }
    hashes.set(hash, { content, contentType });
    assets.push({ path: relative, contentType, content, hash });
  }
  if (!assets.length || assets.length > 10000 || assetBytes > 100 * 1024 * 1024) {
    fail("invalid static assets size or count");
  }
  const deterministicDigest = createHash("sha256");
  for (const entry of [...modules.map(x => ({ ...x, path: "worker/" + x.name })),
    ...assets.map(x => ({ ...x, path: "asset/" + x.path }))].sort((a, b) => a.path.localeCompare(b.path, "en"))) {
    deterministicDigest.update(entry.path).update("\0");
    deterministicDigest.update(createHash("sha256").update(entry.content).digest()).update("\0");
  }

  return {
    pinnedSha,
    config,
    modules,
    assets,
    summary: {
      sourceSha: pinnedSha,
      moduleCount: modules.length,
      moduleBytes,
      assetCount: assets.length,
      assetBytes,
      skippedSourceMaps: serverFiles.filter(name => name.endsWith(".map")).length,
      skippedStaticSourceMaps: clientFiles.filter(name => name.endsWith(".map")).length,
      digest: deterministicDigest.digest("hex"),
      migrationTags: config.migrations.map(item => item.tag),
      nonLiteralDynamicImports
    }
  };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const [root, sha] = process.argv.slice(2);
  packBuild({ root, sha }).then(({ summary }) => {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  }).catch(error => {
    process.stderr.write(String(error?.message ?? error) + "\n");
    process.exitCode = 1;
  });
}
