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

# Gera o Prisma Client. Com pnpm ele fica ao lado do @prisma/client, dentro de
# node_modules/.pnpm/@prisma+client@<versão>.../node_modules/.prisma; uma cópia
# vai para /prisma-client, de onde o runner pega.
RUN pnpm db:generate \
 && cp -r "$(readlink -f node_modules/@prisma/client)/../../.prisma" /prisma-client

# Compila TypeScript → dist/ (o prebuild compila antes o packages/types)
RUN pnpm --filter api build

# ── Stage 4: imagem de produção (mínima) ─────────────────────────────────────
FROM base AS runner
WORKDIR /app

# CHECKPOINT_DISABLE: o CLI do Prisma não consulta a internet (telemetria e
# aviso de versão nova) a cada boot.
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# Deps de produção apenas. O CLI `prisma` é dependência de produção da api
# (o entrypoint roda `prisma db push`), na versão travada no pnpm-lock. Sem
# isso o entrypoint caía no `npx prisma`, que baixava a última versão do
# Prisma (outra major) na hora do boot.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json           ./apps/api/
COPY packages/types/package.json     ./packages/types/
# O store do pnpm e o cache de engines do Prisma (~290 MB) não servem para nada
# em execução: saem na mesma camada.
RUN pnpm install --frozen-lockfile --prod \
 && rm -rf "$(pnpm store path)" /root/.cache/prisma

# Schema + Prisma Client gerado no builder, colocado ao lado do @prisma/client
# que a api resolve (mesma pasta do .pnpm, já que o lockfile é o mesmo). Não
# dá para rodar o `prisma generate` aqui: sem as devDependencies da raiz ele
# tenta `pnpm add prisma -D`.
COPY prisma/ ./prisma/
COPY --from=builder /prisma-client /tmp/prisma-client
# (o postinstall do @prisma/client deixa um client vazio no lugar; sai antes)
RUN dest="$(readlink -f apps/api/node_modules/@prisma/client)/../../.prisma" \
 && rm -rf "$dest" && cp -r /tmp/prisma-client "$dest" && rm -rf /tmp/prisma-client \
 && grep -q 'model User' "$dest/client/schema.prisma"

# Código compilado. O @botchef/types é importado em tempo de execução
# (TEMPLATE_TRIGGERS), então o dist dele também vem.
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist       ./apps/api/dist

# Entrypoint (sincroniza o schema antes de iniciar). O sed tira o CR caso o
# arquivo venha de um checkout no Windows.
COPY docker/api/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

USER node

EXPOSE 3001

# /health não toca no banco: só diz se o processo está de pé.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health > /dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
