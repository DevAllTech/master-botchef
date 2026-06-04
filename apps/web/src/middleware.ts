import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login']

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = Buffer.from(payload, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('botchef-token')?.value
  const { pathname } = request.nextUrl

  // Rotas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (token) {
      const payload = decodeJwtPayload(token)
      const dest = payload?.role === 'ADMIN' ? '/admin' : '/conversations'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.next()
  }

  // Sem token → login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = decodeJwtPayload(token)
  const role = payload?.role

  // Rota /admin → só ADMIN
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/conversations', request.url))
  }

  // Rotas de dashboard → só CLIENT (admin não acessa o painel do cliente)
  const dashboardPaths = ['/conversations', '/connect', '/templates']
  if (dashboardPaths.some((p) => pathname.startsWith(p)) && role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
