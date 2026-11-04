import { validateSha } from "./source";
import { DeployError } from "../types";
import type { Intent } from "./plan";

export type RunPhase = "blocked" | "ready" | "building" | "staged" | "migrating" | "promoting" | "succeeded" | "failed";

export interface PreparedRun {
  id: string;
  accountId: string;
  ownerId: string;
  intent: Intent;
  pinnedSha: string;
  currentSha: string | null;
  phase: RunPhase;
  blockers: string[];
  createdAt: number;
  expiresAt: number;
  executionEnabled: false;
}

export interface PrepareRunInput {
  accountId: string;
  ownerId: string;
  intent: Intent;
  pinnedSha: string;
  currentSha: string | null;
  blockers: string[];
}

export const RUN_TTL_MS = 15 * 60_000;
export const MAX_ACTIVE_RUN_MS = 2 * 60 * 60_000;
export const ACTIVE_PHASES: readonly RunPhase[] = ["building", "staged", "migrating", "promoting"];

export function assertReviewedSource(reviewedSha: string, resolvedSha: string): void {
  if (validateSha(reviewedSha) !== validateSha(resolvedSha)) {
    throw new DeployError("SOURCE_MOVED", "The source commit changed. Refresh and review the deployment plan again.", 409);
  }
}
const ACCOUNT_ID = /^[0-9a-f]{32}$/i;
const OWNER_ID = /^[A-Za-z0-9_-]{24,128}$/;

export function createPreparedRun(input: PrepareRunInput, now = Date.now(), id: string = crypto.randomUUID()): PreparedRun {
  if (!ACCOUNT_ID.test(input.accountId) || !OWNER_ID.test(input.ownerId)) {
    throw new DeployError("INVALID_ACCOUNT", "Invalid deployment owner or account.");
  }
  if (!["install", "update", "repair"].includes(input.intent)) {
    throw new DeployError("INVALID_SOURCE", "Invalid deployment operation.");
  }
  const pinnedSha = validateSha(input.pinnedSha);
  const currentSha = input.currentSha === null ? null : validateSha(input.currentSha);
  if (!Array.isArray(input.blockers) || input.blockers.length < 1 || input.blockers.length > 50 ||
    !input.blockers.every(item => typeof item === "string" && item.length > 0 && item.length <= 500)) {
    throw new DeployError("INVALID_SOURCE", "Deployment execution must remain blocked until safety checks pass.");
  }
  return {
    id,
    accountId: input.accountId.toLowerCase(),
    ownerId: input.ownerId,
    intent: input.intent,
    pinnedSha,
    currentSha,
    phase: "blocked",
    blockers: [...new Set(input.blockers)],
    createdAt: now,
    expiresAt: now + RUN_TTL_MS,
    executionEnabled: false
  };
}

export function assertCanReplaceRun(existing: PreparedRun | null, next: PreparedRun, now = Date.now()): boolean {
  if (!existing) return true;
  // A running deployment cannot lose its account lock merely because the
  // original short-lived preparation window expired. Active stages must
  // renew a lease; the hard deadline avoids permanent orphaned locks.
  if (ACTIVE_PHASES.includes(existing.phase) && now < existing.createdAt + MAX_ACTIVE_RUN_MS) {
    throw new DeployError("UNAVAILABLE", "Another deployment operation is active for this Cloudflare account.", 409);
  }
  if (existing.expiresAt <= now) return true;
  if (existing.ownerId !== next.ownerId) {
    // Read-only preparations do not lock all account members indefinitely.
    return true;
  }
  return true;
}

export function runForOwner(run: PreparedRun | null, ownerId: string, now = Date.now()): PreparedRun | null {
  if (!run || run.ownerId !== ownerId) return null;
  const active = ACTIVE_PHASES.includes(run.phase) && now < run.createdAt + MAX_ACTIVE_RUN_MS;
  if (run.expiresAt <= now && !active) return null;
  // Strip internal correlation details before handing a prepared operation to the browser.
  return { ...run, ownerId: "" };
}
