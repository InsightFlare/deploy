import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  downloadVerifiedPublicRelease, parseNightlyPointer, resolveLatestPublicNightly,
  resolvePublicDeployRelease
} from "../src/core/public-release";

const sha = "d".repeat(40);
const otherSha = "e".repeat(40);
const digest = "a".repeat(64);
const base = "insightflare-deploy-" + sha;
const notes = (commit = sha, hash = digest) =>
  `# Nightly\n<!-- insightflare-deploy-nightly-v1 {"sha":"${commit}","artifactDigest":"${hash}","archive":"insightflare-deploy-${commit}.tar.gz","manifest":"insightflare-deploy-${commit}.json"} -->\n`;
const asset = (name: string, bytes: Uint8Array = new Uint8Array([1, 2, 3])) => ({
  name,
  size: bytes.length,
  digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
  browser_download_url: `https://github.com/RavelloH/InsightFlare/releases/download/nightly/${name}`
});
function release(extra: Record<string, unknown> = {}) {
  return {
    id: 123, tag_name: "nightly", target_commitish: otherSha,
    draft: false, prerelease: true, immutable: false,
    body: notes(), assets: [
      asset(base + ".json"), asset(base + ".tar.gz"),
      asset("insightflare-deploy-" + otherSha + ".tar.gz")
    ], ...extra
  };
}
function mockApi(data: object, head = sha) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/commits/main")) return Response.json({ sha: head });
    if (url.endsWith("/releases/tags/nightly")) return Response.json(data);
    if (url.includes("/releases/123/assets?per_page=100&page=1")) return Response.json(release().assets);
    throw new Error("Unexpected request: " + url);
  }) as unknown as typeof fetch;
}

