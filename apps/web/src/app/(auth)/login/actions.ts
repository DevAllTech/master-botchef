'use server'

import { redirect } from 'next/navigation'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'

export async function loginAction(_: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Preencha todos os campos.' }
  }

  // redirect() do Next.js lança uma exceção internamente — não pode ficar dentro
  // do try/catch, senão é capturada e nunca redireciona.
  let role: 'ADMIN' | 'CLIENT'

  try {
    const { token, user } = await api.auth.login(email, password)
    await setToken(token)
    role = user.role
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao fazer login.'
    return { error: message }
  }

  redirect(role === 'ADMIN' ? '/admin' : '/conversations')
}
