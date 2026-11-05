import { DeployError } from "../types";
import type { Deployment } from "./plan";
import type { ReleaseArtifact } from "./public-release";
import { planD1Migrations } from "./d1-migrations";
import type { D1MigrationSnapshot } from "./d1-migrations";
import type { WorkerBinding } from "../providers/cloudflare/client";

const ID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const ACCOUNT = /^[a-f0-9]{32}$/i;

export interface D1PreviewReader {
  settings(accountId: string, workerName: string): Promise<WorkerBinding[]>;
  d1MigrationSnapshot(accountId: string, databaseId: string): Promise<D1MigrationSnapshot>;
}

export interface D1MigrationPreview {
  sourceSha: string;
  artifactDigest: string;
  databaseId: string;
  deploymentKind: Deployment["kind"];
  totalMigrations: number;
  appliedMigrations: number;
  pendingMigrations: number;
  initialInstall: boolean;
  destructiveUpgrade: boolean;
  needsConfirmation: boolean;
  maintenanceRequired: boolean;
  maintenanceVerified: false;
  maintenanceWriteSources: string[];
  recoveryBookmarkAvailable: true;
  reviewedPlanDigest: string;
  pending: Array<{ name: string; sha256: string; sqlBytes: number; destructive: boolean; warnings: string[] }>;
  executionAvailable: false;
  blockers: string[];
}

/**
 * Builds a browser-safe preview from verified official SQL files, confirmed
 * account selection and a live D1 read. Never returns raw bookmark, SQL,
 * secret text or unrelated app data. Never executes D1 migration SQL.
 */
export async function inspectD1MigrationPreview(
  reader: D1PreviewReader,
  observed: Deployment,
  databaseId: string,
  release: ReleaseArtifact
): Promise<D1MigrationPreview> {
  const accountId = observed?.accountId;
  if (!ACCOUNT.test(accountId ?? "") || !ID.test(databaseId ?? "")) {
    throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare account or D1 database identifier.");
  }
  if (observed.kind === "conflict") {
    throw new DeployError("UNAVAILABLE", "Unknown Worker identity blocks database migration planning.", 409);
  }
  if (observed.kind !== "not-installed") {
    const bindings = await reader.settings(accountId, observed.workerName);
    const d1 = bindings.filter(b => b.name === "DB" && b.type === "d1");
    if (d1.length !== 1 ||
        typeof d1[0]?.database_id !== "string" ||
        d1[0].database_id.toLowerCase() !== databaseId.toLowerCase()) {
      throw new DeployError("UNAVAILABLE",
        "The chosen database does not match the existing InsightFlare Worker's D1 binding.", 409);
    }
  }
  const snapshot = await reader.d1MigrationSnapshot(accountId, databaseId);
  const plan = await planD1Migrations(release, snapshot);
  // This is a reporting contract, NOT a claim of a maintenance lock.
  // Real upgrades require a runtime writer-quiescence handshake in the
  // InsightFlare Worker/INGEST_DO/scheduled services, which does not yet exist.
  const maintenanceRequired = observed.kind !== "not-installed" && plan.pending.length > 0;
  const maintenanceWriteSources = maintenanceRequired
    ? [
      "HTTP and server-function database writes",
      "IngestDurableObject buffered D1 flushes and pending alarms",
      "Scheduled analytics rollups, ingestion sweeps and database maintenance",
      "Any external clients still writing through the old Worker"
    ]
    : [];
  return {
    sourceSha: plan.sourceSha,
    artifactDigest: plan.artifactDigest,
    databaseId: plan.databaseId,
    deploymentKind: observed.kind,
    totalMigrations: plan.appliedNames.length + plan.pending.length,
    appliedMigrations: plan.appliedNames.length,
    pendingMigrations: plan.pending.length,
    initialInstall: plan.initialInstall,
    destructiveUpgrade: plan.destructiveUpgrade,
    needsConfirmation: plan.needsConfirmation,
    maintenanceRequired,
    maintenanceVerified: false,
    maintenanceWriteSources,
    recoveryBookmarkAvailable: true,
    reviewedPlanDigest: plan.reviewedPlanDigest,
    pending: plan.pending.map(item => ({ ...item, warnings: [...item.warnings] })),
    executionAvailable: false,
    blockers: [
      ...(observed.kind === "legacy-candidate"
        ? ["Legacy Worker adoption requires explicit review before migration or promotion."] : []),
      ...(maintenanceRequired ? [
        "Existing InsightFlare writers are not quiesced. A D1 lease alone cannot stop Worker, Durable Object and scheduled writes."
      ] : []),
      "D1 migration execution and Worker activation are not enabled in this control plane yet."
    ]
  };
}
