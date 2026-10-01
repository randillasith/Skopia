/**
 * The session: who is signed in, and how that is established.
 *
 * This lives apart from components/Shell so that the library and the catalogue
 * can ask who is acting without importing the chrome — Shell reads both of them,
 * and a module that reads a module that reads it back leaves one of the three
 * half-initialised at load time.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { type Account, type Viewer } from './session'
import { accounts, toAccount, type SignUpInput } from './accounts'
import {
  clearSession, readSession, writeSession,
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
})

export const useSession = () => useContext(SessionCtx)

/**
 * What survives a refresh: a server account id, or a prototype identity.
 *
 * It holds an id and nothing else — no role, no permission, nothing the page
 * decides anything from. On load the id is handed back to the server, which
 * answers with what the account actually is.
 */
type Stored = SignedSession | null

function readStored(): Stored {
  return readSession()
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
    }),
    [viewer, resolving],
  )
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
