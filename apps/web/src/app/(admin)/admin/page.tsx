import { redirect } from 'next/navigation'
import { getToken } from '@/lib/auth'
import { api, type ClientUser } from '@/lib/api'
import { ClientsPanel } from './clients-client'

export default async function AdminPage() {
  const token = await getToken()
  if (!token) redirect('/login')

  const { clients } = await api.admin
    .listClients(token)
    .catch(() => ({ clients: [] as ClientUser[] }))

  return <ClientsPanel initialClients={clients} />
}
