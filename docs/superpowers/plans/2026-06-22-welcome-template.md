# Welcome Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar template de boas-vindas automático que dispara em mensagens inbound com cooldown de 5h, com contrato de tipos sólido entre frontend e backend via `packages/types`.

**Architecture:** `TEMPLATE_TRIGGERS` const em `packages/types` é a fonte única da verdade para os valores de trigger válidos. O backend usa para validação Zod; o frontend deriva o dropdown a partir dele. O campo `lastWelcomeAt` na tabela `Conversation` controla o cooldown. O webhook da Uazapi dispara boas-vindas em fire-and-forget para não bloquear a resposta.

**Tech Stack:** TypeScript, Prisma (PostgreSQL), Fastify, Zod, Next.js 15 (App Router), pnpm workspaces

---

## File Map

| Arquivo | Ação |
|---|---|
| `packages/types/src/index.ts` | + `TEMPLATE_TRIGGERS` const + `TemplateTrigger` type; atualiza `TemplateDTO` |
| `apps/api/package.json` | + `"@botchef/types": "workspace:*"` |
| `apps/api/src/services/template.ts` | `DEFAULT_TEMPLATES` tipado; + entrada `welcome` |
| `apps/api/src/routes/templates.ts` | trigger validado via `z.enum(TEMPLATE_TRIGGERS)` |
| `prisma/schema.prisma` | + `lastWelcomeAt DateTime?` em `Conversation` |
| `apps/api/src/routes/webhooks/uazapi.ts` | + lógica de boas-vindas com cooldown de 5h |
| `apps/api/src/routes/admin.ts` | + template `welcome` no `createMany` de novos clientes |
| `prisma/seed.ts` | + loop idempotente que cria template `welcome` em clientes existentes |
| `apps/web/package.json` | + `"@botchef/types": "workspace:*"` |
| `apps/web/src/app/(dashboard)/templates/template-form.tsx` | `TRIGGER_OPTIONS` derivado do contrato; label atualizado |
| `apps/web/src/lib/api.ts` | `TemplateInput.trigger` tipado com `TemplateTrigger` |

---

## Task 1: Contrato de tipos compartilhado

**Arquivos:**
- Modify: `packages/types/src/index.ts`

- [ ] **Passo 1: Adicionar `TEMPLATE_TRIGGERS` e `TemplateTrigger` em `packages/types/src/index.ts`**

Abrir o arquivo e substituir a interface `TemplateDTO` + adicionar o const antes dela:

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

export interface TemplateDTO {
  id: string
  name: string
  body: string
  trigger: TemplateTrigger | null  // era: string | null
  createdAt: string
  updatedAt: string
}
```

Os demais exports (`UserDTO`, `ConversationDTO`, `MenuChefCallbackPayload`, `UazapiWebhookPayload`) ficam intactos.

- [ ] **Passo 2: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): adiciona TEMPLATE_TRIGGERS const e TemplateTrigger type"
```

---

## Task 2: Backend — dependência de workspace + validação Zod + DEFAULT_TEMPLATES tipado

**Arquivos:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/services/template.ts`
- Modify: `apps/api/src/routes/templates.ts`

- [ ] **Passo 1: Adicionar `@botchef/types` como dependência workspace em `apps/api/package.json`**

No objeto `"dependencies"`, adicionar a linha:

```json
"@botchef/types": "workspace:*"
```

- [ ] **Passo 2: Instalar**

```bash
pnpm install
```

Esperado: `Packages in scope: api` instalado sem erros.

- [ ] **Passo 3: Tipar `DEFAULT_TEMPLATES` e adicionar entrada `welcome` em `apps/api/src/services/template.ts`**

Conteúdo completo do arquivo (substituir inteiro):

```ts
import type { TemplateTrigger } from '@botchef/types'

export interface TemplateVars {
  nome?: string
  status?: string
  pedido?: string
  telefone?: string
  restaurante?: string
  [key: string]: string | undefined
}

