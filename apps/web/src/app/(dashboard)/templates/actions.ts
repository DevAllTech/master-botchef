'use server'

import { revalidatePath } from 'next/cache'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import type { TemplateTrigger } from '@botchef/types'

export async function createTemplate(_: unknown, formData: FormData) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const trigger = ((formData.get('trigger') as string)?.trim() || null) as TemplateTrigger | null

  if (!name || !body) return { error: 'Nome e mensagem são obrigatórios.' }

  try {
    await api.templates.create(token, { name, body, trigger })
    revalidatePath('/templates')
    return { success: true }
  } catch {
    return { error: 'Erro ao criar template.' }
  }
}

export async function updateTemplate(_: unknown, formData: FormData) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const trigger = ((formData.get('trigger') as string)?.trim() || null) as TemplateTrigger | null

  if (!id || !name || !body) return { error: 'Dados inválidos.' }

  try {
    await api.templates.update(token, id, { name, body, trigger })
    revalidatePath('/templates')
    return { success: true }
  } catch {
    return { error: 'Erro ao atualizar template.' }
  }
}

export async function deleteTemplate(id: string) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  try {
    await api.templates.remove(token, id)
    revalidatePath('/templates')
    return { success: true }
  } catch {
    return { error: 'Erro ao excluir template.' }
  }
}
