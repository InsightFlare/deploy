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
import { oauthConfigured, startOAuth, finishOAuth, connectionStatus, signOut, userToken } from "./security/oauth";

export { DeploySession } from "./session/store";

const app = new Hono<{ Bindings: Env }>();
const ACCOUNT = /^[a-f0-9]{32}$/i;

app.onError((error, c) => {
  if (error instanceof DeployError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 502 | 503, { "Cache-Control": "no-store" });
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

app.notFound(c => c.json({ error: { code: "UNAVAILABLE", message: "Endpoint not found." } }, 404));
const server = {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/") || path.startsWith("/oauth/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  }
};
export default server;
