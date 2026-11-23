import { describe, expect, it, vi } from "vitest";
import { DeployError, CF_ANALYTICS_ENGINE_NOT_ENABLED } from "../src/types";
import { hashArtifactContents } from "../src/core/stage-artifact";
import { advanceRun, createRun, retryRun, HEALTH_ATTEMPTS, type PipelineClient, type PipelineRun } from "../src/core/pipeline";
import { planFreshInstall, generatePassword } from "../src/core/install-plan";
import type { ReleaseArtifact } from "../src/core/public-release";
import type { WorkerBinding } from "../src/providers/cloudflare/client";

const accountId = "a".repeat(32);
const sourceSha = "d".repeat(40);
const encoder = new TextEncoder();

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function release(migrationCount = 5): Promise<ReleaseArtifact> {
  const module = encoder.encode("export default {}");
  const asset = encoder.encode("<html></html>");
  const pack = {
    pinnedSha: sourceSha,
    config: {
      name: "insightflare", mainModule: "index.js", compatibilityDate: "2026-03-01",
      compatibilityFlags: ["nodejs_compat"], observedBuildVariables: [], cronTriggers: ["*/30 * * * *"],
      migrations: [{ tag: "v1", new_sqlite_classes: ["IngestDurableObject"] }]
    },
    modules: [{ name: "index.js", contentType: "application/javascript+module", content: module }],
    assets: [{ path: "index.html", contentType: "text/html", content: asset }],
    summary: { sourceSha, digest: "", moduleCount: 1, moduleBytes: module.length, assetCount: 1, assetBytes: asset.length, migrationTags: ["v1"] }
  };
  pack.summary.digest = await hashArtifactContents(pack);
  const migrations = await Promise.all(Array.from({ length: migrationCount }, async (_, i) => {
    const sql = `CREATE TABLE t${i} (id TEXT);`;
    return { name: `000${i + 1}_t${i}.sql`, sql, sha256: await sha256(sql) };
  }));
  return {
    release: { sha: sourceSha, tag: "nightly", artifactDigest: pack.summary.digest,
      archiveAsset: { name: "x.tar.gz", size: 1, digest: "sha256:" + "b".repeat(64), browser_download_url: "https://github.com/RavelloH/InsightFlare" } },
    artifact: pack, migrations,
    manifest: {
      schemaVersion: 1, source: { repository: "RavelloH/InsightFlare", sha: sourceSha }, artifactDigest: pack.summary.digest,
      config: {
        mainModule: "index.js", compatibilityDate: "2026-03-01", compatibilityFlags: ["nodejs_compat"],
        doMigrations: [{ tag: "v1", new_sqlite_classes: ["IngestDurableObject"] }],
        bindings: {
          durableObjects: [{ name: "INGEST_DO", className: "IngestDurableObject" }], d1: ["DB"], kv: ["SITE_SETTINGS_KV"],
          analyticsEngine: [{ binding: "REQUEST_ANALYTICS", dataset: "insightflare_request_events" }]
        },
        vars: { SESSION_WINDOW_MINUTES: "30" }, crons: ["*/30 * * * *"]
      },
      totals: { modules: 1, assets: 1, migrations: migrations.length, bytes: 0 },
      files: migrations.map(m => ({ path: "migrations/" + m.name, sha256: m.sha256, size: encoder.encode(m.sql).length }))
    }
  };
}

