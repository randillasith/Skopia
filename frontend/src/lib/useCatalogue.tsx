/**
 * The catalogue, loaded once and shared.
 *
 * Every shelf, search and watch page used to read a module-level constant, which
 * meant the catalogue could not fail, could not be empty, and could not change.
 * All three of those are now possible, so the catalogue is state: it has a
 * loading moment, it can come back refused, and it can come back with nothing.
 * Screens are given all three rather than only the happy one.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { ApiError, request } from './api'
import { replaceChannels, type Channel } from './session'
import { catalogue, toVideo, type ServerCategory, type ServerComment } from './catalogue'
import type { Video } from './data'
import { useSession } from './session-context'
import { actorId as actorIdOf } from './session'

type CatalogueValue = {
  videos: Video[]
  categories: ServerCategory[]
  loading: boolean
  /** Why the catalogue is not here, or null when it is. */
  error: string | null
  channelError: string | null
  /** Re-read the catalogue. Used after anything that changes it. */
  refresh: () => void
  byId: (id: string) => Video | undefined
  /** The category id behind a name, for the endpoints that filter by id. */
  categoryId: (name: string) => number | undefined
  /** Replace one row in place, so a like or a save does not re-fetch the shelf. */
  patch: (id: string, changes: Partial<Video>) => void
}

const CatalogueCtx = createContext<CatalogueValue>({
  videos: [],
  categories: [],
  loading: false,
  error: null,
  channelError: null,
  refresh: () => {},
  byId: () => undefined,
  categoryId: () => undefined,
  patch: () => {},
})

