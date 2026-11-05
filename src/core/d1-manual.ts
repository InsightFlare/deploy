import { DeployError } from "../types";
import type { ReleaseArtifact } from "./public-release";
import { planD1Migrations } from "./d1-migrations";
import type { D1MigrationSnapshot } from "./d1-migrations";

/**
 * Mirrors `wrangler d1 migrations apply --remote`:
 * - inspect the d1_migrations ledger
 * - skip filenames already recorded there
 * - execute remaining .sql files in lexical order
 * - stop immediately if one file fails
 *
 * An execution is initiated by an explicit user action, not a background
 * operation. The old Worker is NOT paused. No new maintenance DO, D1 write
 * gate, quiescence receipt, or Time Travel bookmark requirement is involved.
 */
export interface ManualD1Transport {
  d1MigrationSnapshot(accountId: string, databaseId: string): Promise<D1MigrationSnapshot>;
  d1ApplyVerifiedMigration(
    accountId: string, databaseId: string,
    migration: { name: string; sql: string; sha256: string },
    createLedger: boolean
  ): Promise<void>;
}

export interface ManualD1ApplyRequest {
  accountId: string;
  databaseId: string;
  sourceSha: string;
  reviewedPlanDigest: string;
  maxFiles?: number;
}

export interface ManualD1ApplyResult {
  sourceSha: string;
  databaseId: string;
  applied: string[];
  remaining: number;
  nextReviewedPlanDigest: string;
  completed: boolean;
}

function refuse(message: string, code: "INVALID_SOURCE" | "SOURCE_MOVED" | "UNAVAILABLE" = "SOURCE_MOVED"): never {
  throw new DeployError(code, "D1 migration failed: " + message, 409);
}

export async function applyManualD1Migrations(
  transport: ManualD1Transport,
  release: ReleaseArtifact,
  request: ManualD1ApplyRequest
): Promise<ManualD1ApplyResult> {
  if (!request || !release ||
      release.release.sha !== request.sourceSha ||
      release.artifact.pinnedSha !== request.sourceSha ||
      release.manifest.source.sha !== request.sourceSha ||
      !/^[a-f0-9]{64}$/.test(request.reviewedPlanDigest)) {
    refuse("the verified official source SHA or reviewed migration plan changed", "INVALID_SOURCE");
  }
  const max = request.maxFiles ?? 4;
  if (!Number.isSafeInteger(max) || max < 1 || max > 4) {
    refuse("invalid per-request migration batch size", "INVALID_SOURCE");
  }
  const applied: string[] = [];
  let nextDigest = "";
  let remaining = 0;

  for (let i = 0; i < max; i++) {
    const before = await transport.d1MigrationSnapshot(request.accountId, request.databaseId);
    const plan = await planD1Migrations(release, before);
    if (plan.accountId !== request.accountId.toLowerCase() ||
        plan.databaseId !== request.databaseId.toLowerCase()) {
      refuse("the selected Cloudflare account or D1 database identity changed");
    }
    if (i === 0 && plan.reviewedPlanDigest !== request.reviewedPlanDigest) {
      refuse("migration history changed since the preview; inspect it again");
    }
    if (!plan.pending.length) {
      nextDigest = plan.reviewedPlanDigest;
      remaining = 0;
      break;
    }
    const next = plan.pending[0]!;
    const file = release.migrations.find(item => item.name === next.name);
    if (!file || file.sha256 !== next.sha256) {
      refuse("the next migration file no longer matches the official archive", "INVALID_SOURCE");
    }

    // The REST batch includes the source SQL and its Wrangler-compatible
    // d1_migrations row atomically; errors abort the apply, as in Wrangler.
    await transport.d1ApplyVerifiedMigration(
      plan.accountId, plan.databaseId,
      { name: file.name, sql: file.sql, sha256: file.sha256 },
      before.appliedNames === null
    );

    const after = await transport.d1MigrationSnapshot(plan.accountId, plan.databaseId);
    const observed = after.appliedNames ?? [];
    const expected = [...(before.appliedNames ?? []), next.name];
    if (observed.length !== expected.length ||
        observed.some((name, index) => name !== expected[index])) {
      // Never presume success if the cloud response or ledger is ambiguous.
      refuse("D1 migration record could not be verified; refresh the preview before continuing");
    }
    applied.push(next.name);
    const refreshed = await planD1Migrations(release, after);
    nextDigest = refreshed.reviewedPlanDigest;
    remaining = refreshed.pending.length;
    if (!remaining) break;
  }

  if (!nextDigest) {
    // Unreachable for a valid positive max, but do not return fake success.
    refuse("migration progress was not verified", "UNAVAILABLE");
  }
  return {
    sourceSha: request.sourceSha,
    databaseId: request.databaseId.toLowerCase(),
    applied, remaining,
    nextReviewedPlanDigest: nextDigest,
    completed: remaining === 0
  };
}
