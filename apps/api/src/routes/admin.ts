import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { MenuChefService } from '../services/menuchef.js'

const createClientBody = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  menuChefSuffix: z.string().min(1).max(100).optional(),
})

const resetPasswordBody = z.object({
  password: z.string().min(6),
})

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Todas as rotas /admin exigem autenticação de admin
  fastify.addHook('preHandler', fastify.authenticateAdmin)

  // Verificar se um suffix existe no MenuChef (sem modificar dados)
  fastify.get('/admin/check-suffix', async (request, reply) => {
    const { suffix } = request.query as { suffix?: string }
    if (!suffix?.trim()) {
      return reply.status(400).send({ error: 'suffix é obrigatório' })
    }
    try {
      const result = await MenuChefService.validateSuffix(suffix.trim())
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Falha ao validar suffix no MenuChef')
      return reply.status(502).send({ error: 'Não foi possível verificar o suffix no MenuChef.' })
    }
  })

  // Listar todos os clientes
  fastify.get('/admin/clients', async (_request, reply) => {
    const clients = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        connected: true,
        createdAt: true,
        instanceId: true,
        menuChefSuffix: true,
      },
    })

    return reply.send({ clients })
  })

  // Criar novo cliente
  fastify.post('/admin/clients', async (request, reply) => {
    const result = createClientBody.safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos.', details: result.error.flatten() })
    }

    const { name, email, password, menuChefSuffix } = result.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Já existe um usuário com este e-mail.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const client = await prisma.user.create({
      data: { name, email, passwordHash, role: 'CLIENT', active: true, menuChefSuffix: menuChefSuffix ?? null },
      select: { id: true, name: true, email: true, active: true, createdAt: true, menuChefSuffix: true },
    })

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

    return reply.status(201).send({ client })
  })

  // Ativar / bloquear cliente
  fastify.patch('/admin/clients/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { active } = request.body as { active: boolean }

    if (typeof active !== 'boolean') {
      return reply.status(400).send({ error: 'Campo "active" deve ser boolean.' })
    }

    const existing = await prisma.user.findFirst({ where: { id, role: 'CLIENT' } })
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente não encontrado.' })
    }

    const client = await prisma.user.update({
      where: { id },
      data: { active },
      select: { id: true, name: true, email: true, active: true },
    })

    return reply.send({ client })
  })

  // Atualizar suffix MenuChef do cliente
  fastify.patch('/admin/clients/:id/suffix', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { menuChefSuffix } = request.body as { menuChefSuffix: string | null }

    const existing = await prisma.user.findFirst({
      where: { id, role: 'CLIENT' },
      select: { id: true, instanceToken: true },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente não encontrado.' })
    }

    const client = await prisma.user.update({
      where: { id },
      data: { menuChefSuffix: menuChefSuffix ?? null },
      select: { id: true, name: true, menuChefSuffix: true },
    })

    // Se o usuário já tem instanceToken, re-registra imediatamente no MenuChef
    if (existing.instanceToken && menuChefSuffix) {
      MenuChefService.registerToken(menuChefSuffix, existing.instanceToken).catch((err) =>
        fastify.log.error({ err }, 'Falha ao re-registrar token no MenuChef após atualização de suffix'),
      )
    }

    return reply.send({ client })
  })

  // Redefinir senha do cliente
  fastify.patch('/admin/clients/:id/password', async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = resetPasswordBody.safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'Senha inválida.', details: result.error.flatten() })
    }

    const existing = await prisma.user.findFirst({ where: { id, role: 'CLIENT' } })
    if (!existing) {
      return reply.status(404).send({ error: 'Cliente não encontrado.' })
    }

    const passwordHash = await bcrypt.hash(result.data.password, 12)

    await prisma.user.update({ where: { id }, data: { passwordHash } })

    return reply.send({ ok: true })
  })
}

export default adminRoutes
