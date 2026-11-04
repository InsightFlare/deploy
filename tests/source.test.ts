import { describe, expect, it, vi } from "vitest";
import { parseMainCommit, resolveLatestMain, validateSha } from "../src/core/source";

const sha = "a".repeat(40);
describe("upstream main source", () => {
  it("pins a complete 40-character commit", () => {
    expect(validateSha(sha.toUpperCase())).toBe(sha);
    expect(() => validateSha("main")).toThrow();
    expect(() => validateSha(sha.slice(0, 8))).toThrow();
  });
  it("extracts commit metadata and limits subject length", () => {
    const value = parseMainCommit({ sha, commit: { message: "Update deploy\nDetails", committer: { date: "2026-11-04T00:00:00Z" } } });
    expect(value.shortSha).toBe("aaaaaaaa");
    expect(value.message).toBe("Update deploy");
    expect(value.committedAt).toContain("2026");
    expect(value.url).toContain(sha);
  });
  it("rejects malformed GitHub payloads", () => {
    expect(() => parseMainCommit({ sha: "broken" })).toThrow();
    expect(() => parseMainCommit(null)).toThrow();
  });
  it("requests only the upstream main endpoint", async () => {
    const mock = vi.fn(async (_url: string) => new Response(JSON.stringify({ sha }), { status: 200 }));
    const commit = await resolveLatestMain(mock as typeof fetch);
    expect(commit.sha).toBe(sha);
    expect(mock.mock.calls).toHaveLength(1);
    expect(String(mock.mock.calls[0]?.[0])).toMatch(/\/commits\/main$/);
  });
  it("fails closed on failed Github fetch", async () => {
    const mock = vi.fn(async () => new Response("not found", { status: 404 }));
    await expect(resolveLatestMain(mock as typeof fetch)).rejects.toThrow("Unable to read");
  });
});
