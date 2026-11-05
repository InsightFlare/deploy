import { describe, expect, it, vi } from "vitest";
import { planD1Migrations, requireD1MigrationApproval } from "../src/core/d1-migrations";
import type { D1MigrationSnapshot } from "../src/core/d1-migrations";
import type { ReleaseArtifact } from "../src/core/public-release";

const sha = "d".repeat(40);
const sourceDigest = "f".repeat(64);
const accountId = "a".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const sqlSet = [
  { name: "0001_initial.sql", sql: "CREATE TABLE users (id TEXT PRIMARY KEY);" },
  { name: "0002_add_columns.sql", sql: "ALTER TABLE users ADD COLUMN name TEXT;" },
  { name: "0003_extra.sql", sql: "CREATE TABLE sessions (id TEXT PRIMARY KEY);" }
] as const;

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    x => x.toString(16).padStart(2, "0")).join("");
}
async function fixture(): Promise<ReleaseArtifact> {
  const migrations = await Promise.all(sqlSet.map(async ({ name, sql }) => ({
    name, sql, sha256: await digest(sql)
  })));
  return {
    release: { sha, tag: "nightly", artifactDigest: sourceDigest,
      archiveAsset: { name: "nightly.tar.gz", size: 1,
        digest: "sha256:" + "a".repeat(64), browser_download_url: "https://github.com/RavelloH/InsightFlare" } },
    migrations,
    artifact: { pinnedSha: sha, config: { name: "insightflare", mainModule: "index.js",
      compatibilityDate: "2026-03-01", compatibilityFlags: [], migrations: [],
      observedBuildVariables: [], cronTriggers: [] },
      modules: [], assets: [],
      summary: { sourceSha: sha, digest: sourceDigest, moduleCount: 0, moduleBytes: 0,
        assetCount: 0, assetBytes: 0, migrationTags: [] } },
    manifest: { schemaVersion: 1, source: { repository: "RavelloH/InsightFlare", sha },
      artifactDigest: sourceDigest, config: { mainModule: "index.js",
        compatibilityDate: "2026-03-01", compatibilityFlags: [], doMigrations: [],
        bindings: {}, vars: {}, crons: [] },
      totals: { modules: 1, assets: 1, migrations: migrations.length,
        bytes: migrations.reduce((n, f) => n + new TextEncoder().encode(f.sql).byteLength, 0) },
      files: migrations.map(file => ({
        path: "migrations/" + file.name, size: new TextEncoder().encode(file.sql).byteLength,
        sha256: file.sha256
      }))
    }
  };
}
function snapshot(overrides: Partial<D1MigrationSnapshot> = {}): D1MigrationSnapshot {
  return { accountId, databaseId, tableNames: [], appliedNames: null,
    bookmark: "000000c1-00000001-00000002-123456789abc", ...overrides };
}

