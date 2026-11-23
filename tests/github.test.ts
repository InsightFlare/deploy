import { describe, expect, it, vi } from "vitest";
import { githubFetcher } from "../src/core/github";

const api = "https://api.github.com/repos/RavelloH/InsightFlare/commits/main";
const download = "https://github.com/RavelloH/InsightFlare/releases/download/nightly/x.tar.gz";

describe("GitHub fetch wrapper", () => {
  it("sends the token to the API only, never to downloads", async () => {
    const base = vi.fn(async () => new Response("{}"));
    const github = githubFetcher("ghp_test", base as unknown as typeof fetch);
    await github(api, { headers: { Accept: "application/vnd.github+json" } });
    await github(download);
    const headers = (i: number) => new Headers((base.mock.calls[i] as unknown as [string, RequestInit])[1].headers);
    expect(headers(0).get("Authorization")).toBe("Bearer ghp_test");
    expect(headers(0).get("Accept")).toBe("application/vnd.github+json");
    expect(headers(1).get("Authorization")).toBeNull();
  });

  it("works without a token", async () => {
    const base = vi.fn(async () => new Response("{}"));
    await githubFetcher(undefined, base as unknown as typeof fetch)(api);
    expect(new Headers((base.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get("Authorization")).toBeNull();
  });

  it("explains an exhausted rate limit and suggests GITHUB_TOKEN", async () => {
    const limited = vi.fn(async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } }));
    await expect(githubFetcher(undefined, limited as unknown as typeof fetch)(api)).rejects.toThrow("Configure GITHUB_TOKEN");
    await expect(githubFetcher("t", limited as unknown as typeof fetch)(api)).rejects.toThrow("configured token");
  });

  it("turns network failures and timeouts into clear retryable errors", async () => {
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(githubFetcher(undefined, down as unknown as typeof fetch)(api)).rejects.toThrow("Could not connect to GitHub");
    const slow = vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); });
    await expect(githubFetcher(undefined, slow as unknown as typeof fetch)(download)).rejects.toThrow("did not respond in time");
  });
});
