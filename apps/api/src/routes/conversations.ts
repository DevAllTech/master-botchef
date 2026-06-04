import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

const conversationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/conversations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const conversations = await prisma.conversation.findMany({
        where: { userId: request.user.id },
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true,
          phone: true,
          lastMessage: true,
          lastMessageAt: true,
          direction: true,
        },
      })

      return reply.send({ conversations })
    },
  )
}

export default conversationsRoutes
