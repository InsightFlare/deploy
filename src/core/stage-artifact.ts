import { DeployError } from "../types";
import { inheritWorkerBindings, markManagedVersionBindings } from "./version-bindings";
import { planDurableObjectMigrations, type TaggedDurableObjectMigration } from "./do-migrations";
import { activeVersionId } from "./version-safety";
import type {
  WorkerVersionUpload, WorkerVersion, WorkerAssetFile, WorkerBinding
} from "../providers/cloudflare/client";

export interface StagingClient {
  requireAccount(accountId: string): Promise<unknown>;
  workerDeployments(accountId: string, scriptName: string): Promise<Array<{
    id: string; versions: Array<{ version_id: string; percentage: number }>;
  }>>;
  workerVersionDetails(accountId: string, scriptName: string, versionId: string): Promise<WorkerVersion>;
  uploadWorkerAssets(accountId: string, scriptName: string, files: WorkerAssetFile[]): Promise<string>;
  uploadWorkerVersion(accountId: string, scriptName: string, input: WorkerVersionUpload): Promise<{ id: string }>;
}

const SHA = /^[0-9a-f]{40}$/i;
const DIGEST = /^[0-9a-f]{64}$/i;

/** Data returned by scripts/pack-build.mjs; it is never a shared precompiled release. */
export interface PinnedArtifact {
  pinnedSha: string;
  config: {
    name: string;
    mainModule: string;
    compatibilityDate: string;
    compatibilityFlags: string[];
    migrations: TaggedDurableObjectMigration[];
    observedBuildVariables: string[];
    cronTriggers: string[];
    observability?: Record<string, unknown>;
  };
  modules: Array<{ name: string; contentType: string; content: Uint8Array }>;
  assets: Array<{ path: string; contentType: string; content: Uint8Array; hash?: string }>;
  summary: {
    sourceSha: string;
    digest: string;
    moduleCount: number;
    moduleBytes: number;
    assetCount: number;
    assetBytes: number;
    migrationTags: string[];
  };
}

export interface ReviewedStaging {
  sourceSha: string;
  artifactDigest: string;
  expectedActiveVersionId: string;
  legacyAdoptionReviewed: boolean;
}

export interface StagingProposal {
  readonly reviewedSha: string;
  readonly artifactDigest: string;
  readonly expectedActiveVersionId: string;
  readonly upload: WorkerVersionUpload;
  readonly assets: WorkerAssetFile[];
  readonly requiredExistingBindings: Array<Pick<WorkerBinding, "name" | "type" | "database_id" | "namespace_id" | "class_name">>;
  readonly expectedMigrationTag: string;
  readonly requiresProductionMigration: boolean;
  readonly canPromote: false;
}

const REQUIRED = [
  { name: "DB", type: "d1" },
  { name: "SITE_SETTINGS_KV", type: "kv_namespace" },
  { name: "INGEST_DO", type: "durable_object_namespace" },
  { name: "ASSETS", type: "assets" }
] as const;

function assertBindingContinuity(bindings: WorkerBinding[]): void {
  for (const { name, type } of REQUIRED) {
    if (bindings.filter(item => item.name === name && item.type === type).length !== 1) {
      throw new DeployError("UNAVAILABLE", "An existing InsightFlare resource binding is missing or has an unexpected type: " + name, 409);
    }
  }
  const doBinding = bindings.find(item => item.name === "INGEST_DO");
  if (doBinding?.class_name !== "IngestDurableObject") {
    throw new DeployError("UNAVAILABLE", "The existing Durable Object class does not match the official source.", 409);
  }
  if (!bindings.some(item => ["MAIN_SECRET", "DAILY_SALT_SECRET"].includes(item.name) && item.type === "secret_text")) {
    throw new DeployError("UNAVAILABLE", "The existing InsightFlare root secret is missing; never silently regenerate it.", 409);
  }
}

/**
 * Recompute the same deterministic binary digest as pack-build.mjs.
 * A manifest's stored digest alone is not evidence that its byte buffers have
 * not been modified after review; this runs before ANY upload.
 */
