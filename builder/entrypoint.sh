#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Exact upstream repository, never supplied by an API caller.
readonly UPSTREAM="https://github.com/RavelloH/InsightFlare.git"
readonly SHA="${IFD_SOURCE_SHA:-}"
if [[ ! "${SHA}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid pinned source SHA" >&2
  exit 2
fi

cd /work
if [[ -e /work/checkout ]]; then
  echo "Build workspace is not empty" >&2
  exit 2
fi
mkdir -p /work/.home /work/checkout
git init -q /work/checkout
git -C /work/checkout remote add origin "${UPSTREAM}"
# Fetch exactly the requested commit; detached checkout avoids main moving.
git -C /work/checkout -c protocol.version=2 fetch --no-tags --depth=1 origin "${SHA}"
actual="$(git -C /work/checkout rev-parse 'FETCH_HEAD^{commit}')"
if [[ "${actual}" != "${SHA}" ]]; then
  echo "Downloaded Git commit does not match pinned SHA" >&2
  exit 3
fi
git -C /work/checkout checkout --detach -q "${SHA}"
cd /work/checkout
test "$(git rev-parse HEAD)" = "${SHA}"

# Build has no Cloudflare credentials and must not run remote DB migrations.
# pnpm install is pinned by the source lockfile and packageManager declaration.
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm exec tsx scripts/build.ts --target cf --skip-prebuild

test -f dist/server/wrangler.json
test -f dist/server/index.js
test -d dist/client
test "$(git rev-parse HEAD)" = "${SHA}"

echo "IFD_BUILD_COMPILED ${SHA}"
