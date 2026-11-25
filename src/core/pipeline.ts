import { DeployError, CF_ANALYTICS_ENGINE_NOT_ENABLED } from "../types";
import type { CloudflareClient } from "../providers/cloudflare/client";
import { discoverDeployment } from "../providers/cloudflare/discovery";
import type { ReleaseArtifact } from "./public-release";
import { planD1Migrations } from "./d1-migrations";
import { applyManualD1Migrations } from "./d1-manual";
import { INSTALL_NAMES, planFreshInstall, generateRootSecret } from "./install-plan";
import { previewVersionUpgrade, activateStagedUpgrade, findVerifiedStagedCandidates } from "./upgrade-versions";
import { stageReviewedUpgrade, analyticsEngineSwitchedOff } from "./stage-artifact";
import { activeVersionId } from "./version-safety";

/**
 * One-click install / update, executed by the control plane one step at a
 * time. Every step is idempotent and checkpoints what it created in
 * `run.state`, so a closed tab, an expired session or a failed request can be
 * resumed from the same place. Nothing here talks to the browser directly.
 */

export type PipelineIntent = "install" | "update";
export type InstallStepId = "verify" | "database" | "kv" | "migrate" | "worker" | "schedules" | "subdomain" | "domain" | "analytics" | "health";
export type UpdateStepId = "verify" | "migrate" | "stage" | "activate" | "domain" | "analytics" | "health";

/** A hostname of one of the account's zones to route to the Worker. */
export interface CustomDomain { zoneId: string; zoneName: string; hostname: string }
export type PipelineStepId = InstallStepId | UpdateStepId;
export type StepStatus = "pending" | "done" | "skipped" | "warning" | "failed";
export type PipelinePhase = "running" | "succeeded" | "failed";

/** Machine-readable outcome; the UI localises `code`, `message` is English detail. */
export interface StepNote {
  code: string;
  params?: Record<string, string | number>;
  message?: string;
}

export interface PipelineStep {
  id: PipelineStepId;
  status: StepStatus;
  note?: StepNote;
}

export interface PipelineState {
  databaseId?: string;
  kvNamespaceId?: string;
  migrationsTotal?: number;
  migrationsApplied?: number;
  analyticsEngine?: "enabled" | "disabled";
  workerUrl?: string | null;
  previousSha?: string | null;
  previousVersionId?: string;
  stagedVersionId?: string;
  activatedVersionId?: string;
  healthAttempts?: number;
  rolledBack?: boolean;
  /** Set once a version upload was attempted, so a retry first looks for it. */
  stageAttempted?: boolean;
  /** https URL of the custom domain once it is attached. */
  customUrl?: string;
}

export interface PipelineRun {
  id: string;
  intent: PipelineIntent;
  /** The installation already runs this release; the run only changes its configuration. */
  configurationOnly?: true;
  accountId: string;
  sourceSha: string;
  artifactDigest: string;
  legacyAdoptionApproved: boolean;
  /** The user chose the administrator password, so it is never shown back. */
  customAdminPassword?: boolean;
  /** The OAuth grant lacks API-token management, so the AE reader is left for manual setup. */
  analyticsReaderNotAuthorized?: boolean;
  /** Optional custom domain chosen on the review step. */
  customDomain?: CustomDomain;
  createdAt: number;
  updatedAt: number;
  phase: PipelinePhase;
  steps: PipelineStep[];
  state: PipelineState;
  failure?: { step: PipelineStepId; code: string; message: string };
}

export const INSTALL_STEPS: InstallStepId[] = ["verify", "database", "kv", "migrate", "worker", "schedules", "subdomain", "domain", "analytics", "health"];
export const UPDATE_STEPS: UpdateStepId[] = ["verify", "migrate", "stage", "activate", "domain", "analytics", "health"];
export const HEALTH_ATTEMPTS = 8;

export type PipelineClient = Pick<CloudflareClient,
  | "requireAccount" | "workerNames" | "settings" | "workerExists" | "analyticsEngineStatus" | "d1Databases" | "d1MigrationSnapshot" | "d1ApplyVerifiedMigration" | "d1InitializeDatabase" | "d1TableHasRows"
  | "createD1Database" | "kvNamespaces" | "createKvNamespace" | "uploadWorkerAssets" | "uploadNewWorkerScript"
  | "putWorkerSchedules" | "workersSubdomain" | "enableWorkerSubdomain" | "putWorkerSecret"
  | "accountTokenPermissionGroups" | "createAccountToken" | "workerDomains" | "attachWorkerDomain" | "zones" | "workerInfo" | "workerDeployments"
  | "workerVersionDetails" | "workerVersions" | "uploadWorkerVersion" | "createWorkerDeployment">;

