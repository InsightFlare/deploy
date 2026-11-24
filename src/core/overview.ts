import { DeployError } from "../types";
import type { Deployment } from "./plan";
import type { MainCommit } from "./source";
import type { ReleaseArtifact } from "./public-release";
import { planD1Migrations } from "./d1-migrations";
import { INSTALL_NAMES } from "./install-plan";
import { previewVersionUpgrade } from "./upgrade-versions";
import { installDatabaseReusable, type PipelineClient } from "./pipeline";

export interface OverviewBlocker { code: string; message: string }

/** Everything the review step shows before the user presses Install / Update. */
export interface AccountOverview {
  deployment: { kind: Deployment["kind"]; workerName: string; deployedSha: string | null };
  source: { sha: string; shortSha: string; message: string; committedAt: string | null; url: string } | null;
  release: { sha: string; artifactDigest: string } | null;
  intent: "install" | "update" | null;
  upToDate: boolean;
  /** Existing installations: whether Deploy can (or already did) set up the Analytics Engine reader. */
  analyticsReader?: "configured" | "missing" | "not-bound";
  blockers: OverviewBlocker[];
  install?: {
    workerName: string;
    database: { name: string; action: "create" | "reuse" };
    kvNamespace: { name: string; action: "create" | "reuse" };
    workersDevSubdomain: string | null;
    migrations: number;
    crons: string[];
    analyticsDatasets: string[];
  };
  update?: {
    fromSha: string | null;
    legacyAdoptionRequired: boolean;
    pendingMigrations: number;
    destructiveMigrations: boolean;
    durableObjectMigration: boolean;
  };
}

function blockerOf(error: unknown, code: string): OverviewBlocker {
  return { code, message: error instanceof Error ? error.message : "Unavailable" };
}

export async function accountOverview(input: {
  client: PipelineClient;
  accountId: string;
  observed: Deployment;
  source: MainCommit | null;
  loadLatestRelease(): Promise<ReleaseArtifact>;
}): Promise<AccountOverview> {
  const { client, accountId, observed, source } = input;
  const overview: AccountOverview = {
    deployment: { kind: observed.kind, workerName: observed.workerName, deployedSha: observed.deployedSha },
    source: source ? { sha: source.sha, shortSha: source.shortSha, message: source.message, committedAt: source.committedAt, url: source.url } : null,
    release: null,
    intent: observed.kind === "not-installed" ? "install"
      : observed.kind === "managed" || observed.kind === "legacy-candidate" ? "update" : null,
    upToDate: false,
    blockers: []
  };
  if (observed.kind === "conflict") {
    overview.blockers.push({ code: "WORKER_CONFLICT", message: "A Worker named insightflare exists but is not a recognisable InsightFlare installation." });
    return overview;
  }

  let release: ReleaseArtifact;
  try {
    release = await input.loadLatestRelease();
  } catch (error) {
    overview.blockers.push(blockerOf(error, error instanceof DeployError && error.status === 409 ? "NIGHTLY_PENDING" : "RELEASE_UNAVAILABLE"));
    return overview;
  }
  overview.release = { sha: release.release.sha, artifactDigest: release.manifest.artifactDigest };

  if (overview.intent === "install") {
    const [databases, namespaces, subdomain] = await Promise.all([
      client.d1Databases(accountId), client.kvNamespaces(accountId), client.workersSubdomain(accountId)
    ]);
    const database = databases.find(db => db.name === INSTALL_NAMES.database);
    if (database) {
      if (!(await installDatabaseReusable(client, accountId, database.uuid, release))) {
        overview.blockers.push({ code: "DATABASE_TAKEN", message: "A D1 database named insightflare already contains data." });
      }
    }
    const bindings = release.manifest.config.bindings as { analyticsEngine?: Array<{ dataset: string }> };
    overview.install = {
      workerName: INSTALL_NAMES.worker,
      database: { name: INSTALL_NAMES.database, action: database ? "reuse" : "create" },
      kvNamespace: {
        name: INSTALL_NAMES.kvNamespace,
        action: namespaces.some(ns => ns.title === INSTALL_NAMES.kvNamespace) ? "reuse" : "create"
      },
      workersDevSubdomain: subdomain,
      migrations: release.migrations.length,
      crons: release.manifest.config.crons ?? [],
      analyticsDatasets: (bindings.analyticsEngine ?? []).map(item => item.dataset)
    };
    return overview;
  }

  const bindings = await client.settings(accountId, observed.workerName);
  overview.analyticsReader = !bindings.some(binding => binding.type === "analytics_engine") ? "not-bound"
    : bindings.some(binding => binding.name === "INSIGHTFLARE_AE_API_TOKEN") ? "configured" : "missing";
  if (observed.kind === "managed" && observed.deployedSha === release.release.sha) {
    overview.upToDate = true;
    // Up to date, but the reader can still be configured by running an update.
    if (overview.analyticsReader === "missing") {
      overview.update = { fromSha: observed.deployedSha, legacyAdoptionRequired: false, pendingMigrations: 0,
        destructiveMigrations: false, durableObjectMigration: false };
    }
    return overview;
  }
  try {
    const preview = await previewVersionUpgrade(client, accountId, observed, release);
    const plan = await planD1Migrations(release, await client.d1MigrationSnapshot(accountId, preview.databaseId));
    overview.update = {
      fromSha: observed.deployedSha,
      legacyAdoptionRequired: preview.legacyAdoptionRequired,
      pendingMigrations: plan.pending.length,
      destructiveMigrations: plan.destructiveUpgrade,
      durableObjectMigration: preview.requiresDoMigration
    };
  } catch (error) {
    overview.blockers.push(blockerOf(error, "UPDATE_BLOCKED"));
  }
  return overview;
}
