import { DeployError } from "../types";
import type { Deployment } from "./plan";
import type { ReleaseArtifact } from "./public-release";
import { activeVersionId, assertCanPromote } from "./version-safety";
import { hashArtifactContents, planStagedUpgrade, verifyUploadedCandidate } from "./stage-artifact";
import type { StagingClient, StagingProposal, ReviewedStaging } from "./stage-artifact";
import { planD1Migrations } from "./d1-migrations";
import type { D1MigrationSnapshot } from "./d1-migrations";
import type { WorkerDeployment, WorkerVersion } from "../providers/cloudflare/client";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;

/**
 * No additional running InsightFlare DO, maintenance mode or database write
 * barrier. Version upload is separate from deployment, as in Wrangler.
 */
export interface UpgradeVersionClient extends StagingClient {
  d1MigrationSnapshot(accountId: string, databaseId: string): Promise<D1MigrationSnapshot>;
  createWorkerDeployment(accountId: string, scriptName: string, versionId: string, message: string): Promise<WorkerDeployment>;
}

export interface VersionUpgradePreview {
  sourceSha: string;
  artifactDigest: string;
  expectedActiveVersionId: string;
  workerName: "insightflare";
  deploymentKind: "managed" | "legacy-candidate";
  legacyAdoptionRequired: boolean;
  activeMigrationTag: string;
  targetMigrationTag: string;
  requiresDoMigration: boolean;
  databaseId: string;
  existingBindingsPreserved: number;
  stageAvailable: true;
  activationRequiresD1Current: true;
}

export interface CandidateVersionClient extends StagingClient {
  workerVersions(accountId: string, scriptName: string): Promise<WorkerVersion[]>;
}

export interface VerifiedStagedCandidate {
  stagedVersionId: string;
  sourceSha: string;
  artifactDigest: string;
  expectedActiveVersionId: string;
  createdOn: string | null;
}

/**
 * Recover an already uploaded inactive candidate after a browser refresh,
 * using Cloudflare's existing Version history instead of a new Deploy DO.
 * Check the source commit, reviewed artifact digest marker, DO migration tag,
 * and all inherited live resource bindings before offering activation.
 */
export async function findVerifiedStagedCandidates(
  client: CandidateVersionClient,
  accountId: string,
  observed: Deployment,
  release: ReleaseArtifact
): Promise<VerifiedStagedCandidate[]> {
  const { current, proposal } = await proposalFor(client, accountId, observed, release);
  const versions = await client.workerVersions(accountId, "insightflare");
  if (!Array.isArray(versions)) refuse("Cloudflare Worker versions inventory is invalid");
  const found: VerifiedStagedCandidate[] = [];
  for (const entry of versions.slice(0, 30)) {
    if (!entry || !UUID.test(entry.id ?? "") || entry.id === current) continue;
    // Detail GET is required: version list entries may omit bindings/annotations.
    const candidate = await client.workerVersionDetails(accountId, "insightflare", entry.id);
    const msg = candidate.annotations?.["workers/message"];
    if (candidate.annotations?.["workers/tag"] !== proposal.reviewedSha ||
        typeof msg !== "string" ||
        !msg.includes("Reviewed artifact " + proposal.artifactDigest.slice(0, 16))) continue;
    try {
      verifyUploadedCandidate(candidate, proposal);
    } catch {
      continue;
    }
    found.push({
      stagedVersionId: candidate.id,
      sourceSha: proposal.reviewedSha,
      artifactDigest: proposal.artifactDigest,
      expectedActiveVersionId: current,
      createdOn: candidate.created_on ?? entry.created_on ?? null
    });
    if (found.length >= 10) break;
  }
  return found;
}

export interface VersionActivationRequest {
  sourceSha: string;
  artifactDigest: string;
  expectedActiveVersionId: string;
  stagedVersionId: string;
  approved: boolean;
  legacyAdoptionReviewed: boolean;
}

export interface VersionActivationResult {
  deploymentId: string;
  previousActiveVersionId: string;
  activatedVersionId: string;
  sourceSha: string;
  workerName: "insightflare";
  databaseMigrationsCurrent: true;
}

