import { describe, expect, it, vi } from "vitest";
import {
  DeploymentRun, acquireDatabaseMigrationLease, createDatabaseMigrationJournal,
  armDatabaseNewInstallJournal, durableDatabaseJournalGateway
} from "../src/session/runs";
import { executeJournaledD1MigrationStep } from "../src/core/d1-journal-runner";
import type { ReleaseArtifact } from "../src/core/public-release";

const accountId = "a".repeat(32);
const databaseId = "d334bedf-c97d-46ba-af09-58c6579cc2b3";
const ownerId = "c".repeat(32);
const runId = "a5887094-b1da-475f-b3e1-f8817c74b2f3";
const sourceSha = "d".repeat(40);
const reviewedPlanDigest = "e".repeat(64);
const request = () => ({ accountId, databaseId, ownerId, runId, sourceSha, reviewedPlanDigest });

function createDO() {
  const memory = new Map<string, unknown>();
  let currentAlarm: number | null = null;
  const storage = {
    get: vi.fn(async (key: string) => memory.get(key)),
    put: vi.fn(async (key: string, value: unknown) => { memory.set(key, value); }),
    delete: vi.fn(async (key: string) => memory.delete(key)),
    deleteAll: vi.fn(async () => { memory.clear(); }),
    setAlarm: vi.fn(async (value: number) => { currentAlarm = value; }),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(storage))
  };
  const state = { storage } as unknown as DurableObjectState;
  const durable = new DeploymentRun(state);
  async function send(body: object) {
    const action = (body as {action?: string}).action;
    const isJournal = ["create", "read", "arm", "start", "finish",
      "uncertain", "cancel", "inspect", "status"].includes(action ?? "");
    const response = await durable.fetch(new Request(
      "https://deployment-run.internal/" + (isJournal ? "d1-journal" : "d1-lease"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }));
    return { status: response.status, result: await response.json() as Record<string, unknown> };
  }
  return { durable, storage, send, memory, getAlarm: () => currentAlarm };
}

