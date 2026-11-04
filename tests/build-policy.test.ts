import { describe, expect, it } from "vitest";
import { BUILD_PROCESS_CONTRACT, inspectTriggerSafety, isNonPromotingVersionUpload } from "../src/core/build-policy";

const repo = {
  provider_type: "github", provider_account_id: "68409330",
  provider_account_name: "RavelloH", repo_id: "1169432997", repo_name: "InsightFlare"
};
const stage = "pnpm exec wrangler versions upload --config wrangler.toml";

describe("user-owned build safety policy", () => {
  it("recognizes the officially documented non-deploying Wrangler version-upload command", () => {
    const state = inspectTriggerSafety({ repo_connection: repo, build_token_uuid: "build-token-id", deploy_command: stage });
    expect(state.matchesOfficialName).toBe(true);
    expect(state.verifiesOfficialRepositoryId).toBe(true);
    expect(state.stagesWithoutPromotion).toBe(true);
    expect(state.deploysWithoutConfirmation).toBe(false);
    expect(state.requiresReview).toBe(true);
    expect(state.blockers.join(" ")).toContain("no-fork source access");
  });

  it.each([
    "pnpm exec wrangler versions upload --config wrangler.toml",
    "npx wrangler versions upload",
    "wrangler versions upload",
    "pnpm exec wrangler versions upload --name insightflare"
  ])("recognizes a single stage-only CLI command: %s", command => {
    expect(isNonPromotingVersionUpload(command)).toBe(true);
  });

  it.each([
    "npx wrangler deploy",
    "pnpm exec wrangler deploy",
    "npm run deploy",
    "pnpm exec wrangler versions deploy",
    "pnpm exec wrangler versions upload && npx wrangler deploy",
    "pnpm exec wrangler versions upload; npx wrangler deploy",
    "pnpm exec wrangler versions upload | npx wrangler deploy",
    "pnpm exec wrangler versions upload $(echo hello)",
    "pnpm exec wrangler versions upload --config wrangler.toml --unsafe-value=1",
    ""
  ])("rejects potential traffic-promotion or unreviewed shell command: %s", command => {
    const state = inspectTriggerSafety({ repo_connection: repo, build_token_uuid: "id", deploy_command: command });
    expect(state.deploysWithoutConfirmation).toBe(true);
    expect(state.stagesWithoutPromotion).toBe(false);
  });

  it("does not trust matching display names with a different GitHub ID", () => {
    const state = inspectTriggerSafety({ repo_connection: { ...repo, repo_id: "1" }, deploy_command: stage });
    expect(state.matchesOfficialName).toBe(true);
    expect(state.verifiesOfficialRepositoryId).toBe(false);
    expect(state.blockers.join(" ")).toContain("numeric identity");
  });

  it("rejects repository ownership confusion even when repository ID matches", () => {
    const state = inspectTriggerSafety({ repo_connection: { ...repo, provider_account_name: "OtherOrg" }, deploy_command: stage });
    expect(state.matchesOfficialName).toBe(false);
    expect(state.verifiesOfficialRepositoryId).toBe(false);
  });

  it("requires a build token and does not treat Cloudflare OAuth as build authorization", () => {
    const state = inspectTriggerSafety({ repo_connection: repo, deploy_command: stage });
    expect(state.buildTokenConfigured).toBe(false);
    expect(state.requiresReview).toBe(true);
  });

  it("keeps the proposed build contract separate from D1 migrations and 100% deployment", () => {
    expect(BUILD_PROCESS_CONTRACT.immutableCommitRequired).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.stagingOnly).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.noSharedBuildArtifact).toBe(false);
    expect(BUILD_PROCESS_CONTRACT.officialPublicNightlyPreferred).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.nightlyChannel).toBe("nightly");
    expect(BUILD_PROCESS_CONTRACT.nightlyPublishActive).toBe(false);
    expect(BUILD_PROCESS_CONTRACT.sourceFetchWithoutFork).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.isolatedLinuxBuilderPrototype).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.isolatedBuilderProductionReady).toBe(false);
    expect(BUILD_PROCESS_CONTRACT.automaticActivationAllowed).toBe(false);
    expect(BUILD_PROCESS_CONTRACT.compilationCommand).toContain("--skip-prebuild");
    expect(BUILD_PROCESS_CONTRACT.compilationCommand).not.toContain("migrations apply");
    expect(BUILD_PROCESS_CONTRACT.stagedUploadCommand).toContain("wrangler versions upload");
    expect(BUILD_PROCESS_CONTRACT.productionReady).toBe(false);
  });
});
