import { describe, expect, it, vi } from "vitest";
import { CloudflareClient } from "../src/providers/cloudflare/client";

const accountId = "a".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const BASE = "https://api.cloudflare.com/client/v4/accounts/" + accountId;
const bookmark = "000000c1-00000001-00000002-123456789abc";
const ok = (result: unknown) => Response.json({ success: true, result });
const batch = (rows: Record<string, unknown>[]) => ok([{ success: true, results: rows, meta: {} }]);

function clientWithHistory(options: {
  noLedger?: boolean;
  wrongDatabase?: boolean;
  legacyAlpha?: boolean;
  missingBookmark?: boolean;
  rejectedLedger?: boolean;
} = {}) {
  const seen: Array<{ method: string; url: string; sql?: string }> = [];
  const http = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const sql = method === "POST" ? JSON.parse(String(init?.body)).sql as string : undefined;
    seen.push({ method, url, sql });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-account-token");
    if (url.endsWith("/accounts?per_page=50&page=1")) return ok([{ id: accountId, name: "Test" }]);
    if (url === BASE + "/d1/database/" + databaseId) {
      return ok({ uuid: options.wrongDatabase ? "f".repeat(36) : databaseId, name: "insightflare", version: options.legacyAlpha ? "alpha" : "production" });
    }
    if (url.endsWith("/query") && method === "POST") {
      if (sql?.startsWith("SELECT name FROM sqlite_master")) {
        return batch((options.noLedger ? ["users"] : ["d1_migrations", "users"]).map(name => ({ name })));
      }
      expect(sql).toBe("SELECT name FROM d1_migrations ORDER BY id ASC");
      if (options.rejectedLedger) return Response.json({ success: false, errors: [{ code: 9301, message: "Secret DB error" }] }, { status: 503 });
      return batch([{ name: "0001_initial.sql" }]);
    }
    if (url.endsWith("/time_travel/bookmark")) return ok({ bookmark: options.missingBookmark ? "" : bookmark });
    throw Error("unexpected endpoint " + method + " " + url);
  });
  return { client: new CloudflareClient("test-account-token", http as typeof fetch), seen, http };
}

describe("Cloudflare D1 user-account migration preflight (read-only)", () => {
  it("identifies the exact user-owned DB, existing Wrangler ledger and Time Travel bookmark", async () => {
    const { client, seen } = clientWithHistory();
    const result = await client.d1MigrationSnapshot(accountId, databaseId);
    expect(result).toEqual({
      accountId, databaseId, tableNames: ["d1_migrations", "users"],
      appliedNames: ["0001_initial.sql"], bookmark
    });
    expect(seen.filter(item => item.method === "POST")).toEqual([
      { method: "POST", url: BASE + "/d1/database/" + databaseId + "/query",
        sql: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name" },
      { method: "POST", url: BASE + "/d1/database/" + databaseId + "/query",
        sql: "SELECT name FROM d1_migrations ORDER BY id ASC" }
    ]);
    expect(seen.every(item => !item.sql || item.sql.startsWith("SELECT "))).toBe(true);
  });

  it("flags old user tables with no Wrangler ledger for manual adoption", async () => {
    const { client, seen } = clientWithHistory({ noLedger: true });
    const result = await client.d1MigrationSnapshot(accountId, databaseId);
    expect(result.appliedNames).toBeNull();
    expect(result.tableNames).toEqual(["users"]);
    expect(seen.filter(item => item.method === "POST")).toHaveLength(1);
  });

  it("rejects different database identity, even inside the same Cloudflare account", async () => {
    const { client } = clientWithHistory({ wrongDatabase: true });
    await expect(client.d1MigrationSnapshot(accountId, databaseId)).rejects.toThrow("identity differs");
  });

  it("refuses legacy D1 alpha storage without Time Travel recovery", async () => {
    const { client, seen } = clientWithHistory({ legacyAlpha: true });
    await expect(client.d1MigrationSnapshot(accountId, databaseId)).rejects.toThrow("Legacy alpha D1 storage");
    expect(seen.filter(x => x.method === "POST")).toHaveLength(0);
  });

  it("blocks missing recoverable bookmark or a failed ledger read", async () => {
    const noBookmark = clientWithHistory({ missingBookmark: true });
    await expect(noBookmark.client.d1MigrationSnapshot(accountId, databaseId)).rejects.toThrow("bookmark is unavailable");
    const failed = clientWithHistory({ rejectedLedger: true });
    await expect(failed.client.d1MigrationSnapshot(accountId, databaseId)).rejects.not.toThrow("Secret DB error");
    await expect(failed.client.d1MigrationSnapshot(accountId, databaseId)).rejects.toThrow("HTTP 503");
  });

  it("refuses malformed database IDs before any Cloudflare calls", async () => {
    const { client, http } = clientWithHistory();
    await expect(client.d1MigrationSnapshot(accountId, "../sensitive")).rejects.toThrow("Invalid Cloudflare");
    expect(http).not.toHaveBeenCalled();
  });
});
