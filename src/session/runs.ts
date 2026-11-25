import type { Env } from "../types";
import { DeployError } from "../types";
import type { SealedToken } from "../security/crypto";
import type { PipelineRun } from "../core/pipeline";

const RUN_KEY = "pipeline";
const PASSWORD_KEY = "pipeline-admin-password";
const LEASE_KEY = "pipeline-lease";
const BASE_URL = "https://deployment-run.internal";
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
/** One advance may download the release and upload the Worker; give it room. */
export const LEASE_MS = 150_000;
/** A running run nobody advanced for this long may be replaced by a new one. */
export const STALE_RUN_MS = 2 * 60 * 60_000;
/** Finished runs (and any revealed password) are forgotten after this. */
export const RUN_RETENTION_MS = 24 * 60 * 60_000;

interface Lease { id: string; until: number }

export interface StoredRun {
  run: PipelineRun | null;
  adminPassword: SealedToken | null;
  busy: boolean;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * One deployment run per Cloudflare account. The Worker executes the steps;
 * this object only stores the checkpointed run and hands out a short lease so
 * that two tabs cannot advance the same run at the same time.
 */
export class DeploymentRun {
  constructor(private readonly state: DurableObjectState) {}

  private async read(): Promise<StoredRun> {
    const [run, adminPassword, lease] = await Promise.all([
      this.state.storage.get<PipelineRun>(RUN_KEY),
      this.state.storage.get<SealedToken>(PASSWORD_KEY),
      this.state.storage.get<Lease>(LEASE_KEY)
    ]);
    return { run: run ?? null, adminPassword: adminPassword ?? null, busy: Boolean(lease && lease.until > Date.now()) };
  }

