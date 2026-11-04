import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  downloadVerifiedPublicRelease, resolveLatestPublicNightly
} from "../src/core/public-release";

const archivePath = process.env.IFD_NIGHTLY_ARCHIVE;
const manifestPath = process.env.IFD_NIGHTLY_MANIFEST;

describe.skipIf(!archivePath || !manifestPath)("offline full official build through Nightly Release verifier", () => {
  it("verifies real 318 Worker modules, 309 static assets and 43 D1 migrations", async () => {
    const archive = await readFile(archivePath!);
    const externalManifest = await readFile(manifestPath!);
    const manifest = JSON.parse(externalManifest.toString("utf8")) as {
      source: { sha: string }; artifactDigest: string;
    };
    const sha = manifest.source.sha;
    const base = "insightflare-deploy-" + sha;
    const wrap = (name: string, buffer: Buffer) => ({
      name, size: buffer.byteLength,
      digest: "sha256:" + createHash("sha256").update(buffer).digest("hex"),
      browser_download_url: "https://github.com/RavelloH/InsightFlare/releases/download/nightly/" + name
    });
    const release = {
      id: 123, tag_name: "nightly", prerelease: true, draft: false,
      target_commitish: "0".repeat(40),
      body: `<!-- insightflare-deploy-nightly-v1 {"sha":"${sha}","artifactDigest":"${manifest.artifactDigest}","archive":"${base}.tar.gz","manifest":"${base}.json"} -->`,
      assets: [wrap(base + ".tar.gz", archive), wrap(base + ".json", externalManifest)]
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/commits/main")) return Response.json({ sha });
      if (url.endsWith("/releases/tags/nightly")) return Response.json(release);
      if (url.endsWith("/" + base + ".tar.gz")) return new Response(archive);
      if (url.endsWith("/" + base + ".json")) return new Response(externalManifest);
      throw Error("Unexpected Nightly request " + url);
    }) as typeof fetch;

    const resolved = await resolveLatestPublicNightly(fetcher);
    expect(resolved.sha).toBe(sha);
    const verified = await downloadVerifiedPublicRelease(resolved, fetcher);
    expect(verified.artifact.summary.moduleCount).toBe(318);
    expect(verified.artifact.summary.assetCount).toBe(309);
    expect(verified.migrations).toHaveLength(43);
    expect(verified.artifact.summary.digest).toBe("aaf66a7329fc23678e618c262fabae29ffb5454d95b6ceba299e2545200897e5");
    expect(verified.artifact.config.migrations.map(item => item.tag)).toEqual(["v1", "v2", "v3"]);
    expect(verified.artifact.modules.find(item => item.name === "index.js")?.content.byteLength).toBeGreaterThan(0);
    expect(fetcher).toHaveBeenCalledTimes(4);
  }, 120000);
});
