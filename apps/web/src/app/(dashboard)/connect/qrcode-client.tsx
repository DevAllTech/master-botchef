'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, CheckCircle2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QRCodeClientProps {
  token: string
}

export function QRCodeClient({ token }: QRCodeClientProps) {
  const router = useRouter()
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/whatsapp/qrcode`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao buscar QR Code')
      }

      const data: { connected: boolean; qrcode: string | null } = await res.json()

      if (data.connected) {
        setConnected(true)
        setTimeout(() => router.push('/conversations'), 1500)
        return
      }

      setQrcode(data.qrcode)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o QR Code.')
    } finally {
      setLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    fetchQR()

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/whatsapp/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data: { connected: boolean } = await res.json()

        if (data.connected) {
          setConnected(true)
          clearInterval(interval)
          setTimeout(() => router.push('/conversations'), 1500)
        }
      } catch {
        // ignora erros de polling silenciosamente
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchQR, token, router])

  if (connected) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle2 className="h-12 w-12 text-green-600" />
        <p className="text-sm font-medium text-green-700">WhatsApp conectado! Redirecionando...</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="text-sm text-gray-500">Gerando QR Code...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-center text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchQR}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {qrcode ? (
        <>
          <div className="rounded-lg border border-gray-200 p-3">
            <Image
              src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
              alt="QR Code WhatsApp"
              width={256}
              height={256}
              className="rounded"
              unoptimized
            />
          </div>
          <p className="text-center text-xs text-gray-500">
            Abra o WhatsApp Business → Menu → Aparelhos conectados → Conectar aparelho
          </p>
          <Button variant="ghost" size="sm" onClick={fetchQR}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar QR Code
          </Button>
        </>
      ) : (
        <p className="py-8 text-sm text-gray-500">QR Code não disponível.</p>
      )}
    </div>
  )
}
