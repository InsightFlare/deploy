import { describe, expect, it, vi } from "vitest";
import { inspectD1MigrationPreview } from "../src/core/d1-preview";
import type { D1MigrationSnapshot } from "../src/core/d1-migrations";
import type { ReleaseArtifact } from "../src/core/public-release";
import type { Deployment } from "../src/core/plan";

const accountId = "a".repeat(32);
const databaseId = "e911e3ad-1122-4a4a-8cb3-fc09911073af";
const sha = "d".repeat(40);
const artifactDigest = "c".repeat(64);
const sql = "CREATE TABLE users (id TEXT PRIMARY KEY)";
async function fixture(): Promise<ReleaseArtifact> {
  const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(sql)))].map(n => n.toString(16).padStart(2,"0")).join("");
  return {
    release: {sha, artifactDigest, tag:"nightly", archiveAsset:{name:"x.tar.gz",
      size:1,digest:"sha256:"+"a".repeat(64),browser_download_url:"https://github.com"}},
    migrations:[{name:"0001_initial.sql",sql,sha256}],
    artifact:{pinnedSha:sha,config:{name:"insightflare",mainModule:"index.js",
      compatibilityDate:"2026-03-01",compatibilityFlags:[],migrations:[],
      observedBuildVariables:[],cronTriggers:[]},modules:[],assets:[],
      summary:{sourceSha:sha,digest:artifactDigest,moduleCount:1,moduleBytes:0,assetCount:1,assetBytes:0,migrationTags:[]}},
    manifest:{schemaVersion:1,source:{repository:"RavelloH/InsightFlare",sha},
      artifactDigest,config:{mainModule:"index.js",compatibilityDate:"2026-03-01",
        compatibilityFlags:[],doMigrations:[],bindings:{},vars:{},crons:[]},
      totals:{modules:1,assets:1,migrations:1,bytes:sql.length},
      files:[{path:"migrations/0001_initial.sql",size:sql.length,sha256}]}
  };
}
const observed = (kind: Deployment["kind"]): Deployment => ({
  accountId,kind,workerName:"insightflare",deployedSha:kind==="managed"?sha:null,
  bindings:{database:kind!=="not-installed",kv:true,ingest:true},issues:[]
});
function reader(snapshot: Partial<D1MigrationSnapshot> = {},
                boundId: string | null = databaseId) {
  return {
    settings: vi.fn(async () => boundId === null ? [] : [{
      name:"DB",type:"d1",database_id:boundId
    }]),
    d1MigrationSnapshot: vi.fn(async () => ({
      accountId,databaseId,tableNames:[],appliedNames:null,bookmark:"bookmark-for-review",
      ...snapshot
    }))
  };
}

describe("safe D1 migration preview, no database writes", () => {
  it("previews first installation with only verified SQL metadata and no bookmark leak", async () => {
    const cloudflare = reader();
    const result = await inspectD1MigrationPreview(cloudflare,observed("not-installed"),
      databaseId,await fixture());
    expect(result).toMatchObject({
      sourceSha:sha,databaseId,totalMigrations:1,appliedMigrations:0,
      pendingMigrations:1,initialInstall:true,recoveryBookmarkAvailable:true,
      executionAvailable:false
    });
    expect(result.pending[0]?.name).toBe("0001_initial.sql");
    expect(JSON.stringify(result)).not.toContain(sql);
    expect(JSON.stringify(result)).not.toContain("bookmark-for-review");
    expect(cloudflare.settings).not.toHaveBeenCalled();
    expect(cloudflare.d1MigrationSnapshot).toHaveBeenCalledWith(accountId,databaseId);
  });

  it("reports zero pending for an up-to-date managed Worker with matching DB", async () => {
    const cloudflare = reader({tableNames:["d1_migrations","users"],appliedNames:["0001_initial.sql"]});
    const result = await inspectD1MigrationPreview(cloudflare,observed("managed"),
      databaseId,await fixture());
    expect(result.pendingMigrations).toBe(0);
    expect(result.needsConfirmation).toBe(false);
    expect(cloudflare.settings).toHaveBeenCalledTimes(1);
  });

  it("refuses mismatched selected D1 for existing Worker, even if accessible in same account", async () => {
    const cloudflare = reader({}, "a".repeat(8)+"-"+ "a".repeat(4)+"-"+ "a".repeat(4)+"-"+ "a".repeat(4)+"-"+ "a".repeat(12));
    await expect(inspectD1MigrationPreview(cloudflare,observed("managed"),
      databaseId,await fixture())).rejects.toThrow("does not match");
    expect(cloudflare.d1MigrationSnapshot).not.toHaveBeenCalled();
  });

  it("blocks unknown Worker identity or missing binding before reading any D1 data", async () => {
    const cloudflare = reader({},null);
    await expect(inspectD1MigrationPreview(cloudflare,observed("conflict"),
      databaseId,await fixture())).rejects.toThrow("Unknown Worker");
    await expect(inspectD1MigrationPreview(cloudflare,observed("legacy-candidate"),
      databaseId,await fixture())).rejects.toThrow("does not match");
    expect(cloudflare.d1MigrationSnapshot).not.toHaveBeenCalled();
  });

  it("requires writer quiescence for ANY pending update, including additive SQL", async () => {
    const cloudflare = reader({ tableNames:["d1_migrations","users"], appliedNames:[] });
    const result = await inspectD1MigrationPreview(cloudflare,observed("managed"),
      databaseId,await fixture());
    expect(result.pendingMigrations).toBe(1);
    expect(result.destructiveUpgrade).toBe(false);
    expect(result.maintenanceRequired).toBe(true);
    expect(result.maintenanceVerified).toBe(false);
    expect(result.maintenanceWriteSources).toHaveLength(4);
    expect(result.blockers.some(item => item.includes("writers are not quiesced"))).toBe(true);
    expect(result.executionAvailable).toBe(false);
  });

  it("marks legacy instance for explicit adoption without enabling migration execution", async () => {
    const result = await inspectD1MigrationPreview(reader(),observed("legacy-candidate"),
      databaseId,await fixture());
    expect(result.blockers).toContain("Legacy Worker adoption requires explicit review before migration or promotion.");
    expect(result.executionAvailable).toBe(false);
  });

  it("refuses malformed database identifiers before network access", async () => {
    const cloudflare = reader();
    await expect(inspectD1MigrationPreview(cloudflare,observed("not-installed"),
      "../users",await fixture())).rejects.toThrow("Invalid Cloudflare");
    expect(cloudflare.d1MigrationSnapshot).not.toHaveBeenCalled();
  });
});
