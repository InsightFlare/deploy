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


### User-owned D1 database preparation (separate from the public build)

The official upstream Cloudflare-target `prebuild.ts` performs **remote D1 migrations** through Wrangler before compiling; this is inherently **per user**, and can never be executed by our shared GitHub CI. The public `nightly` artifact therefore includes the complete ordered migration SQL files and per-file SHA256 digests, while the CI compiles with `--skip-prebuild`. The separate tracker SDK step is satisfied by the source package's `prepare` script during `pnpm install --frozen-lockfile`.

The Deploy control plane handles schema preparation under the user's authorized Cloudflare account, not through GitHub and without asking the user to install Wrangler:

1. Resolve the **exact official main commit** and download the single SHA-verified `nightly` archive; validate every Worker, client Asset and SQL file against `manifest.json`.
2. Discover the chosen D1 database's exact UUID, its `sqlite_master` table inventory, existing `d1_migrations` ledger (the standard Wrangler format) and current Cloudflare Time Travel **bookmark**. Reject unknown, out-of-order or duplicated migration histories, legacy databases with tables but no ledger, or non-recoverable D1.
3. Generate the exact ordered **suffix** of unapplied SQL migrations and a reviewed SHA256 plan fingerprint bound to the user account ID, database UUID, source SHA, artifact digest, SQL file hashes and recovery bookmark.
4. Require **explicit approval** of that exact plan. For existing databases with table rebuilds, deletions, modifications, foreign-key changes or data rewrites, require an approved maintenance window and prevent the old Worker from continuing unsafe writes before any destructive operation.
5. Acquire an exclusive durable run lease scoped to account and D1 database; re-read the bookmark and ledger immediately before the first write. Execute one migration and its Wrangler ledger entry in the same verified transaction, then read the ledger again. On an uncertain or failed write, **stop without automatically retrying or restoring**. Preserve the original bookmark for user-controlled recovery; Time Travel restore overwrites the database and must never occur silently.
6. Once all D1 migrations are confirmed, separately stage the candidate Worker Version (including Durable Object migrations), inspect its bindings and health checks, and only then offer explicit production promotion.

**Implemented but not yet enabled for live writes:** `src/core/d1-migrations.ts` provides the read-only planner and approval checks; `CloudflareClient.d1MigrationSnapshot` performs narrowly scoped account-authorized D1 metadata/ledger/bookmark reads; `src/core/d1-migration-runner.ts` provides an injectable exclusive-lease/approval/checkpoint coordinator; `CloudflareClient.d1ApplyVerifiedMigration` builds the experimental per-file REST SQL batch. Tests verify strict prefix matching, exact SQL hashes, database identity, backup bookmark, non-promoting execution and uncertain-result refusal, including an offline integration run against all 43 real Nightly SQL files.

**Verified local baseline:** The authentic, anonymously downloaded 6,010,264-byte Nightly archive passed GitHub SHA256, full TAR manifest and every SQL file digest check. All 43 of its D1 migrations were then applied successfully by Wrangler 4.152.0 to a newly created **local-only** D1 persistence directory; querying the native `d1_migrations` table confirmed 43 ordered ledger entries. The exact Wrangler migration ledger schema is matched by the experimental REST adapter. The upstream CI `pnpm install` logs also confirm the separate Tracker SDK variants were generated through the `prepare` script despite `--skip-prebuild`.

**Production blockers:** REST `batch` transaction behavior and all 43 migrations now have been verified on a disposable remote D1, including rollback on failed statements and full `sqlite_master` parity. This does **not** prove safety against a populated user's actively written database. Durable database-scoped locks, a resumable run state machine, maintenance-mode enforcement, transient-failure handling, and explicit user-approval execution UI remain to be implemented. Default `wrangler.jsonc` OAuth scopes still provide **Workers Scripts Read, Account Settings Read and Zone Read** only; an optional, explicit `d1.read` reauthorization flow now exists, but the external OAuth client must also allow that scope before the new read-only migration preview can work for users. Real D1 writes must additionally obtain `d1.write` through a separately approved flow. Do not use production D1 for experiments. Time Travel recovery lasts up to **7 days on Workers Free** or **30 days on Workers Paid**; preserve the pre-migration bookmark and the applicable recovery window.


