import { describe, expect, it, vi } from "vitest";
import { CloudflareBuildExecutor, type BuildExecutionGate } from "../src/providers/cloudflare/build-executor";

const account = "a".repeat(32);
const trigger = "92cef549-8276-40bd-94b4-b1be1a34a48c";
const buildUuid = "92cef549-8276-40bd-94b4-b1be1a34a48d";
const sha = "c".repeat(40);
const gate: BuildExecutionGate = {
  userScopedTokenVerified: true,
  upstreamGitHubAccessVerified: true,
  nonPromotingWorkerUploadVerified: true,
  databaseMigrationsIsolated: true,
  userApprovalRecorded: true,
  reviewedSha: sha
};

describe("guarded user-owned Cloudflare build executor", () => {
  it("rejects triggering builds unless every safety gate passes, before any network call", async () => {
    const http = vi.fn(async () => Response.json({ success: true, result: { build_uuid: buildUuid } }));
    const executor = new CloudflareBuildExecutor("temporary-user-scoped-token", http as typeof fetch);
    for (const key of [
      "userScopedTokenVerified", "upstreamGitHubAccessVerified",
      "nonPromotingWorkerUploadVerified", "databaseMigrationsIsolated", "userApprovalRecorded"
    ] as const) {
      await expect(executor.startPinnedBuild(account, trigger, sha, { ...gate, [key]: false })).rejects.toThrow("blocked");
    }
    await expect(executor.startPinnedBuild(account, trigger, sha, { ...gate, reviewedSha: "d".repeat(40) })).rejects.toThrow("blocked");
    expect(http).not.toHaveBeenCalled();
  });

  it("sends only the pinned SHA to the exact trigger endpoint when safely authorized", async () => {
    const http = vi.fn(async () => Response.json({
      success: true, result: { build_uuid: buildUuid, build_trigger_metadata: { commit_hash: sha } }
    }));
    const executor = new CloudflareBuildExecutor("temporary-user-scoped-token", http as typeof fetch);
    const result = await executor.startPinnedBuild(account, trigger, sha, gate);
    expect(result).toEqual({ buildUuid, requestedSha: sha, returnedSha: sha, sourceMatch: true, state: "submitted" });
    expect(http).toHaveBeenCalledOnce();
    const [url, options] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/" + account + "/builds/triggers/" + trigger + "/builds");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ branch: "main", commit_hash: sha });
    expect((options.headers as Record<string, string>).Authorization).toContain("temporary-user-scoped-token");
  });

  it("reports mismatched returned SHA without claiming the expected code was built", async () => {
    const http = vi.fn(async () => Response.json({
      success: true, result: { build_uuid: buildUuid, build_trigger_metadata: { commit_hash: "d".repeat(40) } }
    }));
    const output = await new CloudflareBuildExecutor("temporary-user-scoped-token", http as typeof fetch)
      .startPinnedBuild(account, trigger, sha, gate);
    expect(output.sourceMatch).toBe(false);
    expect(output.returnedSha).toBe("d".repeat(40));
  });

  it("reads build status with exact source provenance and without mutating", async () => {
    const http = vi.fn(async () => Response.json({
      success: true, result: { build_uuid: buildUuid, status: "stopped",
        build_outcome: "success", build_trigger_metadata: { commit_hash: sha } }
    }));
    const result = await new CloudflareBuildExecutor("temporary-user-scoped-token", http as typeof fetch)
      .readStatus(account, buildUuid, sha);
    expect(result).toMatchObject({ state: "stopped", outcome: "success", sourceMatch: true });
    const [_, options] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.method).toBe("GET");
  });

  it("does not leak sensitive Cloudflare error messages", async () => {
    const http = vi.fn(async () => Response.json({
      success: false, errors: [{ message: "secret-token-leak" }]
    }, { status: 403 }));
    const executor = new CloudflareBuildExecutor("temporary-user-scoped-token", http as typeof fetch);
    await expect(executor.startPinnedBuild(account, trigger, sha, gate)).rejects.toThrow("HTTP 403");
    await expect(executor.startPinnedBuild(account, trigger, sha, gate)).rejects.not.toThrow("secret-token-leak");
  });

  it("rejects invalid build IDs and absent user tokens", async () => {
    const http = vi.fn(async () => Response.json({ success: true, result: { build_uuid: buildUuid } }));
    await expect(new CloudflareBuildExecutor("bad", http as typeof fetch)
      .startPinnedBuild(account, trigger, sha, gate)).rejects.toThrow("User-scoped");
    await expect(new CloudflareBuildExecutor("temporary-user-scoped-token", http as typeof fetch)
      .readStatus(account, "malformed", sha)).rejects.toThrow("build identifier");
  });
});
