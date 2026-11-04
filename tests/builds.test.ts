import { describe, expect, it } from "vitest";
import { buildRequest, BUILD_ADAPTER_STATUS } from "../src/providers/cloudflare/builds";
describe("user-owned Workers Builds adapter contract", () => {
  it("pins commit hash and not just mutable main", () => {
    const request = buildRequest("a".repeat(32), "76cdf1ca-7ddb-44a9-9e0e-3ab8759648af", "c".repeat(40));
    expect(request.method).toBe("POST");
    expect(request.body.commit_hash).toBe("c".repeat(40));
    expect(request.body.branch).toBe("main");
    expect(request.requiredPermission).toBe("Workers CI Write");
  });
  it("requires validated identifiers", () => {
    expect(() => buildRequest("123", "wrong", "c".repeat(40))).toThrow();
    expect(() => buildRequest("a".repeat(32), "76cdf1ca-7ddb-44a9-9e0e-3ab8759648af", "main")).toThrow();
  });
  it("does not falsely advertise an executable build", () => {
    expect(BUILD_ADAPTER_STATUS.executionAvailable).toBe(false);
    expect(BUILD_ADAPTER_STATUS.blockers.length).toBeGreaterThan(0);
  });
});
