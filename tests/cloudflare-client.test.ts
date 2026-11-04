import { describe, expect, it, vi } from "vitest";
import { CloudflareClient } from "../src/providers/cloudflare/client";

const accountId = "1".repeat(32);
describe("Cloudflare read-only API client", () => {
  it("reads authorized account listings", async () => {
    const mock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ success: true, result: [{ id: accountId, name: "Personal" }] }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    expect(await client.accounts()).toEqual([{ id: accountId, name: "Personal" }]);
    expect(mock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer short-lived-token" });
  });
  it("refuses accounts that the user cannot access", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: [{ id: accountId, name: "Personal" }] }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.requireAccount("2".repeat(32))).rejects.toThrow("not accessible");
  });
  it("does not echo sensitive upstream errors", async () => {
    const mock = vi.fn(async () => Response.json({
      success: false, errors: [{ code: 1234, message: "secret-token-value" }]
    }, { status: 403 }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.accounts()).rejects.toThrow("code 1234");
    await expect(client.accounts()).rejects.not.toThrow("secret-token-value");
  });
  it("reads worker settings without mutating anything", async () => {
    const calls: string[] = [];
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      expect(init?.method ?? "GET").toBe("GET");
      if (url.endsWith("/workers/scripts")) return Response.json({ success: true, result: [{ id: "insightflare" }] });
      return Response.json({ success: true, result: { bindings: [{ type: "d1", name: "DB" }] } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    expect(await client.workerNames(accountId)).toEqual(["insightflare"]);
    expect(await client.settings(accountId, "insightflare")).toEqual([{ type: "d1", name: "DB" }]);
    expect(calls).toHaveLength(2);
  });
});
