import { DeployError } from "../types";
import type { ReleaseArtifact } from "./public-release";
import type { D1MigrationTransport, D1MigrationApproval } from "./d1-migration-runner";
import type { D1ExclusiveLease } from "./d1-migration-runner";
import type { D1MigrationJournal } from "./d1-journal";

/**
 * These methods MUST be backed by the account/database-specific Durable
 * Object journal. In particular, reserve() durably commits the in-flight
 * step BEFORE the network request to D1 and is never a local memory flag.
 */
export interface DurableD1JournalGateway {
  reserve(bookmark: string, attemptId: string): Promise<D1MigrationJournal>;
  confirm(attemptId: string, appliedNames: string[], bookmark: string): Promise<D1MigrationJournal>;
  uncertain(attemptId: string, reason: "request-failed" | "ambiguous-result"): Promise<void>;
}

export interface JournaledMigrationStepResult {
  sourceSha: string;
  databaseId: string;
  completedName: string | null;
  confirmedCompleted: number;
  totalMigrationSteps: number;
  lastBookmark: string;
  recoveryBookmark: string;
  completed: boolean;
  canPromote: false;
}

function deny(message: string): never {
  throw new DeployError("UNAVAILABLE", "Journaled migration refused: " + message, 409);
}
function sameLedger(observed: string[] | null, expected: string[]): boolean {
  if (observed === null) return expected.length === 0;
  return observed.length === expected.length &&
    observed.every((name, index) => name === expected[index]);
}
function expectedHistory(journal: D1MigrationJournal): string[] {
  return [...journal.baselineApplied, ...journal.completedNames];
}

/**
 * One verified and explicitly approved migration step. This is private and
 * unused by HTTP routes: it is a foundation for future install execution.
 *
 * Each step checks the fresh bookmark + exact ledger, reserves in DO storage,
 * applies SQL and its Wrangler ledger entry in one D1 batch, then verifies
 * D1 before confirming completion. An uncertain outcome HALTS the run.
 */