describe("Durable Object scoped migration lease protocol (offline)", () => {
  it("persists the exact lease and rejects a competitor without replacing the active lease", async () => {
    const obj = createDO();
    const first = await obj.send({ action: "acquire", request: request() });
    expect(first.status).toBe(200);
    const held = first.result.lease as Record<string, unknown>;
    expect(held).toMatchObject(request());
    expect(obj.getAlarm()).toBe(held.expiresAt);
    const competitor = await obj.send({ action: "acquire", request: { ...request(), ownerId: "f".repeat(32) } });
    expect(competitor.status).toBe(409);
    expect(obj.memory.get("database-migration-lease")).toEqual(held);
  });

  it("renews and explicitly releases only by the correct proof", async () => {
    const obj = createDO();
    const opened = await obj.send({ action: "acquire", request: request() });
    const held = opened.result.lease as { leaseId: string };
    const proof = { ...request(), leaseId: held.leaseId };
    const current = await obj.send({ action: "assert", proof });
    expect(current.result.current).toBe(true);
    const wrong = await obj.send({ action: "release", proof: { ...proof, ownerId: "f".repeat(32) } });
    expect(wrong.result.released).toBe(false);
    const renewed = await obj.send({ action: "renew", proof });
    expect(renewed.status).toBe(200);
    expect((renewed.result.lease as { leaseId: string }).leaseId).toBe(held.leaseId);
    const released = await obj.send({ action: "release", proof });
    expect(released.result.released).toBe(true);
    expect(obj.memory.has("database-migration-lease")).toBe(false);
    const after = await obj.send({ action: "assert", proof });
    expect(after.result.current).toBe(false);
  });

  it("creates distinct Durable Object instances for different databases with the same account", async () => {
    const first = createDO(), second = createDO();
    const ids: string[] = [];
    const env = {
      RUNS: {
        idFromName: vi.fn((key: string) => { ids.push(key); return key; }),
        get: vi.fn((key: string) => ({
          fetch: (url: string, init?: RequestInit) =>
            (key.endsWith(databaseId) ? first : second).durable.fetch(new Request(url, init))
        }))
      }
    } as unknown as Parameters<typeof acquireDatabaseMigrationLease>[0];
    const one = await acquireDatabaseMigrationLease(env, request());
    expect(await one.assertCurrent()).toBe(true);
    const anotherDb = "0b333ac2-6bc6-4552-86d6-a1c3d46cbab7";
    const two = await acquireDatabaseMigrationLease(env, { ...request(), databaseId: anotherDb });
    expect(await two.assertCurrent()).toBe(true);
    expect(ids).toContain("d1:" + accountId + ":" + databaseId);
    expect(ids).toContain("d1:" + accountId + ":" + anotherDb);
    expect(await one.release()).toBe(true);
    expect(await two.assertCurrent()).toBe(true);
  });

  it("refuses malformed requests and stale lock assertions without touching storage", async () => {
    const obj = createDO();
    expect((await obj.send({ action: "not-an-operation" })).status).toBe(400);
    expect((await obj.send({ action: "acquire", request: { ...request(), databaseId: "../invalid" } })).status).toBe(409);
    expect(obj.memory.size).toBe(0);
    expect((await obj.send({ action: "assert", proof: { leaseId: "bogus" } })).result.current).toBe(false);
  });

  it("cleans an expired durable lease on alarm", async () => {
    const obj = createDO();
    const opened = await obj.send({ action: "acquire", request: request() });
    const lease = opened.result.lease as Record<string, unknown>;
    expect(lease.expiresAt).toBeTypeOf("number");
    const stored = obj.memory.get("database-migration-lease") as { expiresAt: number };
    stored.expiresAt = Date.now() - 1;
    obj.memory.set("database-migration-lease", stored);
    await obj.durable.alarm();
    expect(obj.memory.has("database-migration-lease")).toBe(false);
  });
});

const originalBookmark = "000000a1-00000001-recovery";
const journalPlan = (): import("../src/core/d1-migrations").ReviewedD1MigrationPlan => ({
  accountId, databaseId, sourceSha, artifactDigest: "9".repeat(64),
  reviewedPlanDigest, bookmark: originalBookmark, appliedNames: [],
  initialInstall: true, destructiveUpgrade: false, needsConfirmation: true,
  pending: [
    { name: "0001_initial.sql", sha256: "1".repeat(64), sqlBytes: 100, destructive: false, warnings: [] },
    { name: "0002_extra.sql", sha256: "2".repeat(64), sqlBytes: 100, destructive: false, warnings: [] }
  ]
});

