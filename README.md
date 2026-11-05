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

The latest upstream `main` commit is used as the source of truth. Each operation pins one full commit SHA. The default build comes from the official, public, SHA-verified rolling `nightly` GitHub Release; users do not need to fork or compile InsightFlare.

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

**Version staging:** Cloudflare officially documents `wrangler versions upload` as a **non-deploying** upload. `wrangler deploy` and `wrangler versions deploy` can activate live traffic. The Beta Worker Versions API with `deploy=false` is another staging-only option.

The control plane now implements an **unexposed staging coordinator** (`src/core/stage-artifact.ts`): it receives a per-run, Git-pinned build; recomputes the complete binary artifact digest; requires explicit legacy adoption review; inherits all existing Worker Secrets/D1/KV/DO/resource bindings from an exact active Worker version; plans forward-only DO migrations; uploads only assets and an inactive version; then verifies the active deployment is unchanged and the new bindings, resources, migration tag and source marker match. The coordinator never enables traffic, triggers D1 migrations or changes DNS. It remains disabled from all public API routes until user-specific compilation, persistence, authorization and real Cloudflare API integration have been independently verified.

For an opt-in **offline** integration test using an existing independently compiled source checkout (no credentials or Cloudflare network writes), set `INSIGHTFLARE_SOURCE_BUILD` to that checkout's absolute path and `INSIGHTFLARE_SOURCE_SHA` to its 40-character commit hash, then run `pnpm exec vitest run tests/real-build-stage.integration.test.ts`. CI skips this environment-dependent test. The test loads the real 318 Worker modules and 309 Assets from the validated snapshot, verifies every byte, and simulates a staged legacy upgrade.

Existing Worker secrets, bindings, routes and production data must not be altered as part of artifact inspection. No customer installation, upgrade or promotion route is active.