export interface PipelineDeps {
  client: PipelineClient;
  /** Verified official Nightly archive for exactly this SHA and digest. */
  loadRelease(sha: string, artifactDigest: string): Promise<ReleaseArtifact>;
  /** Plain bootstrap password for this run (install only). */
  adminPassword(): Promise<string>;
  /** true when GET {url}/healthz answers as InsightFlare. */
  checkHealth(url: string): Promise<boolean>;
  now(): number;
  /** Pause before re-checking eventually consistent Cloudflare metadata (tests use 0). */
  retryDelayMs?: number;
}

/**
 * A database named like the installation is adopted when it is empty, or when
 * it was only migrated by an earlier, unfinished install: every ledger entry is
 * an official migration and no user account exists yet. Anything else may hold
 * the data of an earlier installation whose root secret is gone; never guess.
 */
export async function installDatabaseReusable(
  client: Pick<PipelineClient, "d1MigrationSnapshot" | "d1TableHasRows">,
  accountId: string, databaseId: string, release: ReleaseArtifact
): Promise<boolean> {
  const snapshot = await client.d1MigrationSnapshot(accountId, databaseId);
  if ((await planD1Migrations(release, snapshot)).initialInstall) return true;
  const official = new Set(release.migrations.map(item => item.name));
  if (snapshot.appliedNames === null || !snapshot.appliedNames.every(name => official.has(name))) return false;
  const ownTables = new Set(["d1_migrations", ...snapshot.tableNames.filter(name => name.startsWith("sqlite_") || name.startsWith("_cf_"))]);
  if (!snapshot.tableNames.some(name => !ownTables.has(name))) return true;
  return snapshot.tableNames.includes("users") && !(await client.d1TableHasRows(accountId, databaseId, "users"));
}

export function createRun(input: {
  id: string; intent: PipelineIntent; accountId: string; sourceSha: string;
  artifactDigest: string; legacyAdoptionApproved: boolean; now: number; customAdminPassword?: boolean;
  analyticsReaderAuthorized?: boolean;
  configurationOnly?: boolean;
  customDomain?: CustomDomain;
}): PipelineRun {
  if (!/^[a-f0-9]{32}$/.test(input.accountId) || !/^[a-f0-9]{40}$/.test(input.sourceSha) ||
      !/^[a-f0-9]{64}$/.test(input.artifactDigest)) {
    throw new DeployError("INVALID_SOURCE", "A reviewed account, source commit and artifact digest are required.");
  }
  const ids: PipelineStepId[] = input.intent === "install" ? INSTALL_STEPS : UPDATE_STEPS;
  return {
    id: input.id, intent: input.intent, accountId: input.accountId,
    ...(input.intent === "update" && input.configurationOnly ? { configurationOnly: true } : {}),
    sourceSha: input.sourceSha, artifactDigest: input.artifactDigest,
    legacyAdoptionApproved: input.legacyAdoptionApproved,
    ...(input.intent === "install" && input.customAdminPassword ? { customAdminPassword: true } : {}),
    ...(input.analyticsReaderAuthorized === false ? { analyticsReaderNotAuthorized: true } : {}),
    ...(input.customDomain ? { customDomain: { ...input.customDomain } } : {}),
    createdAt: input.now, updatedAt: input.now, phase: "running",
    steps: ids.map(id => ({ id, status: "pending" })), state: {}
  };
}

/** Make a failed run resumable from the step that failed. */
export function retryRun(run: PipelineRun, now: number): PipelineRun {
  if (run.phase !== "failed" || run.state.rolledBack) {
    throw new DeployError("UNAVAILABLE", "Only a failed run that was not rolled back can be retried.", 409);
  }
  return {
    ...run, phase: "running", updatedAt: now, failure: undefined,
    steps: run.steps.map(step => step.status === "failed" ? { id: step.id, status: "pending" } : step)
  };
}

