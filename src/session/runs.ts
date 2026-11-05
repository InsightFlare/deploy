import type { Env } from "../types";
import { acquireD1Lease, renewD1Lease, releaseD1Lease, isD1LeaseCurrent,
  type D1Lease, type D1LeaseRequest, type D1LeaseProof } from "../core/d1-lease";
import type { D1ExclusiveLease } from "../core/d1-migration-runner";
import { ACTIVE_PHASES, MAX_ACTIVE_RUN_MS, createPreparedRun, assertCanReplaceRun, runForOwner, type PreparedRun, type PrepareRunInput } from "../core/run";

const STORE_KEY = "prepared-run";
const LEASE_KEY = "database-migration-lease";
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const BASE_URL = "https://deployment-run.internal";
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;

export class DeploymentRun {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Internal-only scoped lease: requests come from the Worker using RUNS DO
    // binding, never from a browser or an API route. One DO per account + D1 UUID.
    if (url.pathname === "/d1-lease" && request.method === "POST") {
      const body = await request.json().catch(() => null) as {
        action?: "acquire" | "renew" | "assert" | "release";
        request?: D1LeaseRequest; proof?: D1LeaseProof;
      } | null;
      if (!body || !["acquire", "renew", "assert", "release"].includes(body.action ?? "")) {
        return Response.json({ error: "Invalid lease action" }, { status: 400 });
      }
      try {
        if (body.action === "assert") {
          const current = await this.state.storage.get<D1Lease>(LEASE_KEY) ?? null;
          return Response.json({ current: isD1LeaseCurrent(current, body.proof!, Date.now()) });
        }
        const now = Date.now();
        const response = await this.state.storage.transaction(async txn => {
          const current = await txn.get<D1Lease>(LEASE_KEY) ?? null;
          if (body.action === "acquire") {
            const next = acquireD1Lease(current, body.request!, now);
            await txn.put(LEASE_KEY, next);
            return { lease: next };
          }
          if (body.action === "renew") {
            const next = renewD1Lease(current, body.proof!, now);
            await txn.put(LEASE_KEY, next);
            return { lease: next };
          }
          if (body.action === "release") {
            if (!releaseD1Lease(current, body.proof!, now)) {
              return { released: false };
            }
            await txn.delete(LEASE_KEY);
            return { released: true };
          }
          throw new Error("Unsupported lease operation");
        });
        if ("lease" in response && response.lease) {
          await this.state.storage.setAlarm(response.lease.expiresAt);
        }
        return Response.json(response);
      } catch {
        return Response.json({ error: "D1 lease rejected" }, { status: 409 });
      }
    }
    if (url.pathname === "/run" && request.method === "GET") {
      const ownerId = request.headers.get("X-Run-Owner") ?? "";
      const current = await this.state.storage.get<PreparedRun>(STORE_KEY) ?? null;
      return Response.json(runForOwner(current, ownerId), { headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/prepare" && request.method === "POST") {
      const input = await request.json() as PrepareRunInput;
      const now = Date.now();
      const prepared = createPreparedRun(input, now);
      // Atomic account-level coordination, ready for future async build stages.
      const stored = await this.state.storage.transaction(async txn => {
        const current = await txn.get<PreparedRun>(STORE_KEY) ?? null;
        assertCanReplaceRun(current, prepared, now);
        if (current?.ownerId === prepared.ownerId &&
            current.pinnedSha === prepared.pinnedSha &&
            current.intent === prepared.intent &&
            current.expiresAt > now && current.phase === "blocked") {
          return current;
        }
        await txn.put(STORE_KEY, prepared);
        return prepared;
      });
      await this.state.storage.setAlarm(stored.expiresAt);
      return Response.json(runForOwner(stored, input.ownerId), { headers: { "Cache-Control": "no-store" } });
    }
    return new Response(null, { status: 405 });
  }

  async alarm() {
    const activeLease = await this.state.storage.get<D1Lease>(LEASE_KEY);
    if (activeLease) {
      if (activeLease.expiresAt > Date.now()) {
        await this.state.storage.setAlarm(activeLease.expiresAt);
      } else {
        await this.state.storage.delete(LEASE_KEY);
      }
      return;
    }
    const current = await this.state.storage.get<PreparedRun>(STORE_KEY);
    if (current && ACTIVE_PHASES.includes(current.phase) && Date.now() < current.createdAt + MAX_ACTIVE_RUN_MS) {
      await this.state.storage.setAlarm(Math.min(Date.now() + 10 * 60_000, current.createdAt + MAX_ACTIVE_RUN_MS));
      return;
    }
    await this.state.storage.deleteAll();
  }
}

function accountStub(env: Env, accountId: string): DurableObjectStub {
  if (!ACCOUNT_ID.test(accountId)) throw new Error("Invalid Cloudflare account identifier");
  return env.RUNS.get(env.RUNS.idFromName("cf:" + accountId.toLowerCase()));
}

export async function prepareAccountRun(env: Env, input: PrepareRunInput): Promise<PreparedRun> {
  const response = await accountStub(env, input.accountId).fetch(BASE_URL + "/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error("Failed to store deployment operation");
  return response.json() as Promise<PreparedRun>;
}

export async function readAccountRun(env: Env, accountId: string, ownerId: string): Promise<PreparedRun | null> {
  const response = await accountStub(env, accountId).fetch(BASE_URL + "/run", {
    method: "GET", headers: { "X-Run-Owner": ownerId }
  });
  if (!response.ok) throw new Error("Failed to read deployment operation");
  return response.json() as Promise<PreparedRun | null>;
}

/**
 * Lease identities are intentionally separate from the account-level
 * prepared-run DO. All runs against a specific account/database share one
 * Durable Object, so an unrelated session cannot acquire a parallel lease.
 */
function databaseStub(env: Env, accountId: string, databaseId: string): DurableObjectStub {
  if (!ACCOUNT_ID.test(accountId) || !UUID.test(databaseId)) {
    throw new Error("Invalid Cloudflare account or database ID");
  }
  return env.RUNS.get(env.RUNS.idFromName(
    "d1:" + accountId.toLowerCase() + ":" + databaseId.toLowerCase()
  ));
}

async function callDatabaseLease(
  env: Env,
  accountId: string,
  databaseId: string,
  body: { action: "acquire" | "renew" | "assert" | "release";
    request?: D1LeaseRequest; proof?: D1LeaseProof }
): Promise<unknown> {
  const response = await databaseStub(env, accountId, databaseId).fetch(BASE_URL + "/d1-lease", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error("Database-scoped migration lease rejected");
  }
  return response.json();
}

/**
 * Private adapter for the internal D1 migration coordinator only. This is
 * not connected to HTTP routes, so no user can request a migration lease
 * or perform a D1 write through the public control plane.
 */
export async function acquireDatabaseMigrationLease(
  env: Env, request: D1LeaseRequest
): Promise<D1ExclusiveLease & { renew(): Promise<boolean>; release(): Promise<boolean> }> {
  const stored = await callDatabaseLease(env, request.accountId, request.databaseId, {
    action: "acquire", request
  }) as { lease?: D1Lease };
  const lease = stored.lease;
  if (!lease || lease.accountId !== request.accountId.toLowerCase() ||
      lease.databaseId !== request.databaseId.toLowerCase() ||
      lease.sourceSha !== request.sourceSha) {
    throw new Error("Durable database lease identity did not match the reviewed operation");
  }
  const proof: D1LeaseProof = {
    leaseId: lease.leaseId,
    ownerId: lease.ownerId,
    runId: lease.runId,
    sourceSha: lease.sourceSha,
    reviewedPlanDigest: lease.reviewedPlanDigest
  };
  const call = (action: "assert" | "renew" | "release") =>
    callDatabaseLease(env, lease.accountId, lease.databaseId, { action, proof });
  return {
    accountId: lease.accountId,
    databaseId: lease.databaseId,
    sourceSha: lease.sourceSha,
    async assertCurrent() {
      const result = await call("assert") as { current?: unknown };
      return result.current === true;
    },
    async renew() {
      const result = await call("renew") as { lease?: D1Lease };
      return result.lease?.leaseId === lease.leaseId;
    },
    async release() {
      const result = await call("release") as { released?: unknown };
      return result.released === true;
    }
  };
}