MIT license. Project maintained by [InsightFlare](https://github.com/InsightFlare).


### Optional experimental per-run isolated build runner (not the default)

**The public GitHub Nightly artifact path above is the preferred distribution model; users will not need Docker.** This section preserves an alternative reference builder, not an installer requirement.

The former GitHub-App/no-fork connection blocker is now separated from compilation itself: a dedicated Linux runner can fetch the public official `RavelloH/InsightFlare` repository at one **exact** 40-character Git commit, build it with `--skip-prebuild`, and return a private, short-lived artifact receipt. This does **not** require a GitHub installation or a fork in the user's Cloudflare account.

The implementation comprises `src/core/isolated-build.ts` (tenant/run/SHA/TTL receipt contracts), `builder/Dockerfile`, `builder/entrypoint.sh`, and `scripts/isolated-builder.mjs` (Linux Docker reference adapter). Each job uses its own locked-down source directory, immutable Docker image ID, non-root uid, no inherited API credentials, read-only container root filesystem, dropped capabilities, bounded CPU/memory/PIDs and a time limit. The upstream builder requires the supported `WORKERS_CI=1` environment marker to permit a Cloudflare-target build outside Cloudflare Builds; the marker is set only around compilation, with `--skip-prebuild` preventing remote database migrations. Source and `dist` are verified **after** the container exits, consumed inside a scoped callback and removed even if the build or consumer fails. No build artifact is shared across tenants or published to a public URL. `pnpm check` tests the Docker command and cleanup with offline mock execution; **mock tests are not a real container validation**.

To inspect the Docker arguments without launching a container:

```bash
node scripts/isolated-builder.mjs --inspect sha256:<64-hex-local-image-id> <full-40-char-commit> /absolute/private/scratch/job
```

A deliberately **manual-only** GitHub Actions workflow, `Manual isolated builder integration` (`.github/workflows/isolated-builder-smoke.yml`), performs the expensive real Linux Docker build of the official pinned commit, verifies the complete Worker/Assets build, reports only a digest/count receipt and deletes everything. It uses no Cloudflare token or deployment permissions; it does not stage or activate a Worker. It is not part of push CI to avoid needless resource usage.

**Not production-ready:** The Windows workstation has no running Docker daemon. The earlier VPS environment inspected by DeskBeacon exposed a small container without Docker, not an approved dedicated builder host. The Docker adapter requires a dedicated Linux runner with Docker access, an immutable builder image and sufficient memory/disk; do **not** run it inside an existing production app container or expose the Docker socket to tenants. Git/npm dependency installation uses outbound network access and should receive network egress controls and disk quotas before hosting untrusted user builds. The Dockerfile's Node base should also be pinned to a base image digest before production. If using Cloudflare Containers, deploy the builder image **directly** as an ephemeral Cloudflare Container; do not assume a Docker daemon is present inside the Container. Its container lifecycle and per-user artifact transport still need a separate adapter and real-account validation. No web API route starts isolated builds today.


### Default distribution: one rolling official `nightly` prerelease (active)

The installer is changing from per-user isolated compilation to **official GitHub CI build artifacts**. Every upstream `main` commit is the deployable version identifier. Formal `vX.Y.Z` Releases remain milestone announcements, never installation or update targets.

The official `RavelloH/InsightFlare` main branch now includes `publish-nightly-artifact.yml` (merged in commit `328b733b54cc39acf4cb0249f56e7c144d969ac7`). The workflow:

1. Compile the exact `GITHUB_SHA` with frozen dependencies and `--skip-prebuild` (no customer credentials, no remote D1 mutations).
2. Create a small content-addressed archive of Worker modules, client Assets and D1 migration SQL with a manifest. It strips account-specific Wrangler resource IDs and includes per-file SHA256 hashes.
3. Uploads one SHA-addressed `.tar.gz` archive to the single rolling GitHub prerelease tagged `nightly`; `manifest.json` and all verified SQL files live inside the archive. No additional `.json` asset, versioned Release per commit, external OSS or customer-build Docker is required.
4. After checking GitHub's archive SHA256 digest, updates the machine-readable current source SHA and aggregate content digest in the prerelease notes. Never uses `gh release upload --clobber`.
5. Serializes publication, refuses to roll the pointer back when main advances, and deletes old SHA archives only after publishing and verifying the new pointer. A transient two-asset window is permissible during upload; the successful final state has exactly one `.tar.gz`.

`src/core/public-release.ts` implements a **read-only** verifier: it first resolves official `main` HEAD, requires `nightly` to advertise precisely that SHA, validates the unique current archive name and GitHub SHA256 digest, downloads the single `.tar.gz`, parses its strict TAR/GZIP contents and internal `manifest.json`, checks each source file and migration SQL digest, and recomputes the original complete build digest. An old formal release or an older nightly build is never substituted when the latest main commit is not ready.

The `nightly` Git tag is a stable *channel identifier*, not an authoritative source-commit pointer. Only the validated prerelease notes marker represents the current compiled commit. The public `nightly` prerelease is live and uses **mutable prerelease assets**; repository-wide Immutable Releases must remain disabled for this rolling channel. GitHub release assets and manifest metadata have been verified for the initial `328b733b...` build; the full binary payload is also tested locally. **No customer deployment or D1 migration write routes are active yet.**

The old Docker experiment remains available for internal research but is not required to install or update InsightFlare. Deploy users only need their Cloudflare account; they need neither Fork, Docker, GitHub authentication, VPS, nor any custom OSS/R2 endpoint.


### User-owned D1 migrations: same behavior as manual Wrangler deploy

The official `main` Nightly build is compiled with `--skip-prebuild`, so it does not access any customer's database. Its single public `tar.gz` embeds the official ordered migration SQL files with per-file SHA256 digests. The upstream manual Cloudflare prebuild performs `wrangler d1 migrations apply DB --remote` **before building and deploying the new Worker**. Deploy follows the same sequence without changing the runtime behavior of the currently serving Worker:

1. Resolve and verify the latest official `main` commit and the matching GitHub Nightly archive, including the embedded manifest and all SQL hashes.
2. Select the customer's D1 database in their authorized Cloudflare account, inspect `d1_migrations` and identify unapplied **filenames**, in source filename order. No "database must be empty", mandatory prefix history, Time Travel bookmark, maintenance window or writer-quiescence requirement is introduced.
3. On an explicit user action, request Cloudflare OAuth `d1.read` + `d1.write` (only if not already granted). For each SQL file, use D1 REST `/query` `batch` to execute the SQL and append the same migration filename to the standard Wrangler ledger. Stop immediately on a SQL error, just like Wrangler.
4. The browser submits at most four migrations per HTTP request, rereading the live ledger after each file. If the user closes the tab or a request fails, they can refresh the preview and continue from already-applied filenames. A mismatch with the currently published Nightly SHA stops the operation and requires a new preview.
5. Deploy **does not pause existing HTTP requests, ingestion Durable Objects, scheduled tasks or the serving Worker**. Code/SQL compatibility before a new Worker version is published remains the same concern as with manual deployments. Static asset upload, Worker Version staging and production activation are separate workflows and are not yet publicly enabled.

The normal migration flow calls `src/core/d1-manual.ts` and `CloudflareClient.d1ApplyVerifiedMigration`; it does **not** call a per-database Durable Object lease, a maintenance coordinator or a durable migration state machine. The existing RUNS DO remains for account-scoped prepared *deployment* plans and is not invoked by these D1 SQL requests. There is no new InsightFlare end-user runtime DO or regular-request overhead.

**Verified behavior:** The real single-file Nightly artifact passed download, per-file SHA256 and manifest checks. On a disposable remote test-account D1, all 43 official SQL migration files successfully applied through the REST batch mechanism, with correct `d1_migrations` entries and 82 resulting SQLite schema objects matching the native Wrangler local baseline. The test D1 was deleted after verification; original test/production resources were not modified. This baseline verifies a clean installation, not every possible existing populated schema. As with manual deployment, an incompatible SQL migration will fail when applied, and already-applied earlier files remain recorded.

**OAuth and production activation:** The default OAuth scopes remain minimal; the user must choose the optional `d1-read` or `d1-write` authorization flow. Cloudflare's OAuth client registration must allow these exact scopes; otherwise the migration endpoint returns an authorization error. The database-migration endpoint is now available in source; deploying the Deploy control-plane Worker and testing it with the OAuth client are separate actions. Existing production Cloudflare resources and Workers are not changed by committing this source code.

This approach intentionally rejects the earlier global maintenance-mode proposal. The temporary migration lease/journal proof-of-concept has been removed: it is not needed to reproduce the established manual deployment model, and would add unnecessary design and runtime complexity.
