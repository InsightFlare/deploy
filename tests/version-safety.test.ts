import { describe, expect, it } from "vitest";
import { activeVersionId, assertCanPromote, assertCanRollback, type PromotionSafety, type RollbackSafety } from "../src/core/version-safety";

const previous = "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const staged = "123e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const sha = "a".repeat(40);

describe("Worker version promotion safety", () => {
  it("recognizes only a single 100% active version", () => {
    expect(activeVersionId({ id: "deployment", versions: [{ version_id: previous, percentage: 100 }] })).toBe(previous);
    expect(() => activeVersionId({ id: "split", versions: [
      { version_id: previous, percentage: 50 },
      { version_id: staged, percentage: 50 }
    ] })).toThrow("split deployment");
    expect(() => activeVersionId({ id: "partial", versions: [{ version_id: previous, percentage: 99 }] })).toThrow("100%");
  });

  it("allows a 100% Worker deployment with the same basic requirements as manual upgrade", () => {
    expect(() => assertCanPromote({
      reviewedSha: sha,
      stagedSha: sha,
      expectedActiveVersionId: previous,
      observedActiveVersionId: previous,
      productionMigrationsApplied: true,
      resourceBindingsVerified: true,
      userApprovalRecorded: true
    })).not.toThrow();
  });

  it.each([
    { stagedSha: "b".repeat(40), productionMigrationsApplied: true, resourceBindingsVerified: true, userApprovalRecorded: true },
    { stagedSha: sha, productionMigrationsApplied: false, resourceBindingsVerified: true, userApprovalRecorded: true },
    { stagedSha: sha, productionMigrationsApplied: true, resourceBindingsVerified: false, userApprovalRecorded: true },
    { stagedSha: sha, productionMigrationsApplied: true, resourceBindingsVerified: true, userApprovalRecorded: false }
  ])("rejects mismatched source, incomplete migration or absent user approval", overrides => {
    const base: PromotionSafety = {
      reviewedSha: sha,
      stagedSha: sha,
      expectedActiveVersionId: previous,
      observedActiveVersionId: previous,
      productionMigrationsApplied: true,
      resourceBindingsVerified: true,
      userApprovalRecorded: true
    };
    expect(() => assertCanPromote({ ...base, ...overrides } as PromotionSafety)).toThrow();
  });

  it("blocks promotion if another deployment changed the active version after review", () => {
    expect(() => assertCanPromote({
      reviewedSha: sha, stagedSha: sha,
      expectedActiveVersionId: previous, observedActiveVersionId: staged,
      productionMigrationsApplied: true, resourceBindingsVerified: true,
      userApprovalRecorded: true
    })).toThrow("changed after the deployment plan was reviewed");
  });
});

describe("Worker code rollback safety", () => {
  it("allows rollback only when resource and schema compatibility are confirmed", () => {
    expect(() => assertCanRollback({
      expectedActiveVersionId: staged,
      observedActiveVersionId: staged,
      targetVersionId: previous,
      resourceBindingsStillExist: true,
      schemaBackwardCompatible: true,
      durableObjectLifecycleUnchanged: true,
      userApprovalRecorded: true
    })).not.toThrow();
  });

  it.each([
    { resourceBindingsStillExist: false, schemaBackwardCompatible: true, durableObjectLifecycleUnchanged: true, userApprovalRecorded: true },
    { resourceBindingsStillExist: true, schemaBackwardCompatible: false, durableObjectLifecycleUnchanged: true, userApprovalRecorded: true },
    { resourceBindingsStillExist: true, schemaBackwardCompatible: true, durableObjectLifecycleUnchanged: false, userApprovalRecorded: true },
    { resourceBindingsStillExist: true, schemaBackwardCompatible: true, durableObjectLifecycleUnchanged: true, userApprovalRecorded: false }
  ])("blocks rollback when resources, schema, DO lifecycle or approval are not safe", overrides => {
    const base: RollbackSafety = {
      expectedActiveVersionId: staged,
      observedActiveVersionId: staged,
      targetVersionId: previous,
      resourceBindingsStillExist: true,
      schemaBackwardCompatible: true,
      durableObjectLifecycleUnchanged: true,
      userApprovalRecorded: true
    };
    expect(() => assertCanRollback({ ...base, ...overrides } as RollbackSafety)).toThrow();
  });

  it("blocks a stale rollback if the active version has changed", () => {
    expect(() => assertCanRollback({
      expectedActiveVersionId: staged,
      observedActiveVersionId: previous,
      targetVersionId: previous,
      resourceBindingsStillExist: true,
      schemaBackwardCompatible: true,
      durableObjectLifecycleUnchanged: true,
      userApprovalRecorded: true
    })).toThrow("active Worker version changed");
  });
});
