import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { UazapiService, UazapiInstanceNotFoundError } from '../services/uazapi.js'
import { MenuChefService } from '../services/menuchef.js'

const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/whatsapp/status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { connected: true, instanceId: true, instanceToken: true },
      })

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado.' })
      }

      if (!user.instanceToken) {
        return reply.send({ connected: false, hasInstance: false })
      }

      try {
        const status = await UazapiService.getStatus(user.instanceToken)

        if (status.connected !== user.connected) {
          await prisma.user.update({
            where: { id: request.user.id },
            data: { connected: status.connected },
          })
        }

        return reply.send({ connected: status.connected, hasInstance: true })
      } catch {
        return reply.send({ connected: user.connected, hasInstance: true })
      }
    },
  )

  fastify.get(
    '/whatsapp/qrcode',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const uazapiConfigured = !!(process.env.UAZAPI_BASE_URL && process.env.UAZAPI_GLOBAL_TOKEN)

      if (!uazapiConfigured) {
        return reply.status(503).send({
          error: 'Uazapi não configurado. Defina UAZAPI_BASE_URL e UAZAPI_GLOBAL_TOKEN no servidor.',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
      })

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado.' })
      }

      if (user.connected) {
        return reply.send({ connected: true, qrcode: null })
      }

      try {
        if (!user.instanceToken || !user.instanceId) {
          const webhookUrl = `${process.env.API_PUBLIC_URL ?? 'http://localhost:3001'}/webhooks/uazapi`
          // Usa o id do usuário como nome único da instância
          const instance = await UazapiService.createInstance(`botchef-${user.id}`, webhookUrl)

          await prisma.user.update({
            where: { id: user.id },
            data: {
              instanceId: instance.instanceId,
              instanceToken: instance.instanceToken,
            },
          })

          // Registra o token no MenuChef se o usuário tiver suffix configurado
          if (user.menuChefSuffix) {
            MenuChefService.registerToken(user.menuChefSuffix, instance.instanceToken).catch((err) =>
              fastify.log.error({ err }, 'Falha ao registrar token no MenuChef após criação de instância'),
            )
          }

          const qr = await UazapiService.getQRCode(instance.instanceToken)
          return reply.send({ connected: false, qrcode: qr.qrcode })
        }

        const qr = await UazapiService.getQRCode(user.instanceToken)

        if (qr.connected) {
          await prisma.user.update({
            where: { id: user.id },
            data: { connected: true },
          })

          // Re-registra no MenuChef ao confirmar reconexão (token pode ter sido renovado)
          if (user.menuChefSuffix) {
            MenuChefService.registerToken(user.menuChefSuffix, user.instanceToken).catch((err) =>
              fastify.log.error({ err }, 'Falha ao re-registrar token no MenuChef após reconexão'),
            )
          }
        }

        return reply.send({ connected: qr.connected, qrcode: qr.connected ? null : qr.qrcode })
      } catch (err) {
        if (err instanceof UazapiInstanceNotFoundError) {
          fastify.log.warn({ userId: user.id }, 'Instância Uazapi expirada — recriando')

          await prisma.user.update({
            where: { id: user.id },
            data: { instanceId: null, instanceToken: null, connected: false },
          })

          const webhookUrl = `${process.env.API_PUBLIC_URL ?? 'http://localhost:3001'}/webhooks/uazapi`
          const instance = await UazapiService.createInstance(`botchef-${user.id}`, webhookUrl)

          await prisma.user.update({
            where: { id: user.id },
            data: { instanceId: instance.instanceId, instanceToken: instance.instanceToken },
          })

          if (user.menuChefSuffix) {
            MenuChefService.registerToken(user.menuChefSuffix, instance.instanceToken).catch((e) =>
              fastify.log.error({ err: e }, 'Falha ao registrar token no MenuChef após recriação de instância'),
            )
          }

          const qr = await UazapiService.getQRCode(instance.instanceToken)
          return reply.send({ connected: false, qrcode: qr.qrcode })
        }

        const message = err instanceof Error ? err.message : 'Erro ao comunicar com o Uazapi.'
        fastify.log.error({ err }, 'Erro na rota /whatsapp/qrcode')
        return reply.status(502).send({
          error: `Não foi possível conectar ao Uazapi: ${message}`,
        })
      }
    },
  )

  fastify.post(
    '/whatsapp/disconnect',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { instanceToken: true },
      })

      if (!user?.instanceToken) {
        return reply.status(400).send({ error: 'Instância não encontrada.' })
      }

      try {
        await UazapiService.disconnectInstance(user.instanceToken)
      } catch {
        // ignora erro de desconexão no provedor
      }

      await prisma.user.update({
        where: { id: request.user.id },
        data: { connected: false },
      })

      return reply.send({ ok: true })
    },
  )
}

export default whatsappRoutes