### Real remote D1 migration compatibility (isolated testing, 2026-11-05)

A specifically authorized, independently configured Cloudflare **test account** was located using the existing Windows DPAPI-protected test credential. It was verified to be different from the production account. Its existing InsightFlare databases and Workers were **not modified**.

A brand-new disposable `ifd-migration-compat-*` D1 was provisioned inside this test account for REST API verification. Results:

- A deliberately failing three-statement REST `/query` batch returned HTTP 400 and left **no created table**, demonstrating rollback. A successful batch committed both records.
- All **43 authentic migration SQL files** from the SHA-verified official Nightly `tar.gz` were executed against the disposable remote D1 via one REST transaction per migration, including the `d1_migrations` row insert. Every step was followed by an exact ordered ledger check; **43/43 succeeded**.
- Both `0008_rebuild_analytics.sql` and `0039`–`0041` complex structural migrations passed. Comparing the finished remote SQLite `sqlite_master` inventory against the separate Wrangler local reference yielded **82 matching tables/indexes/triggers, zero missing/extra objects, and zero normalized SQL differences** (after removing our own transaction test probe).
- Re-running the guarded REST verification at 43 completed entries resulted in **zero SQL writes**. After all checks, the disposable test D1 was verified to have no Worker bindings, then deleted successfully (subsequent metadata GET returned HTTP 404). The pre-existing validation D1 and the original InsightFlare instance were preserved.
- Deploy's actual `CloudflareClient.d1MigrationSnapshot()`, using the user-authorized test token, passed a true end-to-end **read-only** integration test with the verified Nightly bundle and live D1. It recovered the Time Travel bookmark and correctly reported **0 pending migrations**.
- Cloudflare's authenticated `GET /client/v4/oauth/scopes` enumerated 403 scopes and confirmed `d1.metadata_read`, `d1.read`, and `d1.write` are the real exact identifiers. OAuth Client management could not be performed with the test token (403), and the other available account showed no OAuth Client registration. Do **not** silently modify a user's OAuth client, or claim D1 OAuth login already works.

The Cloudflare REST API explicitly accepts `batch` requests. D1 enforces foreign keys in implicit transactions; `PRAGMA foreign_keys=OFF` does not work as ordinary SQLite sessions might expect, although the **current canonical Nightly migrations succeeded** in our empty remote test database. Existing populated databases still need maintenance-mode and compatibility verification separately.

**New read-only API/UI:** Authenticated `GET /api/v1/providers/cloudflare/accounts/:accountId/d1/databases` enumerates authorized database names/IDs. `GET /api/v1/providers/cloudflare/accounts/:accountId/d1/migration-preview?databaseId=...` resolves the exact upstream main SHA, verifies the official rolling Nightly archive, requires the chosen existing Worker's `DB` binding to match the selected database UUID, reads the migration ledger/bookmark, and returns a redacted migration plan without SQL or raw bookmark. The UI lets the user select their D1 and view pending SQL with destructive-change warnings. An explicit OAuth `?capability=d1-read` flow adds `d1.read` only after user action; it still requires the Cloudflare OAuth Client's allowed scopes to include `d1.read`. No production write or Worker promotion route exists.

**Remaining safety gates:** Actual write orchestration, database-scoped Durable Object lease/state, concurrency/multi-request resume, maintenance-mode enforcement for existing populated installs, and explicit preview→confirm→execute authorization are not complete. REST migration transport is still kept internal; no live-user D1 schema writes are exposed. No Cloudflare Worker version was activated.