describe("Durable D1 migration journal and write-ahead recovery (offline)", () => {
  it("persists a reviewed operation, prevents unauthorized reads and cannot execute without safety attestation", async () => {
    const state = createDO();
    const opened = await state.send({ action: "acquire", request: request() });
    const lease = opened.result.lease as { leaseId: string };
    const proof = { ...request(), leaseId: lease.leaseId };
    const initial = await state.send({ action: "create", plan: journalPlan(), proof });
    expect(initial.status).toBe(200);
    expect(initial.result.journal).toMatchObject({
      phase: "reviewed", executionEnabled: false, latestBookmark: originalBookmark
    });
    expect((await state.send({ action: "read", proof: { ...proof, ownerId: "f".repeat(32) } }))
      .result.journal).toBeNull();
    expect((await state.send({ action: "start", proof,
      checkedBookmark: originalBookmark, attemptId: crypto.randomUUID() })).status).toBe(409);
    expect((await state.send({ action: "arm", proof,
      safety: { accountId, databaseId, workerAbsent: true, databaseEmpty: true,
        consentConfirmed: false, verifiedAt: Date.now() } })).status).toBe(409);
    const after = await state.send({ action: "read", proof });
    expect(after.result.journal).toMatchObject({ phase: "reviewed", inFlight: null });
  });

  it("commits one journal reservation before D1 access and survives object rehydration", async () => {
    const ctx = createDO();
    const opened = await ctx.send({ action: "acquire", request: request() });
    const lease = opened.result.lease as { leaseId: string };
    const proof = { ...request(), leaseId: lease.leaseId };
    expect((await ctx.send({ action: "create", plan: journalPlan(), proof })).status).toBe(200);
    expect((await ctx.send({ action: "arm", proof, safety: {
      accountId, databaseId, workerAbsent: true, databaseEmpty: true,
      consentConfirmed: true, verifiedAt: Date.now()
    } })).status).toBe(200);
    const attemptId = crypto.randomUUID();
    const started = await ctx.send({
      action: "start", proof, checkedBookmark: originalBookmark, attemptId
    });
    expect(started.status).toBe(200);
    expect(started.result.journal).toMatchObject({
      phase: "in-flight", inFlight: { attemptId, name: "0001_initial.sql" }
    });
    // DO constructor is re-entered with the exact same durable storage.
    const restarted = new DeploymentRun({ storage: ctx.storage } as unknown as DurableObjectState);
    const read = await restarted.fetch(new Request("https://deployment-run.internal/d1-journal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", proof })
    }));
    const previous = await read.json() as { journal: { phase: string; inFlight: unknown } };
    expect(previous.journal.phase).toBe("in-flight");
    expect(previous.journal.inFlight).toBeTruthy();

    // Exact post-migration ledger is required; no optimistic completion.
    expect((await ctx.send({
      action: "finish", proof,
      result: { attemptId, appliedNames: [], bookmark: "after-one" }
    })).status).toBe(409);
    expect((await ctx.send({
      action: "finish", proof,
      result: { attemptId, appliedNames: ["0001_initial.sql"], bookmark: "after-one" }
    })).result.journal).toMatchObject({
      phase: "armed", completedNames: ["0001_initial.sql"],
      recoveryBookmark: originalBookmark, latestBookmark: "after-one"
    });
  });

  it("alarm converts interrupted SQL to uncertain without deleting the journal and blocks lease reentry", async () => {
    const ctx = createDO();
    const opened = await ctx.send({ action: "acquire", request: request() });
    const proof = { ...request(), leaseId: (opened.result.lease as { leaseId: string }).leaseId };
    await ctx.send({ action: "create", plan: journalPlan(), proof });
    await ctx.send({ action: "arm", proof, safety: {
      accountId, databaseId, workerAbsent: true, databaseEmpty: true,
      consentConfirmed: true, verifiedAt: Date.now()
    } });
    const attemptId = crypto.randomUUID();
    await ctx.send({ action: "start", proof, checkedBookmark: originalBookmark, attemptId });
    const held = ctx.memory.get("database-migration-lease") as { expiresAt: number };
    held.expiresAt = Date.now() - 1;
    ctx.memory.set("database-migration-lease", held);
    await ctx.durable.alarm();
    const result = await ctx.send({ action: "read", proof });
    expect(result.result.journal).toMatchObject({
      phase: "uncertain", incident: "lease-expired",
      inFlight: { attemptId, name: "0001_initial.sql" }
    });
    expect(ctx.memory.has("database-migration-lease")).toBe(false);
    expect((await ctx.send({ action: "acquire", request: request() })).status).toBe(409);
    expect((await ctx.send({ action: "acquire", request: {
      ...request(), ownerId: "f".repeat(32), runId: crypto.randomUUID()
    } })).status).toBe(409);
    const review = await ctx.send({ action: "inspect", proof,
      observedLedger: ["0001_initial.sql"], observedBookmark: "after-one" });
    expect(review.result.reconciliation).toMatchObject({ status: "applied" });
    const unchanged = await ctx.send({ action: "read", proof });
    expect(unchanged.result.journal).toMatchObject({ phase: "uncertain" });
  });

  it("an uncertain transport failure is persisted and prevents cancellation", async () => {
    const ctx = createDO();
    const opened = await ctx.send({ action: "acquire", request: request() });
    const proof = { ...request(), leaseId: (opened.result.lease as { leaseId: string }).leaseId };
    await ctx.send({ action: "create", plan: journalPlan(), proof });
    await ctx.send({ action: "arm", proof, safety: {
      accountId, databaseId, workerAbsent: true, databaseEmpty: true,
      consentConfirmed: true, verifiedAt: Date.now()
    } });
    const attemptId = crypto.randomUUID();
    await ctx.send({ action: "start", proof, checkedBookmark: originalBookmark, attemptId });
    expect((await ctx.send({ action: "uncertain", proof,
      reason: "request-failed", attemptId })).result.journal).toMatchObject({
      phase: "uncertain", incident: "request-failed"
    });
    expect((await ctx.send({ action: "cancel", proof })).status).toBe(409);
    expect((await ctx.send({ action: "start", proof,
      checkedBookmark: originalBookmark, attemptId: crypto.randomUUID() })).status).toBe(409);
  });

  it("keeps an existing reviewed journal safe across a lease alarm, never deletes status", async () => {
    const ctx = createDO();
    const opened = await ctx.send({ action: "acquire", request: request() });
    const proof = { ...request(), leaseId: (opened.result.lease as { leaseId: string }).leaseId };
    await ctx.send({ action: "create", plan: journalPlan(), proof });
    const held = ctx.memory.get("database-migration-lease") as { expiresAt: number };
    held.expiresAt = Date.now() - 1;
    ctx.memory.set("database-migration-lease", held);
    await ctx.durable.alarm();
    expect((await ctx.send({ action: "read", proof })).result.journal).toMatchObject({
      phase: "reviewed", executionEnabled: false
    });
    expect(ctx.storage.deleteAll).not.toHaveBeenCalled();
  });
});

