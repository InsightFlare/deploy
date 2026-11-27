# InsightFlare Deploy

One-click installation, updates and uninstall of [InsightFlare](https://github.com/RavelloH/InsightFlare) into a user's own Cloudflare account, authorized with Cloudflare OAuth.

Users never fork, compile or run Wrangler. Managed installations can also be uninstalled after reviewing exact resource IDs and typing the instance name. They sign in with Cloudflare, pick an account, review a plan and press **Install** or **Update**. The control plane then provisions resources, applies D1 migrations, uploads the official build and verifies it — using only the user's short-lived OAuth authorization. It also covers what the Cloudflare "Deploy to Workers" button cannot: Analytics Engine bindings (with a fallback when the account has not enabled Analytics Engine) and an Analytics Engine read token for request observation.

**Status:** install and update both completed end to end against a real Cloudflare account (official build, 43 migrations, Analytics Engine token, workers.dev, health check, administrator sign-in, staged update and activation), driven by an API token through the same client and pipeline. The one remaining check is signing in through the production OAuth client.

## How a deployment works

Every run is pinned to one official build: the current verified build published to the rolling `nightly` prerelease of `RavelloH/InsightFlare` (see *Official build artifacts* below). The browser starts a run, then calls `advance` repeatedly; each call executes exactly one idempotent step on the server and checkpoints its result in the account's `RUNS` Durable Object. Closing the tab, an expired authorization or a failed request never loses progress: reconnect and the run continues where it stopped. A short lease stops two tabs from advancing the same run.

**Install** (account has no `insightflare` Worker):

1. `verify` — download and verify the pinned build; refuse if a D1 database named `insightflare` already holds data.
2. `database` — create D1 `insightflare` (or adopt an existing *empty* one).
3. `kv` — create KV namespace `insightflare-site-settings` (or reuse it).
4. `migrate` — initialize an empty D1 from the verified release schema in one batch when available; otherwise apply the official SQL migrations, up to four per request, with the same `d1_migrations` ledger as `wrangler d1 migrations apply`.
5. `worker` — upload Worker `insightflare` with all bindings from the release manifest, Durable Object migrations, static assets, a deployment marker, and freshly generated `MAIN_SECRET` and `BOOTSTRAP_ADMIN_PASSWORD`. If Cloudflare answers `10089` (Analytics Engine not enabled on the account), it re-uploads without Analytics Engine bindings and sets `INSIGHTFLARE_ANALYTICS_ENGINE_DISABLED=1`, exactly like the main repository's deploy script.
6. `schedules` — set the release's Cron triggers.
7. `subdomain` — enable `insightflare.<account>.workers.dev` (warns if the account never registered a workers.dev subdomain).
8. `analytics` — when Analytics Engine is on, create an account API token limited to *Account Analytics Read* and store it as the `INSIGHTFLARE_AE_API_TOKEN` Worker secret (`INSIGHTFLARE_AE_ACCOUNT_ID` is set as a variable). InsightFlare then reads Analytics Engine without any manual setup. If the token cannot be created, the run finishes with a warning and the user can add a token in InsightFlare's settings.
9. `health` — wait for `GET /healthz` to answer as InsightFlare.

The generated root secret is sent once to Cloudflare and never stored. The administrator password is stored sealed (AES-GCM with `SESSION_ENCRYPTION_KEY`) only until the run finishes, shown once on the done page, and deleted when the user confirms they saved it (or after 24 hours).

**Update** (managed installation, or a legacy one the user explicitly agrees to adopt):

1. `verify` — stops early if the installation already runs the pinned commit.
2. `migrate` — apply pending D1 migrations while the current version keeps serving.
3. `stage` — upload an *inactive* Worker version that inherits every existing binding and secret by version reference. If the installation was set up without Analytics Engine and the account has enabled it since, the new version adds the Analytics Engine bindings.
4. `activate` — after rechecking the ledger, the active version and the staged bindings, switch 100% of traffic.
5. `analytics` — create the read token when Analytics Engine was just enabled.
6. `health` — if the new version never becomes healthy, the previous version is redeployed automatically. D1 migrations are forward-only, as with manual deployments.

## API

All account routes require a connected session and re-check that the user's own authorization can reach the account. Mutating routes require a same-origin `Origin` header.

| Route | Purpose |
| --- | --- |
| `GET /api/v1/providers/cloudflare/accounts/:id/overview` | Read-only plan: what exists, what would be created or updated, blockers |
| `GET …/:id/uninstall` | Read-only uninstall preview, including the exact bound resource identities and plan digest |
| `POST …/:id/uninstall` | Start the reviewed uninstall after typed confirmation; no Nightly artifact required |
| `GET  …/:id/run` | Current run (the admin password is included only after a successful install) |
| `POST …/:id/run` | Start a run for the reviewed `sourceSha` / `artifactDigest` |
| `POST …/:id/run/advance` | Execute the next step once |
| `POST …/:id/run/retry` | Resume a failed run from the failed step |
| `POST …/:id/run/dismiss` | Forget a finished or failed run |
| `POST …/:id/run/password-saved` | Delete the stored administrator password |

## Production setup (Cloudflare GitHub integration)

Host this Worker in the maintainer's **primary** Cloudflare account; customers connect their own accounts through OAuth.

1. **Workers & Pages → Create application → GitHub**, repository `InsightFlare/deploy`, branch `main`, Worker name `insightflare-deploy` (must match `wrangler.jsonc`), root `/`.
2. Build command `pnpm build:web`, deploy command `pnpm exec wrangler deploy --env=""`. Set `NODE_VERSION=24` if needed. Do not use `pnpm build` (it is a dry run).
3. Bind the custom domain `deploy.insightflare.net` to the Worker. `APP_ORIGIN` in `wrangler.jsonc` must match it; OAuth redirects and the origin check depend on it.
4. Create an **OAuth client** (Manage Account → OAuth clients): authorization code with PKCE S256, confidential client (`client_secret_post`), redirect URL `https://deploy.insightflare.net/oauth/cloudflare/callback`.
   - Required scopes: `workers-scripts.read`, `account-settings.read`, `zone.read`.
   - Optional scopes, requested by the deploy flow (`capability=deploy`): `d1.read`, `d1.write`, `workers-scripts.write`, `workers-kv-storage.read`, `workers-kv-storage.write`, `account-analytics.read`, `account-api-tokens.write`. Every one of them must be allowed on the client, otherwise Cloudflare rejects the authorization request. An OAuth-created API token can only carry permissions that were granted here, which is why `account-analytics.read` is needed.
5. Runtime secrets (Settings → Variables and Secrets): `CF_OAUTH_CLIENT_ID`, `CF_OAUTH_CLIENT_SECRET`, `SESSION_ENCRYPTION_KEY` (32 random bytes, Base64; keep it stable across deployments).
   Recommended: `GITHUB_TOKEN`, a fine-grained GitHub token with read-only access to public repositories and no other permissions. Unauthenticated GitHub API calls share a 60-per-hour limit per IP, which Workers egress addresses exhaust; with a token the limit is 5,000 per hour. It is only sent to `api.github.com`.
6. Check `https://deploy.insightflare.net/api/v1/health`, then run an install into a separate test account before inviting users.

The `SESSIONS` and `RUNS` Durable Objects exist only in this control plane; nothing is added to customers' InsightFlare traffic. Deploying the control plane never touches any customer installation.

## Local development

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev          # full app through local Wrangler on http://localhost:8787
pnpm dev:web      # Vite hot reload on :5173 (proxying /api to Wrangler)
pnpm check        # typecheck, i18n check, tests, build and Wrangler dry run
```

Without OAuth credentials the UI stays on the connect step. For local OAuth, put the secrets in an untracked `.dev.vars` and register a matching redirect URL on your own OAuth client.

## UI and internationalization

The wizard is a single card with step progress, built from the published `@insightflare/ui` components, the JetBrains Mono font and InsightFlare's `insightflare-theme` preference. Steps: connect → account → review → deploy → done.

Translations live in `src/i18n/{en,zh,zh-tw,ja}.yaml` under `deploy`; `pnpm i18n:generate` produces the typed `src/lib/i18n/messages.ts` and `pnpm i18n:check` validates structure and placeholders. Step notes from the server are machine codes (`note_<CODE>`) localized in the browser. Language is path based (`/en`, `/zh`, `/zh-tw`, `/ja`), as in InsightFlare.

## Official build artifacts

The main repository builds and validates each `main` commit in CI with `--skip-prebuild` (no credentials, no remote database access). After the CI gate succeeds, `publish-nightly-artifact.yml` publishes one SHA-addressed `insightflare-deploy-<sha>.tar.gz` to the rolling `nightly` prerelease. The archive contains Worker modules, static assets, the ordered D1 migration SQL, a complete database initialization schema (when available), and a `manifest.json` with per-file SHA256 hashes, bindings, variables, Cron triggers and Durable Object migrations. The prerelease notes carry the current SHA and aggregate digest.

`src/core/public-release.ts` uses the official `nightly` pointer as the sole deployment version source, even when `main` is ahead. It checks GitHub's asset digest, parses the archive strictly and recomputes the complete artifact digest before anything is uploaded. Review and execution pin the same SHA and digest; if the Nightly pointer changes before the run finishes, affected steps require a fresh review rather than mixing builds.

`node scripts/pack-build.mjs <checkout> <sha>` verifies an independently built checkout the same way. An experimental isolated Docker builder (`builder/`, `scripts/isolated-builder.mjs`, manual workflow `isolated-builder-smoke.yml`) is kept for research; it is not used by the deploy flow.

MIT license. Maintained by [InsightFlare](https://github.com/InsightFlare).

### Uninstall

Uninstall is independent of the Nightly release channel. The wizard reviews
the managed Worker identity, bound D1 and KV, and custom domains, checks other
listed Workers for shared storage bindings, requires the typed name
`insightflare`, and rechecks the reviewed plan on the server. It deletes the
Worker by ID without force, detaches reviewed residual custom domains, removes
the reviewed storage resources, and verifies their absence. Each step uses the
same account-scoped run lease and is resumable. Cleanup before a failed
installation has created a Worker is restricted to resources recorded as newly
created by that install. Legacy/unrecognized Workers are not removed.

Uninstall is destructive: Worker secrets and Durable Object state may be lost.
Analytics Engine history, API tokens, external resources, and unidentified
orphan resources are not deleted. Check external integrations and back up data
before confirming. Shared binding checks cover listed Workers, not arbitrary
external API clients or all possible non-Worker integrations.

The production tracker records `deploy_uninstall_plan_ready`,
`deploy_uninstall_started`, and `deploy_uninstall_succeeded`; failures and
retries use `deploy_run_failed` and `deploy_run_retried` with mode
`uninstall`. Resource IDs, account IDs, domain names and confirmation text
are not sent as event properties.
