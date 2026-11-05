import { DeployError } from "../types";
import type { ReviewedD1MigrationPlan } from "./d1-migrations";
import type { D1Lease, D1LeaseProof } from "./d1-lease";
import { isD1LeaseCurrent } from "./d1-lease";

/**
 * Persistent, per-account/per-database migration journal. It has NO SQL,
 * Cloudflare credentials, application data or automatic rollback action.
 *
 * Execution is deliberately NOT enabled by this type. It is designed to
 * survive Worker updates, DO hibernation and ambiguous network failures.
 */
export type D1JournalPhase =
  | "reviewed" | "armed" | "in-flight" | "uncertain" | "completed" | "cancelled";

export interface D1JournalStep {
  name: string;
  sha256: string;
}

export interface D1MigrationJournal {
  schemaVersion: 1;
  accountId: string;
  databaseId: string;
  ownerId: string;
  runId: string;
  sourceSha: string;
  artifactDigest: string;
  reviewedPlanDigest: string;
  /** Stored only inside the DB-specific DO; never exposed to client UI. */
  recoveryBookmark: string;
  latestBookmark: string;
  initialInstall: boolean;
  destructiveUpgrade: boolean;
  baselineApplied: string[];
  pending: D1JournalStep[];
  completedNames: string[];
  phase: D1JournalPhase;
  inFlight: { name: string; sha256: string; attemptId: string; startedAt: number } | null;
  incident: string | null;
  createdAt: number;
  updatedAt: number;
  /** This journal alone NEVER authorizes remote D1 writes. */
  executionEnabled: false;
}

export interface D1JournalProof extends D1LeaseProof {
  accountId: string;
  databaseId: string;
}

const HEX = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const FILE = /^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/;
const MAX_SQL_FILES = 512;

function deny(message: string): never {
  throw new DeployError("UNAVAILABLE", "D1 migration journal refused: " + message, 409);
}
function validBook(bookmark: string): boolean {
  return typeof bookmark === "string" && bookmark.length > 0 && bookmark.length <= 200;
}
function sameIdentity(j: D1MigrationJournal, p: D1JournalProof): boolean {
  return j.accountId === p.accountId.toLowerCase() &&
    j.databaseId === p.databaseId.toLowerCase() &&
    j.runId === p.runId && j.ownerId === p.ownerId &&
    j.sourceSha === p.sourceSha &&
    j.reviewedPlanDigest === p.reviewedPlanDigest;
}
function validateJournalProof(j: D1MigrationJournal, p: D1JournalProof,
  lease: D1Lease | null, now: number): void {
  if (!p || !sameIdentity(j, p) || !lease ||
      lease.accountId !== j.accountId || lease.databaseId !== j.databaseId ||
      !isD1LeaseCurrent(lease, p, now)) {
    deny("the exact active database lease and reviewed operation are required");
  }
}

export function newD1MigrationJournal(
  plan: ReviewedD1MigrationPlan,
  proof: D1JournalProof,
  lease: D1Lease | null,
  now = Date.now()
): D1MigrationJournal {
  if (!plan || !proof || !lease || !SHA.test(plan.sourceSha) ||
      !HEX.test(plan.artifactDigest) || !HEX.test(plan.reviewedPlanDigest) ||
      !UUID.test(plan.databaseId) || !validBook(plan.bookmark) ||
      !Array.isArray(plan.pending) || !Array.isArray(plan.appliedNames) ||
      plan.pending.length > MAX_SQL_FILES ||
      plan.pending.some(s => !FILE.test(s?.name ?? "") || !HEX.test(s?.sha256 ?? "")) ||
      new Set([...plan.appliedNames, ...plan.pending.map(s => s.name)]).size !==
        plan.appliedNames.length + plan.pending.length) {
    deny("migration plan data is incomplete or invalid");
  }
  const seed: D1MigrationJournal = {
    schemaVersion: 1,
    accountId: plan.accountId.toLowerCase(),
    databaseId: plan.databaseId.toLowerCase(),
    ownerId: proof.ownerId,
    runId: proof.runId,
    sourceSha: plan.sourceSha,
    artifactDigest: plan.artifactDigest,
    reviewedPlanDigest: plan.reviewedPlanDigest,
    recoveryBookmark: plan.bookmark,
    latestBookmark: plan.bookmark,
    initialInstall: plan.initialInstall,
    destructiveUpgrade: plan.destructiveUpgrade,
    baselineApplied: [...plan.appliedNames],
    pending: plan.pending.map(s => ({ name: s.name, sha256: s.sha256 })),
    completedNames: [],
    phase: plan.pending.length ? "reviewed" : "completed",
    inFlight: null,
    incident: null,
    createdAt: now,
    updatedAt: now,
    executionEnabled: false
  };
  validateJournalProof(seed, proof, lease, now);
  return seed;
}

