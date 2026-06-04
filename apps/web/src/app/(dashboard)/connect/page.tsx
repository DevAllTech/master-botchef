import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { redirect } from 'next/navigation'
import { QRCodeClient } from './qrcode-client'

export default async function ConnectPage() {
  const token = await getToken()
  if (!token) redirect('/login')

  const { connected } = await api.whatsapp.status(token).catch(() => ({ connected: false, hasInstance: false }))

  if (connected) {
    redirect('/conversations')
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Conectar WhatsApp</h1>
      <p className="mb-6 text-sm text-gray-500">
        Escaneie o QR Code abaixo com o seu WhatsApp Business para conectar a plataforma.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <QRCodeClient token={token} />
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-amber-800">Boas práticas para evitar bloqueios</h3>
        <ul className="space-y-1 text-sm text-amber-700">
          <li>• Use exclusivamente o <strong>WhatsApp Business</strong>, não o pessoal.</li>
          <li>• Certifique-se de que o número tem pelo menos 30 dias de uso ativo.</li>
          <li>• Não envie mensagens em massa ou spam.</li>
          <li>• Mantenha uma taxa de resposta alta para o seu número.</li>
          <li>• Use templates aprovados para comunicações em escala.</li>
        </ul>
      </div>
    </div>
  )
}
