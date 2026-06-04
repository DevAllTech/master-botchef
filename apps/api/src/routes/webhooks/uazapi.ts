import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { MenuChefService } from '../../services/menuchef.js'

/**
 * Formato real dos eventos webhook do UazapiGO.
 *
 * Autenticação: o token da instância vem no BODY (campo `token`),
 * não em header. O UazapiGO não envia x-instance-token.
 */
interface UazapiWebhookBody {
  EventType: 'connection' | 'messages' | string
  instanceName?: string
  token?: string               // token da instância — usado para identificar o usuário
  instance?: {
    status?: string            // "connected" | "disconnected" | "connecting"
    qrcode?: string
  }
  message?: {
    chatid?: string            // ex: "5518997922950@s.whatsapp.net" ou "120363...@g.us"
    text?: string              // texto da mensagem (atalho)
    content?: {
      text?: string            // texto alternativo dentro de content
    }
    fromMe?: boolean           // true = mensagem enviada pela nossa instância
    isGroup?: boolean
    sender?: string
    senderName?: string
    messageType?: string
  }
}

const uazapiWebhookRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhooks/uazapi', async (request, reply) => {
    const body = request.body as UazapiWebhookBody

    // O UazapiGO envia o token da instância no corpo do evento
    const instanceToken = body.token

    if (!instanceToken) {
      fastify.log.warn('Webhook Uazapi recebido sem token no body')
      return reply.send({ ok: true }) // não rejeitar — pode ser evento de setup
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

      // Ao conectar (ou reconectar), re-registra o token no MenuChef
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

      // Ignorar mensagens de grupos
      if (msg.isGroup) {
        return reply.send({ ok: true })
      }

      const chatid = msg.chatid ?? ''
      const phone = chatid.split('@')[0]

      if (!phone) {
        return reply.send({ ok: true })
      }

      const messageText = msg.text ?? msg.content?.text ?? '(mensagem recebida)'
      const direction = msg.fromMe ? 'sent' : 'received'

      await prisma.conversation.upsert({
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

      return reply.send({ ok: true })
    }

    return reply.send({ ok: true })
  })
}

export default uazapiWebhookRoute
