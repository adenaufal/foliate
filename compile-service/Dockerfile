# Foliate compile-service — Typst + Pandoc over Fastify.
#
# Cloudflare Workers/Pages cannot run this: it shells out to the native `typst`
# and `pandoc` binaries (child_process.spawn) and needs a real filesystem for
# its per-request workdir. So it lives on a container host (Render/Fly) and the
# Next.js app proxies to it via COMPILE_SERVICE_URL.

FROM node:22-bookworm-slim

# Pinned to match local dev. Bump together with the templates when Typst changes.
ARG TYPST_VERSION=0.15.1
# Pandoc >= 3.1.7 is REQUIRED — that release added the `-t typst` writer the
# pipeline depends on. Debian's apt pandoc is 2.17 and does NOT have it, so we
# pull a modern build straight from the GitHub release instead of apt.
ARG PANDOC_VERSION=3.6.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Pandoc (linux-amd64 tarball → /usr/local/bin/pandoc)
RUN curl -fsSL "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz" \
      | tar -xz -C /tmp \
    && mv "/tmp/pandoc-${PANDOC_VERSION}/bin/pandoc" /usr/local/bin/pandoc \
    && chmod +x /usr/local/bin/pandoc \
    && rm -rf /tmp/pandoc-*

# Typst (static musl build → /usr/local/bin/typst)
RUN curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
      | tar -xJ -C /tmp \
    && mv /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst \
    && chmod +x /usr/local/bin/typst \
    && rm -rf /tmp/typst-*

WORKDIR /app

# Install deps first for layer caching. No lockfile yet → fall back to install.
COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# App source, incl. templates/ and the bundled fonts/ (Typst reads them via
# --font-path; without them every book falls back to a default face).
COPY . .

ENV NODE_ENV=production
# Absolute paths so config.mjs picks them up directly (it existsSync-checks env
# first, then PATH). Both are also on PATH, so bare names would work too.
ENV TYPST_BIN=/usr/local/bin/typst
ENV PANDOC_BIN=/usr/local/bin/pandoc

# The host (Render/Fly) injects PORT; the server reads process.env.PORT and
# binds 0.0.0.0. EXPOSE is documentation only.
EXPOSE 8723

CMD ["node", "src/server.mjs"]
