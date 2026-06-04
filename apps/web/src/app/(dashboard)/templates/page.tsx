import { getToken } from '@/lib/auth'
import { api, type Template } from '@/lib/api'
import { redirect } from 'next/navigation'
import { TemplatesClient } from './templates-client'

export default async function TemplatesPage() {
  const token = await getToken()
  if (!token) redirect('/login')

  const { templates } = await api.templates.list(token).catch(() => ({ templates: [] as Template[] }))

  return <TemplatesClient initialTemplates={templates} />
}
