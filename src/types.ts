export interface Env {
  ASSETS: Fetcher;
  SESSIONS: DurableObjectNamespace;
  RUNS: DurableObjectNamespace;
  APP_ORIGIN: string;
  SOURCE_REPOSITORY: string;
  ENVIRONMENT?: string;
  CF_OAUTH_SCOPES: string;
  CF_OAUTH_CLIENT_ID?: string;
  CF_OAUTH_CLIENT_SECRET?: string;
  SESSION_ENCRYPTION_KEY?: string;
  /** Optional GitHub token; lifts the shared per-IP API limit (public read only, no extra permissions). */
  GITHUB_TOKEN?: string;
}

export type ApiErrorCode =
  | "NOT_CONNECTED"
  | "INVALID_ACCOUNT"
  | "UPSTREAM_UNAVAILABLE"
  | "MISCONFIGURED"
  | "INVALID_SOURCE"
  | "SOURCE_MOVED"
  | "UNAVAILABLE";

export class DeployError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
    /** Cloudflare API error code, when the failure came from the Cloudflare API. */
    public readonly cloudflareCode?: number
  ) {
    super(message);
    this.name = "DeployError";
  }
}

/** Cloudflare refuses Analytics Engine bindings until the account enables Analytics Engine once. */
export const CF_ANALYTICS_ENGINE_NOT_ENABLED = 10089;
