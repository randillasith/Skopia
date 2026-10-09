/**
 * Identity, and the three independent things that can be true about an account.
 *
 * Skopia uses session-based login. Everyone who signs up gets the same kind of
 * account; nothing about it is special at creation. What an account can do on top
 * of watching comes from three separate grants that do not imply one another:
 *
 *   1. STAFF ROLE     — granted by an administrator. Platform-wide.
 *   2. CHANNEL        — created by the account holder. No approval step.
 *   3. MODERATOR      — granted by a channel's owner, and scoped to that channel.
 *
 * They are deliberately not one enum. A person can own a channel and moderate
 * somebody else's; a support officer can own a channel too. Collapsing these into a
 * single role field is what makes a permission model start lying: it forces a
 * moderator to look platform-wide when the grant only ever covered one channel.
 */

/* ------------------------------------------------------------------- roles */

/** Platform roles. Only an administrator grants these. */
export type StaffRole = 'marketing' | 'support' | 'admin'

export const STAFF_ROLES: Record<StaffRole, { label: string; console: string; home: string }> = {
  marketing: { label: 'Marketing Officer', console: 'The Box Office', home: '/campaigns' },
  support: { label: 'Support Officer', console: 'The House Log', home: '/queue' },
  admin: { label: 'Administrator', console: 'The Projection Booth', home: '/admin' },
}

/* ---------------------------------------------------------------- channels */

export type Channel = {
  id: string
  name: string
  handle: string
  created: string
  /** Account ids the owner has given moderator rights on this channel. */
  moderators: string[]
  tagline: string
  about: string
  subscribers: number | null
  verified?: boolean
  location: string
}

/** Public channel directory, populated from the server alongside the catalogue. */
export let CHANNELS: Channel[] = []
const channelListeners = new Set<() => void>()
export const channelSnapshot = () => CHANNELS
export const subscribeChannels = (listener: () => void) => { channelListeners.add(listener); return () => { channelListeners.delete(listener) } }
export function replaceChannels(rows: Channel[]) { CHANNELS = rows; channelListeners.forEach(listener => listener()) }

export const channelById = (id: string | null) => CHANNELS.find((c) => c.id === id) ?? null
export const channelByHandle = (h: string) => CHANNELS.find((c) => c.handle === h) ?? null
/** Videos carry a creator name, which is the channel's display name. */
export const channelByName = (n: string) => CHANNELS.find((c) => c.name === n) ?? null

/* ---------------------------------------------------------------- accounts */

export type AccountStatus = 'Active' | 'Suspended' | 'Blocked' | 'Invited'

export type Account = {
  id: string
  name: string
  handle: string
  email: string
  joined: string
  lastSeen: string
  status: AccountStatus
  /** Granted by an administrator. Empty for almost every account. */
  staff: StaffRole[]
  /** Set when the holder creates a channel. Nobody approves it. */
  channelId: string | null
  /**
   * The account's id on the server, which is what every API call identifies the
   * caller by.
   */
  userId?: number | null
  /** The legal name, kept apart from `name`, which is what others see. */
  firstName?: string | null
  lastName?: string | null
  /** The server calls this account a content creator, whatever it owns here. */
  isContentCreator?: boolean
  isPremium?: boolean
  isVerified?: boolean
}

/** The id to send as X-User-Id, or null when this session cannot act server-side. */
export const actorId = (v: Viewer): number | null => v?.userId ?? null

export const ACCOUNTS: Account[] = []

export const accountById = (id: string) => ACCOUNTS.find((a) => a.id === id) ?? null

/* ------------------------------------------------------------ capabilities */

/** A session is an account, or nobody. `null` is a guest — not a role. */
export type Viewer = Account | null

export const isSignedIn = (v: Viewer): v is Account => v !== null
export const hasStaff = (v: Viewer, role: StaffRole) => !!v?.staff.includes(role)
/** An administrator reaches every staff console; the other two do not overlap. */
export const canStaff = (v: Viewer, role: StaffRole) => hasStaff(v, role) || hasStaff(v, 'admin')
export const ownedChannel = (v: Viewer) => (v?.isContentCreator ? channelById(String(v.userId)) : null)
/** Owning a channel here, or being a creator account on the server. */
export const isCreator = (v: Viewer) => ownedChannel(v) !== null || v?.isContentCreator === true

/** Channels this account moderates but does not own. */
export const moderatedChannels = (v: Viewer) =>
  v ? CHANNELS.filter((c) => c.moderators.includes(v.id) && c.id !== v.channelId) : []
export const isModerator = (v: Viewer) => moderatedChannels(v).length > 0

/** The one line that names what somebody is, longest grant first. */
export function describe(v: Viewer): string {
  if (!v) return 'Not signed in'
  const parts: string[] = []
  for (const r of v.staff) parts.push(STAFF_ROLES[r].label)
  const own = ownedChannel(v)
  if (own) parts.push(`Creator · ${own.name}`)
  const mod = moderatedChannels(v)
  if (mod.length === 1) parts.push(`Moderator · ${mod[0].name}`)
  else if (mod.length > 1) parts.push(`Moderator · ${mod.length} channels`)
  return parts.length ? parts.join('  ·  ') : 'Viewer'
}

/** Where an account lands after signing in. */
export function homeFor(v: Viewer): string {
  if (!v) return '/'
  for (const r of ['admin', 'support', 'marketing'] as StaffRole[]) {
    if (v.staff.includes(r)) return STAFF_ROLES[r].home
  }
  return '/browse'
}

/* ------------------------------------------------------- the grants, shown */

/**
 * What the administration console shows in place of a role/permission grid.
 * `by` is the part a flat matrix cannot express and the part people get wrong.
 */
export const GRANTS: {
  what: string
  scope: 'Everyone' | 'Account' | 'Channel' | 'Platform'
  by: string
}[] = [
  { what: 'Browse and watch the free programme', scope: 'Everyone', by: 'No account needed' },
  { what: 'Comment, rate and keep a watchlist', scope: 'Account', by: 'Signing up' },
  { what: 'Report a title or a playback fault', scope: 'Account', by: 'Signing up' },
  { what: 'Hold a pass and see its receipts', scope: 'Account', by: 'Signing up' },
  { what: 'Publish and manage videos', scope: 'Channel', by: 'Creating a channel' },
  { what: 'Grant moderators on a channel', scope: 'Channel', by: 'Owning that channel' },
  { what: "Moderate comments on a channel's videos", scope: 'Channel', by: 'That channel’s owner' },
  { what: 'Run advertising campaigns', scope: 'Platform', by: 'An administrator' },
  { what: 'Work the complaint queue', scope: 'Platform', by: 'An administrator' },
  { what: 'Administer plans and refunds', scope: 'Platform', by: 'An administrator' },
  { what: 'Grant and revoke staff roles', scope: 'Platform', by: 'An administrator' },
  { what: 'Change platform settings', scope: 'Platform', by: 'An administrator' },
]
