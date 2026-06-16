'use client'

import { useState, useTransition, useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClientAction, toggleClientStatus, resetClientPassword, updateClientSuffix, checkSuffixAction } from './actions'
import type { ClientUser } from '@/lib/api'
import {
  Plus, X, Wifi, WifiOff, KeyRound, UserX, UserCheck, AlertCircle, Users, Hash,
  CheckCircle2, XCircle, Loader2,
} from 'lucide-react'

export function ClientsPanel({ initialClients }: { initialClients: ClientUser[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [suffixTargetId, setSuffixTargetId] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">{initialClients.length} cliente(s) cadastrado(s)</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Novo cliente</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <CreateClientForm onSuccess={() => setShowCreate(false)} />
        </div>
      )}

      {initialClients.length === 0 && !showCreate ? (
        <EmptyState onNew={() => setShowCreate(true)} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialClients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onResetPassword={() => setResetTargetId(client.id)}
                  onEditSuffix={() => setSuffixTargetId(client.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTargetId && (
        <ResetPasswordModal
          clientId={resetTargetId}
          clientName={initialClients.find((c) => c.id === resetTargetId)?.name ?? ''}
          onClose={() => setResetTargetId(null)}
        />
      )}

      {suffixTargetId && (
        <EditSuffixModal
          clientId={suffixTargetId}
          clientName={initialClients.find((c) => c.id === suffixTargetId)?.name ?? ''}
          currentSuffix={initialClients.find((c) => c.id === suffixTargetId)?.menuChefSuffix ?? null}
          onClose={() => setSuffixTargetId(null)}
        />
      )}
    </div>
  )
}

function ClientRow({ client, onResetPassword, onEditSuffix }: { client: ClientUser; onResetPassword: () => void; onEditSuffix: () => void }) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    startTransition(async () => {
      await toggleClientStatus(client.id, !client.active)
    })
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{client.name}</p>
        <p className="text-xs text-gray-400">{client.email}</p>
        <p className="text-xs text-gray-400">MenuChef: {client.menuChefSuffix ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        {client.connected ? (
          <Badge variant="connected">
            <Wifi className="mr-1 h-3 w-3" />Conectado
          </Badge>
        ) : (
          <Badge variant="disconnected">
            <WifiOff className="mr-1 h-3 w-3" />Desconectado
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {client.active ? (
          <Badge variant="connected">Ativo</Badge>
        ) : (
          <Badge variant="disconnected">Bloqueado</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {new Date(client.createdAt).toLocaleDateString('pt-BR')}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Editar chave MenuChef"
            onClick={onEditSuffix}
          >
            <Hash className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Redefinir senha"
            onClick={onResetPassword}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={client.active ? 'Bloquear cliente' : 'Ativar cliente'}
            onClick={handleToggle}
            disabled={isPending}
            className={client.active ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-green-50 hover:text-green-600'}
          >
            {client.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function CreateClientForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, isPending] = useActionState(createClientAction, undefined)

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state?.success]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state?.success) return null

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {state?.error && (
        <div className="col-span-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {state.error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do restaurante</Label>
        <Input id="name" name="name" placeholder="Restaurante Exemplo" required disabled={isPending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail de acesso</Label>
        <Input id="email" name="email" type="email" placeholder="contato@restaurante.com" required disabled={isPending} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="password">Senha inicial</Label>
        <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" required disabled={isPending} />
        <p className="text-xs text-gray-400">O cliente poderá alterar a senha após o primeiro acesso.</p>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="menuChefSuffix">Chave do contrato MenuChef <span className="text-gray-400">(opcional)</span></Label>
        <Input id="menuChefSuffix" name="menuChefSuffix" placeholder="ex: meu-restaurante" disabled={isPending} />
        <p className="text-xs text-gray-400">Identificador do restaurante na plataforma MenuChef.</p>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Criando...' : 'Criar cliente'}
        </Button>
      </div>
    </form>
  )
}

function ResetPasswordModal({ clientId, clientName, onClose }: {
  clientId: string
  clientName: string
  onClose: () => void
}) {
  const [state, action, isPending] = useActionState(resetClientPassword, undefined)

  useEffect(() => {
    if (state?.success) onClose()
  }, [state?.success]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state?.success) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Redefinir senha</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Nova senha para <strong>{clientName}</strong>:
        </p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={clientId} />
          {state?.error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {state.error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">Nova senha</Label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              required
              disabled={isPending}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditSuffixModal({ clientId, clientName, currentSuffix, onClose }: {
  clientId: string
  clientName: string
  currentSuffix: string | null
  onClose: () => void
}) {
  const [state, action, isPending] = useActionState(updateClientSuffix, undefined)
  const [suffixValue, setSuffixValue] = useState(currentSuffix ?? '')
  const [testResult, setTestResult] = useState<'valid' | 'invalid' | 'error' | null>(null)
  const [isTesting, startTestTransition] = useTransition()

  useEffect(() => {
    if (state?.success) onClose()
  }, [state?.success]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTest = () => {
    if (!suffixValue.trim()) return
    setTestResult(null)
    startTestTransition(async () => {
      const result = await checkSuffixAction(suffixValue.trim())
      if (result.error) setTestResult('error')
      else setTestResult(result.valid ? 'valid' : 'invalid')
    })
  }

  if (state?.success) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Chave MenuChef</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Chave do contrato MenuChef de <strong>{clientName}</strong>:
        </p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={clientId} />
          {state?.error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {state.error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="edit-suffix">Chave do contrato</Label>
            <div className="flex gap-2">
              <Input
                id="edit-suffix"
                name="menuChefSuffix"
                placeholder="ex: meu-restaurante"
                value={suffixValue}
                onChange={(e) => { setSuffixValue(e.target.value); setTestResult(null) }}
                disabled={isPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting || !suffixValue.trim() || isPending}
                className="shrink-0"
              >
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar'}
              </Button>
            </div>
            {testResult === 'valid' && (
              <p className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Suffix válido no MenuChef
              </p>
            )}
            {testResult === 'invalid' && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <XCircle className="h-3 w-3" /> Suffix não encontrado no MenuChef
              </p>
            )}
            {testResult === 'error' && (
              <p className="flex items-center gap-1 text-xs text-yellow-600">
                <AlertCircle className="h-3 w-3" /> Erro ao verificar. Tente novamente.
              </p>
            )}
            <p className="text-xs text-gray-400">Deixe em branco para remover o vínculo.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
      <Users className="mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">Nenhum cliente cadastrado</p>
      <p className="mt-1 text-xs text-gray-400 mb-4">
        Crie o acesso do cliente para que ele possa conectar o WhatsApp e usar a plataforma.
      </p>
      <Button size="sm" onClick={onNew}>
        <Plus className="mr-2 h-4 w-4" />
        Criar primeiro cliente
      </Button>
    </div>
  )
}
