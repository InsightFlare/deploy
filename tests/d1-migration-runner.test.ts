import { describe, expect, it, vi } from "vitest";
import { executeReviewedD1MigrationStep, type D1MigrationTransport } from "../src/core/d1-migration-runner";
import { planD1Migrations, type D1MigrationSnapshot } from "../src/core/d1-migrations";
import type { ReleaseArtifact } from "../src/core/public-release";

const sha = "a".repeat(40);
const digest = "b".repeat(64);
const accountId = "c".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const bookmark = "000000c1-00000001-00000002-123456789abc";
const sql = "CREATE TABLE users (id TEXT PRIMARY KEY);";

async function fixture(): Promise<ReleaseArtifact> {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(sql))), x => x.toString(16).padStart(2, "0")).join("");
  return {
    release: { sha, tag: "nightly", artifactDigest: digest,
      archiveAsset: { name: "archive.tar.gz", size: 1,
        digest: "sha256:" + "e".repeat(64), browser_download_url: "https://github.com/RavelloH/InsightFlare" } },
    migrations: [{ name: "0001_initial.sql", sql, sha256 }],
    artifact: { pinnedSha: sha, config: { name: "insightflare", mainModule: "index.js",
      compatibilityDate: "2026-03-01", compatibilityFlags: [], migrations: [],
      observedBuildVariables: [], cronTriggers: [] },
      modules: [], assets: [],
      summary: { sourceSha: sha, digest, moduleCount: 0, moduleBytes: 0,
        assetCount: 0, assetBytes: 0, migrationTags: [] } },
    manifest: { schemaVersion: 1, source: { repository: "RavelloH/InsightFlare", sha },
      artifactDigest: digest,
      config: { mainModule: "index.js", compatibilityDate: "2026-03-01",
        compatibilityFlags: [], doMigrations: [], bindings: {}, vars: {}, crons: [] },
      files: [{ path: "migrations/0001_initial.sql",
        size: new TextEncoder().encode(sql).byteLength, sha256 }],
      totals: { modules: 1, assets: 1, migrations: 1,
        bytes: new TextEncoder().encode(sql).byteLength }
    }
  };
}

function baseSnapshot(): D1MigrationSnapshot {
  return { accountId, databaseId, tableNames: [],
    appliedNames: null, bookmark };
}
function mockTransport(options: {
  stale?: boolean; corruptResult?: boolean; writeFails?: boolean
} = {}) {
  let count = 0;
  let state = baseSnapshot();
  const log: string[] = [];
  const snapshot = vi.fn(async () => {
    log.push("snapshot");
    if (options.stale && count++ === 0) return { ...state, bookmark: "another-bookmark" };
    return { ...state, tableNames: [...state.tableNames],
      appliedNames: state.appliedNames && [...state.appliedNames] };
  });
  const applyOne = vi.fn(async (_a: string, _d: string,
    file: { name: string; sql: string; sha256: string }, createLedger: boolean) => {
    log.push("apply");
    expect(file.name).toBe("0001_initial.sql");
    expect(file.sql).toBe(sql);
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(createLedger).toBe(true);
    if (options.writeFails) throw Error("mock D1 failure");
    state = { ...state, tableNames: ["d1_migrations", "users"],
      appliedNames: options.corruptResult ? [] : [file.name],
      bookmark: "new-bookmark" };
  });
  return { transport: { snapshot, applyOne } satisfies D1MigrationTransport, log };
}
function lease(active = true) {
  return { accountId, databaseId, sourceSha: sha,
    assertCurrent: vi.fn(async () => active) };
}

describe("explicitly approved, locked D1 migration coordinator (offline)", () => {
  it("executes one validated file under an account/DB lock and verifies ledger afterwards", async () => {
    const release = await fixture();
    const plan = await planD1Migrations(release, baseSnapshot());
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest,
      maintenanceWindowConfirmed: false, approvalGranted: true };
    const { transport, log } = mockTransport();
    const output = await executeReviewedD1MigrationStep(release, plan, approval,
      lease(), transport);
    expect(output).toMatchObject({
      backupBookmark: bookmark, latestBookmark: "new-bookmark",
      appliedThisRun: ["0001_initial.sql"], remaining: 0,
      completed: true, canPromote: false
    });
    expect(log).toEqual(["snapshot", "apply", "snapshot"]);
    expect(transport.applyOne).toHaveBeenCalledTimes(1);
  });

  it("refuses any write without explicit consent and exact approved plan", async () => {
    const release = await fixture();
    const plan = await planD1Migrations(release, baseSnapshot());
    const { transport } = mockTransport();
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest, maintenanceWindowConfirmed: false,
      approvalGranted: false };
    await expect(executeReviewedD1MigrationStep(release, plan, approval,
      lease(), transport)).rejects.toThrow("approval does not match");
    expect(transport.applyOne).not.toHaveBeenCalled();
  });

  it("requires the exclusive database lease and refuses lost or wrong locks", async () => {
    const release = await fixture();
    const plan = await planD1Migrations(release, baseSnapshot());
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest, maintenanceWindowConfirmed: false,
      approvalGranted: true };
    const { transport } = mockTransport();
    await expect(executeReviewedD1MigrationStep(release, plan, approval,
      lease(false), transport)).rejects.toThrow("lock is not held");
    await expect(executeReviewedD1MigrationStep(release, plan, approval,
      { ...lease(), databaseId: "f".repeat(36) }, transport)).rejects.toThrow("lock is not held");
    expect(transport.applyOne).not.toHaveBeenCalled();
  });

  it("refuses stale review bookmarks before touching D1 SQL", async () => {
    const release = await fixture();
    const plan = await planD1Migrations(release, baseSnapshot());
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest, maintenanceWindowConfirmed: false,
      approvalGranted: true };
    const { transport } = mockTransport({ stale: true });
    await expect(executeReviewedD1MigrationStep(release, plan, approval,
      lease(), transport)).rejects.toThrow("bookmark changed");
    expect(transport.applyOne).not.toHaveBeenCalled();
  });

  it("never automatically retries an uncertain migration write", async () => {
    const release = await fixture();
    const plan = await planD1Migrations(release, baseSnapshot());
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest, maintenanceWindowConfirmed: false,
      approvalGranted: true };
    const { transport } = mockTransport({ corruptResult: true });
    await expect(executeReviewedD1MigrationStep(release, plan, approval,
      lease(), transport)).rejects.toThrow("uncertain");
    expect(transport.applyOne).toHaveBeenCalledTimes(1);
  });

  it("propagates failed migration and stops, without claiming a successful deployment", async () => {
    const release = await fixture();
    const plan = await planD1Migrations(release, baseSnapshot());
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest, maintenanceWindowConfirmed: false,
      approvalGranted: true };
    const { transport } = mockTransport({ writeFails: true });
    await expect(executeReviewedD1MigrationStep(release, plan, approval,
      lease(), transport)).rejects.toThrow("mock D1 failure");
    expect(transport.applyOne).toHaveBeenCalledTimes(1);
  });
});
