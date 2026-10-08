import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react'
import { catalogue } from './catalogue'
import { actorId as actorIdOf } from './session'
import { useSession } from './session-context'

/**
 * Everything the viewer accumulates: who they follow, what they saved, what they
 * liked, where they have been.
 *
 * It is held in one place because these are the same kind of thing — a record
 * belonging to an account rather than to the catalogue — and because the header,
 * the player, the channel page and four separate routes all read and write it.
 * Threading it through props would mean every one of them knowing about the
 * others.
 *
 * Two of these now belong to the server rather than to this browser. Watch later
 * and watch history are rows the API holds against the account, so they are read
 * from it on sign-in and written through it on every change — otherwise the same
 * account would carry a different library on a different device.
 *
 * The rest — playlists, the queue, downloads, followed channels, recent searches
 * — have no backend yet, so they stay local and are honest about being local.
 *
 * Persisted to localStorage so a reload does not throw the lot away. Every read
 * and write is wrapped: private windows and blocked site data both throw, and a
 * viewer who has cleared their storage should get an empty library, not a blank
 * page.
 */

export type PlaylistVisibility = 'Private' | 'Unlisted' | 'Public'

export type Playlist = {
  id: string
  name: string
  visibility: PlaylistVisibility
  videoIds: string[]
  created: string
}

export type Vote = 'up' | 'down' | null

type LibraryValue = {
  hasLegacyLibrary: boolean
  importLegacyLibrary: () => void
  /** Channel handles this account follows. */
  subscriptions: string[]
  isSubscribed: (handle: string) => boolean
  toggleSubscribe: (handle: string) => boolean
  /** Handles whose new releases should raise a notification. */
  bells: string[]
  toggleBell: (handle: string) => boolean

  playlists: Playlist[]
  createPlaylist: (name: string, visibility: PlaylistVisibility) => Playlist
  renamePlaylist: (id: string, name: string) => void
  deletePlaylist: (id: string) => void
  toggleInPlaylist: (playlistId: string, videoId: string) => boolean

  watchLater: string[]
  isSaved: (videoId: string) => boolean
  toggleWatchLater: (videoId: string) => Promise<boolean>

  votes: Record<string, Vote>
  vote: (videoId: string, v: Vote) => void

  history: string[]
  historyPaused: boolean
  setHistoryPaused: (v: boolean) => void
  recordWatch: (videoId: string) => void
  forgetWatch: (videoId: string) => void
  clearHistory: () => void

  recentSearches: string[]
  recordSearch: (q: string) => void
  forgetSearch: (q: string) => void

  /**
   * The queue: what plays after this, in order. Kept apart from playlists
   * because it is temporary by nature — you build it for the next hour, not to
   * keep — and apart from Watch later, which is the opposite (kept, unordered).
   */
  queue: string[]
  isQueued: (videoId: string) => boolean
  toggleQueue: (videoId: string) => boolean
  playNext: (videoId: string) => void
  dequeue: (videoId: string) => void
  clearQueue: () => void

  /** Titles taken for offline viewing. */
  downloads: string[]
  isDownloaded: (videoId: string) => boolean
  toggleDownload: (videoId: string) => boolean
}

const KEY = 'skopia.library'

type Stored = {
  subscriptions: string[]
  bells: string[]
  playlists: Playlist[]
  watchLater: string[]
  votes: Record<string, Vote>
  history: string[]
  historyPaused: boolean
  recentSearches: string[]
  queue: string[]
  downloads: string[]
  /**
   * Titles removed from history in this browser.
   *
   * There is no endpoint that forgets a watch, so removing one hides it here
   * instead. It is a local decision the server does not know about, and it is
   * kept as its own list rather than by editing the history so the two are
   * never confused.
   */
  forgotten: string[]
}

/**
 * A new library is empty.
 *
 * It used to open pre-filled with prototype ids, which against a real catalogue
 * are links to titles that do not exist. Watch later and history are filled from
 * the server as soon as somebody signs in; the rest fills as they use it.
 */
const seed = (): Stored => ({
  subscriptions: [],
  bells: [],
  playlists: [],
  watchLater: [],
  votes: {},
  history: [],
  historyPaused: false,
  recentSearches: [],
  queue: [],
  downloads: [],
  forgotten: [],
})

export const setMembership = (ids: string[], id: string, active: boolean) =>
  active ? [...new Set([...ids, id])] : ids.filter((value) => value !== id)

function read(key: string): Stored {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return seed()
    return { ...seed(), ...(JSON.parse(raw) as Partial<Stored>) }
  } catch {
    return seed()
  }
}

function write(key: string, s: Stored) {
  try {
    window.localStorage.setItem(key, JSON.stringify(s))
  } catch {
    // Storage is unavailable. The library simply will not outlive the tab.
  }
}