  private async scheduleCleanup(run: PipelineRun): Promise<void> {
    await this.state.storage.setAlarm(run.updatedAt + RUN_RETENTION_MS);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/pipeline") return json(await this.read());
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const body = await request.json().catch(() => ({})) as {
      run?: PipelineRun; runId?: string; leaseId?: string; adminPassword?: SealedToken; expectedUpdatedAt?: number;
    };
    const now = Date.now();

    if (pathname === "/pipeline/create") {
      const next = body.run;
      if (!next) return json({ error: "missing run" }, 400);
      const result = await this.state.storage.transaction(async txn => {
        const current = await txn.get<PipelineRun>(RUN_KEY);
        const lease = await txn.get<Lease>(LEASE_KEY);
        if (lease && lease.until > now) return "busy" as const;
        if (current?.phase === "running" && now - current.updatedAt < STALE_RUN_MS) return "exists" as const;
        await txn.delete([RUN_KEY, PASSWORD_KEY, LEASE_KEY]);
        await txn.put(RUN_KEY, next);
        if (body.adminPassword) await txn.put(PASSWORD_KEY, body.adminPassword);
        return "ok" as const;
      });
      if (result !== "ok") return json({ error: result }, 409);
      await this.scheduleCleanup(next);
      return json(await this.read());
    }

    if (pathname === "/pipeline/lease") {
      const result = await this.state.storage.transaction(async txn => {
        const current = await txn.get<PipelineRun>(RUN_KEY);
        if (!current || current.id !== body.runId) return { error: "missing" as const };
        const lease = await txn.get<Lease>(LEASE_KEY);
        if (lease && lease.until > now) return { error: "busy" as const };
        const next: Lease = { id: crypto.randomUUID(), until: now + LEASE_MS };
        await txn.put(LEASE_KEY, next);
        return { run: current, leaseId: next.id };
      });
      return "error" in result ? json(result, 409) : json(result);
    }

    if (pathname === "/pipeline/commit") {
      const next = body.run;
      if (!next) return json({ error: "missing run" }, 400);
      const ok = await this.state.storage.transaction(async txn => {
        const lease = await txn.get<Lease>(LEASE_KEY);
        const current = await txn.get<PipelineRun>(RUN_KEY);
        if (!lease || lease.id !== body.leaseId || current?.id !== next.id) return false;
        await txn.put(RUN_KEY, next);
        await txn.delete(LEASE_KEY);
        return true;
      });
      if (!ok) return json({ error: "lease" }, 409);
      await this.scheduleCleanup(next);
      return json(await this.read());
    }

    if (pathname === "/pipeline/replace") {
      // Used for retry: only when nobody holds the lease.
      const next = body.run;
      if (!next) return json({ error: "missing run" }, 400);
      const ok = await this.state.storage.transaction(async txn => {
        const lease = await txn.get<Lease>(LEASE_KEY);
        const current = await txn.get<PipelineRun>(RUN_KEY);
        if ((lease && lease.until > now) || current?.id !== next.id ||
            current.phase !== "failed" || current.updatedAt !== body.expectedUpdatedAt) return false;
        await txn.put(RUN_KEY, next);
        return true;
      });
      if (!ok) return json({ error: "busy" }, 409);
      await this.scheduleCleanup(next);
      return json(await this.read());
    }

    if (pathname === "/pipeline/forget-password") {
      const current = await this.state.storage.get<PipelineRun>(RUN_KEY);
      if (current?.id === body.runId) await this.state.storage.delete(PASSWORD_KEY);
      return json(await this.read());
    }

    if (pathname === "/pipeline/dismiss") {
      const ok = await this.state.storage.transaction(async txn => {
        const lease = await txn.get<Lease>(LEASE_KEY);
        const current = await txn.get<PipelineRun>(RUN_KEY);
        if ((lease && lease.until > now) || !current || current.id !== body.runId) return false;
        if (current.phase === "running" && now - current.updatedAt < STALE_RUN_MS &&
            current.steps.some(step => step.status === "done" || step.status === "warning")) {
          // Half-done installs keep their checkpoints until they finish or fail.
          return false;
        }
        await txn.delete([RUN_KEY, PASSWORD_KEY, LEASE_KEY]);
        return true;
      });
      return ok ? json({ run: null, adminPassword: null, busy: false }) : json({ error: "busy" }, 409);
    }

    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    const run = await this.state.storage.get<PipelineRun>(RUN_KEY);
    if (run && Date.now() < run.updatedAt + RUN_RETENTION_MS) {
      await this.state.storage.setAlarm(run.updatedAt + RUN_RETENTION_MS);
      return;
    }
    await this.state.storage.deleteAll();
  }
}

function accountStub(env: Env, accountId: string): DurableObjectStub {
  if (!ACCOUNT_ID.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare account identifier.");
  return env.RUNS.get(env.RUNS.idFromName("cf:" + accountId.toLowerCase()));
}

async function call<T>(env: Env, accountId: string, path: string, body?: unknown): Promise<T> {
  const response = await accountStub(env, accountId).fetch(BASE_URL + path, body === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.status === 409) {
    const { error } = await response.json() as { error?: string };
    if (error === "exists") throw new DeployError("UNAVAILABLE", "Another deployment is already in progress for this account.", 409);
    if (error === "missing") throw new DeployError("SOURCE_MOVED", "This deployment run no longer exists. Refresh the page.", 409);
    throw new DeployError("UNAVAILABLE", "This deployment is being processed in another tab. Wait a moment and refresh.", 409);
  }
  if (!response.ok) throw new DeployError("UPSTREAM_UNAVAILABLE", "Deployment run storage is unavailable.", 503);
  return response.json() as Promise<T>;
}

export const runStore = {
  read: (env: Env, accountId: string) => call<StoredRun>(env, accountId, "/pipeline"),
  create: (env: Env, accountId: string, run: PipelineRun, adminPassword?: SealedToken) =>
    call<StoredRun>(env, accountId, "/pipeline/create", { run, adminPassword }),
  lease: (env: Env, accountId: string, runId: string) =>
    call<{ run: PipelineRun; leaseId: string }>(env, accountId, "/pipeline/lease", { runId }),
  commit: (env: Env, accountId: string, leaseId: string, run: PipelineRun) =>
    call<StoredRun>(env, accountId, "/pipeline/commit", { leaseId, run }),
  replace: (env: Env, accountId: string, run: PipelineRun, expectedUpdatedAt: number) =>
    call<StoredRun>(env, accountId, "/pipeline/replace", { run, expectedUpdatedAt }),
  forgetPassword: (env: Env, accountId: string, runId: string) =>
    call<StoredRun>(env, accountId, "/pipeline/forget-password", { runId }),
  dismiss: (env: Env, accountId: string, runId: string) =>
    call<StoredRun>(env, accountId, "/pipeline/dismiss", { runId })
};
