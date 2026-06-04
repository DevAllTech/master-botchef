import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    sign: { expiresIn: '7d' },
  })

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()

        // Bloqueia clientes inativos mesmo com token válido
        const { prisma } = await import('../lib/prisma.js')
        const user = await prisma.user.findUnique({
          where: { id: request.user.id },
          select: { active: true },
        })
        if (!user?.active) {
          return reply.status(403).send({ error: 'Conta desativada. Entre em contato com o suporte.' })
        }
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode) throw err
        reply.status(401).send({ error: 'Não autenticado.' })
      }
    },
  )

  fastify.decorate(
    'authenticateAdmin',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()

        if (request.user.role !== 'ADMIN') {
          return reply.status(403).send({ error: 'Acesso restrito a administradores.' })
        }
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode) throw err
        reply.status(401).send({ error: 'Não autenticado.' })
      }
    },
  )
}

export default fp(jwtPlugin)