type StepResult =
  | { status: "done" | "skipped" | "warning"; note?: StepNote; state?: PipelineState }
  /** Made progress but the step is not finished yet (call advance again). */
  | { status: "again"; note?: StepNote; state?: PipelineState };

function finish(run: PipelineRun, now: number): PipelineRun {
  const open = run.steps.some(step => step.status === "pending");
  return { ...run, updatedAt: now, phase: open ? run.phase : run.phase === "failed" ? "failed" : "succeeded" };
}

/** Runs the next pending step once. Never throws for step failures: they are recorded on the run. */
export async function advanceRun(run: PipelineRun, deps: PipelineDeps): Promise<PipelineRun> {
  if (run.phase !== "running") return run;
  const index = run.steps.findIndex(step => step.status === "pending");
  if (index < 0) return finish(run, deps.now());
  const step = run.steps[index]!;
  const ctx = new StepContext(run, deps);
  let result: StepResult;
  try {
    result = await ctx.execute(step.id);
  } catch (error) {
    const code = error instanceof DeployError ? error.code : "UPSTREAM_UNAVAILABLE";
    const message = error instanceof Error ? error.message : "The step failed.";
    const rolledBack = ctx.state.rolledBack === true;
    return {
      ...run, phase: "failed", updatedAt: deps.now(), state: { ...ctx.state },
      steps: run.steps.map((item, i) => i === index
        ? { id: item.id, status: "failed", note: { code: rolledBack ? "ROLLED_BACK" : code, message } } : item),
      failure: { step: step.id, code: rolledBack ? "ROLLED_BACK" : code, message }
    };
  }
  const state = { ...ctx.state, ...(result.state ?? {}) };
  const steps = run.steps.map((item, i) => {
    if (i !== index) return item;
    if (result.status === "again") return { id: item.id, status: "pending" as const, ...(result.note ? { note: result.note } : {}) };
    return { id: item.id, status: result.status, ...(result.note ? { note: result.note } : {}) };
  });
  // "Nothing to do" short-circuit: an update to the commit already deployed.
  // Nothing to upload when the installation already runs this commit; configuration
  // steps (the Analytics Engine reader, then the health check) still run.
  const settled = ctx.skipRemaining
    ? steps.map(item => item.status === "pending" && item.id !== "domain" && item.id !== "analytics" && item.id !== "health"
      ? { id: item.id, status: "skipped" as const, note: { code: "ALREADY_CURRENT" } } : item)
    : steps;
  return finish({ ...run, state, steps: settled }, deps.now());
}

class StepContext {
  state: PipelineState;
  skipRemaining = false;
  private release?: ReleaseArtifact;

  constructor(private readonly run: PipelineRun, private readonly deps: PipelineDeps) {
    this.state = { ...run.state };
  }

  private get client() { return this.deps.client; }
  private get account() { return this.run.accountId; }

  private async loadRelease(): Promise<ReleaseArtifact> {
    this.release ??= await this.deps.loadRelease(this.run.sourceSha, this.run.artifactDigest);
    return this.release;
  }

  async execute(id: PipelineStepId): Promise<StepResult> {
    if (this.run.intent === "install") {
      switch (id) {
        case "verify": return this.verifyInstall();
        case "database": return this.database();
        case "kv": return this.kv();
        case "migrate": return this.migrate();
        case "worker": return this.worker();
        case "schedules": return this.schedules();
        case "subdomain": return this.subdomain();
        case "domain": return this.domain();
        case "analytics": return this.analytics();
        case "health": return this.health(false);
      }
    } else {
      switch (id) {
        case "verify": return this.verifyUpdate();
        case "migrate": return this.migrate();
        case "stage": return this.stage();
        case "activate": return this.activate();
        case "domain": return this.domain();
        case "analytics": return this.analytics();
        case "health": return this.health(true);
      }
    }
    throw new DeployError("INVALID_SOURCE", "Unknown step " + id);
  }

  /* ----------------------------- install ----------------------------- */

  private async verifyInstall(): Promise<StepResult> {
    const release = await this.loadRelease();
    const observed = await discoverDeployment(this.client, this.account);
    if (observed.kind !== "not-installed") {
      throw new DeployError("UNAVAILABLE", "A Worker named insightflare already exists in this account; use update instead.", 409);
    }
    const existing = (await this.client.d1Databases(this.account)).find(db => db.name === INSTALL_NAMES.database);
    if (existing && !(await this.databaseIsReusable(existing.uuid, release))) {
      throw new DeployError("UNAVAILABLE",
        "A D1 database named insightflare already contains data. Delete or rename it before installing.", 409);
    }
    return { status: "done", state: { migrationsTotal: release.migrations.length } };
  }