export const DEFAULT_TEMPLATES: Partial<Record<TemplateTrigger, string>> = {
  order_created: `🎉 *Olá, {{nome}}! Seu pedido foi realizado com sucesso!*
Você será notificado sobre o andamento por aqui. 😊

📍 *Endereço de Entrega:*
- Rua: {{rua}}
- Ponto de Ref.: {{ponto_ref}}
- Bairro: {{bairro}}
- Cidade: {{cidade}}

🗒️ *Resumo do Pedido:*
- Código: {{pedido}}
- Nome: {{nome}}
- Data do Pedido: {{data_pedido}}
- Taxa de Entrega: {{taxa_entrega}}
- Previsão de Entrega: {{previsao_entrega}}

🛒 *Itens do Pedido:*
{{itens}}

💰 *Forma de Pagamento:* {{forma_pagamento}}
*{{info_pagamento}}*

✅ *Total:* {{total}}`,
  order_confirmed:  'Boa notícia! Seu pedido #{{pedido}} foi confirmado e logo começará a ser preparado.',
  order_preparing:  'Seu pedido #{{pedido}} já está em preparo! Em breve avisamos por aqui. 🚀',
  order_ready:      'Seu pedido #{{pedido}} está pronto para retirada! Pode vir buscar. 🎉',
  order_delivering: 'Seu pedido #{{pedido}} saiu para entrega e está a caminho! 🛵',
  order_delivered:  'Seu pedido #{{pedido}} foi entregue. Obrigado pela preferência! ❤️',
  order_cancelled:  'Seu pedido #{{pedido}} foi cancelado. Em caso de dúvidas, entre em contato conosco.',
  welcome:          'Olá, {{nome}}! 👋 Seja bem-vindo(a)! Em que posso ajudar?',
}

const GENERIC_DEFAULT = 'Atualização do seu pedido #{{pedido}}: {{status}}.'

export function resolveTemplateBody(customBody: string | null | undefined, status: string): string {
  if (customBody) return customBody
  return DEFAULT_TEMPLATES[status as TemplateTrigger] ?? GENERIC_DEFAULT
}

export function interpolate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
```

- [ ] **Passo 4: Atualizar validação Zod em `apps/api/src/routes/templates.ts`**

Substituir as primeiras linhas do arquivo até o schema `templateBody`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { TEMPLATE_TRIGGERS } from '@botchef/types'

const templateBody = z.object({
  name: z.string().min(1).max(100),
  body: z.string().min(1),
  trigger: z.enum(TEMPLATE_TRIGGERS as unknown as [string, ...string[]]).optional().nullable(),
})
```

O restante do arquivo (rotas GET, POST, PUT, DELETE) fica intacto.

- [ ] **Passo 5: Verificar tipos**

```bash
pnpm --filter api typecheck
```

Esperado: sem erros de tipo.

- [ ] **Passo 6: Commit**

```bash
git add apps/api/package.json apps/api/src/services/template.ts apps/api/src/routes/templates.ts
git commit -m "feat(api): tipagem forte de triggers via TEMPLATE_TRIGGERS; adiciona welcome ao DEFAULT_TEMPLATES"
```

---

## Task 3: Schema — campo `lastWelcomeAt` na Conversation

**Arquivos:**
- Modify: `prisma/schema.prisma`

- [ ] **Passo 1: Adicionar campo `lastWelcomeAt` ao model `Conversation` em `prisma/schema.prisma`**

Localizar o model `Conversation` e adicionar o campo após `direction`:

```prisma
model Conversation {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  phone         String
  lastMessage   String?
  lastMessageAt DateTime?
  direction     String?
  lastWelcomeAt DateTime?

  updatedAt DateTime @updatedAt

  @@unique([userId, phone])
  @@index([userId])
}
```

- [ ] **Passo 2: Aplicar ao banco e regenerar o cliente Prisma**

```bash
pnpm db:push
pnpm db:generate
```

Esperado: `Your database is now in sync with your Prisma schema` e cliente gerado sem erros.

- [ ] **Passo 3: Verificar tipos da api após geração do cliente**

