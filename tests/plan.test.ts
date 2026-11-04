import { describe, it, expect } from "vitest";
import { deploymentPlan, type Deployment } from "../src/core/plan";
import { parseMainCommit } from "../src/core/source";

const source = parseMainCommit({ sha: "1".repeat(40) });
const deployment = (kind: Deployment["kind"], deployedSha: string | null = null): Deployment => ({
  kind, accountId: "a".repeat(32), workerName: "insightflare", deployedSha,
  bindings: { database: true, kv: true, ingest: true }, issues: []
});

describe("deployment planning safety", () => {
  it("never enables mutation before user-owned builds validation", () => {
    const plan = deploymentPlan(deployment("not-installed"), source, "install");
    expect(plan.allowed).toBe(false);
    expect(plan.blockers).toHaveLength(1);
    expect(plan.sourceSha).toBe(source.sha);
  });
  it("blocks unknown Workers rather than overwriting", () => {
    expect(deploymentPlan(deployment("conflict"), source, "install").blockers.join(" ")).toContain("Automatic takeover");
  });
  it("blocks legacy adoption until explicit migration", () => {
    expect(deploymentPlan(deployment("legacy-candidate"), source, "update").blockers.join(" ")).toContain("adoption");
  });
  it("refuses update without a Worker", () => {
    expect(deploymentPlan(deployment("not-installed"), source, "update").blockers.join(" ")).toContain("Nothing is installed");
  });
  it("repair pins installed SHA and never blindly jumps to latest", () => {
    const old = "2".repeat(40);
    const plan = deploymentPlan(deployment("managed", old), source, "repair");
    expect(plan.sourceSha).toBe(old);
    expect(plan.sourceSha).not.toBe(source.sha);
  });
  it("repair without trusted SHA remains blocked", () => {
    const plan = deploymentPlan(deployment("legacy-candidate"), source, "repair");
    expect(plan.blockers.join(" ")).toContain("known managed");
  });
});
