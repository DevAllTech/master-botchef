import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BotChef — Atendimento via WhatsApp',
  description: 'Plataforma de atendimento via WhatsApp integrada ao MenuChef',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  )
}
