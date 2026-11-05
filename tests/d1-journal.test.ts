import { describe, expect, it } from "vitest";
import {
  newD1MigrationJournal, assertCanKeepJournal, armNewInstallJournal,
  beginD1JournalStep, finishD1JournalStep, flagD1JournalUncertain,
  inspectUncertainD1Journal, cancelUnstartedD1Journal, safeD1JournalStatus
} from "../src/core/d1-journal";
import type { ReviewedD1MigrationPlan } from "../src/core/d1-migrations";
import type { D1Lease, D1LeaseProof } from "../src/core/d1-lease";

const accountId = "a".repeat(32);
const databaseId = "a799b813-2fc0-42e6-8a43-ac84660227e2";
const ownerId = "b".repeat(32);
const runId = "87e5883d-5ac2-4c3a-a01d-af3096594f30";
const sourceSha = "c".repeat(40);
const digest = "d".repeat(64);
const planDigest = "e".repeat(64);
const leaseId = "1c679c3b-8fbb-4d8f-8715-02b73d99d49f";
const at = 1_800_000_000_000;
const first = { name: "0001_initial.sql", sha256: "1".repeat(64), sqlBytes: 100, destructive: false, warnings: [] };
const second = { name: "0002_rename.sql", sha256: "2".repeat(64), sqlBytes: 200, destructive: true, warnings: ["changes existing table schema"] };
const plan = (initialInstall = true): ReviewedD1MigrationPlan => ({
  sourceSha, artifactDigest: digest, accountId, databaseId, bookmark: "original-recovery-bookmark",
  appliedNames: initialInstall ? [] : ["0000_old.sql"],
  pending: [first, second], initialInstall, destructiveUpgrade: !initialInstall,
  needsConfirmation: true, reviewedPlanDigest: planDigest
});
const proof = (): D1LeaseProof & { accountId: string; databaseId: string } =>
  ({ leaseId, ownerId, runId, sourceSha, reviewedPlanDigest: planDigest,
    accountId, databaseId });
const lease = (): D1Lease => ({
  ...proof(), acquiredAt: at, expiresAt: at + 5 * 60_000
});
const safe = (now = at) => ({
  accountId, databaseId, workerAbsent: true as const, databaseEmpty: true as const,
  consentConfirmed: true as const, verifiedAt: now
});
const attempt = "5cc47fd0-1486-40d1-8725-e9d605633128";

