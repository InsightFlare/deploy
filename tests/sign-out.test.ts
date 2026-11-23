import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { signOut } from "../src/security/oauth";
import type { Env } from "../src/types";

describe("sign out", () => {
  it("clears the __Host- session cookie on an HTTPS origin", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.post("/out", signOut);
    const stub = { fetch: async () => Response.json({ ok: true }) };
    const env = {
      APP_ORIGIN: "https://deploy.example.com",
      SESSIONS: { idFromName: () => "id", get: () => stub }
    } as unknown as Env;
    const response = await app.request("https://deploy.example.com/out", {
      method: "POST",
      headers: { Origin: "https://deploy.example.com", Cookie: "__Host-ifd_session=" + "a".repeat(32) }
    }, env);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-ifd_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Secure");
  });
});
