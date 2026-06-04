# ── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 2: instalar todas as deps ──────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json           ./apps/api/
COPY packages/types/package.json     ./packages/types/

RUN pnpm install --frozen-lockfile

# ── Stage 3: gerar Prisma client + compilar TypeScript ───────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY package.json pnpm-workspace.yaml  ./
COPY apps/api/                         ./apps/api/
COPY packages/types/                   ./packages/types/
COPY prisma/                           ./prisma/

# Gera o Prisma Client
RUN pnpm db:generate

# Compila TypeScript → dist/
RUN pnpm --filter api build

# ── Stage 4: imagem de produção (mínima) ─────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Deps de produção apenas
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json           ./apps/api/
COPY packages/types/package.json     ./packages/types/
RUN pnpm install --frozen-lockfile --prod

# Prisma Client gerado + schema + migrations
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/prisma                ./prisma

# Código compilado
COPY --from=builder /app/apps/api/dist  ./apps/api/dist

# Entrypoint (roda migrations antes de iniciar)
COPY docker/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
