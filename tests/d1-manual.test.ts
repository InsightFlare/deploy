import { describe, expect, it, vi } from "vitest";
import { applyManualD1Migrations } from "../src/core/d1-manual";
import { planD1Migrations } from "../src/core/d1-migrations";
import type { ManualD1Transport } from "../src/core/d1-manual";
import type { ReleaseArtifact } from "../src/core/public-release";
import type { D1MigrationSnapshot } from "../src/core/d1-migrations";

const accountId = "a".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const sha = "d".repeat(40);
const sourceDigest = "e".repeat(64);
const sources = [
  { name: "0001_initial.sql", sql: "CREATE TABLE users (id TEXT);" },
  { name: "0002_add_name.sql", sql: "ALTER TABLE users ADD COLUMN name TEXT;" },
  { name: "0003_index.sql", sql: "CREATE INDEX ix_users_name ON users(name);" }
];
async function digest(sql: string): Promise<string> {
  const bytes = new TextEncoder().encode(sql);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    b => b.toString(16).padStart(2, "0")).join("");
}
async function fixture(): Promise<ReleaseArtifact> {
  const migrations = await Promise.all(sources.map(async x => ({ ...x, sha256: await digest(x.sql) })));
  return {
    release: { sha, tag:"nightly", artifactDigest:sourceDigest,
      archiveAsset:{name:"official.tar.gz",size:1,digest:"sha256:"+"a".repeat(64),
        browser_download_url:"https://github.com/RavelloH/InsightFlare"} },
    migrations,
    artifact: { pinnedSha:sha, config:{name:"insightflare", mainModule:"index.js",
      compatibilityDate:"2026-03-01",compatibilityFlags:[],migrations:[],
      observedBuildVariables:[],cronTriggers:[]}, modules:[], assets:[],
      summary:{sourceSha:sha,digest:sourceDigest,moduleCount:1,moduleBytes:1,
        assetCount:1,assetBytes:1,migrationTags:[]} },
    manifest: {schemaVersion:1,source:{repository:"RavelloH/InsightFlare",sha},
      artifactDigest:sourceDigest,config:{mainModule:"index.js",
        compatibilityDate:"2026-03-01",compatibilityFlags:[],doMigrations:[],
        bindings:{},vars:{},crons:[]},
      files:migrations.map(x=>({path:"migrations/"+x.name,
        size:new TextEncoder().encode(x.sql).byteLength,sha256:x.sha256})),
      totals:{modules:1,assets:1,migrations:3,
        bytes:migrations.reduce((a,x)=>a+new TextEncoder().encode(x.sql).byteLength,0)}}
  };
}
function harness(options: {
  initiallyApplied?: string[];
  existingTables?: boolean;
  failName?: string;
} = {}) {
  let applied: string[]|null = options.initiallyApplied ?? null;
  const events: string[] = [];
  const snapshot = vi.fn(async (): Promise<D1MigrationSnapshot> => {
    events.push("read");
    return { accountId, databaseId,
      tableNames: applied ? ["d1_migrations","users"] : options.existingTables ? ["users"] : [],
      appliedNames: applied ? [...applied] : null,
      bookmark: "" }; // No backup/bookmark prerequisite.
  });
  const applyOne = vi.fn(async (_account: string, _database: string,
    file: { name:string;sql:string;sha256:string }, createLedger:boolean) => {
    events.push("apply:"+file.name);
    expect(_account).toBe(accountId);
    expect(_database).toBe(databaseId);
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(createLedger).toBe(applied===null);
    if(file.name===options.failName) throw new Error("D1 SQL error");
    applied = [...(applied??[]),file.name];
  });
  const transport: ManualD1Transport = {
    d1MigrationSnapshot:snapshot,d1ApplyVerifiedMigration:applyOne
  };
  return { transport, events, applyOne, snapshot, applied:()=>applied };
}
async function request(release:ReleaseArtifact, transport:ManualD1Transport) {
  const preview = await planD1Migrations(release,
    await transport.d1MigrationSnapshot(accountId,databaseId));
  return { accountId,databaseId,sourceSha:sha,
    reviewedPlanDigest:preview.reviewedPlanDigest };
}