describe("rolling nightly channel resolution", () => {
  it("parses exactly one SHA-addressed pointer and rejects malformed or ambiguous notes", () => {
    expect(parseNightlyPointer(notes())).toEqual({
      sha, artifactDigest: digest, archive: base + ".tar.gz", manifest: base + ".json"
    });
    expect(() => parseNightlyPointer(notes() + notes())).toThrow("one verifiable");
    expect(() => parseNightlyPointer(notes(sha, "z".repeat(64)))).toThrow("inconsistent");
    expect(() => parseNightlyPointer("Official v0.7.1 stable Release")).toThrow("one verifiable");
    expect(() => parseNightlyPointer(null)).toThrow("missing");
  });

  it("resolves latest main SHA from the official commit API, not a formal release or moving tag", async () => {
    const fetcher = mockApi(release());
    const resolved = await resolveLatestPublicNightly(fetcher);
    expect(resolved).toMatchObject({
      sha, tag: "nightly", artifactDigest: digest,
      manifestAsset: { name: base + ".json" },
      archiveAsset: { name: base + ".tar.gz" }
    });
    const urls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.map(x => String(x[0]));
    expect(urls).toEqual([
      "https://api.github.com/repos/RavelloH/InsightFlare/commits/main",
      "https://api.github.com/repos/RavelloH/InsightFlare/releases/tags/nightly"
    ]);
    expect(urls.every((url: string) => !url.includes("/releases/latest") && !url.includes("/releases/tags/v"))).toBe(true);
  });

  it("refuses a nightly pointer that has not caught up with official main", async () => {
    const fetcher = mockApi(release(), otherSha);
    await expect(resolveLatestPublicNightly(fetcher)).rejects.toThrow("build may still be running");
  });

  it("allows older assets to coexist, but always chooses only exact SHA filenames", async () => {
    const result = await resolvePublicDeployRelease(sha, mockApi(release()));
    expect(result.manifestAsset.name).toBe(base + ".json");
    expect(result.archiveAsset.name).toBe(base + ".tar.gz");
  });

  it("reads paginated asset metadata if the release body response omits newly uploaded files", async () => {
    const fetcher = mockApi(release({ assets: [] }));
    const result = await resolvePublicDeployRelease(sha, fetcher);
    expect(result.archiveAsset.name).toBe(base + ".tar.gz");
    expect((fetcher as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("blocks drafts, stable releases, invalid download URLs and missing SHA256 digests", async () => {
    for (const data of [
      release({ draft: true }),
      release({ prerelease: false }),
      release({ tag_name: "v0.7.1" }),
      release({ assets: [asset(base + ".json"), { ...asset(base + ".tar.gz"), digest: undefined }] }),
      release({ assets: [asset(base + ".json"), { ...asset(base + ".tar.gz"), browser_download_url: "https://untrusted.invalid/evil" }] })
    ]) {
      await expect(resolvePublicDeployRelease(sha, mockApi(data))).rejects.toThrow();
    }
  });

  it("blocks a missing nightly release rather than falling back to the last stable version", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch;
    await expect(resolvePublicDeployRelease(sha, fetcher)).rejects.toThrow("nightly build channel");
  });
});

/** Minimal valid USTAR encoder for a small, fully verified in-memory test bundle. */
function tarFile(name: string, data: Uint8Array): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(data.length.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(32, 148, 156);
  header.write("0", 156, 1);
  header.write("ustar\0", 257, 6);
  header.write("00", 263, 2);
  const checksum = [...header].reduce((sum, n) => sum + n, 0);
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, Buffer.from(data), padding]);
}
function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
function fixture() {
  const files = new Map<string, Uint8Array>([
    ["worker/index.js", new TextEncoder().encode("export default { fetch(){return new Response('ok')} }")],
    ["asset/index.html", new TextEncoder().encode("<!doctype html>")],
    ["migrations/0001.sql", new TextEncoder().encode("CREATE TABLE hello (id INTEGER);")]
  ]);
  const artifactHash = createHash("sha256");
  for (const [name, bytes] of [...files].filter(([name]) => name.startsWith("worker/") || name.startsWith("asset/"))
    .sort((a, b) => a[0].localeCompare(b[0], "en"))) {
    artifactHash.update(name).update("\0").update(Buffer.from(sha256(bytes), "hex")).update("\0");
  }
  const actualDigest = artifactHash.digest("hex");
  const manifest = {
    schemaVersion: 1, source: { repository: "RavelloH/InsightFlare", sha },
    artifactDigest: actualDigest,
    config: {
      mainModule: "index.js", compatibilityDate: "2026-03-01",
      compatibilityFlags: ["nodejs_compat"],
      doMigrations: [{ tag: "v1", new_sqlite_classes: ["IngestDurableObject"] }],
      bindings: { d1: ["DB"], kv: ["SITE_SETTINGS_KV"] },
      vars: {}, crons: []
    },
    files: [...files].map(([path, bytes]) => ({ path, size: bytes.length, sha256: sha256(bytes) })),
    totals: { modules: 1, assets: 1, migrations: 1,
      bytes: [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0) }
  };
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const tar = Buffer.concat([
    ...[...files].map(([name, bytes]) => tarFile("./" + name, bytes)),
    tarFile("./manifest.json", json),
    Buffer.alloc(1024)
  ]);
  const archive = gzipSync(tar);
  const listing = release({
    body: notes(sha, actualDigest),
    assets: [asset(base + ".json", json), asset(base + ".tar.gz", archive)]
  });
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/releases/tags/nightly")) return Response.json(listing);
    if (url.endsWith("/" + base + ".json")) return new Response(json);
    if (url.endsWith("/" + base + ".tar.gz")) return new Response(archive);
    throw new Error("Unexpected URL " + url);
  }) as unknown as typeof fetch;
  return { fetcher, listing, manifest, files, json, archive };
}

describe("nightly asset binary verification", () => {
  it("downloads release files and verifies GitHub digests, archive entries and aggregate digest", async () => {
    const f = fixture();
    const release = await resolvePublicDeployRelease(sha, f.fetcher);
    const verified = await downloadVerifiedPublicRelease(release, f.fetcher);
    expect(verified.migrations).toHaveLength(1);
    expect(verified.artifact.modules).toHaveLength(1);
    expect(verified.artifact.assets).toHaveLength(1);
    expect(verified.artifact.summary.digest).toBe(f.manifest.artifactDigest);
    expect(verified.artifact.pinnedSha).toBe(sha);
  });

  it("refuses a tampered asset even when the filename and SHA pointer are correct", async () => {
    const f = fixture();
    const release = await resolvePublicDeployRelease(sha, f.fetcher);
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith(".tar.gz")) return new Response(new Uint8Array(f.archive.map((x, i) => i === 11 ? x ^ 1 : x)));
      return new Response(f.json);
    }) as typeof fetch;
    await expect(downloadVerifiedPublicRelease(release, fetcher)).rejects.toThrow("SHA256 mismatch");
  });

  it("refuses a modified nightly pointer even if both GitHub assets still have valid digests", async () => {
    const f = fixture();
    const forged = release({
      body: notes(sha, digest),
      assets: f.listing.assets
    });
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/releases/tags/nightly")) return Response.json(forged);
      return f.fetcher(url);
    }) as typeof fetch;
    const resolved = await resolvePublicDeployRelease(sha, fetcher);
    await expect(downloadVerifiedPublicRelease(resolved, fetcher)).rejects.toThrow("pointer digest differs");
  });
});
