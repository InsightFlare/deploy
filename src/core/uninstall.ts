import { DeployError } from "../types";
import type { CloudflareClient, WorkerBinding } from "../providers/cloudflare/client";
import { interpretBindings, DEFAULT_WORKER } from "../providers/cloudflare/discovery";
import type { PipelineRun } from "./pipeline";

export interface UninstallPlan {
  accountId: string;
  workerId: string | null;
  deployedSha: string | null;
  database: { id: string; name: string } | null;
  kv: { id: string; name: string } | null;
  domains: string[];
  domainBindings: Array<{ id: string; hostname: string }>;
  cleanupRunId: string | null;
  digest: string;
}

export type UninstallClient = Pick<CloudflareClient, "requireAccount" | "workerNames" | "workerExists" | "workerInfo" | "settings" | "d1Databases" | "kvNamespaces" | "uninstallDomains" | "detachUninstallDomain" | "deleteInsightFlareWorker" | "deleteD1Database" | "deleteKvNamespace">;
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const HEX = /^[a-f0-9]{32}$/i;
const refuse = (message: string): never => { throw new DeployError("SOURCE_MOVED", message, 409); };
const dbId = (b: WorkerBinding) => b.type === "d1" ? (b.database_id ?? b.id)?.toLowerCase() : undefined;
const kvId = (b: WorkerBinding) => b.type === "kv_namespace" ? (b.namespace_id ?? b.id)?.toLowerCase() : undefined;

async function assertUnshared(client: UninstallClient, accountId: string, database: string | null, kv: string | null, allowTarget: boolean) {
  if (!database && !kv) return;
  for (const name of await client.workerNames(accountId)) {
    if (allowTarget && name === DEFAULT_WORKER) continue;
    const bindings = await client.settings(accountId, name);
    if (bindings.some(b => (database && dbId(b) === database) || (kv && kvId(b) === kv))) {
      refuse("A reviewed storage resource is also bound to another Worker. Uninstall stopped.");
    }
  }
}

export async function previewUninstall(client: UninstallClient, accountId: string, failed?: PipelineRun | null): Promise<UninstallPlan> {
  await client.requireAccount(accountId);
  let workerId: string | null = null, deployedSha: string | null = null;
  let databaseId: string | null = null, namespaceId: string | null = null;
  let cleanupRunId: string | null = null;
  let domainBindings: UninstallPlan["domainBindings"] = [];
  if (await client.workerExists(accountId, DEFAULT_WORKER)) {
    const bindings = await client.settings(accountId, DEFAULT_WORKER);
    const observed = interpretBindings(accountId, bindings);
    if (observed.kind !== "managed") refuse("Only a verified managed InsightFlare installation can be uninstalled automatically.");
    workerId = (await client.workerInfo(accountId, DEFAULT_WORKER)).id;
    deployedSha = observed.deployedSha;
    const db = bindings.filter(b => b.name === "DB");
    const kv = bindings.filter(b => b.name === "SITE_SETTINGS_KV");
    if (db.length !== 1 || kv.length !== 1) refuse("Storage bindings are ambiguous.");
    databaseId = dbId(db[0]!) ?? null;
    namespaceId = kvId(kv[0]!) ?? null;
    if (!databaseId || !namespaceId) refuse("Storage binding identifiers are missing.");
    domainBindings = await client.uninstallDomains(accountId);
  } else if (failed?.intent === "install" && failed.phase === "failed" && failed.accountId === accountId) {
    cleanupRunId = failed.id;
    if (failed.steps.some(s => s.id === "database" && s.note?.code === "CREATED")) databaseId = failed.state.databaseId ?? null;
    if (failed.steps.some(s => s.id === "kv" && s.note?.code === "CREATED")) namespaceId = failed.state.kvNamespaceId ?? null;
    if (!databaseId && !namespaceId) refuse("No recorded resources from this failed installation can be safely cleaned up.");
  } else refuse("No managed InsightFlare installation was found.");
  if ((databaseId && !UUID.test(databaseId)) || (namespaceId && !HEX.test(namespaceId)) || (workerId && !HEX.test(workerId))) refuse("Invalid resource identity.");
  const [databases, namespaces] = await Promise.all([client.d1Databases(accountId), client.kvNamespaces(accountId)]);
  const db = databases.find(d => d.uuid === databaseId);
  const kv = namespaces.find(n => n.id === namespaceId);
  if ((databaseId && !db) || (namespaceId && !kv)) refuse("A bound resource could not be verified in the account inventory.");
  await assertUnshared(client, accountId, databaseId, namespaceId, Boolean(workerId));
  const body = { accountId, workerId, deployedSha, database: db ? { id: db.uuid, name: db.name } : null,
    kv: kv ? { id: kv.id, name: kv.title } : null, domains: domainBindings.map(d => d.hostname).sort(), domainBindings, cleanupRunId };
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body)));
  const digest = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, "0")).join("");
  return { ...body, digest };
}

export async function executeUninstallStep(client: UninstallClient, plan: UninstallPlan, step: string): Promise<void> {
  const account = plan.accountId;
  await client.requireAccount(account);
  if (step === "removeWorker") {
    if (!plan.workerId) {
      if (await client.workerExists(account, DEFAULT_WORKER)) refuse("A Worker appeared after the cleanup review.");
      return;
    }
    if (!(await client.workerExists(account, DEFAULT_WORKER))) return;
    const current = await previewUninstall(client, account);
    if (current.digest !== plan.digest) refuse("The installation changed after the uninstall review.");
    await client.deleteInsightFlareWorker(account, plan.workerId);
    if (await client.workerExists(account, DEFAULT_WORKER)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Worker still exists; retry after Cloudflare finishes deletion.");
    return;
  }
  if (await client.workerExists(account, DEFAULT_WORKER)) refuse("A Worker exists again. Storage deletion is unsafe.");
  if (step === "removeDomains") {
    const remaining = await client.uninstallDomains(account);
    if (remaining.some(d => !plan.domainBindings.some(reviewed => reviewed.id === d.id && reviewed.hostname === d.hostname))) {
      refuse("A custom domain binding changed after review.");
    }
    for (const binding of remaining) {
      if (await client.workerExists(account, DEFAULT_WORKER)) refuse("A Worker exists again. Domain deletion is unsafe.");
      await client.detachUninstallDomain(account, binding.id);
    }
    return;
  }
  if (step === "removeDatabase" && plan.database) {
    await assertUnshared(client, account, plan.database.id, null, false);
    const db = (await client.d1Databases(account)).find(d => d.uuid === plan.database!.id);
    if (db) await client.deleteD1Database(account, db.uuid);
  }
  if (step === "removeKv" && plan.kv) {
    await assertUnshared(client, account, null, plan.kv.id, false);
    const kv = (await client.kvNamespaces(account)).find(n => n.id === plan.kv!.id);
    if (kv) await client.deleteKvNamespace(account, kv.id);
  }
  if (step === "verifyRemoval") {
    const [db, kv, domains] = await Promise.all([client.d1Databases(account), client.kvNamespaces(account), client.uninstallDomains(account)]);
    if (db.some(d => d.uuid === plan.database?.id) || kv.some(n => n.id === plan.kv?.id) || domains.length) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "Reviewed resources or custom domain bindings still exist; inspect the Cloudflare dashboard.");
    }
  }
}
