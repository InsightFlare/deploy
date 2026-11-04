import { describe, it, expect } from "vitest";
import { pkceChallenge, randomBase64Url, sealToken, unsealToken } from "../src/security/crypto";
describe("session cryptography", () => {
  it("produces URL-safe random IDs", () => {
    const a = randomBase64Url();
    expect(a).not.toBe(randomBase64Url());
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("creates repeatable S256 challenges", async () => {
    expect(await pkceChallenge("a")).toBe(await pkceChallenge("a"));
    expect(await pkceChallenge("b")).not.toBe(await pkceChallenge("a"));
  });
  it("encrypts session tokens with AES-GCM", async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
    const sealed = await sealToken("sensitive-credential", key, Date.now() + 30000);
    expect(JSON.stringify(sealed)).not.toContain("sensitive-credential");
    expect(await unsealToken(sealed, key)).toBe("sensitive-credential");
    await expect(unsealToken({ ...sealed, expiresAt: Date.now() - 100 }, key)).rejects.toThrow();
  });
});
