import { Hono } from "hono";
import type { Env } from "../types";
import { DeployError } from "../types";
import { CloudflareClient, isHostname } from "../providers/cloudflare/client";
import { discoverDeployment } from "../providers/cloudflare/discovery";
import { resolveLatestMain } from "../core/source";
import { githubFetcher } from "../core/github";
import {
  resolveLatestPublicNightly, resolvePublicDeployRelease, downloadVerifiedPublicRelease, type ReleaseArtifact
} from "../core/public-release";
import { accountOverview } from "../core/overview";
import { advanceRun, createRun, retryRun, type PipelineRun, type PipelineIntent, type CustomDomain } from "../core/pipeline";
import { generatePassword } from "../core/install-plan";
import { runStore, RUN_RETENTION_MS, type StoredRun } from "../session/runs";
import { assertSameOrigin, userToken, grantedScopes, ANALYTICS_READER_SCOPES } from "../security/oauth";
import { sealToken, unsealToken } from "../security/crypto";

const ACCOUNT = /^[a-f0-9]{32}$/;
const NO_STORE = { "Cache-Control": "no-store" };

export const pipelineRoutes = new Hono<{ Bindings: Env }>();

function accountParam(value: string | undefined): string {
  const id = (value ?? "").toLowerCase();
  if (!ACCOUNT.test(id)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
  return id;
}

async function authorizedClient(c: { env: Env } & Parameters<typeof userToken>[0], accountId: string) {
  const client = new CloudflareClient(await userToken(c));
  // Anyone who can reach this account with their own authorization may see
  // and continue its run; nobody else can.
  await client.requireAccount(accountId);
  return client;
}

/** Verified archive for exactly this SHA/digest (fails if nightly has moved on). */
async function loadPinnedRelease(github: typeof fetch, sha: string, artifactDigest: string): Promise<ReleaseArtifact> {
  let pointer;
  try {
    pointer = await resolvePublicDeployRelease(sha, github);
  } catch (error) {
    // Nightly keeps only the newest build: once main moves on, the pinned one is gone for good.
    if (error instanceof DeployError && error.code === "UNAVAILABLE" && error.status === 409) {
      throw new DeployError("SOURCE_MOVED", "A newer official build replaced the reviewed one. Start the deployment again.", 409);
    }
    throw error;
  }
  if (pointer.artifactDigest !== artifactDigest) {
    throw new DeployError("SOURCE_MOVED", "The official build for this commit changed. Start the deployment again.", 409);
  }
  return downloadVerifiedPublicRelease(pointer, github);
}

async function checkHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url + "/healthz", {
      redirect: "manual", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null) as { ok?: unknown; service?: unknown } | null;
    return body?.ok === true && body.service === "insightflare";
  } catch {
    return false;
  }
}

/** Unknown grants (Cloudflare did not report scopes) are attempted; known ones must include both. */
async function readerAuthorized(c: Parameters<typeof grantedScopes>[0]): Promise<boolean> {
  const scopes = await grantedScopes(c);
  return scopes === null || ANALYTICS_READER_SCOPES.every(scope => scopes.includes(scope));
}

/**
 * The hostname is built here from one of the account's own zones plus an
 * optional subdomain, so a request cannot route the Worker anywhere else.
 */
async function resolveCustomDomain(
  client: CloudflareClient, accountId: string, input: { zoneId?: unknown; subdomain?: unknown }
): Promise<CustomDomain> {
  const zone = (await client.zones(accountId)).find(item => item.id === input.zoneId);
  const subdomain = typeof input.subdomain === "string" ? input.subdomain.trim().toLowerCase() : "";
  const hostname = subdomain ? subdomain + "." + zone?.name : zone?.name ?? "";
  if (!zone || !isHostname(hostname)) {
    throw new DeployError("INVALID_SOURCE", "Choose one of the account's domains and a valid subdomain.");
  }
  return { zoneId: zone.id, zoneName: zone.name, hostname };
}

/** 8–128 printable characters, matching InsightFlare's own minimum. */
export function validAdminPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128 && Array.from(value).every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127);
}

/**
 * A generated bootstrap password is shown only once the installation has
 * finished; a password the user chose is never sent back.
 */
