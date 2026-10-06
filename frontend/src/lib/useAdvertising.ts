/**
 * Binding the signed-in account to the advertising API, and loading from it.
 *
 * The prototype's session knows who is signed in by handle; the API identifies
 * its caller by a numeric user id. `useAdvertisingActor` resolves one into the
 * other, once, and every advertising screen waits on it before loading anything.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '@/components/Shell'
import { ApiError } from './api'
import { ads, type AdvertisingSession } from './ads'

type ActorState = {
  actor: AdvertisingSession | null
  loading: boolean
  /** Set when this account cannot manage advertising, or the API is unreachable. */
  error: ApiError | null
}

export function useAdvertisingActor(): ActorState {
  const { viewer } = useSession()
  // The server answers for the bearer token, so this only needs to know whether
  // there is a session at all. It used to send the handle and take back whatever
  // account that named, which is not the same question.
  const signedIn = viewer?.userId ?? null

  const [state, setState] = useState<ActorState>({ actor: null, loading: true, error: null })

  useEffect(() => {
    if (signedIn == null) {
      setState({ actor: null, loading: false, error: new ApiError(401, 'Sign in to continue.') })
      return
    }
    let live = true
    setState({ actor: null, loading: true, error: null })

    ads.session()
      .then((actor) => { if (live) setState({ actor, loading: false, error: null }) })
      .catch((error: unknown) => {
        if (!live) return
        setState({
          actor: null,
          loading: false,
          error: error instanceof ApiError ? error : new ApiError(0, 'Something went wrong.'),
        })
      })

    return () => { live = false }
  }, [signedIn])

  return state
}

/**
 * Load something from the API, with the states a screen has to render.
 *
 * `reload` is what an action calls after it changes something on the server —
 * the alternative is patching the local copy, which drifts from what the server
 * actually did the first time a rule fires that the browser does not know about.
 */
export function useApiData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  enabled = true,
): {
  data: T | null
  loading: boolean
  error: ApiError | null
  reload: () => void
  /** Replace the local copy, for the rare case where the server already told us. */
  set: (value: T) => void
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<ApiError | null>(null)
  const [nonce, setNonce] = useState(0)

  // `load` is almost always an inline arrow, so it is a new function on every
  // render. Holding it in a ref keeps it out of the effect's dependencies, which
  // is what stops the effect re-running forever.
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    loadRef.current(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return
        setData(value)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        // An abort is this effect being superseded, not a failure to report.
        if (controller.signal.aborted) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause : new ApiError(0, 'Something went wrong.'))
        setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, error, reload, set: setData }
}
