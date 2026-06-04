const BASE_URL = (process.env.MENUCHEF_BASE_URL ?? '').replace(/\/$/, '')
const BOTCHEF_SECRET = process.env.MENUCHEF_BOTCHEF_SECRET ?? ''

export const MenuChefService = {
  /**
   * Registra (ou atualiza) o instanceToken para um suffix no MenuChef.
   * Chamado sempre que o usuário conecta ou reconecta o WhatsApp.
   */
  async registerToken(suffix: string, token: string): Promise<void> {
    if (!BASE_URL || !BOTCHEF_SECRET) {
      throw new Error('MENUCHEF_BASE_URL ou MENUCHEF_BOTCHEF_SECRET não configurados')
    }

    const res = await fetch(`${BASE_URL}/integrations/botchef/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-botchef-secret': BOTCHEF_SECRET,
      },
      body: JSON.stringify({ suffix, token }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        `MenuChef register falhou [${res.status}]: ${(body as { error?: string }).error ?? res.statusText}`,
      )
    }
  },
}
