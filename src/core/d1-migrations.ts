import { DeployError } from "../types";
import type { ReleaseArtifact } from "./public-release";

const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const DB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^[0-9a-f]{32}$/i;
const MIGRATION = /^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/;
const MAX_MIGRATIONS = 512;
const MAX_SQL_BYTES = 90_000;

function blocked(message: string): never {
  throw new DeployError("UNAVAILABLE", "D1 migration preparation refused: " + message, 409);
}
async function hashBytes(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(result, x => x.toString(16).padStart(2, "0")).join("");
}

export interface D1MigrationSnapshot {
  accountId: string;
  databaseId: string;
  /** Names obtained from sqlite_master, including the migration ledger if it exists. */
  tableNames: string[];
  /** null means that the standard d1_migrations table is absent. */
  appliedNames: string[] | null;
  /** Optional diagnostic Time Travel bookmark; not required by Wrangler migrations. */
  bookmark: string;
}

export interface D1MigrationStep {
  name: string;
  sha256: string;
  sqlBytes: number;
  destructive: boolean;
  warnings: string[];
}

export interface ReviewedD1MigrationPlan {
  sourceSha: string;
  artifactDigest: string;
  accountId: string;
  databaseId: string;
  bookmark: string;
  appliedNames: string[];
  pending: D1MigrationStep[];
  initialInstall: boolean;
  destructiveUpgrade: boolean;
  needsConfirmation: boolean;
  reviewedPlanDigest: string;
}

/** Conservative flags for SQL that can invalidate an old live Worker. */
export function classifyMigration(sql: string): { destructive: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (/\bDROP\s+(?:TABLE|COLUMN)\b/i.test(sql)) warnings.push("drops database schema");
  if (/\bALTER\s+TABLE\b/i.test(sql)) warnings.push("changes existing table schema");
  if (/\b(?:DELETE\s+FROM|UPDATE\s+[\w"\[\]`]+\s+SET|INSERT\s+(?:OR\s+\w+\s+)?INTO)\b/i.test(sql)) warnings.push("writes or rewrites existing data");
  if (/\b(?:RENAME\s+(?:TABLE|TO)|PRAGMA\s+foreign_keys\s*=\s*OFF)\b/i.test(sql)) warnings.push("changes foreign keys or renames schema");
  return { destructive: warnings.length > 0, warnings };
}

/**
 * Inputs MUST be produced by the verified single-file Nightly loader and a
 * fresh account-scoped Cloudflare D1 read. No remote mutations occur here.
 */
export async function planD1Migrations(
  release: ReleaseArtifact,
  snapshot: D1MigrationSnapshot
): Promise<ReviewedD1MigrationPlan> {
  if (!release || !SHA.test(release.release?.sha ?? "") ||
      release.artifact?.pinnedSha !== release.release.sha ||
      release.manifest?.source?.sha !== release.release.sha ||
      !HASH.test(release.manifest.artifactDigest) ||
      release.manifest.artifactDigest !== release.artifact.summary.digest ||
      !ACCOUNT.test(snapshot?.accountId ?? "") || !DB_ID.test(snapshot?.databaseId ?? "") ||
      typeof snapshot.bookmark !== "string" || snapshot.bookmark.length > 200 ||
      !Array.isArray(snapshot.tableNames) || snapshot.tableNames.some(x => typeof x !== "string")) {
    return blocked("verified source, database identity or recovery bookmark missing");
  }
  const sqlFiles = release.migrations;
  if (!Array.isArray(sqlFiles) || sqlFiles.length < 1 || sqlFiles.length > MAX_MIGRATIONS ||
      release.manifest.totals.migrations !== sqlFiles.length) {
    return blocked("unrecognized D1 migration inventory");
  }

  let previous = "";
  const migrations: D1MigrationStep[] = [];
  for (const migration of sqlFiles) {
    if (!migration || !MIGRATION.test(migration.name) || migration.name <= previous ||
        typeof migration.sql !== "string" || !HASH.test(migration.sha256)) {
      return blocked("migration filenames or order are not the official canonical sequence");
    }
    const sqlBytes = new TextEncoder().encode(migration.sql).byteLength;
    if (!sqlBytes || sqlBytes > MAX_SQL_BYTES ||
        (await hashBytes(migration.sql)) !== migration.sha256 ||
        !release.manifest.files.some(file => file.path === "migrations/" + migration.name &&
          file.sha256 === migration.sha256 && file.size === sqlBytes)) {
      return blocked("migration SQL changed since the verified Nightly archive");
    }
    migrations.push({ name: migration.name, sha256: migration.sha256, sqlBytes,
      ...classifyMigration(migration.sql) });
    previous = migration.name;
  }

  const tables = snapshot.tableNames;
  const ledgerExists = tables.includes("d1_migrations");
  if (ledgerExists !== (snapshot.appliedNames !== null)) {
    return blocked("the migration ledger presence disagrees with database metadata");
  }
  const applied = snapshot.appliedNames ?? [];
  if (!Array.isArray(applied) || new Set(applied).size !== applied.length ||
      applied.some(name => typeof name !== "string" || name.length > 256)) {
    return blocked("invalid or duplicated applied-migration ledger");
  }
  // Follow Wrangler: migration filenames, not a mandatory ledger prefix,
  // determine what remains to be applied in sorted source-file order.
  // Existing non-migration tables and unrelated ledger names are NOT blocked:
  // let the actual SQL succeed/fail exactly as during a manual deployment.
  const completed = new Set(applied);
  const pending = migrations.filter(step => !completed.has(step.name));
  const initialInstall = !ledgerExists &&
    tables.every(name => name.startsWith("sqlite_") || name.startsWith("_cf_"));
  const destructiveUpgrade = !initialInstall && pending.some(step => step.destructive);
  const planDigest = await hashBytes(JSON.stringify({
    sourceSha: release.release.sha,
    artifactDigest: release.manifest.artifactDigest,
    accountId: snapshot.accountId,
    databaseId: snapshot.databaseId.toLowerCase(),
    applied: [...applied].sort(),
    pending: pending.map(step => [step.name, step.sha256]),
    initialInstall
  }));

  return {
    sourceSha: release.release.sha,
    artifactDigest: release.manifest.artifactDigest,
    accountId: snapshot.accountId, databaseId: snapshot.databaseId.toLowerCase(),
    bookmark: snapshot.bookmark,
    appliedNames: [...applied], pending,
    initialInstall, destructiveUpgrade, needsConfirmation: pending.length > 0,
    reviewedPlanDigest: planDigest
  };
}

export function requireD1MigrationApproval(
  plan: ReviewedD1MigrationPlan, approval: {
    accountId: string;
    databaseId: string;
    sourceSha: string;
    reviewedPlanDigest: string;
    approvalGranted: boolean;
  }
): void {
  if (!plan || !HASH.test(plan.reviewedPlanDigest) ||
      !approval || approval.accountId !== plan.accountId ||
      approval.databaseId.toLowerCase() !== plan.databaseId ||
      approval.sourceSha !== plan.sourceSha ||
      approval.reviewedPlanDigest !== plan.reviewedPlanDigest ||
      !approval.approvalGranted) {
    return blocked("user approval does not match the exact source, D1 database and migration plan");
  }
}
