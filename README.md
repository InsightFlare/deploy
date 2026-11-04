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

While the UI package is not yet published to npm, it is included as a **reproducible local package snapshot** at `vendor/insightflare-ui-0.7.1.tgz`. The source repository and commit are recorded in `vendor/source.json`. CI installs this checked-in package directly; it does not need the original InsightFlare source tree or any developer-specific path.

To refresh the package from a developer checkout:

```bash
pnpm ui:sync
pnpm install
pnpm check
```

Use `pnpm ui:sync --source /path/to/InsightFlare/packages/ui` if the source checkout is elsewhere. The sync script builds the UI package, packs it and updates the dependency reference. When an official npm release is available, replace the local package reference with its published version.

`pnpm dev` serves the complete app through local Wrangler. For Vite hot reload, run `pnpm dev:web` alongside the Wrangler backend and open port 5173.

## Deployment model

The latest upstream `main` commit is used as the source of truth. Each operation pins one full commit SHA. The long-term goal is user-side independent compilation and safe installation/update without requiring users to fork the source repository.

Cloudflare Builds permissions and upstream-repository access are not yet fully verified. Until that integration has passed real-account validation, the control plane intentionally exposes **no mutation endpoint**.

MIT license. Project maintained by [InsightFlare](https://github.com/InsightFlare).
