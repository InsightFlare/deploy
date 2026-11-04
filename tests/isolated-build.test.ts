import { describe, expect, it } from "vitest";
import { validateBuildReceipt, validateIsolatedBuildRequest, type IsolatedBuildRequest, type VerifiedBuildReceipt } from "../src/core/isolated-build";

const sha = "d".repeat(40);
const request: IsolatedBuildRequest = {
  runId: "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f",
  accountId: "a".repeat(32),
  ownerId: "owner-012345678901234567890123",
  sourceSha: sha,
  expiresAt: 1_800_000
};
const now = 1_000_000;
const receipt: VerifiedBuildReceipt = {
  runId: request.runId,
  accountId: request.accountId,
  sourceSha: sha,
  artifactDigest: "b".repeat(64),
  workerModules: 318,
  staticAssets: 309,
  provider: "isolated-container",
  deployed: false
};

describe("per-user isolated build authorization and receipt contracts", () => {
  it("requires an exact SHA, account, run UUID and short-lived server issued request", () => {
    expect(validateIsolatedBuildRequest(request, now)).toEqual(request);
    for (const change of [
      { sourceSha: "main" }, { accountId: "wrong" }, { ownerId: "x" },
      { runId: "run1" }, { expiresAt: now - 1 },
      { expiresAt: now + 31 * 60_000 }
    ]) {
      expect(() => validateIsolatedBuildRequest({ ...request, ...change }, now)).toThrow();
    }
  });

  it("requires a receipt matching the exact authorized tenant/run/source", () => {
    expect(validateBuildReceipt(receipt, request)).toEqual(receipt);
    for (const change of [
      { runId: "123e105f-2a42-4f8b-a1c1-73f6a2a30c0f" },
      { accountId: "b".repeat(32) }, { sourceSha: "e".repeat(40) },
      { artifactDigest: "bad" }, { deployed: true },
      { workerModules: 0 }, { staticAssets: -1 }
    ]) {
      expect(() => validateBuildReceipt({ ...receipt, ...change } as VerifiedBuildReceipt, request)).toThrow();
    }
  });

  it("does not accept a falsely claimed clean build from another provider", () => {
    expect(() => validateBuildReceipt({ ...receipt, provider: "unknown" } as unknown as VerifiedBuildReceipt, request)).toThrow();
  });
});
