import Fastify from 'fastify'
import fastifySensible from '@fastify/sensible'
import corsPlugin from './plugins/cors.js'
import jwtPlugin from './plugins/jwt.js'
import authRoutes from './routes/auth.js'
import whatsappRoutes from './routes/whatsapp.js'
import conversationsRoutes from './routes/conversations.js'
import templatesRoutes from './routes/templates.js'
import uazapiWebhookRoute from './routes/webhooks/uazapi.js'
import menuChefWebhookRoute from './routes/webhooks/menuchef.js'
import adminRoutes from './routes/admin.js'

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  app.register(fastifySensible)
  app.register(corsPlugin)
  app.register(jwtPlugin)

  app.register(authRoutes)
  app.register(whatsappRoutes)
  app.register(conversationsRoutes)
  app.register(templatesRoutes)
  app.register(uazapiWebhookRoute)
  app.register(menuChefWebhookRoute)
  app.register(adminRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
