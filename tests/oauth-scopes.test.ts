import { describe, expect, it } from "vitest";
import { requestedOAuthScopes } from "../src/security/oauth";

describe("least-privilege Cloudflare OAuth escalation", () => {
  const defaultScopes = "workers-scripts.read account-settings.read zone.read";
  it("keeps initial connection permission unchanged", () => {
    expect(requestedOAuthScopes(defaultScopes)).toBe(defaultScopes);
  });
  it("adds verified D1 Read scope only after explicit request", () => {
    expect(requestedOAuthScopes(defaultScopes, "d1-read")).toBe(
      defaultScopes + " d1.read"
    );
  });
  it("requests D1 Write only from the user's explicit action, never by default", () => {
    expect(requestedOAuthScopes(defaultScopes, "d1-write")).toBe(
      defaultScopes + " d1.read d1.write"
    );
  });
  it("requests Worker upload permission only when explicitly selected", () => {
    expect(requestedOAuthScopes(defaultScopes,"workers-write")).toBe(
      defaultScopes+" workers-scripts.write"
    );
    expect(requestedOAuthScopes(defaultScopes)).toBe(defaultScopes);
  });
  it("requests the three deployment capabilities in a single explicit consent", () => {
    expect(requestedOAuthScopes(defaultScopes,"deploy")).toBe(
      defaultScopes+" d1.read d1.write workers-scripts.write"
    );
  });
  it("never duplicates a previously allowed scope", () => {
    expect(requestedOAuthScopes(defaultScopes+" d1.read", "d1-read").split("d1.read")).toHaveLength(2);
  });
  it("does not allow raw user-provided OAuth scope escalation", () => {
    for (const request of ["d1.write", "workers-scripts.write", "admin", "d1-read d1.write"]) {
      expect(() => requestedOAuthScopes(defaultScopes, request)).toThrow("Unsupported");
    }
  });
});
