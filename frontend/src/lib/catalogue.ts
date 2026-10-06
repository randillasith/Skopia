/**
 * The catalogue as the server holds it, and the translation into what the UI reads.
 *
 * The prototype's `Video` shape is richer than the API's: it carries a genre, a
 * caption list and a lifecycle word the server does not store. Rather than
 * thinning every screen down to what the API happens to return today, this module
 * maps one onto the other in a single place, and is honest about which fields are
 * derived and which are simply not known yet.
 */

import { request, submitForm } from './api'
import type { Billing, Video } from './data'

/* ------------------------------------------------------------ server shapes */

export type ServerVideo = {
  id: number
  title: string
  description: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  viewCount: number | null
  accessType: string | null
  status: string | null
  uploadedAt: string | null
  categoryId: number | null
  category: string | null
  creatorId: number | null
  creatorName: string | null
  creatorAvatar: string | null
  likeCount: number | null
  liked: boolean | null
  saved: boolean | null
  lastPosition: number | null
}

export type ServerCategory = { id: number; name: string }

export type ServerComment = {
  id: number
  text: string
  postedAt: string | null
  parentId: number | null
  userId: number | null
  displayName: string | null
  avatarUrl: string | null
  badge: string | null
  likeCount: number | null
  isPinned: boolean | null
}

export type ServerHistoryEntry = {
  id: number
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  viewCount: number | null
  lastPosition: number | null
  completed: boolean | null
  watchedAt: string | null
  category: string | null
}

export type ServerWatchlistEntry = {
  id: number
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  viewCount: number | null
  category: string | null
  addedAt: string | null
}

/* ----------------------------------------------------------------- mapping */

/**
 * The lifecycle word for a row, read from the status the server stores.
 *
 * The server's vocabulary is smaller than the letterboard's, so two of the five
 * words — HELD OVER and COMING SOON — are only reachable from statuses the
 * upload flow can set. Anything unrecognised reads as IN REVIEW rather than as
 * NOW SHOWING, because showing something by accident is the worse mistake.
 */
function billingOf(status: string | null): Billing {
  switch ((status ?? '').toUpperCase()) {
    case 'PUBLISHED':
    case 'PUBLIC':
      return 'NOW SHOWING'
    case 'SCHEDULED':
      return 'COMING SOON'
    case 'ARCHIVED':
      return 'HELD OVER'
    case 'REMOVED':
    case 'DELETED':
    case 'BLOCKED':
      return 'PULLED'
    default:
      return 'IN REVIEW'
  }
}

