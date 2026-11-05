import { createHash } from "node:crypto";
import { planD1Migrations } from "../src/core/d1-migrations";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  downloadVerifiedPublicRelease, parseDeployTar, resolveLatestPublicNightly
} from "../src/core/public-release";

const archivePath = process.env.IFD_NIGHTLY_ARCHIVE;

describe.skipIf(!archivePath)("offline complete official build through one-file Nightly Release verifier", () => {
  it("verifies real Worker modules, static assets and D1 migrations from one tar.gz", async () => {
    const archive = await readFile(archivePath!);
    const entries = parseDeployTar(gunzipSync(archive));
    const embeddedManifest = entries.get("manifest.json");
    expect(embeddedManifest).toBeDefined();
    const manifest = JSON.parse(Buffer.from(embeddedManifest!).toString("utf8")) as {
      source: { sha: string }; artifactDigest: string; totals: { modules: number; assets: number; migrations: number };
    };
    const sha = manifest.source.sha;
    const base = "insightflare-deploy-" + sha;
    const release = {
      id: 123, tag_name: "nightly", prerelease: true, draft: false,
      target_commitish: sha,
      body: `<!-- insightflare-deploy-nightly-v1 {"sha":"${sha}","artifactDigest":"${manifest.artifactDigest}","archive":"${base}.tar.gz"} -->`,
      assets: [{
        name: base + ".tar.gz", size: archive.byteLength,
        digest: "sha256:" + createHash("sha256").update(archive).digest("hex"),
        browser_download_url: "https://github.com/RavelloH/InsightFlare/releases/download/nightly/" + base + ".tar.gz"
      }]
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/commits/main")) return Response.json({ sha });
      if (url.endsWith("/releases/tags/nightly")) return Response.json(release);
      if (url.endsWith("/" + base + ".tar.gz")) return new Response(archive);
      throw Error("Unexpected Nightly request " + url);
    }) as typeof fetch;

    const resolved = await resolveLatestPublicNightly(fetcher);
    expect(resolved.sha).toBe(sha);
    const verified = await downloadVerifiedPublicRelease(resolved, fetcher);
    expect(verified.artifact.summary.moduleCount).toBe(manifest.totals.modules);
    expect(verified.artifact.summary.assetCount).toBe(manifest.totals.assets);
    expect(verified.migrations).toHaveLength(manifest.totals.migrations);
    expect(verified.artifact.summary.digest).toBe(manifest.artifactDigest);
    expect(verified.artifact.config.migrations.map(item => item.tag)).toEqual(["v1", "v2", "v3"]);
    expect(verified.artifact.modules.find(item => item.name === "index.js")?.content.byteLength).toBeGreaterThan(0);
    const prepared = await planD1Migrations(verified, {
      accountId: "a".repeat(32),
      databaseId: "8a6f8ac3-8972-4f25-80d1-40ce170a1da9",
      tableNames: [],
      appliedNames: null,
      bookmark: "mock-recovery-bookmark"
    });
    expect(prepared.initialInstall).toBe(true);
    expect(prepared.pending).toHaveLength(manifest.totals.migrations);
    expect(prepared.pending.every(step => step.sha256.length === 64)).toBe(true);
    const almostCurrent = await planD1Migrations(verified, {
      accountId: "a".repeat(32),
      databaseId: "8a6f8ac3-8972-4f25-80d1-40ce170a1da9",
      tableNames: ["d1_migrations", "users"],
      appliedNames: verified.migrations.slice(0, -1).map(file => file.name),
      bookmark: "mock-recovery-bookmark"
    });
    expect(almostCurrent.initialInstall).toBe(false);
    expect(almostCurrent.pending.map(item => item.name)).toEqual(
      [verified.migrations.at(-1)?.name]
    );
    const current = await planD1Migrations(verified, {
      accountId: "a".repeat(32),
      databaseId: "8a6f8ac3-8972-4f25-80d1-40ce170a1da9",
      tableNames: ["d1_migrations", "users"],
      appliedNames: verified.migrations.map(file => file.name),
      bookmark: "mock-recovery-bookmark"
    });
    expect(current.pending).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
  }, 120000);
});
