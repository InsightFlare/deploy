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
  const markers = bindings.filter(b => b.name === "INSIGHTFLARE_DEPLOYMENT_SHA");
  const marker = markers[0];
  const hasIdentity = database && kv && ingest;
  let deployedSha: string | null = null;
  let invalidMarker = markers.length > 1;
  if (marker) {
    if (marker.type !== "plain_text" || typeof marker.text !== "string") invalidMarker = true;
    else {
      try { deployedSha = validateSha(marker.text); }
      catch { invalidMarker = true; }
    }
  }
  const kind: DeploymentKind = !hasIdentity || invalidMarker ? "conflict" : deployedSha ? "managed" : "legacy-candidate";
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
      deployedSha: null, bindings: { database: false, kv: false, ingest: false },
      issues: ["No standard Worker was returned by Cloudflare. Check that the authorization can list Workers before starting a new installation."]
    };
  }
  return interpretBindings(accountId, await client.settings(accountId, DEFAULT_WORKER));
}