export async function hashArtifactContents(pack: PinnedArtifact): Promise<string> {
  const entries = [
    ...pack.modules.map(item => ({ path: "worker/" + item.name, content: item.content })),
    ...pack.assets.map(item => ({ path: "asset/" + item.path, content: item.content }))
  ].sort((a, b) => a.path.localeCompare(b.path, "en"));
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const entry of entries) {
    const copy = new Uint8Array(entry.content.byteLength);
    copy.set(entry.content);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
    const prefix = encoder.encode(entry.path + "\0");
    const suffix = new Uint8Array([0]);
    parts.push(prefix, hash, suffix);
    total += prefix.byteLength + hash.byteLength + suffix.byteLength;
  }
  const payload = new Uint8Array(total);
  let offset = 0;
  for (const bytes of parts) {
    payload.set(bytes, offset);
    offset += bytes.byteLength;
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

function checkedArtifact(pack: PinnedArtifact, reviewed: ReviewedStaging): void {
  if (!pack || !SHA.test(reviewed.sourceSha) || !DIGEST.test(reviewed.artifactDigest) ||
    reviewed.sourceSha.toLowerCase() !== pack.pinnedSha?.toLowerCase() ||
    reviewed.sourceSha.toLowerCase() !== pack.summary?.sourceSha?.toLowerCase() ||
    reviewed.artifactDigest.toLowerCase() !== pack.summary?.digest?.toLowerCase() ||
    pack.config?.name !== "insightflare" || pack.config.mainModule !== "index.js" ||
    !reviewed.legacyAdoptionReviewed) {
    throw new DeployError("SOURCE_MOVED", "The reviewed source SHA/digest, Worker identity or legacy adoption confirmation does not match this build.", 409);
  }
  if (pack.summary.moduleCount !== pack.modules.length || pack.summary.assetCount !== pack.assets.length ||
      pack.modules.reduce((n, item) => n + item.content.byteLength, 0) !== pack.summary.moduleBytes ||
      pack.assets.reduce((n, item) => n + item.content.byteLength, 0) !== pack.summary.assetBytes ||
      !pack.modules.some(item => item.name === pack.config.mainModule) ||
      !pack.assets.length) {
    throw new DeployError("INVALID_SOURCE", "The artifact module or asset inventory changed after review.", 409);
  }
  if (JSON.stringify(pack.summary.migrationTags) !== JSON.stringify(pack.config.migrations.map(migration => migration.tag))) {
    throw new DeployError("INVALID_SOURCE", "The artifact's Durable Object migrations differ from the reviewed manifest.", 409);
  }
}

/**
 * Pure, fail-closed upgrade proposal. No Cloudflare HTTP calls.
 * New installation is deliberately unsupported until provision+bootstrap is
 * implemented and test resources have been reconciled.
 */
export function planStagedUpgrade(
  pack: PinnedArtifact, activeVersion: WorkerVersion, reviewed: ReviewedStaging
): StagingProposal {
  checkedArtifact(pack, reviewed);
  if (activeVersion.id !== reviewed.expectedActiveVersionId || !Array.isArray(activeVersion.bindings)) {
    throw new DeployError("SOURCE_MOVED", "The active Worker or binding inventory changed after review.", 409);
  }
  const oldBindings = activeVersion.bindings;
  assertBindingContinuity(oldBindings);
  if (typeof activeVersion.migration_tag !== "string") {
    throw new DeployError("UNAVAILABLE", "The existing Durable Object migration tag is unknown; manual review is required.", 409);
  }
  const migrations = planDurableObjectMigrations(activeVersion.migration_tag, pack.config.migrations);
  const inherited = inheritWorkerBindings(activeVersion, [{
    name: "ASSETS", binding: { type: "assets", name: "ASSETS" }
  }]);
  const bindings = markManagedVersionBindings(inherited, reviewed.sourceSha);

  // Build config vars and cron definitions are informative; never blindly
  // overwrite the user's existing plain vars, Cron triggers or bindings.
  const requiredExistingBindings = oldBindings.map(({ name, type, database_id, namespace_id, class_name }) => ({ name, type, database_id, namespace_id, class_name }));
  return {
    reviewedSha: reviewed.sourceSha.toLowerCase(),
    artifactDigest: reviewed.artifactDigest.toLowerCase(),
    expectedActiveVersionId: reviewed.expectedActiveVersionId,
    assets: pack.assets.map(item => ({ path: item.path, contentType: item.contentType, content: item.content })),
    upload: {
      mainModule: pack.config.mainModule,
      compatibilityDate: pack.config.compatibilityDate,
      compatibilityFlags: [...pack.config.compatibilityFlags],
      modules: pack.modules.map(item => ({ name: item.name, contentType: item.contentType, content: item.content })),
      bindings,
      ...(migrations ? { migrations } : {}),
      annotations: {
        "workers/commit_sha": reviewed.sourceSha.toLowerCase(),
        "workers/repository_url": "https://github.com/RavelloH/InsightFlare",
        "workers/message": "Reviewed artifact " + reviewed.artifactDigest.slice(0, 16)
      },
      ...(pack.config.observability ? { observability: pack.config.observability } : {})
    },
    requiredExistingBindings,
    expectedMigrationTag: migrations?.new_tag ?? activeVersion.migration_tag,
    requiresProductionMigration: false,
    canPromote: false
  };
}

export interface StagingResult {
  stagedVersionId: string;
  sourceSha: string;
  artifactDigest: string;
  activeVersionUnchanged: true;
  bindingsVerified: true;
  migrationTagVerified: true;
  canPromote: false;
}

function verifyUploadedCandidate(candidate: WorkerVersion, proposal: StagingProposal): void {
  if (!candidate || candidate.annotations?.["workers/tag"] !== proposal.reviewedSha ||
      candidate.migration_tag !== proposal.expectedMigrationTag ||
      !Array.isArray(candidate.bindings)) {
    throw new DeployError("UPSTREAM_UNAVAILABLE", "The staged version's SHA, migration tag or binding inventory could not be verified.", 502);
  }
  const byName = new Map(candidate.bindings.map(binding => [binding.name, binding]));
  if (byName.size !== candidate.bindings.length) {
    throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned duplicate bindings in the staged version.", 502);
  }
  const marker = byName.get("INSIGHTFLARE_DEPLOYMENT_SHA");
  if (!marker || marker.type !== "plain_text" || marker.text !== proposal.reviewedSha) {
    throw new DeployError("UPSTREAM_UNAVAILABLE", "The staged Worker is missing its exact source SHA marker.", 502);
  }
  for (const original of proposal.requiredExistingBindings) {
    const staged = byName.get(original.name);
    if (!staged || staged.type !== original.type ||
        (original.database_id !== undefined && staged.database_id !== original.database_id) ||
        (original.namespace_id !== undefined && staged.namespace_id !== original.namespace_id) ||
        (original.class_name !== undefined && staged.class_name !== original.class_name)) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "A pre-existing Worker resource binding changed during staging: " + original.name, 502);
    }
  }
}

