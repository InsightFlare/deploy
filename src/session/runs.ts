import type { Env } from "../types";
import { acquireD1Lease, renewD1Lease, releaseD1Lease, isD1LeaseCurrent,
  type D1Lease, type D1LeaseRequest, type D1LeaseProof } from "../core/d1-lease";
import type { D1ExclusiveLease } from "../core/d1-migration-runner";
import type { DurableD1JournalGateway } from "../core/d1-journal-runner";
import {
  newD1MigrationJournal, assertCanKeepJournal, armNewInstallJournal,
  beginD1JournalStep, finishD1JournalStep, flagD1JournalUncertain,
  cancelUnstartedD1Journal, inspectUncertainD1Journal, safeD1JournalStatus,
  type D1MigrationJournal, type D1JournalProof, type NewInstallSafety
} from "../core/d1-journal";
import type { ReviewedD1MigrationPlan } from "../core/d1-migrations";
import { ACTIVE_PHASES, MAX_ACTIVE_RUN_MS, createPreparedRun, assertCanReplaceRun, runForOwner, type PreparedRun, type PrepareRunInput } from "../core/run";

const STORE_KEY = "prepared-run";
const LEASE_KEY = "database-migration-lease";
const JOURNAL_KEY = "database-migration-journal";
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const BASE_URL = "https://deployment-run.internal";
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;

export class DeploymentRun {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Internal-only scoped lease: requests come from the Worker using RUNS DO
    // binding, never from a browser or an API route. One DO per account + D1 UUID.
    if (url.pathname === "/d1-journal" && request.method === "POST") {
      const body = await request.json().catch(() => null) as {
        action?: "create" | "read" | "status" | "arm" | "start" | "finish" | "uncertain" | "cancel" | "inspect";
        plan?: ReviewedD1MigrationPlan;
        proof?: D1JournalProof;
        viewer?: { ownerId: string; accountId: string; databaseId: string };
        safety?: NewInstallSafety;
        checkedBookmark?: string;
        attemptId?: string;
        result?: { attemptId: string; appliedNames: string[]; bookmark: string };
        reason?: "request-failed" | "ambiguous-result" | "lease-expired" | "restarted";
        observedLedger?: string[];
        observedBookmark?: string;
      } | null;
      if (!body || !["create", "read", "status", "arm", "start", "finish",
        "uncertain", "cancel", "inspect"].includes(body.action ?? "")) {
        return Response.json({ error: "Invalid journal action" }, { status: 400 });
      }
      try {
        const now = Date.now();
        const result = await this.state.storage.transaction(async txn => {
          const current = await txn.get<D1MigrationJournal>(JOURNAL_KEY) ?? null;
          if (body.action === "status") {
            const viewer = body.viewer;
            if (!current || !viewer ||
                current.ownerId !== viewer.ownerId ||
                current.accountId !== viewer.accountId ||
                current.databaseId !== viewer.databaseId) {
              return { status: null };
            }
            return { status: safeD1JournalStatus(current) };
          }
          if (body.action === "read") {
            if (!current || !body.proof ||
                current.ownerId !== body.proof.ownerId ||
                current.runId !== body.proof.runId ||
                current.sourceSha !== body.proof.sourceSha ||
                current.reviewedPlanDigest !== body.proof.reviewedPlanDigest ||
                current.accountId !== body.proof.accountId ||
                current.databaseId !== body.proof.databaseId) {
              return { journal: null };
            }
            return { journal: current };
          }
          const lease = await txn.get<D1Lease>(LEASE_KEY) ?? null;
          if (body.action === "create") {
            const proposed = newD1MigrationJournal(body.plan!, body.proof!, lease, now);
            const prepared = assertCanKeepJournal(current, proposed);
            if (!current) await txn.put(JOURNAL_KEY, prepared);
            return { journal: prepared };
          }
          if (!current) return { error: "No durable migration journal" };
          if (body.action === "inspect") {
            const p = body.proof;
            if (!p || current.ownerId !== p.ownerId || current.runId !== p.runId ||
                current.sourceSha !== p.sourceSha ||
                current.reviewedPlanDigest !== p.reviewedPlanDigest) {
              return { error: "Wrong journal owner" };
            }
            return { reconciliation: inspectUncertainD1Journal(
              current, body.observedLedger!, body.observedBookmark!) };
          }
          let next: D1MigrationJournal;
          if (body.action === "arm") {
            next = armNewInstallJournal(current, body.proof!, lease, body.safety!, now);
          } else if (body.action === "start") {
            next = beginD1JournalStep(current, body.proof!, lease,
              body.checkedBookmark!, body.attemptId!, now);
          } else if (body.action === "finish") {
            next = finishD1JournalStep(current, body.proof!, lease,
              body.result!, now);
          } else if (body.action === "uncertain") {
            if (!body.proof || current.ownerId !== body.proof.ownerId ||
                current.runId !== body.proof.runId ||
                current.sourceSha !== body.proof.sourceSha ||
                current.reviewedPlanDigest !== body.proof.reviewedPlanDigest ||
                current.inFlight?.attemptId !== body.attemptId) {
              return { error: "Uncertain migration attempt identity mismatch" };
            }
            next = flagD1JournalUncertain(current, body.reason!, now);
          } else if (body.action === "cancel") {
            next = cancelUnstartedD1Journal(current, body.proof!, lease, now);
          } else {
            return { error: "Unsupported journal transition" };
          }
          await txn.put(JOURNAL_KEY, next);
          return { journal: next };
        });
        if ("error" in result) return Response.json(result, { status: 409 });
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      } catch {
        return Response.json({ error: "D1 migration journal transition rejected" },
          { status: 409, headers: { "Cache-Control": "no-store" } });
      }
    }
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
            const journal = await txn.get<D1MigrationJournal>(JOURNAL_KEY);
            if (journal && ["in-flight", "uncertain"].includes(journal.phase)) {
              throw new Error("Unresolved D1 migration step blocks lease acquisition");
            }
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
    const now = Date.now();
    const activeLease = await this.state.storage.get<D1Lease>(LEASE_KEY);
    if (activeLease && activeLease.expiresAt > now) {
      await this.state.storage.setAlarm(activeLease.expiresAt);
      return;
    }
    // Durable migration history must NEVER be wiped by a lease alarm.
    const journal = await this.state.storage.get<D1MigrationJournal>(JOURNAL_KEY);
    if (journal) {
      await this.state.storage.transaction(async txn => {
        const current = await txn.get<D1MigrationJournal>(JOURNAL_KEY);
        if (current?.phase === "in-flight") {
          await txn.put(JOURNAL_KEY,
            flagD1JournalUncertain(current, "lease-expired", now));
        }
        await txn.delete(LEASE_KEY);
      });
      return;
    }
    if (activeLease) {
      await this.state.storage.delete(LEASE_KEY);
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
): Promise<D1ExclusiveLease & { proof: D1JournalProof; renew(): Promise<boolean>; release(): Promise<boolean> }> {
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
    proof: { ...proof, accountId: lease.accountId, databaseId: lease.databaseId },
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

/**
 * Browser-safe, read-only journal status for one authenticated Cloudflare
 * account/database and the caller's currently connected session. It cannot
 * reveal another session's journal, owner ID, SQL or recovery bookmark.
 */
export async function readDatabaseMigrationStatus(
  env: Env, accountId: string, databaseId: string, ownerId: string
): Promise<import("../core/d1-journal").D1JournalStatus | null> {
  if (!ACCOUNT_ID.test(accountId) || !UUID.test(databaseId) ||
      !/^[A-Za-z0-9_-]{24,128}$/.test(ownerId)) {
    throw new Error("Invalid session, Cloudflare account or D1 database identity");
  }
  const response = await databaseStub(env, accountId, databaseId).fetch(
    BASE_URL + "/d1-journal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status",
        viewer: { accountId: accountId.toLowerCase(), databaseId: databaseId.toLowerCase(), ownerId } })
    });
  if (!response.ok) throw new Error("Unable to read D1 migration status");
  const result = await response.json() as { status?: import("../core/d1-journal").D1JournalStatus | null };
  return result.status ?? null;
}

