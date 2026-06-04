import '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Declara o formato do payload JWT para o @fastify/jwt
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: 'ADMIN' | 'CLIENT' }
    user: { id: string; email: string; role: 'ADMIN' | 'CLIENT' }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>
    authenticateAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>
  }
}
