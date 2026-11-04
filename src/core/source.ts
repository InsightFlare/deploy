import { DeployError } from "../types";

export const UPSTREAM = "RavelloH/InsightFlare";
const SHA = /^[0-9a-f]{40}$/;

export interface MainCommit {
  repository: string;
  ref: "main";
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string | null;
  url: string;
}

export function validateSha(value: string): string {
  const valueLower = value.toLowerCase();
  if (!SHA.test(valueLower)) throw new DeployError("INVALID_SOURCE", "The source commit must be a complete 40-character Git SHA.");
  return valueLower;
}

export function parseMainCommit(input: unknown): MainCommit {
  if (!input || typeof input !== "object") throw new DeployError("INVALID_SOURCE", "GitHub returned an invalid commit.");
  const data = input as Record<string, any>;
  const sha = validateSha(data.sha);
  const message = typeof data.commit?.message === "string" ? data.commit.message.split("\n")[0]!.slice(0, 180) : "";
  const committedAt = typeof data.commit?.committer?.date === "string" ? data.commit.committer.date : null;
  return { repository: UPSTREAM, ref: "main", sha, shortSha: sha.slice(0, 8), message, committedAt, url: `https://github.com/${UPSTREAM}/commit/${sha}` };
}

export async function resolveLatestMain(fetcher: typeof fetch = fetch): Promise<MainCommit> {
  const res = await fetcher(`https://api.github.com/repos/${UPSTREAM}/commits/main`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "InsightFlare-Deploy/0.1" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new DeployError("UPSTREAM_UNAVAILABLE", "Unable to read the latest main commit from GitHub.", 503);
  return parseMainCommit(await res.json());
}
