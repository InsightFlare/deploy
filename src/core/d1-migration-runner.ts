import { DeployError } from "../types";
import type { ReleaseArtifact } from "./public-release";
import {
  planD1Migrations, requireD1MigrationApproval,
  type D1MigrationSnapshot, type ReviewedD1MigrationPlan
} from "./d1-migrations";

function refuse(message: string): never {
  throw new DeployError("UNAVAILABLE", "D1 migration execution refused: " + message, 409);
}
export interface D1MigrationApproval {
  accountId: string;
  databaseId: string;
  sourceSha: string;
  reviewedPlanDigest: string;
  maintenanceWindowConfirmed: boolean;
  approvalGranted: boolean;
}

/** Must be held by a user/account/database-scoped durable run coordinator. */
export interface D1ExclusiveLease {
  accountId: string;
  databaseId: string;
  sourceSha: string;
  assertCurrent(): Promise<boolean>;
}

/**
 * This is deliberately an injectable interface. A real D1 /query batch
 * adapter is NOT wired to any public endpoint until Cloudflare's SQL
 * transaction/PRAGMA behavior has passed disposable database validation.
 */
export interface D1MigrationTransport {
  snapshot(accountId: string, databaseId: string): Promise<D1MigrationSnapshot>;
  applyOne(accountId: string, databaseId: string, migration: {
    name: string; sql: string; sha256: string;
  }, createLedger: boolean): Promise<void>;
}

export interface D1MigrationProgress {
  sourceSha: string;
  databaseId: string;
  backupBookmark: string;
  latestBookmark: string;
  appliedThisRun: string[];
  remaining: number;
  completed: boolean;
  /** D1 migration completion NEVER authorizes Worker promotion. */
  canPromote: false;
}

function sameApplied(a: string[] | null, b: string[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Internal one-step coordinator: review -> exclusive lock -> recheck D1
 * provenance -> execute one atomic migration -> verify ledger. No automatic
 * promotion, deletion, D1 Time Travel restore or retry of an uncertain write.
 *
 * The caller is responsible for durable lease acquisition and release. This
 * function never creates an authorization token or a lock on its own.
 */
export async function executeReviewedD1MigrationStep(
  release: ReleaseArtifact,
  reviewed: ReviewedD1MigrationPlan,
  approval: D1MigrationApproval,
  lease: D1ExclusiveLease,
  transport: D1MigrationTransport
): Promise<D1MigrationProgress> {
  requireD1MigrationApproval(reviewed, approval);
  if (!lease || lease.accountId !== reviewed.accountId ||
      lease.databaseId.toLowerCase() !== reviewed.databaseId ||
      lease.sourceSha !== reviewed.sourceSha ||
      typeof lease.assertCurrent !== "function" ||
      !(await lease.assertCurrent())) {
    return refuse("the exact database-scoped migration lock is not held");
  }
  const fresh = await transport.snapshot(reviewed.accountId, reviewed.databaseId);
  if (!fresh || fresh.accountId !== reviewed.accountId ||
      fresh.databaseId.toLowerCase() !== reviewed.databaseId) {
    return refuse("database identity changed before executing migration");
  }
  // The review included the exact pre-migration D1 restore bookmark.
  // Never execute from a stale preview, even if the ledger still matches.
  if (fresh.bookmark !== reviewed.bookmark) {
    return refuse("D1 Time Travel bookmark changed since approval; review again");
  }
  const replanned = await planD1Migrations(release, fresh);
  if (replanned.reviewedPlanDigest !== reviewed.reviewedPlanDigest ||
      replanned.sourceSha !== reviewed.sourceSha ||
      replanned.databaseId !== reviewed.databaseId) {
    return refuse("database migration plan has changed since approval");
  }
  const next = reviewed.pending[0];
  if (!next) return {
    sourceSha: reviewed.sourceSha,
    databaseId: reviewed.databaseId,
    backupBookmark: reviewed.bookmark,
    latestBookmark: fresh.bookmark,
    appliedThisRun: [], remaining: 0, completed: true, canPromote: false
  };
  const file = release.migrations.find(item => item.name === next.name);
  if (!file || file.sha256 !== next.sha256 || file.sql.length === 0) {
    return refuse("verified source migration file is missing or changed");
  }
  if (!(await lease.assertCurrent())) return refuse("migration lock was lost before D1 write");

  // The remote adapter must atomically apply file SQL and insert the
  // corresponding Wrangler d1_migrations record, or report failure.
  await transport.applyOne(reviewed.accountId, reviewed.databaseId,
    { name: file.name, sql: file.sql, sha256: file.sha256 }, fresh.appliedNames === null);

  const after = await transport.snapshot(reviewed.accountId, reviewed.databaseId);
  const expected = [...reviewed.appliedNames, file.name];
  if (after.accountId !== reviewed.accountId || after.databaseId !== reviewed.databaseId ||
      !sameApplied(after.appliedNames, expected)) {
    // The write outcome might be uncertain. Do not automatically retry.
    return refuse("migration result is uncertain; inspect the D1 ledger before any retry");
  }
  const remaining = reviewed.pending.length - 1;
  return {
    sourceSha: reviewed.sourceSha,
    databaseId: reviewed.databaseId,
    backupBookmark: reviewed.bookmark,
    latestBookmark: after.bookmark,
    appliedThisRun: [file.name],
    remaining,
    completed: remaining === 0,
    canPromote: false
  };
}
