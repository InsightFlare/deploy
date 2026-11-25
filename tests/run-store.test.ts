import { describe, expect, it } from "vitest";
import { DeploymentRun } from "../src/session/runs";
import { createRun, retryRun, type PipelineRun } from "../src/core/pipeline";

function memoryState() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  const storage = {
    get: async (key: string) => structuredClone(data.get(key)),
    put: async (key: string, value: unknown) => { data.set(key, structuredClone(value)); },
    delete: async (key: string | string[]) => { for (const k of Array.isArray(key) ? key : [key]) data.delete(k); return true; },
    deleteAll: async () => { data.clear(); },
    setAlarm: async (at: number) => { alarm = at; },
    transaction: async <T>(fn: (txn: unknown) => Promise<T>): Promise<T> => fn(storage)
  };
  return { state: { storage } as unknown as DurableObjectState, data, alarm: () => alarm };
}

function run(id = "run-1"): PipelineRun {
  return createRun({ id, intent: "install", accountId: "a".repeat(32), sourceSha: "d".repeat(40),
    artifactDigest: "e".repeat(64), legacyAdoptionApproved: false, now: Date.now() });
}

async function post(object: DeploymentRun, path: string, body: unknown) {
  const response = await object.fetch(new Request("https://deployment-run.internal" + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }));
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe("deployment run storage", () => {
  it("hands out one lease at a time and commits only with that lease", async () => {
    const memory = memoryState();
    const object = new DeploymentRun(memory.state);
    expect((await post(object, "/pipeline/create", { run: run(), adminPassword: { iv: "x", cipher: "y", expiresAt: 1 } })).status).toBe(200);

    const first = await post(object, "/pipeline/lease", { runId: "run-1" });
    expect(first.status).toBe(200);
    expect((await post(object, "/pipeline/lease", { runId: "run-1" })).status).toBe(409);
    expect((await post(object, "/pipeline/commit", { leaseId: "wrong", run: run() })).status).toBe(409);

    const advanced = { ...run(), steps: run().steps.map((s, i) => i === 0 ? { ...s, status: "done" as const } : s) };
    const committed = await post(object, "/pipeline/commit", { leaseId: first.body.leaseId, run: advanced });
    expect(committed.status).toBe(200);
    expect((committed.body.run as PipelineRun).steps[0]!.status).toBe("done");
    expect(committed.body.busy).toBe(false);
    expect(memory.alarm()).not.toBeNull();
  });

  it("refuses a second run while one is in progress, and keeps half-done installs", async () => {
    const object = new DeploymentRun(memoryState().state);
    await post(object, "/pipeline/create", { run: run() });
    expect((await post(object, "/pipeline/create", { run: run("run-2") })).status).toBe(409);

    const lease = await post(object, "/pipeline/lease", { runId: "run-1" });
    const halfDone = { ...run(), steps: run().steps.map((s, i) => i === 0 ? { ...s, status: "done" as const } : s) };
    await post(object, "/pipeline/commit", { leaseId: lease.body.leaseId, run: halfDone });
    expect((await post(object, "/pipeline/dismiss", { runId: "run-1" })).status).toBe(409);

    const failedLease = await post(object, "/pipeline/lease", { runId: "run-1" });
    await post(object, "/pipeline/commit", { leaseId: failedLease.body.leaseId, run: { ...halfDone, phase: "failed" } });
    expect((await post(object, "/pipeline/dismiss", { runId: "run-1" })).status).toBe(200);
    expect((await post(object, "/pipeline/create", { run: run("run-2") })).status).toBe(200);
  });

  it("accepts a retry only against the failure that was reviewed", async () => {
    const object = new DeploymentRun(memoryState().state);
    const failed: PipelineRun = { ...run(), phase: "failed" };
    await post(object, "/pipeline/create", { run: failed });
    const retry = { run: retryRun(failed, failed.updatedAt + 1), expectedUpdatedAt: failed.updatedAt };

    expect((await post(object, "/pipeline/replace", { ...retry, expectedUpdatedAt: failed.updatedAt - 1 })).status).toBe(409);
    expect((await post(object, "/pipeline/replace", retry)).status).toBe(200);
    expect((await post(object, "/pipeline/replace", retry)).status).toBe(409);
  });

  it("forgets the administrator password on request", async () => {
    const memory = memoryState();
    const object = new DeploymentRun(memory.state);
    await post(object, "/pipeline/create", { run: run(), adminPassword: { iv: "x", cipher: "y", expiresAt: 1 } });
    const result = await post(object, "/pipeline/forget-password", { runId: "run-1" });
    expect(result.body.adminPassword).toBeNull();
  });
});