describe("read-only account/session scoped journal status", () => {
  it("returns only sanitized status to the session owner, never to another owner", async () => {
    const ctx = createDO();
    const opened = await ctx.send({ action: "acquire", request: request() });
    const proof = { ...request(),
      leaseId: (opened.result.lease as { leaseId: string }).leaseId };
    await ctx.send({ action: "create", plan: journalPlan(), proof });
    const authorized = await ctx.send({ action: "status",
      viewer: { accountId, databaseId, ownerId } });
    expect(authorized.status).toBe(200);
    expect(authorized.result.status).toMatchObject({
      phase: "reviewed", total: 2, executionAvailable: false
    });
    for (const forbidden of [ownerId, "000000a1-00000001-recovery", reviewedPlanDigest]) {
      expect(JSON.stringify(authorized)).not.toContain(forbidden);
    }
    expect((await ctx.send({ action: "status",
      viewer: { accountId, databaseId, ownerId: "f".repeat(32) } })).result.status).toBeNull();
    expect((await ctx.send({ action: "status",
      viewer: { accountId: "0".repeat(32), databaseId, ownerId } })).result.status).toBeNull();
    expect((await ctx.send({ action: "status",
      viewer: { accountId, databaseId: crypto.randomUUID(), ownerId } })).result.status).toBeNull();
  });
});

