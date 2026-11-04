import { describe, expect, it } from "vitest";
import { inheritWorkerBindings, markManagedVersionBindings } from "../src/core/version-bindings";
import { planDurableObjectMigrations } from "../src/core/do-migrations";
import type { WorkerVersion } from "../src/providers/cloudflare/client";

const versionId = "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";

describe("Worker binding inheritance", () => {
  const active: Pick<WorkerVersion, "id" | "bindings"> = {
    id: versionId,
    bindings: [
      { name: "ASSETS", type: "assets" },
      { name: "MAIN_SECRET", type: "secret_text" },
      { name: "DB", type: "d1", database_id: "old-database" },
      { name: "INGEST_DO", type: "durable_object_namespace", class_name: "IngestDurableObject" },
      { name: "SITE_SETTINGS_KV", type: "kv_namespace", namespace_id: "a".repeat(32) },
      { name: "SESSION_WINDOW_MINUTES", type: "plain_text", text: "30" }
    ]
  };

  it("inherits every binding from the exact active version without transmitting secret values", () => {
    const result = inheritWorkerBindings(active);
    expect(result).toHaveLength(6);
    expect(result).toEqual([
      { type: "inherit", name: "ASSETS", version_id: versionId },
      { type: "inherit", name: "MAIN_SECRET", version_id: versionId },
      { type: "inherit", name: "DB", version_id: versionId },
      { type: "inherit", name: "INGEST_DO", version_id: versionId },
      { type: "inherit", name: "SITE_SETTINGS_KV", version_id: versionId },
      { type: "inherit", name: "SESSION_WINDOW_MINUTES", version_id: versionId }
    ]);
  });

  it("allows a deliberate D1 clone override while retaining every other binding", () => {
    const result = inheritWorkerBindings(active, [{
      name: "DB",
      binding: { type: "d1", name: "DB", database_id: "clone-database" }
    }]);
    expect(result.find(item => item.name === "DB")).toEqual({
      type: "d1", name: "DB", database_id: "clone-database"
    });
    expect(result.find(item => item.name === "MAIN_SECRET")).toEqual({
      type: "inherit", name: "MAIN_SECRET", version_id: versionId
    });
  });

  it("blocks an unverifiable binding inventory and duplicate names", () => {
    expect(() => inheritWorkerBindings({ id: versionId, bindings: undefined })).toThrow("binding inventory");
    expect(() => inheritWorkerBindings({ id: versionId, bindings: [
      { name: "DB", type: "d1" }, { name: "DB", type: "d1" }
    ] })).toThrow("duplicate binding names");
  });

  it("marks only the staged candidate with the pinned source SHA without losing inherited secrets", () => {
    const sourceSha = "a".repeat(40);
    const inherited = inheritWorkerBindings(active);
    const marked = markManagedVersionBindings(inherited, sourceSha);
    expect(marked).toHaveLength(inherited.length + 1);
    expect(marked.find(item => item.name === "MAIN_SECRET")).toEqual({
      type: "inherit", name: "MAIN_SECRET", version_id: versionId
    });
    expect(marked.filter(item => item.name === "INSIGHTFLARE_DEPLOYMENT_SHA")).toEqual([
      { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: sourceSha }
    ]);
    const reMarked = markManagedVersionBindings(marked, "b".repeat(40));
    expect(reMarked.filter(item => item.name === "INSIGHTFLARE_DEPLOYMENT_SHA")).toEqual([
      { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: "b".repeat(40) }
    ]);
  });

  it("blocks duplicate/incorrect marker and invalid source SHA", () => {
    const bindings = inheritWorkerBindings(active);
    expect(() => markManagedVersionBindings(bindings, "main")).toThrow("full source SHA");
    expect(() => markManagedVersionBindings([
      { name: "DB", type: "inherit", version_id: versionId },
      { name: "DB", type: "inherit", version_id: versionId }
    ], "a".repeat(40))).toThrow("duplicate or invalid bindings");
    expect(() => markManagedVersionBindings([
      { name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "secret_text" }
    ], "a".repeat(40))).toThrow("invalid type");
  });

  it("blocks overrides that add unknown names or contain secret values", () => {
    expect(() => inheritWorkerBindings(active, [{
      name: "NEW_BINDING", binding: { type: "plain_text", name: "NEW_BINDING", text: "x" }
    }])).toThrow("existing binding");
    expect(() => inheritWorkerBindings(active, [{
      name: "MAIN_SECRET", binding: { type: "secret_text", name: "MAIN_SECRET", text: "never" }
    }])).toThrow("Secret values");
  });
});

describe("Durable Object migration planning", () => {
  const history = [
    { tag: "v1", new_sqlite_classes: ["IngestDurableObject"] },
    { tag: "v2", new_sqlite_classes: ["DiagnosticsSampler"] },
    { tag: "v3", deleted_classes: ["DiagnosticsSampler"] }
  ];

  it("plans only forward steps after the deployed tag", () => {
    expect(planDurableObjectMigrations("v1", history)).toEqual({
      old_tag: "v1",
      new_tag: "v3",
      steps: [
        { new_sqlite_classes: ["DiagnosticsSampler"] },
        { deleted_classes: ["DiagnosticsSampler"] }
      ]
    });
  });

  it("does not send a migration when the deployed tag is already current", () => {
    expect(planDurableObjectMigrations("v3", history)).toBeNull();
  });

  it("plans the full migration history for a genuinely new Worker", () => {
    expect(planDurableObjectMigrations(null, history)).toEqual({
      new_tag: "v3",
      steps: [
        { new_sqlite_classes: ["IngestDurableObject"] },
        { new_sqlite_classes: ["DiagnosticsSampler"] },
        { deleted_classes: ["DiagnosticsSampler"] }
      ]
    });
  });

  it("blocks unknown deployed tags rather than guessing", () => {
    expect(() => planDurableObjectMigrations("v0", history)).toThrow("not present in this source build");
  });

  it("rejects duplicate tags and empty migration steps", () => {
    expect(() => planDurableObjectMigrations("v1", [
      { tag: "v1", new_classes: ["A"] }, { tag: "v1", new_classes: ["B"] }
    ])).toThrow("valid and unique");
    expect(() => planDurableObjectMigrations("v1", [
      { tag: "v1", new_classes: ["A"] }, { tag: "v2" }
    ])).toThrow("empty Durable Object migration step");
  });
});