async function publicRun(env: Env, stored: StoredRun) {
  let adminPassword: string | null = null;
  const custom = stored.run?.customAdminPassword === true;
  if (stored.run?.intent === "install" && stored.run.phase === "succeeded" && !custom && stored.adminPassword && env.SESSION_ENCRYPTION_KEY) {
    try { adminPassword = await unsealToken(stored.adminPassword, env.SESSION_ENCRYPTION_KEY); }
    catch { adminPassword = null; }
  }
  return {
    run: stored.run,
    busy: stored.busy,
    admin: adminPassword ? { username: "admin", password: adminPassword }
      : custom && stored.run?.phase === "succeeded" ? { username: "admin", password: null } : null
  };
}

pipelineRoutes.get("/:accountId/overview", async c => {
  const accountId = accountParam(c.req.param("accountId"));
  const client = await authorizedClient(c, accountId);
  const [observed, source] = await Promise.all([
    discoverDeployment(client, accountId),
    resolveLatestMain(githubFetcher(c.env.GITHUB_TOKEN)).catch(() => null)
  ]);
  const overview = await accountOverview({
    client, accountId, observed, source,
    loadLatestRelease: async () => {
      const github = githubFetcher(c.env.GITHUB_TOKEN);
      return downloadVerifiedPublicRelease(await resolveLatestPublicNightly(github), github);
    }
  });
  // The Analytics Engine probe is a heuristic; keep its outcome visible in Workers Logs.
  console.log(JSON.stringify({ event: "overview", kind: overview.deployment.kind, analyticsEngine: overview.analyticsEngine ?? null, analyticsReader: overview.analyticsReader ?? null,
    zones: overview.zones?.length ?? null, zonesError: overview.zonesError ?? null, customDomains: overview.customDomains?.length ?? null }));
  return c.json({ overview }, 200, NO_STORE);
});

pipelineRoutes.get("/:accountId/run", async c => {
  const accountId = accountParam(c.req.param("accountId"));
  await authorizedClient(c, accountId);
  return c.json(await publicRun(c.env, await runStore.read(c.env, accountId)), 200, NO_STORE);
});

pipelineRoutes.post("/:accountId/run", async c => {
  assertSameOrigin(c);
  const accountId = accountParam(c.req.param("accountId"));
  const body = await c.req.json().catch(() => null) as {
    intent?: string; sourceSha?: string; artifactDigest?: string; legacyAdoptionApproved?: boolean; adminPassword?: unknown;
    customDomain?: { zoneId?: unknown; subdomain?: unknown } | null;
  } | null;
  if (!body || (body.intent !== "install" && body.intent !== "update")) {
    throw new DeployError("INVALID_SOURCE", "Intent must be install or update.");
  }
  const chosenPassword = body.adminPassword === undefined || body.adminPassword === "" ? null : body.adminPassword;
  if (chosenPassword !== null && !validAdminPassword(chosenPassword)) {
    throw new DeployError("INVALID_SOURCE", "The administrator password must be 8 to 128 printable characters.");
  }
  const client = await authorizedClient(c, accountId);
  const observed = await discoverDeployment(client, accountId);
  const expected: PipelineIntent | null = observed.kind === "not-installed" ? "install"
    : observed.kind === "managed" || observed.kind === "legacy-candidate" ? "update" : null;
  if (expected !== body.intent) {
    throw new DeployError("SOURCE_MOVED", "The account changed since the review. Refresh and review again.", 409);
  }
  // The reviewed commit must still be what the official nightly channel serves.
  const pointer = await resolveLatestPublicNightly(githubFetcher(c.env.GITHUB_TOKEN));
  if (pointer.sha !== body.sourceSha || pointer.artifactDigest !== body.artifactDigest) {
    throw new DeployError("SOURCE_MOVED", "A newer official build was published. Review the plan again.", 409);
  }
  const now = Date.now();
  const run = createRun({
    id: crypto.randomUUID(), intent: body.intent, accountId,
    sourceSha: pointer.sha, artifactDigest: pointer.artifactDigest,
    legacyAdoptionApproved: body.legacyAdoptionApproved === true, now,
    customAdminPassword: chosenPassword !== null,
    analyticsReaderAuthorized: await readerAuthorized(c),
    customDomain: body.customDomain ? await resolveCustomDomain(client, accountId, body.customDomain) : undefined
  });
  let sealed;
  if (run.intent === "install") {
    if (!c.env.SESSION_ENCRYPTION_KEY) throw new DeployError("MISCONFIGURED", "Session encryption is not configured.", 503);
    sealed = await sealToken(chosenPassword ?? generatePassword(), c.env.SESSION_ENCRYPTION_KEY, now + RUN_RETENTION_MS);
  }
  return c.json(await publicRun(c.env, await runStore.create(c.env, accountId, run, sealed)), 200, NO_STORE);
});

