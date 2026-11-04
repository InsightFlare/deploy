import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { smoke } from "../scripts/smoke-beta-version.mjs";

const ACCOUNT = "a".repeat(32);
const WORKER = "f".repeat(32);
const VERSION = "9f3033c5-139c-46fb-b406-52ec1ae19504";
const success = result => Response.json({ success: true, result });

async function simulate(t, { activeDeployment = false, uploadFailure = false } = {}) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let scriptName;
  let expectedHash;
  let deleted = false;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (url, init) => {
    const address = new URL(url);
    const method = init?.method ?? "GET";
    calls.push({ address: address.pathname + address.search, method });
    assert.equal(address.hostname, "api.cloudflare.com");
    assert.ok(address.pathname.startsWith("/client/v4/accounts/" + ACCOUNT + "/"));
    const action = address.pathname.slice(("/client/v4/accounts/" + ACCOUNT).length);

    if (method === "POST" && action === "/workers/workers") {
      const config = JSON.parse(init.body);
      assert.match(config.name, /^ifd-staging-smoke-[a-f0-9]{10}$/);
      assert.equal(config.subdomain.enabled, false);
      assert.equal(config.observability.enabled, false);
      scriptName = config.name;
      return success({ id: WORKER, name: scriptName });
    }
    if (method === "POST" && action === "/workers/scripts/" + scriptName + "/assets-upload-session") {
      const manifest = JSON.parse(init.body).manifest;
      assert.deepEqual(Object.keys(manifest), ["/index.html"]);
      const html = Buffer.from("<!doctype html><title>InsightFlare API upload smoke</title>");
      expectedHash = createHash("sha256").update(html.toString("base64") + "html").digest("hex").slice(0, 32);
      assert.deepEqual(manifest["/index.html"], { hash: expectedHash, size: html.length });
      return success({ jwt: "temporary-jwt", buckets: [[expectedHash]] });
    }
    if (method === "POST" && action === "/workers/assets/upload" && address.search === "?base64=true") {
      assert.equal(init.headers.Authorization, "Bearer temporary-jwt");
      const form = init.body;
      assert.deepEqual([...form.keys()], [expectedHash]);
      const uploaded = form.get(expectedHash);
      assert.equal(uploaded.type, "text/html");
      assert.equal(await uploaded.text(), Buffer.from("<!doctype html><title>InsightFlare API upload smoke</title>").toString("base64"));
      if (uploadFailure) return Response.json({
        success: false, errors: [{ code: 9999, message: "Sensitive mock error" }]
      }, { status: 400 });
      return success({ jwt: "completed-jwt" });
    }
    if (method === "POST" && action === "/workers/workers/" + WORKER + "/versions" && address.search === "?deploy=false") {
      const body = JSON.parse(init.body);
      assert.equal(body.main_module, "index.js");
      assert.equal(body.assets.jwt, "completed-jwt");
      assert.deepEqual(body.bindings, [{ type: "assets", name: "ASSETS" }]);
      assert.equal(body.annotations["workers/tag"], "ifd-isolated-smoke");
      assert.equal(body.modules.length, 1);
      assert.equal(Buffer.from(body.modules[0].content_base64, "base64").toString().includes("env.ASSETS.fetch"), true);
      return success({ id: VERSION });
    }
    if (method === "GET" && action === "/workers/scripts/" + scriptName + "/deployments") {
      return success({ deployments: activeDeployment ? [{ id: VERSION }] : [] });
    }
    if (method === "GET" && action === "/workers/workers/" + WORKER + "/versions/" + VERSION) {
      return success({ id: VERSION, annotations: { "workers/tag": "ifd-isolated-smoke" } });
    }
    if (method === "DELETE" && action === "/workers/workers/" + WORKER) {
      deleted = true;
      return success({});
    }
    throw new Error("Unexpected Cloudflare smoke request " + method + " " + action);
  };
  return { calls, wasDeleted: () => deleted };
}

describe("isolated Cloudflare Beta Version smoke workflow (mock HTTP only)", () => {
  it("creates a new unlinked Worker, uploads assets, stages without deployment and deletes the test Worker", async t => {
    const trace = await simulate(t);
    const report = await smoke(ACCOUNT, "not-a-real-token", ACCOUNT);
    assert.deepEqual(report, {
      created: true, uploadedAssets: true, stagedVersion: true,
      noTrafficDeployment: true, deleted: true
    });
    assert.equal(trace.wasDeleted(), true);
    assert.ok(trace.calls.some(x => x.method === "POST" && x.address.endsWith("/versions?deploy=false")));
    assert.equal(trace.calls.filter(x => x.method === "DELETE").length, 1);
    assert.ok(!trace.calls.some(x => x.address.endsWith("/deployments") && x.method !== "GET"));
    assert.ok(!trace.calls.some(x => x.address.includes("/d1/") || x.address.includes("/kv/")));
  });

  it("does not silently promote a version; fails and cleans up if a deployment appears", async t => {
    const trace = await simulate(t, { activeDeployment: true });
    await assert.rejects(smoke(ACCOUNT, "not-a-real-token", ACCOUNT), /DEPLOYMENT SAFETY FAILURE/);
    assert.equal(trace.wasDeleted(), true);
    assert.equal(trace.calls.filter(x => x.method === "DELETE").length, 1);
  });

  it("cleans up an isolated Worker if its static asset upload fails", async t => {
    const trace = await simulate(t, { uploadFailure: true });
    await assert.rejects(smoke(ACCOUNT, "not-a-real-token", ACCOUNT), /HTTP 400 code 9999/);
    assert.equal(trace.wasDeleted(), true);
    assert.ok(!trace.calls.some(x => x.address.endsWith("/versions?deploy=false")));
  });

  it("rejects any account not explicitly allowlisted before making an API request", async t => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => { called = true; throw Error("must not call"); };
    t.after(() => { globalThis.fetch = originalFetch; });
    await assert.rejects(smoke("b".repeat(32), "not-a-real-token", ACCOUNT), /test-account allowlist/);
    await assert.rejects(smoke(ACCOUNT, "not-a-real-token", null), /test-account allowlist/);
    assert.equal(called, false);
  });
});