```bash
pnpm --filter api typecheck
```

Esperado: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): adiciona lastWelcomeAt à Conversation para controle de cooldown de boas-vindas"
```

---

## Task 4: Webhook Uazapi — lógica de boas-vindas com cooldown de 5h

**Arquivos:**
- Modify: `apps/api/src/routes/webhooks/uazapi.ts`

- [ ] **Passo 1: Substituir o conteúdo completo de `apps/api/src/routes/webhooks/uazapi.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { MenuChefService } from '../../services/menuchef.js'
import { UazapiService } from '../../services/uazapi.js'
import { interpolate } from '../../services/template.js'

const WELCOME_COOLDOWN_MS = 5 * 60 * 60 * 1000 // 5 horas em milissegundos

interface UazapiWebhookBody {
  EventType: 'connection' | 'messages' | string
  instanceName?: string
  token?: string
  instance?: {
    status?: string
    qrcode?: string
  }
  message?: {
    chatid?: string
    text?: string
    content?: {
      text?: string
    }
    fromMe?: boolean
    isGroup?: boolean
    sender?: string
    senderName?: string
    messageType?: string
  }
}

const uazapiWebhookRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhooks/uazapi', async (request, reply) => {
    const body = request.body as UazapiWebhookBody

    const instanceToken = body.token

    if (!instanceToken) {
      fastify.log.warn('Webhook Uazapi recebido sem token no body')
      return reply.send({ ok: true })
    }

    const user = await prisma.user.findFirst({
      where: { instanceToken },
      select: { id: true, instanceToken: true, menuChefSuffix: true, connected: true },
    })

    if (!user) {
      fastify.log.warn({ instanceToken }, 'Webhook Uazapi: instância não reconhecida')
      return reply.send({ ok: true })
    }

    fastify.log.info({ EventType: body.EventType, instanceName: body.instanceName }, 'Webhook Uazapi recebido')

    // ── Evento de conexão ─────────────────────────────────────────────────────
    if (body.EventType === 'connection') {
      const status = body.instance?.status ?? ''
      const connected = status === 'connected'

      await prisma.user.update({
        where: { id: user.id },
        data: { connected },
      })

      if (connected && user.menuChefSuffix && user.instanceToken) {
        MenuChefService.registerToken(user.menuChefSuffix, user.instanceToken).catch((err) =>
          fastify.log.error({ err }, 'Falha ao re-registrar token no MenuChef no evento de conexão'),
        )
      }

      fastify.log.info({ connected, status }, 'Status de conexão atualizado')
      return reply.send({ ok: true })
    }

    // ── Evento de mensagem ────────────────────────────────────────────────────
    if (body.EventType === 'messages') {
      const msg = body.message

      if (!msg) {
        return reply.send({ ok: true })
      }

      if (msg.isGroup) {
        return reply.send({ ok: true })
      }

      const chatid = msg.chatid ?? ''
      const phone = chatid.split('@')[0].replace(/\D/g, '')

      if (!phone) {
        return reply.send({ ok: true })
      }

      const messageText = msg.text ?? msg.content?.text ?? '(mensagem recebida)'
      const direction = msg.fromMe ? 'sent' : 'received'

      const conversation = await prisma.conversation.upsert({
        where: { userId_phone: { userId: user.id, phone } },
        create: {
          userId: user.id,
          phone,
          lastMessage: messageText,
          lastMessageAt: new Date(),
          direction,
        },
        update: {
          lastMessage: messageText,
          lastMessageAt: new Date(),
          direction,
        },
      })

      // Boas-vindas: apenas em mensagens recebidas (não enviadas por nós)
      if (!msg.fromMe) {
        const lastWelcome = conversation.lastWelcomeAt
        const cooldownPassou = !lastWelcome || (Date.now() - lastWelcome.getTime()) > WELCOME_COOLDOWN_MS

        if (cooldownPassou) {
          const welcomeTemplate = await prisma.template.findFirst({
            where: { userId: user.id, trigger: 'welcome' },
          })

          if (welcomeTemplate) {
            const message = interpolate(welcomeTemplate.body, {
              nome: msg.senderName ?? '',
            })

            // Fire-and-forget: não bloqueia a resposta ao webhook
            void UazapiService.sendMessage(instanceToken, phone, message)
              .then(() => prisma.conversation.update({
                where: { id: conversation.id },
                data: { lastWelcomeAt: new Date() },
              }))
              .catch((err) => fastify.log.error({ err, phone }, 'Falha ao enviar boas-vindas'))
          }
        }
      }

      return reply.send({ ok: true })
    }

    return reply.send({ ok: true })
  })
}

