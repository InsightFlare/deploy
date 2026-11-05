import { DeployError } from "../types";

const ACCOUNT = /^[a-f0-9]{32}$/i;
const DATABASE = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const OWNER = /^[A-Za-z0-9_-]{24,128}$/;
const RUN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export const D1_LEASE_MS = 5 * 60_000;
export const D1_LEASE_MAX_TOTAL_MS = 2 * 60 * 60_000;

export interface D1LeaseRequest {
  accountId: string;
  databaseId: string;
  ownerId: string;
  runId: string;
  sourceSha: string;
  reviewedPlanDigest: string;
}

export interface D1Lease extends D1LeaseRequest {
  leaseId: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface D1LeaseProof {
  leaseId: string;
  ownerId: string;
  runId: string;
  sourceSha: string;
  reviewedPlanDigest: string;
}

function deny(message: string): never {
  throw new DeployError("UNAVAILABLE", "D1 migration lease denied: " + message, 409);
}
export function validateD1LeaseRequest(request: D1LeaseRequest): D1LeaseRequest {
  if (!request || !ACCOUNT.test(request.accountId) ||
      !DATABASE.test(request.databaseId) || !OWNER.test(request.ownerId) ||
      !RUN.test(request.runId) || !SHA.test(request.sourceSha) ||
      !DIGEST.test(request.reviewedPlanDigest)) {
    return deny("invalid account, database, operation or reviewed plan");
  }
  return { ...request, accountId: request.accountId.toLowerCase(),
    databaseId: request.databaseId.toLowerCase() };
}
export function isD1LeaseCurrent(lease: D1Lease | null,
  proof: D1LeaseProof, now = Date.now()): boolean {
  return Boolean(lease && proof &&
    lease.expiresAt > now && lease.acquiredAt <= now &&
    now < lease.acquiredAt + D1_LEASE_MAX_TOTAL_MS &&
    lease.leaseId === proof.leaseId &&
    lease.ownerId === proof.ownerId && lease.runId === proof.runId &&
    lease.sourceSha === proof.sourceSha &&
    lease.reviewedPlanDigest === proof.reviewedPlanDigest);
}

export function acquireD1Lease(existing: D1Lease | null,
  input: D1LeaseRequest, now = Date.now(), id = crypto.randomUUID()): D1Lease {
  const request = validateD1LeaseRequest(input);
  if (existing && existing.expiresAt > now) {
    if (existing.accountId === request.accountId &&
        existing.databaseId === request.databaseId &&
        existing.ownerId === request.ownerId &&
        existing.runId === request.runId &&
        existing.sourceSha === request.sourceSha &&
        existing.reviewedPlanDigest === request.reviewedPlanDigest &&
        now < existing.acquiredAt + D1_LEASE_MAX_TOTAL_MS) {
      return existing; // same reviewed run; idempotent acquisition
    }
    return deny("another migration run currently owns this database");
  }
  if (!RUN.test(id)) return deny("invalid generated lease ID");
  return { ...request, leaseId: id, acquiredAt: now,
    expiresAt: now + D1_LEASE_MS };
}
export function renewD1Lease(existing: D1Lease | null, proof: D1LeaseProof,
  now = Date.now()): D1Lease {
  if (!isD1LeaseCurrent(existing, proof, now)) {
    return deny("lease expired or operation proof changed");
  }
  const max = existing!.acquiredAt + D1_LEASE_MAX_TOTAL_MS;
  const next = Math.min(now + D1_LEASE_MS, max);
  if (next <= now) return deny("maximum migration lease duration reached");
  return { ...existing!, expiresAt: next };
}
export function releaseD1Lease(existing: D1Lease | null,
  proof: D1LeaseProof, now = Date.now()): boolean {
  // Explicit release requires ownership and a still-valid proof; an expired
  // lease is cleaned through alarm or next acquire, never by a stale client.
  return isD1LeaseCurrent(existing, proof, now);
}
