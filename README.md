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

The build readiness check rejects triggers with a mismatched GitHub repository ID or a production deploy command that could directly activate new code after an upstream push. The proposed safe flow stages a Worker version without promoting it. Build configuration caveats are available at `GET /api/v1/source/build-contract`.

After reviewing a read-only plan, an authenticated user may submit its exact source SHA to `POST /api/v1/providers/cloudflare/accounts/:accountId/prepare`. The control plane re-checks upstream `main`, refuses stale plans (HTTP 409), then stores a **blocked**, session-scoped, 15-minute operation in an account-scoped Durable Object. `GET /api/v1/providers/cloudflare/accounts/:accountId/prepared-run` restores that record after reconnecting. Neither endpoint triggers a Cloudflare build, migration, or deployment.

Cloudflare's GitHub App currently cannot connect an ordinary user account to the official upstream public repository without an approved integration; the existing test account remains linked to an older fork. A pinned, independent compilation of the upstream source using `--skip-prebuild` **has** been validated in a credential-free, isolated worktree, with no remote D1 operations. That does not establish a complete user-owned Cloudflare Builds pipeline. **No mutation endpoint is available** until the complete per-user build, migration, staged upload and approval workflow is verified.

### Independent build artifact verification

From this repository, inspect an already-built, isolated checkout of the official upstream main commit:

```bash
node scripts/pack-build.mjs <path-to-isolated-source-checkout> <full-40-character-commit-sha>
```

The command checks Git provenance, the generated Cloudflare worker configuration, Worker ESM module dependencies, D1/KV/DO binding declarations, Durable Object migration history and static asset types/hashes. It prints a deterministic artifact summary without persisting build binaries or uploading anything. It excludes server source maps and non-deployable files. Both the Node artifact tests and Vitest tests run under `pnpm check`.

**Critical:** `wrangler versions upload` is **not** a staging-only command: Wrangler may also create a live Worker deployment. A safe, non-promoting upload requires the Beta Worker Versions API with `deploy=false`, followed later by explicit promotion. The client implementation and isolation/safety checks exist but are not currently exposed as executable API routes. Existing Worker secrets, bindings, routes and production data must not be altered as part of artifact inspection.

MIT license. Project maintained by [InsightFlare](https://github.com/InsightFlare).
