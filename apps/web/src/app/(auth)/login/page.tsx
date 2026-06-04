import { ChefHat } from 'lucide-react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">BotChef</h1>
          <p className="mt-1 text-sm text-gray-500">
            Atendimento via WhatsApp integrado ao MenuChef
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Entrar na plataforma</h2>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
