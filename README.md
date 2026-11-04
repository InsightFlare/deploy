# InsightFlare Deploy

The independent Cloudflare deployment control plane for [InsightFlare](https://github.com/RavelloH/InsightFlare).

**Development status:** OAuth, instance discovery and read-only planning are being implemented. Installation, updating and source builds are **not yet enabled**. No customer infrastructure is modified by the current API.

## Local development

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:8787`. Without Cloudflare OAuth credentials, the interface remains in read-only source-inspection mode.

For local OAuth tests, configure Worker secrets using an untracked `.dev.vars` file and register a matching redirect URL in your own Cloudflare OAuth application. For production, register `https://deploy.insightflare.net/oauth/cloudflare/callback`.

```bash
pnpm check
```

## Interface

The control plane uses the same `@insightflare/ui` React components and Tailwind CSS 4 theme as InsightFlare.

The control plane installs the published `@insightflare/ui` npm package at a pinned version; no local repository checkout, vendored tarball, or developer-specific filesystem path is required.

`pnpm dev` serves the complete app through local Wrangler. For Vite hot reload, run `pnpm dev:web` alongside the Wrangler backend and open port 5173.

## Deployment model

The latest upstream `main` commit is used as the source of truth. Each operation pins one full commit SHA. The long-term goal is user-side independent compilation and safe installation/update without requiring users to fork the source repository.

The deployment plan also previews a conservative resource reconciliation: it identifies D1, KV, Durable Objects, MAIN_SECRET, optional Analytics Engine datasets and R2 archives, and marks each as create, preserve, optional or blocked. Existing database, KV, Durable Object and secret bindings are never silently replaced, and raw resource identifiers or secret values are not exposed to browsers.

The control plane can inspect existing Workers Builds triggers **read-only** using the system-generated Worker tag, verify whether a trigger appears to reference the official `RavelloH/InsightFlare` repository, and report missing permissions or mismatched connections. This is exposed through `GET /api/v1/providers/cloudflare/accounts/:accountId/build-readiness` after OAuth authorization. It never creates or triggers a build.

Cloudflare Builds permissions, upstream-repository access without a fork, and the isolation of source compilation from D1 migrations have not yet passed real-account validation. The upstream build script already accepts `--skip-prebuild`, but using that mode as a complete production build pipeline requires separate verification. **No mutation endpoint is available** until those conditions are satisfied.

MIT license. Project maintained by [InsightFlare](https://github.com/InsightFlare).
