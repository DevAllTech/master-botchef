import fp from 'fastify-plugin'
import fastifyCors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'

// WEB_URL aceita mais de uma origem separada por vírgula, por exemplo o painel
// de produção e o preview de homologação da Vercel:
//   WEB_URL=https://bot.menuchef.com.br,https://botchef-git-homolog-devall.vercel.app
// Comparação exata, sem curinga: um preview qualquer da Vercel não entra.
export function parseAllowedOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return origins.length > 0 ? origins : ['http://localhost:3000']
}

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyCors, {
    origin: parseAllowedOrigins(process.env.WEB_URL),
    credentials: true,
    // PATCH é usado pelo painel admin (status, sufixo e senha do cliente);
    // sem ele o navegador bloqueava essas chamadas no preflight.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
}

export default fp(corsPlugin)
