import type { WorkerBinding } from "../providers/cloudflare/client";
import type { DeploymentKind } from "./plan";

export type ResourceDisposition = "create" | "preserve" | "block" | "optional";
export interface ResourceAction {
  binding: string;
  resourceType: string;
  disposition: ResourceDisposition;
  description: string;
}
export interface ResourceReconciliation {
  readyForExecution: false;
  actions: ResourceAction[];
  blockers: string[];
}

interface Specification {
  name: string;
  type: string;
  optional?: true;
  valid: (binding: WorkerBinding) => boolean;
  create: string;
  preserve: string;
}
const uuid = (id?: string) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const hex32 = (id?: string) => typeof id === "string" && /^[a-f0-9]{32}$/i.test(id);

const RESOURCES: Specification[] = [
  {
    name: "DB", type: "d1",
    valid: binding => binding.type === "d1" && uuid(binding.id),
    create: "Create an isolated D1 database and apply reviewed schema migrations.",
    preserve: "Retain this exact D1 database ID and its existing contents."
  },
  {
    name: "SITE_SETTINGS_KV", type: "kv_namespace",
    valid: binding => binding.type === "kv_namespace" && hex32(binding.namespace_id),
    create: "Create a KV namespace for site settings.",
    preserve: "Retain this exact KV namespace and all stored site settings."
  },
  {
    name: "INGEST_DO", type: "durable_object_namespace",
    valid: binding => binding.type === "durable_object_namespace"
      && binding.class_name === "IngestDurableObject" && !binding.script_name,
    create: "Create the IngestDurableObject SQLite namespace using the reviewed Worker migration.",
    preserve: "Preserve the existing Durable Object namespace and all actor state."
  },
  {
    name: "MAIN_SECRET", type: "secret_text",
    valid: binding => binding.type === "secret_text",
    create: "Generate a new cryptographically random secret; never send it to the browser.",
    preserve: "Keep the existing secret binding without retrieving or rotating its value."
  },
  ...["REQUEST_ANALYTICS", "TRAFFIC_ANALYTICS", "EVENT_ANALYTICS"].map(name => ({
    name, type: "analytics_engine", optional: true as const,
    valid: (binding: WorkerBinding) => binding.type === "analytics_engine",
    create: "Create or bind the corresponding Analytics Engine dataset if enabled.",
    preserve: "Retain the analytics dataset binding."
  })),
  {
    name: "ARCHIVE_BUCKET", type: "r2_bucket", optional: true,
    valid: binding => binding.type === "r2_bucket",
    create: "Enable optional R2 archives only at the user's request.",
    preserve: "Retain the existing R2 archive bucket; never delete archived records."
  }
];

/**
 * Pure dry-run reconciliation. In particular:
 * - A missing secret on an existing Worker must NEVER cause regeneration.
 * - A missing database binding must NEVER trigger creation for an update.
 * - An unknown existing Worker is never adopted automatically.
 * - No resource identifiers or secret values are returned to browser clients.
 */
export function planResourceReconciliation(
  kind: DeploymentKind,
  bindings: WorkerBinding[]
): ResourceReconciliation {
  const actions: ResourceAction[] = [];
  const blockers: string[] = [];
  const newInstallation = kind === "not-installed";
  const unsafeIdentity = kind === "conflict";
  const legacy = kind === "legacy-candidate";

  if (unsafeIdentity) blockers.push("Unknown Worker ownership: automatic adoption or resource mutation is forbidden.");
  if (legacy) blockers.push("Legacy instance requires an explicit adoption review before any update.");
  if (!newInstallation && !bindings.length) blockers.push("Worker bindings could not be verified.");

  for (const spec of RESOURCES) {
    const matches = bindings.filter(binding => binding.name === spec.name);
    if (matches.length > 1 || (matches.length === 1 && !spec.valid(matches[0]!))) {
      actions.push({
        binding: spec.name, resourceType: spec.type, disposition: "block",
        description: "This binding has an unexpected type, identifier, or duplicate name. Manual review required."
      });
      blockers.push("Binding " + spec.name + " cannot be safely reconciled.");
      continue;
    }
    if (matches.length) {
      actions.push({
        binding: spec.name, resourceType: spec.type, disposition: unsafeIdentity ? "block" : "preserve",
        description: unsafeIdentity ? "Worker ownership must be established before handling this resource." : spec.preserve
      });
      continue;
    }
    if (spec.name === "MAIN_SECRET" && !newInstallation) {
      const legacyRoots = bindings.filter(binding => binding.name === "DAILY_SALT_SECRET");
      if (legacyRoots.length === 1 && legacyRoots[0]!.type === "secret_text") {
        // The upstream application intentionally falls back to DAILY_SALT_SECRET.
        // Creating MAIN_SECRET here would change the derived session/API-key
        // secrets and invalidate existing credentials after an upgrade.
        actions.push({
          binding: "DAILY_SALT_SECRET", resourceType: "secret_text",
          disposition: unsafeIdentity ? "block" : "preserve",
          description: unsafeIdentity
            ? "Worker ownership must be confirmed before retaining a legacy root secret."
            : "Keep the existing legacy root secret. Do not create MAIN_SECRET or rotate derived credentials."
        });
        continue;
      }
    }
    if (spec.optional) {
      actions.push({ binding: spec.name, resourceType: spec.type, disposition: "optional", description: spec.create });
      continue;
    }
    if (newInstallation) {
      actions.push({ binding: spec.name, resourceType: spec.type, disposition: "create", description: spec.create });
    } else {
      actions.push({
        binding: spec.name, resourceType: spec.type, disposition: "block",
        description: "Existing instance lacks this required binding; automatic replacement is forbidden."
      });
      blockers.push("Required binding " + spec.name + " is missing; cannot safely update.");
    }
  }
  // Preserve *all* additional existing secret_text bindings, not merely the
  // specific root secret known to the current version. This includes legacy
  // bootstrap credentials, session secrets and future secrets introduced by
  // another InsightFlare version. Never retrieve secret values.
  const handled = new Set(actions.map(action => action.binding));
  for (const binding of bindings) {
    if (binding.type !== "secret_text" || handled.has(binding.name)) continue;
    const duplicates = bindings.filter(other => other.name === binding.name);
    const invalid = duplicates.length !== 1;
    actions.push({
      binding: binding.name, resourceType: "secret_text",
      disposition: invalid || unsafeIdentity ? "block" : "preserve",
      description: invalid
        ? "Duplicate secret binding name; manual review required."
        : unsafeIdentity
          ? "Worker ownership must be established before retaining this secret."
          : "Preserve existing secret metadata without reading, replacing or rotating its value."
    });
    if (invalid) blockers.push("Secret binding " + binding.name + " is duplicated.");
    handled.add(binding.name);
  }
  return { readyForExecution: false, actions, blockers };
}