const LibraryCtx = createContext<LibraryValue | null>(null)

// This key predates account scoping. The owner cannot be inferred, so import is opt-in.
function legacyAvailable() {
  try { return window.localStorage.getItem(KEY) !== null } catch { return false }
}

function legacyLocalFields(): Partial<Stored> | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) || 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const old = value as Record<string, unknown>
    const strings = (key: string) => Array.isArray(old[key]) ? (old[key] as unknown[]).filter((v): v is string => typeof v === 'string') : []
    const playlists = Array.isArray(old.playlists) ? old.playlists.filter((p): p is Playlist =>
      !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' &&
      Array.isArray(p.videoIds) && p.videoIds.every((id: unknown) => typeof id === 'string') &&
      ['Private', 'Public', 'Unlisted'].includes(p.visibility) && typeof p.created === 'string') : []
    return { playlists, subscriptions: strings('subscriptions'), bells: strings('bells'),
      queue: strings('queue'), downloads: strings('downloads'), recentSearches: strings('recentSearches'),
      forgotten: strings('forgotten'), historyPaused: old.historyPaused === true,
      votes: old.votes && typeof old.votes === 'object' && !Array.isArray(old.votes) ?
        Object.fromEntries(Object.entries(old.votes).filter(([, v]) => v === 'up' || v === 'down' || v === null)) : {} }
  } catch { return null }
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryCtx)
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return ctx
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { viewer, resolving } = useSession()
  const actor = actorIdOf(viewer)
  // Remount synchronously on identity change: effects run after paint and cannot
  // prevent a frame of the previous account's data from being rendered.
  const key = resolving ? 'pending' : actor == null ? 'guest' : `user.${actor}`
  return <AccountLibrary key={key} storageKey={`${KEY}.${key}`} actor={resolving ? null : actor} active={!resolving}>{children}</AccountLibrary>
}

