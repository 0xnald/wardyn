# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
ARG BINANCE_CLI_VERSION=2.1.1
ARG BINANCE_CLI_SHA256=6b836a24f281abf590988207b0d19d4933971ca66dcf45a9e255cdc237c4deee
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl xz-utils \
    && archive=/tmp/binance-cli.tar.xz \
    && curl --fail --location --proto '=https' --tlsv1.2 \
      "https://github.com/binance/binance-cli/releases/download/v${BINANCE_CLI_VERSION}/binance-cli-x86_64-unknown-linux-gnu.tar.xz" \
      --output "$archive" \
    && echo "${BINANCE_CLI_SHA256}  ${archive}" | sha256sum --check --strict \
    && tar --extract --xz --file "$archive" --directory /tmp \
    && install --mode 0755 "/tmp/binance-cli-x86_64-unknown-linux-gnu/binance-cli" /usr/local/bin/binance-cli \
    && rm --recursive --force /var/lib/apt/lists/* /tmp/binance-cli* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir --parents /data/wardyn \
    && chown --recursive nextjs:nodejs /data
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV WARDYN_BINANCE_CLI_PATH=/usr/local/bin/binance-cli
ENV WARDYN_DATA_DIR=/data/wardyn
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