describe("actual Durable Object journal + private migration coordinator integration (mock D1)", () => {
  it("persists a verified migration step end-to-end without publishing or switching a Worker", async () => {
    const ctx = createDO();
    const keys: string[] = [];
    const env = {
      RUNS: {
        idFromName: (key: string) => { keys.push(key); return key; },
        get: (_id: string) => ({ fetch: (url: string, init?: RequestInit) =>
          ctx.durable.fetch(new Request(url, init)) })
      }
    } as unknown as Parameters<typeof acquireDatabaseMigrationLease>[0];
    const source = "CREATE TABLE integration (id TEXT PRIMARY KEY);";
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(source))),
      byte => byte.toString(16).padStart(2, "0")).join("");
    const name = "0001_initial.sql";
    const plan = {
      ...journalPlan(),
      pending: [{ name, sha256: digest, sqlBytes: source.length,
        destructive: false, warnings: [] }]
    };
    const release: ReleaseArtifact = {
      release: { sha: sourceSha, tag: "nightly",
        artifactDigest: "9".repeat(64),
        archiveAsset: {name:"test.tar.gz",size:1,digest:"sha256:"+"0".repeat(64),
          browser_download_url:"https://github.com/RavelloH/InsightFlare"} },
      migrations: [{name,sha256:digest,sql:source}],
      artifact: {pinnedSha:sourceSha,modules:[],assets:[],
        config:{name:"insightflare",mainModule:"index.js",compatibilityDate:"2026-03-01",
          compatibilityFlags:[],migrations:[],observedBuildVariables:[],cronTriggers:[]},
        summary:{sourceSha,digest:"9".repeat(64),moduleCount:1,moduleBytes:1,
          assetCount:1,assetBytes:1,migrationTags:[]}},
      manifest:{schemaVersion:1,source:{repository:"RavelloH/InsightFlare",sha:sourceSha},
        artifactDigest:"9".repeat(64),config:{mainModule:"index.js",
          compatibilityDate:"2026-03-01",compatibilityFlags:[],doMigrations:[],
          bindings:{},vars:{},crons:[]},
        files:[{path:"migrations/"+name,sha256:digest,size:source.length}],
        totals:{modules:1,assets:1,migrations:1,bytes:source.length}}
    };
    const lease = await acquireDatabaseMigrationLease(env, request());
    expect(await lease.assertCurrent()).toBe(true);
    const created = await createDatabaseMigrationJournal(env, lease.proof, plan);
    expect(created.phase).toBe("reviewed");
    const armed = await armDatabaseNewInstallJournal(env, lease.proof, {
      accountId,databaseId,workerAbsent:true,databaseEmpty:true,
      consentConfirmed:true,verifiedAt:Date.now()
    });
    expect(armed.phase).toBe("armed");
    const state = {
      accountId,databaseId,tableNames: [] as string[],
      appliedNames: null as string[] | null,
      bookmark: plan.bookmark
    };
    const writes: string[] = [];
    const transport = {
      snapshot: vi.fn(async () => ({ ...state,
        tableNames: [...state.tableNames],
        appliedNames: state.appliedNames && [...state.appliedNames] })),
      applyOne: vi.fn(async (_a:string,_b:string,f:{name:string;sql:string},create:boolean) => {
        expect(create).toBe(true);
        expect(f.sql).toBe(source);
        writes.push(f.name);
        state.tableNames = ["integration","d1_migrations"];
        state.appliedNames = [f.name];
        state.bookmark = "bookmark-after-transaction";
      })
    };
    const approval = { accountId,databaseId,sourceSha,reviewedPlanDigest,
      approvalGranted:true,maintenanceWindowConfirmed:false };
    const result = await executeJournaledD1MigrationStep(
      release,armed,approval,lease,transport,durableDatabaseJournalGateway(env,lease.proof));
    expect(result).toMatchObject({ completed:true,canPromote:false,
      completedName:name,confirmedCompleted:1,recoveryBookmark:plan.bookmark });
    expect(writes).toEqual([name]);
    const status = await ctx.send({action:"status", viewer:{accountId,databaseId,ownerId}});
    expect(status.result.status).toMatchObject({phase:"completed",appliedByDeploy:1,remaining:0});
    expect(keys).toEqual(Array(keys.length).fill("d1:"+accountId+":"+databaseId));
    expect(await lease.release()).toBe(true);
  });
});
