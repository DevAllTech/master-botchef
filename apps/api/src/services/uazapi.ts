const BASE_URL = (process.env.UAZAPI_BASE_URL ?? '').replace(/\/$/, '')
const GLOBAL_TOKEN = process.env.UAZAPI_GLOBAL_TOKEN ?? ''

export class UazapiInstanceNotFoundError extends Error {
  constructor() {
    super('Uazapi instance not found or expired')
    this.name = 'UazapiInstanceNotFoundError'
  }
}

/**
 * Faz uma requisição autenticada ao UazapiGO.
 *
 * Autenticação:
 *  - Operações de admin (criar instância): header `admintoken: <GLOBAL_TOKEN>`
 *  - Operações de instância: header `token: <instanceToken>`
 *
 * O UazapiGO retorna objetos JSON planos (sem envelope {code, message, data}).
 * Em caso de erro, retorna {error: "..."} ou HTTP 4xx/5xx.
 */
async function uazapiFetch<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
  instanceToken?: string,
  isAdmin = false,
): Promise<T> {
  const authHeader: Record<string, string> = isAdmin
    ? { admintoken: GLOBAL_TOKEN }
    : { token: instanceToken ?? GLOBAL_TOKEN }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const json = await res.json() as Record<string, unknown>

  if (!res.ok) {
    if (res.status === 404 || (res.status === 401 && !isAdmin)) throw new UazapiInstanceNotFoundError()
    const message = (json.message as string) ?? (json.error as string) ?? `HTTP ${res.status}`
    const code = (json.code as number) ?? res.status
    throw new Error(`Uazapi [${code}]: ${message}`)
  }

  // Verifica campos de erro mesmo com HTTP 2xx
  if (json.error) {
    throw new Error(`Uazapi: ${json.error}`)
  }

  return json as T
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  const delays = [1000, 2000, 4000]
  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
      }
    }
  }

  throw lastError
}

export interface CreateInstanceResult {
  instanceId: string
  instanceToken: string
}

export interface QRCodeResult {
  qrcode: string
  connected: boolean
}

export interface StatusResult {
  connected: boolean
  phone?: string
}

// Formato da resposta de criação de instância
interface CreateInstanceResponse {
  token: string
  instance: {
    id: string
    token: string
    status: string
    qrcode?: string
  }
  name: string
  response: string
  status: { connected: boolean; jid: string | null; loggedIn: boolean }
}

// Formato da resposta de connect/status
interface InstanceStateResponse {
  connected?: boolean
  instance?: {
    id: string
    token: string
    qrcode?: string
    status?: string
  }
  status?: {
    connected: boolean
    jid: string | null
    loggedIn: boolean
  }
  jid?: string | null
  loggedIn?: boolean
  response?: string
}

export const UazapiService = {
  /**
   * Cria uma nova instância no UazapiGO.
   * Usa o GLOBAL_TOKEN via header `admintoken`.
   */
  async createInstance(name: string, webhookUrl: string): Promise<CreateInstanceResult> {
    const data = await uazapiFetch<CreateInstanceResponse>(
      '/instance/create',
      {
        method: 'POST',
        body: JSON.stringify({ name, webhook: webhookUrl }),
      },
      undefined,
      true, // isAdmin
    )

    const instanceId = data.instance?.id ?? ''
    const instanceToken = data.token ?? data.instance?.token ?? ''

    if (!instanceId || !instanceToken) {
      throw new Error('Resposta inesperada ao criar instância: ' + JSON.stringify(data))
    }

    return { instanceId, instanceToken }
  },

  /**
   * Solicita conexão da instância e retorna o QR Code.
   * Usa o token da instância via header `token`.
   */
  async getQRCode(instanceToken: string): Promise<QRCodeResult> {
    const data = await uazapiFetch<InstanceStateResponse>(
      '/instance/connect',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      instanceToken,
    )

    const connected = data.connected ?? data.status?.connected ?? false
    const qrcode = data.instance?.qrcode ?? ''

    return { qrcode, connected }
  },

  /**
   * Verifica se a instância está conectada.
   */
  async getStatus(instanceToken: string): Promise<StatusResult> {
    const data = await uazapiFetch<InstanceStateResponse>(
      '/instance/status',
      {},
      instanceToken,
    )

    const connected = data.status?.connected ?? data.connected ?? false
    const jid = data.status?.jid ?? data.jid ?? null
    const phone = jid ? jid.split('@')[0] : undefined

    return { connected, phone }
  },

  /**
   * Envia uma mensagem de texto com retry automático.
   * Campos corretos do UazapiGO: `number` e `text`.
   */
  async sendMessage(instanceToken: string, phone: string, text: string): Promise<void> {
    // Remove o "+" do número caso esteja presente
    const number = phone.replace(/^\+/, '')
    await withRetry(() =>
      uazapiFetch(
        '/send/text',
        {
          method: 'POST',
          body: JSON.stringify({ number, text }),
        },
        instanceToken,
      ),
    )
  },

  /**
   * Desconecta a instância do WhatsApp.
   */
  async disconnectInstance(instanceToken: string): Promise<void> {
    await uazapiFetch('/instance/disconnect', { method: 'POST' }, instanceToken)
  },
}
