import { DeployError } from "../types";

const API_HOST = "api.github.com";

/**
 * fetch for GitHub. Unauthenticated API calls share a 60/hour limit per IP,
 * which shared Workers egress addresses exhaust quickly; with GITHUB_TOKEN
 * (a fine-grained token with no extra permissions is enough for public
 * repositories) the limit is 5,000/hour for that token. The token is only
 * sent to api.github.com, never to download redirects.
 */
export function githubFetcher(token?: string, base: typeof fetch = fetch): typeof fetch {
  const auth = token?.trim();
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const isApi = url.hostname === API_HOST;
    const headers = new Headers(init?.headers);
    if (isApi && auth) headers.set("Authorization", "Bearer " + auth);
    if (isApi) headers.set("X-GitHub-Api-Version", "2022-11-28");
    let response: Response;
    try {
      response = await base(input, { ...init, headers });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new DeployError("UPSTREAM_UNAVAILABLE",
        timedOut ? "GitHub did not respond in time. Please retry." : "Could not connect to GitHub. Please retry.", 503);
    }
    if (isApi && (response.status === 403 || response.status === 429) &&
        (response.headers.get("x-ratelimit-remaining") === "0" || response.status === 429)) {
      throw new DeployError("UPSTREAM_UNAVAILABLE", auth
        ? "The GitHub API rate limit for the configured token is exhausted. Please retry later."
        : "The GitHub API rate limit is exhausted. Configure GITHUB_TOKEN for the Deploy Worker.", 503);
    }
    return response;
  }) as typeof fetch;
}
