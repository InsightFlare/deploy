import { describe, expect, it } from "vitest";
import {
  D1_LEASE_MS, D1_LEASE_MAX_TOTAL_MS,
  acquireD1Lease, renewD1Lease, releaseD1Lease,
  isD1LeaseCurrent, validateD1LeaseRequest
} from "../src/core/d1-lease";

const accountId = "a".repeat(32);
const databaseId = "3df43c02-1cea-4af5-86fa-c39c80055ac8";
const ownerId = "b".repeat(32);
const runId = "b5c48d27-46ad-48d1-b912-dc7e00e43c2f";
const sourceSha = "c".repeat(40);
const reviewedPlanDigest = "d".repeat(64);
const leaseId = "3f104d48-dd77-42d6-aa94-8d7f64f3475f";
const start = 1_800_000_000_000;
const request = () => ({
  accountId, databaseId, ownerId, runId, sourceSha, reviewedPlanDigest
});
const proof = () => ({ leaseId, ownerId, runId, sourceSha, reviewedPlanDigest });

describe("account-and-database scoped D1 migration lease contract", () => {
  it("validates exact immutable account, DB, owner, run, source and reviewed-plan identities", () => {
    expect(validateD1LeaseRequest(request())).toEqual(request());
    expect(() => validateD1LeaseRequest({ ...request(), databaseId: "../other" })).toThrow();
    expect(() => validateD1LeaseRequest({ ...request(), sourceSha: "main" })).toThrow();
    expect(() => validateD1LeaseRequest({ ...request(), ownerId: "x" })).toThrow();
    expect(() => validateD1LeaseRequest({ ...request(), reviewedPlanDigest: "" })).toThrow();
  });

  it("acquires a bounded exclusive lease and accepts exact current proof", () => {
    const lease = acquireD1Lease(null, request(), start, leaseId);
    expect(lease).toMatchObject({ ...request(), leaseId,
      acquiredAt: start, expiresAt: start + D1_LEASE_MS });
    expect(isD1LeaseCurrent(lease, proof(), start + 1)).toBe(true);
    expect(isD1LeaseCurrent(lease, proof(), start + D1_LEASE_MS)).toBe(false);
  });

  it("returns the same token on repeated acquisition by the exact run", () => {
    const first = acquireD1Lease(null, request(), start, leaseId);
    const again = acquireD1Lease(first, request(), start + 2_000, crypto.randomUUID());
    expect(again).toEqual(first);
  });

  it("refuses competing owners, source revisions and plans while active", () => {
    const active = acquireD1Lease(null, request(), start, leaseId);
    expect(() => acquireD1Lease(active, { ...request(), ownerId: "e".repeat(32) }, start + 100)).toThrow("another migration");
    expect(() => acquireD1Lease(active, { ...request(), sourceSha: "f".repeat(40) }, start + 100)).toThrow();
    expect(() => acquireD1Lease(active, { ...request(), reviewedPlanDigest: "0".repeat(64) }, start + 100)).toThrow();
    expect(() => acquireD1Lease(active, { ...request(), runId: crypto.randomUUID() }, start + 100)).toThrow();
  });

  it("cannot assert, renew or release a forged or expired lease", () => {
    const active = acquireD1Lease(null, request(), start, leaseId);
    const forged = { ...proof(), leaseId: crypto.randomUUID() };
    expect(isD1LeaseCurrent(active, forged, start + 1)).toBe(false);
    expect(releaseD1Lease(active, forged, start + 1)).toBe(false);
    expect(() => renewD1Lease(active, forged, start + 1)).toThrow();
    expect(releaseD1Lease(active, proof(), start + D1_LEASE_MS)).toBe(false);
    expect(() => renewD1Lease(active, proof(), start + D1_LEASE_MS)).toThrow();
    expect(isD1LeaseCurrent(active, { ...proof(), reviewedPlanDigest: "e".repeat(64) }, start + 1)).toBe(false);
  });

  it("renews only the exact proof and never beyond the hard lifetime", () => {
    const active = acquireD1Lease(null, request(), start, leaseId);
    const renewed = renewD1Lease(active, proof(), start + D1_LEASE_MS - 10);
    expect(renewed.expiresAt).toBe(start + 2 * D1_LEASE_MS - 10);
    const nearDeadline = { ...renewed,
      expiresAt: start + D1_LEASE_MAX_TOTAL_MS - 5 };
    const capped = renewD1Lease(nearDeadline, proof(), nearDeadline.expiresAt - 10);
    expect(capped.expiresAt).toBe(start + D1_LEASE_MAX_TOTAL_MS);
    expect(isD1LeaseCurrent(capped, proof(), start + D1_LEASE_MAX_TOTAL_MS)).toBe(false);
  });

  it("allows a different run to acquire only after expiry and rejects stale proof", () => {
    const active = acquireD1Lease(null, request(), start, leaseId);
    const nextId = crypto.randomUUID();
    const next = acquireD1Lease(active, { ...request(), ownerId: "f".repeat(32) }, start + D1_LEASE_MS + 1, nextId);
    expect(next.leaseId).toBe(nextId);
    expect(releaseD1Lease(next, proof(), start + D1_LEASE_MS + 2)).toBe(false);
    expect(releaseD1Lease(next, { ...proof(), leaseId: nextId, ownerId: "f".repeat(32) }, start + D1_LEASE_MS + 2)).toBe(true);
  });
});