export interface D1JournalStatus {
  phase: D1JournalPhase;
  sourceSha: string;
  total: number;
  appliedBefore: number;
  appliedByDeploy: number;
  remaining: number;
  inFlightName: string | null;
  incident: string | null;
  recoveryBookmarkAvailable: boolean;
  existingInstallationNeedsQuiescence: boolean;
  createdAt: number;
  updatedAt: number;
  executionAvailable: false;
}

/** Explicitly browser-safe view; never return a bookmark, secret or owner. */
export function safeD1JournalStatus(j: D1MigrationJournal): D1JournalStatus {
  return {
    phase: j.phase,
    sourceSha: j.sourceSha,
    total: j.baselineApplied.length + j.pending.length,
    appliedBefore: j.baselineApplied.length,
    appliedByDeploy: j.completedNames.length,
    remaining: j.pending.length - j.completedNames.length,
    inFlightName: j.inFlight?.name ?? null,
    incident: j.incident,
    recoveryBookmarkAvailable: validBook(j.recoveryBookmark),
    existingInstallationNeedsQuiescence: !j.initialInstall,
    createdAt: j.createdAt, updatedAt: j.updatedAt,
    executionAvailable: false
  };
}

/** Same immutable plan can be recalled; a different plan cannot replace it. */
export function assertCanKeepJournal(existing: D1MigrationJournal | null,
  incoming: D1MigrationJournal): D1MigrationJournal {
  if (!existing) return incoming;
  if (existing.accountId !== incoming.accountId ||
      existing.databaseId !== incoming.databaseId ||
      existing.runId !== incoming.runId ||
      existing.ownerId !== incoming.ownerId ||
      existing.reviewedPlanDigest !== incoming.reviewedPlanDigest ||
      existing.sourceSha !== incoming.sourceSha ||
      existing.recoveryBookmark !== incoming.recoveryBookmark) {
    deny("database already has a different durable migration review");
  }
  return existing;
}

/**
 * This operation does NOT enable execution for existing installations.
 * A new-installation can only be armed after an independent checker has
 * established there is no Worker/route consuming the target D1, it is empty,
 * and its exact plan is still approved. This attestation is NOT accepted from
 * a browser and has no public endpoint.
 */
export interface NewInstallSafety {
  accountId: string;
  databaseId: string;
  workerAbsent: true;
  databaseEmpty: true;
  consentConfirmed: true;
  verifiedAt: number;
}
export function armNewInstallJournal(
  journal: D1MigrationJournal,
  proof: D1JournalProof,
  lease: D1Lease | null,
  safety: NewInstallSafety,
  now = Date.now()
): D1MigrationJournal {
  validateJournalProof(journal, proof, lease, now);
  if (journal.phase !== "reviewed" || !journal.initialInstall ||
      journal.baselineApplied.length !== 0 || journal.destructiveUpgrade ||
      !safety || safety.accountId.toLowerCase() !== journal.accountId ||
      safety.databaseId.toLowerCase() !== journal.databaseId ||
      safety.workerAbsent !== true || safety.databaseEmpty !== true ||
      safety.consentConfirmed !== true ||
      !Number.isFinite(safety.verifiedAt) || safety.verifiedAt > now ||
      now - safety.verifiedAt > 30_000) {
    deny("new installation is not independently verified safe for migration");
  }
  return { ...journal, phase: "armed", updatedAt: now };
}