/**
 * The sole write operations are static assets and upload of an INACTIVE Worker
 * version. No D1 migrations, DNS, routes or deployment mutation.
 *
 * This API is NOT exposed by any deployed control-plane route yet.
 */
export async function stageReviewedUpgrade(
  client: StagingClient,
  accountId: string,
  pack: PinnedArtifact,
  reviewed: ReviewedStaging,
  scriptName = "insightflare"
): Promise<StagingResult> {
  if (scriptName !== "insightflare") {
    throw new DeployError("INVALID_SOURCE", "Only the official InsightFlare Worker may be staged through this upgrade flow.");
  }
  await client.requireAccount(accountId);
  const before = await client.workerDeployments(accountId, scriptName);
  const original = activeVersionId(before[0] ?? null);
  if (!original || original !== reviewed.expectedActiveVersionId) {
    throw new DeployError("SOURCE_MOVED", "The active Worker version changed since the review.", 409);
  }
  const active = await client.workerVersionDetails(accountId, scriptName, original);
  const proposal = planStagedUpgrade(pack, active, reviewed);
  const actualDigest = await hashArtifactContents(pack);
  if (actualDigest !== proposal.artifactDigest) {
    throw new DeployError("SOURCE_MOVED", "The actual build content differs from its reviewed digest; staging is refused.", 409);
  }

  // Reread the active deployment after potentially slow asset transfer.
  const jwt = await client.uploadWorkerAssets(accountId, scriptName, proposal.assets);
  const beforeUpload = activeVersionId((await client.workerDeployments(accountId, scriptName))[0] ?? null);
  if (beforeUpload !== original) {
    throw new DeployError("SOURCE_MOVED", "The active Worker version changed during asset transfer.", 409);
  }
  const staged = await client.uploadWorkerVersion(accountId, scriptName, {
    ...proposal.upload,
    assets: { jwt, config: { html_handling: "auto-trailing-slash", not_found_handling: "none" } }
  });

  const after = activeVersionId((await client.workerDeployments(accountId, scriptName))[0] ?? null);
  if (after !== original) {
    throw new DeployError("UNAVAILABLE", "The active Worker changed unexpectedly; staging is not considered safe.", 409);
  }
  verifyUploadedCandidate(
    await client.workerVersionDetails(accountId, scriptName, staged.id),
    proposal
  );
  return {
    stagedVersionId: staged.id,
    sourceSha: proposal.reviewedSha,
    artifactDigest: proposal.artifactDigest,
    activeVersionUnchanged: true,
    bindingsVerified: true,
    migrationTagVerified: true,
    canPromote: false
  };
}
