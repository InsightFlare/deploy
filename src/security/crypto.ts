import { DeployError } from "../types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomBase64Url(bytes = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...values)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
}

async function aesKey(encoded: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try { raw = fromBase64(encoded); } catch { throw new DeployError("MISCONFIGURED", "Invalid session encryption key.", 503); }
  if (raw.byteLength !== 32) throw new DeployError("MISCONFIGURED", "Session encryption key must be 32 bytes.", 503);
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export interface SealedToken { iv: string; cipher: string; expiresAt: number }

export async function sealToken(token: string, key: string, expiresAt: number): Promise<SealedToken> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, await aesKey(key), encoder.encode(token));
  return { iv: toBase64(iv), cipher: toBase64(new Uint8Array(result)), expiresAt };
}

export async function unsealToken(sealed: SealedToken, key: string): Promise<string> {
  if (sealed.expiresAt <= Date.now()) throw new DeployError("NOT_CONNECTED", "Cloudflare authorization has expired.", 401);
  try {
    const result = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv).buffer as ArrayBuffer }, await aesKey(key), fromBase64(sealed.cipher).buffer as ArrayBuffer);
    return decoder.decode(result);
  } catch { throw new DeployError("NOT_CONNECTED", "Cloudflare authorization could not be restored.", 401); }
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
