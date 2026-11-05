import { DeployError } from "../../types";

const API_ROOT = "https://api.cloudflare.com/client/v4";
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MODULE_CONTENT_TYPES = new Set([
  "application/javascript+module", "text/javascript+module",
  "application/javascript", "text/javascript", "application/wasm",
  "text/plain", "application/octet-stream", "application/source-map"
]);
const BINDING_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function isUuid(value: string): boolean {
  return UUID.test(value);
}

function assertWorkerTarget(accountId: string, scriptName: string): void {
  if (!ACCOUNT_ID.test(accountId) || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(scriptName)) {
    throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare account or Worker name.");
  }
}

function safeModuleName(value: string): boolean {
  if (!value || value.length > 240 || value.startsWith("/") || value.includes("\\") || value.includes(":")) return false;
  const parts = value.split("/");
  return parts.every(part => part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9_.-]+$/.test(part));
}

async function toBytes(content: WorkerModuleFile["content"] | WorkerAssetFile["content"]): Promise<Uint8Array> {
  if (content instanceof Blob) return new Uint8Array(await content.arrayBuffer());
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  const copy = new Uint8Array(content.byteLength);
  copy.set(content);
  return copy;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(""));
}

async function assetHash(base64: string, extension: string): Promise<string> {
  const input = new TextEncoder().encode(base64 + extension);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return Array.from(digest.subarray(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
}

function safeAssetPath(value: string): boolean {
  return Boolean(value && value.length <= 240 && !value.startsWith("/") &&
    !value.includes(String.fromCharCode(92)) && !value.includes(":") &&
    value.split("/").every(part => part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9_.-]+$/.test(part)));
}

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
  /** Plain-text values may be present in settings; secret values must never be returned. */
  text?: string;
  id?: string;
  namespace_id?: string;
  database_id?: string;
  database_name?: string;
  bucket_name?: string;
  dataset?: string;
  class_name?: string;
  script_name?: string;
  service?: string;
  environment?: string;
  queue_name?: string;
}

export interface WorkerInfo {
  id: string;
  name: string;
  tags?: string[];
  observability?: Record<string, unknown>;
  subdomain?: { enabled?: boolean; url?: string };
}

export interface WorkerVersion {
  id: string;
  number?: number;
  created_on?: string;
  migration_tag?: string;
  main_module?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  metadata?: { created_on?: string; modified_on?: string; source?: string; has_preview?: boolean };
  annotations?: Record<string, string>;
  bindings?: WorkerBinding[];
  assets?: {
    config?: {
      base_path?: string;
      html_handling?: string;
      not_found_handling?: string;
      run_worker_first?: string[] | boolean;
    };
  };
  resources?: {
    bindings?: WorkerBinding[];
    script_runtime?: {
      migration_tag?: string;
      compatibility_date?: string;
      compatibility_flags?: string[];
      exports?: Record<string, { type?: string; state?: string; storage?: string }>;
    };
  };
}

export interface WorkerMigrationStep {
  deleted_classes?: string[];
  new_classes?: string[];
  new_sqlite_classes?: string[];
  renamed_classes?: Array<{ from: string; to: string }>;
  transferred_classes?: Array<{ from: string; from_script: string; to: string }>;
}

export interface WorkerMigrations {
  old_tag?: string;
  new_tag: string;
  steps: WorkerMigrationStep[];
}

export interface WorkerAssetFile {
  path: string;
  contentType: string;
  content: Blob | ArrayBuffer | Uint8Array;
}

export interface WorkerAssetsConfig {
  jwt: string;
  config?: {
    base_path?: string;
    html_handling?: "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | "none";
    not_found_handling?: "none" | "404-page" | "single-page-application";
    run_worker_first?: string[] | boolean;
  };
}

export interface WorkerDeployment {
  id: string;
  created_on?: string;
  strategy: "percentage";
  versions: Array<{ version_id: string; percentage: number }>;
  annotations?: Record<string, string>;
}

export interface WorkerModuleFile {
  name: string;
  contentType: string;
  content: Blob | ArrayBuffer | Uint8Array;
}

