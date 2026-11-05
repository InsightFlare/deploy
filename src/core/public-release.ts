import { DeployError } from "../types";
import { hashArtifactContents, type PinnedArtifact } from "./stage-artifact";
import { validateSha, UPSTREAM } from "./source";

const GITHUB_API = "https://api.github.com/repos/" + UPSTREAM;
const NIGHTLY_TAG = "nightly";
const NIGHTLY_MARKER = "insightflare-deploy-nightly-v1";
const SCHEMA = 1;
const MAX_ARCHIVE = 40 * 1024 * 1024;
const MAX_UNPACKED = 96 * 1024 * 1024;
const MAX_ENTRY_COUNT = 7000;
const SHA256 = /^sha256:([a-f0-9]{64})$/;
const HEX = /^[a-f0-9]{64}$/;
const MIME: Record<string, string> = {
  ".html": "text/html", ".htm": "text/html", ".js": "text/javascript",
  ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".avif": "image/avif", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".otf": "font/otf", ".txt": "text/plain",
  ".xml": "application/xml", ".wasm": "application/wasm", ".pdf": "application/pdf",
  ".eot": "application/vnd.ms-fontobject", ".mp3": "audio/mpeg",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogg": "audio/ogg"
};

export interface GithubReleaseAsset {
  name: string;
  size: number;
  digest: string;
  browser_download_url: string;
}

export interface PublicDeployRelease {
  sha: string;
  tag: "nightly";
  artifactDigest: string;
  archiveAsset: GithubReleaseAsset;
}

export interface ReleaseArtifact {
  artifact: PinnedArtifact;
  migrations: Array<{ name: string; sql: string; sha256: string }>;
  manifest: ReleaseManifest;
  release: PublicDeployRelease;
}

export interface ReleaseManifest {
  schemaVersion: number;
  source: { repository: string; sha: string };
  artifactDigest: string;
  config: {
    mainModule: string;
    compatibilityDate: string;
    compatibilityFlags: string[];
    doMigrations: Array<{ tag: string; [key: string]: unknown }>;
    bindings: Record<string, unknown>;
    vars: Record<string, string>;
    crons: string[];
  };
  files: Array<{ path: string; size: number; sha256: string }>;
  totals: { modules: number; assets: number; migrations: number; bytes: number };
}

function reject(message: string, status = 502): never {
  throw new DeployError("INVALID_SOURCE", "Public Deploy artifact rejected: " + message, status);
}
function safeFileName(name: string): boolean {
  return /^(worker|asset|migrations)\/[A-Za-z0-9_.\/-]+$/.test(name) &&
    name.split("/").every(part => part !== ".." && part !== "." && part !== "");
}
function getExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}
function assetUrl(tag: string, name: string): string {
  return `https://github.com/${UPSTREAM}/releases/download/${tag}/${name}`;
}
function verifiedAsset(raw: unknown, tag: string, expectedName: string): GithubReleaseAsset {
  if (!raw || typeof raw !== "object") return reject("release asset metadata is missing");
  const asset = raw as Record<string, unknown>;
  if (asset.name !== expectedName ||
    !Number.isSafeInteger(asset.size) || (asset.size as number) < 1 ||
    (asset.size as number) > MAX_ARCHIVE ||
    typeof asset.digest !== "string" || !SHA256.test(asset.digest) ||
    asset.browser_download_url !== assetUrl(tag, expectedName)) {
    return reject("release asset name, size, digest or URL did not match the official repository");
  }
  return asset as unknown as GithubReleaseAsset;
}

/** Nightly is a mutable prerelease CHANNEL, not a version or source Git tag. */
export function parseNightlyPointer(body: unknown): {
  sha: string; artifactDigest: string; archive: string;
} {
  if (typeof body !== "string" || body.length > 16000) return reject("nightly release notes are missing");
  const marker = new RegExp("<!--\\s*" + NIGHTLY_MARKER + "\\s+(\\{[^\\r\\n<>]{1,1000}\\})\\s*-->", "g");
  const matches = [...body.matchAll(marker)];
  if (matches.length !== 1) return reject("nightly release must contain one verifiable current commit pointer");
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(matches[0]![1]!) as Record<string, unknown>; }
  catch { return reject("nightly source pointer is not valid JSON"); }
  if (typeof raw.sha !== "string" || !/^[a-f0-9]{40}$/.test(raw.sha) ||
    typeof raw.artifactDigest !== "string" || !HEX.test(raw.artifactDigest) ||
    raw.archive !== "insightflare-deploy-" + raw.sha + ".tar.gz" ||
    "manifest" in raw) {
    return reject("nightly source pointer is inconsistent with its SHA-addressed asset names");
  }
  return {
    sha: raw.sha, artifactDigest: raw.artifactDigest,
    archive: raw.archive
  };
}

