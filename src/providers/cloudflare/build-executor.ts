import { validateSha } from "../../core/source";
import { DeployError } from "../../types";
import { buildRequest } from "./builds";

const BASE_URL = "https://api.cloudflare.com/client/v4";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export interface BuildExecutionGate {
  /** Each of these must be derived from server-side checks, never the browser. */
  userScopedTokenVerified: boolean;
  upstreamGitHubAccessVerified: boolean;
  nonPromotingWorkerUploadVerified: boolean;
  databaseMigrationsIsolated: boolean;
  userApprovalRecorded: boolean;
  reviewedSha: string;
}

export interface SubmittedBuild {
  buildUuid: string;
  requestedSha: string;
  returnedSha: string | null;
  sourceMatch: boolean;
  state: "submitted";
}

export interface BuildStatus {
  buildUuid: string;
  state: "queued" | "initializing" | "running" | "stopped" | "unknown";
  outcome: "success" | "fail" | "skipped" | "cancelled" | "terminated" | "unknown";
  returnedSha: string | null;
  sourceMatch: boolean;
}

interface RawBuild {
  build_uuid?: string;
  status?: string;
  build_outcome?: string;
  build_trigger_metadata?: { commit_hash?: string };
}
interface ApiResult {
  success?: boolean;
  result?: RawBuild;
  errors?: Array<{ code?: number; message?: string }>;
}

function assertAuthorized(gate: BuildExecutionGate, requestedSha: string): void {
  const sha = validateSha(requestedSha);
  if (validateSha(gate.reviewedSha) !== sha ||
    !gate.userScopedTokenVerified || !gate.upstreamGitHubAccessVerified ||
    !gate.nonPromotingWorkerUploadVerified || !gate.databaseMigrationsIsolated ||
    !gate.userApprovalRecorded) {
    throw new DeployError(
      "UNAVAILABLE",
      "Cloudflare build execution is blocked until exact-source authorization, staging and migration checks have passed.",
      403
    );
  }
}

function uuid(value?: string): string {
  if (!value || !UUID.test(value)) throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare returned an invalid build identifier.", 502);
  return value;
}
function returnedSha(build: RawBuild): string | null {
  const value = build.build_trigger_metadata?.commit_hash;
  if (!value) return null;
  try { return validateSha(value); }
  catch { return null; }
}
async function requestBuildApi(http: typeof fetch, token: string, path: string, method: "GET" | "POST", body?: object): Promise<RawBuild> {
  if (!token || token.trim().length < 12) throw new DeployError("NOT_CONNECTED", "User-scoped Cloudflare build authorization is required.", 401);
  const res = await http(BASE_URL + path, {
    method,
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000)
  });
  const data = await res.json().catch(() => null) as ApiResult | null;
  if (!res.ok || !data || data.success !== true || !data.result) {
    // Cloudflare errors can include confidential data. Never forward raw bodies.
    throw new DeployError("UPSTREAM_UNAVAILABLE", "Cloudflare Builds API rejected the request (HTTP " + res.status + ").", 502);
  }
  return data.result;
}

/**
 * Internal executor. There is intentionally no API route invoking this class
 * until we validate per-user upstream access, authorization and DB safety.
 */
export class CloudflareBuildExecutor {
  constructor(private readonly token: string, private readonly http: typeof fetch = fetch) {}

  async startPinnedBuild(accountId: string, triggerId: string, sourceSha: string, gate: BuildExecutionGate): Promise<SubmittedBuild> {
    assertAuthorized(gate, sourceSha);
    const spec = buildRequest(accountId, triggerId, sourceSha);
    const result = await requestBuildApi(this.http, this.token, spec.path, spec.method, spec.body);
    const sha = returnedSha(result);
    return {
      buildUuid: uuid(result.build_uuid),
      requestedSha: validateSha(sourceSha),
      returnedSha: sha,
      sourceMatch: sha === validateSha(sourceSha),
      state: "submitted"
    };
  }

  async readStatus(accountId: string, buildUuid: string, expectedSha: string): Promise<BuildStatus> {
    if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new DeployError("INVALID_ACCOUNT", "Invalid Cloudflare account ID.");
    const id = uuid(buildUuid);
    const sha = validateSha(expectedSha);
    const result = await requestBuildApi(this.http, this.token,
      "/accounts/" + accountId + "/builds/builds/" + id, "GET");
    const returned = returnedSha(result);
    const status = result.status;
    const outcome = result.build_outcome;
    return {
      buildUuid: id,
      state: status === "queued" || status === "initializing" || status === "running" || status === "stopped" ? status : "unknown",
      outcome: outcome === "success" || outcome === "fail" || outcome === "skipped" || outcome === "cancelled" || outcome === "terminated" ? outcome : "unknown",
      returnedSha: returned,
      sourceMatch: returned === sha
    };
  }
}
