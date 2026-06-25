# Design: Template de Boas-Vindas Automático

**Data:** 2026-06-22  
**Status:** Aprovado

---

## Resumo

Adicionar um template de boas-vindas automático que dispara quando um cliente manda mensagem inbound via WhatsApp, com cooldown mínimo de 5 horas entre envios para o mesmo contato. Resolve o caso onde o contato começa a conversar às 23h e a virada do dia não deve disparar uma nova boas-vindas.

Aproveita a oportunidade para estabelecer um contrato de tipos sólido entre frontend e backend: a lista de triggers sai de strings soltas para um `const` em `packages/types`, compartilhado pelos dois lados.

---

## Contrato de tipos (`packages/types`)

### Novo export em `packages/types/src/index.ts`

```ts
export const TEMPLATE_TRIGGERS = [
  'order_created',
  'order_confirmed',
  'order_preparing',
  'order_ready',
  'order_delivering',
  'order_delivered',
  'order_cancelled',
  'welcome',
] as const

export type TemplateTrigger = typeof TEMPLATE_TRIGGERS[number]
```

### `TemplateDTO` atualizado

```ts
export interface TemplateDTO {
  id: string
  name: string
  body: string
  trigger: TemplateTrigger | null  // era: string | null
  createdAt: string
  updatedAt: string
}
```

Qualquer trigger fora dessa lista passa a ser erro de compilação em ambos os lados.

---

## Schema (banco de dados)

Adicionar campo nullable ao model `Conversation` no Prisma:

```prisma
model Conversation {
  // ... campos existentes ...
  lastWelcomeAt DateTime?   // null = boas-vindas nunca enviado para este contato
}
```

Sem default — `null` indica que o envio ainda não ocorreu. Migration aplicada via `pnpm db:push`.

---

## Template

| Campo   | Valor                                             |
|---------|---------------------------------------------------|
| name    | `Boas-vindas`                                     |
| trigger | `welcome`                                         |
| body    | `Olá, {{nome}}! 👋 Seja bem-vindo(a)! Em que posso ajudar?` |

**Variável disponível:** `{{nome}}` — preenchida com `senderName` do webhook Uazapi. Se `senderName` estiver vazio, o campo fica em branco (o texto ainda funciona).

---

## Backend

### Zod schema do route de templates (`apps/api/src/routes/templates.ts`)

```ts
import { TEMPLATE_TRIGGERS } from '@botchef/types'

const templateBody = z.object({
  name: z.string().min(1).max(100),
  body: z.string().min(1),
  trigger: z.enum(TEMPLATE_TRIGGERS).optional().nullable(),
})
```

Antes aceitava qualquer string. Agora valores inválidos retornam 400 automaticamente pelo Zod.

### `DEFAULT_TEMPLATES` tipado (`apps/api/src/services/template.ts`)

```ts
import { type TemplateTrigger } from '@botchef/types'

export const DEFAULT_TEMPLATES: Partial<Record<TemplateTrigger, string>> = { ... }
```

---

## Lógica de disparo (webhook Uazapi)

Condição de envio avaliada a cada mensagem inbound (`fromMe: false`, não grupo):

```
lastWelcomeAt === null
OR
(now - lastWelcomeAt) > 5 horas
```

Fluxo completo:

1. Recebe evento `messages` com `fromMe: false` e `isGroup: false`
2. Extrai `phone` (de `chatid`) e `senderName`
3. `upsert` da conversa — comportamento atual inalterado
4. Busca template com `trigger = 'welcome'` para o `userId`
5. Lê `lastWelcomeAt` da conversa (já carregada ou buscada)
6. Avalia condição de cooldown (5h)
7. Se deve enviar:
   a. Interpola `{{nome}}` com `senderName`
   b. Envia via `UazapiService.sendMessage`
   c. Atualiza `conversation.lastWelcomeAt = now()`
8. Retorna `{ ok: true }` — o envio não bloqueia a resposta ao webhook

---

## Frontend

### `TRIGGER_OPTIONS` derivado do contrato (`apps/web/src/app/(dashboard)/templates/template-form.tsx`)

```ts
import { TEMPLATE_TRIGGERS } from '@botchef/types'

const TRIGGER_LABELS: Record<typeof TEMPLATE_TRIGGERS[number], string> = {
  order_created:   'Pedido realizado',
  order_confirmed: 'Pedido confirmado',
  order_preparing: 'Pedido em preparo',
  order_ready:     'Pronto para retirada',
  order_delivering:'Pedido em entrega (delivery)',
  order_delivered: 'Pedido entregue',
  order_cancelled: 'Pedido cancelado',
  welcome:         'Boas-vindas (início de conversa)',
}

const TRIGGER_OPTIONS = [
  { value: '', label: 'Nenhum (manual)' },
  ...TEMPLATE_TRIGGERS.map(t => ({ value: t, label: TRIGGER_LABELS[t] })),
]
```

O label do campo muda de *"Gatilho (status do pedido)"* para *"Gatilho"*.

---

## Propagação do template (novos e existentes)

### Novos clientes (`POST /admin/clients`)
Adicionar ao bloco `createMany` existente:

```ts
{
  userId: client.id,
  name: 'Boas-vindas',
  trigger: 'welcome',
  body: 'Olá, {{nome}}! 👋 Seja bem-vindo(a)! Em que posso ajudar?',
}
```

### Clientes existentes (`prisma/seed.ts`)
O seed já é idempotente. Adicionar lógica que:
1. Busca todos os usuários com `role = 'CLIENT'`
2. Para cada um, verifica se já tem template com `trigger = 'welcome'`
3. Cria o template padrão nos que não têm

---

## Comandos para executar antes de subir o projeto

```bash
pnpm db:push   # aplica a nova coluna lastWelcomeAt na tabela Conversation
pnpm db:seed   # adiciona o template de boas-vindas nos clientes existentes
```

Ambos são idempotentes — seguros para rodar mais de uma vez.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `packages/types/src/index.ts` | + `TEMPLATE_TRIGGERS` const + `TemplateTrigger` type; `TemplateDTO.trigger` tipado |
| `prisma/schema.prisma` | + campo `lastWelcomeAt DateTime?` em `Conversation` |
| `prisma/seed.ts` | + loop que adiciona template `welcome` nos clientes sem ele |
| `apps/api/src/services/template.ts` | `DEFAULT_TEMPLATES` tipado com `TemplateTrigger` |
| `apps/api/src/routes/templates.ts` | `trigger` validado via `z.enum(TEMPLATE_TRIGGERS)` |
| `apps/api/src/routes/webhooks/uazapi.ts` | + lógica de boas-vindas no handler de `messages` |
| `apps/api/src/routes/admin.ts` | + template `welcome` no `createMany` de novos clientes |
| `apps/web/src/app/(dashboard)/templates/template-form.tsx` | `TRIGGER_OPTIONS` derivado do contrato; label do campo atualizado |

---

## Fora do escopo

- Interface no painel para visualizar quando o boas-vindas foi enviado por contato
- Configuração de cooldown pelo painel (fixo em 5h no código)
- Suporte a outras variáveis além de `{{nome}}` no template de boas-vindas
