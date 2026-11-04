import { Hono } from "hono";
import type { Env } from "./types";
import { DeployError } from "./types";
import { resolveLatestMain } from "./core/source";
import { deploymentPlan, type Intent } from "./core/plan";
import { planResourceReconciliation } from "./core/reconcile";
import { CloudflareClient } from "./providers/cloudflare/client";
import { discoverDeployment } from "./providers/cloudflare/discovery";
import { inspectBuildReadiness } from "./providers/cloudflare/build-readiness";
import { BUILD_ADAPTER_STATUS } from "./providers/cloudflare/builds";
import { BUILD_PROCESS_CONTRACT } from "./core/build-policy";
import { prepareAccountRun, readAccountRun } from "./session/runs";
import { assertReviewedSource } from "./core/run";
import { oauthConfigured, startOAuth, finishOAuth, connectionStatus, signOut, userToken, assertSameOrigin, sessionIdentity } from "./security/oauth";

export { DeploySession } from "./session/store";
export { DeploymentRun } from "./session/runs";

const app = new Hono<{ Bindings: Env }>();
const ACCOUNT = /^[a-f0-9]{32}$/i;

app.onError((error, c) => {
  if (error instanceof DeployError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 409 | 502 | 503, { "Cache-Control": "no-store" });
  }
  // Sensitive upstream details and tokens must not leak to the client.
  return c.json({ error: { code: "UPSTREAM_UNAVAILABLE", message: "The request could not be completed. Please retry." } }, 503, { "Cache-Control": "no-store" });
});

app.get("/api/v1/health", c => c.json({ ok: true, service: "insightflare-deploy", deploymentMutationsEnabled: false }));
app.get("/api/v1/config", c => c.json({
  source: c.env.SOURCE_REPOSITORY || "RavelloH/InsightFlare",
  oauthConfigured: oauthConfigured(c.env),
  deploymentMutationsEnabled: false,
  builds: BUILD_ADAPTER_STATUS
}, 200, { "Cache-Control": "no-store" }));

app.get("/api/v1/source/main", async c => c.json(await resolveLatestMain(), 200, { "Cache-Control": "public, max-age=45" }));
app.get("/api/v1/source/build-contract", c => c.json(BUILD_PROCESS_CONTRACT, 200, { "Cache-Control": "public, max-age=300" }));
app.get("/api/v1/session", connectionStatus);
app.get("/api/v1/auth/cloudflare/start", startOAuth);
app.get("/oauth/cloudflare/callback", finishOAuth);
app.post("/api/v1/session/disconnect", signOut);

app.get("/api/v1/providers/cloudflare/accounts", async c => {
  const client = new CloudflareClient(await userToken(c));
  return c.json({ accounts: await client.accounts() }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/v1/providers/cloudflare/accounts/:accountId/deployment", async c => {
  const accountId = c.req.param("accountId");
  if (!ACCOUNT.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
  const client = new CloudflareClient(await userToken(c));
  return c.json({ deployment: await discoverDeployment(client, accountId) }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/v1/providers/cloudflare/accounts/:accountId/build-readiness", async c => {
  const accountId = c.req.param("accountId");
  if (!ACCOUNT.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
  const client = new CloudflareClient(await userToken(c));
  return c.json({ readiness: await inspectBuildReadiness(client, accountId) }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/v1/providers/cloudflare/accounts/:accountId/plan", async c => {
  const accountId = c.req.param("accountId");
  if (!ACCOUNT.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
  const intent = c.req.query("intent");
  if (intent !== "install" && intent !== "update" && intent !== "repair") {
    throw new DeployError("INVALID_ACCOUNT", "Plan intent must be install, update or repair.");
  }
  const client = new CloudflareClient(await userToken(c));
  const [observed, latest] = await Promise.all([discoverDeployment(client, accountId), resolveLatestMain()]);
  const bindings = observed.kind === "not-installed" ? [] : await client.settings(accountId, observed.workerName);
  const resourcePlan = planResourceReconciliation(observed.kind, bindings);
  return c.json({ plan: deploymentPlan(observed, latest, intent as Intent), resourcePlan, observed, source: latest }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/v1/providers/cloudflare/accounts/:accountId/prepared-run", async c => {
  const accountId = c.req.param("accountId");
  if (!ACCOUNT.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
  const client = new CloudflareClient(await userToken(c));
  await client.requireAccount(accountId);
  return c.json({ run: await readAccountRun(c.env, accountId, sessionIdentity(c)) }, 200, { "Cache-Control": "no-store" });
});

/**
 * Freeze an immutable, blocked operation for the user's current session.
 * This endpoint modifies only our ephemeral RUNS Durable Object.
 * It NEVER invokes Cloudflare build, migration, or deploy APIs.
 */
app.post("/api/v1/providers/cloudflare/accounts/:accountId/prepare", async c => {
  assertSameOrigin(c);
  const accountId = c.req.param("accountId");
  if (!ACCOUNT.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
  const body = await c.req.json().catch(() => null) as { intent?: string; expectedSourceSha?: string } | null;
  if (!body || !["install", "update", "repair"].includes(body.intent ?? "") ||
      typeof body.expectedSourceSha !== "string" || !/^[a-f0-9]{40}$/i.test(body.expectedSourceSha)) {
    throw new DeployError("INVALID_SOURCE", "Intent and the exact source SHA from the reviewed plan are required.");
  }
  const client = new CloudflareClient(await userToken(c));
  const [observed, latest] = await Promise.all([discoverDeployment(client, accountId), resolveLatestMain()]);
  const plan = deploymentPlan(observed, latest, body.intent as Intent);
  // If upstream changed after the user reviewed the plan, force re-review.
  assertReviewedSource(body.expectedSourceSha, plan.sourceSha);
  const bindings = observed.kind === "not-installed" ? [] : await client.settings(accountId, observed.workerName);
  const resources = planResourceReconciliation(observed.kind, bindings);
  // Never prepare executable work unless the entire workflow has passed
  // user-owned build, migration and deployment safety validation.
  const blockers = [...new Set([...plan.blockers, ...resources.blockers,
    "Cloudflare Builds source access, non-promoting uploads, migrations and final activation are not yet approved."])];
  const run = await prepareAccountRun(c.env, {
    accountId, ownerId: sessionIdentity(c), intent: body.intent as Intent,
    pinnedSha: plan.sourceSha, currentSha: observed.deployedSha, blockers
  });
  return c.json({ run, resourcePlan: resources, executionAvailable: false }, 200, { "Cache-Control": "no-store" });
});

app.notFound(c => c.json({ error: { code: "UNAVAILABLE", message: "Endpoint not found." } }, 404));
const server = {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/") || path.startsWith("/oauth/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  }
};
export default server;
