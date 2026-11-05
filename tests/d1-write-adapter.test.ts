import { describe, expect, it, vi } from "vitest";
import { CloudflareClient } from "../src/providers/cloudflare/client";

const accountId = "a".repeat(32);
const databaseId = "8a6f8ac3-8972-4f25-80d1-40ce170a1da9";
const sql = "CREATE TABLE users (id TEXT PRIMARY KEY);";
const ok = (result: unknown) => Response.json({ success: true, result });
async function migration() {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(sql)
  )), x => x.toString(16).padStart(2, "0")).join("");
  return { name: "0001_initial.sql", sql, sha256 };
}
function clientForBatch(failResult = false) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const http = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer account-scoped-token");
    if (url.endsWith("/accounts?per_page=50&page=1")) return ok([{ id: accountId, name: "Test" }]);
    if (url.endsWith("/query")) {
      if (failResult) return ok([{ success: true }, { success: false }]);
      return ok((body.batch as unknown[]).map(() => ({ success: true, results: [] })));
    }
    throw Error("unexpected request " + url);
  });
  return { client: new CloudflareClient("account-scoped-token", http as typeof fetch), calls, http };
}

describe("private, mocked Cloudflare SQL batch transport (NOT production enabled)", () => {
  it("submits one atomic migration batch and inserts the standard Wrangler ledger name", async () => {
    const { client, calls } = clientForBatch();
    const f = await migration();
    await client.d1ApplyVerifiedMigration(accountId, databaseId, f, true);
    const writes = calls.filter(call => call.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.url).toBe("https://api.cloudflare.com/client/v4/accounts/" +
      accountId + "/d1/database/" + databaseId + "/query");
    expect(writes[0]?.body).toEqual({ batch: [
      { sql: "CREATE TABLE d1_migrations (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, " +
        "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)" },
      { sql },
      { sql: "INSERT INTO d1_migrations (name) VALUES (?)",
        params: ["0001_initial.sql"] }
    ] });
  });

  it("does not recreate the ledger for an existing database", async () => {
    const { client, calls } = clientForBatch();
    await client.d1ApplyVerifiedMigration(accountId, databaseId, await migration(), false);
    const sqlBatch = (calls.find(x => x.method === "POST")?.body as {
      batch: Array<{ sql: string }>
    }).batch;
    expect(sqlBatch).toHaveLength(2);
    expect(sqlBatch[0]?.sql).toBe(sql);
  });

  it("rejects tampered SQL or ambiguous names before any database request", async () => {
    const { client, http } = clientForBatch();
    await expect(client.d1ApplyVerifiedMigration(accountId, databaseId,
      { ...await migration(), sql: sql + "DROP TABLE users;" }, true)).rejects.toThrow("differs");
    await expect(client.d1ApplyVerifiedMigration(accountId, databaseId,
      { ...await migration(), name: "../unexpected.sql" }, true)).rejects.toThrow("Unrecognized");
    expect(http).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare returns an incomplete or failed batch, never claiming success", async () => {
    const { client } = clientForBatch(true);
    await expect(client.d1ApplyVerifiedMigration(accountId, databaseId,
      await migration(), false)).rejects.toThrow("incomplete result");
  });
});
