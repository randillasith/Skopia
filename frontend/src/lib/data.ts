import { channelById } from './session'

/** Shared domain types and presentation helpers. Runtime records come from APIs. */

export const UNDECIDED = '—' as const

/* ---------------------------------------------------------------- catalogue */

/** The letterboard vocabulary. One lifecycle word per state, everywhere. */
export type Billing = 'NOW SHOWING' | 'COMING SOON' | 'HELD OVER' | 'PULLED' | 'IN REVIEW'

export const BILLING_TONE: Record<Billing, 'live' | 'soon' | 'held' | 'dead' | 'review'> = {
  'NOW SHOWING': 'live',
  'COMING SOON': 'soon',
  'HELD OVER': 'held',
  PULLED: 'dead',
  'IN REVIEW': 'review',
}

export type Video = {
  id: string
  title: string
  creator: string
  category: string
  genre: string
  runtime: string
  published: string
  views: number
  likes: number
  comments: number
  premium: boolean
  billing: Billing
  /** Backend publication/moderation status; unlike billing, preserves private and archived distinctions. */
  status?: string | null
  captions: string[]
  synopsis: string
  /** 0–1, where the viewer left off. 0 means never started. */
  progress?: number
  seed: number

  /* ---- the parts only a row that came from the server carries ---- */

  /** Where the media actually is. Null when the row has no file behind it. */
  mediaUrl?: string | null
  thumbnailUrl?: string | null
  creatorId?: number | null
  categoryId?: number | null
  /** What the server says this viewer has already done with the title. */
  liked?: boolean
  saved?: boolean
  /** Seconds in, as the server last recorded it. */
  lastPosition?: number
}

export const CATEGORIES = [
  'Documentary',
  'Short Film',
  'Series',
  'Talk',
  'Music',
  'Learning',
] as const

export const GENRES = [
  'Science',
  'Drama',
  'Nature',
  'Technology',
  'History',
  'Performance',
  'Comedy',
] as const

export type Plan = {
  id: string
  /**
   * A working name only. Plan names, prices, durations and entitlements are all
   * listed together as open decisions in the project documentation, so the name
   * and the entitlement list are rendered as provisional, not as fact.
   */
  name: string
  provisional: true
  price: typeof UNDECIDED
  cadence: typeof UNDECIDED
  entitlements: string[]
  current?: boolean
}

export const PLANS: Plan[] = []

export type Payment = {
  id: string
  date: string
  plan: string
  amount: typeof UNDECIDED
  status: 'Settled' | 'Refunded' | 'Failed' | 'Pending'
  method: string
}

export const PAYMENTS: Payment[] = []

/* -------------------------------------------------------- reports/complaints */

export type ReportStatus = 'Submitted' | 'Under review' | 'Resolved' | 'Closed' | 'Needs info'
export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent'

export type Report = {
  id: string
  subject: string
  type: 'Inappropriate content' | 'Playback problem' | 'Accessibility' | 'Other'
  target?: string
  submitted: string
  status: ReportStatus
  priority: Priority
  assignee?: string
  reporter: string
  detail: string
  history: { at: string; who: string; what: string }[]
}

export const REPORTS: Report[] = []

/* ------------------------------------------------------------ notifications */

export type Notification = {
  id: string
  kind: 'new-video' | 'subscription' | 'complaint' | 'announcement'
  title: string
  body: string
  at: string
  read: boolean
}

export const NOTIFICATIONS: Notification[] = []

export type Announcement = {
  id: string
  title: string
  body: string
  audience: 'Everyone' | 'Subscribers' | 'Creators'
  status: 'Published' | 'Draft' | 'Scheduled'
  published?: string
}

export const ANNOUNCEMENTS: Announcement[] = []

/* -------------------------------------------------------------- advertising */

export type Campaign = {
  id: string
  name: string
  advertiser: string
  status: 'Active' | 'Scheduled' | 'Expired' | 'Paused' | 'Draft'
  start: string
  end: string
  placement: 'Pre-roll' | 'Mid-roll' | 'Lobby standee'
  targets: string[]
  impressions: number
  clicks: number
  media: 'Video' | 'Image'
  link: string
}

