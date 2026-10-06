export const SESSION_KEY = 'skopia.session'
export const SIGNED_OUT = 'guest'

export type SignedSession = {
  userId: number
  token: string
}

type StoredSession = { kind: 'api'; userId: number; token: string }

export function readSession(): SignedSession | null {
  try {
    const raw = globalThis.localStorage.getItem(SESSION_KEY)
    if (!raw || raw === SIGNED_OUT) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (
      parsed.kind === 'api' &&
      typeof parsed.userId === 'number' &&
      Number.isFinite(parsed.userId) &&
      typeof parsed.token === 'string' &&
      parsed.token.length > 0
    ) {
      return { userId: parsed.userId, token: parsed.token }
    }
    return null
  } catch {
    return null
  }
}

export function writeSession(session: SignedSession): void {
  try {
    const stored: StoredSession = { kind: 'api', ...session }
    globalThis.localStorage.setItem(SESSION_KEY, JSON.stringify(stored))
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
}

export function clearSession(): void {
  try {
    globalThis.localStorage.setItem(SESSION_KEY, SIGNED_OUT)
  } catch {
    // The in-memory React session is still cleared by the caller.
  }
}

export function bearerToken(): string | null {
  return readSession()?.token ?? null
}
