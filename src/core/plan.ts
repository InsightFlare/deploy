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
