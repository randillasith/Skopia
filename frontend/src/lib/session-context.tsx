/**
 * The session: who is signed in, and how that is established.
 *
 * This lives apart from components/Shell so that the library and the catalogue
 * can ask who is acting without importing the chrome — Shell reads both of them,
 * and a module that reads a module that reads it back leaves one of the three
 * half-initialised at load time.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { accountById, type Account, type Viewer } from './session'
import { accounts, toAccount, type SignUpInput } from './accounts'
import {
  SESSION_KEY, SIGNED_OUT, clearSession, readSession, writeSession,
  type SignedSession,
} from './auth-storage'

/* ---------------------------------------------------------------- session */

/**
 * Login uses a signed bearer token. The browser stores the token with the account
 * id, sends it in the Authorization header, and revalidates it through `/api/auth/me`
 * on every load. UI grants are rebuilt from that verified server response; editing
 * local storage cannot grant additional server permissions.
 */
type SessionValue = {
  viewer: Viewer
  /** True while a stored session is being resolved, before the first answer. */
  resolving: boolean
  signIn: (identifier: string, password: string) => Promise<Account>
  signUp: (input: SignUpInput) => Promise<Account>
  signOut: () => void
  /**
   * Switch to one of the prototype identities. They have no server account, so a
   * screen backed by the API will find nothing for them. Kept because several
   * screens have no backend yet and need somebody to be.
   */
  becomeDemo: (accountId: string | null) => void
}

const SessionCtx = createContext<SessionValue>({
  viewer: null,
  resolving: false,
  signIn: async () => {
    throw new Error('No session provider')
  },
  signUp: async () => {
    throw new Error('No session provider')
  },
  signOut: () => {},
  becomeDemo: () => {},
})

export const useSession = () => useContext(SessionCtx)

/**
 * What survives a refresh: a server account id, or a prototype identity.
 *
 * It holds an id and nothing else — no role, no permission, nothing the page
 * decides anything from. On load the id is handed back to the server, which
 * answers with what the account actually is.
 */
type Stored = SignedSession | { kind: 'demo'; id: string } | null

function readStored(): Stored {
  const signed = readSession()
  if (signed) return signed
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw || raw === SIGNED_OUT) return null
    const parsed = JSON.parse(raw)
    if (parsed?.kind === 'demo' && typeof parsed.id === 'string') return parsed
    return null
  } catch {
    // Private windows, blocked site data and stale formats all land here.
    return null
  }
}

function writeDemo(id: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ kind: 'demo', id }))
  } catch {
    // Nothing to do — the session simply will not outlive the page.
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [viewer, setViewer] = useState<Viewer>(null)
  const [resolving, setResolving] = useState(true)

  // A stored id is a question for the server, not an answer. Asking again on
  // every load is what keeps a deactivated or re-graded account from carrying
  // yesterday's capabilities around in this tab.
  useEffect(() => {
    const stored = readStored()
    if (!stored) {
      setResolving(false)
      return
    }
    if ('kind' in stored && stored.kind === 'demo') {
      setViewer(accountById(stored.id))
      setResolving(false)
      return
    }
    let live = true
    accounts
      .me()
      .then((server) => {
        if (live) {
          if (server.userId != null && server.token) {
            writeSession({ userId: server.userId, token: server.token })
          }
          setViewer(toAccount(server))
        }
      })
      .catch(() => {
        // The account is gone, or the API is down. Either way this tab is a
        // guest until somebody signs in again, which is the safe reading.
        if (live) {
          clearSession()
          setViewer(null)
        }
      })
      .finally(() => {
        if (live) setResolving(false)
      })
    return () => {
      live = false
    }
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      viewer,
      resolving,
      signIn: async (identifier, password) => {
        const server = await accounts.signIn(identifier, password)
        const account = toAccount(server)
        if (account.userId != null && server.token) writeSession({ userId: account.userId, token: server.token })
        setViewer(account)
        return account
      },
      signUp: async (input) => {
        const server = await accounts.signUp(input)
        const account = toAccount(server)
        if (account.userId != null && server.token) writeSession({ userId: account.userId, token: server.token })
        setViewer(account)
        return account
      },
      signOut: () => {
        clearSession()
        setViewer(null)
      },
      becomeDemo: (id) => {
        if (id) writeDemo(id)
        else clearSession()
        setViewer(id ? accountById(id) : null)
      },
    }),
    [viewer, resolving],
  )
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
