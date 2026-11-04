import { validateSha } from "../../core/source";
import { DeployError } from "../../types";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ACCOUNT = /^[0-9a-f]{32}$/i;

export interface BuildRequest {
  method: "POST";
  path: string;
  body: { commit_hash: string; branch: "main" };
  requiredPermission: "Workers CI Write";
}

/** A typed *request builder*, not a validated build integration. No execution is exposed yet. */
export function buildRequest(accountId: string, triggerId: string, sourceSha: string): BuildRequest {
  if (!ACCOUNT.test(accountId) || !UUID.test(triggerId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare build target.");
  return {
    method: "POST",
    path: `/accounts/${accountId}/builds/triggers/${triggerId}/builds`,
    body: { commit_hash: validateSha(sourceSha), branch: "main" },
    requiredPermission: "Workers CI Write"
  };
}

/**
 * A user-owned trigger must exist and be authorized to access upstream.
 * GitHub ownership, trigger setup and OAuth compatibility have not been proven.
 * Calling buildRequest is NOT proof of that capability.
 */
export const BUILD_ADAPTER_STATUS = {
  configured: false,
  executionAvailable: false,
  mode: "per-user-main-build",
  blockers: [
    "Verify Cloudflare Workers Builds accepts upstream public GitHub without a fork.",
    "Verify OAuth supports user-scoped Workers CI Write and build-token administration.",
    "Wrangler versions upload stages a version without deploying; never substitute wrangler deploy or versions deploy in an automated trigger.",
    "Implement and verify Beta Worker Versions API upload with deploy=false, or isolated Worker Previews.",
    "Separate InsightFlare source build from remote D1 migrations.",
    "Verify build result provenance and preserve existing Worker secrets."
  ]
} as const;
