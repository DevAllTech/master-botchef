# BotChef

Plataforma de atendimento via WhatsApp integrada ao MenuChef.

## Estrutura

```
apps/
  web/   # Next.js 15 (App Router) + Tailwind CSS — painel do cliente
  api/   # Fastify + TypeScript — backend REST
packages/
  types/ # Tipos TypeScript compartilhados entre web e api
prisma/  # Schema PostgreSQL (Prisma ORM)
```

## Comandos principais

```bash
# Subir banco local
docker compose up -d

# Instalar dependências
pnpm install

# Gerar cliente Prisma
pnpm db:generate

# Aplicar schema ao banco
pnpm db:push

# Seed inicial (cria usuário admin de teste)
pnpm db:seed

# Rodar tudo em dev
pnpm dev

# Apenas api
pnpm --filter api dev

# Apenas web
pnpm --filter web dev
```

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz e preencha:
- `DATABASE_URL` — conexão PostgreSQL
- `JWT_SECRET` — segredo do JWT (mínimo 32 chars em produção)
- `UAZAPI_BASE_URL` — URL base da API Uazapi
- `UAZAPI_GLOBAL_TOKEN` — token global do Uazapi
- `NEXT_PUBLIC_API_URL` — URL da API acessível pelo browser

## Segurança

- JWT em cookie `httpOnly` + `sameSite=strict` no frontend
- Endpoints públicos (`/webhooks/*`) protegidos por `x-instance-token` (token da instância do usuário)
- Senhas com bcrypt (cost 12)

## Integração Uazapi

O `UazapiService` em `apps/api/src/services/uazapi.ts` encapsula todas as chamadas.
Retry simples: 3 tentativas com backoff 1s / 2s / 4s.

## Integração MenuChef

O endpoint `POST /webhooks/menuchef` recebe mudanças de status de pedido e dispara
mensagens via Uazapi usando o template vinculado ao trigger do status.
