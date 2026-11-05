import { DeployError } from "../types";

const SHA = /^[a-f0-9]{40}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export interface DeploymentVersionEntry {
  version_id: string;
  percentage: number;
}

export interface DeploymentSnapshot {
  id: string;
  versions: DeploymentVersionEntry[];
}

/**
 * Only a single 100% version is treated as an unambiguous active version.
 * Split/gradual deployments must be reviewed explicitly rather than silently
 * replaced by a full deployment.
 */
export function activeVersionId(deployment: DeploymentSnapshot | null): string | null {
  if (!deployment) return null;
  if (deployment.versions.length !== 1) {
    throw new DeployError("UNAVAILABLE", "The current Worker uses a split deployment; automatic promotion is blocked.", 409);
  }
  const [version] = deployment.versions;
  if (!version || !UUID.test(version.version_id) || version.percentage !== 100) {
    throw new DeployError("UNAVAILABLE", "The current Worker deployment is not a single 100% version.", 409);
  }
  return version.version_id;
}

export interface PromotionSafety {
  reviewedSha: string;
  stagedSha: string;
  expectedActiveVersionId: string | null;
  observedActiveVersionId: string | null;
  productionMigrationsApplied: boolean;
  resourceBindingsVerified: boolean;
  userApprovalRecorded: boolean;
}

/** Fail-closed gate immediately before switching 100% of traffic. */
export function assertCanPromote(input: PromotionSafety): void {
  if (!SHA.test(input.reviewedSha) || !SHA.test(input.stagedSha) ||
    input.reviewedSha.toLowerCase() !== input.stagedSha.toLowerCase()) {
    throw new DeployError("SOURCE_MOVED", "The staged Worker version does not match the exact source commit that was reviewed.", 409);
  }
  if (input.expectedActiveVersionId !== input.observedActiveVersionId) {
    throw new DeployError("SOURCE_MOVED", "The active Worker version changed after the deployment plan was reviewed.", 409);
  }
  if (input.expectedActiveVersionId !== null && !UUID.test(input.expectedActiveVersionId)) {
    throw new DeployError("INVALID_SOURCE", "The expected active Worker version identifier is invalid.");
  }
  if (!input.productionMigrationsApplied ||
    !input.resourceBindingsVerified || !input.userApprovalRecorded) {
    throw new DeployError("UNAVAILABLE", "Promotion requires current D1 migrations, matching Worker resources and explicit user approval.", 403);
  }
}

/**
 * A code rollback does not restore D1/KV/DO data or resource bindings.
 * Therefore an older version is eligible only when the new schema remains
 * compatible with it and no Durable Object namespace lifecycle changed.
 */
export interface RollbackSafety {
  expectedActiveVersionId: string;
  observedActiveVersionId: string | null;
  targetVersionId: string;
  resourceBindingsStillExist: boolean;
  schemaBackwardCompatible: boolean;
  durableObjectLifecycleUnchanged: boolean;
  userApprovalRecorded: boolean;
}

export function assertCanRollback(input: RollbackSafety): void {
  if (!UUID.test(input.expectedActiveVersionId) || !UUID.test(input.targetVersionId)) {
    throw new DeployError("INVALID_SOURCE", "The rollback version identifiers are invalid.");
  }
  if (input.expectedActiveVersionId !== input.observedActiveVersionId) {
    throw new DeployError("SOURCE_MOVED", "The active Worker version changed; refresh the deployment state before rolling back.", 409);
  }
  if (input.expectedActiveVersionId === input.targetVersionId) {
    throw new DeployError("INVALID_SOURCE", "The selected rollback version is already active.");
  }
  if (!input.resourceBindingsStillExist || !input.schemaBackwardCompatible ||
    !input.durableObjectLifecycleUnchanged || !input.userApprovalRecorded) {
    throw new DeployError("UNAVAILABLE", "Code rollback is unsafe because resource continuity, schema compatibility, Durable Object lifecycle or user approval has not been verified.", 403);
  }
}
