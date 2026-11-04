import type { Env } from "../types";
import type { SealedToken } from "../security/crypto";

export interface SessionRecord {
  createdAt: number;
  expiresAt: number;
  oauth?: { state: string; verifier: string; startedAt: number };
  bearer?: SealedToken;
}

const SESSION_KEY = "session";
const INTERNAL_URL = "https://session.internal/record";

export class DeploySession {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/record") return new Response(null, { status: 404 });
    if (request.method === "GET") {
      const stored = await this.state.storage.get<SessionRecord>(SESSION_KEY);
      return Response.json(stored ?? null);
    }
    if (request.method === "PUT") {
      const body = await request.json() as SessionRecord;
      if (!body || !Number.isFinite(body.expiresAt) || body.expiresAt < Date.now() || body.expiresAt > Date.now() + 2 * 60 * 60_000) {
        return Response.json({ error: "Invalid session expiry" }, { status: 400 });
      }
      await this.state.storage.put(SESSION_KEY, body);
      await this.state.storage.setAlarm(body.expiresAt);
      return Response.json({ ok: true });
    }
    if (request.method === "DELETE") {
      await this.state.storage.deleteAll();
      return Response.json({ ok: true });
    }
    return new Response(null, { status: 405 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

function stub(env: Env, id: string): DurableObjectStub {
  return env.SESSIONS.get(env.SESSIONS.idFromName(`session:${id}`));
}

export async function readSession(env: Env, id: string): Promise<SessionRecord | null> {
  const response = await stub(env, id).fetch(INTERNAL_URL);
  if (!response.ok) throw new Error("Session storage is unavailable");
  const state = await response.json() as SessionRecord | null;
  if (!state || state.expiresAt <= Date.now()) return null;
  return state;
}

export async function saveSession(env: Env, id: string, session: SessionRecord): Promise<void> {
  const response = await stub(env, id).fetch(INTERNAL_URL, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(session)
  });
  if (!response.ok) throw new Error("Could not save authorization session");
}

export async function clearSession(env: Env, id: string): Promise<void> {
  await stub(env, id).fetch(INTERNAL_URL, { method: "DELETE" });
}
