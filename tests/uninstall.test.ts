import { describe, expect, it, vi } from "vitest";
import { previewUninstall, executeUninstallStep, type UninstallClient } from "../src/core/uninstall";
import { createRun, createUninstallRun } from "../src/core/pipeline";
import type { WorkerBinding } from "../src/providers/cloudflare/client";

const account = "a".repeat(32);
const workerId = "b".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const namespaceId = "c".repeat(32);
const sha = "d".repeat(40);

function harness(options: { shared?: boolean; installed?: boolean; legacy?: boolean } = {}) {
  let worker = options.installed !== false, db = true, kv = true, shared = Boolean(options.shared);
  let currentId = workerId;
  const target: WorkerBinding[] = [
    { name: "DB", type: "d1", database_id: databaseId },
    { name: "SITE_SETTINGS_KV", type: "kv_namespace", namespace_id: namespaceId },
    { name: "INGEST_DO", type: "durable_object_namespace", class_name: "IngestDurableObject" },
    ...(options.legacy ? [] : [{ name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: sha }])
  ];
  const client = {
    requireAccount: vi.fn(async () => ({ id: account, name: "Test" })),
    workerNames: vi.fn(async () => [...(worker ? ["insightflare"] : []), "other"]),
    workerExists: vi.fn(async () => worker),
    workerInfo: vi.fn(async () => ({ id: currentId, name: "insightflare" })),
    settings: vi.fn(async (_account: string, name: string) => name === "insightflare" ? target : shared ? [{ name: "DATA", type: "d1", database_id: databaseId }] : []),
    d1Databases: vi.fn(async () => [...(db ? [{ uuid: databaseId, name: "insightflare" }] : []), { uuid: "11111111-2222-4333-8444-555555555555", name: "other" }]),
    kvNamespaces: vi.fn(async () => [...(kv ? [{ id: namespaceId, title: "insightflare-site-settings" }] : []), { id: "e".repeat(32), title: "other" }]),
    uninstallDomains: vi.fn(async () => worker ? [{ hostname: "analytics.example.com", id: "domain-id" }] : []),
    detachUninstallDomain: vi.fn(async () => {}),
    deleteInsightFlareWorker: vi.fn(async (_account: string, id: string) => { expect(id).toBe(currentId); worker = false; }),
    deleteD1Database: vi.fn(async (_account: string, id: string) => { expect(id).toBe(databaseId); db = false; }),
    deleteKvNamespace: vi.fn(async (_account: string, id: string) => { expect(id).toBe(namespaceId); kv = false; })
  } satisfies UninstallClient;
  return { client, setShared: (value: boolean) => { shared = value; }, replaceWorker: () => { currentId = "f".repeat(32); }, recreateWorker: () => { worker = true; } };
}

describe("reviewed uninstall (mock Cloudflare only)", () => {
  it("uses exact binding identities and permits retries without duplicate deletion", async () => {
    const h = harness();
    const plan = await previewUninstall(h.client, account);
    expect(plan).toMatchObject({ accountId: account, workerId, deployedSha: sha, database: { id: databaseId }, kv: { id: namespaceId }, domains: ["analytics.example.com"] });
    const run = createUninstallRun("run", plan, 1);
    expect(run.intent).toBe("uninstall");
    for (const step of run.steps) {
      await executeUninstallStep(h.client, plan, step.id);
      await executeUninstallStep(h.client, plan, step.id);
    }
    expect(h.client.deleteInsightFlareWorker).toHaveBeenCalledExactlyOnceWith(account, workerId);
    expect(h.client.deleteD1Database).toHaveBeenCalledExactlyOnceWith(account, databaseId);
    expect(h.client.deleteKvNamespace).toHaveBeenCalledExactlyOnceWith(account, namespaceId);
  });

  it("blocks shared data, legacy or unrecognized installations", async () => {
    const shared = harness({ shared: true });
    await expect(previewUninstall(shared.client, account)).rejects.toThrow("another Worker");
    const legacy = harness({ legacy: true });
    await expect(previewUninstall(legacy.client, account)).rejects.toThrow("verified managed");
    expect(shared.client.deleteInsightFlareWorker).not.toHaveBeenCalled();
  });

  it("refuses a changed Worker identity after review", async () => {
    const h = harness();
    const plan = await previewUninstall(h.client, account);
    h.replaceWorker();
    await expect(executeUninstallStep(h.client, plan, "removeWorker")).rejects.toThrow("changed");
    expect(h.client.deleteInsightFlareWorker).not.toHaveBeenCalled();
  });

  it("checks dependencies again before each storage deletion and permits resuming", async () => {
    const h = harness();
    const plan = await previewUninstall(h.client, account);
    await executeUninstallStep(h.client, plan, "removeWorker");
    h.setShared(true);
    await expect(executeUninstallStep(h.client, plan, "removeDatabase")).rejects.toThrow("another Worker");
    expect(h.client.deleteD1Database).not.toHaveBeenCalled();
    h.setShared(false);
    await executeUninstallStep(h.client, plan, "removeDatabase");
    h.recreateWorker();
    await expect(executeUninstallStep(h.client, plan, "removeKv")).rejects.toThrow("exists again");
    expect(h.client.deleteKvNamespace).not.toHaveBeenCalled();
  });

  it("only cleans resources recorded as created by a failed install", async () => {
    const h = harness({ installed: false });
    const run = createRun({ id: "failed", intent: "install", accountId: account, sourceSha: sha,
      artifactDigest: "a".repeat(64), legacyAdoptionApproved: false, now: 1 });
    run.phase = "failed";
    run.state.databaseId = databaseId;
    run.state.kvNamespaceId = namespaceId;
    run.steps = run.steps.map(step => step.id === "database" ? { ...step, status: "done", note: { code: "CREATED" } } :
      step.id === "kv" ? { ...step, status: "done", note: { code: "REUSED" } } : step);
    const plan = await previewUninstall(h.client, account, run);
    expect(plan).toMatchObject({ workerId: null, database: { id: databaseId }, kv: null, cleanupRunId: "failed" });
    for (const step of createUninstallRun("cleanup", plan, 2).steps) await executeUninstallStep(h.client, plan, step.id);
    expect(h.client.deleteD1Database).toHaveBeenCalledOnce();
    expect(h.client.deleteKvNamespace).not.toHaveBeenCalled();
    expect(h.client.deleteInsightFlareWorker).not.toHaveBeenCalled();
  });

  it("never guesses orphan resources from matching names", async () => {
    const h = harness({ installed: false });
    await expect(previewUninstall(h.client, account)).rejects.toThrow("No managed");
    expect(h.client.deleteD1Database).not.toHaveBeenCalled();
  });
});