/** In-memory Cloudflare account for the install path. */
function fakeAccount(options: { analyticsEngineEnabled?: boolean; subdomain?: string | null; tokenPermission?: boolean; existingDb?: "empty" | "data" | "abandoned" } = {}) {
  const databases: Array<{ uuid: string; name: string; applied: string[] | null; extraTables: string[]; hasUsers?: boolean }> = [];
  if (options.existingDb) {
    databases.push({ uuid: "11111111-2222-4333-8444-555555555555", name: "insightflare",
      applied: options.existingDb === "empty" ? null : ["0001_t0.sql"],
      extraTables: options.existingDb === "empty" ? [] : ["users"], hasUsers: options.existingDb === "data" });
  }
  const namespaces: Array<{ id: string; title: string }> = [];
  const workers = new Map<string, WorkerBinding[]>();
  const secrets = new Map<string, string>();
  const calls: string[] = [];
  let uploadFailures = 0;
  const client = {
    requireAccount: vi.fn(async () => ({ id: accountId, name: "Test" })),
    workerNames: vi.fn(async () => [...workers.keys()]),
    settings: vi.fn(async (_a: string, name: string) => workers.get(name) ?? []),
    d1Databases: vi.fn(async () => databases.map(({ uuid, name }) => ({ uuid, name }))),
    d1MigrationSnapshot: vi.fn(async (_a: string, id: string) => {
      const db = databases.find(item => item.uuid === id)!;
      return { accountId, databaseId: id, bookmark: "",
        tableNames: [...(db.applied ? ["d1_migrations"] : []), ...db.extraTables], appliedNames: db.applied ? [...db.applied] : null };
    }),
    d1TableHasRows: vi.fn(async (_a: string, id: string) => Boolean(databases.find(item => item.uuid === id)?.hasUsers)),
    d1ApplyVerifiedMigration: vi.fn(async (_a: string, id: string, migration: { name: string }) => {
      const db = databases.find(item => item.uuid === id)!;
      db.applied = [...(db.applied ?? []), migration.name];
      calls.push("migrate:" + migration.name);
    }),
    createD1Database: vi.fn(async (_a: string, name: string) => {
      const uuid = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
      databases.push({ uuid, name, applied: null, extraTables: [] });
      calls.push("createD1");
      return { uuid, name };
    }),
    kvNamespaces: vi.fn(async () => [...namespaces]),
    createKvNamespace: vi.fn(async (_a: string, title: string) => {
      const ns = { id: "c".repeat(32), title };
      namespaces.push(ns);
      calls.push("createKv");
      return ns;
    }),
    uploadWorkerAssets: vi.fn(async () => "jwt"),
    uploadNewWorkerScript: vi.fn(async (_a: string, name: string, input: { bindings: Array<Record<string, unknown>> }) => {
      if (uploadFailures-- > 0) throw new DeployError("UPSTREAM_UNAVAILABLE", "transient", 502);
      if (!options.analyticsEngineEnabled && input.bindings.some(b => b.type === "analytics_engine")) {
        throw new DeployError("UPSTREAM_UNAVAILABLE", "ae", 403, CF_ANALYTICS_ENGINE_NOT_ENABLED);
      }
      workers.set(name, input.bindings.map(b => ({
        name: String(b.name), type: String(b.type),
        ...(b.type === "d1" ? { database_id: String(b.id) } : {}),
        ...(b.type === "kv_namespace" ? { namespace_id: String(b.namespace_id) } : {}),
        ...(b.class_name ? { class_name: String(b.class_name) } : {}),
        ...(b.type === "plain_text" ? { text: String(b.text) } : {})
      })));
      calls.push("upload:" + input.bindings.filter(b => b.type === "analytics_engine").length);
      return { id: name };
    }),
    putWorkerSchedules: vi.fn(async (_a: string, _n: string, crons: string[]) => { calls.push("crons:" + crons.join(",")); }),
    workersSubdomain: vi.fn(async () => options.subdomain === undefined ? "acme" : options.subdomain),
    enableWorkerSubdomain: vi.fn(async () => { calls.push("workers.dev"); }),
    putWorkerSecret: vi.fn(async (_a: string, _n: string, name: string, text: string) => { secrets.set(name, text); }),
    accountTokenPermissionGroups: vi.fn(async () => options.tokenPermission === false ? [] : [{ id: "e".repeat(32), name: "Account Analytics Read" }]),
    createAccountToken: vi.fn(async () => ({ id: "token-1", value: "ae-token" })),
    workerInfo: vi.fn(), workerDeployments: vi.fn(), workerVersionDetails: vi.fn(), workerVersions: vi.fn(),
    uploadWorkerVersion: vi.fn(), createWorkerDeployment: vi.fn()
  };
  return {
    client: client as unknown as PipelineClient & typeof client, calls, secrets, workers,
    failNextUploads(n: number) { uploadFailures = n; }
  };
}

