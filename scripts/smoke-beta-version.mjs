import { createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

const BASE = "https://api.cloudflare.com/client/v4";
const ID = /^[0-9a-f]{32}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Creates and deletes a new, unlinked, non-deployed Worker in an explicitly
 * configured test account. Does NOT update any existing Worker, D1, KV, DO,
 * Cloudflare Trigger, route or domain. Bearer token arrives only on stdin.
 */
async function call(token, account, suffix, method = "GET", body, bearer = token) {
  const headers = {
    Authorization: "Bearer " + bearer,
    Accept: "application/json"
  };
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(BASE + "/accounts/" + account + suffix, {
    method,
    headers,
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(40_000)
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success !== true) {
    const code = json?.errors?.[0]?.code;
    throw new Error("Cloudflare " + method + " " + suffix.split("?")[0] +
      " returned HTTP " + response.status + (code ? " code " + code : ""));
  }
  return json.result ?? null;
}

async function readStdinToken() {
  let token = "";
  for await (const piece of process.stdin) token += piece.toString();
  token = token.trim();
  if (token.length < 16) throw new Error("Test account token was not provided on stdin.");
  return token;
}

export async function smoke(account, token, allowedAccount = process.env.INSIGHTFLARE_SMOKE_TEST_ACCOUNT_ID) {
  if (!ID.test(account) || !allowedAccount || !ID.test(allowedAccount) ||
      account.toLowerCase() !== allowedAccount.toLowerCase()) {
    throw new Error("The explicit test-account allowlist is missing or does not match; refusing any Cloudflare write.");
  }
  const script = "ifd-staging-smoke-" + randomBytes(5).toString("hex");
  let workerId = null;
  const report = { created: false, uploadedAssets: false, stagedVersion: false, noTrafficDeployment: false, deleted: false };

  try {
    // No existing Worker can be selected: the random name is generated here.
    const worker = await call(token, account, "/workers/workers", "POST", {
      name: script, subdomain: { enabled: false }, observability: { enabled: false }
    });
    if (!worker || !ID.test(worker.id) || worker.name !== script) {
      throw new Error("Worker create returned an unrecognized identity. Reconcile manually before retrying.");
    }
    workerId = worker.id;
    report.created = true;

    const html = Buffer.from("<!doctype html><title>InsightFlare API upload smoke</title>");
    const b64 = html.toString("base64");
    const hash = createHash("sha256").update(b64 + "html").digest("hex").slice(0, 32);
    const session = await call(token, account,
      "/workers/scripts/" + script + "/assets-upload-session",
      "POST", { manifest: { "/index.html": { hash, size: html.length } } }
    );
    if (!session?.jwt || !Array.isArray(session.buckets)) throw new Error("Assets Upload Session response is incomplete.");

    let jwt = session.jwt;
    if (session.buckets.length) {
      let completed = false;
      for (const bucket of session.buckets) {
        if (bucket.length !== 1 || bucket[0] !== hash) throw new Error("Unexpected upload bucket returned.");
        const form = new FormData();
        form.append(hash, new Blob([b64], { type: "text/html" }), hash);
        const uploaded = await call(token, account, "/workers/assets/upload?base64=true",
          "POST", form, session.jwt);
        if (uploaded?.jwt) {
          jwt = uploaded.jwt;
          completed = true;
        }
      }
      if (!completed) throw new Error("Assets upload returned no completion JWT.");
    }
    report.uploadedAssets = true;

    const scriptBytes = Buffer.from(
      "export default {async fetch(request,env){return env.ASSETS.fetch(request)}}"
    );
    const candidate = await call(token, account,
      "/workers/workers/" + workerId + "/versions?deploy=false", "POST", {
        main_module: "index.js",
        compatibility_date: "2026-03-01",
        modules: [{
          name: "index.js", content_type: "application/javascript+module",
          content_base64: scriptBytes.toString("base64")
        }],
        assets: { jwt, config: { html_handling: "auto-trailing-slash", not_found_handling: "none" } },
        bindings: [{ type: "assets", name: "ASSETS" }],
        annotations: {
          "workers/tag": "ifd-isolated-smoke",
          "workers/message": "Isolated Worker version upload, never promote"
        }
      });
    if (!candidate || !UUID.test(candidate.id)) throw new Error("Cloudflare returned no staged Worker version ID.");
    report.stagedVersion = true;

    const active = await call(token, account,
      "/workers/scripts/" + script + "/deployments");
    if (active && (!Array.isArray(active.deployments) || active.deployments.length !== 0)) {
      throw new Error("DEPLOYMENT SAFETY FAILURE: deploy=false still returned a live deployment.");
    }
    report.noTrafficDeployment = true;
    const detail = await call(token, account,
      "/workers/workers/" + workerId + "/versions/" + candidate.id);
    if (!detail || detail.id !== candidate.id || detail.annotations?.["workers/tag"] !== "ifd-isolated-smoke") {
      throw new Error("The staged Worker version metadata could not be verified.");
    }
  } finally {
    if (workerId) {
      try {
        await call(token, account, "/workers/workers/" + workerId, "DELETE");
        report.deleted = true;
      } catch (error) {
        // The random Worker name is the only cleanup identifier emitted.
        process.stderr.write("Cleanup failed for temporary Worker " + script + ": " +
          (error?.message ?? error) + "\n");
      }
    }
  }
  return report;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const [account, flag] = process.argv.slice(2);
  if (flag !== "--isolated-test-account-only") {
    process.stderr.write("This smoke test requires the explicit --isolated-test-account-only guard.\n");
    process.exitCode = 2;
  } else {
    readStdinToken().then(token => smoke(account, token)).then(report => {
      process.stdout.write(JSON.stringify(report) + "\n");
      if (!report.deleted || !report.noTrafficDeployment) process.exitCode = 1;
    }).catch(error => {
      process.stderr.write("Smoke test failed: " + String(error?.message ?? error) + "\n");
      process.exitCode = 1;
    });
  }
}
