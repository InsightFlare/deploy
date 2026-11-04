import { describe, it, expect, vi } from "vitest";
import { assertCanReplaceRun, assertReviewedSource, createPreparedRun, runForOwner, RUN_TTL_MS, MAX_ACTIVE_RUN_MS } from "../src/core/run";
import { DeploymentRun } from "../src/session/runs";
import type { PreparedRun } from "../src/core/run";

const accountId = "b".repeat(32);
const ownerId = "a".repeat(32);
const source = "f".repeat(40);
const input = { accountId, ownerId, intent: "update" as const, pinnedSha: source,
  currentSha: "d".repeat(40), blockers: ["Builds not verified"] };

describe("immutable operation preparation", () => {
  it("pins one full commit, expires in 15 minutes, never enables execution", () => {
    const run = createPreparedRun(input, 1000, "test-run");
    expect(run).toMatchObject({ id: "test-run", pinnedSha: source, phase: "blocked", executionEnabled: false });
    expect(run.expiresAt).toBe(1000 + RUN_TTL_MS);
    expect(run.blockers).toEqual(["Builds not verified"]);
    expect(runForOwner(run, ownerId, 1200)?.ownerId).toBe("");
  });
  it("refuses empty blockers and malformed commit", () => {
    expect(() => createPreparedRun({ ...input, blockers: [] })).toThrow("blocked");
    expect(() => createPreparedRun({ ...input, pinnedSha: "main" })).toThrow("40-character");
    expect(() => createPreparedRun({ ...input, accountId: "not-an-account" })).toThrow("account");
  });
  it("forces a re-review if main moves after preview", () => {
    expect(() => assertReviewedSource(source, source)).not.toThrow();
    expect(() => assertReviewedSource(source, "e".repeat(40))).toThrow("source commit changed");
    expect(() => assertReviewedSource("main", source)).toThrow("40-character");
  });
  it("does not reveal another session's run", () => {
    const run = createPreparedRun(input, 2000);
    expect(runForOwner(run, "c".repeat(32), 2010)).toBeNull();
    expect(runForOwner(run, ownerId, run.expiresAt)).toBeNull();
  });
  it("does not invalidate an in-progress run of another user", () => {
    const existing = { ...createPreparedRun(input, 1000), phase: "migrating" as const };
    const next = createPreparedRun({ ...input, ownerId: "c".repeat(32) }, 1010);
    expect(() => assertCanReplaceRun(existing, next, 1011)).toThrow("active");
    expect(() => assertCanReplaceRun({ ...existing, expiresAt: 900 }, next, 1011)).toThrow("active");
    expect(assertCanReplaceRun({ ...existing, expiresAt: 900 }, next, 1000 + MAX_ACTIVE_RUN_MS + 10)).toBe(true);
  });
});

function mockState() {
  const records = new Map<string, PreparedRun>();
  const alarms: number[] = [];
  type Store = {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: PreparedRun): Promise<void>;
    setAlarm(time: number): Promise<void>;
    deleteAll(): Promise<void>;
    transaction<T>(callback: (txn: Store) => Promise<T>): Promise<T>;
  };
  const operations: Store = {
    get: async <T>(key: string) => records.get(key) as T | undefined,
    put: async (key: string, value: PreparedRun) => { records.set(key, value); },
    setAlarm: async (time: number) => { alarms.push(time); },
    deleteAll: async () => { records.clear(); },
    transaction: async <T>(callback: (txn: Store) => Promise<T>) => callback(operations)
  };
  return { state: { storage: operations }, records, alarms };
}
const post = (value: unknown) => new Request("https://deployment-run.internal/prepare",
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });

describe("Cloudflare account-scoped run coordinator", () => {
  it("stores a blocked run and allows only its session to read it", async () => {
    const ctx = mockState();
    const doObject = new DeploymentRun(ctx.state as unknown as DurableObjectState);
    const response = await doObject.fetch(post(input));
    expect(response.status).toBe(200);
    const run = await response.json() as PreparedRun;
    expect(run.ownerId).toBe("");
    expect(run.executionEnabled).toBe(false);
    expect(ctx.alarms).toHaveLength(1);
    const mine = await doObject.fetch(new Request("https://deployment-run.internal/run", { headers: { "X-Run-Owner": ownerId } }));
    const others = await doObject.fetch(new Request("https://deployment-run.internal/run", { headers: { "X-Run-Owner": "z".repeat(32) } }));
    expect((await mine.json() as PreparedRun).id).toBe(run.id);
    expect(await others.json()).toBeNull();
  });
  it("is idempotent for an identical blocked run", async () => {
    const ctx = mockState();
    const doObject = new DeploymentRun(ctx.state as unknown as DurableObjectState);
    const first = await doObject.fetch(post(input)).then(r => r.json() as Promise<PreparedRun>);
    const second = await doObject.fetch(post(input)).then(r => r.json() as Promise<PreparedRun>);
    expect(first.id).toBe(second.id);
  });
  it("preserves an active deployment lock beyond the original 15-minute preparation TTL", async () => {
    const ctx = mockState();
    const old = { ...createPreparedRun(input, Date.now() - 60_000), phase: "building" as const };
    ctx.records.set("prepared-run", old);
    const doObject = new DeploymentRun(ctx.state as unknown as DurableObjectState);
    await doObject.alarm();
    expect(ctx.records.size).toBe(1);
    expect(ctx.alarms.length).toBe(1);
    ctx.records.set("prepared-run", { ...old, createdAt: Date.now() - MAX_ACTIVE_RUN_MS - 1000 });
    await doObject.alarm();
    expect(ctx.records.size).toBe(0);
  });
  it("deletes expired run state when the alarm fires", async () => {
    const ctx = mockState();
    const doObject = new DeploymentRun(ctx.state as unknown as DurableObjectState);
    await doObject.fetch(post(input));
    await doObject.alarm();
    expect(ctx.records.size).toBe(0);
  });
});