describe("verified Nightly SQL migration planner, read-only", () => {
  it("sees an empty user-owned D1 database as a full 3-step first installation", async () => {
    const plan = await planD1Migrations(await fixture(), snapshot());
    expect(plan.pending.map(item => item.name)).toEqual(sqlSet.map(x => x.name));
    expect(plan.initialInstall).toBe(true);
    expect(plan.destructiveUpgrade).toBe(false);
    expect(plan.pending[1]?.destructive).toBe(true);
    expect(plan.needsConfirmation).toBe(true);
    expect(plan.reviewedPlanDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("offers only the suffix of ordered unapplied migrations on an existing D1", async () => {
    const plan = await planD1Migrations(await fixture(), snapshot({
      tableNames: ["d1_migrations", "users"],
      appliedNames: ["0001_initial.sql"]
    }));
    expect(plan.pending.map(x => x.name)).toEqual(["0002_add_columns.sql", "0003_extra.sql"]);
    expect(plan.initialInstall).toBe(false);
    expect(plan.destructiveUpgrade).toBe(true);
  });

  it("does not touch a fully up-to-date database", async () => {
    const plan = await planD1Migrations(await fixture(), snapshot({
      tableNames: ["d1_migrations", "users", "sessions"],
      appliedNames: sqlSet.map(x => x.name)
    }));
    expect(plan.pending).toEqual([]);
    expect(plan.needsConfirmation).toBe(false);
    expect(plan.destructiveUpgrade).toBe(false);
  });

  it("follows Wrangler filenames, even on a populated database or non-prefix ledger", async () => {
    const populated = await planD1Migrations(await fixture(), snapshot({
      tableNames: ["users"], appliedNames: null
    }));
    expect(populated.initialInstall).toBe(false);
    expect(populated.pending).toHaveLength(3);
    const nonPrefix = await planD1Migrations(await fixture(), snapshot({
      tableNames: ["d1_migrations", "users"],
      appliedNames: ["0002_add_columns.sql", "9999_custom.sql"]
    }));
    expect(nonPrefix.pending.map(x => x.name)).toEqual(["0001_initial.sql", "0003_extra.sql"]);
  });

  it.each([
    { tableNames: ["d1_migrations"], appliedNames: ["0001_initial.sql", "0001_initial.sql"] },
    { tableNames: [], appliedNames: ["0001_initial.sql"] },
    { tableNames: ["d1_migrations"], appliedNames: null }
  ])("refuses malformed migration metadata: %j", async overrides => {
    await expect(planD1Migrations(await fixture(), snapshot(overrides))).rejects.toThrow();
  });

  it("rejects modified SQL, migration inventory, or source SHA after review", async () => {
    const data = await fixture();
    data.migrations[0]!.sql += " -- modified";
    await expect(planD1Migrations(data, snapshot())).rejects.toThrow("SQL changed");
    const bad = await fixture();
    bad.release.sha = "e".repeat(40);
    await expect(planD1Migrations(bad, snapshot())).rejects.toThrow();
    const noFile = await fixture();
    noFile.manifest.files = [];
    await expect(planD1Migrations(noFile, snapshot())).rejects.toThrow();
  });

  it("binds review to DB identity and ledger, not unrelated Time Travel bookmarks", async () => {
    const data = await fixture();
    const first = await planD1Migrations(data, snapshot());
    const otherBookmark = await planD1Migrations(data, snapshot({ bookmark: "second-bookmark" }));
    const otherDb = await planD1Migrations(data, snapshot({ databaseId: "9a6f8ac3-8972-4f25-80d1-40ce170a1da9" }));
    const upgraded = await planD1Migrations(data, snapshot({
      tableNames: ["d1_migrations"], appliedNames: ["0001_initial.sql"]
    }));
    expect(first.reviewedPlanDigest).toBe(otherBookmark.reviewedPlanDigest);
    expect(new Set([first.reviewedPlanDigest,
      otherDb.reviewedPlanDigest, upgraded.reviewedPlanDigest]).size).toBe(3);
  });

  it("does not demand a maintenance window for ordinary Wrangler-style upgrades", async () => {
    const plan = await planD1Migrations(await fixture(), snapshot({
      tableNames: ["d1_migrations"], appliedNames: ["0001_initial.sql"]
    }));
    const approval = { accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest,
      approvalGranted: true };
    expect(() => requireD1MigrationApproval(plan, approval)).not.toThrow();
    expect(() => requireD1MigrationApproval(plan, approval)).not.toThrow();
    expect(() => requireD1MigrationApproval(plan,
      { ...approval, databaseId: "e".repeat(32) })).toThrow();
  });

  it("never implicitly approves D1 mutations for a new installation either", async () => {
    const plan = await planD1Migrations(await fixture(), snapshot());
    expect(() => requireD1MigrationApproval(plan, {
      accountId, databaseId, sourceSha: sha,
      reviewedPlanDigest: plan.reviewedPlanDigest,
      approvalGranted: false
    })).toThrow();
  });
});