describe("Wrangler-equivalent D1 migrations (no maintenance mode or extra DO)", () => {
  it("applies pending source files sequentially and records their names", async () => {
    const release=await fixture(), h=harness();
    const req=await request(release,h.transport);
    const out=await applyManualD1Migrations(h.transport,release,req);
    expect(out).toMatchObject({
      sourceSha:sha, databaseId, applied:sources.map(x=>x.name),
      remaining:0,completed:true
    });
    expect(h.applied()).toEqual(sources.map(x=>x.name));
    expect(h.applyOne).toHaveBeenCalledTimes(3);
    const again=await applyManualD1Migrations(h.transport,release,{
      ...req, reviewedPlanDigest:out.nextReviewedPlanDigest
    });
    expect(again.applied).toEqual([]);
    expect(again.completed).toBe(true);
    expect(h.applyOne).toHaveBeenCalledTimes(3);
  });

  it("supports an installed Worker/database and non-prefix Wrangler filename history", async () => {
    const release=await fixture();
    const h=harness({ initiallyApplied:["0002_add_name.sql","9999_own.sql"],
      existingTables:true });
    const req=await request(release,h.transport);
    const out=await applyManualD1Migrations(h.transport,release,req);
    expect(out.applied).toEqual(["0001_initial.sql","0003_index.sql"]);
    expect(h.applied()).toEqual([
      "0002_add_name.sql","9999_own.sql","0001_initial.sql","0003_index.sql"
    ]);
  });

  it("limits each request and can resume from the recorded D1 history", async () => {
    const release=await fixture(), h=harness();
    const req=await request(release,h.transport);
    const first=await applyManualD1Migrations(h.transport,release,{...req,maxFiles:1});
    expect(first).toMatchObject({applied:["0001_initial.sql"],remaining:2,completed:false});
    const second=await applyManualD1Migrations(h.transport,release,{
      ...req,reviewedPlanDigest:first.nextReviewedPlanDigest,maxFiles:1
    });
    expect(second).toMatchObject({applied:["0002_add_name.sql"],remaining:1,completed:false});
    expect(h.applyOne).toHaveBeenCalledTimes(2);
  });

  it("stops at the actual SQL error, preserving earlier successful migrations", async () => {
    const release=await fixture(), h=harness({failName:"0002_add_name.sql"});
    const req=await request(release,h.transport);
    await expect(applyManualD1Migrations(h.transport,release,req))
      .rejects.toThrow("D1 SQL error");
    expect(h.applied()).toEqual(["0001_initial.sql"]);
    expect(h.applyOne).toHaveBeenCalledTimes(2);
  });

  it("refuses changed history, source or tampered SQL without issuing writes", async () => {
    const release=await fixture(), h=harness();
    const req=await request(release,h.transport);
    await expect(applyManualD1Migrations(h.transport,release,{
      ...req,reviewedPlanDigest:"0".repeat(64)
    })).rejects.toThrow("history changed");
    await expect(applyManualD1Migrations(h.transport,release,{
      ...req,sourceSha:"f".repeat(40)
    })).rejects.toThrow("official source");
    expect(h.applyOne).not.toHaveBeenCalled();
  });

  it("does not add a maintenance-window, write-gate, DO lock or Time Travel requirement", async () => {
    const release=await fixture(), h=harness({existingTables:true});
    const req=await request(release,h.transport);
    const result=await applyManualD1Migrations(h.transport,release,req);
    expect(result.completed).toBe(true);
    expect(h.snapshot).toHaveBeenCalled();
    expect(h.applyOne).toHaveBeenCalledTimes(3);
  });
});
