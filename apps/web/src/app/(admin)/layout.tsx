import { ChefHat, LogOut, Users } from 'lucide-react'
import Link from 'next/link'
import { logout } from '@/app/(dashboard)/actions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <ChefHat className="h-6 w-6 text-green-600" />
          <div>
            <span className="text-lg font-bold text-gray-900">BotChef</span>
            <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
              Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <Users className="h-4 w-4" />
            Clientes
          </Link>
        </nav>

        <div className="border-t border-gray-200 px-3 py-4">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
