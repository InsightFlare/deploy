import { describe, expect, it, vi } from "vitest";
import { planStagedUpgrade, stageReviewedUpgrade, type PinnedArtifact, type ReviewedStaging } from "../src/core/stage-artifact";
import type { WorkerVersion, WorkerVersionUpload, WorkerBinding } from "../src/providers/cloudflare/client";

const sha = "d".repeat(40);
const digest = "fa997f61cc92302d061179f37a56ce171e673ac8d2d4d359800d62bb7f57d0ee";
const activeId = "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const stagedId = "123e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const accountId = "a".repeat(32);

function pack(): PinnedArtifact {
  const moduleContent = new TextEncoder().encode("export default {async fetch(request,env){return env.ASSETS.fetch(request)}}");
  const assetContent = new TextEncoder().encode("<!doctype html>");
  return {
    pinnedSha: sha,
    config: {
      name: "insightflare",
      mainModule: "index.js",
      compatibilityDate: "2026-03-01",
      compatibilityFlags: ["nodejs_compat"],
      migrations: [
        { tag: "v1", new_sqlite_classes: ["IngestDurableObject"] },
        { tag: "v2", new_sqlite_classes: ["DiagnosticsSampler"] },
        { tag: "v3", deleted_classes: ["DiagnosticsSampler"] }
      ],
      observedBuildVariables: ["SESSION_WINDOW_MINUTES"],
      cronTriggers: ["*/30 * * * *"]
    },
    modules: [{ name: "index.js", contentType: "application/javascript+module", content: moduleContent }],
    assets: [{ path: "index.html", contentType: "text/html", content: assetContent, hash: "a".repeat(32) }],
    summary: {
      sourceSha: sha, digest,
      moduleCount: 1, moduleBytes: moduleContent.byteLength,
      assetCount: 1, assetBytes: assetContent.byteLength,
      migrationTags: ["v1", "v2", "v3"]
    }
  };
}
function active(): WorkerVersion {
  return {
    id: activeId, migration_tag: "v1", bindings: [
      { name: "ASSETS", type: "assets" },
      { name: "DB", type: "d1", database_id: "database-old" },
      { name: "SITE_SETTINGS_KV", type: "kv_namespace", namespace_id: "b".repeat(32) },
      { name: "INGEST_DO", type: "durable_object_namespace", class_name: "IngestDurableObject" },
      { name: "DAILY_SALT_SECRET", type: "secret_text" },
      { name: "DASHBOARD_SESSION_SECRET", type: "secret_text" },
      { name: "INSIGHTFLARE_ANALYTICS_ENGINE_DISABLED", type: "plain_text", text: "true" }
    ]
  };
}
const reviewed: ReviewedStaging = {
  sourceSha: sha,
  artifactDigest: digest,
  expectedActiveVersionId: activeId,
  legacyAdoptionReviewed: true
};

