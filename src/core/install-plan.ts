import { DeployError } from "../types";
import { planDurableObjectMigrations } from "./do-migrations";
import type { ReleaseArtifact } from "./public-release";
import type { WorkerMigrations } from "../providers/cloudflare/client";

/** Resource names a fresh installation creates (or adopts when still empty). */
export const INSTALL_NAMES = {
  worker: "insightflare",
  database: "insightflare",
  kvNamespace: "insightflare-site-settings"
} as const;

const NAME = /^[A-Z_][A-Z0-9_]{0,127}$/;

interface ManifestBindings {
  durableObjects: Array<{ name: string; className: string }>;
  d1: string[];
  kv: string[];
  analyticsEngine: Array<{ binding: string; dataset: string }>;
}

function manifestBindings(release: ReleaseArtifact): ManifestBindings {
  const raw = release.manifest.config.bindings as Partial<ManifestBindings> | undefined;
  const durableObjects = Array.isArray(raw?.durableObjects) ? raw!.durableObjects : [];
  const d1 = Array.isArray(raw?.d1) ? raw!.d1 : [];
  const kv = Array.isArray(raw?.kv) ? raw!.kv : [];
  const analyticsEngine = Array.isArray(raw?.analyticsEngine) ? raw!.analyticsEngine : [];
  const valid =
    durableObjects.every(item => NAME.test(item?.name ?? "") && /^[A-Za-z][A-Za-z0-9]{0,127}$/.test(item?.className ?? "")) &&
    analyticsEngine.every(item => NAME.test(item?.binding ?? "") && /^[a-z0-9_]{1,64}$/.test(item?.dataset ?? "")) &&
    JSON.stringify(d1) === JSON.stringify(["DB"]) &&
    JSON.stringify(kv) === JSON.stringify(["SITE_SETTINGS_KV"]) &&
    durableObjects.some(item => item.name === "INGEST_DO" && item.className === "IngestDurableObject");
  if (!valid) {
    throw new DeployError("INVALID_SOURCE", "The release manifest declares bindings this installer does not recognise.", 409);
  }
  return { durableObjects, d1, kv, analyticsEngine };
}

export interface FreshInstallInput {
  accountId: string;
  databaseId: string;
  kvNamespaceId: string;
  analyticsEngine: boolean;
  mainSecret: string;
  adminPassword: string;
}

export interface FreshInstallUpload {
  mainModule: string;
  compatibilityDate: string;
  compatibilityFlags: string[];
  bindings: Array<Record<string, unknown>>;
  migrations: WorkerMigrations;
  assetConfig: { html_handling?: string; not_found_handling?: string };
  crons: string[];
  analyticsEngineDatasets: string[];
}

/**
 * Bindings for the very first Worker upload, derived from the verified
 * release manifest (the same wrangler config the maintainer deploys with).
 * Without Analytics Engine the datasets are left unbound and the app is told
 * so, exactly like the main repository's own deploy script does.
 */
export function planFreshInstall(release: ReleaseArtifact, input: FreshInstallInput): FreshInstallUpload {
  const sha = release.release.sha;
  if (!/^[a-f0-9]{40}$/.test(sha) ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.databaseId) ||
      !/^[a-f0-9]{32}$/.test(input.kvNamespaceId) || !/^[a-f0-9]{32}$/.test(input.accountId) ||
      input.mainSecret.length < 32 || input.adminPassword.length < 12) {
    throw new DeployError("INVALID_SOURCE", "Incomplete inputs for a new installation.");
  }
  const declared = manifestBindings(release);
  const config = release.manifest.config;
  const vars = Object.entries(config.vars ?? {});
  if (vars.some(([name, value]) => !NAME.test(name) || typeof value !== "string")) {
    throw new DeployError("INVALID_SOURCE", "The release manifest declares invalid variables.", 409);
  }
  const bindings: Array<Record<string, unknown>> = [
    { type: "d1", name: "DB", id: input.databaseId },
    { type: "kv_namespace", name: "SITE_SETTINGS_KV", namespace_id: input.kvNamespaceId },
    ...declared.durableObjects.map(item => ({ type: "durable_object_namespace", name: item.name, class_name: item.className })),
    { type: "assets", name: "ASSETS" },
    ...(input.analyticsEngine
      ? declared.analyticsEngine.map(item => ({ type: "analytics_engine", name: item.binding, dataset: item.dataset }))
      : []),
    ...vars.map(([name, text]) => ({ type: "plain_text", name, text })),
    input.analyticsEngine
      ? { type: "plain_text", name: "INSIGHTFLARE_AE_ACCOUNT_ID", text: input.accountId }
      : { type: "plain_text", name: "INSIGHTFLARE_ANALYTICS_ENGINE_DISABLED", text: "1" },
    { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: sha },
    { type: "secret_text", name: "MAIN_SECRET", text: input.mainSecret },
    { type: "secret_text", name: "BOOTSTRAP_ADMIN_PASSWORD", text: input.adminPassword }
  ];
  const migrations = planDurableObjectMigrations(null, release.artifact.config.migrations);
  if (!migrations) throw new DeployError("INVALID_SOURCE", "The release has no Durable Object migrations.", 409);
  const assetConfig = (config as { assetConfig?: FreshInstallUpload["assetConfig"] }).assetConfig ??
    { html_handling: "auto-trailing-slash", not_found_handling: "none" };
  return {
    mainModule: config.mainModule,
    compatibilityDate: config.compatibilityDate,
    compatibilityFlags: [...config.compatibilityFlags],
    bindings,
    migrations,
    assetConfig,
    crons: [...(config.crons ?? [])],
    analyticsEngineDatasets: declared.analyticsEngine.map(item => item.dataset)
  };
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Readable random password (no 0/O/1/l/I), ~5.8 bits per character. */
export function generatePassword(length = 20): string {
  const out: string[] = [];
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]!);
    }
  }
  return out.join("");
}

export function generateRootSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
