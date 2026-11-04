import { describe, expect, it, vi } from "vitest";
import { packBuild } from "../scripts/pack-build.mjs";
import { hashArtifactContents, stageReviewedUpgrade } from "../src/core/stage-artifact";
import type { WorkerBinding, WorkerVersion, WorkerVersionUpload } from "../src/providers/cloudflare/client";

const root = process.env.INSIGHTFLARE_SOURCE_BUILD;
const sha = process.env.INSIGHTFLARE_SOURCE_SHA;
const digest = "aaf66a7329fc23678e618c262fabae29ffb5454d95b6ceba299e2545200897e5";
const activeId = "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const stagedId = "123e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const accountId = "a".repeat(32);

describe.skipIf(!root || !sha)("real, independently compiled upstream artifact to staging request (offline)", () => {
  it("recomputes all 627 module/asset hashes and simulates a non-promoting legacy upgrade", async () => {
    const pack = await packBuild({ root: root!, sha: sha! });
    expect(pack.summary.sourceSha).toBe(sha);
    expect(pack.summary.moduleCount).toBe(318);
    expect(pack.summary.assetCount).toBe(309);
    expect(pack.summary.digest).toBe(digest);
    expect(await hashArtifactContents(pack)).toBe(digest);
    const sourceBindings: WorkerBinding[] = [
      { name: "ASSETS", type: "assets" },
      { name: "DB", type: "d1", database_id: "database-old" },
      { name: "SITE_SETTINGS_KV", type: "kv_namespace", namespace_id: "b".repeat(32) },
      { name: "INGEST_DO", type: "durable_object_namespace", class_name: "IngestDurableObject" },
      { name: "DAILY_SALT_SECRET", type: "secret_text" },
      { name: "BOOTSTRAP_ADMIN_PASSWORD", type: "secret_text" }
    ];
    const active: WorkerVersion = { id: activeId, migration_tag: "v1", bindings: sourceBindings };
    const reads: string[] = [];
    const client = {
      requireAccount: vi.fn(async (id: string) => { if (id !== accountId) throw Error("account"); }),
      workerDeployments: vi.fn(async () => {
        reads.push("deployments");
        return [{ id: "old-deployment", versions: [{ version_id: activeId, percentage: 100 }] }];
      }),
      workerVersionDetails: vi.fn(async (_account: string, _worker: string, version: string): Promise<WorkerVersion> => {
        reads.push("version");
        if (version === activeId) return active;
        return {
          id: stagedId,
          migration_tag: "v3",
          annotations: { "workers/tag": sha! },
          bindings: [...sourceBindings, { name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: sha! }]
        };
      }),
      uploadWorkerAssets: vi.fn(async (_account: string, _worker: string, assets: typeof pack.assets) => {
        expect(assets).toHaveLength(309);
        reads.push("assets");
        return "simulated-assets-jwt";
      }),
      uploadWorkerVersion: vi.fn(async (_account: string, _worker: string, input: WorkerVersionUpload) => {
        reads.push("staging");
        expect(input.modules).toHaveLength(318);
        expect(input.migrations).toMatchObject({ old_tag: "v1", new_tag: "v3" });
        expect(input.assets?.jwt).toBe("simulated-assets-jwt");
        return { id: stagedId };
      })
    };
    const result = await stageReviewedUpgrade(client, accountId, pack, {
      sourceSha: sha!, artifactDigest: digest,
      expectedActiveVersionId: activeId, legacyAdoptionReviewed: true
    });
    expect(result.canPromote).toBe(false);
    expect(result.bindingsVerified).toBe(true);
    expect(result.activeVersionUnchanged).toBe(true);
    expect(reads).toEqual(["deployments", "version", "assets", "deployments", "staging", "deployments", "version"]);
  }, 90000);
});
