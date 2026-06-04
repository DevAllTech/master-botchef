# ── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 2: instalar dependências ───────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json           ./apps/web/
COPY packages/types/package.json     ./packages/types/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build Next.js ────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY package.json pnpm-workspace.yaml  ./
COPY apps/web/                         ./apps/web/
COPY packages/types/                   ./packages/types/

# NEXT_PUBLIC_* são baked no bundle — precisam vir como build arg.
# Default /api funciona com o nginx deste docker-compose.full.yml.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter web build

# ── Stage 4: imagem de produção ───────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json           ./apps/web/
COPY packages/types/package.json     ./packages/types/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/web/.next    ./apps/web/.next
COPY apps/web/next.config.ts               ./apps/web/next.config.ts

EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
