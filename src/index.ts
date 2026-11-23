import { Hono } from "hono";
import type { Env } from "./types";
import { localeFromPath, requestLocale, localeCookie } from "./lib/i18n/page-request";
import { localeToHtmlLang } from "./lib/i18n/config";
import { DeployError } from "./types";
import { resolveLatestMain } from "./core/source";
import { githubFetcher } from "./core/github";
import { CloudflareClient } from "./providers/cloudflare/client";
import { discoverDeployment } from "./providers/cloudflare/discovery";
import { BUILD_ADAPTER_STATUS } from "./providers/cloudflare/builds";
import { BUILD_PROCESS_CONTRACT } from "./core/build-policy";
import { pipelineRoutes } from "./routes/pipeline";
import { oauthConfigured, startOAuth, finishOAuth, connectionStatus, signOut, userToken } from "./security/oauth";

export { DeploySession } from "./session/store";
export { DeploymentRun } from "./session/runs";

const app = new Hono<{ Bindings: Env }>();
const ACCOUNT = /^[a-f0-9]{32}$/i;

app.onError((error, c) => {
  if (error instanceof DeployError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 409 | 502 | 503, { "Cache-Control": "no-store" });
  }
  // Logged for Workers Logs; the client only gets the error class, never upstream bodies or tokens.
  const name = error instanceof Error ? error.name : "Error";
  console.error(JSON.stringify({
    event: "unhandled_error", method: c.req.method, path: new URL(c.req.url).pathname,
    name, message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split(String.fromCharCode(10)).slice(0, 6).join(" | ") : undefined
  }));
  return c.json({ error: { code: "UPSTREAM_UNAVAILABLE", message: `The request could not be completed (${name}). Please retry.` } }, 503, { "Cache-Control": "no-store" });
});

app.get("/api/v1/health", c => c.json({ ok: true, service: "insightflare-deploy", d1MigrationsAvailable: true, existingWorkerUpgradesAvailable: true, newInstallationAvailable: true }));
app.get("/api/v1/config", c => c.json({
  source: c.env.SOURCE_REPOSITORY || "RavelloH/InsightFlare",
  oauthConfigured: oauthConfigured(c.env),
  existingWorkerUpgradesAvailable: true,
  newInstallationAvailable: true,
  d1MigrationsAvailable: true,
  builds: BUILD_ADAPTER_STATUS
}, 200, { "Cache-Control": "no-store" }));

app.get("/api/v1/source/main", async c => c.json(await resolveLatestMain(githubFetcher(c.env.GITHUB_TOKEN)), 200, { "Cache-Control": "public, max-age=45" }));
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

app.route("/api/v1/providers/cloudflare/accounts", pipelineRoutes);

app.notFound(c => c.json({ error: { code: "UNAVAILABLE", message: "Endpoint not found." } }, 404));
const server = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname.startsWith("/api/") || pathname.startsWith("/oauth/")) {
      return app.fetch(request, env, ctx);
    }
    // Same URL-based locale selection and cookie semantics as InsightFlare.
    // API/OAuth routes remain unprefixed and are unaffected.
    if (pathname === "/") {
      const locale = requestLocale(request);
      url.pathname = "/" + locale;
      const headers = new Headers({
        Location: url.toString(),
        "Cache-Control": "private, no-store",
        "Set-Cookie": localeCookie(locale)
      });
      return new Response(null, { status: 307, headers });
    }
    const locale = localeFromPath(pathname);
    if (locale) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, {status:405});
      // Assets binding serves the SPA document for all locale paths. Run-worker-first
      // is explicitly scoped to locale paths in wrangler.jsonc.
      const assetRequest = new Request(new URL("/",request.url),{
        method:request.method,
        headers:request.headers
      });
      const response = await env.ASSETS.fetch(assetRequest);
      const headers = new Headers(response.headers);
      headers.append("Set-Cookie",localeCookie(locale));
      headers.set("Content-Language",localeToHtmlLang(locale));
      headers.set("Cache-Control","no-store");
      // Keep the document language correct before hydration, as in InsightFlare's SSR shell.
      if(request.method === "GET" && response.ok &&
         response.headers.get("content-type")?.includes("text/html")) {
        const html=(await response.text()).replace(/<html lang="en">/i,
          '<html lang="'+localeToHtmlLang(locale)+'">');
        headers.delete("content-length");
        headers.delete("etag");
        return new Response(html,{status:response.status,headers});
      }
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    return env.ASSETS.fetch(request);
  }
};
export default server;