/** mm:ss, or h:mm:ss past an hour — the form the rest of the UI parses back. */
export function runtimeOf(totalSeconds: number | null): string {
  const s = Math.max(0, Math.round(totalSeconds ?? 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/**
 * A stable number for the poster generator.
 *
 * Posters are drawn from a seed, so the same title must seed the same poster on
 * every load or the catalogue reshuffles its own artwork on refresh. The id is
 * the only thing about a row that never changes, so it is what the seed comes
 * from.
 */
const seedOf = (id: number) => (id * 2654435761) % 997

/** Turn a server row into the shape every screen already reads. */
export function toVideo(row: ServerVideo): Video {
  const duration = row.durationSeconds ?? 0
  const position = row.lastPosition ?? 0
  return {
    id: String(row.id),
    title: row.title,
    creator: row.creatorName ?? 'Unattributed',
    category: row.category ?? 'Uncategorised',
    // The server stores no genre. An empty one filters out of every named genre,
    // which is correct: unspecified is not the same as belonging to one.
    genre: '',
    runtime: runtimeOf(duration),
    published: (row.uploadedAt ?? '').slice(0, 10),
    views: row.viewCount ?? 0,
    likes: row.likeCount ?? 0,
    // The catalogue endpoint does not count comments; the watch page fetches the
    // thread itself and knows the real number.
    comments: 0,
    premium: (row.accessType ?? '').toUpperCase() === 'PREMIUM',
    billing: billingOf(row.status),
    status: row.status,
    // No caption track is stored yet, so claiming one would be a lie on screen.
    captions: [],
    synopsis: row.description ?? '',
    progress: duration > 0 && position > 0 ? Math.min(1, position / duration) : undefined,
    seed: seedOf(row.id),
    mediaUrl: row.videoUrl ?? null,
    thumbnailUrl: row.thumbnailUrl || `https://picsum.photos/seed/${seedOf(row.id) * 37 + 11}/640/360`,
    creatorId: row.creatorId ?? null,
    categoryId: row.categoryId ?? null,
    liked: row.liked === true,
    saved: row.saved === true,
    lastPosition: position,
  }
}

/* ----------------------------------------------------------------- client */

export type VideoQuery = {
  search?: string
  category?: number
  access?: string
  /** 'mine' asks for the calling creator's own shelf rather than the catalogue. */
  scope?: string
}

function query(params: VideoQuery): string {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.category != null) search.set('category', String(params.category))
  if (params.access) search.set('access', params.access)
  if (params.scope) search.set('scope', params.scope)
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const catalogue = {
  videos: (params: VideoQuery, actorId: number | null, signal?: AbortSignal) =>
    request<ServerVideo[]>(`/api/videos${query(params)}`, { actorId, signal }),

  video: (id: number, actorId: number | null, signal?: AbortSignal) =>
    request<ServerVideo>(`/api/videos/${id}`, { actorId, signal }),

  categories: (signal?: AbortSignal) => request<ServerCategory[]>('/api/categories', { signal }),

  comments: (videoId: number, signal?: AbortSignal) =>
    request<ServerComment[]>(`/api/videos/${videoId}/comments`, { signal }),

  addComment: (videoId: number, text: string, actorId: number | null, parentId?: number) =>
    request<ServerComment>(`/api/videos/${videoId}/comments`, {
      method: 'POST',
      body: { text, parentId: parentId ?? null },
      actorId,
    }),

  editComment: (commentId: number, text: string, actorId: number | null) =>
    request<ServerComment>(`/api/comments/${commentId}`, { method: 'PUT', body: { text }, actorId }),

  deleteComment: (commentId: number, actorId: number | null) =>
    request<{ message: string }>(`/api/comments/${commentId}`, { method: 'DELETE', actorId }),

  /**
   * Both toggles answer with `active` — whether the flag is now on — and the
   * like also returns the new total. The names are the server's; they are
   * translated at the call site rather than guessed at here.
   */
  toggleLike: (videoId: number, actorId: number | null) =>
    request<{ active: boolean; count: number }>(`/api/videos/${videoId}/like`, {
      method: 'POST',
      actorId,
    }),

  toggleSaved: (videoId: number, actorId: number | null) =>
    request<{ active: boolean }>(`/api/videos/${videoId}/save`, { method: 'POST', actorId }),

  countView: (videoId: number) =>
    request<{ message: string }>(`/api/videos/${videoId}/view`, { method: 'POST' }),

  saveProgress: (videoId: number, position: number, completed: boolean, actorId: number | null) =>
    request<{ message: string }>(`/api/videos/${videoId}/progress`, {
      method: 'POST',
      body: { position: Math.round(position), completed },
      actorId,
    }),

  history: (actorId: number | null, signal?: AbortSignal) =>
    request<ServerHistoryEntry[]>('/api/history', { actorId, signal }),

  watchlist: (actorId: number | null, signal?: AbortSignal) =>
    request<ServerWatchlistEntry[]>('/api/watchlist', { actorId, signal }),
}

/* ----------------------------------------------------------------- studio */

export type PublishInput = {
  title: string
  description: string
  categoryId: number | null
  /** 'FREE' or 'PREMIUM'. */
  accessType: string
  /** 'PUBLISHED' for a live title, 'DRAFT' for one nobody can see yet. */
  status: string
  durationSeconds: number
  videoFile: File | null
  thumbnailFile: File | null
}

export const studio = {
  /**
   * Publish a title, with its file if one was chosen.
   *
   * Sent as multipart because the file and the record are one submission: a
   * record saved without its file is a title that cannot be played, and an
   * orphaned upload is worse.
   */
  publish: (input: PublishInput, actorId: number | null) => {
    const form = new FormData()
    form.append('title', input.title)
    form.append('description', input.description)
    if (input.categoryId != null) form.append('categoryId', String(input.categoryId))
    form.append('accessType', input.accessType)
    form.append('status', input.status)
    form.append('durationSeconds', String(Math.round(input.durationSeconds)))
    if (input.videoFile) form.append('videoFile', input.videoFile)
    if (input.thumbnailFile) form.append('thumbnailFile', input.thumbnailFile)
    return submitForm<{ id: number; message: string }>('/api/videos', form, actorId)
  },

  update: (
    id: number,
    changes: {
      title?: string
      description?: string
      categoryId?: number | null
      accessType?: string
      status?: string
    },
    actorId: number | null,
  ) => request<{ message: string }>(`/api/videos/${id}`, { method: 'PUT', body: changes, actorId }),

  remove: (id: number, actorId: number | null) =>
    request<{ message: string }>(`/api/videos/${id}`, { method: 'DELETE', actorId }),
}

/** The numeric id behind a `Video`, or null for a row that is not a server row. */
export const videoIdOf = (id: string): number | null => {
  const n = Number(id)
  return Number.isFinite(n) && String(n) === id ? n : null
}
