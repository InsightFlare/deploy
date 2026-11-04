/**
 * Workers Builds safety policy.
 *
 * A linked Git repository is NOT proof that an arbitrary public repository
 * can be built by another user's Cloudflare GitHub App installation.
 *
 * Wrangler's "versions upload" creates a Worker version and then creates a
 * deployment. It must never be classified as a non-promoting stage operation.
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

/** Conservative inspection; does not mutate or start Workers Builds. */
export function inspectTriggerSafety(trigger: BuildTriggerDescriptor): TriggerSafety {
  const repo = trigger.repo_connection;
  const matchesOfficialName = repo?.provider_type === "github"
    && repo.provider_account_name?.toLowerCase() === OFFICIAL_GITHUB.owner.toLowerCase()
    && repo.repo_name?.toLowerCase() === OFFICIAL_GITHUB.repository.toLowerCase();

  // Human-readable repository name alone is insufficient for provenance.
  const verifiesOfficialRepositoryId = Boolean(matchesOfficialName
    && String(repo?.provider_account_id ?? "") === OFFICIAL_GITHUB.ownerId
    && String(repo?.repo_id ?? "") === OFFICIAL_GITHUB.repositoryId);

  const buildTokenConfigured = Boolean(trigger.build_token_uuid);
  const deployCommand = (trigger.deploy_command ?? "").trim();
  const usesWranglerVersionUpload = /\bwrangler\s+versions\s+upload\b/i.test(deployCommand);

  // No currently configured Workers Builds command is trusted as stage-only.
  // The real staged path is the Beta Worker Versions API with deploy=false.
  // It must be implemented and verified before a trigger can pass this gate.
  const stagesWithoutPromotion = false;
  const deploysWithoutConfirmation = true;
  const blockers: string[] = [];
  if (!matchesOfficialName) blockers.push("Build trigger is not connected to the official GitHub repository.");
  else if (!verifiesOfficialRepositoryId) blockers.push("Repository numeric identity is not confirmed; names alone cannot verify the upstream source.");
  if (!buildTokenConfigured) blockers.push("Build trigger does not declare a build token UUID.");
  if (usesWranglerVersionUpload) blockers.push("Wrangler versions upload creates a deployment; it is not a staging-only operation.");
  if (!stagesWithoutPromotion) blockers.push(
    "The current trigger has no verified non-promoting upload command. Do not run it before user approval."
  );
  // Neither a GitHub App connection nor a staged build proves independent
  // no-fork access or safe migrations.
  blockers.push("Independent no-fork GitHub access, build commands and database upgrade safety still require real-account validation.");
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
  noSharedBuildArtifact: true;
  stagingOnly: true;
  remotelyMigrateDatabaseDuringCompilation: false;
  automaticActivationAllowed: false;
  productionReady: false;
  caveats: string[];
}

/**
 * Intended commands, NOT an executable configuration. The upstream CLI's
 * --skip-prebuild flag avoids the current remote D1 migration in prebuild,
 * but complete artifact generation still needs an isolated end-to-end test.
 */
export const BUILD_PROCESS_CONTRACT: Readonly<BuildProcessContract> = {
  sourceRepository: "RavelloH/InsightFlare",
  branch: "main",
  immutableCommitRequired: true,
  compilationCommand: "pnpm exec tsx scripts/build.ts --target cf --skip-prebuild",
  stagedUploadCommand: "Cloudflare Beta Worker Versions API (deploy=false), after per-user build and isolated migration checks",
  noSharedBuildArtifact: true,
  stagingOnly: true,
  remotelyMigrateDatabaseDuringCompilation: false,
  automaticActivationAllowed: false,
  productionReady: false,
  caveats: [
    "Cloudflare GitHub App access to an upstream public repository outside the user's ownership is not verified.",
    "Cloudflare Builds requires a user-scoped API token; ordinary account-scoped tokens are insufficient.",
    "Connecting main to Workers Builds normally causes builds on upstream pushes.",
    "The upstream build with --skip-prebuild must be verified to produce all required files without remote D1 side effects.",
    "Wrangler versions upload creates a deployment; it must not be treated as stage-only.",
    "Use the Beta Worker Versions API with deploy=false for a true staged version, or an isolated Worker Preview for pre-deployment testing.",
    "Worker Previews need explicit D1/KV test bindings and Preview secrets; Durable Objects are automatically isolated per Preview.",
    "Upload a version before migrations and activate it only after approval and compatibility checks."
  ]
};
