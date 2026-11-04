import { DeployError } from "../../types";
import type { CloudflareClient, WorkerBuildTrigger } from "./client";
import { DEFAULT_WORKER } from "./discovery";

export type BuildReadinessState =
  | "not-installed"
  | "missing-worker-tag"
  | "permission-required"
  | "not-configured"
  | "repository-mismatch"
  | "candidate";

export interface BuildReadiness {
  state: BuildReadinessState;
  workerName: string;
  triggerCount: number;
  candidateTriggerCount: number;
  hasUserBuildToken: boolean;
  repoConnectedToUpstream: boolean;
  verifiedUserBuild: false;
  executionAvailable: false;
  message: string;
}

function assessment(
  state: BuildReadinessState,
  message: string,
  triggerCount = 0,
  candidateTriggerCount = 0,
  hasUserBuildToken = false
): BuildReadiness {
  return {
    state, workerName: DEFAULT_WORKER, triggerCount, candidateTriggerCount,
    hasUserBuildToken, repoConnectedToUpstream: candidateTriggerCount > 0,
    verifiedUserBuild: false, executionAvailable: false, message
  };
}

function matchesUpstream(trigger: WorkerBuildTrigger): boolean {
  const repo = trigger.repo_connection;
  if (!repo || repo.provider_type !== "github") return false;
  // repo_id can be a provider-specific numeric identifier and cannot prove ownership.
  // Only canonical account and repo display names qualify as a candidate.
  return repo.provider_account_name?.toLowerCase() === "ravelloh"
    && repo.repo_name?.toLowerCase() === "insightflare";
}

export function assessTriggers(triggers: WorkerBuildTrigger[]): BuildReadiness {
  if (!triggers.length) return assessment(
    "not-configured",
    "No Workers Builds trigger is connected to this Worker. Installing from upstream still requires a build integration."
  );
  const matching = triggers.filter(matchesUpstream);
  if (!matching.length) return assessment(
    "repository-mismatch",
    "Existing Workers Builds triggers do not point to the official RavelloH/InsightFlare repository.",
    triggers.length
  );
  const hasBuildToken = matching.some(trigger => Boolean(trigger.build_token_uuid));
  return assessment(
    "candidate",
    "An upstream GitHub build trigger was found, but independent builds, permissions and safe updates have not been validated.",
    triggers.length,
    matching.length,
    hasBuildToken
  );
}

/** Read-only account inspection. Never invokes the mutation/build endpoint. */
export async function inspectBuildReadiness(
  client: CloudflareClient,
  accountId: string
): Promise<BuildReadiness> {
  await client.requireAccount(accountId);
  const worker = (await client.workerScripts(accountId)).find(s => s.id === DEFAULT_WORKER);
  if (!worker) return assessment(
    "not-installed",
    "No standard InsightFlare Worker exists yet; a first-install build connection has not been created."
  );
  if (!worker.tag || !/^[a-f0-9]{32}$/i.test(worker.tag)) return assessment(
    "missing-worker-tag",
    "Cloudflare did not return the system Worker tag required to query its build triggers."
  );
  try {
    const triggers = await client.buildTriggers(accountId, worker.tag);
    return assessTriggers(triggers);
  } catch (e) {
    if (e instanceof DeployError && e.status === 403) {
      return assessment(
        "permission-required",
        "The current Cloudflare authorization cannot read Workers Builds configuration. A separate user-scoped permission may be required."
      );
    }
    throw e;
  }
}