export default uazapiWebhookRoute
```

- [ ] **Passo 2: Verificar tipos**

```bash
pnpm --filter api typecheck
```

Esperado: sem erros de tipo.

- [ ] **Passo 3: Commit**

```bash
git add apps/api/src/routes/webhooks/uazapi.ts
git commit -m "feat(api): disparo automático de boas-vindas com cooldown de 5h no webhook Uazapi"
```

---

## Task 5: Admin — template `welcome` para novos clientes

**Arquivos:**
- Modify: `apps/api/src/routes/admin.ts`

- [ ] **Passo 1: Adicionar entrada `welcome` ao `createMany` em `apps/api/src/routes/admin.ts`**

Localizar o bloco `await prisma.template.createMany({ data: [ ... ] })` dentro de `fastify.post('/admin/clients', ...)` e adicionar o template de boas-vindas como **primeiro item** da lista:

```ts
await prisma.template.createMany({
  data: [
    {
      userId: client.id,
      name: 'Boas-vindas',
      trigger: 'welcome',
      body: 'Olá, {{nome}}! 👋 Seja bem-vindo(a)! Em que posso ajudar?',
    },
    {
      userId: client.id,
      name: 'Pedido Realizado',
      trigger: 'order_created',
      body: `🎉 *Olá, {{nome}}! Seu pedido foi realizado com sucesso!*
Você será notificado sobre o andamento por aqui. 😊

📍 *Endereço de Entrega:*
- Rua: {{rua}}
- Ponto de Ref.: {{ponto_ref}}
- Bairro: {{bairro}}
- Cidade: {{cidade}}

🗒️ *Resumo do Pedido:*
- Código: {{pedido}}
- Nome: {{nome}}
- Data do Pedido: {{data_pedido}}
- Taxa de Entrega: {{taxa_entrega}}
- Previsão de Entrega: {{previsao_entrega}}

🛒 *Itens do Pedido:*
{{itens}}

💰 *Forma de Pagamento:* {{forma_pagamento}}
*{{info_pagamento}}*

✅ *Total:* {{total}}`,
    },
    {
      userId: client.id,
      name: 'Pedido Confirmado',
      trigger: 'order_confirmed',
      body: '🍽️ Olá, {{nome}}!\n\nSeu pedido #{{pedido}} foi confirmado com sucesso ✅\n\nAgora nossa equipe já começou a organizar tudo por aqui.\nEm breve enviaremos uma nova atualização do status do seu pedido.\n\nObrigado por pedir com a gente! ❤️',
    },
    {
      userId: client.id,
      name: 'Pedido em Preparo',
      trigger: 'order_preparing',
      body: '👨‍🍳 Seu pedido #{{pedido}} já está em preparo!\n\nEstamos preparando tudo com muito cuidado para enviar o mais rápido possível 🚀\nAssim que sair para entrega, avisamos você por aqui 😉',
    },
    {
      userId: client.id,
      name: 'Pronto para Retirada',
      trigger: 'order_ready',
      body: '✅ Pedido #{{pedido}} pronto para retirada!\n\nPode vir buscar 😉',
    },
    {
      userId: client.id,
      name: 'Pedido em Entrega',
      trigger: 'order_delivering',
      body: '🛵 Pedido #{{pedido}} em rota de entrega!\n\nSeu pedido já saiu e está indo até você 😉',
    },
    {
      userId: client.id,
      name: 'Pedido Entregue',
      trigger: 'order_delivered',
      body: '✅ Pedido #{{pedido}} entregue com sucesso!\n\nEsperamos que você aproveite seu pedido 😋\nObrigado por escolher a {{restaurante}}. ❤️\n\nAté a próxima!',
    },
    {
      userId: client.id,
      name: 'Pedido Cancelado',
      trigger: 'order_cancelled',
      body: '😔 Infelizmente seu pedido #{{pedido}} precisou ser cancelado.\n\nPedimos desculpas pelo transtorno e agradecemos sua compreensão.\nQualquer dúvida, estamos disponíveis para atendimento.',
    },
  ],
})
```

- [ ] **Passo 2: Verificar tipos**

```bash
pnpm --filter api typecheck
```

Esperado: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat(api): inclui template de boas-vindas no cadastro de novos clientes"
```