/** Durable write-ahead step; persist BEFORE invoking Cloudflare D1 /query. */
export function beginD1JournalStep(
  journal: D1MigrationJournal,
  proof: D1JournalProof,
  lease: D1Lease | null,
  checkedBookmark: string,
  attemptId: string,
  now = Date.now()
): D1MigrationJournal {
  validateJournalProof(journal, proof, lease, now);
  if (journal.phase !== "armed" ||
      checkedBookmark !== journal.latestBookmark ||
      !UUID.test(attemptId)) {
    deny("step is not armed or D1 bookmark changed since verification");
  }
  const next = journal.pending[journal.completedNames.length];
  if (!next) deny("no further reviewed migration remains");
  return {
    ...journal, phase: "in-flight", updatedAt: now,
    inFlight: { ...next!, attemptId, startedAt: now },
    incident: null
  };
}

/**
 * The caller MUST obtain the names & bookmark from a fresh D1 read AFTER the
 * SQL batch. An exact ledger match is the only acceptable completion proof.
 */
export function finishD1JournalStep(
  journal: D1MigrationJournal,
  proof: D1JournalProof,
  lease: D1Lease | null,
  result: { attemptId: string; appliedNames: string[]; bookmark: string },
  now = Date.now()
): D1MigrationJournal {
  validateJournalProof(journal, proof, lease, now);
  const active = journal.inFlight;
  if (journal.phase !== "in-flight" || !active || active.attemptId !== result?.attemptId ||
      !validBook(result.bookmark) || !Array.isArray(result.appliedNames)) {
    deny("no matching in-flight migration completion proof");
  }
  const completed = [...journal.completedNames, active.name];
  const expected = [...journal.baselineApplied, ...completed];
  if (result.appliedNames.length !== expected.length ||
      result.appliedNames.some((name, i) => name !== expected[i])) {
    deny("post-migration D1 ledger is not the exact expected prefix");
  }
  return {
    ...journal,
    completedNames: completed,
    phase: completed.length === journal.pending.length ? "completed" : "armed",
    latestBookmark: result.bookmark,
    inFlight: null, updatedAt: now, incident: null
  };
}

/**
 * Missing/failed Cloudflare acknowledgement, crashed Worker or expired lease:
 * require explicit operator reconciliation. Never schedule an automatic retry.
 */
export function flagD1JournalUncertain(
  journal: D1MigrationJournal, reason:
    "request-failed" | "ambiguous-result" | "lease-expired" | "restarted",
  now = Date.now()
): D1MigrationJournal {
  if (journal.phase !== "in-flight" || !journal.inFlight) {
    deny("no uncertain in-flight database migration exists");
  }
  return { ...journal, phase: "uncertain", updatedAt: now, incident: reason };
}

export interface D1JournalReconciliation {
  status: "applied" | "not-applied" | "conflict";
  expectedLedger: string[];
  observedLedger: string[];
  /** A recent bookmark is recorded only for review, not automated recovery. */
  observedBookmark: string;
}
export function inspectUncertainD1Journal(
  journal: D1MigrationJournal,
  observedLedger: string[],
  observedBookmark: string
): D1JournalReconciliation {
  if (journal.phase !== "uncertain" || !journal.inFlight ||
      !Array.isArray(observedLedger) || !validBook(observedBookmark)) {
    deny("reconciliation requires an uncertain step and fresh D1 evidence");
  }
  const previously = [...journal.baselineApplied, ...journal.completedNames];
  const expected = [...previously, journal.inFlight.name];
  const equals = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
  return {
    status: equals(observedLedger, expected) ? "applied" :
      equals(observedLedger, previously) ? "not-applied" : "conflict",
    expectedLedger: expected,
    observedLedger: [...observedLedger],
    observedBookmark
  };
}

/** Only a reviewed journal without any writes may be cancelled. */
export function cancelUnstartedD1Journal(
  journal: D1MigrationJournal, proof: D1JournalProof, lease: D1Lease | null,
  now = Date.now()
): D1MigrationJournal {
  validateJournalProof(journal, proof, lease, now);
  if (!["reviewed", "armed"].includes(journal.phase) ||
      journal.completedNames.length || journal.inFlight) {
    deny("a migration with completed or uncertain writes cannot be silently cancelled");
  }
  return { ...journal, phase: "cancelled", updatedAt: now };
}
