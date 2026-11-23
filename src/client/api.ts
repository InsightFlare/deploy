import type { PipelineRun } from "../core/pipeline";
import type { AccountOverview } from "../core/overview";

export type { PipelineRun, AccountOverview };
export type { PipelineStep, StepNote, PipelineStepId } from "../core/pipeline";

export interface Session { connected: boolean; oauthConfigured: boolean; expiresAt: number | null }
export interface Account { id: string; name: string }
export interface RunView {
  run: PipelineRun | null;
  busy: boolean;
  /** password is null when the user chose it during setup (it is never sent back). */
  admin: { username: string; password: string | null } | null;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "NETWORK", "Network request failed.");
  }
  const data = await response.json().catch(() => null) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code ?? "HTTP", data?.error?.message ?? "");
  }
  if (data === null) throw new ApiError(response.status, "INVALID_RESPONSE", "");
  return data;
}

function post<T>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: window.location.origin },
    body: JSON.stringify(body)
  });
}

const account = (id: string) => "/api/v1/providers/cloudflare/accounts/" + encodeURIComponent(id);

export const api = {
  session: () => request<Session>("/api/v1/session"),
  disconnect: () => post<{ ok: true }>("/api/v1/session/disconnect"),
  accounts: () => request<{ accounts: Account[] }>("/api/v1/providers/cloudflare/accounts"),
  overview: (id: string) => request<{ overview: AccountOverview }>(account(id) + "/overview"),
  run: (id: string) => request<RunView>(account(id) + "/run"),
  startRun: (id: string, body: { intent: "install" | "update"; sourceSha: string; artifactDigest: string; legacyAdoptionApproved: boolean; adminPassword?: string }) =>
    post<RunView>(account(id) + "/run", body),
  advance: (id: string, runId: string) => post<RunView>(account(id) + "/run/advance", { runId }),
  retry: (id: string, runId: string) => post<RunView>(account(id) + "/run/retry", { runId }),
  dismiss: (id: string, runId: string) => post<RunView>(account(id) + "/run/dismiss", { runId }),
  passwordSaved: (id: string, runId: string) => post<RunView>(account(id) + "/run/password-saved", { runId })
};

/** Starts Cloudflare OAuth with every scope one-click deployment needs. */
export const CONNECT_URL = "/api/v1/auth/cloudflare/start?capability=deploy";
export const ANALYTICS_ENGINE_URL = (accountId: string) => `https://dash.cloudflare.com/${accountId}/workers/analytics-engine`;
export const CLOUDFLARE_WORKER_URL = (accountId: string) => `https://dash.cloudflare.com/${accountId}/workers/services/view/insightflare/production`;
