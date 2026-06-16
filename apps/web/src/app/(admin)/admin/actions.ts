'use server'

import { revalidatePath } from 'next/cache'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export async function createClientAction(_: unknown, formData: FormData) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = (formData.get('password') as string)
  const menuChefSuffix = (formData.get('menuChefSuffix') as string)?.trim() || undefined

  if (!name || !email || !password) return { error: 'Preencha todos os campos.' }
  if (password.length < 6) return { error: 'A senha deve ter pelo menos 6 caracteres.' }

  try {
    await api.admin.createClient(token, { name, email, password, menuChefSuffix })
    revalidatePath('/admin')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar cliente.'
    return { error: message }
  }
}

export async function updateClientSuffix(_: unknown, formData: FormData) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  const id = formData.get('id') as string
  const menuChefSuffix = (formData.get('menuChefSuffix') as string)?.trim() || null

  try {
    await api.admin.updateSuffix(token, id, menuChefSuffix)
    revalidatePath('/admin')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar chave MenuChef.'
    return { error: message }
  }
}

export async function checkSuffixAction(suffix: string): Promise<{ valid?: boolean; error?: string }> {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }
  try {
    return await api.admin.checkSuffix(token, suffix)
  } catch {
    return { error: 'Erro ao verificar suffix.' }
  }
}

export async function toggleClientStatus(id: string, active: boolean) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  try {
    await api.admin.setStatus(token, id, active)
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Erro ao atualizar status.' }
  }
}

export async function resetClientPassword(_: unknown, formData: FormData) {
  const token = await getToken()
  if (!token) return { error: 'Não autenticado.' }

  const id = formData.get('id') as string
  const password = formData.get('password') as string

  if (!password || password.length < 6) return { error: 'A senha deve ter pelo menos 6 caracteres.' }

  try {
    await api.admin.resetPassword(token, id, password)
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Erro ao redefinir senha.' }
  }
}