export async function executeJournaledD1MigrationStep(
  release: ReleaseArtifact,
  journal: D1MigrationJournal,
  approval: D1MigrationApproval,
  lease: D1ExclusiveLease,
  transport: D1MigrationTransport,
  durableJournal: DurableD1JournalGateway
): Promise<JournaledMigrationStepResult> {
  if (!journal || journal.schemaVersion !== 1 ||
      journal.phase !== "armed" || journal.inFlight !== null ||
      !journal.initialInstall || journal.destructiveUpgrade ||
      journal.executionEnabled !== false ||
      !approval || !approval.approvalGranted ||
      approval.accountId !== journal.accountId ||
      approval.databaseId.toLowerCase() !== journal.databaseId ||
      approval.sourceSha !== journal.sourceSha ||
      approval.reviewedPlanDigest !== journal.reviewedPlanDigest ||
      !lease || lease.accountId !== journal.accountId ||
      lease.databaseId.toLowerCase() !== journal.databaseId ||
      lease.sourceSha !== journal.sourceSha) {
    deny("new-install review, maintenance conditions, approval or lease do not match");
  }
  if (!release || release.release.sha !== journal.sourceSha ||
      release.artifact.pinnedSha !== journal.sourceSha ||
      release.manifest.source.sha !== journal.sourceSha ||
      release.manifest.artifactDigest !== journal.artifactDigest ||
      release.migrations.length !== journal.pending.length + journal.baselineApplied.length) {
    deny("official Nightly provenance or migration inventory changed");
  }
  for (let i = 0; i < journal.baselineApplied.length; i++) {
    if (journal.baselineApplied[i] !== release.migrations[i]?.name) {
      deny("previous migrations no longer match the pinned release");
    }
  }
  for (let i = 0; i < journal.pending.length; i++) {
    const exact = release.migrations[journal.baselineApplied.length + i];
    if (!exact || exact.name !== journal.pending[i]?.name ||
        exact.sha256 !== journal.pending[i]?.sha256) {
      deny("pending migration names or SHA256 no longer match the signed Nightly plan");
    }
  }
  if (!(await lease.assertCurrent())) deny("the database lease is no longer current");
  const fresh = await transport.snapshot(journal.accountId, journal.databaseId);
  if (!fresh || fresh.accountId !== journal.accountId ||
      fresh.databaseId !== journal.databaseId ||
      fresh.bookmark !== journal.latestBookmark ||
      !sameLedger(fresh.appliedNames, expectedHistory(journal))) {
    deny("the live D1 bookmark or applied migration ledger changed since the last checkpoint");
  }
  const index = journal.completedNames.length;
  const next = journal.pending[index];
  if (!next) deny("no pending migration; job should already be terminal");
  const file = release.migrations[journal.baselineApplied.length + index];
  if (!file || file.name !== next!.name || file.sha256 !== next!.sha256) {
    deny("next migration file is inconsistent with the verified archive");
  }
  // Recheck the exact SQL bytes immediately before a remote mutation: callers
  // must never be able to splice unverified SQL into an already reviewed job.
  const sqlBytes = new TextEncoder().encode(file!.sql);
  const contentHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", sqlBytes))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
  const manifestFile = release.manifest.files.find(
    item => item.path === "migrations/" + file!.name
  );
  if (sqlBytes.byteLength === 0 || sqlBytes.byteLength > 90_000 ||
      contentHash !== next!.sha256 || manifestFile?.sha256 !== contentHash ||
      manifestFile.size !== sqlBytes.byteLength) {
    deny("official D1 migration contents no longer match the reviewed SHA256");
  }
  const attemptId = crypto.randomUUID();
  const reserved = await durableJournal.reserve(fresh.bookmark, attemptId);
  if (reserved.phase !== "in-flight" ||
      reserved.inFlight?.attemptId !== attemptId ||
      reserved.inFlight.name !== next!.name ||
      reserved.sourceSha !== journal.sourceSha) {
    deny("Durable Object did not confirm the exact write-ahead migration reservation");
  }
  let applied = false;
  try {
    if (!(await lease.assertCurrent())) deny("database lease expired before the SQL write");
    await transport.applyOne(journal.accountId, journal.databaseId,
      { name: file!.name, sql: file!.sql, sha256: file!.sha256 },
      fresh.appliedNames === null);
    applied = true;
    const after = await transport.snapshot(journal.accountId, journal.databaseId);
    const expected = [...expectedHistory(journal), file!.name];
    if (!after || after.accountId !== journal.accountId ||
        after.databaseId !== journal.databaseId ||
        !sameLedger(after.appliedNames, expected) ||
        typeof after.bookmark !== "string" || !after.bookmark) {
      deny("SQL outcome is ambiguous; D1 ledger differs from the expected prefix");
    }
    if (!(await lease.assertCurrent())) deny("database lease expired before commit of the verified checkpoint");
    const committed = await durableJournal.confirm(attemptId, expected, after.bookmark);
    if (!committed || committed.inFlight !== null ||
        !sameLedger([...committed.baselineApplied, ...committed.completedNames], expected) ||
        committed.latestBookmark !== after.bookmark) {
      deny("Durable Object did not confirm the verified D1 migration checkpoint");
    }
    return {
      sourceSha: journal.sourceSha, databaseId: journal.databaseId,
      completedName: file!.name, confirmedCompleted: committed.completedNames.length,
      totalMigrationSteps: journal.pending.length,
      lastBookmark: committed.latestBookmark,
      recoveryBookmark: committed.recoveryBookmark,
      completed: committed.phase === "completed", canPromote: false
    };
  } catch (error) {
    // A failed call may have reached Cloudflare despite transport errors.
    // Never replay automatically even if the response looked like a timeout.
    try {
      await durableJournal.uncertain(attemptId, applied ? "ambiguous-result" : "request-failed");
    } catch {
      // The write-ahead reservation remains persisted. Its lease-expiry
      // alarm will mark the operation uncertain if the client cannot reach DO.
    }
    throw error;
  }
}