---

## Task 6: Seed — template `welcome` para clientes existentes

**Arquivos:**
- Modify: `prisma/seed.ts`

- [ ] **Passo 1: Substituir o conteúdo completo de `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const WELCOME_BODY = 'Olá, {{nome}}! 👋 Seja bem-vindo(a)! Em que posso ajudar?'

async function main() {
  const adminHash = await bcrypt.hash('admin123', 12)
  const clientHash = await bcrypt.hash('cliente123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@botchef.com' },
    update: {},
    create: {
      email: 'admin@botchef.com',
      passwordHash: adminHash,
      name: 'Super Admin',
      role: 'ADMIN',
      active: true,
    },
  })

  const client = await prisma.user.upsert({
    where: { email: 'cliente@exemplo.com' },
    update: {},
    create: {
      email: 'cliente@exemplo.com',
      passwordHash: clientHash,
      name: 'Restaurante Exemplo',
      role: 'CLIENT',
      active: true,
    },
  })

  const hasOrderCreated = await prisma.template.findFirst({
    where: { userId: client.id, trigger: 'order_created' },
  })
  if (!hasOrderCreated) {
    await prisma.template.create({
      data: {
        userId: client.id,
        name: 'Pedido Realizado',
        trigger: 'order_created',
        body: `🎉 *Olá, {{nome}}! Seu pedido foi realizado com sucesso!*
Você será notificado sobre o andamento por aqui. 😊

📍 *Endereço de Entrega:*
- Rua: {{rua}}
- Ponto de Ref.: {{ponto_ref}}
- Bairro: {{bairro}}
- Cidade: {{cidade}}

🗒️ *Resumo do Pedido:*
- Código: {{pedido}}
- Nome: {{nome}}
- Data do Pedido: {{data_pedido}}
- Taxa de Entrega: {{taxa_entrega}}
- Previsão de Entrega: {{previsao_entrega}}

🛒 *Itens do Pedido:*
{{itens}}

💰 *Forma de Pagamento:* {{forma_pagamento}}
*{{info_pagamento}}*

✅ *Total:* {{total}}`,
      },
    })
  }

  // ── Adiciona template de boas-vindas a todos os clientes que não têm ────────
  const allClients = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: { id: true },
  })

  let welcomeCreated = 0
  for (const c of allClients) {
    const hasWelcome = await prisma.template.findFirst({
      where: { userId: c.id, trigger: 'welcome' },
    })
    if (!hasWelcome) {
      await prisma.template.create({
        data: {
          userId: c.id,
          name: 'Boas-vindas',
          trigger: 'welcome',
          body: WELCOME_BODY,
        },
      })
      welcomeCreated++
    }
  }

  console.log('✅ Seed concluído.')
  console.log(`   Admin  → ${admin.email} / admin123`)
  console.log(`   Client → ${client.email} / cliente123`)
  if (welcomeCreated > 0) {
    console.log(`   Boas-vindas criado para ${welcomeCreated} cliente(s) existente(s)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Passo 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): adiciona template de boas-vindas a todos os clientes existentes"
```

---

## Task 7: Frontend — contrato de tipos + dropdown atualizado

**Arquivos:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/(dashboard)/templates/template-form.tsx`

