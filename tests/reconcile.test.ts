import { describe, expect, it } from "vitest";
import { planResourceReconciliation } from "../src/core/reconcile";
import type { WorkerBinding } from "../src/providers/cloudflare/client";

const required: WorkerBinding[] = [
  { name: "DB", type: "d1", id: "391c1df6-dd3f-44f0-991c-63c7873b7d6a" },
  { name: "SITE_SETTINGS_KV", type: "kv_namespace", namespace_id: "a".repeat(32) },
  { name: "INGEST_DO", type: "durable_object_namespace", class_name: "IngestDurableObject" },
  { name: "MAIN_SECRET", type: "secret_text" }
];

describe("safe resource reconciliation preview", () => {
  it("proposes isolated first-install resources without executing anything", () => {
    const result = planResourceReconciliation("not-installed", []);
    expect(result.readyForExecution).toBe(false);
    expect(result.actions.filter(a => a.disposition === "create").map(a => a.binding))
      .toEqual(["DB", "SITE_SETTINGS_KV", "INGEST_DO", "MAIN_SECRET"]);
    expect(result.actions.find(a => a.binding === "ARCHIVE_BUCKET")?.disposition).toBe("optional");
    expect(result.blockers).toEqual([]);
  });

  it("preserves existing database, KV, DO and secret on updates", () => {
    const result = planResourceReconciliation("managed", required);
    expect(result.readyForExecution).toBe(false);
    for (const binding of ["DB", "SITE_SETTINGS_KV", "INGEST_DO", "MAIN_SECRET"]) {
      const item = result.actions.find(x => x.binding === binding);
      expect(item?.disposition).toBe("preserve");
    }
    expect(result.blockers).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("391c1df6-dd3f-44f0-991c-63c7873b7d6a");
  });

  it("forbids replacing a missing database on an existing installation", () => {
    const result = planResourceReconciliation("managed", required.filter(b => b.name !== "DB"));
    expect(result.actions.find(a => a.binding === "DB")?.disposition).toBe("block");
    expect(result.blockers.join(" ")).toContain("DB");
  });

  it("never generates or rotates a secret during an update or adoption", () => {
    for (const kind of ["managed", "legacy-candidate"] as const) {
      const result = planResourceReconciliation(kind, required.filter(b => b.name !== "MAIN_SECRET"));
      expect(result.actions.find(a => a.binding === "MAIN_SECRET")?.disposition).toBe("block");
      expect(result.readyForExecution).toBe(false);
    }
  });

  it("supports older instances using DAILY_SALT_SECRET without rotating derived credentials", () => {
    const legacy: WorkerBinding[] = [
      ...required.filter(b => b.name !== "MAIN_SECRET"),
      { name: "DAILY_SALT_SECRET", type: "secret_text" },
      { name: "BOOTSTRAP_ADMIN_PASSWORD", type: "secret_text" },
      { name: "DASHBOARD_SESSION_SECRET", type: "secret_text" }
    ];
    const plan = planResourceReconciliation("managed", legacy);
    expect(plan.blockers).toHaveLength(0);
    for (const name of ["DAILY_SALT_SECRET", "BOOTSTRAP_ADMIN_PASSWORD", "DASHBOARD_SESSION_SECRET"]) {
      expect(plan.actions.find(a => a.binding === name)?.disposition).toBe("preserve");
    }
    expect(plan.actions.find(a => a.binding === "MAIN_SECRET")).toBeUndefined();
    expect(plan.actions.some(a => a.disposition === "create")).toBe(false);
  });
  it("still requires explicit adoption of legacy instances with a valid legacy root", () => {
    const legacy = [...required.filter(b => b.name !== "MAIN_SECRET"), { name: "DAILY_SALT_SECRET", type: "secret_text" }];
    const plan = planResourceReconciliation("legacy-candidate", legacy);
    expect(plan.blockers.join(" ")).toContain("Legacy instance");
    expect(plan.actions.find(a => a.binding === "DAILY_SALT_SECRET")?.disposition).toBe("preserve");
  });
  it("blocks malformed or missing legacy root secret", () => {
    for (const root of [[{ name: "DAILY_SALT_SECRET", type: "plain_text" }],
      [{ name: "DAILY_SALT_SECRET", type: "secret_text" }, { name: "DAILY_SALT_SECRET", type: "secret_text" }]]) {
      const plan = planResourceReconciliation("managed", [...required.filter(b => b.name !== "MAIN_SECRET"), ...root]);
      expect(plan.blockers.length).toBeGreaterThan(0);
    }
  });
  it("preserves additional secret bindings without exposing values", () => {
    const plan = planResourceReconciliation("managed", [...required, { name: "EXTRA_SERVICE_SECRET", type: "secret_text", text: "confidential-value" }]);
    expect(plan.actions.find(a => a.binding === "EXTRA_SERVICE_SECRET")?.disposition).toBe("preserve");
    expect(JSON.stringify(plan)).not.toContain("confidential-value");
  });
  it("requires explicit adoption of legacy instances", () => {
    const result = planResourceReconciliation("legacy-candidate", required);
    expect(result.blockers.join(" ")).toContain("Legacy instance");
  });

  it("never takes over an unknown Worker even if binding names resemble InsightFlare", () => {
    const result = planResourceReconciliation("conflict", required);
    expect(result.actions.every(a => a.disposition !== "preserve" && a.disposition !== "create")).toBe(true);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("rejects malformed and duplicate resource bindings", () => {
    const malformed = planResourceReconciliation("managed", [
      {...required[0]!, id: "placeholder"},
      ...required.slice(1),
      {...required[1]!}
    ]);
    expect(malformed.actions.find(a => a.binding === "DB")?.disposition).toBe("block");
    expect(malformed.actions.find(a => a.binding === "SITE_SETTINGS_KV")?.disposition).toBe("block");
  });

  it("keeps an R2 archive only when actually configured", () => {
    const plan = planResourceReconciliation("managed", [...required, { type: "r2_bucket", name: "ARCHIVE_BUCKET" }]);
    expect(plan.actions.find(a => a.binding === "ARCHIVE_BUCKET")?.disposition).toBe("preserve");
  });
});