/** Executes the next step of the run once; the browser calls it until the run settles. */
pipelineRoutes.post("/:accountId/run/advance", async c => {
  assertSameOrigin(c);
  const accountId = accountParam(c.req.param("accountId"));
  const { runId } = await c.req.json().catch(() => ({})) as { runId?: string };
  if (typeof runId !== "string") throw new DeployError("INVALID_SOURCE", "runId is required.");
  const client = await authorizedClient(c, accountId);
  const { run, leaseId } = await runStore.lease(c.env, accountId, runId);
  let next: PipelineRun;
  try {
    next = await advanceRun(run, {
      client,
      loadRelease: (sha, digest) => loadPinnedRelease(githubFetcher(c.env.GITHUB_TOKEN), sha, digest),
      adminPassword: async () => {
        const stored = await runStore.read(c.env, accountId);
        if (!stored.adminPassword || !c.env.SESSION_ENCRYPTION_KEY) {
          throw new DeployError("UNAVAILABLE", "The generated administrator password is no longer available. Start again.", 409);
        }
        return unsealToken(stored.adminPassword, c.env.SESSION_ENCRYPTION_KEY);
      },
      checkHealth,
      now: () => Date.now()
    });
  } catch (error) {
    // advanceRun records step failures itself; this is a defect or storage failure.
    await runStore.commit(c.env, accountId, leaseId, run);
    throw error;
  }
  let stored = await runStore.commit(c.env, accountId, leaseId, next);
  // A password the user chose is never shown again, so there is no reason to keep it.
  if (next.phase === "succeeded" && next.customAdminPassword && stored.adminPassword) {
    stored = await runStore.forgetPassword(c.env, accountId, next.id);
  }
  return c.json(await publicRun(c.env, stored), 200, NO_STORE);
});

pipelineRoutes.post("/:accountId/run/retry", async c => {
  assertSameOrigin(c);
  const accountId = accountParam(c.req.param("accountId"));
  const { runId } = await c.req.json().catch(() => ({})) as { runId?: string };
  await authorizedClient(c, accountId);
  const stored = await runStore.read(c.env, accountId);
  if (!stored.run || stored.run.id !== runId) throw new DeployError("SOURCE_MOVED", "This deployment run no longer exists.", 409);
  return c.json(await publicRun(c.env, await runStore.replace(c.env, accountId, retryRun(stored.run, Date.now()))), 200, NO_STORE);
});

pipelineRoutes.post("/:accountId/run/dismiss", async c => {
  assertSameOrigin(c);
  const accountId = accountParam(c.req.param("accountId"));
  const { runId } = await c.req.json().catch(() => ({})) as { runId?: string };
  if (typeof runId !== "string") throw new DeployError("INVALID_SOURCE", "runId is required.");
  await authorizedClient(c, accountId);
  return c.json(await publicRun(c.env, await runStore.dismiss(c.env, accountId, runId)), 200, NO_STORE);
});

/** The user confirmed they stored the administrator password; forget it now. */
pipelineRoutes.post("/:accountId/run/password-saved", async c => {
  assertSameOrigin(c);
  const accountId = accountParam(c.req.param("accountId"));
  const { runId } = await c.req.json().catch(() => ({})) as { runId?: string };
  if (typeof runId !== "string") throw new DeployError("INVALID_SOURCE", "runId is required.");
  await authorizedClient(c, accountId);
  return c.json(await publicRun(c.env, await runStore.forgetPassword(c.env, accountId, runId)), 200, NO_STORE);
});