  private databaseIsReusable(databaseId: string, release: ReleaseArtifact): Promise<boolean> {
    return installDatabaseReusable(this.client, this.account, databaseId, release);
  }

  private async database(): Promise<StepResult> {
    if (this.state.databaseId) return { status: "done" };
    const existing = (await this.client.d1Databases(this.account)).find(db => db.name === INSTALL_NAMES.database);
    if (existing) {
      return { status: "done", note: { code: "REUSED", params: { name: existing.name } }, state: { databaseId: existing.uuid } };
    }
    const created = await this.client.createD1Database(this.account, INSTALL_NAMES.database);
    return { status: "done", note: { code: "CREATED", params: { name: created.name } }, state: { databaseId: created.uuid } };
  }

  private async kv(): Promise<StepResult> {
    if (this.state.kvNamespaceId) return { status: "done" };
    const existing = (await this.client.kvNamespaces(this.account)).find(ns => ns.title === INSTALL_NAMES.kvNamespace);
    if (existing) {
      return { status: "done", note: { code: "REUSED", params: { name: existing.title } }, state: { kvNamespaceId: existing.id } };
    }
    const created = await this.client.createKvNamespace(this.account, INSTALL_NAMES.kvNamespace);
    return { status: "done", note: { code: "CREATED", params: { name: created.title } }, state: { kvNamespaceId: created.id } };
  }

  private async worker(): Promise<StepResult> {
    const release = await this.loadRelease();
    const names = await this.client.workerNames(this.account);
    if (names.includes(INSTALL_NAMES.worker)) {
      // An earlier attempt may have uploaded it and lost the response.
      const observed = await discoverDeployment(this.client, this.account);
      if (observed.kind === "managed" && observed.deployedSha === this.run.sourceSha) {
        return { status: "done", note: { code: "REUSED", params: { name: INSTALL_NAMES.worker } } };
      }
      throw new DeployError("UNAVAILABLE", "A different Worker named insightflare appeared during installation.", 409);
    }
    if (!this.state.databaseId || !this.state.kvNamespaceId) {
      throw new DeployError("UNAVAILABLE", "Database and KV namespace must be ready before the Worker is uploaded.", 409);
    }
    const adminPassword = await this.deps.adminPassword();
    const upload = async (analyticsEngine: boolean) => {
      const plan = planFreshInstall(release, {
        accountId: this.account, databaseId: this.state.databaseId!, kvNamespaceId: this.state.kvNamespaceId!,
        analyticsEngine, mainSecret: generateRootSecret(), adminPassword
      });
      // Re-registering the asset manifest is cheap when every hash is already uploaded.
      const jwt = await this.client.uploadWorkerAssets(this.account, INSTALL_NAMES.worker, release.artifact.assets);
      await this.client.uploadNewWorkerScript(this.account, INSTALL_NAMES.worker, {
        mainModule: plan.mainModule,
        compatibilityDate: plan.compatibilityDate,
        compatibilityFlags: plan.compatibilityFlags,
        modules: release.artifact.modules,
        bindings: plan.bindings,
        migrations: plan.migrations,
        assets: { jwt, config: plan.assetConfig as never },
        observability: { enabled: true, logs: { enabled: true, invocation_logs: true } },
        tags: ["insightflare-deploy"]
      });
    };
    try {
      await upload(true);
      return { status: "done", state: { analyticsEngine: "enabled" } };
    } catch (error) {
      if (!(error instanceof DeployError) || error.cloudflareCode !== CF_ANALYTICS_ENGINE_NOT_ENABLED) throw error;
    }
    await upload(false);
    return { status: "warning", note: { code: "AE_NOT_ENABLED" }, state: { analyticsEngine: "disabled" } };
  }

  private async schedules(): Promise<StepResult> {
    const release = await this.loadRelease();
    const crons = release.manifest.config.crons ?? [];
    if (!crons.length) return { status: "skipped" };
    await this.client.putWorkerSchedules(this.account, INSTALL_NAMES.worker, crons);
    return { status: "done", note: { code: "CRONS", params: { count: crons.length } } };
  }