export interface WorkerVersionUpload {
  mainModule: string;
  compatibilityDate: string;
  compatibilityFlags: string[];
  modules: WorkerModuleFile[];
  bindings?: Array<Record<string, unknown>>;
  migrations?: WorkerMigrations;
  exports?: Record<string, Record<string, unknown>>;
  annotations: { "workers/commit_sha": string; "workers/repository_url": string; "workers/message"?: string; [key: string]: string | undefined };
  assets?: WorkerAssetsConfig;
  observability?: Record<string, unknown>;
  limits?: Record<string, number>;
  usageModel?: "standard" | "bundled" | "unbound";
}

type CfPayload<T> = { success?: boolean; result?: T; errors?: { code?: number; message?: string }[] };

export class CloudflareClient {
  constructor(private readonly token: string, private readonly http: typeof fetch = fetch) {}

  private async request<T>(path: string, init: RequestInit, timeoutMs = 9000, bearerToken = this.token): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
    headers.set("Accept", "application/json");
    const result = await this.http(API_ROOT + path, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs)
    });
    const payload = await result.json().catch(() => null) as CfPayload<T> | null;
    if (!result.ok || payload?.success !== true || !payload || payload.result === undefined) {
      const reason = payload?.errors?.[0]?.code;
      // Do not print upstream response bodies (they can contain confidential request data).
      throw new DeployError("UPSTREAM_UNAVAILABLE", `Cloudflare request failed (HTTP ${result.status}${reason ? `, code ${reason}` : ""}).`, result.status === 401 || result.status === 403 ? 403 : 502);
    }
    return payload.result;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async postJson<T>(path: string, body: unknown, timeoutMs = 30000, bearerToken = this.token): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, timeoutMs, bearerToken);
  }

  async postForm<T>(path: string, body: FormData, bearerToken = this.token): Promise<T> {
    // Let fetch generate the multipart boundary. Never set Content-Type manually.
    return this.request<T>(path, { method: "POST", body }, 120000, bearerToken);
  }

  /** List names/IDs only from the caller's selected, authorized Cloudflare account. */
  async d1Databases(accountId: string): Promise<Array<{ uuid: string; name: string; version?: string }>> {
    if (!/^[a-f0-9]{32}$/i.test(accountId)) {
      throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare Account ID.");
    }
    await this.requireAccount(accountId);
    const databases: Array<{ uuid: string; name: string; version?: string }> = [];
    const seen = new Set<string>();
    for (let page = 1; page <= 5; page++) {
      const result = await this.get<Array<{ uuid?: unknown; name?: unknown; version?: unknown }>>(
        `/accounts/${accountId}/d1/database?per_page=100&page=${page}`
      );
      if (!Array.isArray(result) || result.length > 100) {
        throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid D1 inventory.", 502);
      }
      for (const db of result) {
        if (typeof db?.uuid !== "string" ||
            !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db.uuid) ||
            typeof db.name !== "string" || db.name.length > 128 ||
            seen.has(db.uuid.toLowerCase())) {
          throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare D1 inventory contains an invalid or duplicated database.", 502);
        }
        seen.add(db.uuid.toLowerCase());
        databases.push({ uuid: db.uuid.toLowerCase(), name: db.name,
          ...(typeof db.version === "string" ? { version: db.version } : {}) });
      }
      if (result.length < 100) return databases;
    }
    throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare D1 inventory exceeds the safe pagination limit.", 502);
  }

  /**
   * Inspect the user's D1 migration readiness without reading application data.
   * Only sqlite_master table names and Wrangler's d1_migrations ledger are read.
   * All statements are constant strings, not arbitrary client-supplied SQL.
   */
  async d1MigrationSnapshot(accountId: string, databaseId: string): Promise<{
    accountId: string; databaseId: string; tableNames: string[];
    appliedNames: string[] | null; bookmark: string;
  }> {
    if (!/^[a-f0-9]{32}$/i.test(accountId) ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId)) {
      throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare account or D1 database identifier.");
    }
    await this.requireAccount(accountId);
    const base = `/accounts/${accountId}/d1/database/${databaseId}`;
    const metadata = await this.get<{ uuid?: string; name?: string; version?: string }>(base);
    if (metadata.uuid?.toLowerCase() !== databaseId.toLowerCase()) {
      throw new DeployError("SOURCE_MOVED", "D1 identity differs from the reviewed database ID.", 409);
    }
    if (metadata.version === "alpha") {
      throw new DeployError("UNAVAILABLE", "Legacy alpha D1 storage has no supported Time Travel recovery; automatic migrations are blocked.", 409);
    }

    const query = async (sql: string): Promise<Array<Record<string, unknown>>> => {
      const results = await this.postJson<Array<{
        results?: Array<Record<string, unknown>>; success?: boolean
      }>>(base + "/query", { sql });
      if (!Array.isArray(results) || results.length !== 1 ||
          results[0]?.success !== true || !Array.isArray(results[0].results)) {
        throw new DeployError("UPSTREAM_UNAVAILABLE", "D1 returned an invalid migration-inspection result.", 502);
      }
      return results[0].results;
    };
    const tables = await query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    const tableNames = tables.map(row => row.name);
    if (tableNames.some(name => typeof name !== "string") ||
        new Set(tableNames).size !== tableNames.length) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "D1 table inventory is invalid.", 502);
    }
    let appliedNames: string[] | null = null;
    if (tableNames.includes("d1_migrations")) {
      const applied = await query("SELECT name FROM d1_migrations ORDER BY id ASC");
      const names = applied.map(row => row.name);
      if (names.some(name => typeof name !== "string")) {
        throw new DeployError("UPSTREAM_UNAVAILABLE", "Wrangler migration ledger contains invalid names.", 502);
      }
      appliedNames = names as string[];
    }
    const bookmark = await this.get<{ bookmark?: string }>(base + "/time_travel/bookmark");
    if (!bookmark || typeof bookmark.bookmark !== "string" ||
        bookmark.bookmark.length < 1 || bookmark.bookmark.length > 200) {
      throw new DeployError("UNAVAILABLE", "D1 Time Travel bookmark is unavailable; migration safety review blocked.", 409);
    }
    return {
      accountId: accountId.toLowerCase(),
      databaseId: databaseId.toLowerCase(),
      tableNames: tableNames as string[],
      appliedNames,
      bookmark: bookmark.bookmark
    };
  }

  /**
   * Experimental D1 migration transport. Not exposed through any HTTP route.
   * Must be called only after user approval, exact migration hash verification,
   * an exclusive durable lease and a fresh migration snapshot.
   *
   * A single REST SQL batch groups the verified file with its Wrangler ledger
   * INSERT. Atomic rollback, all 43 canonical SQL files, and final schema
   * parity were tested on disposable remote D1 (2026-11-05), but real user
   * writes remain blocked until durable locks and maintenance checks exist.
   */
  async d1ApplyVerifiedMigration(
    accountId: string,
    databaseId: string,
    migration: { name: string; sql: string; sha256: string },
    createLedger: boolean
  ): Promise<void> {
    if (!/^[a-f0-9]{32}$/i.test(accountId) ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId) ||
        !/^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/.test(migration?.name ?? "") ||
        typeof migration.sql !== "string" ||
        new TextEncoder().encode(migration.sql).byteLength > 90_000 ||
        !/^[a-f0-9]{64}$/.test(migration.sha256) ||
        typeof createLedger !== "boolean") {
      throw new DeployError("INVALID_SOURCE", "Unrecognized authorized D1 migration input.");
    }
    const source = new TextEncoder().encode(migration.sql);
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", source)),
      byte => byte.toString(16).padStart(2, "0")
    ).join("");
    if (hash !== migration.sha256) {
      throw new DeployError("SOURCE_MOVED", "D1 migration SQL differs from the reviewed release manifest.", 409);
    }

    await this.requireAccount(accountId);
    const entries: Array<{ sql: string; params?: string[] }> = [];
    if (createLedger) {
      entries.push({ sql: "CREATE TABLE d1_migrations (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "name TEXT UNIQUE, " +
        "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)" });
    }
    entries.push({ sql: migration.sql });
    entries.push({ sql: "INSERT INTO d1_migrations (name) VALUES (?)",
      params: [migration.name] });
    const result = await this.postJson<Array<{ success?: boolean }>>(
      `/accounts/${accountId}/d1/database/${databaseId}/query`,
      { batch: entries }, 120000
    );
    if (!Array.isArray(result) || result.length < entries.length ||
        result.some(row => row?.success !== true)) {
      throw new DeployError("UPSTREAM_UNAVAILABLE",
        "D1 migration batch returned an incomplete result. Do not retry until the ledger is inspected.", 502);
    }
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

  async workerInfo(accountId: string, scriptName: string): Promise<WorkerInfo> {
    assertWorkerTarget(accountId, scriptName);
    const worker = await this.get<WorkerInfo>(`/accounts/${accountId}/workers/workers/${encodeURIComponent(scriptName)}`);
    if (!worker || !/^[a-f0-9]{32}$/i.test(worker.id) || worker.name !== scriptName) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid Worker identity.", 502);
    }
    return worker;
  }

  async workerVersions(accountId: string, scriptName: string): Promise<WorkerVersion[]> {
    const worker = await this.workerInfo(accountId, scriptName);
    const versions = await this.get<WorkerVersion[]>(`/accounts/${accountId}/workers/workers/${worker.id}/versions?per_page=100`);
    if (!Array.isArray(versions)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid Worker versions list.", 502);
    return versions.filter(item => Boolean(item && typeof item.id === "string"));
  }

  async workerVersionDetails(accountId: string, scriptName: string, versionId: string): Promise<WorkerVersion> {
    if (!isUuid(versionId)) throw new DeployError("INVALID_SOURCE", "Invalid Worker version identifier.");
    const worker = await this.workerInfo(accountId, scriptName);
    const version = await this.get<WorkerVersion>(`/accounts/${accountId}/workers/workers/${worker.id}/versions/${versionId}`);
    if (!version || version.id !== versionId) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid Worker version detail.", 502);
    return version;
  }

  async workerDeployments(accountId: string, scriptName: string): Promise<WorkerDeployment[]> {
    assertWorkerTarget(accountId, scriptName);
    const result = await this.get<{ deployments?: WorkerDeployment[] }>(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/deployments`);
    if (!Array.isArray(result.deployments)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid Worker deployments list.", 502);
    return result.deployments.filter(item => Boolean(item && typeof item.id === "string" && Array.isArray(item.versions)));
  }

  /** Register and upload the complete static asset set; returns the one-hour completion JWT. */
  async uploadWorkerAssets(accountId: string, scriptName: string, files: WorkerAssetFile[]): Promise<string> {
    assertWorkerTarget(accountId, scriptName);
    if (!Array.isArray(files) || files.length < 1 || files.length > 10000) {
      throw new DeployError("INVALID_SOURCE", "The Worker build must contain a valid static asset set.");
    }
    const manifest: Record<string, { hash: string; size: number }> = {};
    const byHash = new Map<string, { base64: string; size: number; contentType: string }>();
    let totalBytes = 0;
    for (const file of files) {
      if (!file || !safeAssetPath(file.path) || Object.hasOwn(manifest, "/" + file.path)) {
        throw new DeployError("INVALID_SOURCE", "The Worker build contains an invalid or duplicate asset path.");
      }
      const bytes = await toBytes(file.content);
      if (bytes.byteLength > 25 * 1024 * 1024) {
        throw new DeployError("INVALID_SOURCE", "A static asset exceeds the safe upload size limit.");
      }
      totalBytes += bytes.byteLength;
      if (totalBytes > 100 * 1024 * 1024) {
        throw new DeployError("INVALID_SOURCE", "The total static asset upload exceeds the safe size limit.");
      }
      const base64 = bytesToBase64(bytes);
      const dot = file.path.lastIndexOf(".");
      const extension = dot < 0 ? "" : file.path.slice(dot + 1);
      const hash = await assetHash(base64, extension);
      manifest["/" + file.path] = { hash, size: bytes.byteLength };
      const existing = byHash.get(hash);
      if (existing && (existing.base64 !== base64 || existing.contentType !== file.contentType)) {
        throw new DeployError("INVALID_SOURCE", "A static asset hash collision was detected.");
      }
      byHash.set(hash, { base64, size: bytes.byteLength, contentType: file.contentType });
    }

    const session = await this.postJson<{ jwt?: string; buckets?: string[][] }>(
      `/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/assets-upload-session`,
      { manifest }
    );
    if (typeof session.jwt !== "string" || !session.jwt || !Array.isArray(session.buckets)) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid static asset upload session.", 502);
    }
    if (session.buckets.length === 0) return session.jwt;

    let completionJwt: string | undefined;
    const seen = new Set<string>();
    for (const bucket of session.buckets) {
      if (!Array.isArray(bucket) || bucket.length === 0 || bucket.length > 1000) {
        throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid static asset upload batch.", 502);
      }
      const form = new FormData();
      for (const hash of bucket) {
        const asset = byHash.get(hash);
        if (!asset || seen.has(hash)) {
          throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an unknown or duplicate static asset hash.", 502);
        }
        seen.add(hash);
        // Cloudflare expects one multipart part per hash; the part's body is
        // the base64-encoded content and its MIME type controls asset serving.
        form.append(hash, new Blob([asset.base64], { type: asset.contentType }), hash);
      }
      const uploaded = await this.postForm<{ jwt?: string }>(
        `/accounts/${accountId}/workers/assets/upload?base64=true`,
        form,
        session.jwt
      );
      if (typeof uploaded.jwt === "string" && uploaded.jwt) completionJwt = uploaded.jwt;
    }
    if (!completionJwt) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare did not return a static asset completion token.", 502);
    }
    return completionJwt;
  }

  /** Creates a staged Worker version via the Beta Versions API; it never deploys traffic. */
  async uploadWorkerVersion(accountId: string, scriptName: string, input: WorkerVersionUpload): Promise<WorkerVersion> {
    assertWorkerTarget(accountId, scriptName);
    const sha = input.annotations?.["workers/commit_sha"];
    if (!sha || !/^[a-f0-9]{40}$/i.test(sha) ||
      input.annotations["workers/repository_url"] !== "https://github.com/RavelloH/InsightFlare" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.compatibilityDate)) {
      throw new DeployError("INVALID_SOURCE", "A verified upstream commit and compatibility date are required to upload a Worker version.");
    }
    if (!Array.isArray(input.modules) || input.modules.length < 1 || input.modules.length > 1000) {
      throw new DeployError("INVALID_SOURCE", "The Worker version must contain a valid module list.");
    }
    const names = new Set<string>();
    let totalBytes = 0;
    const modules: Array<{ name: string; content_type: string; content_base64: string }> = [];
    for (const module of input.modules) {
      if (!module || !safeModuleName(module.name) || names.has(module.name) || !MODULE_CONTENT_TYPES.has(module.contentType)) {
        throw new DeployError("INVALID_SOURCE", "The Worker version contains an invalid or duplicate module.");
      }
      names.add(module.name);
      const bytes = await toBytes(module.content);
      if (bytes.byteLength > 25 * 1024 * 1024) {
        throw new DeployError("INVALID_SOURCE", "A Worker module exceeds the safe upload size limit.");
      }
      totalBytes += bytes.byteLength;
      modules.push({ name: module.name, content_type: module.contentType, content_base64: bytesToBase64(bytes) });
    }
    if (!names.has(input.mainModule) || totalBytes > 80 * 1024 * 1024) {
      throw new DeployError("INVALID_SOURCE", "The Worker entrypoint is missing or the total upload is too large.");
    }

    const bindingNames = new Set<string>();
    for (const binding of input.bindings ?? []) {
      if (!binding || typeof binding !== "object" || typeof binding.name !== "string" ||
        !BINDING_NAME.test(binding.name) || typeof binding.type !== "string" || bindingNames.has(binding.name)) {
        throw new DeployError("INVALID_SOURCE", "The Worker version contains an invalid or duplicate binding.");
      }
      bindingNames.add(binding.name);
      if (binding.type === "inherit") {
        if (typeof binding.version_id !== "string" || !isUuid(binding.version_id)) {
          throw new DeployError("INVALID_SOURCE", "Inherited bindings must reference one exact Worker version.", 403);
        }
      }
      if (binding.type === "secret_text" || binding.type === "secret_key") {
        const secretFields = ["text", "value", "secret", "key_base64", "key_jwk"];
        if (secretFields.some(field => field in binding)) {
          throw new DeployError("INVALID_SOURCE", "Secret values must never be included in a Worker version upload.", 403);
        }
      }
    }
    const markerBindings = (input.bindings ?? []).filter(binding => binding.name === "INSIGHTFLARE_DEPLOYMENT_SHA");
    if (markerBindings.length !== 1 || markerBindings[0]?.type !== "plain_text" ||
      markerBindings[0]?.text !== sha.toLowerCase()) {
      throw new DeployError("INVALID_SOURCE", "The staged Worker must contain exactly one deployment marker matching the pinned source SHA.");
    }
    if (input.migrations) {
      if (!/^[A-Za-z0-9_.-]{1,128}$/.test(input.migrations.new_tag) ||
        (input.migrations.old_tag !== undefined && !/^[A-Za-z0-9_.-]{1,128}$/.test(input.migrations.old_tag)) ||
        !Array.isArray(input.migrations.steps) || input.migrations.steps.length < 1 || input.migrations.steps.length > 50) {
        throw new DeployError("INVALID_SOURCE", "The Durable Object migration plan is invalid.");
      }
      if (input.exports) throw new DeployError("INVALID_SOURCE", "Worker exports and Durable Object migrations cannot be uploaded together.");
    }
    if (input.assets && (typeof input.assets.jwt !== "string" || !input.assets.jwt || input.assets.jwt.length > 16384)) {
      throw new DeployError("INVALID_SOURCE", "A valid static asset completion token is required.");
    }

    const worker = await this.workerInfo(accountId, scriptName);
    // The Beta Versions API accepts only message/tag/triggered_by. Never send
    // custom annotations: preserve the complete Git SHA in workers/tag.
    const userMessage = input.annotations["workers/message"]?.trim() ?? "";
    if (userMessage.length > 850) {
      throw new DeployError("INVALID_SOURCE", "The Worker version message is too long.");
    }
    const versionAnnotations = {
      "workers/tag": sha.toLowerCase(),
      "workers/message": "InsightFlare Deploy | " + sha.toLowerCase() + (userMessage ? " | " + userMessage : ""),
      "workers/triggered_by": "insightflare-deploy"
    };
    const payload = {
      main_module: input.mainModule,
      modules,
      compatibility_date: input.compatibilityDate,
      compatibility_flags: input.compatibilityFlags,
      bindings: input.bindings ?? [],
      annotations: versionAnnotations,
      ...(input.migrations ? { migrations: input.migrations } : {}),
      ...(input.exports ? { exports: input.exports } : {}),
      ...(input.assets ? { assets: input.assets } : {}),
      ...(input.observability ? { observability: input.observability } : {}),
      ...(input.limits ? { limits: input.limits } : {}),
      ...(input.usageModel ? { usage_model: input.usageModel } : {})
    };
    const result = await this.postJson<WorkerVersion>(
      `/accounts/${accountId}/workers/workers/${worker.id}/versions?deploy=false`,
      payload,
      120000
    );
    if (!result || !isUuid(result.id)) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare did not return a valid staged Worker version.", 502);
    }
    return result;
  }

  /** Creates a 100% deployment for a specific already-uploaded version. */
  async createWorkerDeployment(accountId: string, scriptName: string, versionId: string, message: string): Promise<WorkerDeployment> {
    assertWorkerTarget(accountId, scriptName);
    if (!isUuid(versionId) || !message.trim() || message.length > 1000) {
      throw new DeployError("INVALID_SOURCE", "A valid Worker version and deployment message are required.");
    }
    const result = await this.postJson<WorkerDeployment>(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/deployments`, {
      strategy: "percentage",
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: { "workers/message": message, "workers/triggered_by": "insightflare-deploy" }
    });
    if (!result || !isUuid(result.id) || result.versions?.length !== 1 || result.versions[0]?.version_id !== versionId || result.versions[0]?.percentage !== 100) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an unexpected Worker deployment.", 502);
    }
    return result;
  }
}
