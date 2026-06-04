import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    const result = loginBody.safeParse(request.body)

    if (!result.success) {
      return reply.status(400).send({ error: 'Dados inválidos.', details: result.error.flatten() })
    }

    const { email, password } = result.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' })
    }

    if (!user.active) {
      return reply.status(403).send({ error: 'Conta desativada. Entre em contato com o suporte.' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)

    if (!valid) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' })
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role })

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        connected: user.connected,
      },
    })
  })

  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { id: true, email: true, name: true, role: true, connected: true },
      })

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado.' })
      }

      return reply.send({ user })
    },
  )
}

export default authRoutes
