import { describe, expect, it, vi } from "vitest";
import { DeploymentRun, acquireDatabaseMigrationLease } from "../src/session/runs";

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
    const response = await durable.fetch(new Request("https://deployment-run.internal/d1-lease", {
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