function AccountLibrary({ children, storageKey, actor, active }: {
  children: React.ReactNode; storageKey: string; actor: number | null; active: boolean
}) {
  const [s, setS] = useState<Stored>(() => active ? read(storageKey) : seed())
  const [hasLegacyLibrary] = useState(() => legacyAvailable())
  const pendingSaves = useRef(new Map<string, Promise<boolean>>())

  useEffect(() => {
    if (active) write(storageKey, s)
  }, [s, storageKey, active])

  // Watch later and history belong to the account, so they are replaced by the
  // server's answer whenever the acting account changes. Signing out empties
  // them here rather than leaving the last account's rows on screen.
  useEffect(() => {
    if (!active) return
    if (actor == null) {
      setS((p) => ({ ...p, watchLater: [], history: [] }))
      return
    }
    const abort = new AbortController()
    Promise.all([
      catalogue.watchlist(actor, abort.signal),
      catalogue.history(actor, abort.signal),
    ])
      .then(([saved, watched]) => {
        if (abort.signal.aborted) return
        setS((p) => ({
          ...p,
          watchLater: saved.map((row) => String(row.id)),
          history: watched.map((row) => String(row.id)),
        }))
      })
      .catch(() => {
        // The API is down or the account is gone. An empty library reads better
        // than one that is silently a different account's.
        if (!abort.signal.aborted) setS((p) => ({ ...p, watchLater: [], history: [] }))
      })
    return () => abort.abort()
  }, [actor, active])

  const toggleIn = useCallback(
    (key: 'subscriptions' | 'bells' | 'watchLater' | 'queue' | 'downloads', id: string) => {
      let nowOn = false
      setS((prev) => {
        const has = prev[key].includes(id)
        nowOn = !has
        const next = has ? prev[key].filter((x) => x !== id) : [...prev[key], id]
        // Un-following a channel drops its bell too: a notification from a
        // channel you no longer follow would have nowhere to have come from.
        if (key === 'subscriptions' && has) {
          return { ...prev, subscriptions: next, bells: prev.bells.filter((x) => x !== id) }
        }
        return { ...prev, [key]: next }
      })
      return nowOn
    },
    [],
  )

  const value = useMemo<LibraryValue>(
    () => ({
      hasLegacyLibrary,
      importLegacyLibrary: () => {
        if (!active || actor == null) return
        const old = legacyLocalFields()
        if (old) setS((p) => ({
          ...p,
          playlists: [...p.playlists, ...(old.playlists || []).filter((item) => !p.playlists.some((existing) => existing.id === item.id))],
          subscriptions: [...new Set([...p.subscriptions, ...(old.subscriptions || [])])],
          bells: [...new Set([...p.bells, ...(old.bells || [])])],
          queue: [...new Set([...p.queue, ...(old.queue || [])])],
          downloads: [...new Set([...p.downloads, ...(old.downloads || [])])],
          recentSearches: [...new Set([...p.recentSearches, ...(old.recentSearches || [])])].slice(0, 8),
          forgotten: [...new Set([...p.forgotten, ...(old.forgotten || [])])],
          votes: { ...old.votes, ...p.votes },
          historyPaused: p.historyPaused || old.historyPaused === true,
        }))
      },
      subscriptions: s.subscriptions,
      isSubscribed: (h) => s.subscriptions.includes(h),
      toggleSubscribe: (h) => toggleIn('subscriptions', h),

      bells: s.bells,
      toggleBell: (h) => toggleIn('bells', h),

      playlists: s.playlists,
      createPlaylist: (name, visibility) => {
        const pl: Playlist = {
          id: `pl-${Date.now()}`,
          name,
          visibility,
          videoIds: [],
          created: new Date().toISOString().slice(0, 10),
        }
        setS((p) => ({ ...p, playlists: [pl, ...p.playlists] }))
        return pl
      },
      renamePlaylist: (id, name) =>
        setS((p) => ({
          ...p,
          playlists: p.playlists.map((x) => (x.id === id ? { ...x, name } : x)),
        })),
      deletePlaylist: (id) =>
        setS((p) => ({ ...p, playlists: p.playlists.filter((x) => x.id !== id) })),
      toggleInPlaylist: (playlistId, videoId) => {
        let added = false
        setS((p) => ({
          ...p,
          playlists: p.playlists.map((x) => {
            if (x.id !== playlistId) return x
            const has = x.videoIds.includes(videoId)
            added = !has
            return {
              ...x,
              videoIds: has ? x.videoIds.filter((v) => v !== videoId) : [...x.videoIds, videoId],
            }
          }),
        }))
        return added
      },

      watchLater: s.watchLater,
      isSaved: (id) => s.watchLater.includes(id),
      // Success is reported only after the account API confirms the saved state.
      toggleWatchLater: (id) => {
        if (actor == null) return Promise.reject(new Error('Sign in to save a title.'))
        const numeric = Number(id)
        if (!Number.isInteger(numeric) || numeric <= 0) return Promise.reject(new Error('This title cannot be saved.'))
        const pending = pendingSaves.current.get(id)
        if (pending) return pending
        const saved = catalogue.toggleSaved(numeric, actor).then(({ active }) => {
          setS(p => ({ ...p, watchLater: setMembership(p.watchLater, id, active) }))
          return active
        }).finally(() => pendingSaves.current.delete(id))
        pendingSaves.current.set(id, saved)
        return saved
      },

      votes: s.votes,
      vote: (id, v) =>
        setS((p) => ({ ...p, votes: { ...p.votes, [id]: p.votes[id] === v ? null : v } })),

      history: s.history.filter((id) => !s.forgotten.includes(id)),
      historyPaused: s.historyPaused,
      setHistoryPaused: (v) => setS((p) => ({ ...p, historyPaused: v })),
      recordWatch: (id) =>
        setS((p) =>
          p.historyPaused
            ? p
            : { ...p, history: [id, ...p.history.filter((x) => x !== id)].slice(0, 100) },
        ),
      // Forgetting is local: no endpoint removes a watch, so it is hidden here
      // and will come back if this browser's storage is cleared.
      forgetWatch: (id) =>
        setS((p) => ({ ...p, forgotten: [...new Set([...p.forgotten, id])] })),
      clearHistory: () => setS((p) => ({ ...p, forgotten: [...new Set([...p.forgotten, ...p.history])] })),

      recentSearches: s.recentSearches,
      recordSearch: (q) => {
        const t = q.trim()
        if (!t) return
        setS((p) => ({
          ...p,
          recentSearches: [t, ...p.recentSearches.filter((x) => x !== t)].slice(0, 8),
        }))
      },
      forgetSearch: (q) =>
        setS((p) => ({ ...p, recentSearches: p.recentSearches.filter((x) => x !== q) })),

      queue: s.queue,
      isQueued: (id) => s.queue.includes(id),
      toggleQueue: (id) => toggleIn('queue', id),
      // "Play next" jumps the line rather than appending, which is the whole
      // reason it exists as a separate action from "Add to queue".
      playNext: (id) =>
        setS((p) => ({ ...p, queue: [id, ...p.queue.filter((x) => x !== id)] })),
      dequeue: (id) => setS((p) => ({ ...p, queue: p.queue.filter((x) => x !== id) })),
      clearQueue: () => setS((p) => ({ ...p, queue: [] })),

      downloads: s.downloads,
      isDownloaded: (id) => s.downloads.includes(id),
      toggleDownload: (id) => toggleIn('downloads', id),
    }),
    [s, toggleIn, actor, active, hasLegacyLibrary],
  )

  return <LibraryCtx.Provider value={value}>{children}</LibraryCtx.Provider>
}
