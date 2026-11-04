import { describe, expect, it, vi } from "vitest";
import { CloudflareClient, type WorkerBuildTrigger } from "../src/providers/cloudflare/client";
import { assessTriggers, inspectBuildReadiness } from "../src/providers/cloudflare/build-readiness";

const accountId = "a".repeat(32);
const tag = "b".repeat(32);
const official: WorkerBuildTrigger = {
  trigger_uuid: "7b5e7985-7e6a-433b-9451-b7a9fd967e4f",
  trigger_name: "Main",
  build_command: "pnpm exec tsx scripts/build.ts --target cf --skip-prebuild",
  deploy_command: "pnpm exec wrangler versions upload --config wrangler.toml",
  build_token_uuid: "8aa4ee08-20ef-41ee-89be-61ef1155d2a2",
  repo_connection: {
    provider_type: "github",
    provider_account_id: "68409330",
    provider_account_name: "RavelloH",
    repo_id: "1169432997",
    repo_name: "InsightFlare"
  }
};

function fakeClient(shouldHaveWorker: boolean, workerTag?: string, triggers: WorkerBuildTrigger[] = [], errorStatus?: number) {
  const calls: { url: string; method: string }[] = [];
  const http = vi.fn(async (url: string, opts?: RequestInit) => {
    calls.push({ url, method: opts?.method ?? "GET" });
    if (url.includes("/accounts?")) return Response.json({ success: true, result: [{ id: accountId, name: "Test" }] });
    if (url.endsWith("/workers/scripts")) {
      return Response.json({ success: true, result: shouldHaveWorker ? [{ id: "insightflare", tag: workerTag }] : [] });
    }
    if (url.endsWith("/triggers")) {
      if (errorStatus) return Response.json({ success: false, errors: [{ code: 10000, message: "Do not leak this" }] }, { status: errorStatus });
      return Response.json({ success: true, result: triggers });
    }
    throw Error("unexpected request " + url);
  });
  return { client: new CloudflareClient("test-token", http as typeof fetch), calls };
}

describe("Workers Builds readiness (read-only)", () => {
  it("identifies no installed Worker without attempting a build", async () => {
    const {client, calls} = fakeClient(false);
    const state = await inspectBuildReadiness(client, accountId);
    expect(state.state).toBe("not-installed");
    expect(state.executionAvailable).toBe(false);
    expect(calls.every(c => c.method === "GET")).toBe(true);
    expect(calls.some(c => c.url.includes("builds"))).toBe(false);
  });

  it("requires a real system-assigned Worker tag instead of guessing from its name", async () => {
    const {client,calls} = fakeClient(true);
    const state = await inspectBuildReadiness(client, accountId);
    expect(state.state).toBe("missing-worker-tag");
    expect(calls).toHaveLength(2);
  });

  it("blocks Wrangler versions upload because it deploys instead of staging", async () => {
    const {client,calls} = fakeClient(true, tag, [official]);
    const state = await inspectBuildReadiness(client, accountId);
    expect(state.state).toBe("unsafe-trigger");
    expect(state.repoConnectedToUpstream).toBe(true);
    expect(state.hasUserBuildToken).toBe(true);
    expect(state.verifiedUserBuild).toBe(false);
    expect(state.executionAvailable).toBe(false);
    expect(state.verifiedRepoIdentity).toBe(true);
    expect(state.canStageWithoutPromotion).toBe(false);
    expect(state.automaticPushBuildPossible).toBe(true);
    expect(state.safetyBlockers.join(" ")).toContain("not a staging-only operation");
    expect(calls.some(c => c.url.includes("/builds/workers/" + tag + "/triggers"))).toBe(true);
    expect(calls.every(c => c.method === "GET")).toBe(true);
  });

  it("does not accept a similarly named or third-party repository", () => {
    const state = assessTriggers([{...official, repo_connection: {...official.repo_connection, provider_account_name: "attacker"}}]);
    expect(state.state).toBe("repository-mismatch");
    expect(state.candidateTriggerCount).toBe(0);
  });

  it("blocks triggers configured to deploy directly on main pushes", async () => {
    const { client } = fakeClient(true, tag, [{...official, deploy_command: "pnpm exec wrangler deploy"}]);
    const state = await inspectBuildReadiness(client, accountId);
    expect(state.state).toBe("unsafe-trigger");
    expect(state.canStageWithoutPromotion).toBe(false);
    expect(state.safetyBlockers.join(" ")).toContain("user approval");
  });

  it("rejects a lookalike GitHub repository whose numeric ID is wrong", async () => {
    const { client } = fakeClient(true, tag, [{...official, repo_connection: {...official.repo_connection, repo_id: "123"}}]);
    const state = await inspectBuildReadiness(client, accountId);
    expect(state.state).toBe("unsafe-trigger");
    expect(state.verifiedRepoIdentity).toBe(false);
  });

  it("distinguishes permission failure from missing configuration", async () => {
    const {client} = fakeClient(true, tag, [], 403);
    const state = await inspectBuildReadiness(client, accountId);
    expect(state.state).toBe("permission-required");
    expect(state.message).not.toContain("Do not leak");
  });

  it("fails closed on upstream errors other than missing permissions", async () => {
    const {client} = fakeClient(true, tag, [], 500);
    await expect(inspectBuildReadiness(client, accountId)).rejects.toThrow("Cloudflare request failed");
  });

  it("validates the Worker system tag before querying the API", async () => {
    const {client} = fakeClient(true, "insightflare", [official]);
    expect((await inspectBuildReadiness(client, accountId)).state).toBe("missing-worker-tag");
  });
});
