/**
 * Read-only Workers Builds trigger analysis.
 *
 * Cloudflare's documented "wrangler versions upload" command creates an
 * INACTIVE version; only "wrangler deploy"/"wrangler versions deploy" promote.
 * Do not confuse safe command semantics with the trustworthiness of the Git
 * repository, the build token or the D1 migration process.
 */
export const OFFICIAL_GITHUB = {
  owner: "RavelloH",
  repository: "InsightFlare",
  ownerId: "68409330",
  repositoryId: "1169432997",
  ref: "main"
} as const;

export interface RepositoryDescriptor {
  provider_type?: string;
  provider_account_id?: string;
  provider_account_name?: string;
  repo_id?: string;
  repo_name?: string;
}
export interface BuildTriggerDescriptor {
  trigger_uuid?: string;
  trigger_name?: string;
  build_token_uuid?: string;
  branch_includes?: string[];
  branch_excludes?: string[];
  build_command?: string;
  deploy_command?: string;
  repo_connection?: RepositoryDescriptor;
}
export interface TriggerSafety {
  matchesOfficialName: boolean;
  verifiesOfficialRepositoryId: boolean;
  buildTokenConfigured: boolean;
  deploysWithoutConfirmation: boolean;
  stagesWithoutPromotion: boolean;
  requiresReview: boolean;
  blockers: string[];
}

/**
 * Trust ONLY a single, literal versions-upload command with an extremely
 * small known option set. Shell pipelines, substitutions, scripts and
 * secondary commands must never be classified safe without inspection.
 */
export function isNonPromotingVersionUpload(command: string): boolean {
  const value = command.trim();
  return /^(?:(?:pnpm\s+exec|npx)\s+)?wrangler\s+versions\s+upload(?:\s+--(?:config|name|tag)\s+[A-Za-z0-9_./-]+)*$/i.test(value);
}

/** Conservative inspection only; never creates or triggers builds. */
export function inspectTriggerSafety(trigger: BuildTriggerDescriptor): TriggerSafety {
  const repo = trigger.repo_connection;
  const matchesOfficialName = repo?.provider_type === "github"
    && repo.provider_account_name?.toLowerCase() === OFFICIAL_GITHUB.owner.toLowerCase()
    && repo.repo_name?.toLowerCase() === OFFICIAL_GITHUB.repository.toLowerCase();
  const verifiesOfficialRepositoryId = Boolean(matchesOfficialName
    && String(repo?.provider_account_id ?? "") === OFFICIAL_GITHUB.ownerId
    && String(repo?.repo_id ?? "") === OFFICIAL_GITHUB.repositoryId);

  const buildTokenConfigured = Boolean(trigger.build_token_uuid);
  const stagesWithoutPromotion = isNonPromotingVersionUpload(trigger.deploy_command ?? "");
  const deploysWithoutConfirmation = !stagesWithoutPromotion;
  const blockers: string[] = [];

  if (!matchesOfficialName) blockers.push("Build trigger is not connected to the official GitHub repository.");
  else if (!verifiesOfficialRepositoryId) blockers.push("Repository numeric identity is not confirmed; names alone cannot verify the upstream source.");
  if (!buildTokenConfigured) blockers.push("Build trigger does not declare a build token UUID.");
  if (!stagesWithoutPromotion) blockers.push(
    "The build trigger does not use a verified, standalone wrangler versions upload command. Automatic promotion may occur."
  );
  // Passing the command check does not authorize running the trigger:
  // source connection and user-owned, isolated compilation remain unverified.
  blockers.push("Independent no-fork source access, pinned-SHA build execution and database upgrade safety still require real-account validation.");

  return {
    matchesOfficialName,
    verifiesOfficialRepositoryId,
    buildTokenConfigured,
    deploysWithoutConfirmation,
    stagesWithoutPromotion,
    requiresReview: true,
    blockers
  };
}

export interface BuildProcessContract {
  sourceRepository: string;
  branch: "main";
  immutableCommitRequired: true;
  compilationCommand: string;
  stagedUploadCommand: string;
  noSharedBuildArtifact: false;
  officialPublicNightlyPreferred: true;
  nightlyChannel: "nightly";
  nightlyPublishActive: true;
  sourceFetchWithoutFork: true;
  isolatedLinuxBuilderPrototype: true;
  isolatedBuilderProductionReady: false;
  stagingOnly: true;
  remotelyMigrateDatabaseDuringCompilation: false;
  automaticActivationAllowed: false;
  productionReady: false;
  caveats: string[];
}

export const BUILD_PROCESS_CONTRACT: Readonly<BuildProcessContract> = {
  sourceRepository: "RavelloH/InsightFlare",
  branch: "main",
  immutableCommitRequired: true,
  compilationCommand: "pnpm exec tsx scripts/build.ts --target cf --skip-prebuild",
  stagedUploadCommand: "pnpm exec wrangler versions upload --config wrangler.toml",
  noSharedBuildArtifact: false,
  officialPublicNightlyPreferred: true,
  nightlyChannel: "nightly",
  nightlyPublishActive: true,
  sourceFetchWithoutFork: true,
  isolatedLinuxBuilderPrototype: true,
  isolatedBuilderProductionReady: false,
  stagingOnly: true,
  remotelyMigrateDatabaseDuringCompilation: false,
  automaticActivationAllowed: false,
  productionReady: false,
  caveats: [
    "Official GitHub CI can publish a verified build for each upstream main commit to the rolling nightly prerelease; no user fork or external object storage is required.",
    "The official nightly publisher is active on upstream main. Never substitute a formal Release or an older nightly build when the exact latest commit is pending.",
    "The single downloaded nightly tar.gz must match GitHub SHA256 and its complete internal manifest, including every D1 migration SQL hash.",
    "Public build artifacts are shared official CI outputs; the old isolated per-user compiler is an optional experiment.",
    "A private Linux Docker builder prototype remains optional and is not needed by Deploy users; production readiness is unverified.",
    "Do not run a user build inside production application containers or share the build checkout between users.",
    "Cloudflare Builds requires an independently authorized user-scoped build token.",
    "Connecting main to Workers Builds normally triggers builds after upstream pushes.",
    "Compile only the pinned Git SHA; Deploy must separately inspect and apply the end user's D1 migrations before production activation, under account-specific authorization.",
    "Wrangler versions upload creates a version WITHOUT activating live traffic; wrangler deploy and versions deploy do deploy.",
    "A non-promoting command alone cannot establish a safe source, isolated build or database migration.",
    "The Beta Worker Versions API with deploy=false also supports an explicitly staged version.",
    "Isolated Worker Previews require explicit D1/KV test bindings and Preview secrets.",
    "After staging, promote only with verified resources, successful isolated health checks and explicit approval."
  ]
};