  private async subdomain(): Promise<StepResult> {
    const subdomain = await this.client.workersSubdomain(this.account);
    if (!subdomain) {
      return { status: "warning", note: { code: "WORKERS_DEV_MISSING" }, state: { workerUrl: null } };
    }
    await this.client.enableWorkerSubdomain(this.account, INSTALL_NAMES.worker);
    const url = `https://${INSTALL_NAMES.worker}.${subdomain}.workers.dev`;
    return { status: "done", note: { code: "URL", params: { url } }, state: { workerUrl: url } };
  }

  /**
   * Routes the chosen hostname to the Worker. Failing here does not undo the
   * deployment: InsightFlare already serves on workers.dev, so it is a warning.
   */
  private async domain(): Promise<StepResult> {
    const target = this.run.customDomain;
    if (!target) return { status: "skipped" };
    const url = "https://" + target.hostname;
    const attached = await this.client.workerDomains(this.account, INSTALL_NAMES.worker);
    if (attached.some(item => item.hostname === target.hostname)) {
      return { status: "done", note: { code: "DOMAIN_ATTACHED", params: { host: target.hostname } }, state: { customUrl: url } };
    }
    try {
      await this.client.attachWorkerDomain(this.account, INSTALL_NAMES.worker, target.zoneId, target.hostname);
    } catch (error) {
      return { status: "warning", note: { code: "DOMAIN_FAILED", params: { host: target.hostname },
        message: error instanceof Error ? error.message : undefined } };
    }
    return { status: "done", note: { code: "DOMAIN_ATTACHED", params: { host: target.hostname } }, state: { customUrl: url } };
  }

  /** Account-owned token that can only read Analytics Engine, written as a Worker secret. */
  private async analytics(): Promise<StepResult> {
    let needsAccountId = false;
    if (this.run.intent === "install") {
      if (this.state.analyticsEngine !== "enabled") return { status: "skipped", note: { code: "AE_NOT_ENABLED" } };
    } else {
      // Any installation with Analytics Engine bound but no deployment-managed reader gets one.
      const bindings = await this.client.settings(this.account, INSTALL_NAMES.worker);
      const bound = this.state.analyticsEngine === "enabled" || bindings.some(binding => binding.type === "analytics_engine");
      if (!bound) {
        return { status: "skipped", ...(this.state.analyticsEngine === "disabled" ? { note: { code: "AE_NOT_ENABLED" } } : {}) };
      }
      if (bindings.some(binding => binding.name === "INSIGHTFLARE_AE_API_TOKEN")) {
        return { status: "skipped", note: { code: "AE_READER_PRESENT" } };
      }
      needsAccountId = !bindings.some(binding => binding.name === "INSIGHTFLARE_AE_ACCOUNT_ID");
    }
    if (this.run.analyticsReaderNotAuthorized) {
      return { status: "warning", note: { code: "AE_READER_NOT_AUTHORIZED" } };
    }
    try {
      const groups = await this.client.accountTokenPermissionGroups(this.account);
      const read = groups.find(group => group.name === "Account Analytics Read");
      if (!read) throw new DeployError("UNAVAILABLE", "The Account Analytics Read permission is not available to this authorization.", 403);
      const token = await this.client.createAccountToken(this.account, "InsightFlare Analytics Engine reader", [read.id]);
      if (needsAccountId) {
        await this.client.putWorkerSecret(this.account, INSTALL_NAMES.worker, "INSIGHTFLARE_AE_ACCOUNT_ID", this.account);
      }
      await this.client.putWorkerSecret(this.account, INSTALL_NAMES.worker, "INSIGHTFLARE_AE_API_TOKEN", token.value);
      return { status: "done", note: { code: "AE_READER_CONFIGURED" } };
    } catch (error) {
      // Analytics keeps collecting; only the request-observation views need this.
      return { status: "warning", note: { code: "AE_READER_MANUAL", message: error instanceof Error ? error.message : undefined } };
    }
  }

  /* ------------------------------ update ------------------------------ */

