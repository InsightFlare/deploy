import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { packBuild } from "../scripts/pack-build.mjs";

const SHA = "d76d22473e6ba185c69d00ef92223a6cd95e58c7";
const CONFIG = {
  name: "insightflare",
  main: "index.js",
  no_bundle: true,
  compatibility_date: "2026-03-01",
  compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
  assets: { directory: "../client" },
  migrations: [
    { tag: "v1", new_sqlite_classes: ["IngestDurableObject"] },
    { tag: "v2", new_sqlite_classes: ["DiagnosticsSampler"] },
    { tag: "v3", deleted_classes: ["DiagnosticsSampler"] }
  ],
  durable_objects: { bindings: [{ name: "INGEST_DO", class_name: "IngestDurableObject" }] },
  d1_databases: [{ binding: "DB", database_id: "YOUR_D1_ID" }],
  kv_namespaces: [{ binding: "SITE_SETTINGS_KV", id: "YOUR_KV_ID" }],
  vars: { SESSION_WINDOW_MINUTES: "30" },
  triggers: { crons: ["*/30 * * * *"] }
};

async function buildFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "insightflare-artifact-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function put(relative, data) {
    const target = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  await put("dist/server/wrangler.json", JSON.stringify(CONFIG));
  await put("dist/server/index.js",
    'import { run } from "./assets/runtime.js"; /* import x from "./nonexistent.js"; */ export default { fetch: run };');
  await put("dist/server/assets/runtime.js", "export async function run(){ return new Response('ok'); }");
  await put("dist/server/assets/runtime.js.map", "large source map");
  await put("dist/server/.vite/manifest.json", "{}");
  await put("dist/client/index.html", "<!doctype html>");
  await put("dist/client/assets/site.js", "console.log('hi')");
  await put("dist/client/assets/logo.png", new Uint8Array([0, 1, 2]));
  await put("dist/client/.assetsignore", "wrangler.json\n");
  return { root, put };
}

describe("pinned, independent InsightFlare build artifact packager", () => {
  it("captures compiled Worker entry, runtime modules, assets and exact SHA without shipping excluded files", async t => {
    const { root } = await buildFixture(t);
    const pack = await packBuild({ root, sha: SHA, verifyGit: false });
    assert.equal(pack.summary.sourceSha, SHA);
    assert.deepEqual(pack.modules.map(x => x.name), ["assets/runtime.js", "index.js"]);
    assert.deepEqual(pack.assets.map(x => x.path), ["assets/logo.png", "assets/site.js", "index.html"]);
    assert.deepEqual(pack.summary.migrationTags, ["v1", "v2", "v3"]);
    assert.equal(pack.summary.skippedSourceMaps, 1);
    assert.equal(pack.summary.nonLiteralDynamicImports, 0);
    assert.equal(pack.config.mainModule, "index.js");
    assert.deepEqual(pack.config.observedBuildVariables, ["SESSION_WINDOW_MINUTES"]);
    assert.equal(pack.modules[1].contentType, "application/javascript+module");
    assert.equal(pack.assets.find(x => x.path === "index.html").contentType, "text/html");
    assert.equal(pack.assets.find(x => x.path === "assets/logo.png").contentType, "image/png");
    assert.ok(!JSON.stringify(pack.summary).includes("YOUR_D1_ID"));
  });

  it("produces deterministic digest and Cloudflare-specific asset hashes", async t => {
    const { root } = await buildFixture(t);
    const a = await packBuild({ root, sha: SHA, verifyGit: false });
    const b = await packBuild({ root, sha: SHA, verifyGit: false });
    assert.equal(a.summary.digest, b.summary.digest);
    const png = a.assets.find(x => x.path === "assets/logo.png");
    assert.equal(png.hash,
      createHash("sha256").update(Buffer.from([0, 1, 2]).toString("base64") + "png").digest("hex").slice(0, 32));
  });

  it("rejects missing runtime modules that would break the deployed Worker", async t => {
    const { root, put } = await buildFixture(t);
    await put("dist/server/index.js", 'import "./assets/missing.js"; export default {};');
    await assert.rejects(packBuild({ root, sha: SHA, verifyGit: false }), /references missing module/);
  });

  it("does not mistake JSDoc or string literals for ESM imports", async t => {
    const { root, put } = await buildFixture(t);
    await put("dist/server/index.js",
      '/* @example import {x} from "./missing.js"; */\nconst s = "import x from \\"./unresolved.js\\""; export default {};');
    const pack = await packBuild({ root, sha: SHA, verifyGit: false });
    assert.equal(pack.modules.length, 2);
  });

  it("refuses unexpected server output extensions rather than accidentally omitting code", async t => {
    const { root, put } = await buildFixture(t);
    await put("dist/server/assets/unexpected.node", "binary");
    await assert.rejects(packBuild({ root, sha: SHA, verifyGit: false }), /unexpected server output/);
  });

  it("rejects an unrecognized build configuration or missing required bindings", async t => {
    const { root, put } = await buildFixture(t);
    await put("dist/server/wrangler.json", JSON.stringify({ ...CONFIG, assets: { directory: "./other" } }));
    await assert.rejects(packBuild({ root, sha: SHA, verifyGit: false }), /incompatible/);
    await put("dist/server/wrangler.json", JSON.stringify({ ...CONFIG, d1_databases: [] }));
    await assert.rejects(packBuild({ root, sha: SHA, verifyGit: false }), /exactly one binding for DB/);
  });

  it("rejects ambiguous source identifiers and enforces Git identity by default", async t => {
    const { root } = await buildFixture(t);
    await assert.rejects(packBuild({ root, sha: "main", verifyGit: false }), /40-character/);
    await assert.rejects(packBuild({ root, sha: SHA }), /git/i);
  });

  it("treats a changed static file as a distinct artifact digest", async t => {
    const { root, put } = await buildFixture(t);
    const old = await packBuild({ root, sha: SHA, verifyGit: false });
    await put("dist/client/index.html", "<!doctype html><title>updated</title>");
    const next = await packBuild({ root, sha: SHA, verifyGit: false });
    assert.notEqual(old.summary.digest, next.summary.digest);
  });
});
