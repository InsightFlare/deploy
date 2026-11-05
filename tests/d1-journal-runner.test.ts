import { describe, expect, it, vi } from "vitest";
import { executeJournaledD1MigrationStep } from "../src/core/d1-journal-runner";
import type { DurableD1JournalGateway } from "../src/core/d1-journal-runner";
import {
  newD1MigrationJournal, armNewInstallJournal,
  beginD1JournalStep, finishD1JournalStep,
  flagD1JournalUncertain, inspectUncertainD1Journal
} from "../src/core/d1-journal";
import type { D1MigrationJournal } from "../src/core/d1-journal";
import type { D1MigrationTransport } from "../src/core/d1-migration-runner";
import type { ReleaseArtifact } from "../src/core/public-release";
import type { ReviewedD1MigrationPlan } from "../src/core/d1-migrations";
import type { D1Lease } from "../src/core/d1-lease";

const accountId = "a".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const ownerId = "b".repeat(32);
const runId = "584c45c2-1bf2-4a35-b5ee-66db69700c29";
const sourceSha = "c".repeat(40);
const artifactDigest = "d".repeat(64);
const reviewedPlanDigest = "e".repeat(64);
const bookmark = "000000c1-initial-bookmark";
const sql = ["CREATE TABLE one (id TEXT);", "CREATE TABLE two (id TEXT);"];
async function fixture(): Promise<{
  release: ReleaseArtifact; journal: D1MigrationJournal; lease: D1Lease
}> {
  const steps = await Promise.all(sql.map(async (source, index) => ({
    name: index === 0 ? "0001_initial.sql" : "0002_extra.sql",
    sql: source,
    sha256: Array.from(new Uint8Array(await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(source))), x => x.toString(16).padStart(2, "0")).join("")
  })));
  const plan: ReviewedD1MigrationPlan = {
    accountId, databaseId, sourceSha, artifactDigest, bookmark, reviewedPlanDigest,
    appliedNames: [], initialInstall: true, destructiveUpgrade: false, needsConfirmation: true,
    pending: steps.map(step => ({ name: step.name, sha256: step.sha256, sqlBytes: step.sql.length,
      destructive: false, warnings: [] }))
  };
  const release: ReleaseArtifact = {
    release: { sha: sourceSha, artifactDigest, tag: "nightly",
      archiveAsset: {name:"official.tar.gz", size: 1, digest:"sha256:" + "f".repeat(64),
        browser_download_url: "https://github.com/RavelloH/InsightFlare" } },
    migrations: steps,
    artifact: {pinnedSha:sourceSha,
      config: {name:"insightflare",mainModule:"index.js",compatibilityDate:"2026-03-01",
        compatibilityFlags:[],migrations:[],observedBuildVariables:[],cronTriggers:[]},
      modules:[],assets:[], summary: {sourceSha,digest:artifactDigest,
        moduleCount:1,moduleBytes:1,assetCount:1,assetBytes:1,migrationTags:[]}},
    manifest: {schemaVersion:1,source:{repository:"RavelloH/InsightFlare",sha:sourceSha},
      artifactDigest,config:{mainModule:"index.js",compatibilityDate:"2026-03-01",
        compatibilityFlags:[],doMigrations:[],bindings:{},vars:{},crons:[]},
      totals:{modules:1,assets:1,migrations:2,bytes:sql.join("").length},
      files:steps.map(x=>({path:"migrations/"+x.name,size:x.sql.length,sha256:x.sha256}))}
  };
  const now = Date.now();
  const lease: D1Lease = {
    accountId,databaseId,sourceSha,ownerId,runId,reviewedPlanDigest,
    leaseId:"19ea4a65-c3a8-4332-953d-f33559189010",
    acquiredAt: now-10_000, expiresAt: now+290_000
  };
  const proof = { ...lease };
  const journal = armNewInstallJournal(newD1MigrationJournal(plan,proof,lease,now),
    proof,lease,{accountId,databaseId,workerAbsent:true,databaseEmpty:true,
      consentConfirmed:true,verifiedAt:now},now);
  return {release,journal,lease};
}
function makeHarness(initial: D1MigrationJournal, lease: D1Lease, opts: {
  failAfterWrite?: boolean;
  fakeLedger?: boolean;
  loseLeaseAfterWrite?: boolean;
} = {}) {
  const ref = { journal: initial, snapshot: { accountId,databaseId,
    tableNames: [] as string[], appliedNames: null as string[]|null,
    bookmark } };
  const calls: string[] = [];
  let lock = true;
  const adapter: D1MigrationTransport = {
    snapshot: vi.fn(async () => {
      calls.push("snapshot");
      return { ...ref.snapshot, tableNames: [...ref.snapshot.tableNames],
        appliedNames: ref.snapshot.appliedNames && [...ref.snapshot.appliedNames] };
    }),
    applyOne: vi.fn(async (_a,_b,step,createLedger) => {
      calls.push("d1-write");
      expect(step.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(step.name).toBe(ref.journal.pending[ref.journal.completedNames.length]?.name);
      if (ref.snapshot.appliedNames === null) {
        expect(createLedger).toBe(true);
        ref.snapshot.appliedNames = [];
        ref.snapshot.tableNames = ["d1_migrations"];
      } else expect(createLedger).toBe(false);
      if (!opts.fakeLedger) ref.snapshot.appliedNames.push(step.name);
      ref.snapshot.bookmark = "bookmark-after-" + step.name;
      if (opts.loseLeaseAfterWrite) lock = false;
      if (opts.failAfterWrite) throw Error("synthetic ambiguous HTTP timeout");
    })
  };
  const gateway: DurableD1JournalGateway = {
    reserve: vi.fn(async (checkedBookmark, attemptId) => {
      calls.push("reserve");
      ref.journal = beginD1JournalStep(ref.journal,lease,lease,checkedBookmark,attemptId);
      return ref.journal;
    }),
    confirm: vi.fn(async (attemptId,appliedNames,newBookmark) => {
      calls.push("confirm");
      ref.journal = finishD1JournalStep(ref.journal,lease,lease,
        {attemptId,appliedNames,bookmark:newBookmark});
      return ref.journal;
    }),
    uncertain: vi.fn(async (attemptId,reason) => {
      calls.push("uncertain");
      expect(ref.journal.inFlight?.attemptId).toBe(attemptId);
      ref.journal = flagD1JournalUncertain(ref.journal,reason);
    })
  };
  const currentLease = { accountId,databaseId,sourceSha,
    assertCurrent: vi.fn(async () => lock) };
  const approval = {accountId,databaseId,sourceSha,reviewedPlanDigest,
    approvalGranted:true,maintenanceWindowConfirmed:false};
  return { ref,calls,adapter,gateway,currentLease,approval };
}

describe("private, journaled migration step executor (mock Cloudflare network)", () => {
  it("executes two ordered SQL files using original approval, updated bookmark and durable checkpoints", async () => {
    const {release,journal,lease} = await fixture();
    const h = makeHarness(journal,lease);
    const first = await executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway);
    expect(first).toMatchObject({completedName:"0001_initial.sql",
      confirmedCompleted:1,totalMigrationSteps:2,completed:false,canPromote:false,
      recoveryBookmark:bookmark});
    expect(h.calls).toEqual(["snapshot","reserve","d1-write","snapshot","confirm"]);
    const second = await executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway);
    expect(second).toMatchObject({completedName:"0002_extra.sql",
      confirmedCompleted:2,totalMigrationSteps:2,completed:true,canPromote:false});
    expect(h.ref.journal.phase).toBe("completed");
    expect(h.adapter.applyOne).toHaveBeenCalledTimes(2);
    expect(h.ref.journal.recoveryBookmark).toBe(bookmark);
  });

  it("rejects a stale bookmarked database BEFORE any write-ahead reservation", async () => {
    const {release,journal,lease} = await fixture();
    const h = makeHarness(journal,lease);
    h.ref.snapshot.bookmark = "book-changed-by-other-writer";
    await expect(executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway)).rejects.toThrow("changed");
    expect(h.gateway.reserve).not.toHaveBeenCalled();
    expect(h.adapter.applyOne).not.toHaveBeenCalled();
  });

  it("keeps an ambiguous successful SQL write uncertain instead of replaying it", async () => {
    const {release,journal,lease} = await fixture();
    const h = makeHarness(journal,lease,{failAfterWrite:true});
    await expect(executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway))
      .rejects.toThrow("synthetic ambiguous");
    expect(h.ref.journal).toMatchObject({phase:"uncertain",incident:"request-failed"});
    expect(inspectUncertainD1Journal(h.ref.journal,
      ["0001_initial.sql"],h.ref.snapshot.bookmark).status).toBe("applied");
    await expect(executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway)).rejects.toThrow("review");
    expect(h.adapter.applyOne).toHaveBeenCalledTimes(1);
  });

  it("marks the operation uncertain if ledger verification fails after D1 write", async () => {
    const {release,journal,lease} = await fixture();
    const h = makeHarness(journal,lease,{fakeLedger:true});
    await expect(executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway)).rejects.toThrow("ambiguous");
    expect(h.ref.journal.phase).toBe("uncertain");
    expect(h.gateway.confirm).not.toHaveBeenCalled();
  });

  it("requires active lease before and after a remote SQL call", async () => {
    const {release,journal,lease} = await fixture();
    const h = makeHarness(journal,lease,{loseLeaseAfterWrite:true});
    await expect(executeJournaledD1MigrationStep(
      release,h.ref.journal,h.approval,h.currentLease,h.adapter,h.gateway)).rejects.toThrow("expired");
    expect(h.gateway.confirm).not.toHaveBeenCalled();
    expect(h.ref.journal.phase).toBe("uncertain");
  });

  it("rejects changed official source, mismatched user approval or inactive old Worker upgrades", async () => {
    const {release,journal,lease} = await fixture();
    const h = makeHarness(journal,lease);
    await expect(executeJournaledD1MigrationStep(
      {...release,release:{...release.release,sha:"0".repeat(40)}},
      journal,h.approval,h.currentLease,h.adapter,h.gateway)).rejects.toThrow("Nightly provenance");
    await expect(executeJournaledD1MigrationStep(
      release,journal,{...h.approval,approvalGranted:false},
      h.currentLease,h.adapter,h.gateway)).rejects.toThrow("approval");
    await expect(executeJournaledD1MigrationStep(
      release,{...journal,initialInstall:false,destructiveUpgrade:true},
      h.approval,h.currentLease,h.adapter,h.gateway)).rejects.toThrow("new-install");
    expect(h.adapter.applyOne).not.toHaveBeenCalled();
  });
});
