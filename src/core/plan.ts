import type { MainCommit } from "./source";

export type DeploymentKind = "not-installed" | "managed" | "legacy-candidate" | "conflict";
export type Intent = "install" | "update" | "repair";

export interface Deployment {
  kind: DeploymentKind;
  accountId: string;
  workerName: string;
  deployedSha: string | null;
  bindings: { database: boolean; kv: boolean; ingest: boolean };
  issues: string[];
}

export interface Plan {
  intent: Intent;
  sourceSha: string;
  currentSha: string | null;
  allowed: false;
  requiresConfirmation: true;
  blockers: string[];
  proposedSteps: string[];
}

export function deploymentPlan(current: Deployment, source: MainCommit, intent: Intent): Plan {
  const blockers: string[] = ["User-owned source builds have not passed validation; deployment execution is disabled."];
  if (current.kind === "conflict") blockers.push("Worker name is occupied by an unknown application. Automatic takeover is forbidden.");
  if (current.kind === "legacy-candidate") blockers.push("Existing legacy instance must complete an explicit adoption flow.");
  if (intent === "install" && current.kind !== "not-installed") blockers.push("An existing Worker must be reviewed before installation.");
  if (intent === "update" && current.kind === "not-installed") blockers.push("Nothing is installed in this account.");
  if (intent === "repair" && (!current.deployedSha || current.kind !== "managed")) blockers.push("Repair requires a known managed deployment SHA.");
  return {
    intent,
    sourceSha: intent === "repair" ? current.deployedSha ?? source.sha : source.sha,
    currentSha: current.deployedSha,
    allowed: false,
    requiresConfirmation: true,
    blockers,
    proposedSteps: [
      "Revalidate OAuth account and ownership",
      "Resolve and pin a single immutable source commit",
      "Build the source in the user's own build environment",
      "Review and apply compatible forward-only D1 migrations",
      "Reconcile resources and upload Worker modules and assets",
      "Preserve all existing secrets, domain routes and user data",
      "Verify health and record the deployed commit SHA"
    ]
  };
}
