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
