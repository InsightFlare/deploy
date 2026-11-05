import { describe, expect, it, vi } from "vitest";
import { hashArtifactContents } from "../src/core/stage-artifact";
import { previewVersionUpgrade, activateStagedUpgrade, findVerifiedStagedCandidates, type UpgradeVersionClient, type CandidateVersionClient } from "../src/core/upgrade-versions";
import type { Deployment } from "../src/core/plan";
import type { ReleaseArtifact } from "../src/core/public-release";
import type { WorkerVersion } from "../src/providers/cloudflare/client";

const accountId="a".repeat(32);
const databaseId="8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const sourceSha="d".repeat(40);
const original="023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const candidate="123e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const deployment="223e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const encoded=new TextEncoder();

async function hash(data:string):Promise<string>{
  const bits=new Uint8Array(await crypto.subtle.digest("SHA-256",encoded.encode(data)));
  return Array.from(bits,v=>v.toString(16).padStart(2,"0")).join("");
}
async function fixture():Promise<ReleaseArtifact>{
  const module=encoded.encode("export default {async fetch(){return new Response('ok')}}");
  const asset=encoded.encode("<html>hello</html>");
  const pack={
    pinnedSha:sourceSha,
    config:{ name:"insightflare",mainModule:"index.js",compatibilityDate:"2026-03-01",
      compatibilityFlags:["nodejs_compat"],observedBuildVariables:[],cronTriggers:[],
      migrations:[{tag:"v1",new_sqlite_classes:["IngestDurableObject"]},
        {tag:"v2",new_classes:["AuxClass"]}]},
    modules:[{name:"index.js",contentType:"application/javascript+module",content:module}],
    assets:[{path:"index.html",contentType:"text/html",content:asset}],
    summary:{sourceSha,digest:"",moduleCount:1,moduleBytes:module.length,
      assetCount:1,assetBytes:asset.length,migrationTags:["v1","v2"]}
  };
  pack.summary.digest=await hashArtifactContents(pack);
  const sql="CREATE TABLE users (id TEXT PRIMARY KEY);";
  const checksum=await hash(sql);
  const migrations=[{name:"0001_initial.sql",sql,sha256:checksum}];
  return {
    release:{sha:sourceSha,tag:"nightly",artifactDigest:pack.summary.digest,
      archiveAsset:{name:"nightly.tar.gz",size:1,digest:"sha256:"+"b".repeat(64),
        browser_download_url:"https://github.com/RavelloH/InsightFlare"}},
    artifact:pack,migrations,
    manifest:{schemaVersion:1,source:{repository:"RavelloH/InsightFlare",sha:sourceSha},
      artifactDigest:pack.summary.digest,
      config:{mainModule:"index.js",compatibilityDate:"2026-03-01",
        compatibilityFlags:["nodejs_compat"],doMigrations:[],bindings:{},vars:{},crons:[]},
      totals:{modules:1,assets:1,migrations:1,bytes:sql.length},
      files:[{path:"migrations/0001_initial.sql",sha256:checksum,size:sql.length}]
    }
  };
}
function observed(kind:"managed"|"legacy-candidate"="managed"):Deployment {
  return {kind,accountId,workerName:"insightflare",deployedSha:kind==="managed"?sourceSha:null,
    bindings:{database:true,kv:true,ingest:true},issues:[]};
}
function versions(options:{
  pendingD1?:boolean;drift?:boolean;badTag?:boolean;badBinding?:boolean;
}={}){
  const oldBindings=[
    {name:"DB",type:"d1",database_id:databaseId},
    {name:"SITE_SETTINGS_KV",type:"kv_namespace",namespace_id:"b".repeat(32)},
    {name:"INGEST_DO",type:"durable_object_namespace",class_name:"IngestDurableObject"},
    {name:"ASSETS",type:"assets"},
    {name:"DAILY_SALT_SECRET",type:"secret_text"},
    {name:"DASHBOARD_SESSION_SECRET",type:"secret_text"}
  ];
  const old:WorkerVersion={id:original,migration_tag:"v1",bindings:oldBindings};
  const staged:WorkerVersion={id:candidate,migration_tag:"v2",
    annotations:{"workers/tag":options.badTag?"e".repeat(40):sourceSha},
    bindings:[
      ...oldBindings.map(binding=>binding.name==="DB" && options.badBinding
        ? {...binding,database_id:"1".repeat(36)}:binding),
      {name:"INSIGHTFLARE_DEPLOYMENT_SHA",type:"plain_text",text:sourceSha}
    ]};
  const calls:string[]=[];
  const client={
    requireAccount:vi.fn(async(id:string)=>{calls.push("account");if(id!==accountId)throw Error("unauthorized");}),
    workerDeployments:vi.fn(async()=>{calls.push("deployments");return [{id:deployment,
      versions:[{version_id:options.drift?candidate:original,percentage:100}]}];}),
    workerVersionDetails:vi.fn(async(_account:string,_name:string,id:string)=>{
      calls.push("version:"+id);return id===original?old:staged;
    }),
    workerVersions:vi.fn(async()=>[staged,old]),
    d1MigrationSnapshot:vi.fn(async()=>{
      calls.push("d1-ledger");
      return {accountId,databaseId,tableNames:["d1_migrations","users"],
        appliedNames:options.pendingD1?[]:["0001_initial.sql"],bookmark:""};
    }),
    uploadWorkerAssets:vi.fn(async()=>{calls.push("upload-assets");return "assets-jwt";}),
    uploadWorkerVersion:vi.fn(async()=>{calls.push("upload-version");return {id:candidate};}),
    createWorkerDeployment:vi.fn(async(_a:string,_b:string,id:string,message:string)=>{
      calls.push("activate:"+id);
      expect(message).toContain(sourceSha);
      return {id:deployment,strategy:"percentage" as const,
        versions:[{version_id:id,percentage:100}]};
    })
  } satisfies UpgradeVersionClient & CandidateVersionClient;
  return {client,calls,old,staged};
}
async function request(release:ReleaseArtifact){
  return {sourceSha,artifactDigest:release.manifest.artifactDigest,
    expectedActiveVersionId:original,stagedVersionId:candidate,
    approved:true,legacyAdoptionReviewed:true};
}

