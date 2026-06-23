export interface UserDTO {
  id: string
  email: string
  name: string
  connected: boolean
}

export interface ConversationDTO {
  id: string
  phone: string
  lastMessage: string | null
  lastMessageAt: string | null
  direction: 'sent' | 'received' | null
}

export const TEMPLATE_TRIGGERS = [
  'order_created',
  'order_confirmed',
  'order_preparing',
  'order_ready',
  'order_delivering',
  'order_delivered',
  'order_cancelled',
  'welcome',
] as const

export type TemplateTrigger = typeof TEMPLATE_TRIGGERS[number]

export interface TemplateDTO {
  id: string
  name: string
  body: string
  trigger: TemplateTrigger | null
  createdAt: string
  updatedAt: string
}

export interface MenuChefCallbackPayload {
  orderId: string
  orderNumber?: string
  status: string
  phone: string
  customerName?: string
  suffix?: string
  // Campos exclusivos do evento order_created
  deliveryStreet?: string       // → {{rua}}
  deliveryReference?: string    // → {{ponto_ref}}
  deliveryNeighborhood?: string // → {{bairro}}
  deliveryCity?: string         // → {{cidade}}
  orderDate?: string            // → {{data_pedido}}
  deliveryFee?: string          // → {{taxa_entrega}}
  estimatedDelivery?: string    // → {{previsao_entrega}}
  items?: string                // → {{itens}} (string pré-formatada pelo MenuChef)
  paymentMethod?: string        // → {{forma_pagamento}}
  paymentNote?: string          // → {{info_pagamento}}
  total?: string                // → {{total}}
}

export interface UazapiWebhookPayload {
  event: 'connection.update' | 'messages.upsert' | string
  instanceId?: string
  data?: {
    connected?: boolean
    phone?: string
    key?: { remoteJid?: string }
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
    }
  }
}
