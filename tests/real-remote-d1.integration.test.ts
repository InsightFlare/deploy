import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { CloudflareClient } from "../src/providers/cloudflare/client";
import { planD1Migrations } from "../src/core/d1-migrations";
import {
  downloadVerifiedPublicRelease, parseDeployTar, type PublicDeployRelease
} from "../src/core/public-release";

const accountId = process.env.IFD_TEST_ACCOUNT_ID;
const databaseId = process.env.IFD_TEST_D1_ID;
const archivePath = process.env.IFD_NIGHTLY_ARCHIVE;
const token = process.env.IFD_TEST_API_TOKEN;

describe.skipIf(!accountId || !databaseId || !archivePath || !token)(
  "approved test account: real Cloudflare D1 migration preflight, READ ONLY", () => {
    it("reconciles actual Wrangler history and recovery bookmark to a verified official Nightly archive", async () => {
      if (accountId === "442fe5198bff93bdf60d4223d9618033") {
        throw new Error("Refusing to run against production Cloudflare account");
      }
      const bytes = await readFile(archivePath!);
      const files = parseDeployTar(gunzipSync(bytes));
      const embedded = files.get("manifest.json");
      expect(embedded).toBeDefined();
      const manifest = JSON.parse(Buffer.from(embedded!).toString("utf8")) as {
        source: { sha: string }; artifactDigest: string; totals: { migrations: number };
      };
      const name = "insightflare-deploy-" + manifest.source.sha + ".tar.gz";
      const release: PublicDeployRelease = {
        sha: manifest.source.sha, artifactDigest: manifest.artifactDigest,
        tag: "nightly",
        archiveAsset: {
          name, size: bytes.byteLength,
          digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
          browser_download_url: "https://github.com/RavelloH/InsightFlare/releases/download/nightly/" + name
        }
      };
      const sourceFetcher = vi.fn(async () => new Response(bytes)) as typeof fetch;
      const verified = await downloadVerifiedPublicRelease(release, sourceFetcher);
      const client = new CloudflareClient(token!);
      const snapshot = await client.d1MigrationSnapshot(accountId!, databaseId!);
      const plan = await planD1Migrations(verified, snapshot);
      expect(snapshot.bookmark.length).toBeGreaterThan(10);
      expect(snapshot.appliedNames).toHaveLength(manifest.totals.migrations);
      expect(plan.pending).toHaveLength(0);
      expect(plan.initialInstall).toBe(false);
      expect(plan.needsConfirmation).toBe(false);
      expect(plan.sourceSha).toBe(manifest.source.sha);
      expect(sourceFetcher).toHaveBeenCalledTimes(1);
    }, 60000);
  }
);
