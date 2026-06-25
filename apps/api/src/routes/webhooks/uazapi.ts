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
              .then(() =>
                prisma.conversation.update({
                  where: { id: conversation.id },
                  data: { lastWelcomeAt: new Date() },
                }).catch((err) => fastify.log.error({ err, phone }, 'Falha ao atualizar lastWelcomeAt após boas-vindas')),
              )
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
