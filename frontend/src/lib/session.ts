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
  subscribers: number
  location: string
}

/**
 * Every creator in the catalogue has a channel, because a viewer who clicks a
 * name expects to arrive somewhere. Three of them are owned by accounts in
 * ACCOUNTS; the rest exist so the catalogue is not full of dead ends.
 */
export const CHANNELS: Channel[] = [
  { id: 'ch-01', name: 'Meridian Films', handle: 'meridian', created: '2026-04-01', moderators: ['u-1003', 'u-1007'],
    tagline: 'Long-form documentary, mostly outdoors, mostly in winter.',
    about: 'A four-person documentary outfit working out of Kandy. We shoot slowly — most films here took more than a year — and we publish when the cut is finished rather than to a schedule.',
    subscribers: 184_200, location: 'Kandy, Sri Lanka' },
  { id: 'ch-02', name: 'Harbour Studio', handle: 'harbour', created: '2026-04-14', moderators: [],
    tagline: 'Industry, ports, and the people who keep them running.',
    about: 'Harbour Studio makes films about work. Shipping, freight, repair, the night shift. Founded 2024.',
    subscribers: 96_400, location: 'Colombo, Sri Lanka' },
  { id: 'ch-03', name: 'Basement Tapes', handle: 'basement', created: '2026-06-02', moderators: ['u-1007'],
    tagline: 'Archive recovery and conversations that run long.',
    about: 'We find tape nobody has played in thirty years, work out who is on it, and then talk to whoever is still around.',
    subscribers: 141_900, location: 'Colombo, Sri Lanka' },
  { id: 'ch-04', name: 'Aster Lane', handle: 'asterlane', created: '2026-03-18', moderators: [],
    tagline: 'Short fiction, usually about strangers.',
    about: 'Two writers and a borrowed camera. Everything here is under half an hour.',
    subscribers: 52_700, location: 'Galle, Sri Lanka' },
  { id: 'ch-05', name: 'Cadence Hall', handle: 'cadence', created: '2026-02-09', moderators: [],
    tagline: 'One take, one room, no overdubs.',
    about: 'Live sessions recorded in empty halls, early in the morning, before anyone else arrives.',
    subscribers: 78_300, location: 'Colombo, Sri Lanka' },
  { id: 'ch-06', name: 'Fern & Field', handle: 'fernandfield', created: '2026-01-22', moderators: [],
    tagline: 'How things work, explained properly.',
    about: 'Science and craft, taken at the pace the subject actually needs. No thirty-second explainers.',
    subscribers: 402_100, location: 'Nuwara Eliya, Sri Lanka' },
  { id: 'ch-07', name: 'Northbound', handle: 'northbound', created: '2026-05-03', moderators: [],
    tagline: 'Episodic drama and the occasional long look at a trade.',
    about: 'Currently making Night Shift. New episodes most weeks while a series is running.',
    subscribers: 128_500, location: 'Jaffna, Sri Lanka' },
]

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
   * caller by. Null for the prototype identities below, which exist only in this
   * page and so cannot act on the server's behalf.
   */
  userId?: number | null
  /** The server calls this account a content creator, whatever it owns here. */
  isContentCreator?: boolean
  isPremium?: boolean
  isVerified?: boolean
}

/** The id to send as X-User-Id, or null when this session cannot act server-side. */
export const actorId = (v: Viewer): number | null => v?.userId ?? null

export const ACCOUNTS: Account[] = [
  { id: 'u-1001', name: 'Punsara P. S.', handle: 'p.punsara', email: 'p.punsara@skopia.test', joined: '2026-02-11', lastSeen: '4 min ago', status: 'Active', staff: ['admin'], channelId: null },
  { id: 'u-1002', name: 'Laknadi K. S. S.', handle: 'k.laknadi', email: 'k.laknadi@skopia.test', joined: '2026-02-11', lastSeen: '1 h ago', status: 'Active', staff: ['support'], channelId: null },
  { id: 'u-1003', name: 'Dhananjana W. M. I.', handle: 'd.fernando', email: 'd.fernando@skopia.test', joined: '2026-03-02', lastSeen: '12 min ago', status: 'Active', staff: [], channelId: null },
  { id: 'u-1004', name: 'Madhusara J. P. M.', handle: 'm.madhusara', email: 'm.madhusara@skopia.test', joined: '2026-03-20', lastSeen: '2 h ago', status: 'Active', staff: ['marketing'], channelId: null },
  { id: 'u-1005', name: 'Nimali Ratnayake', handle: 'meridian', email: 'nimali@meridianfilms.test', joined: '2026-04-01', lastSeen: 'yesterday', status: 'Active', staff: [], channelId: 'ch-01' },
  { id: 'u-1006', name: 'Harbour Studio', handle: 'harbour', email: 'post@harbour.test', joined: '2026-04-14', lastSeen: '3 days ago', status: 'Active', staff: [], channelId: 'ch-02' },
  { id: 'u-1007', name: 'R. Perera', handle: 'r.perera', email: 'r.perera@skopia.test', joined: '2026-05-06', lastSeen: '20 min ago', status: 'Active', staff: [], channelId: null },
  { id: 'u-1008', name: 'M. Silva', handle: 'm.silva', email: 'm.silva@skopia.test', joined: '2026-05-19', lastSeen: '1 week ago', status: 'Suspended', staff: [], channelId: null },
  { id: 'u-1009', name: 'Kasun Alwis', handle: 'basement', email: 'kasun@basementtapes.test', joined: '2026-06-02', lastSeen: '5 h ago', status: 'Active', staff: [], channelId: 'ch-03' },
  { id: 'u-1010', name: 'T. Nadeeka', handle: 't.nadeeka', email: 't.nadeeka@skopia.test', joined: '2026-06-28', lastSeen: '3 weeks ago', status: 'Blocked', staff: [], channelId: null },
]

export const accountById = (id: string) => ACCOUNTS.find((a) => a.id === id) ?? null

/* ------------------------------------------------------------ capabilities */

/** A session is an account, or nobody. `null` is a guest — not a role. */
export type Viewer = Account | null

export const isSignedIn = (v: Viewer): v is Account => v !== null
export const hasStaff = (v: Viewer, role: StaffRole) => !!v?.staff.includes(role)
/** An administrator reaches every staff console; the other two do not overlap. */
export const canStaff = (v: Viewer, role: StaffRole) => hasStaff(v, role) || hasStaff(v, 'admin')
export const ownedChannel = (v: Viewer) => (v ? channelById(v.channelId) : null)
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

/* ------------------------------------------------ the prototype identities */

/**
 * Sign-in is not wired to a backend, so the prototype switches between real
 * account shapes instead of between roles. The list is chosen to show that the
 * three grants are independent: u-1003 moderates a channel without owning one,
 * u-1007 both watches and moderates, and no staff role implies a channel.
 */
export const DEMO_IDENTITIES: { id: string | null; caption: string }[] = [
  { id: null, caption: 'Signed out — browsing as a guest' },
  { id: 'u-1007', caption: 'Ordinary account, moderates one channel' },
  { id: 'u-1008', caption: 'Ordinary account, suspended' },
  { id: 'u-1005', caption: 'Owns a channel' },
  { id: 'u-1003', caption: 'Moderates a channel, owns none' },
  { id: 'u-1004', caption: 'Staff — advertising' },
  { id: 'u-1002', caption: 'Staff — complaints' },
  { id: 'u-1001', caption: 'Staff — everything' },
]

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
