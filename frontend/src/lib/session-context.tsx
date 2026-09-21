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

/* ---------------------------------------------------------------- session */

/**
 * Login is session-based: signing in asks the server to open a session and the
 * browser carries nothing but the account id needed to address it. Nothing about
 * what an account may do is decided in the page — the grants below come from the
 * server's answer and are re-fetched on every load, so editing what is stored
 * changes which account is asked about, never what it is allowed to do.
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
const SESSION_KEY = 'skopia.session'
/** Signing out has to be distinguishable from never having signed in, or a
 *  refresh after signing out would quietly sign you back in. */
const SIGNED_OUT = 'guest'

type Stored = { kind: 'api'; userId: number } | { kind: 'demo'; id: string } | null

function readStored(): Stored {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw || raw === SIGNED_OUT) return null
    const parsed = JSON.parse(raw)
    if (parsed?.kind === 'api' && typeof parsed.userId === 'number') return parsed
    if (parsed?.kind === 'demo' && typeof parsed.id === 'string') return parsed
    return null
  } catch {
    // Private windows, blocked site data and stale formats all land here.
    return null
  }
}

function writeStored(value: Stored) {
  try {
    window.localStorage.setItem(SESSION_KEY, value ? JSON.stringify(value) : SIGNED_OUT)
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
    if (stored.kind === 'demo') {
      setViewer(accountById(stored.id))
      setResolving(false)
      return
    }
    let live = true
    accounts
      .me(stored.userId)
      .then((server) => {
        if (live) setViewer(toAccount(server))
      })
      .catch(() => {
        // The account is gone, or the API is down. Either way this tab is a
        // guest until somebody signs in again, which is the safe reading.
        if (live) {
          writeStored(null)
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
        const account = toAccount(await accounts.signIn(identifier, password))
        if (account.userId != null) writeStored({ kind: 'api', userId: account.userId })
        setViewer(account)
        return account
      },
      signUp: async (input) => {
        const account = toAccount(await accounts.signUp(input))
        if (account.userId != null) writeStored({ kind: 'api', userId: account.userId })
        setViewer(account)
        return account
      },
      signOut: () => {
        writeStored(null)
        setViewer(null)
      },
      becomeDemo: (id) => {
        writeStored(id ? { kind: 'demo', id } : null)
        setViewer(id ? accountById(id) : null)
      },
    }),
    [viewer, resolving],
  )
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

