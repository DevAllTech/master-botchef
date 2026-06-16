import { getToken } from '@/lib/auth'
import { api, type Conversation } from '@/lib/api'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { formatDistanceToNow } from './utils'
import { formatPhone } from '@/lib/phone'

export default async function ConversationsPage() {
  const token = await getToken()
  if (!token) redirect('/login')

  const { conversations } = await api.conversations.list(token).catch(() => ({ conversations: [] as Conversation[] }))

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conversas</h1>
          <p className="text-sm text-gray-500">{conversations.length} contato(s) com mensagem recente</p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {conversations.map((conv) => (
              <ConversationItem key={conv.id} conversation={conv} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const { phone, lastMessage, lastMessageAt, direction } = conversation

  return (
    <li className="flex items-start gap-4 px-4 py-4 hover:bg-gray-50">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
        <MessageSquare className="h-5 w-5 text-green-600" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900">{formatPhone(phone)}</span>
          <div className="flex items-center gap-2">
            {direction && (
              <Badge variant={direction === 'sent' ? 'sent' : 'received'}>
                {direction === 'sent' ? (
                  <><ArrowUpRight className="mr-1 h-3 w-3" />Enviada</>
                ) : (
                  <><ArrowDownLeft className="mr-1 h-3 w-3" />Recebida</>
                )}
              </Badge>
            )}
            {lastMessageAt && (
              <span className="whitespace-nowrap text-xs text-gray-400">
                {formatDistanceToNow(lastMessageAt)}
              </span>
            )}
          </div>
        </div>
        {lastMessage && (
          <p className="mt-0.5 truncate text-sm text-gray-500">{lastMessage}</p>
        )}
      </div>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
      <MessageSquare className="mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">Nenhuma conversa ainda</p>
      <p className="mt-1 text-xs text-gray-400">
        As conversas aparecerão aqui quando o WhatsApp receber ou enviar mensagens.
      </p>
    </div>
  )
}

