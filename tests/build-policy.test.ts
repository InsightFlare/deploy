import { describe, expect, it } from "vitest";
import { BUILD_PROCESS_CONTRACT, inspectTriggerSafety } from "../src/core/build-policy";

const repo = {
  provider_type: "github", provider_account_id: "68409330",
  provider_account_name: "RavelloH", repo_id: "1169432997", repo_name: "InsightFlare"
};
const stage = "pnpm exec wrangler versions upload --config wrangler.toml";

describe("user-owned build safety policy", () => {
  it("requires numeric upstream repository provenance and staged-only deploy command", () => {
    const state = inspectTriggerSafety({ repo_connection: repo, build_token_uuid: "build-token-id", deploy_command: stage });
    expect(state.matchesOfficialName).toBe(true);
    expect(state.verifiesOfficialRepositoryId).toBe(true);
    expect(state.stagesWithoutPromotion).toBe(true);
    expect(state.deploysWithoutConfirmation).toBe(false);
    expect(state.blockers.join(" ")).toContain("validation");
  });
  it("detects automatic production deployments", () => {
    for (const command of [
      "npx wrangler deploy", "pnpm exec wrangler deploy", "npm run deploy",
      "pnpm exec wrangler versions upload --config wrangler.toml && npx wrangler deploy",
      "pnpm exec wrangler versions upload; npx wrangler deploy", ""
    ]) {
      const state = inspectTriggerSafety({ repo_connection: repo, build_token_uuid: "id", deploy_command: command });
      expect(state.deploysWithoutConfirmation, command).toBe(true);
      expect(state.stagesWithoutPromotion, command).toBe(false);
    }
  });
  it("does not trust matching display names with a different GitHub ID", () => {
    const state = inspectTriggerSafety({ repo_connection: { ...repo, repo_id: "1" }, deploy_command: stage });
    expect(state.matchesOfficialName).toBe(true);
    expect(state.verifiesOfficialRepositoryId).toBe(false);
    expect(state.blockers.join(" ")).toContain("numeric identity");
  });
  it("rejects repository ownership confusion even when repository ID matches", () => {
    const state = inspectTriggerSafety({
      repo_connection: { ...repo, provider_account_name: "OtherOrg" }, deploy_command: stage
    });
    expect(state.matchesOfficialName).toBe(false);
    expect(state.verifiesOfficialRepositoryId).toBe(false);
  });
  it("requires a build token and does not treat Cloudflare OAuth as build authorization", () => {
    const state = inspectTriggerSafety({ repo_connection: repo, deploy_command: stage });
    expect(state.buildTokenConfigured).toBe(false);
    expect(state.requiresReview).toBe(true);
  });
  it("ensures proposed build contract never runs remote D1 migrations or automatically promotes code", () => {
    expect(BUILD_PROCESS_CONTRACT.immutableCommitRequired).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.stagingOnly).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.noSharedBuildArtifact).toBe(true);
    expect(BUILD_PROCESS_CONTRACT.automaticActivationAllowed).toBe(false);
    expect(BUILD_PROCESS_CONTRACT.compilationCommand).toContain("--skip-prebuild");
    expect(BUILD_PROCESS_CONTRACT.compilationCommand).not.toContain("migrations apply");
    expect(BUILD_PROCESS_CONTRACT.stagedUploadCommand).toContain("versions upload");
    expect(BUILD_PROCESS_CONTRACT.stagedUploadCommand).not.toContain("wrangler deploy");
    expect(BUILD_PROCESS_CONTRACT.productionReady).toBe(false);
  });
});
