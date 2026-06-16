import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { UazapiService } from '../../services/uazapi.js'
import { interpolate, resolveTemplateBody } from '../../services/template.js'

const callbackBody = z.object({
  orderId: z.string(),
  orderNumber: z.string().optional(),
  status: z.string(),
  phone: z.string(),
  customerName: z.string().optional(),
  suffix: z.string().optional(),
  // Campos do evento order_created
  deliveryStreet: z.string().optional(),
  deliveryReference: z.string().optional(),
  deliveryNeighborhood: z.string().optional(),
  deliveryCity: z.string().optional(),
  orderDate: z.string().optional(),
  deliveryFee: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  items: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentNote: z.string().optional(),
  total: z.string().optional(),
})

const menuChefWebhookRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhooks/menuchef', async (request, reply) => {
    const instanceToken = request.headers['x-instance-token'] as string | undefined

    if (!instanceToken) {
      return reply.status(401).send({ error: 'Token de instância ausente.' })
    }

    const user = await prisma.user.findFirst({
      where: { instanceToken },
      select: { id: true, name: true, instanceToken: true, menuChefSuffix: true },
    })

    if (!user) {
      return reply.status(401).send({ error: 'Instância não reconhecida.' })
    }

    if (!user.instanceToken) {
      return reply.status(400).send({ error: 'Instância WhatsApp não configurada.' })
    }

    const result = callbackBody.safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'Payload inválido.', details: result.error.flatten() })
    }

    const {
      orderId, orderNumber, status, customerName, suffix,
      deliveryStreet, deliveryReference, deliveryNeighborhood, deliveryCity,
      orderDate, deliveryFee, estimatedDelivery, items,
      paymentMethod, paymentNote, total,
    } = result.data

    // Defesa em profundidade: valida suffix se ambos os lados o enviarem/tiverem configurado
    if (suffix && user.menuChefSuffix && suffix !== user.menuChefSuffix) {
      fastify.log.warn(
        { userId: user.id, suffixEnviado: suffix, suffixEsperado: user.menuChefSuffix },
        'Webhook MenuChef: suffix não corresponde — possível replay de token',
      )
      return reply.status(401).send({ error: 'Suffix não corresponde à instância.' })
    }
    // Normaliza o telefone: apenas dígitos + garante código de país 55 (BR)
    const rawPhone = result.data.phone.replace(/\D/g, '')
    const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`

    const template = await prisma.template.findFirst({
      where: { userId: user.id, trigger: status },
    })

    const templateBody = resolveTemplateBody(template?.body, status)

    const message = interpolate(templateBody, {
      pedido: orderNumber ?? orderId,
      status,
      nome: customerName ?? '',
      telefone: phone,
      restaurante: user.name,
      rua: deliveryStreet ?? '',
      ponto_ref: deliveryReference ?? '',
      bairro: deliveryNeighborhood ?? '',
      cidade: deliveryCity ?? '',
      data_pedido: orderDate ?? '',
      taxa_entrega: deliveryFee ?? '',
      previsao_entrega: estimatedDelivery ?? '',
      itens: items ?? '',
      forma_pagamento: paymentMethod ?? '',
      info_pagamento: paymentNote ?? '',
      total: total ?? '',
    })

    await UazapiService.sendMessage(user.instanceToken, phone, message)

    await prisma.conversation.upsert({
      where: { userId_phone: { userId: user.id, phone } },
      create: {
        userId: user.id,
        phone,
        lastMessage: message,
        lastMessageAt: new Date(),
        direction: 'sent',
      },
      update: {
        lastMessage: message,
        lastMessageAt: new Date(),
        direction: 'sent',
      },
    })

    return reply.send({ ok: true })
  })
}

export default menuChefWebhookRoute