describe("pure, reviewed artifact to Worker Version bridge", () => {
  it("produces a non-promoting candidate with all existing bindings and forward-only DO migrations", () => {
    const candidate = planStagedUpgrade(pack(), active(), reviewed);
    expect(candidate.canPromote).toBe(false);
    expect(candidate.reviewedSha).toBe(sha);
    expect(candidate.artifactDigest).toBe(digest);
    expect(candidate.assets).toHaveLength(1);
    expect(candidate.upload.modules).toHaveLength(1);
    expect(candidate.upload.bindings).toEqual([
      { name: "ASSETS", type: "assets" },
      { type: "inherit", name: "DB", version_id: activeId },
      { type: "inherit", name: "SITE_SETTINGS_KV", version_id: activeId },
      { type: "inherit", name: "INGEST_DO", version_id: activeId },
      { type: "inherit", name: "DAILY_SALT_SECRET", version_id: activeId },
      { type: "inherit", name: "DASHBOARD_SESSION_SECRET", version_id: activeId },
      { type: "inherit", name: "INSIGHTFLARE_ANALYTICS_ENGINE_DISABLED", version_id: activeId },
      { name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: sha }
    ]);
    expect(candidate.upload.migrations).toEqual({
      old_tag: "v1", new_tag: "v3", steps: [
        { new_sqlite_classes: ["DiagnosticsSampler"] },
        { deleted_classes: ["DiagnosticsSampler"] }
      ]
    });
    expect(JSON.stringify(candidate.upload)).not.toContain("secret-value");
    expect(candidate.expectedMigrationTag).toBe("v3");
  });

  it("preserves all previous secrets when the Worker already has a managed SHA marker", () => {
    const before = active();
    before.bindings?.push({ name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: "b".repeat(40) });
    const staged = planStagedUpgrade(pack(), before, reviewed);
    expect(staged.upload.bindings?.filter(binding => binding.name === "INSIGHTFLARE_DEPLOYMENT_SHA")).toEqual([
      { name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: sha }
    ]);
  });

  it("does not re-apply DO migrations when active Worker is already current", () => {
    const before = active();
    before.migration_tag = "v3";
    const candidate = planStagedUpgrade(pack(), before, reviewed);
    expect(candidate.upload.migrations).toBeUndefined();
  });

  it.each([
    { sourceSha: "b".repeat(40) }, { artifactDigest: "b".repeat(64) },
    { expectedActiveVersionId: stagedId }, { legacyAdoptionReviewed: false }
  ])("fails closed when review differs from the artifact/active Worker", change => {
    expect(() => planStagedUpgrade(pack(), active(), { ...reviewed, ...change })).toThrow();
  });

  it("blocks a missing legacy root secret rather than generating one", () => {
    const before = active();
    before.bindings = before.bindings?.filter(binding => binding.name !== "DAILY_SALT_SECRET");
    expect(() => planStagedUpgrade(pack(), before, reviewed)).toThrow("root secret is missing");
  });

  it("blocks unknown DO migration lifecycle and mismatched resource types", () => {
    const unknown = active();
    unknown.migration_tag = "retired-tag";
    expect(() => planStagedUpgrade(pack(), unknown, reviewed)).toThrow("not present");
    const badDb = active();
    badDb.bindings = badDb.bindings?.map(binding => binding.name === "DB" ? { ...binding, type: "r2_bucket" } : binding);
    expect(() => planStagedUpgrade(pack(), badDb, reviewed)).toThrow("DB");
  });

  it("rejects changed byte counts and migration history after review", () => {
    const changed = pack();
    changed.modules[0] = { ...changed.modules[0]!, content: new Uint8Array([1, 2, 3]) };
    expect(() => planStagedUpgrade(changed, active(), reviewed)).toThrow("inventory changed");
    const changedTags = pack();
    changedTags.config.migrations.push({ tag: "v4", deleted_classes: ["SomeClass"] });
    expect(() => planStagedUpgrade(changedTags, active(), reviewed)).toThrow("migrations differ");
  });
});

function simulatedClient(options: {
  driftBeforeUpload?: boolean; driftAfterUpload?: boolean; missingSecret?: boolean;
  badTag?: boolean; badMarker?: boolean; wrongDbResource?: boolean
} = {}) {
  const operations: string[] = [];
  let deploymentReads = 0;
  const requireAccount = vi.fn(async (id: string) => {
    operations.push("authorize");
    if (id !== accountId) throw Error("unauthorized");
  });
  const workerDeployments = vi.fn(async () => {
    operations.push("read-deployments");
    deploymentReads++;
    const version = (options.driftBeforeUpload && deploymentReads === 2) ||
      (options.driftAfterUpload && deploymentReads === 3) ? stagedId : activeId;
    return [{ id: "deployment", versions: [{ version_id: version, percentage: 100 }] }];
  });
  const workerVersionDetails = vi.fn(async (_id: string, _name: string, version: string): Promise<WorkerVersion> => {
    operations.push("read-version");
    if (version === activeId) return active();
    const bindings = planStagedUpgrade(pack(), active(), reviewed).upload.bindings ?? [];
    const hydrated: WorkerBinding[] = bindings.map(binding => {
      const name = String(binding.name);
      if (binding.type !== "inherit") return { ...binding, name, type: String(binding.type) };
      const original = active().bindings?.find(old => old.name === name);
      if (!original) throw Error("missing mock binding");
      return { ...original };
    });
    return {
      id: version,
      migration_tag: "v3",
      annotations: { "workers/tag": options.badTag ? "wrong" : sha },
      bindings: options.missingSecret ? hydrated.filter(binding => binding.name !== "DAILY_SALT_SECRET") :
        options.badMarker ? hydrated.map(binding => binding.name === "INSIGHTFLARE_DEPLOYMENT_SHA" ? { ...binding, text: "c".repeat(40) } : binding) :
        options.wrongDbResource ? hydrated.map(binding => binding.name === "DB" ? { ...binding, database_id: "replaced-database" } : binding) :
        hydrated
    };
  });
  const uploadWorkerAssets = vi.fn(async () => { operations.push("upload-assets"); return "temporary-assets-jwt"; });
  const uploadWorkerVersion = vi.fn(async (_id: string, _name: string, _upload: WorkerVersionUpload) => { operations.push("stage-version"); return { id: stagedId }; });
  return { client: { requireAccount, workerDeployments, workerVersionDetails, uploadWorkerAssets, uploadWorkerVersion }, operations };
}