/** Resolve exact main SHA; a still-building nightly MUST NOT fall back to a formal release. */
export async function resolvePublicDeployRelease(
  sha: string, fetcher: typeof fetch = fetch
): Promise<PublicDeployRelease> {
  const sourceSha = validateSha(sha);
  const res = await fetcher(`${GITHUB_API}/releases/tags/${NIGHTLY_TAG}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "InsightFlare-Deploy/0.1" },
    signal: AbortSignal.timeout(12000)
  });
  if (res.status === 404) {
    throw new DeployError("UNAVAILABLE", "The official nightly build channel is not available yet.", 409);
  }
  if (!res.ok) {
    throw new DeployError("UPSTREAM_UNAVAILABLE", "Unable to resolve the official nightly release.", 503);
  }
  const data = await res.json() as Record<string, unknown>;
  if (data.tag_name !== NIGHTLY_TAG || data.draft !== false ||
      data.prerelease !== true || !Array.isArray(data.assets)) {
    return reject("nightly release must be a published prerelease with valid assets");
  }
  const pointer = parseNightlyPointer(data.body);
  if (pointer.sha !== sourceSha) {
    throw new DeployError("UNAVAILABLE",
      "The latest upstream commit has not been published to nightly yet; the build may still be running.", 409);
  }
  // The channel's actual Git tag never needs to move. The vetted notes pointer
  // changes only after the single new SHA-addressed tar.gz is uploaded.
  const assets = [...data.assets] as unknown[];
  const found = (name: string) => assets.find(x => (x as { name?: string })?.name === name);
  // Some API responses may truncate attached assets; fetch paginated asset
  // metadata only when the current SHA archive is not in the release body.
  if (!found(pointer.archive)) {
    if (!Number.isSafeInteger(data.id) || (data.id as number) <= 0) {
      return reject("nightly release asset listing was truncated and has no valid release ID");
    }
    for (let page = 1; page <= 10; page++) {
      const assetResponse = await fetcher(
        `${GITHUB_API}/releases/${data.id}/assets?per_page=100&page=${page}`, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "InsightFlare-Deploy/0.1" },
          signal: AbortSignal.timeout(12000)
        }
      );
      if (!assetResponse.ok) throw new DeployError("UPSTREAM_UNAVAILABLE", "Unable to verify nightly asset metadata.", 503);
      const pageAssets = await assetResponse.json() as unknown;
      if (!Array.isArray(pageAssets)) return reject("nightly asset listing is invalid");
      assets.push(...pageAssets);
      if (found(pointer.archive)) break;
      if (pageAssets.length < 100) break;
    }
  }
  return {
    sha: sourceSha, tag: NIGHTLY_TAG,
    artifactDigest: pointer.artifactDigest,
    archiveAsset: verifiedAsset(found(pointer.archive), NIGHTLY_TAG, pointer.archive)
  };
}

/** Fetch official main's HEAD, then require nightly to contain THAT SHA. */
export async function resolveLatestPublicNightly(
  fetcher: typeof fetch = fetch
): Promise<PublicDeployRelease> {
  const res = await fetcher(`${GITHUB_API}/commits/main`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "InsightFlare-Deploy/0.1" },
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) throw new DeployError("UPSTREAM_UNAVAILABLE", "Unable to resolve the latest official main commit.", 503);
  const data = await res.json() as { sha?: unknown };
  if (typeof data.sha !== "string") return reject("upstream main HEAD is invalid");
  return resolvePublicDeployRelease(validateSha(data.sha), fetcher);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const out = new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
  return [...out].map(n => n.toString(16).padStart(2, "0")).join("");
}
async function downloadAsset(
  asset: GithubReleaseAsset, fetcher: typeof fetch
): Promise<Uint8Array> {
  const result = await fetcher(asset.browser_download_url, {
    headers: { Accept: "application/octet-stream", "User-Agent": "InsightFlare-Deploy/0.1" },
    signal: AbortSignal.timeout(60000)
  });
  if (!result.ok || !result.body) {
    throw new DeployError("UPSTREAM_UNAVAILABLE", "Unable to download an official public release asset.", 503);
  }
  if (Number(result.headers.get("content-length") ?? 0) > asset.size) {
    return reject("release asset exceeds its declared GitHub size");
  }
  const reader = result.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_ARCHIVE || length > asset.size) return reject("release asset exceeded the size limit");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (length !== asset.size) return reject("release asset length changed during download");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if ("sha256:" + await sha256(bytes) !== asset.digest) return reject("release asset SHA256 mismatch");
  return bytes;
}

async function decompressArchive(gzip: Uint8Array): Promise<Uint8Array> {
  let stream: ReadableStream<Uint8Array>;
  try {
    const copy = new Uint8Array(gzip.byteLength);
    copy.set(gzip);
    stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  } catch {
    return reject("gzip decompression is unavailable");
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UNPACKED) return reject("uncompressed archive exceeds the safe size limit");
      chunks.push(value);
    }
  } catch {
    return reject("gzip archive is corrupted");
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let index = 0;
  for (const chunk of chunks) { result.set(chunk, index); index += chunk.byteLength; }
  return result;
}

function headerString(buf: Uint8Array, from: number, count: number): string {
  const raw = buf.subarray(from, from + count);
  const end = raw.indexOf(0);
  return new TextDecoder("utf-8", { fatal: true }).decode(end === -1 ? raw : raw.subarray(0, end));
}
function tarNumber(buf: Uint8Array, from: number, count: number): number {
  const raw = headerString(buf, from, count).trim();
  if (!/^[0-7]+$/.test(raw)) return reject("invalid tar numeric field");
  const n = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(n)) return reject("oversized tar numeric field");
  return n;
}

/** Strict USTAR reader. Rejects paths, links, GNU PAX extensions and duplicates. */
export function parseDeployTar(bytes: Uint8Array): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  let index = 0;
  while (index + 512 <= bytes.length) {
    const block = bytes.subarray(index, index + 512);
    if (block.every(b => b === 0)) break;
    const oldChecksum = tarNumber(block, 148, 8);
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : block[i]!;
    if (checksum !== oldChecksum) return reject("invalid tar header checksum");
    const prefix = headerString(block, 345, 155);
    const name = (prefix ? prefix + "/" : "") + headerString(block, 0, 100);
    const kind = block[156];
    const size = tarNumber(block, 124, 12);
    const normalized = name.startsWith("./") ? name.slice(2) : name;
    if (kind === 53) {
      if (size !== 0) return reject("nonempty tar directory entry");
    } else {
      if (kind !== 0 && kind !== 48) return reject("tar contains a link or special entry");
      if (normalized !== "manifest.json" && !safeFileName(normalized)) return reject("tar path is not allowed");
      if (map.has(normalized) || map.size >= MAX_ENTRY_COUNT) return reject("duplicate or excessive tar entries");
      const dataStart = index + 512;
      if (size > MAX_UNPACKED || dataStart + size > bytes.length) return reject("tar entry exceeds the archive");
      map.set(normalized, bytes.subarray(dataStart, dataStart + size));
    }
    index += 512 + Math.ceil(size / 512) * 512;
  }
  if (index + 1024 > bytes.length && bytes.length % 512 !== 0) return reject("truncated tar archive");
  return map;
}

function validateManifest(input: unknown, sha: string): ReleaseManifest {
  if (!input || typeof input !== "object") return reject("release manifest is missing");
  const m = input as ReleaseManifest;
  if (m.schemaVersion !== SCHEMA || m.source?.sha !== sha ||
    m.source.repository !== UPSTREAM || !HEX.test(m.artifactDigest) ||
    m.config?.mainModule !== "index.js" ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(m.config?.compatibilityDate ?? "") ||
    !Array.isArray(m.config?.compatibilityFlags) ||
    !Array.isArray(m.config?.doMigrations) ||
    !Array.isArray(m.files) || m.files.length < 3 || m.files.length > MAX_ENTRY_COUNT ||
    !m.totals || !Number.isSafeInteger(m.totals.bytes) || m.totals.bytes > MAX_UNPACKED) {
    return reject("release manifest provenance or schema is invalid");
  }
  return m;
}

/** Download only public Release assets; no customer or GitHub credentials. */
export async function downloadVerifiedPublicRelease(
  release: PublicDeployRelease, fetcher: typeof fetch = fetch
): Promise<ReleaseArtifact> {
  const archiveBytes = await downloadAsset(release.archiveAsset, fetcher);
  const parsed = parseDeployTar(await decompressArchive(archiveBytes));
  const internalManifest = parsed.get("manifest.json");
  if (!internalManifest) return reject("internal manifest is missing");
  let external: ReleaseManifest;
  try {
    external = validateManifest(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(internalManifest)), release.sha
    );
  } catch (error) {
    if (error instanceof DeployError) throw error;
    return reject("internal manifest is not valid JSON");
  }
  if (external.artifactDigest !== release.artifactDigest) {
    return reject("nightly pointer digest differs from its verified manifest");
  }
  parsed.delete("manifest.json");
  if (external.files.length !== parsed.size) return reject("manifest file count differs from the archive");
  const modules: PinnedArtifact["modules"] = [];
  const assets: PinnedArtifact["assets"] = [];
  const migrations: ReleaseArtifact["migrations"] = [];
  let totalBytes = 0;
  const encountered = new Set<string>();
  for (const file of external.files) {
    if (!file || !safeFileName(file.path) || encountered.has(file.path) ||
      !Number.isSafeInteger(file.size) || file.size < 0 || !HEX.test(file.sha256)) {
      return reject("invalid or duplicate manifest entry");
    }
    encountered.add(file.path);
    const bytes = parsed.get(file.path);
    if (!bytes || bytes.byteLength !== file.size || await sha256(bytes) !== file.sha256) {
      return reject("release payload failed per-file SHA256 verification");
    }
    totalBytes += bytes.byteLength;
    const name = file.path.slice(file.path.indexOf("/") + 1);
    if (file.path.startsWith("worker/")) {
      if (!/\.(?:js|mjs|wasm)$/.test(name)) return reject("unexpected Worker module");
      modules.push({ name, contentType: name.endsWith(".wasm") ? "application/wasm" : "application/javascript+module", content: bytes });
    } else if (file.path.startsWith("asset/")) {
      const mime = MIME[getExt(name)];
      if (!mime) return reject("unknown static asset MIME type");
      assets.push({ path: name, contentType: mime, content: bytes });
    } else {
      if (!name.endsWith(".sql")) return reject("unexpected database migration filename");
      migrations.push({ name, sql: new TextDecoder("utf-8", { fatal: true }).decode(bytes), sha256: file.sha256 });
    }
  }
  if (totalBytes !== external.totals.bytes ||
      modules.length !== external.totals.modules ||
      assets.length !== external.totals.assets ||
      migrations.length !== external.totals.migrations ||
      modules.length === 0 || assets.length === 0 || migrations.length === 0 ||
      !modules.some(item => item.name === "index.js")) {
    return reject("release manifest totals or entrypoint are inconsistent");
  }
  const artifact: PinnedArtifact = {
    pinnedSha: release.sha,
    config: {
      name: "insightflare",
      mainModule: external.config.mainModule,
      compatibilityDate: external.config.compatibilityDate,
      compatibilityFlags: external.config.compatibilityFlags,
      migrations: external.config.doMigrations,
      observedBuildVariables: Object.keys(external.config.vars ?? {}),
      cronTriggers: external.config.crons ?? []
    },
    modules, assets,
    summary: {
      sourceSha: release.sha,
      digest: external.artifactDigest,
      moduleCount: modules.length,
      moduleBytes: modules.reduce((n, x) => n + x.content.byteLength, 0),
      assetCount: assets.length,
      assetBytes: assets.reduce((n, x) => n + x.content.byteLength, 0),
      migrationTags: external.config.doMigrations.map(x => x.tag)
    }
  };
  if (await hashArtifactContents(artifact) !== external.artifactDigest) {
    return reject("complete artifact digest differs from the official release manifest");
  }
  return { release, artifact, manifest: external, migrations };
}