function refuse(message: string): never {
  throw new DeployError("SOURCE_MOVED", "Worker version upgrade refused: " + message, 409);
}
function requireExisting(observed: Deployment): asserts observed is Deployment & {
  kind: "managed" | "legacy-candidate"
} {
  if (observed.kind !== "managed" && observed.kind !== "legacy-candidate" ||
      observed.workerName !== "insightflare") {
    refuse("only an identified existing InsightFlare Worker may be upgraded");
  }
}
function liveId(deployments: Array<Pick<WorkerDeployment, 'id' | 'versions'>>): string {
  const version = activeVersionId(deployments[0] ?? null);
  if (!version) refuse("the existing Worker has no single active version");
  return version!;
}
async function proposalFor(
  client: StagingClient,
  accountId: string,
  observed: Deployment,
  release: ReleaseArtifact,
  expectedActiveVersionId?: string
): Promise<{ current: string; proposal: StagingProposal; active: WorkerVersion }> {
  requireExisting(observed);
  await client.requireAccount(accountId);
  const current = liveId(await client.workerDeployments(accountId, "insightflare"));
  if (expectedActiveVersionId !== undefined && current !== expectedActiveVersionId) {
    refuse("the currently deployed Worker version changed after review");
  }
  const active = await client.workerVersionDetails(accountId, "insightflare", current);
  const review: ReviewedStaging = {
    sourceSha: release.release.sha,
    artifactDigest: release.manifest.artifactDigest,
    expectedActiveVersionId: current,
    // Reading the plan is not consent to adopt; the stage/activate routes
    // check the user's explicit legacy-adoption approval separately.
    legacyAdoptionReviewed: true
  };
  const proposal = planStagedUpgrade(release.artifact, active, review);
  if ((await hashArtifactContents(release.artifact)) !== proposal.artifactDigest) {
    refuse("the Nightly bundle's actual bytes differ from the reviewed digest");
  }
  return { current, proposal, active };
}

export async function previewVersionUpgrade(
  client: StagingClient, accountId: string, observed: Deployment, release: ReleaseArtifact
): Promise<VersionUpgradePreview> {
  const { current, proposal, active } = await proposalFor(client, accountId, observed, release);
  const db = active.bindings?.find(binding => binding.name === "DB" && binding.type === "d1");
  if (!db?.database_id || !UUID.test(db.database_id)) {
    refuse("the active Worker has no verifiable D1 database UUID");
  }
  return {
    sourceSha: release.release.sha,
    artifactDigest: proposal.artifactDigest,
    expectedActiveVersionId: current,
    workerName: "insightflare",
    deploymentKind: observed.kind as "managed" | "legacy-candidate",
    legacyAdoptionRequired: observed.kind === "legacy-candidate",
    activeMigrationTag: active.migration_tag!,
    targetMigrationTag: proposal.expectedMigrationTag,
    requiresDoMigration: Boolean(proposal.upload.migrations),
    databaseId: db!.database_id!,
    existingBindingsPreserved: proposal.requiredExistingBindings.length,
    stageAvailable: true,
    activationRequiresD1Current: true
  };
}

/**
 * Activating a version mirrors manual Worker deployment. No maintenance window,
 * clone-DB requirement, runtime write gate, or extra DO coordinator is added.
 * Only an exact reviewed candidate with a completed Wrangler migration ledger
 * and an explicit confirmation may become the 100% active Worker.
 */
export async function activateStagedUpgrade(
  client: UpgradeVersionClient,
  accountId: string,
  observed: Deployment,
  release: ReleaseArtifact,
  request: VersionActivationRequest
): Promise<VersionActivationResult> {
  if (!request || !SHA.test(request.sourceSha) || !HASH.test(request.artifactDigest) ||
      !UUID.test(request.expectedActiveVersionId ?? "") ||
      !UUID.test(request.stagedVersionId ?? "") ||
      request.expectedActiveVersionId === request.stagedVersionId ||
      request.approved !== true ||
      request.sourceSha !== release.release.sha ||
      request.artifactDigest !== release.manifest.artifactDigest) {
    refuse("the staged version, official commit and explicit approval must match");
  }
  requireExisting(observed);
  if (observed.kind === "legacy-candidate" && request.legacyAdoptionReviewed !== true) {
    refuse("the existing legacy InsightFlare Worker was not explicitly reviewed for adoption");
  }
  const { current, proposal, active } = await proposalFor(
    client, accountId, observed, release, request.expectedActiveVersionId
  );
  const staged = await client.workerVersionDetails(accountId, "insightflare", request.stagedVersionId);
  verifyUploadedCandidate(staged, proposal);
  const db = active.bindings?.find(binding => binding.name === "DB" && binding.type === "d1");
  if (!db?.database_id || !UUID.test(db.database_id)) {
    refuse("the current Worker D1 binding has no verifiable database UUID");
  }
  const snapshot = await client.d1MigrationSnapshot(accountId, db!.database_id!);
  const migrationPlan = await planD1Migrations(release, snapshot);
  assertCanPromote({
    reviewedSha: request.sourceSha,
    stagedSha: staged.annotations?.["workers/tag"] ?? "",
    expectedActiveVersionId: current,
    observedActiveVersionId: liveId(await client.workerDeployments(accountId, "insightflare")),
    productionMigrationsApplied: migrationPlan.pending.length === 0,
    resourceBindingsVerified: true,
    userApprovalRecorded: true
  });
  const deployment = await client.createWorkerDeployment(accountId, "insightflare",
    request.stagedVersionId,
    "InsightFlare Deploy | " + request.sourceSha);
  return {
    deploymentId: deployment.id,
    previousActiveVersionId: current,
    activatedVersionId: request.stagedVersionId,
    sourceSha: request.sourceSha,
    workerName: "insightflare",
    databaseMigrationsCurrent: true
  };
}
