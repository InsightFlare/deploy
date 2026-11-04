import { DeployError } from "../types";
import type { WorkerVersion } from "../providers/cloudflare/client";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

export interface BindingOverride {
  name: string;
  binding: Record<string, unknown>;
}

/**
 * Inherit every binding from one exact, already-reviewed Worker version.
 * This avoids reading or retransmitting secret values and avoids accidentally
 * inheriting from a newer, merely uploaded (but not deployed) version.
 */
export function inheritWorkerBindings(
  activeVersion: Pick<WorkerVersion, "id" | "bindings">,
  overrides: BindingOverride[] = []
): Array<Record<string, unknown>> {
  if (!UUID.test(activeVersion.id) || !Array.isArray(activeVersion.bindings)) {
    throw new DeployError("UNAVAILABLE", "The active Worker version does not expose a verifiable binding inventory.", 409);
  }
  const byName = new Map<string, NonNullable<WorkerVersion["bindings"]>[number]>();
  for (const binding of activeVersion.bindings) {
    if (!binding || !NAME.test(binding.name) || byName.has(binding.name)) {
      throw new DeployError("UNAVAILABLE", "The active Worker version contains invalid or duplicate binding names.", 409);
    }
    byName.set(binding.name, binding);
  }
  const replacementByName = new Map<string, Record<string, unknown>>();
  for (const override of overrides) {
    if (!override || !NAME.test(override.name) || !byName.has(override.name) ||
      !override.binding || typeof override.binding !== "object" ||
      override.binding.name !== override.name || typeof override.binding.type !== "string" ||
      override.binding.type === "inherit" || replacementByName.has(override.name)) {
      throw new DeployError("INVALID_SOURCE", "A binding override must replace one existing binding exactly once.");
    }
    if (["secret_text", "secret_key"].includes(String(override.binding.type)) &&
      ["text", "value", "secret", "key_base64", "key_jwk"].some(key => key in override.binding)) {
      throw new DeployError("INVALID_SOURCE", "Secret values must never be included in a binding override.", 403);
    }
    replacementByName.set(override.name, override.binding);
  }
  return [...byName.keys()].map(name => replacementByName.get(name) ?? ({
    type: "inherit",
    name,
    version_id: activeVersion.id
  }));
}

/**
 * Apply the identity marker to the *new* Worker version. Existing secrets and
 * resource bindings stay inherited from the reviewed active version.
 * The marker changes only in the candidate version until explicit promotion.
 */
export function markManagedVersionBindings(
  bindings: Array<Record<string, unknown>>,
  sourceSha: string
): Array<Record<string, unknown>> {
  const sha = sourceSha.toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sha) || !Array.isArray(bindings)) {
    throw new DeployError("INVALID_SOURCE", "A full source SHA and existing bindings are required for version marking.");
  }
  const names = new Set<string>();
  const preserved: Array<Record<string, unknown>> = [];
  for (const binding of bindings) {
    if (!binding || typeof binding.name !== "string" || !NAME.test(binding.name) ||
      typeof binding.type !== "string" || names.has(binding.name)) {
      throw new DeployError("INVALID_SOURCE", "Cannot mark a Worker version with duplicate or invalid bindings.");
    }
    names.add(binding.name);
    if (binding.name === "INSIGHTFLARE_DEPLOYMENT_SHA") {
      // Never inherit an outdated marker or use an arbitrary version marker.
      if (!["plain_text", "inherit"].includes(binding.type)) {
        throw new DeployError("INVALID_SOURCE", "Existing deployment marker has an invalid type.");
      }
      continue;
    }
    preserved.push(binding);
  }
  return [...preserved, {
    name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: sha
  }];
}
