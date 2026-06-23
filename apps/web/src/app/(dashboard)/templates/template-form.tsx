'use client'

import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle } from 'lucide-react'
import type { Template } from '@/lib/api'
import { TEMPLATE_TRIGGERS } from '@botchef/types'

const TEMPLATE_VARS = ['{{nome}}', '{{restaurante}}', '{{pedido}}', '{{status}}', '{{telefone}}', '{{rua}}', '{{ponto_ref}}', '{{bairro}}', '{{cidade}}', '{{data_pedido}}', '{{taxa_entrega}}', '{{previsao_entrega}}', '{{itens}}', '{{forma_pagamento}}', '{{info_pagamento}}', '{{total}}']

const TRIGGER_LABELS: Record<typeof TEMPLATE_TRIGGERS[number], string> = {
  order_created:   'Pedido realizado',
  order_confirmed: 'Pedido confirmado',
  order_preparing: 'Pedido em preparo',
  order_ready:     'Pronto para retirada',
  order_delivering:'Pedido em entrega (delivery)',
  order_delivered: 'Pedido entregue',
  order_cancelled: 'Pedido cancelado',
  welcome:         'Boas-vindas (início de conversa)',
}

const TRIGGER_OPTIONS = [
  { value: '', label: 'Nenhum (manual)' },
  ...TEMPLATE_TRIGGERS.map((t) => ({ value: t, label: TRIGGER_LABELS[t] })),
]

interface TemplateFormProps {
  action: (state: unknown, formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>
  template?: Template
  onSuccess?: () => void
}

export function TemplateForm({ action, template, onSuccess }: TemplateFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)

  useEffect(() => {
    if (state?.success) {
      onSuccess?.()
    }
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      {template && <input type="hidden" name="id" value={template.id} />}

      {state?.error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do template</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Pedido Confirmado"
          defaultValue={template?.name}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trigger">Gatilho</Label>
        <select
          id="trigger"
          name="trigger"
          defaultValue={template?.trigger ?? ''}
          disabled={isPending}
          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50"
        >
          {TRIGGER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">
          Define quando este template será disparado automaticamente.
          <br />
          <span className="text-gray-500">
            "Boas-vindas" dispara quando o cliente inicia uma nova conversa (cooldown de 5 horas) · "Pronto para retirada" = cliente busca no balcão · "Em entrega (delivery)" = motoboy a caminho
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Mensagem</Label>
        <Textarea
          id="body"
          name="body"
          rows={4}
          placeholder="Ex: Olá {{nome}}! Seu pedido #{{pedido}} foi confirmado. ✅"
          defaultValue={template?.body}
          required
          disabled={isPending}
        />
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_VARS.map((v) => (
            <span
              key={v}
              className="cursor-default rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600"
              title={`Variável disponível: ${v}`}
            >
              {v}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">Use as variáveis acima para personalizar a mensagem.</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : template ? 'Salvar alterações' : 'Criar template'}
        </Button>
      </div>
    </form>
  )
}
