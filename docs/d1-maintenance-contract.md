# InsightFlare migration maintenance contract (draft, not enabled)

## Why a Deploy-owned D1 lease is not sufficient

The upstream InsightFlare Worker writes through several independent execution paths:

- HTTP API, mutations from administrative pages and server functions
- the collector and **IngestDurableObject** that buffers events in its own SQLite storage and flushes them to D1, including alarms
- scheduled task dispatch (hourly rollups, notifications, database maintenance) and ingest alarm sweeps
- existing clients which can continue contacting the old Worker until a new version is promoted

Blocking the web route, pausing only Worker scheduled triggers, or recording a maintenance flag in D1 **does not prove the system is quiescent**. IngestDurableObject alarms may still flush buffered writes; client network requests may already be in flight. A Deploy-side Durable Object lock coordinates only Deploy operations.

## Proposed upstream runtime protocol

The next upstream InsightFlare revision should provide a built-in maintenance facility. It should use InsightFlare's existing Config infrastructure (`src/lib/edge/system-config.ts`) for persistent maintenance intent, NOT require changing an environment variable and redeploying to enter/exit maintenance.

Maintenance state and actually verified quiescence are separate concepts. A persisted flag in D1 is informational until the active Worker and its writers have acknowledged an enforced fence.

State transition contract (all state changes require an authenticated, scoped operation and an exact installation identifier):

1. `running` → `draining`: stop accepting **new writes** at every route (collector, API and server functions). Continue read-only pages where safe, and return a documented retryable maintenance response for blocked writes. Reject or safely buffer new ingestion according to an explicit data-retention strategy, never silently drop analytics events.
2. Drain all in-flight D1 transactions; explicitly reconcile every active ingestion DO's internal SQLite buffers. Do not claim drained merely because the Worker returned success from a single HTTP handler. A drain design must account for unknown/missing site DO instances and alarm retries, with measurable per-site acknowledgements and a bounded timeout.
3. Fence scheduled tasks and DO alarms from initiating **new D1 writes** while maintenance is active. Acknowledgements must prove that every write source has observed the same maintenance generation and that no work is still in flight. Blocked cron invocations should preserve next scheduled work rather than silently dropping required tasks.
4. `draining` → `quiesced`: only after a barrier acknowledges all writers, report a short-lived quiescence receipt tied to the existing Worker version, D1 UUID, maintenance generation, write source coverage, start time and expiry.
5. Deploy verifies the receipt independently and a fresh D1 bookmark and migration ledger, binds the user's explicit approval to source SHA, database and exact SQL manifest, and writes a Durable Object step reservation **before** every D1 SQL batch.
6. Run each SQL+Wrangler ledger write as one confirmed REST batch; verify actual D1 ledger and bookmark after each step. A timeout / Worker crash / lock expiry marks the journal `uncertain` and **never automatically retries**. Inspect the real ledger before any manual reconciliation.
7. Stage and verify the target Worker/DO migrations and static assets without changing traffic; approve promotion separately. Resume writers only after the promoted Worker has passed appropriate health probes, using the same maintenance generation.

A D1 Time Travel bookmark is kept privately as the pre-migration recovery reference; it is **not** permission to restore. Restoring a bookmark overwrites customer data and requires separate explicit consent. Distinguish rolling back Worker code from reversing non-backward-compatible schema changes.

## Current implementation / policy

- The official nightly tar.gz contains verified Worker modules, static assets and **all SQL migrations**. Build itself performs no user database migration.
- Actual remote D1 REST `batch` transaction semantics and all 43 Nightly SQL files have been successfully validated on an isolated, disposable user-designated Cloudflare test account. This only proves a **clean baseline**; it does not prove an upgrade on a populated, active D1.
- Deploy now has read-only migration discovery/preview, exact source and SQL verification, Time Travel/bookmark tracking, database-specific DO leases, a durable write-ahead journal, a private two-step migration coordinator with fault injection tests, and a session-scoped read-only status endpoint.
- Only **new, empty, unbound installations** can be armed by the internal journal contract, after a separate trusted server-side safety/consent attestation. No such public consent endpoint currently exists. Existing instances are always blocked from execution until this maintenance protocol is implemented and tested upstream.
- There is **no API route** for entering maintenance, executing migration SQL, restoring bookmarks or activating Worker versions.

## Required tests before enabling production upgrades

- Delayed collector requests during draining; repeated/in-flight admin POST and server function mutations
- Buffered ingestion DO flush on alarm while maintenance begins, including multiple active sites and disconnected clients
- Cron dispatch and ingest alarm sweeps racing the maintenance transition
- D1 with populated rows, foreign keys, archives, historical migration ledger; interrupted batch and network timeout after a committed write
- DO hibernation and code deployments while journal step `in-flight`; aborted lease and concurrent user update
- Explicit user consent, OAuth D1 Write scope, isolated cross-account protection, no secrets or bookmarks in browser responses
- Safe resume after promotion or a failed deployment, and manual reconciliation for `uncertain` SQL outcomes

Do **not** implement a maintenance switch only at the HTTP routing layer. The upstream working tree may contain unrelated uncommitted work: develop its runtime maintenance mode in an isolated worktree/branch after agreeing on the handshake protocol, not by overwriting that working tree.