describe("existing InsightFlare Worker versions; no maintenance DO or forced downtime",()=>{
  it("previews the current active Worker and forward-only DO migrations without secret values",async()=>{
    const release=await fixture(),c=versions();
    const preview=await previewVersionUpgrade(c.client,accountId,observed(),release);
    expect(preview).toMatchObject({
      sourceSha,expectedActiveVersionId:original,databaseId,
      activeMigrationTag:"v1",targetMigrationTag:"v2",
      requiresDoMigration:true,existingBindingsPreserved:6,
      legacyAdoptionRequired:false,stageAvailable:true
    });
    expect(JSON.stringify(preview)).not.toContain("DASHBOARD_SESSION_SECRET");
    expect(c.calls).not.toContain("upload-version");
  });

  it("recovers a verified inactive upload from Cloudflare version history after refresh",async()=>{
    const release=await fixture(),c=versions();
    c.staged.annotations!["workers/message"]=
      "InsightFlare Deploy | "+sourceSha+" | Reviewed artifact "+
      release.manifest.artifactDigest.slice(0,16);
    const found=await findVerifiedStagedCandidates(c.client,accountId,observed(),release);
    expect(found).toMatchObject([{
      stagedVersionId:candidate,sourceSha,artifactDigest:release.manifest.artifactDigest,
      expectedActiveVersionId:original
    }]);
    expect(c.client.uploadWorkerVersion).not.toHaveBeenCalled();
    c.staged.annotations!["workers/message"]="Unverified upload";
    expect(await findVerifiedStagedCandidates(c.client,accountId,observed(),release))
      .toEqual([]);
  });

  it("activates an exact staged Worker after matching D1 ledger; preserves existing bindings",async()=>{
    const release=await fixture(),c=versions();
    const output=await activateStagedUpgrade(c.client,accountId,observed(),release,await request(release));
    expect(output).toMatchObject({deploymentId:deployment,
      previousActiveVersionId:original,activatedVersionId:candidate,
      databaseMigrationsCurrent:true});
    expect(c.calls).toContain("d1-ledger");
    expect(c.calls.at(-1)).toBe("activate:"+candidate);
    expect(c.client.createWorkerDeployment).toHaveBeenCalledTimes(1);
    expect(c.client.uploadWorkerVersion).not.toHaveBeenCalled();
  });

  it("rejects pending manual D1 migration before activating Worker",async()=>{
    const release=await fixture(),c=versions({pendingD1:true});
    await expect(activateStagedUpgrade(c.client,accountId,observed(),release,await request(release)))
      .rejects.toThrow("current D1 migrations");
    expect(c.client.createWorkerDeployment).not.toHaveBeenCalled();
  });

  it("does not activate when the deployed Worker moved since the stage review",async()=>{
    const release=await fixture(),c=versions({drift:true});
    await expect(activateStagedUpgrade(c.client,accountId,observed(),release,await request(release)))
      .rejects.toThrow("currently deployed Worker version changed");
    expect(c.client.d1MigrationSnapshot).not.toHaveBeenCalled();
    expect(c.client.createWorkerDeployment).not.toHaveBeenCalled();
  });

  it("does not activate a staged version with a different SHA or modified D1 binding",async()=>{
    const release=await fixture();
    for(const opts of [{badTag:true},{badBinding:true}]){
      const c=versions(opts);
      await expect(activateStagedUpgrade(c.client,accountId,observed(),release,await request(release)))
        .rejects.toThrow();
      expect(c.client.createWorkerDeployment).not.toHaveBeenCalled();
    }
  });

  it("requires explicit approval to adopt legacy Workers and a matching reviewed Nightly",async()=>{
    const release=await fixture(),c=versions();
    const req=await request(release);
    await expect(activateStagedUpgrade(c.client,accountId,observed("legacy-candidate"),release,{
      ...req,legacyAdoptionReviewed:false
    })).rejects.toThrow("legacy");
    await expect(activateStagedUpgrade(c.client,accountId,observed(),release,{
      ...req,approved:false
    })).rejects.toThrow("explicit approval");
    await expect(activateStagedUpgrade(c.client,accountId,observed(),release,{
      ...req,sourceSha:"f".repeat(40)
    })).rejects.toThrow();
    expect(c.client.createWorkerDeployment).not.toHaveBeenCalled();
  });
});
