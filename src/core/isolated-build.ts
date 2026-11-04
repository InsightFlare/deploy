import { DeployError } from "../types";
import { validateSha } from "./source";

/** Input to an external, isolated build host; no Cloudflare account token. */
export interface IsolatedBuildRequest {
  readonly runId: string;
  readonly accountId: string;
  readonly ownerId: string;
  readonly sourceSha: string;
  readonly expiresAt: number;
}

export interface VerifiedBuildReceipt {
  readonly runId: string;
  readonly accountId: string;
  readonly sourceSha: string;
  readonly artifactDigest: string;
  readonly workerModules: number;
  readonly staticAssets: number;
  readonly provider: "isolated-container";
  readonly deployed: false;
}

const RUN_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ACCOUNT = /^[a-f0-9]{32}$/i;
const OWNER = /^[A-Za-z0-9_-]{24,128}$/;
const DIGEST = /^[a-f0-9]{64}$/i;

export function validateIsolatedBuildRequest(input: IsolatedBuildRequest, now = Date.now()): IsolatedBuildRequest {
  if (!input || !RUN_ID.test(input.runId) || !ACCOUNT.test(input.accountId) ||
      !OWNER.test(input.ownerId)) {
    throw new DeployError("INVALID_ACCOUNT", "Invalid isolated build identity.");
  }
  const sha = validateSha(input.sourceSha);
  if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= now || input.expiresAt > now + 30 * 60_000) {
    throw new DeployError("UNAVAILABLE", "The isolated build authorization expired or exceeds the allowed lifetime.", 403);
  }
  return { ...input, runId: input.runId.toLowerCase(), accountId: input.accountId.toLowerCase(), sourceSha: sha };
}

/** Final receipt never contains filesystem paths, credentials or an upload URL. */
export function validateBuildReceipt(receipt: VerifiedBuildReceipt, input: IsolatedBuildRequest): VerifiedBuildReceipt {
  if (!receipt || receipt.provider !== "isolated-container" || receipt.deployed !== false ||
      receipt.runId !== input.runId || receipt.accountId !== input.accountId ||
      receipt.sourceSha !== input.sourceSha || !DIGEST.test(receipt.artifactDigest) ||
      !Number.isSafeInteger(receipt.workerModules) || receipt.workerModules < 1 || receipt.workerModules > 1000 ||
      !Number.isSafeInteger(receipt.staticAssets) || receipt.staticAssets < 1 || receipt.staticAssets > 10000) {
    throw new DeployError("SOURCE_MOVED", "The isolated build receipt does not match the authorized run.", 409);
  }
  return receipt;
}
