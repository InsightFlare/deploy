import { DeployError } from "../../types";

const API_ROOT = "https://api.cloudflare.com/client/v4";

export interface CloudflareAccount { id: string; name: string }
export interface WorkerScript { id: string; tag?: string; created_on?: string; modified_on?: string }
export interface WorkerBuildTrigger {
  trigger_uuid?: string;
  trigger_name?: string;
  build_command?: string;
  deploy_command?: string;
  branch_includes?: string[];
  build_token_uuid?: string;
  branch_excludes?: string[];
  repo_connection?: {
    provider_type?: string;
    provider_account_id?: string;
    provider_account_name?: string;
    repo_name?: string;
    repo_id?: string;
  };
}
export interface WorkerBinding {
  type: string;
  name: string;
  text?: string;
  id?: string;
  namespace_id?: string;
  class_name?: string;
  script_name?: string;
}

type CfPayload<T> = { success?: boolean; result?: T; errors?: { code?: number; message?: string }[] };

export class CloudflareClient {
  constructor(private readonly token: string, private readonly http: typeof fetch = fetch) {}

  async get<T>(path: string): Promise<T> {
    const result = await this.http(API_ROOT + path, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(9000)
    });
    const payload = await result.json().catch(() => null) as CfPayload<T> | null;
    if (!result.ok || payload?.success === false || !payload || payload.result === undefined) {
      const reason = payload?.errors?.[0]?.code;
      // Do not print upstream response bodies (they can contain sensitive request data).
      throw new DeployError("UPSTREAM_UNAVAILABLE", `Cloudflare request failed (HTTP ${result.status}${reason ? `, code ${reason}` : ""}).`, result.status === 401 || result.status === 403 ? 403 : 502);
    }
    return payload.result;
  }

  async accounts(): Promise<CloudflareAccount[]> {
    const all: CloudflareAccount[] = [];
    for (let page = 1; page <= 10; page++) {
      const result = await this.get<CloudflareAccount[]>(`/accounts?per_page=50&page=${page}`);
      if (!Array.isArray(result)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid accounts list.", 502);
      all.push(...result.filter(a => typeof a.id === "string" && /^[a-f0-9]{32}$/i.test(a.id)));
      if (result.length < 50) break;
    }
    return all;
  }

  async requireAccount(id: string): Promise<CloudflareAccount> {
    const accounts = await this.accounts();
    const found = accounts.find(a => a.id === id);
    if (!found) throw new DeployError("INVALID_ACCOUNT", "This Cloudflare account is not accessible with your current authorization.", 403);
    return found;
  }

  async workerScripts(accountId: string): Promise<WorkerScript[]> {
    const scripts = await this.get<WorkerScript[]>(`/accounts/${accountId}/workers/scripts`);
    if (!Array.isArray(scripts)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid workers list.", 502);
    return scripts.filter((s): s is WorkerScript => Boolean(s && typeof s.id === "string"));
  }

  async workerNames(accountId: string): Promise<string[]> {
    return (await this.workerScripts(accountId)).map(s => s.id);
  }

  async buildTriggers(accountId: string, workerTag: string): Promise<WorkerBuildTrigger[]> {
    if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9]{32}$/i.test(workerTag)) {
      throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Worker identifier.");
    }
    const triggers = await this.get<WorkerBuildTrigger[]>(`/accounts/${accountId}/builds/workers/${workerTag}/triggers`);
    if (!Array.isArray(triggers)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned invalid build triggers.", 502);
    return triggers;
  }

  async settings(accountId: string, name: string): Promise<WorkerBinding[]> {
    const config = await this.get<{ bindings?: WorkerBinding[] }>(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(name)}/settings`);
    return Array.isArray(config.bindings) ? config.bindings : [];
  }
}