describe("non-promoting Worker stage orchestration", () => {
  it("authorizes, inspects, uploads static files, rechecks version, stages, and confirms no traffic change", async () => {
    const { client, operations } = simulatedClient();
    const result = await stageReviewedUpgrade(client, accountId, pack(), reviewed);
    expect(result).toEqual({
      stagedVersionId: stagedId,
      sourceSha: sha,
      artifactDigest: digest,
      activeVersionUnchanged: true,
      bindingsVerified: true,
      migrationTagVerified: true,
      canPromote: false
    });
    expect(operations).toEqual([
      "authorize", "read-deployments", "read-version",
      "upload-assets", "read-deployments", "stage-version", "read-deployments", "read-version"
    ]);
    expect(client.uploadWorkerVersion.mock.calls[0]?.[2]).toMatchObject({
      assets: { jwt: "temporary-assets-jwt" },
      annotations: { "workers/commit_sha": sha }
    });
  });

  it("refuses a same-size binary mutation before any Cloudflare upload", async () => {
    const altered = pack();
    const originalSize = altered.modules[0]!.content.byteLength;
    altered.modules[0]!.content[0] = 0;
    expect(altered.modules[0]!.content.byteLength).toBe(originalSize);
    const { client } = simulatedClient();
    await expect(stageReviewedUpgrade(client, accountId, altered, reviewed)).rejects.toThrow("actual build content differs");
    expect(client.uploadWorkerAssets).not.toHaveBeenCalled();
    expect(client.uploadWorkerVersion).not.toHaveBeenCalled();
  });

  it("does not stage if deployment changed during asset transfer", async () => {
    const { client } = simulatedClient({ driftBeforeUpload: true });
    await expect(stageReviewedUpgrade(client, accountId, pack(), reviewed)).rejects.toThrow("during asset transfer");
    expect(client.uploadWorkerVersion).not.toHaveBeenCalled();
  });

  it("rejects a version upload that unexpectedly altered the active deployment", async () => {
    const { client } = simulatedClient({ driftAfterUpload: true });
    await expect(stageReviewedUpgrade(client, accountId, pack(), reviewed)).rejects.toThrow("changed unexpectedly");
  });

  it.each([
    { missingSecret: true }, { badTag: true }, { badMarker: true }, { wrongDbResource: true }
  ])("rejects a staged version whose verified bindings or SHA are incomplete", async options => {
    const { client } = simulatedClient(options);
    await expect(stageReviewedUpgrade(client, accountId, pack(), reviewed)).rejects.toThrow();
  });

  it("does not stage an arbitrary Worker name", async () => {
    const { client } = simulatedClient();
    await expect(stageReviewedUpgrade(client, accountId, pack(), reviewed, "another")).rejects.toThrow("official");
    expect(client.requireAccount).not.toHaveBeenCalled();
  });
});
