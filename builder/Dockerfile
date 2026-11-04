# Reference builder image. Its immutable local image ID (sha256:...) MUST be
# supplied at execution time; mutable tags are rejected by the host runner.
# The base digest should be pinned when this builder is deployed to production.
FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY --chmod=0555 entrypoint.sh /usr/local/bin/ifd-isolated-build
WORKDIR /work
ENV CI=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 COREPACK_ENABLE_AUTO_PIN=0
ENV HOME=/work/.home XDG_CACHE_HOME=/work/.home/.cache
ENV WRANGLER_SEND_METRICS=false DO_NOT_TRACK=1

# The host runner always overrides USER with its dedicated, non-root build
# service UID/GID, matching the owner of the private host scratch directory.
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/ifd-isolated-build"]
