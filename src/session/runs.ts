import type { Env } from "../types";
import {
  ACTIVE_PHASES, MAX_ACTIVE_RUN_MS, createPreparedRun, assertCanReplaceRun,
  runForOwner, type PreparedRun, type PrepareRunInput
} from "../core/run";

const STORE_KEY = "prepared-run";
const BASE_URL = "https://deployment-run.internal";
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;

/**
 * Account-scoped deployment plan storage. D1 migrations themselves use the
 * existing Wrangler-style d1_migrations ledger, not a new Durable Object
 * lock, maintenance coordinator or per-database migration state machine.
 */
export class DeploymentRun {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/run" && request.method === "GET") {
      const ownerId = request.headers.get("X-Run-Owner") ?? "";
      const current = await this.state.storage.get<PreparedRun>(STORE_KEY) ?? null;
      return Response.json(runForOwner(current, ownerId), {
        headers: { "Cache-Control": "no-store" }
      });
    }
    if (url.pathname === "/prepare" && request.method === "POST") {
      const input = await request.json() as PrepareRunInput;
      const now = Date.now();
      const prepared = createPreparedRun(input, now);
      const stored = await this.state.storage.transaction(async txn => {
        const current = await txn.get<PreparedRun>(STORE_KEY) ?? null;
        assertCanReplaceRun(current, prepared, now);
        if (current?.ownerId === prepared.ownerId &&
            current.pinnedSha === prepared.pinnedSha &&
            current.intent === prepared.intent &&
            current.expiresAt > now && current.phase === "blocked") {
          return current;
        }
        await txn.put(STORE_KEY, prepared);
        return prepared;
      });
      await this.state.storage.setAlarm(stored.expiresAt);
      return Response.json(runForOwner(stored, input.ownerId), {
        headers: { "Cache-Control": "no-store" }
      });
    }
    return new Response(null, { status: 405 });
  }

  async alarm() {
    const current = await this.state.storage.get<PreparedRun>(STORE_KEY);
    if (current && ACTIVE_PHASES.includes(current.phase) &&
        Date.now() < current.createdAt + MAX_ACTIVE_RUN_MS) {
      await this.state.storage.setAlarm(
        Math.min(Date.now() + 10 * 60_000, current.createdAt + MAX_ACTIVE_RUN_MS)
      );
      return;
    }
    await this.state.storage.deleteAll();
  }
}

function accountStub(env: Env, accountId: string): DurableObjectStub {
  if (!ACCOUNT_ID.test(accountId)) throw new Error("Invalid Cloudflare account identifier");
  return env.RUNS.get(env.RUNS.idFromName("cf:" + accountId.toLowerCase()));
}

export async function prepareAccountRun(env: Env, input: PrepareRunInput): Promise<PreparedRun> {
  const response = await accountStub(env, input.accountId).fetch(BASE_URL + "/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error("Failed to store deployment operation");
  return response.json() as Promise<PreparedRun>;
}

export async function readAccountRun(
  env: Env, accountId: string, ownerId: string
): Promise<PreparedRun | null> {
  const response = await accountStub(env, accountId).fetch(BASE_URL + "/run", {
    method: "GET", headers: { "X-Run-Owner": ownerId }
  });
  if (!response.ok) throw new Error("Failed to read deployment operation");
  return response.json() as Promise<PreparedRun | null>;
}
