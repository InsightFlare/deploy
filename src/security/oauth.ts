import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../types";
import { DeployError } from "../types";
import { pkceChallenge, randomBase64Url, sealToken, unsealToken } from "./crypto";
import { clearSession, readSession, saveSession } from "../session/store";

type AppContext = Context<{ Bindings: Env }>;
const SESSION_COOKIE_PROD = "__Host-ifd_session";
const SESSION_COOKIE_DEV = "ifd_session";
const AUTH = "https://dash.cloudflare.com/oauth2/auth";
const TOKEN = "https://dash.cloudflare.com/oauth2/token";
const MAX_SESSION_MS = 60 * 60_000;
const OAUTH_TIMEOUT_MS = 10 * 60_000;
const SID = /^[A-Za-z0-9_-]{24,128}$/;

function origin(c: AppContext): string {
  const value = c.env.APP_ORIGIN;
  if (!value) throw new DeployError("MISCONFIGURED", "APP_ORIGIN is not configured.", 503);
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) {
    throw new DeployError("MISCONFIGURED", "APP_ORIGIN must be a secure public URL.", 503);
  }
  return parsed.origin;
}

function cookieName(c: AppContext): string {
  return origin(c).startsWith("https:") ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}
function cookie(c: AppContext): string | null {
  const value = getCookie(c, cookieName(c));
  return value && SID.test(value) ? value : null;
}
function cookieOptions(c: AppContext) {
  return { httpOnly: true as const, secure: origin(c).startsWith("https:"), sameSite: "Lax" as const, path: "/", maxAge: 3600 };
}
function callbackUri(c: AppContext): string {
  return origin(c) + "/oauth/cloudflare/callback";
}

export function sessionIdentity(c: AppContext): string {
  const id = cookie(c);
  if (!id) throw new DeployError("NOT_CONNECTED", "Connect your Cloudflare account first.", 401);
  return id;
}

export function assertSameOrigin(c: AppContext): void {
  if (c.req.header("Origin") !== origin(c)) {
    throw new DeployError("NOT_CONNECTED", "Origin validation failed.", 403);
  }
}

/** Explicit OAuth consent; D1 writes are never requested by default. */
export function requestedOAuthScopes(base: string, capability?: string): string {
  if (capability && capability !== "d1-read" && capability !== "d1-write") {
    throw new DeployError("INVALID_SOURCE", "Unsupported Cloudflare OAuth capability request.");
  }
  const scopes = new Set(base.split(/\s+/).filter(Boolean));
  if (capability === "d1-read" || capability === "d1-write") scopes.add("d1.read");
  if (capability === "d1-write") scopes.add("d1.write");
  return [...scopes].join(" ");
}

export function oauthConfigured(env: Env): boolean {
  return Boolean(env.CF_OAUTH_CLIENT_ID && env.CF_OAUTH_CLIENT_SECRET && env.SESSION_ENCRYPTION_KEY);
}

export async function startOAuth(c: AppContext): Promise<Response> {
  if (!oauthConfigured(c.env)) throw new DeployError("MISCONFIGURED", "Cloudflare OAuth has not been configured.", 503);
  const id = randomBase64Url();
  const state = randomBase64Url(24);
  const verifier = randomBase64Url(48);
  const now = Date.now();
  await saveSession(c.env, id, { createdAt: now, expiresAt: now + OAUTH_TIMEOUT_MS, oauth: { state, verifier, startedAt: now } });
  const url = new URL(AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", c.env.CF_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", callbackUri(c));
  // Least privilege by default. The user explicitly chooses D1 Read or
  // D1 Write; the OAuth application must allow the chosen scopes.
  url.searchParams.set("scope",
    requestedOAuthScopes(c.env.CF_OAUTH_SCOPES, c.req.query("capability")));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  setCookie(c, cookieName(c), id, cookieOptions(c));
  return c.redirect(url.toString(), 302);
}

export async function finishOAuth(c: AppContext): Promise<Response> {
  const id = cookie(c);
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const nonce = url.searchParams.get("state");
  if (!id) return c.redirect("/?error=session_expired", 302);
  const session = await readSession(c.env, id);
  if (!session?.oauth || !nonce || nonce !== session.oauth.state || !code ||
    Date.now() - session.oauth.startedAt > OAUTH_TIMEOUT_MS) {
    await clearSession(c.env, id);
    deleteCookie(c, cookieName(c), { path: "/" });
    return c.redirect("/?error=oauth_invalid", 302);
  }
  if (!oauthConfigured(c.env)) throw new DeployError("MISCONFIGURED", "Cloudflare OAuth has not been configured.", 503);
  const result = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: callbackUri(c),
      client_id: c.env.CF_OAUTH_CLIENT_ID!, client_secret: c.env.CF_OAUTH_CLIENT_SECRET!,
      code_verifier: session.oauth.verifier
    }),
    signal: AbortSignal.timeout(12000)
  });
  const data = await result.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!result.ok || !data?.access_token) {
    await clearSession(c.env, id);
    return c.redirect("/?error=oauth_exchange", 302);
  }
  const lifetime = Math.min(Math.max(Number(data.expires_in ?? 3600), 60), 3600) * 1000;
  const expiresAt = Math.min(Date.now() + lifetime, Date.now() + MAX_SESSION_MS);
  const bearer = await sealToken(data.access_token, c.env.SESSION_ENCRYPTION_KEY!, expiresAt);
  await saveSession(c.env, id, { createdAt: session.createdAt, expiresAt, bearer });
  return c.redirect("/?connected=1", 302);
}

export async function userToken(c: AppContext): Promise<string> {
  const id = cookie(c);
  if (!id) throw new DeployError("NOT_CONNECTED", "Connect your Cloudflare account first.", 401);
  const session = await readSession(c.env, id);
  if (!session?.bearer || !c.env.SESSION_ENCRYPTION_KEY) throw new DeployError("NOT_CONNECTED", "Cloudflare authorization has expired.", 401);
  return unsealToken(session.bearer, c.env.SESSION_ENCRYPTION_KEY);
}

export async function connectionStatus(c: AppContext): Promise<Response> {
  const id = cookie(c);
  const session = id ? await readSession(c.env, id) : null;
  return c.json({
    connected: Boolean(session?.bearer && session.bearer.expiresAt > Date.now()),
    expiresAt: session?.bearer?.expiresAt ?? null,
    oauthConfigured: oauthConfigured(c.env)
  }, 200, { "Cache-Control": "no-store" });
}

export async function signOut(c: AppContext): Promise<Response> {
  assertSameOrigin(c);
  const id = cookie(c);
  if (id) await clearSession(c.env, id);
  deleteCookie(c, cookieName(c), { path: "/" });
  return c.json({ ok: true }, 200, { "Cache-Control": "no-store" });
}