  private async verifyUpdate(): Promise<StepResult> {
    const release = await this.loadRelease();
    let observed = await discoverDeployment(this.client, this.account);
    // Cloudflare's metadata can briefly lose a Worker right after it changed; look again.
    for (let attempt = 0; attempt < 2 && observed.kind === "not-installed"; attempt++) {
      await new Promise(resolve => setTimeout(resolve, this.deps.retryDelayMs ?? 3000));
      observed = await discoverDeployment(this.client, this.account);
    }
    if (observed.kind !== "managed" && observed.kind !== "legacy-candidate") {
      throw new DeployError("UNAVAILABLE", "No InsightFlare installation that can be updated was found.", 409);
    }
    if (observed.kind === "legacy-candidate" && !this.run.legacyAdoptionApproved) {
      throw new DeployError("UNAVAILABLE", "Adopting the existing InsightFlare Worker must be approved first.", 409);
    }
    // Same commit: nothing to upload, unless Analytics Engine was left off at install time
    // and a new version with its bindings should be tried.
    if (observed.kind === "managed" && observed.deployedSha === this.run.sourceSha &&
        !analyticsEngineSwitchedOff(await this.client.settings(this.account, INSTALL_NAMES.worker))) {
      this.skipRemaining = true;
      return { status: "done", note: { code: "ALREADY_CURRENT" }, state: { previousSha: observed.deployedSha, workerUrl: await this.publicUrl() } };
    }
    const preview = await previewVersionUpgrade(this.client, this.account, observed, release);
    const snapshot = await this.client.d1MigrationSnapshot(this.account, preview.databaseId);
    const plan = await planD1Migrations(release, snapshot);
    return {
      status: "done",
      state: {
        previousSha: observed.deployedSha, previousVersionId: preview.expectedActiveVersionId,
        databaseId: preview.databaseId, migrationsTotal: plan.pending.length, migrationsApplied: 0
      }
    };
  }

  private async stage(): Promise<StepResult> {
    if (this.state.stagedVersionId) return { status: "done" };
    const release = await this.loadRelease();
    const observed = await discoverDeployment(this.client, this.account);
    // Only a retried attempt can have uploaded a version already; listing versions is slow
    // on Workers that Builds deploys on every push, so skip the scan the first time.
    if (this.state.stageAttempted) {
      const existing = await findVerifiedStagedCandidates(this.client, this.account, observed, release);
      const reusable = existing.find(item => item.expectedActiveVersionId === this.state.previousVersionId);
      if (reusable) return { status: "done", note: { code: "REUSED" }, state: { stagedVersionId: reusable.stagedVersionId } };
    }
    this.state.stageAttempted = true;
    const reviewed = {
      sourceSha: this.run.sourceSha,
      artifactDigest: this.run.artifactDigest,
      expectedActiveVersionId: this.state.previousVersionId!,
      legacyAdoptionReviewed: observed.kind !== "legacy-candidate" || this.run.legacyAdoptionApproved
    };
    // Installed while the account had Analytics Engine off: try to switch it on now.
    if (analyticsEngineSwitchedOff(await this.client.settings(this.account, INSTALL_NAMES.worker))) {
      const datasets = ((release.manifest.config.bindings as { analyticsEngine?: Array<{ binding: string; dataset: string }> })
        .analyticsEngine ?? []);
      try {
        const staged = await stageReviewedUpgrade(this.client, this.account, release.artifact, {
          ...reviewed, enableAnalyticsEngine: { accountId: this.account, datasets }
        });
        return { status: "done", note: { code: "AE_ENABLED" }, state: { stagedVersionId: staged.stagedVersionId, analyticsEngine: "enabled" } };
      } catch (error) {
        if (!(error instanceof DeployError) || error.cloudflareCode !== CF_ANALYTICS_ENGINE_NOT_ENABLED) throw error;
      }
      const staged = await stageReviewedUpgrade(this.client, this.account, release.artifact, reviewed);
      return { status: "warning", note: { code: "AE_NOT_ENABLED" }, state: { stagedVersionId: staged.stagedVersionId, analyticsEngine: "disabled" } };
    }
    const staged = await stageReviewedUpgrade(this.client, this.account, release.artifact, reviewed);
    return { status: "done", state: { stagedVersionId: staged.stagedVersionId } };
  }

