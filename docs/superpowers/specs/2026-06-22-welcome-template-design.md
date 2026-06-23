# Design: Template de Boas-Vindas Automático

**Data:** 2026-06-22  
**Status:** Aprovado

---

## Resumo

Adicionar um template de boas-vindas automático que dispara quando um cliente manda mensagem inbound via WhatsApp, com cooldown mínimo de 5 horas entre envios para o mesmo contato. Resolve o caso onde o contato começa a conversar às 23h e a virada do dia não deve disparar uma nova boas-vindas.

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
| `prisma/schema.prisma` | + campo `lastWelcomeAt DateTime?` em `Conversation` |
| `prisma/seed.ts` | + loop que adiciona template `welcome` nos clientes sem ele |
| `apps/api/src/routes/webhooks/uazapi.ts` | + lógica de boas-vindas no handler de `messages` |
| `apps/api/src/routes/admin.ts` | + template `welcome` no `createMany` de novos clientes |

---

## Fora do escopo

- Interface no painel para visualizar/editar quando o boas-vindas foi enviado por contato
- Configuração de cooldown (fixo em 5h no código)
- Suporte a outras variáveis além de `{{nome}}` no template de boas-vindas
