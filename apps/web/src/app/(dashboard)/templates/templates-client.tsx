'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { TemplateForm } from './template-form'
import { createTemplate, updateTemplate, deleteTemplate } from './actions'
import type { Template } from '@/lib/api'
import { LayoutTemplate, Pencil, Trash2, Plus, X } from 'lucide-react'

interface TemplatesClientProps {
  initialTemplates: Template[]
}

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este template?')) return
    startTransition(async () => {
      await deleteTemplate(id)
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Templates de Resposta</h1>
          <p className="text-sm text-gray-500">{initialTemplates.length} template(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Novo template
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Novo template</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <TemplateForm action={createTemplate} onSuccess={() => setShowCreate(false)} />
        </div>
      )}

      {initialTemplates.length === 0 && !showCreate ? (
        <EmptyState onNew={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-3">
          {initialTemplates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {editingId === template.id ? (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Editar template</h2>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <TemplateForm
                    action={updateTemplate}
                    template={template}
                    onSuccess={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50">
                    <LayoutTemplate className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{template.name}</p>
                        {template.trigger && (
                          <span className="mt-0.5 inline-block rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700">
                            {template.trigger}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(template.id)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                          disabled={isPending}
                          className="hover:bg-red-50 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{template.body}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
      <LayoutTemplate className="mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">Nenhum template cadastrado</p>
      <p className="mt-1 text-xs text-gray-400 mb-4">
        Crie templates para disparar mensagens automáticas quando o status do pedido mudar.
      </p>
      <Button size="sm" onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" />
        Criar primeiro template
      </Button>
    </div>
  )
}