export const useCatalogue = () => useContext(CatalogueCtx)

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const { viewer, resolving } = useSession()
  const actor = actorIdOf(viewer)

  const [videos, setVideos] = useState<Video[]>([])
  const [categories, setCategories] = useState<ServerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  // The catalogue is re-read when the acting account changes, because liked,
  // saved and where-you-left-off are answered per caller — the same shelf means
  // something different to a different person.
  useEffect(() => {
    if (resolving) return
    const abort = new AbortController()
    setLoading(true)
    Promise.all([
      catalogue.videos({}, actor, abort.signal),
      catalogue.categories(abort.signal),
      request<Channel[]>('/api/channels', { signal: abort.signal }).then(rows => { if (!abort.signal.aborted) setChannelError(null); return rows }).catch(() => { if (!abort.signal.aborted) setChannelError('Channels could not be loaded. Please try again.'); return [] as Channel[] }),
    ])
      .then(([rows, cats, channels]) => {
        if (abort.signal.aborted) return
        replaceChannels(channels.map((c) => ({ ...c, moderators: [], subscribers: null, location: '', tagline: c.about })))
        setVideos(rows.map(toVideo))
        setCategories(cats)
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not load the catalogue.')
        setVideos([])
        replaceChannels([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [actor, resolving, nonce])

  const index = useRef(new Map<string, Video>())
  index.current = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos])

  const value = useMemo<CatalogueValue>(
    () => ({
      videos,
      categories,
      loading,
      error,
      channelError,
      refresh: () => setNonce((n) => n + 1),
      byId: (id: string) => index.current.get(id),
      categoryId: (name: string) =>
        categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id,
      patch: (id, changes) =>
        setVideos((list) => list.map((v) => (v.id === id ? { ...v, ...changes } : v))),
    }),
    [videos, categories, loading, error, channelError],
  )

  return <CatalogueCtx.Provider value={value}>{children}</CatalogueCtx.Provider>
}

/**
 * One title, resolved against the catalogue and then asked for directly.
 *
 * The shelf carries enough for a tile but not the whole record, and a link that
 * was pasted in may name a title the shelf never held, so the watch page asks
 * for its own row rather than trusting what happened to be loaded.
 */
export function useVideo(id: string | undefined) {
  const { byId, loading: shelfLoading } = useCatalogue()
  const { viewer, resolving } = useSession()
  const actor = actorIdOf(viewer)

  const known = id ? byId(id) : undefined
  const [video, setVideo] = useState<Video | undefined>(known)
  const [loading, setLoading] = useState(!known)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return undefined
    const numeric = Number(id)
    if (!Number.isFinite(numeric)) {
      setError('That is not a title we hold.')
      setLoading(false)
      return undefined
    }
    const abort = new AbortController()
    setLoading(true)
    catalogue
      .video(numeric, actor, abort.signal)
      .then((row) => {
        setVideo(toVideo(row))
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not load that title.')
        setVideo(undefined)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [id, actor])

  useEffect(() => {
    if (resolving) return
    return load()
  }, [load, resolving])

  return {
    video,
    loading: loading || shelfLoading || resolving,
    error,
    reload: load,
    setVideo,
  }
}

/**
 * The catalogue, searched by the server.
 *
 * The query is debounced because it arrives a keystroke at a time from the
 * address bar, and an empty query is not sent as a search — it asks for the
 * whole catalogue, which is what an empty search box means.
 */
export function useVideoSearch(q: string) {
  const { viewer, resolving } = useSession()
  const actor = actorIdOf(viewer)

  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (resolving) return
    const abort = new AbortController()
    const term = q.trim()
    setLoading(true)
    const timer = window.setTimeout(() => {
      catalogue
        .videos(term ? { search: term } : {}, actor, abort.signal)
        .then((rows) => {
          setVideos(rows.map(toVideo))
          setError(null)
        })
        .catch((cause) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return
          setError(cause instanceof ApiError ? cause.message : 'Could not run that search.')
          setVideos([])
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false)
        })
    }, term ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [q, actor, resolving, nonce])

  return { videos, loading, error, reload: () => setNonce((n) => n + 1) }
}

/** A comment as the watch page reads it, with the server's row kept underneath. */
export type ThreadComment = {
  id: number
  who: string
  at: string
  body: string
  likes: number
  pinned: boolean
  byCreator: boolean
  /** Null when the server did not say who wrote it. */
  userId: number | null
  parentId: number | null
}

function toThreadComment(row: ServerComment): ThreadComment {
  return {
    id: row.id,
    who: row.displayName ?? 'Someone',
    at: (row.postedAt ?? '').replace('T', ' ').slice(0, 16),
    body: row.text,
    likes: row.likeCount ?? 0,
    pinned: row.isPinned === true,
    byCreator: (row.badge ?? '').toUpperCase().includes('CREATOR'),
    userId: row.userId ?? null,
    parentId: row.parentId ?? null,
  }
}

/**
 * The comment thread for one title.
 *
 * Posting and removing update the list from the server's answer rather than
 * guessing at it, so the id a delete needs is the real one and a comment that
 * the server rejected never appears to have been posted.
 */
export function useComments(videoId: number | null) {
  const { viewer } = useSession()
  const actor = actorIdOf(viewer)
  const [comments, setComments] = useState<ThreadComment[]>([])
  const [loading, setLoading] = useState(videoId != null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (videoId == null) {
      setComments([])
      setLoading(false)
      return
    }
    const abort = new AbortController()
    setLoading(true)
    catalogue
      .comments(videoId, abort.signal)
      .then((rows) => {
        setComments(rows.map(toThreadComment))
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not load the comments.')
        setComments([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [videoId])

  const post = useCallback(
    async (text: string) => {
      if (videoId == null) throw new ApiError(0, 'There is nothing to comment on.')
      const row = await catalogue.addComment(videoId, text, actor)
      setComments((list) => [toThreadComment(row), ...list])
    },
    [videoId, actor],
  )

  const remove = useCallback(
    async (commentId: number) => {
      await catalogue.deleteComment(commentId, actor)
      setComments((list) => list.filter((c) => c.id !== commentId))
    },
    [actor],
  )

  const edit = useCallback(
    async (commentId: number, text: string) => {
      const row = await catalogue.editComment(commentId, text, actor)
      setComments((list) => list.map((c) => c.id === commentId ? toThreadComment(row) : c))
    },
    [actor],
  )

  return { comments, loading, error, post, remove, edit }
}

/**
 * The signed-in creator's own shelf.
 *
 * Asked for with `scope=mine` so the server decides what belongs to this
 * account, rather than this page matching creator names — which is what made
 * every creator see the same two studios' videos as though they were theirs.
 */
export function useMyVideos() {
  const { viewer, resolving } = useSession()
  const actor = actorIdOf(viewer)

  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (resolving) return
    if (actor == null) {
      setVideos([])
      setLoading(false)
      return
    }
    const abort = new AbortController()
    setLoading(true)
    catalogue
      .videos({ scope: 'mine' }, actor, abort.signal)
      .then((rows) => {
        setVideos(rows.map(toVideo))
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not load your videos.')
        setVideos([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [actor, resolving, nonce])

  return { videos, loading, error, refresh: () => setNonce((n) => n + 1) }
}
