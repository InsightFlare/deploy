import { describe, expect, it } from "vitest";
import { interpretBindings } from "../src/providers/cloudflare/discovery";
import type { WorkerBinding } from "../src/providers/cloudflare/client";
const id = "a".repeat(32);
const required: WorkerBinding[] = [
  { type: "d1", name: "DB" },
  { type: "kv_namespace", name: "SITE_SETTINGS_KV" },
  { type: "durable_object_namespace", name: "INGEST_DO", class_name: "IngestDurableObject" }
];
describe("Cloudflare Worker discovery", () => {
  it("identifies matching legacy instances without claiming ownership", () => {
    const result = interpretBindings(id, required);
    expect(result.kind).toBe("legacy-candidate");
    expect(result.deployedSha).toBeNull();
  });
  it("recognizes a marked managed deployment", () => {
    const result = interpretBindings(id, [...required, { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: "b".repeat(40) }]);
    expect(result.kind).toBe("managed");
    expect(result.deployedSha).toBe("b".repeat(40));
  });
  it("rejects random workloads using the same Worker name", () => {
    expect(interpretBindings(id, []).kind).toBe("conflict");
  });
  it("does not trust a malformed deployment marker", () => {
    const result = interpretBindings(id, [...required, { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: "main" }]);
    expect(result.kind).toBe("conflict");
  });
  it("rejects duplicate deployment markers", () => {
    const result = interpretBindings(id, [...required,
      { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: "b".repeat(40) },
      { type: "secret_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA" }
    ]);
    expect(result.kind).toBe("conflict");
  });
  it("rejects a deployment marker with the wrong binding type", () => {
    const result = interpretBindings(id, [...required, { type: "secret_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA" }]);
    expect(result.kind).toBe("conflict");
  });
});
