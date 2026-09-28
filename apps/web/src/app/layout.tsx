import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BotChef — Atendimento via WhatsApp',
  description: 'Plataforma de atendimento via WhatsApp integrada ao MenuChef',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (e.g. BRy Web PKI) inject attributes into <html>/<body>
    // before hydration; this only silences attribute mismatches on these two tags.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
