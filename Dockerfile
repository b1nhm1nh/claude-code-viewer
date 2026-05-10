# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.11 AS base
RUN apt-get update && apt-get install -y git openssh-client && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun-store,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN chmod +x scripts/docker-entrypoint.sh
RUN --mount=type=cache,id=bun-store,target=/root/.bun/install/cache \
    bun run build

FROM base AS runner
WORKDIR /app
ENV CCV_ENV=production \
    PORT=3400 \
    HOSTNAME=0.0.0.0 \
    PATH="/app/node_modules/.bin:${PATH}"
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY package.json bun.lock ./
EXPOSE 3400
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["bun", "dist/main.js"]