  private async activate(): Promise<StepResult> {
    const release = await this.loadRelease();
    const observed = await discoverDeployment(this.client, this.account);
    // An earlier attempt may have activated it and lost the response.
    // An earlier attempt may have activated it and lost the response: the staged version is live.
    const live = activeVersionId((await this.client.workerDeployments(this.account, INSTALL_NAMES.worker))[0] ?? null);
    if (this.state.stagedVersionId && live === this.state.stagedVersionId) {
      return { status: "done", state: { activatedVersionId: live, workerUrl: await this.publicUrl() } };
    }
    const result = await activateStagedUpgrade(this.client, this.account, observed, release, {
      sourceSha: this.run.sourceSha, artifactDigest: this.run.artifactDigest,
      expectedActiveVersionId: this.state.previousVersionId!, stagedVersionId: this.state.stagedVersionId!,
      approved: true, legacyAdoptionReviewed: observed.kind !== "legacy-candidate" || this.run.legacyAdoptionApproved
    });
    return { status: "done", state: { activatedVersionId: result.activatedVersionId, workerUrl: await this.publicUrl() } };
  }

  /** workers.dev address of the installed Worker, when it is enabled. */
  private async publicUrl(): Promise<string | null> {
    try {
      const info = await this.client.workerInfo(this.account, INSTALL_NAMES.worker);
      const subdomain = info.subdomain?.enabled ? await this.client.workersSubdomain(this.account) : null;
      return subdomain ? `https://${INSTALL_NAMES.worker}.${subdomain}.workers.dev` : null;
    } catch {
      return null;
    }
  }

  /* ------------------------------ shared ------------------------------ */

  private async migrate(): Promise<StepResult> {
    const release = await this.loadRelease();
    const databaseId = this.state.databaseId;
    if (!databaseId) throw new DeployError("UNAVAILABLE", "No D1 database is selected for migrations.", 409);
    const plan = await planD1Migrations(release, await this.client.d1MigrationSnapshot(this.account, databaseId));
    if (this.run.intent === "install" && release.databaseSchema && !plan.initialInstall && !plan.appliedNames.length) {
      throw new DeployError("UNAVAILABLE", "Non-empty D1 database has no migration history; initialization is unsafe.", 409);
    }
    const total = this.run.intent === "install" ? release.migrations.length : (this.state.migrationsTotal ?? plan.pending.length);
    if (!plan.pending.length) {
      return { status: total === 0 ? "skipped" : "done", note: { code: "MIGRATIONS", params: { applied: total, total } },
        state: { migrationsApplied: total, migrationsTotal: total } };
    }
    const progress = await applyManualD1Migrations(this.client, release, {
      accountId: this.account, databaseId, sourceSha: this.run.sourceSha,
      reviewedPlanDigest: plan.reviewedPlanDigest, maxFiles: 4, allowInitialization: this.run.intent === "install"
    });
    const applied = Math.max(0, total - progress.remaining);
    const state = { migrationsApplied: applied, migrationsTotal: total };
    const note = { code: "MIGRATIONS", params: { applied, total } };
    return progress.completed ? { status: "done", note, state } : { status: "again", note, state };
  }

  private async health(rollbackOnFailure: boolean): Promise<StepResult> {
    const url = this.state.workerUrl ?? this.state.customUrl;
    if (!url) return { status: "skipped", note: { code: "NO_PUBLIC_URL" } };
    if (await this.deps.checkHealth(url)) return { status: "done", note: { code: "HEALTHY", params: { url } } };
    const attempts = (this.state.healthAttempts ?? 0) + 1;
    if (attempts < HEALTH_ATTEMPTS) {
      return { status: "again", note: { code: "WAITING", params: { attempt: attempts, total: HEALTH_ATTEMPTS } }, state: { healthAttempts: attempts } };
    }
    if (!rollbackOnFailure) {
      // A brand-new workers.dev hostname can take a while to propagate.
      return { status: "warning", note: { code: "HEALTH_TIMEOUT", params: { url } }, state: { healthAttempts: attempts } };
    }
    if (this.state.previousVersionId) {
      await this.client.createWorkerDeployment(this.account, INSTALL_NAMES.worker, this.state.previousVersionId,
        "InsightFlare Deploy | rollback, " + this.run.sourceSha.slice(0, 8) + " failed health check");
      this.state.rolledBack = true;
    }
    this.state.healthAttempts = attempts;
    throw new DeployError("UNAVAILABLE", "The new version did not pass its health check and the previous version was restored.", 409);
  }
}
