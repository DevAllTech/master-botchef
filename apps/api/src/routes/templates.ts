import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { TEMPLATE_TRIGGERS } from '@botchef/types'

const templateBody = z.object({
  name: z.string().min(1).max(100),
  body: z.string().min(1),
  trigger: z.enum([...TEMPLATE_TRIGGERS]).optional().nullable(),
})

const templatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/templates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const templates = await prisma.template.findMany({
        where: { userId: request.user.id },
        orderBy: { createdAt: 'asc' },
      })

      return reply.send({ templates })
    },
  )

  fastify.post(
    '/templates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = templateBody.safeParse(request.body)

      if (!result.success) {
        return reply.status(400).send({ error: 'Dados inválidos.', details: result.error.flatten() })
      }

      const template = await prisma.template.create({
        data: {
          ...result.data,
          userId: request.user.id,
        },
      })

      return reply.status(201).send({ template })
    },
  )

  fastify.put(
    '/templates/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = templateBody.safeParse(request.body)

      if (!result.success) {
        return reply.status(400).send({ error: 'Dados inválidos.', details: result.error.flatten() })
      }

      const existing = await prisma.template.findFirst({
        where: { id, userId: request.user.id },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Template não encontrado.' })
      }

      const template = await prisma.template.update({
        where: { id },
        data: result.data,
      })

      return reply.send({ template })
    },
  )

  fastify.delete(
    '/templates/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const existing = await prisma.template.findFirst({
        where: { id, userId: request.user.id },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Template não encontrado.' })
      }

      await prisma.template.delete({ where: { id } })

      return reply.status(204).send()
    },
  )
}

export default templatesRoutes
