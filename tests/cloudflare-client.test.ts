import { describe, expect, it, vi } from "vitest";
import { CloudflareClient } from "../src/providers/cloudflare/client";

const accountId = "1".repeat(32);
const workerId = "f".repeat(32);
const versionId = "023e105f-2a42-4f8b-a1c1-73f6a2a30c0f";
const deploymentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sha = "d".repeat(40);
const annotations = {
  "workers/commit_sha": sha,
  "workers/repository_url": "https://github.com/RavelloH/InsightFlare",
  "workers/message": "Independent build for exact upstream commit"
};

describe("Cloudflare read-only API client", () => {
  it("reads authorized account listings", async () => {
    const mock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ success: true, result: [{ id: accountId, name: "Personal" }] }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    expect(await client.accounts()).toEqual([{ id: accountId, name: "Personal" }]);
    expect(new Headers(mock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer short-lived-token");
  });

  it("refuses accounts that the user cannot access", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: [{ id: accountId, name: "Personal" }] }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.requireAccount("2".repeat(32))).rejects.toThrow("not accessible");
  });

  it("does not echo sensitive upstream errors", async () => {
    const mock = vi.fn(async () => Response.json({
      success: false, errors: [{ code: 1234, message: "secret-token-value" }]
    }, { status: 403 }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.accounts()).rejects.toThrow("code 1234");
    await expect(client.accounts()).rejects.not.toThrow("secret-token-value");
  });

  it("reads worker settings without mutating anything", async () => {
    const calls: string[] = [];
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      expect(init?.method ?? "GET").toBe("GET");
      if (url.endsWith("/workers/scripts")) return Response.json({ success: true, result: [{ id: "insightflare" }] });
      return Response.json({ success: true, result: { bindings: [{ type: "d1", name: "DB" }] } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    expect(await client.workerNames(accountId)).toEqual(["insightflare"]);
    expect(await client.settings(accountId, "insightflare")).toEqual([{ type: "d1", name: "DB" }]);
    expect(calls).toHaveLength(2);
  });
});

describe("Cloudflare Beta Worker Versions API", () => {
  it("uses the immutable Worker ID for version history and reads active deployment separately", async () => {
    const calls: string[] = [];
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      expect(init?.method ?? "GET").toBe("GET");
      if (url.endsWith("/workers/workers/insightflare")) {
        return Response.json({ success: true, result: { id: workerId, name: "insightflare" } });
      }
      if (url.endsWith("/versions?per_page=100")) {
        return Response.json({ success: true, result: [{ id: versionId, number: 10, migration_tag: "v1" }] });
      }
      return Response.json({ success: true, result: { deployments: [{ id: deploymentId, strategy: "percentage", versions: [{ version_id: versionId, percentage: 100 }] }] } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    expect((await client.workerVersions(accountId, "insightflare"))[0]?.migration_tag).toBe("v1");
    expect((await client.workerDeployments(accountId, "insightflare"))[0]?.versions[0]?.version_id).toBe(versionId);
    expect(calls).toContain("https://api.cloudflare.com/client/v4/accounts/" + accountId + "/workers/workers/" + workerId + "/versions?per_page=100");
    expect(calls.every(url => url.includes("/workers/"))).toBe(true);
  });

  it("reads a version detail using the exact Worker ID and version ID", async () => {
    const mock = vi.fn(async (url: string) => {
      if (url.endsWith("/workers/workers/insightflare")) {
        return Response.json({ success: true, result: { id: workerId, name: "insightflare" } });
      }
      return Response.json({ success: true, result: {
        id: versionId, migration_tag: "v1",
        bindings: [{ name: "MAIN_SECRET", type: "secret_text" }, { name: "DB", type: "d1" }]
      } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    const version = await client.workerVersionDetails(accountId, "insightflare", versionId);
    expect(version.migration_tag).toBe("v1");
    expect(version.bindings?.map(binding => binding.name)).toEqual(["MAIN_SECRET", "DB"]);
    expect(mock.mock.calls[1]?.[0]).toContain("/workers/workers/" + workerId + "/versions/" + versionId);
  });

  it("uploads only newly changed assets and uses the upload JWT, returning the completion JWT", async () => {
    let manifest: Record<string, { hash: string; size: number }> | undefined;
    let payload: Record<string, string> | undefined;
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      if (url.endsWith("/assets-upload-session")) {
        expect(auth).toBe("Bearer short-lived-token");
        manifest = JSON.parse(String(init?.body)).manifest as Record<string, { hash: string; size: number }>;
        const hash = Object.values(manifest)[0]?.hash;
        return Response.json({ success: true, result: { jwt: "temporary-upload-token", buckets: [[hash]] } });
      }
      expect(url).toContain("/workers/assets/upload?base64=true");
      expect(auth).toBe("Bearer temporary-upload-token");
      const form = init?.body as FormData;
      expect(form.has("body")).toBe(false);
      expect([...form.keys()]).toHaveLength(1);
      const hash = Object.values(manifest ?? {})[0]?.hash;
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
      const part = form.get(hash ?? "");
      expect(part).toBeInstanceOf(Blob);
      expect((part as Blob).type).toBe("text/html");
      payload = { [hash ?? ""]: await (part as Blob).text() };
      return Response.json({ success: true, result: { jwt: "completion-token" } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    const completion = await client.uploadWorkerAssets(accountId, "insightflare", [
      { path: "index.html", contentType: "text/html", content: new TextEncoder().encode("hello") }
    ]);
    expect(completion).toBe("completion-token");
    expect(manifest?.["/index.html"]).toMatchObject({ size: 5 });
    expect(manifest?.["/index.html"]?.hash).toMatch(/^[a-f0-9]{32}$/);
    expect(payload).toEqual({ [manifest?.["/index.html"]?.hash ?? ""]: "aGVsbG8=" });
    expect(mock.mock.calls).toHaveLength(2);
  });

  it("uses the initial JWT directly when Cloudflare says no assets need uploading", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { jwt: "already-complete", buckets: [] } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    expect(await client.uploadWorkerAssets(accountId, "insightflare", [
      { path: "same.js", contentType: "text/javascript", content: new TextEncoder().encode("same") }
    ])).toBe("already-complete");
    expect(mock.mock.calls).toHaveLength(1);
  });

  it("rejects unsafe asset paths before making an API request", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { jwt: "token", buckets: [] } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.uploadWorkerAssets(accountId, "insightflare", [
      { path: "../secret.txt", contentType: "text/plain", content: new TextEncoder().encode("x") }
    ])).rejects.toThrow("invalid or duplicate asset path");
    expect(mock).not.toHaveBeenCalled();
  });

  it("uploads a staged Beta version with modules, migrations, exact inherited bindings and asset completion token", async () => {
    let body: Record<string, unknown> | undefined;
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/workers/workers/insightflare")) {
        return Response.json({ success: true, result: { id: workerId, name: "insightflare" } });
      }
      expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/" + accountId + "/workers/workers/" + workerId + "/versions?deploy=false");
      expect(init?.method).toBe("POST");
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ success: true, result: { id: versionId, migration_tag: "v3" } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    const version = await client.uploadWorkerVersion(accountId, "insightflare", {
      mainModule: "index.js",
      compatibilityDate: "2026-03-01",
      compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
      modules: [
        { name: "index.js", contentType: "application/javascript+module", content: new TextEncoder().encode("export default {}") },
        { name: "assets/runtime.js", contentType: "application/javascript+module", content: new TextEncoder().encode("export const ok = true") }
      ],
      bindings: [
        { type: "inherit", name: "MAIN_SECRET", version_id: versionId },
        { type: "inherit", name: "SITE_SETTINGS_KV", version_id: versionId },
        { type: "d1", name: "DB", database_id: "391c1df6-dd3f-44f0-991c-63c7873b7d6a" },
        { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: sha }
      ],
      migrations: { old_tag: "v1", new_tag: "v3", steps: [
        { new_sqlite_classes: ["DiagnosticsSampler"] },
        { deleted_classes: ["DiagnosticsSampler"] }
      ] },
      assets: { jwt: "completion-token", config: { html_handling: "auto-trailing-slash", not_found_handling: "none" } },
      annotations
    });
    expect(version.id).toBe(versionId);
    expect(body).toMatchObject({
      main_module: "index.js",
      compatibility_date: "2026-03-01",
      compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
      bindings: [
        { type: "inherit", name: "MAIN_SECRET", version_id: versionId },
        { type: "inherit", name: "SITE_SETTINGS_KV", version_id: versionId },
        { type: "d1", name: "DB", database_id: "391c1df6-dd3f-44f0-991c-63c7873b7d6a" },
        { type: "plain_text", name: "INSIGHTFLARE_DEPLOYMENT_SHA", text: sha }
      ],
      migrations: { old_tag: "v1", new_tag: "v3", steps: [
        { new_sqlite_classes: ["DiagnosticsSampler"] },
        { deleted_classes: ["DiagnosticsSampler"] }
      ] },
      assets: { jwt: "completion-token", config: { html_handling: "auto-trailing-slash", not_found_handling: "none" } },
      annotations: {
        "workers/tag": sha,
        "workers/message": "InsightFlare Deploy | " + sha + " | " + annotations["workers/message"],
        "workers/triggered_by": "insightflare-deploy"
      }
    });
    expect(body?.annotations).not.toHaveProperty("workers/commit_sha");
    expect(body?.annotations).not.toHaveProperty("workers/repository_url");
    const modules = body?.modules as Array<{ name: string; content_type: string; content_base64: string }>;
    expect(modules).toEqual([
      { name: "index.js", content_type: "application/javascript+module", content_base64: "ZXhwb3J0IGRlZmF1bHQge30=" },
      { name: "assets/runtime.js", content_type: "application/javascript+module", content_base64: "ZXhwb3J0IGNvbnN0IG9rID0gdHJ1ZQ==" }
    ]);
    expect(mock.mock.calls).toHaveLength(2);
  });

  it("blocks a staged Worker without an exact managed source marker", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { id: versionId } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    for (const bindings of [
      [],
      [{ name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "plain_text", text: "b".repeat(40) }],
      [{ name: "INSIGHTFLARE_DEPLOYMENT_SHA", type: "inherit", version_id: versionId }]
    ]) {
      await expect(client.uploadWorkerVersion(accountId, "insightflare", {
        mainModule: "index.js",
        compatibilityDate: "2026-03-01",
        compatibilityFlags: [],
        modules: [{ name: "index.js", contentType: "application/javascript+module", content: new TextEncoder().encode("export default {}") }],
        bindings,
        annotations
      })).rejects.toThrow("deployment marker matching the pinned source SHA");
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it("never accepts secret values in an upload request", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { id: versionId } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.uploadWorkerVersion(accountId, "insightflare", {
      mainModule: "index.js",
      compatibilityDate: "2026-03-01",
      compatibilityFlags: [],
      modules: [{ name: "index.js", contentType: "application/javascript+module", content: new TextEncoder().encode("export default {}") }],
      bindings: [{ type: "secret_text", name: "MAIN_SECRET", text: "must-not-leak" }],
      annotations
    })).rejects.toThrow("Secret values must never");
    expect(mock).not.toHaveBeenCalled();
  });

  it("requires exact version IDs for inherited bindings", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { id: versionId } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.uploadWorkerVersion(accountId, "insightflare", {
      mainModule: "index.js",
      compatibilityDate: "2026-03-01",
      compatibilityFlags: [],
      modules: [{ name: "index.js", contentType: "application/javascript+module", content: new TextEncoder().encode("export default {}") }],
      bindings: [{ type: "inherit", name: "MAIN_SECRET", version_id: "latest" }],
      annotations
    })).rejects.toThrow("exact Worker version");
    expect(mock).not.toHaveBeenCalled();
  });

  it.each(["../index.js", "/index.js", "folder/../index.js", "folder\\index.js"])("rejects unsafe module paths: %s", async name => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { id: versionId } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.uploadWorkerVersion(accountId, "insightflare", {
      mainModule: "index.js",
      compatibilityDate: "2026-03-01",
      compatibilityFlags: [],
      modules: [
        { name: "index.js", contentType: "application/javascript+module", content: new TextEncoder().encode("export default {}") },
        { name, contentType: "application/javascript+module", content: new TextEncoder().encode("export const x=1") }
      ],
      annotations
    })).rejects.toThrow("invalid or duplicate module");
    expect(mock).not.toHaveBeenCalled();
  });

  it("blocks deployment if Cloudflare does not confirm a full 100% deployment", async () => {
    const mock = vi.fn(async () => Response.json({ success: true, result: { id: deploymentId, strategy: "percentage", versions: [{ version_id: versionId, percentage: 50 }] } }));
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await expect(client.createWorkerDeployment(accountId, "insightflare", versionId, "Promote validated version")).rejects.toThrow("unexpected Worker deployment");
  });

  it("creates an explicit 100% deployment without force override", async () => {
    let body: Record<string, unknown> | undefined;
    const mock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ success: true, result: { id: deploymentId, strategy: "percentage", versions: [{ version_id: versionId, percentage: 100 }] } });
    });
    const client = new CloudflareClient("short-lived-token", mock as typeof fetch);
    await client.createWorkerDeployment(accountId, "insightflare", versionId, "Promote validated version");
    expect(body).toEqual({
      strategy: "percentage",
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: { "workers/message": "Promote validated version", "workers/triggered_by": "insightflare-deploy" }
    });
  });
});
