import type { TemplateTrigger } from '@botchef/types'

export interface TemplateVars {
  nome?: string
  status?: string
  pedido?: string
  telefone?: string
  restaurante?: string
  [key: string]: string | undefined
}

export const DEFAULT_TEMPLATES: Partial<Record<TemplateTrigger, string>> = {
  order_created: `🎉 *Olá, {{nome}}! Seu pedido foi realizado com sucesso!*
Você será notificado sobre o andamento por aqui. 😊

📍 *Endereço de Entrega:*
- Rua: {{rua}}
- Ponto de Ref.: {{ponto_ref}}
- Bairro: {{bairro}}
- Cidade: {{cidade}}

🗒️ *Resumo do Pedido:*
- Código: {{pedido}}
- Nome: {{nome}}
- Data do Pedido: {{data_pedido}}
- Taxa de Entrega: {{taxa_entrega}}
- Previsão de Entrega: {{previsao_entrega}}

🛒 *Itens do Pedido:*
{{itens}}

💰 *Forma de Pagamento:* {{forma_pagamento}}
*{{info_pagamento}}*

✅ *Total:* {{total}}`,
  order_confirmed:  'Boa notícia! Seu pedido #{{pedido}} foi confirmado e logo começará a ser preparado.',
  order_preparing:  'Seu pedido #{{pedido}} já está em preparo! Em breve avisamos por aqui. 🚀',
  order_ready:      'Seu pedido #{{pedido}} está pronto para retirada! Pode vir buscar. 🎉',
  order_delivering: 'Seu pedido #{{pedido}} saiu para entrega e está a caminho! 🛵',
  order_delivered:  'Seu pedido #{{pedido}} foi entregue. Obrigado pela preferência! ❤️',
  order_cancelled:  'Seu pedido #{{pedido}} foi cancelado. Em caso de dúvidas, entre em contato conosco.',
  welcome:          'Olá, {{nome}}! 👋 Seja bem-vindo(a)! Em que posso ajudar?',
}

const GENERIC_DEFAULT = 'Atualização do seu pedido #{{pedido}}: {{status}}.'

export function resolveTemplateBody(customBody: string | null | undefined, status: string): string {
  if (customBody) return customBody
  return DEFAULT_TEMPLATES[status as TemplateTrigger] ?? GENERIC_DEFAULT
}

export function interpolate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