- [ ] **Passo 1: Verificar `apps/web/package.json` e adicionar `@botchef/types`**

Abrir `apps/web/package.json` e adicionar `@botchef/types` no objeto `"dependencies"`:

```json
"@botchef/types": "workspace:*"
```

- [ ] **Passo 2: Instalar**

```bash
pnpm install
```

Esperado: dependência resolvida sem erros.

- [ ] **Passo 3: Tipar `TemplateInput.trigger` em `apps/web/src/lib/api.ts`**

Adicionar o import no topo do arquivo:

```ts
import type { TemplateTrigger } from '@botchef/types'
```

Localizar e atualizar apenas a interface `TemplateInput`:

```ts
export interface TemplateInput {
  name: string
  body: string
  trigger?: TemplateTrigger | null
}
```

A interface `Template` local (com `trigger: string | null`) fica intacta — é o shape que vem da API e não precisa ser restrito no tipo de resposta.

- [ ] **Passo 4: Atualizar `apps/web/src/app/(dashboard)/templates/template-form.tsx`**

Substituir o conteúdo completo:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle } from 'lucide-react'
import type { Template } from '@/lib/api'
import { TEMPLATE_TRIGGERS } from '@botchef/types'

const TEMPLATE_VARS = ['{{nome}}', '{{restaurante}}', '{{pedido}}', '{{status}}', '{{telefone}}', '{{rua}}', '{{ponto_ref}}', '{{bairro}}', '{{cidade}}', '{{data_pedido}}', '{{taxa_entrega}}', '{{previsao_entrega}}', '{{itens}}', '{{forma_pagamento}}', '{{info_pagamento}}', '{{total}}']

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
  ...TEMPLATE_TRIGGERS.map((t) => ({ value: t, label: TRIGGER_LABELS[t] })),
]

interface TemplateFormProps {
  action: (state: unknown, formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
  template?: Template
  onSuccess?: () => void
}

export function TemplateForm({ action, template, onSuccess }: TemplateFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)

  useEffect(() => {
    if (state?.success) {
      onSuccess?.()
    }
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      {template && <input type="hidden" name="id" value={template.id} />}

      {state?.error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do template</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Pedido Confirmado"
          defaultValue={template?.name}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trigger">Gatilho</Label>
        <select
          id="trigger"
          name="trigger"
          defaultValue={template?.trigger ?? ''}
          disabled={isPending}
          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50"
        >
          {TRIGGER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">
          Define quando este template será disparado automaticamente.
          <br />
          <span className="text-gray-500">
            "Boas-vindas" dispara na primeira mensagem do dia do cliente · "Pronto para retirada" = cliente busca no balcão · "Em entrega (delivery)" = motoboy a caminho
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Mensagem</Label>
        <Textarea
          id="body"
          name="body"
          rows={4}
          placeholder="Ex: Olá {{nome}}! Seu pedido #{{pedido}} foi confirmado. ✅"
          defaultValue={template?.body}
          required
          disabled={isPending}
        />
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_VARS.map((v) => (
            <span
              key={v}
              className="cursor-default rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600"
              title={`Variável disponível: ${v}`}
            >
              {v}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">Use as variáveis acima para personalizar a mensagem.</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : template ? 'Salvar alterações' : 'Criar template'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Passo 5: Verificar tipos**

```bash
pnpm --filter web typecheck
```

Esperado: sem erros de tipo.

- [ ] **Passo 6: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/api.ts apps/web/src/app/(dashboard)/templates/template-form.tsx
git commit -m "feat(web): dropdown de gatilhos derivado do contrato TEMPLATE_TRIGGERS; adiciona opção boas-vindas"
```

---

## Comandos finais para subir o projeto

Após implementar todas as tasks, executar nesta ordem:

```bash
pnpm db:push    # aplica lastWelcomeAt na tabela Conversation
pnpm db:seed    # adiciona template boas-vindas nos clientes existentes
pnpm dev        # sobe o projeto
```
