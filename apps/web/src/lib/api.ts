import type { TemplateTrigger } from '@botchef/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? res.statusText)
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: (token: string) =>
      apiFetch<{ user: User }>('/auth/me', {}, token),
  },

  whatsapp: {
    status: (token: string) =>
      apiFetch<{ connected: boolean; hasInstance: boolean }>('/whatsapp/status', {}, token),

    qrcode: (token: string) =>
      apiFetch<{ connected: boolean; qrcode: string | null }>('/whatsapp/qrcode', {}, token),

    disconnect: (token: string) =>
      apiFetch<{ ok: boolean }>('/whatsapp/disconnect', { method: 'POST' }, token),
  },

  conversations: {
    list: (token: string) =>
      apiFetch<{ conversations: Conversation[] }>('/conversations', {}, token),
  },

  templates: {
    list: (token: string) =>
      apiFetch<{ templates: Template[] }>('/templates', {}, token),

    create: (token: string, data: TemplateInput) =>
      apiFetch<{ template: Template }>('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }, token),

    update: (token: string, id: string, data: TemplateInput) =>
      apiFetch<{ template: Template }>(`/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }, token),

    remove: (token: string, id: string) =>
      apiFetch<void>(`/templates/${id}`, { method: 'DELETE' }, token),
  },

  admin: {
    listClients: (token: string) =>
      apiFetch<{ clients: ClientUser[] }>('/admin/clients', {}, token),

    createClient: (token: string, data: { name: string; email: string; password: string; menuChefSuffix?: string }) =>
      apiFetch<{ client: ClientUser }>('/admin/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }, token),

    setStatus: (token: string, id: string, active: boolean) =>
      apiFetch<{ client: ClientUser }>(`/admin/clients/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }, token),

    resetPassword: (token: string, id: string, password: string) =>
      apiFetch<{ ok: boolean }>(`/admin/clients/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }, token),

    updateSuffix: (token: string, id: string, menuChefSuffix: string | null) =>
      apiFetch<{ client: { id: string; name: string; menuChefSuffix: string | null } }>(
        `/admin/clients/${id}/suffix`,
        { method: 'PATCH', body: JSON.stringify({ menuChefSuffix }) },
        token,
      ),

    checkSuffix: (token: string, suffix: string) =>
      apiFetch<{ valid: boolean }>(
        `/admin/check-suffix?suffix=${encodeURIComponent(suffix)}`,
        {},
        token,
      ),
  },
}

export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'CLIENT'
  connected: boolean
}

export interface ClientUser {
  id: string
  name: string
  email: string
  active: boolean
  connected: boolean
  createdAt: string
  instanceId: string | null
  menuChefSuffix: string | null
}

export interface Conversation {
  id: string
  phone: string
  lastMessage: string | null
  lastMessageAt: string | null
  direction: 'sent' | 'received' | null
}

export interface Template {
  id: string
  name: string
  body: string
  trigger: string | null
  createdAt: string
  updatedAt: string
}

export interface TemplateInput {
  name: string
  body: string
  trigger?: TemplateTrigger | null
}
