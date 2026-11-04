import type { Deployment, DeploymentKind } from "../../core/plan";
import { validateSha } from "../../core/source";
import type { CloudflareClient, WorkerBinding } from "./client";

export const DEFAULT_WORKER = "insightflare";

export function interpretBindings(accountId: string, bindings: WorkerBinding[]): Deployment {
  const binding = (name: string, type: string): boolean =>
    bindings.some(b => b.name === name && b.type === type);
  const database = binding("DB", "d1");
  const kv = binding("SITE_SETTINGS_KV", "kv_namespace");
  const ingest = bindings.some(b => b.name === "INGEST_DO" && b.type === "durable_object_namespace" && b.class_name === "IngestDurableObject");
  const marker = bindings.find(b => b.name === "INSIGHTFLARE_DEPLOYMENT_SHA" && b.type === "plain_text")?.text;
  const hasIdentity = database && kv && ingest;
  let deployedSha: string | null = null;
  if (marker) {
    try { deployedSha = validateSha(marker); } catch { /* treat malformed deployment marker as conflict */ }
  }
  const kind: DeploymentKind = !hasIdentity ? "conflict" : deployedSha ? "managed" : "legacy-candidate";
  const issues = kind === "conflict"
    ? ["Worker identity or deployment marker cannot be verified. Refusing automatic takeover."]
    : kind === "legacy-candidate"
      ? ["Existing InsightFlare Worker has no managed deployment SHA; a safe adoption process is required."]
      : [];
  return { kind, accountId, workerName: DEFAULT_WORKER, deployedSha, bindings: { database, kv, ingest }, issues };
}

export async function discoverDeployment(client: CloudflareClient, accountId: string): Promise<Deployment> {
  await client.requireAccount(accountId);
  const scripts = await client.workerNames(accountId);
  if (!scripts.includes(DEFAULT_WORKER)) {
    return {
      kind: "not-installed", accountId, workerName: DEFAULT_WORKER,
      deployedSha: null, bindings: { database: false, kv: false, ingest: false }, issues: []
    };
  }
  return interpretBindings(accountId, await client.settings(accountId, DEFAULT_WORKER));
}