async function runToEnd(run: PipelineRun, deps: Parameters<typeof advanceRun>[1], limit = 40): Promise<PipelineRun> {
  let current = run;
  for (let i = 0; i < limit && current.phase === "running"; i++) current = await advanceRun(current, deps);
  return current;
}

function deps(client: PipelineClient, artifact: ReleaseArtifact, healthy = true) {
  return {
    client,
    loadRelease: vi.fn(async () => artifact),
    adminPassword: async () => "Admin-Password-123",
    checkHealth: vi.fn(async () => healthy),
    now: () => 1_000
  };
}

function installRun(artifact: ReleaseArtifact) {
  return createRun({ id: "run-1", intent: "install", accountId, sourceSha, artifactDigest: artifact.manifest.artifactDigest, legacyAdoptionApproved: false, now: 0 });
}

describe("one-click installation", () => {
  it("provisions every resource, migrates in batches and finishes healthy", async () => {
    const artifact = await release(5);
    const account = fakeAccount({ analyticsEngineEnabled: true });
    const done = await runToEnd(installRun(artifact), deps(account.client, artifact));

    expect(done.phase).toBe("succeeded");
    expect(done.steps.map(step => [step.id, step.status])).toEqual([
      ["verify", "done"], ["database", "done"], ["kv", "done"], ["migrate", "done"], ["worker", "done"],
      ["schedules", "done"], ["subdomain", "done"], ["analytics", "done"], ["health", "done"]
    ]);
    expect(account.calls.filter(call => call.startsWith("migrate:"))).toHaveLength(5);
    expect(done.state).toMatchObject({ analyticsEngine: "enabled", workerUrl: "https://insightflare.acme.workers.dev", migrationsApplied: 5, migrationsTotal: 5 });
    expect(account.calls).toContain("upload:1");
    expect(account.calls).toContain("crons:*/30 * * * *");
    expect(account.secrets.get("INSIGHTFLARE_AE_API_TOKEN")).toBe("ae-token");
    const bindings = account.workers.get("insightflare")!;
    expect(bindings.find(b => b.name === "INSIGHTFLARE_DEPLOYMENT_SHA")?.text).toBe(sourceSha);
    expect(bindings.find(b => b.name === "INSIGHTFLARE_AE_ACCOUNT_ID")?.text).toBe(accountId);
    // Stored run never contains generated secrets.
    expect(JSON.stringify(done)).not.toContain("Admin-Password-123");
  });

  it("installs without Analytics Engine bindings when the account has not enabled it", async () => {
    const artifact = await release(1);
    const account = fakeAccount({ analyticsEngineEnabled: false });
    const done = await runToEnd(installRun(artifact), deps(account.client, artifact));

    expect(done.phase).toBe("succeeded");
    expect(done.steps.find(step => step.id === "worker")).toMatchObject({ status: "warning", note: { code: "AE_NOT_ENABLED" } });
    expect(done.steps.find(step => step.id === "analytics")?.status).toBe("skipped");
    const bindings = account.workers.get("insightflare")!;
    expect(bindings.some(b => b.type === "analytics_engine")).toBe(false);
    expect(bindings.find(b => b.name === "INSIGHTFLARE_ANALYTICS_ENGINE_DISABLED")?.text).toBe("1");
  });

  it("keeps going when the reader token cannot be created and asks for manual setup", async () => {
    const artifact = await release(1);
    const account = fakeAccount({ analyticsEngineEnabled: true, tokenPermission: false });
    const done = await runToEnd(installRun(artifact), deps(account.client, artifact));
    expect(done.phase).toBe("succeeded");
    expect(done.steps.find(step => step.id === "analytics")).toMatchObject({ status: "warning", note: { code: "AE_READER_MANUAL" } });
  });

  it("records a failure and resumes from the failed step without recreating resources", async () => {
    const artifact = await release(2);
    const account = fakeAccount({ analyticsEngineEnabled: true });
    account.failNextUploads(1);
    const d = deps(account.client, artifact);
    const failed = await runToEnd(installRun(artifact), d);
    expect(failed.phase).toBe("failed");
    expect(failed.failure?.step).toBe("worker");

    const done = await runToEnd(retryRun(failed, 2_000), d);
    expect(done.phase).toBe("succeeded");
    expect(account.calls.filter(call => call === "createD1" || call === "createKv")).toEqual(["createD1", "createKv"]);
  });

  it("adopts an empty database but refuses one that already holds data", async () => {
    const artifact = await release(1);
    const empty = fakeAccount({ analyticsEngineEnabled: true, existingDb: "empty" });
    const adopted = await runToEnd(installRun(artifact), deps(empty.client, artifact));
    expect(adopted.phase).toBe("succeeded");
    expect(adopted.steps.find(step => step.id === "database")?.note?.code).toBe("REUSED");
    expect(empty.calls).not.toContain("createD1");

    // Migrated by an install that never finished (no user yet): continue with it.
    const abandoned = fakeAccount({ analyticsEngineEnabled: true, existingDb: "abandoned" });
    const resumed = await runToEnd(installRun(artifact), deps(abandoned.client, artifact));
    expect(resumed.phase).toBe("succeeded");
    expect(abandoned.calls).not.toContain("createD1");

    const taken = fakeAccount({ analyticsEngineEnabled: true, existingDb: "data" });
    const refused = await runToEnd(installRun(artifact), deps(taken.client, artifact));
    expect(refused.phase).toBe("failed");
    expect(refused.failure).toMatchObject({ step: "verify", code: "UNAVAILABLE" });
  });

  it("finishes with a warning when the account has no workers.dev subdomain", async () => {
    const artifact = await release(1);
    const account = fakeAccount({ analyticsEngineEnabled: true, subdomain: null });
    const done = await runToEnd(installRun(artifact), deps(account.client, artifact));
    expect(done.phase).toBe("succeeded");
    expect(done.steps.find(step => step.id === "subdomain")).toMatchObject({ status: "warning", note: { code: "WORKERS_DEV_MISSING" } });
    expect(done.steps.find(step => step.id === "health")?.status).toBe("skipped");
  });

  it("retries the health check before reporting a propagation warning", async () => {
    const artifact = await release(1);
    const account = fakeAccount({ analyticsEngineEnabled: true });
    const d = deps(account.client, artifact, false);
    const done = await runToEnd(installRun(artifact), d);
    expect(done.phase).toBe("succeeded");
    expect(d.checkHealth).toHaveBeenCalledTimes(HEALTH_ATTEMPTS);
    expect(done.steps.find(step => step.id === "health")).toMatchObject({ status: "warning", note: { code: "HEALTH_TIMEOUT" } });
  });
});

