import { DeployError } from "../types";
import type { WorkerMigrationStep, WorkerMigrations } from "../providers/cloudflare/client";

export interface TaggedDurableObjectMigration extends WorkerMigrationStep {
  tag: string;
}

const TAG = /^[A-Za-z0-9_.-]{1,128}$/;

function cleanStep(migration: TaggedDurableObjectMigration): WorkerMigrationStep {
  const step: WorkerMigrationStep = {};
  if (migration.deleted_classes?.length) step.deleted_classes = [...migration.deleted_classes];
  if (migration.new_classes?.length) step.new_classes = [...migration.new_classes];
  if (migration.new_sqlite_classes?.length) step.new_sqlite_classes = [...migration.new_sqlite_classes];
  if (migration.renamed_classes?.length) step.renamed_classes = migration.renamed_classes.map(item => ({ ...item }));
  if (migration.transferred_classes?.length) step.transferred_classes = migration.transferred_classes.map(item => ({ ...item }));
  if (Object.keys(step).length === 0) {
    throw new DeployError("INVALID_SOURCE", "An empty Durable Object migration step is not allowed.");
  }
  return step;
}

/**
 * Convert wrangler's ordered migration tags into the multi-step Workers API
 * contract. Existing Workers must match a known migration tag; never guess
 * whether an unknown namespace lifecycle can be skipped.
 */
export function planDurableObjectMigrations(
  currentTag: string | null,
  configured: TaggedDurableObjectMigration[]
): WorkerMigrations | null {
  if (!Array.isArray(configured) || configured.length < 1 || configured.length > 50) {
    throw new DeployError("INVALID_SOURCE", "The source build has no valid Durable Object migration history.");
  }
  const seen = new Set<string>();
  for (const migration of configured) {
    if (!migration || !TAG.test(migration.tag) || seen.has(migration.tag)) {
      throw new DeployError("INVALID_SOURCE", "Durable Object migration tags must be valid and unique.");
    }
    seen.add(migration.tag);
  }

  const currentIndex = currentTag === null ? -1 : configured.findIndex(item => item.tag === currentTag);
  if (currentTag !== null && currentIndex < 0) {
    throw new DeployError("UNAVAILABLE", "The deployed Durable Object migration tag is not present in this source build; automatic migration is blocked.", 409);
  }
  if (currentIndex === configured.length - 1) return null;

  const pending = configured.slice(currentIndex + 1);
  const steps = pending.map(cleanStep);
  const newTag = pending[pending.length - 1]?.tag;
  if (!newTag) throw new DeployError("INVALID_SOURCE", "The Durable Object migration plan has no target tag.");
  return {
    ...(currentTag === null ? {} : { old_tag: currentTag }),
    new_tag: newTag,
    steps
  };
}
