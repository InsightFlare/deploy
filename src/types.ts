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
  constructor(public readonly code: ApiErrorCode, message: string, public readonly status = 400) {
    super(message);
    this.name = "DeployError";
  }
}