export const CAMPAIGNS: Campaign[] = []

/* ------------------------------------------------------------------- admin */

/**
 * Accounts, the staff/channel/moderator grants and the permission table now live
 * in lib/session.ts. They were moved out because a single flat role column could
 * not express a moderator whose authority stops at one channel.
 */

export type LogEntry = {
  at: string
  actor: string
  action: string
  target: string
  outcome: 'ok' | 'rejected'
}

export const LOGS: LogEntry[] = []

/**
 * `pinned` and `hearted` are the channel owner's two signals: one says read this
 * first, the other says the creator saw you. Both belong to the channel, not the
 * platform, which is why moderators can neither pin nor heart.
 */
export type Comment = {
  id: string
  who: string
  at: string
  body: string
  likes: number
  pinned?: boolean
  hearted?: boolean
  byCreator?: boolean
  replies?: number
}

export const COMMENTS: Comment[] = []

/* ------------------------------------------------------------------ helpers */

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`


/* ------------------------------------------------------- channel moderation */

/**
 * Comments awaiting a channel moderator. Scoped to a channel, never platform
 * wide — a moderator sees only the channels whose owner granted them the role.
 */
export type PendingComment = {
  id: string
  channelId: string
  video: string
  who: string
  at: string
  body: string
  flag: 'Reported by a viewer' | 'Held by a filter' | 'First comment from this account'
}

export const MODERATION_QUEUE: PendingComment[] = []

export type ModerationDecision = {
  id: string
  channelId: string
  video: string
  who: string
  at: string
  by: string
  outcome: 'Published' | 'Removed' | 'Author blocked'
  note: string
}

export const MODERATION_LOG: ModerationDecision[] = []

/* ------------------------------------------------------------------ chapters */

/** Seconds → "M:SS" or "H:MM:SS". */
export const clock = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** "48:12" or "1:12:40" → seconds. */
export const seconds = (runtime: string) =>
  runtime.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)

export type Chapter = { at: number; title: string }

/**
 * Authored chapters, for the few titles that have them. A video without
 * chapters shows a plain scrubber — chapters are something a creator writes,
 * not something the platform invents, so an empty list is the honest default.
 */
export const CHAPTERS: Record<string, Chapter[]> = {}

export const chaptersFor = (id: string): Chapter[] => CHAPTERS[id] ?? []

/** Speeds a viewer can choose. 1 is not labelled "1×" but "Normal". */
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

/**
 * UC-FR1-01: the playback quality levels are an open decision in the project
 * documentation, so the control exists and says so rather than inventing a
 * ladder of resolutions the backend may never serve.
 */
export const QUALITY_UNDECIDED = true

/* --------------------------------------------------- access, live, identity */

/**
 * How a title is gated.
 *
 * `free` and `pass` are the only two states the documentation actually supports:
 * something is open to everyone, or it needs an active pass. The Stitch drafts
 * went further and invented per-category passes at named prices — a Music Pass
 * at $8.99, an All-Access Master at $19.99 — but plan names, prices and
 * entitlements are recorded as undecided in PRODUCT.md, so the badge says which
 * of the two states applies and stops there.
 */
export type Access = 'free' | 'pass'
export const accessOf = (v: Video): Access => (v.premium ? 'pass' : 'free')

/** Channels whose identity the platform has checked. */
export const isVerified = (_name: string, creatorId?: number | null) => creatorId != null && channelById(String(creatorId))?.verified === true

/**
 * Live broadcasts. A live title has no fixed runtime and no resume position, so
 * it is kept as a separate list rather than as another flag on Video — a "live"
 * boolean would quietly make runtime and progress meaningless on those records.
 */
export type Live = {
  id: string
  title: string
  creator: string
  category: string
  watching: number
  startedAt: string
  seed: number
  premium: boolean
}

export const LIVE: Live[] = []

/** Hashtags, authored per title rather than derived from the category. */
export const TAGS: Record<string, string[]> = {}
export const tagsFor = (id: string) => TAGS[id] ?? []