async function callDatabaseJournal(
  env: Env, proof: D1JournalProof,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!proof || !ACCOUNT_ID.test(proof.accountId) ||
      !UUID.test(proof.databaseId)) {
    throw new Error("Invalid database migration journal identity");
  }
  const response = await databaseStub(env, proof.accountId, proof.databaseId).fetch(
    BASE_URL + "/d1-journal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, proof })
    });
  if (!response.ok) throw new Error("Durable D1 journal transition refused");
  return response.json() as Promise<Record<string, unknown>>;
}

/** Private, account- and database-locked preparation; no remote D1 writes. */
export async function createDatabaseMigrationJournal(
  env: Env, proof: D1JournalProof, plan: ReviewedD1MigrationPlan
): Promise<D1MigrationJournal> {
  const response = await callDatabaseJournal(env, proof, { action: "create", plan });
  const journal = response.journal as D1MigrationJournal | undefined;
  if (!journal || journal.sourceSha !== proof.sourceSha ||
      journal.reviewedPlanDigest !== proof.reviewedPlanDigest ||
      journal.accountId !== proof.accountId ||
      journal.databaseId !== proof.databaseId ||
      journal.executionEnabled !== false) {
    throw new Error("Durable D1 review journal does not match approved operation");
  }
  return journal;
}

/**
 * Only a future backend verifier can produce this evidence after confirming
 * a new, empty, unbound D1 database. There is deliberately no public route.
 */
export async function armDatabaseNewInstallJournal(
  env: Env, proof: D1JournalProof, evidence: NewInstallSafety
): Promise<D1MigrationJournal> {
  const response = await callDatabaseJournal(env, proof, {
    action: "arm", safety: evidence
  });
  const journal = response.journal as D1MigrationJournal | undefined;
  if (!journal || journal.phase !== "armed" ||
      journal.sourceSha !== proof.sourceSha ||
      journal.databaseId !== proof.databaseId) {
    throw new Error("D1 installation safety evidence was not accepted");
  }
  return journal;
}

/** Write-ahead state transitions for the private, step-wise executor only. */
export function durableDatabaseJournalGateway(
  env: Env, proof: D1JournalProof
): DurableD1JournalGateway {
  async function transition(action: string, data: Record<string, unknown>) {
    const response = await callDatabaseJournal(env, proof, { action, ...data });
    const journal = response.journal as D1MigrationJournal | undefined;
    if (!journal || journal.sourceSha !== proof.sourceSha ||
        journal.accountId !== proof.accountId ||
        journal.databaseId !== proof.databaseId ||
        journal.runId !== proof.runId ||
        journal.reviewedPlanDigest !== proof.reviewedPlanDigest) {
      throw new Error("D1 journal operation identity changed");
    }
    return journal;
  }
  return {
    reserve(bookmark, attemptId) {
      return transition("start", { checkedBookmark: bookmark, attemptId });
    },
    confirm(attemptId, appliedNames, bookmark) {
      return transition("finish", {
        result: { attemptId, appliedNames, bookmark }
      });
    },
    async uncertain(attemptId, reason) {
      await transition("uncertain", { attemptId, reason });
    }
  };
}