describe("durable D1 migration journal (pure state machine)", () => {
  it("creates a nonexecutable immutable reviewed journal with a preserved recovery bookmark", () => {
    const journal = newD1MigrationJournal(plan(), proof(), lease(), at);
    expect(journal).toMatchObject({
      phase: "reviewed", executionEnabled: false, recoveryBookmark: "original-recovery-bookmark",
      latestBookmark: "original-recovery-bookmark", completedNames: [], inFlight: null
    });
    expect(journal.pending.map(x => x.name)).toEqual(["0001_initial.sql", "0002_rename.sql"]);
    expect(assertCanKeepJournal(journal, { ...journal })).toBe(journal);
    expect(() => assertCanKeepJournal(journal, { ...journal, runId: crypto.randomUUID() })).toThrow("different durable");
    expect(() => assertCanKeepJournal(journal, { ...journal, reviewedPlanDigest: "3".repeat(64) })).toThrow();
  });

  it("rejects every unauthenticated or mismatched review and lease", () => {
    expect(() => newD1MigrationJournal(plan(), { ...proof(), ownerId: "f".repeat(32) }, lease(), at)).toThrow();
    expect(() => newD1MigrationJournal(plan(), proof(), { ...lease(), reviewedPlanDigest: "0".repeat(64) }, at)).toThrow();
    expect(() => newD1MigrationJournal(plan(), proof(), { ...lease(), expiresAt: at }, at)).toThrow();
    expect(() => newD1MigrationJournal({ ...plan(), pending: [first, first] }, proof(), lease(), at)).toThrow();
  });

  it("can arm only a fresh consented, empty, workerless installation", () => {
    const journal = newD1MigrationJournal(plan(), proof(), lease(), at);
    expect(() => armNewInstallJournal(journal, proof(), lease(), { ...safe(), workerAbsent: false as never }, at)).toThrow();
    expect(() => armNewInstallJournal(journal, proof(), lease(), { ...safe(), consentConfirmed: false as never }, at)).toThrow();
    expect(() => armNewInstallJournal(journal, proof(), lease(), safe(at - 31_000), at)).toThrow();
    expect(armNewInstallJournal(journal, proof(), lease(), safe(), at).phase).toBe("armed");
    const upgrade = newD1MigrationJournal(plan(false), proof(), lease(), at);
    expect(() => armNewInstallJournal(upgrade, proof(), lease(), safe(), at)).toThrow("not independently");
  });

  it("writes a journal reservation before the remote D1 call, verifies each exact ledger, and preserves bookmarks", () => {
    const start = armNewInstallJournal(newD1MigrationJournal(plan(), proof(), lease(), at),
      proof(), lease(), safe(), at);
    const one = beginD1JournalStep(start, proof(), lease(), start.latestBookmark, attempt, at + 1);
    expect(one).toMatchObject({ phase: "in-flight", completedNames: [],
      inFlight: { name: first.name, sha256: first.sha256, attemptId: attempt } });
    expect(() => beginD1JournalStep(one, proof(), lease(), one.latestBookmark, crypto.randomUUID(), at + 2)).toThrow();
    expect(() => finishD1JournalStep(one, proof(), lease(),
      { attemptId: attempt, appliedNames: [], bookmark: "bookmark-after-step-one" }, at + 3)).toThrow("ledger");
    const afterOne = finishD1JournalStep(one, proof(), lease(),
      { attemptId: attempt, appliedNames: [first.name], bookmark: "bookmark-after-step-one" }, at + 3);
    expect(afterOne).toMatchObject({ phase: "armed", completedNames: [first.name],
      recoveryBookmark: "original-recovery-bookmark", latestBookmark: "bookmark-after-step-one" });
    expect(() => beginD1JournalStep(afterOne, proof(), lease(),
      "original-recovery-bookmark", crypto.randomUUID(), at + 4)).toThrow("bookmark changed");

    const nextAttempt = "fa57e3ae-7580-4695-bb28-f9fce01adb8e";
    const two = beginD1JournalStep(afterOne, proof(), lease(),
      "bookmark-after-step-one", nextAttempt, at + 5);
    const finished = finishD1JournalStep(two, proof(), lease(),
      { attemptId: nextAttempt, appliedNames: [first.name, second.name],
        bookmark: "bookmark-after-step-two" }, at + 6);
    expect(finished.phase).toBe("completed");
    expect(finished.completedNames).toEqual([first.name, second.name]);
    expect(finished.executionEnabled).toBe(false);
    expect(() => beginD1JournalStep(finished, proof(), lease(),
      finished.latestBookmark, crypto.randomUUID(), at + 7)).toThrow();
  });

  it("marks transport timeout or Worker crash as uncertain and never implicitly retries", () => {
    const armed = armNewInstallJournal(newD1MigrationJournal(plan(), proof(), lease(), at),
      proof(), lease(), safe(), at);
    const running = beginD1JournalStep(armed, proof(), lease(),
      armed.latestBookmark, attempt, at + 1);
    const uncertain = flagD1JournalUncertain(running, "request-failed", at + 2);
    expect(uncertain).toMatchObject({
      phase: "uncertain", incident: "request-failed",
      inFlight: { attemptId: attempt, name: first.name }
    });
    expect(() => beginD1JournalStep(uncertain, proof(), lease(),
      uncertain.latestBookmark, crypto.randomUUID(), at + 3)).toThrow();
    expect(inspectUncertainD1Journal(uncertain, [first.name], "after")).toMatchObject({ status: "applied" });
    expect(inspectUncertainD1Journal(uncertain, [], "unchanged")).toMatchObject({ status: "not-applied" });
    expect(inspectUncertainD1Journal(uncertain, ["9999_rogue.sql"], "unknown")).toMatchObject({ status: "conflict" });
    expect(uncertain.phase).toBe("uncertain");
  });

  it("allows cancel only before any D1 write; completed/uncertain writes are irreversible from this journal", () => {
    const journal = newD1MigrationJournal(plan(), proof(), lease(), at);
    expect(cancelUnstartedD1Journal(journal, proof(), lease(), at).phase).toBe("cancelled");
    const armed = armNewInstallJournal(journal, proof(), lease(), safe(), at);
    const running = beginD1JournalStep(armed, proof(), lease(),
      armed.latestBookmark, attempt, at + 1);
    expect(() => cancelUnstartedD1Journal(running, proof(), lease(), at + 2)).toThrow();
    expect(() => cancelUnstartedD1Journal(flagD1JournalUncertain(running, "restarted", at + 2),
      proof(), lease(), at + 3)).toThrow();
  });
});

describe("browser-safe migration status", () => {
  it("redacts all owner, run, plan and recovery bookmark secrets", () => {
    const journal = newD1MigrationJournal(plan(), proof(), lease(), at);
    const safe = safeD1JournalStatus(journal);
    expect(safe).toMatchObject({
      phase: "reviewed", sourceSha, total: 2, appliedBefore: 0,
      appliedByDeploy: 0, remaining: 2, recoveryBookmarkAvailable: true,
      executionAvailable: false
    });
    const serialized = JSON.stringify(safe);
    for (const excluded of [ownerId, runId, databaseId,
      "original-recovery-bookmark", planDigest, digest]) {
      expect(serialized).not.toContain(excluded);
    }
  });
});