describe("one-click update", () => {
  it("short-circuits when the installation already runs the reviewed commit", async () => {
    const artifact = await release(1);
    const account = fakeAccount();
    account.workers.set("insightflare", [
      { name: "DB", type: "d1" }, { name: "SITE_SETTINGS_KV", type: "kv_namespace" },
      { name: "INGEST_DO", type: "durable_object_namespace", class_name: "IngestDurableObject" },
      { name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: sourceSha }
    ]);
    const run = createRun({ id: "run-2", intent: "update", accountId, sourceSha, artifactDigest: artifact.manifest.artifactDigest, legacyAdoptionApproved: false, now: 0 });
    const done = await advanceRun(run, deps(account.client, artifact));
    expect(done.phase).toBe("succeeded");
    expect(done.steps.slice(1).every(step => step.status === "skipped")).toBe(true);
  });

  it("rolls back to the previous version when the new one never becomes healthy", async () => {
    const artifact = await release(1);
    const account = fakeAccount();
    const run: PipelineRun = {
      ...createRun({ id: "run-3", intent: "update", accountId, sourceSha, artifactDigest: artifact.manifest.artifactDigest, legacyAdoptionApproved: false, now: 0 }),
      state: { previousVersionId: "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f", workerUrl: "https://insightflare.acme.workers.dev" }
    };
    run.steps = run.steps.map(step => step.id === "health" ? step : { ...step, status: "done" });
    const done = await runToEnd(run, deps(account.client, artifact, false));
    expect(done.phase).toBe("failed");
    expect(done.failure?.code).toBe("ROLLED_BACK");
    expect(done.state.rolledBack).toBe(true);
    expect(account.client.createWorkerDeployment).toHaveBeenCalledWith(accountId, "insightflare", "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f", expect.any(String));
    expect(() => retryRun(done, 5)).toThrow();
  });
});

describe("fresh install plan", () => {
  it("derives bindings from the manifest and never inherits", async () => {
    const artifact = await release(1);
    const plan = planFreshInstall(artifact, {
      accountId, databaseId: "8a6f8ac3-8972-4f25-80d1-40ce170a1da9", kvNamespaceId: "c".repeat(32),
      analyticsEngine: true, mainSecret: "s".repeat(43), adminPassword: "Admin-Password-123"
    });
    expect(plan.migrations).toEqual({ new_tag: "v1", steps: [{ new_sqlite_classes: ["IngestDurableObject"] }] });
    expect(plan.bindings.map(b => b.name)).toEqual([
      "DB", "SITE_SETTINGS_KV", "INGEST_DO", "ASSETS", "REQUEST_ANALYTICS", "SESSION_WINDOW_MINUTES",
      "INSIGHTFLARE_AE_ACCOUNT_ID", "INSIGHTFLARE_DEPLOYMENT_SHA", "MAIN_SECRET", "BOOTSTRAP_ADMIN_PASSWORD"
    ]);
    expect(plan.bindings.some(b => b.type === "inherit")).toBe(false);
  });

  it("refuses manifests with unexpected bindings", async () => {
    const artifact = await release(1);
    (artifact.manifest.config.bindings as { d1: string[] }).d1 = ["DB", "OTHER"];
    expect(() => planFreshInstall(artifact, {
      accountId, databaseId: "8a6f8ac3-8972-4f25-80d1-40ce170a1da9", kvNamespaceId: "c".repeat(32),
      analyticsEngine: false, mainSecret: "s".repeat(43), adminPassword: "Admin-Password-123"
    })).toThrow("does not recognise");
  });

  it("generates readable passwords without ambiguous characters", () => {
    const password = generatePassword();
    expect(password).toHaveLength(20);
    expect(password).not.toMatch(/[0O1lI]/);
  });
});

describe("administrator password", () => {
  it("accepts 8 to 128 printable characters", async () => {
    const { validAdminPassword } = await import("../src/routes/pipeline");
    expect(validAdminPassword("12345678")).toBe(true);
    expect(validAdminPassword("密码也可以是中文字符")).toBe(true);
    expect(validAdminPassword("short")).toBe(false);
    expect(validAdminPassword("x".repeat(129))).toBe(false);
    expect(validAdminPassword("tab\tinside")).toBe(false);
    expect(validAdminPassword(12345678)).toBe(false);
  });

  it("marks only install runs as using a chosen password", () => {
    const base = { id: "r", accountId: "a".repeat(32), sourceSha: "d".repeat(40), artifactDigest: "e".repeat(64), legacyAdoptionApproved: false, now: 0, customAdminPassword: true };
    expect(createRun({ ...base, intent: "install" }).customAdminPassword).toBe(true);
    expect(createRun({ ...base, intent: "update" }).customAdminPassword).toBeUndefined();
  });
});
