/**
 * Placeholder domain data for the Skopia prototype.
 *
 * Every title, name, figure and metric below is synthetic. PRODUCT.md records
 * which product facts the documentation leaves open — plan prices, gateway
 * provider, accepted formats, impression definitions, retention thresholds.
 * Those are never given a made-up value here; they carry UNDECIDED and the UI
 * renders them as a visible placeholder.
 */

export const UNDECIDED = '—' as const

export type Role = 'guest' | 'viewer' | 'creator' | 'marketing' | 'support' | 'admin'

export const ROLES: Record<Role, { label: string; short: string; home: string }> = {
  guest: { label: 'Guest Viewer', short: 'Guest', home: '/' },
  viewer: { label: 'Registered Viewer', short: 'Viewer', home: '/browse' },
  creator: { label: 'Content Creator', short: 'Creator', home: '/studio' },
  marketing: { label: 'Marketing Officer', short: 'Marketing', home: '/campaigns' },
  support: { label: 'Support Officer', short: 'Support', home: '/queue' },
  admin: { label: 'Platform Administrator', short: 'Admin', home: '/admin' },
}

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
  captions: string[]
  synopsis: string
  /** 0–1, where the viewer left off. 0 means never started. */
  progress?: number
  seed: number
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

export const VIDEOS: Video[] = [
  {
    id: 'v-1041',
    title: 'The Long Exposure',
    creator: 'Meridian Films',
    category: 'Documentary',
    genre: 'Science',
    runtime: '48:12',
    published: '2026-08-02',
    views: 184920,
    likes: 12480,
    comments: 842,
    premium: true,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis:
      'A feature-length look at the people who keep the world’s oldest observatories running, shot over four winters.',
    progress: 0.42,
    seed: 3,
  },
  {
    id: 'v-1042',
    title: 'Salt and Iron',
    creator: 'Harbour Studio',
    category: 'Short Film',
    genre: 'Drama',
    runtime: '17:05',
    published: '2026-08-11',
    views: 62140,
    likes: 5310,
    comments: 219,
    premium: false,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis: 'Two shipwrights disagree about a hull, and about everything else.',
    seed: 7,
  },
  {
    id: 'v-1043',
    title: 'Understory',
    creator: 'Fern & Field',
    category: 'Documentary',
    genre: 'Nature',
    runtime: '31:40',
    published: '2026-07-28',
    views: 98330,
    likes: 8905,
    comments: 401,
    premium: false,
    billing: 'HELD OVER',
    captions: ['English'],
    synopsis: 'What happens on a forest floor in the eleven months nobody is filming it.',
    progress: 0.88,
    seed: 11,
  },
  {
    id: 'v-1044',
    title: 'Signal Path',
    creator: 'Northbound',
    category: 'Series',
    genre: 'Technology',
    runtime: '24:18',
    published: '2026-08-14',
    views: 240110,
    likes: 19004,
    comments: 1263,
    premium: true,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis: 'Episode 3. How a packet actually gets from a studio in Colombo to a screen in Oslo.',
    seed: 2,
  },
  {
    id: 'v-1045',
    title: 'Rooms We Left',
    creator: 'Aster Lane',
    category: 'Short Film',
    genre: 'Drama',
    runtime: '12:52',
    published: '2026-08-19',
    views: 14220,
    likes: 1740,
    comments: 88,
    premium: false,
    billing: 'COMING SOON',
    captions: ['English'],
    synopsis: 'A house is cleared in one afternoon.',
    seed: 5,
  },
  {
    id: 'v-1046',
    title: 'The Tuning Hour',
    creator: 'Cadence Hall',
    category: 'Music',
    genre: 'Performance',
    runtime: '58:30',
    published: '2026-07-12',
    views: 71890,
    likes: 6620,
    comments: 310,
    premium: true,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis: 'An orchestra before the audience arrives.',
    progress: 0.15,
    seed: 9,
  },
  {
    id: 'v-1047',
    title: 'Groundwork',
    creator: 'Meridian Films',
    category: 'Learning',
    genre: 'History',
    runtime: '39:44',
    published: '2026-06-30',
    views: 45010,
    likes: 3980,
    comments: 152,
    premium: false,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis: 'Six buildings, and the arguments that produced them.',
    seed: 13,
  },
  {
    id: 'v-1048',
    title: 'Night Shift Comedy',
    creator: 'Basement Tapes',
    category: 'Talk',
    genre: 'Comedy',
    runtime: '52:07',
    published: '2026-08-21',
    views: 133470,
    likes: 14220,
    comments: 967,
    premium: false,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis: 'Recorded at 2am, as intended.',
    seed: 4,
  },
  {
    id: 'v-1049',
    title: 'Cold Chain',
    creator: 'Northbound',
    category: 'Documentary',
    genre: 'Science',
    runtime: '44:03',
    published: '2026-05-18',
    views: 88120,
    likes: 7410,
    comments: 288,
    premium: true,
    billing: 'HELD OVER',
    captions: ['English'],
    synopsis: 'A vaccine travels four thousand kilometres without ever going above eight degrees.',
    seed: 8,
  },
  {
    id: 'v-1050',
    title: 'Paper Tigers',
    creator: 'Harbour Studio',
    category: 'Series',
    genre: 'Drama',
    runtime: '28:55',
    published: '2026-08-23',
    views: 9940,
    likes: 880,
    comments: 41,
    premium: false,
    billing: 'IN REVIEW',
    captions: [],
    synopsis: 'Episode 1. A local paper runs one story too many.',
    seed: 6,
  },
  {
    id: 'v-1051',
    title: 'Tidewater',
    creator: 'Fern & Field',
    category: 'Documentary',
    genre: 'Nature',
    runtime: '36:21',
    published: '2026-04-09',
    views: 52300,
    likes: 4870,
    comments: 173,
    premium: false,
    billing: 'PULLED',
    captions: ['English'],
    synopsis: 'Withdrawn pending a rights review.',
    seed: 12,
  },
  {
    id: 'v-1052',
    title: 'Build Order',
    creator: 'Basement Tapes',
    category: 'Learning',
    genre: 'Technology',
    runtime: '21:36',
    published: '2026-08-25',
    views: 30760,
    likes: 2910,
    comments: 134,
    premium: false,
    billing: 'NOW SHOWING',
    captions: ['English'],
    synopsis: 'How a small team ships a release every Thursday.',
    seed: 10,
  },
]

export const byId = (id: string) => VIDEOS.find((v) => v.id === id)

/* ------------------------------------------------------------ subscription */

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

export const PLANS: Plan[] = [
  {
    id: 'plan-free',
    name: 'Lobby',
    provisional: true,
    price: UNDECIDED,
    cadence: UNDECIDED,
    entitlements: ['Public catalogue', 'Watchlist and history', 'Advertisements shown'],
    current: true,
  },
  {
    id: 'plan-pass',
    name: 'Season Pass',
    provisional: true,
    price: UNDECIDED,
    cadence: UNDECIDED,
    entitlements: ['Everything in Lobby', 'Premium titles', 'No advertisements'],
  },
  {
    id: 'plan-house',
    name: 'House Pass',
    provisional: true,
    price: UNDECIDED,
    cadence: UNDECIDED,
    entitlements: ['Everything in Season Pass', 'Up to four profiles', 'Early access to premieres'],
  },
]

export type Payment = {
  id: string
  date: string
  plan: string
  amount: typeof UNDECIDED
  status: 'Settled' | 'Refunded' | 'Failed' | 'Pending'
  method: string
}

export const PAYMENTS: Payment[] = [
  { id: 'TXN-90412', date: '2026-08-01', plan: 'Season Pass', amount: UNDECIDED, status: 'Settled', method: 'Card ••4417' },
  { id: 'TXN-89330', date: '2026-07-01', plan: 'Season Pass', amount: UNDECIDED, status: 'Settled', method: 'Card ••4417' },
  { id: 'TXN-88105', date: '2026-06-01', plan: 'Season Pass', amount: UNDECIDED, status: 'Refunded', method: 'Card ••4417' },
  { id: 'TXN-87002', date: '2026-05-01', plan: 'Lobby', amount: UNDECIDED, status: 'Failed', method: 'Card ••1190' },
]

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

export const REPORTS: Report[] = [
  {
    id: 'RPT-2291',
    subject: 'Captions out of sync after 04:12',
    type: 'Accessibility',
    target: 'v-1041',
    submitted: '2026-08-22',
    status: 'Under review',
    priority: 'High',
    assignee: 'D. Fernando',
    reporter: 'you',
    detail: 'English captions drift roughly two seconds late from 04:12 onward and never recover.',
    history: [
      { at: '2026-08-22 09:14', who: 'You', what: 'Report submitted' },
      { at: '2026-08-22 11:02', who: 'System', what: 'Assigned to Support queue' },
      { at: '2026-08-23 08:40', who: 'D. Fernando', what: 'Accepted · priority set to High' },
    ],
  },
  {
    id: 'RPT-2288',
    subject: 'Playback stops at 00:58 on mobile',
    type: 'Playback problem',
    target: 'v-1044',
    submitted: '2026-08-20',
    status: 'Resolved',
    priority: 'Normal',
    assignee: 'D. Fernando',
    reporter: 'you',
    detail: 'Stream halts just under a minute in and the player shows no error.',
    history: [
      { at: '2026-08-20 19:31', who: 'You', what: 'Report submitted' },
      { at: '2026-08-21 10:15', who: 'D. Fernando', what: 'Accepted' },
      { at: '2026-08-24 16:22', who: 'D. Fernando', what: 'Resolution recorded · transcode replaced' },
    ],
  },
  {
    id: 'RPT-2301',
    subject: 'Misleading thumbnail',
    type: 'Inappropriate content',
    target: 'v-1050',
    submitted: '2026-08-25',
    status: 'Submitted',
    priority: 'Normal',
    reporter: 'r.perera',
    detail: 'The thumbnail shows a scene that is not in the episode.',
    history: [{ at: '2026-08-25 07:55', who: 'r.perera', what: 'Report submitted' }],
  },
  {
    id: 'RPT-2303',
    subject: 'Comment section abuse on episode 3',
    type: 'Inappropriate content',
    target: 'v-1044',
    submitted: '2026-08-26',
    status: 'Needs info',
    priority: 'Urgent',
    assignee: 'S. Wijesinghe',
    reporter: 'm.silva',
    detail: 'Repeated targeted abuse from one account across several threads.',
    history: [
      { at: '2026-08-26 06:12', who: 'm.silva', what: 'Report submitted' },
      { at: '2026-08-26 08:30', who: 'S. Wijesinghe', what: 'Accepted · priority set to Urgent' },
      { at: '2026-08-26 09:05', who: 'S. Wijesinghe', what: 'Requested the specific thread links' },
    ],
  },
]

/* ------------------------------------------------------------ notifications */

export type Notification = {
  id: string
  kind: 'new-video' | 'subscription' | 'complaint' | 'announcement'
  title: string
  body: string
  at: string
  read: boolean
}

export const NOTIFICATIONS: Notification[] = [
  { id: 'n-1', kind: 'complaint', title: 'RPT-2288 resolved', body: 'A new transcode replaced the faulty one. Thank you for the report.', at: '2 days ago', read: false },
  { id: 'n-2', kind: 'new-video', title: 'Signal Path · Episode 3', body: 'Northbound published a new episode in a series you follow.', at: '3 days ago', read: false },
  { id: 'n-3', kind: 'subscription', title: 'Payment settled', body: 'TXN-90412 settled against your Season Pass.', at: '1 week ago', read: true },
  { id: 'n-4', kind: 'announcement', title: 'Scheduled maintenance', body: 'Playback may be briefly interrupted on Sunday between 02:00 and 03:00.', at: '1 week ago', read: true },
]

export type Announcement = {
  id: string
  title: string
  body: string
  audience: 'Everyone' | 'Subscribers' | 'Creators'
  status: 'Published' | 'Draft' | 'Scheduled'
  published?: string
}

export const ANNOUNCEMENTS: Announcement[] = [
  { id: 'a-1', title: 'Scheduled maintenance', body: 'Playback may be briefly interrupted on Sunday between 02:00 and 03:00.', audience: 'Everyone', status: 'Published', published: '2026-08-18' },
  { id: 'a-2', title: 'Captions now required on new uploads', body: 'New video records must carry at least one caption track before they can be published.', audience: 'Creators', status: 'Published', published: '2026-08-05' },
  { id: 'a-3', title: 'Premiere week', body: 'Draft — audience and schedule not yet decided.', audience: 'Subscribers', status: 'Draft' },
]

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

export const CAMPAIGNS: Campaign[] = [
  { id: 'CMP-410', name: 'Autumn Season Launch', advertiser: 'Meridian Films', status: 'Active', start: '2026-08-15', end: '2026-09-15', placement: 'Pre-roll', targets: ['Documentary', 'Science'], impressions: 412_880, clicks: 9_140, media: 'Video', link: 'https://example.invalid/autumn' },
  { id: 'CMP-408', name: 'Cadence Hall Residency', advertiser: 'Cadence Hall', status: 'Active', start: '2026-08-01', end: '2026-09-30', placement: 'Lobby standee', targets: ['Music', 'Performance'], impressions: 188_420, clicks: 3_310, media: 'Image', link: 'https://example.invalid/cadence' },
  { id: 'CMP-399', name: 'Winter Learning Push', advertiser: 'Groundwork Press', status: 'Scheduled', start: '2026-09-20', end: '2026-10-20', placement: 'Pre-roll', targets: ['Learning'], impressions: 0, clicks: 0, media: 'Video', link: 'https://example.invalid/winter' },
  { id: 'CMP-381', name: 'Midsummer Shorts', advertiser: 'Harbour Studio', status: 'Expired', start: '2026-06-01', end: '2026-07-31', placement: 'Mid-roll', targets: ['Short Film', 'Drama'], impressions: 301_550, clicks: 6_020, media: 'Video', link: 'https://example.invalid/shorts' },
  { id: 'CMP-374', name: 'Basement Tapes Live', advertiser: 'Basement Tapes', status: 'Paused', start: '2026-07-10', end: '2026-09-10', placement: 'Pre-roll', targets: ['Talk', 'Comedy'], impressions: 96_700, clicks: 1_880, media: 'Image', link: 'https://example.invalid/basement' },
]

/* ------------------------------------------------------------------- admin */

export type Account = {
  id: string
  name: string
  handle: string
  role: Role
  status: 'Active' | 'Suspended' | 'Blocked' | 'Invited'
  joined: string
  lastSeen: string
}

export const ACCOUNTS: Account[] = [
  { id: 'u-1001', name: 'Punsara P. S.', handle: 'p.punsara', role: 'admin', status: 'Active', joined: '2026-02-11', lastSeen: '4 min ago' },
  { id: 'u-1002', name: 'Laknadi K. S. S.', handle: 'k.laknadi', role: 'support', status: 'Active', joined: '2026-02-11', lastSeen: '1 h ago' },
  { id: 'u-1003', name: 'Dhananjana W. M. I.', handle: 'd.fernando', role: 'support', status: 'Active', joined: '2026-03-02', lastSeen: '12 min ago' },
  { id: 'u-1004', name: 'Madhusara J. P. M.', handle: 'm.madhusara', role: 'marketing', status: 'Active', joined: '2026-03-20', lastSeen: '2 h ago' },
  { id: 'u-1005', name: 'Meridian Films', handle: 'meridian', role: 'creator', status: 'Active', joined: '2026-04-01', lastSeen: 'yesterday' },
  { id: 'u-1006', name: 'Harbour Studio', handle: 'harbour', role: 'creator', status: 'Active', joined: '2026-04-14', lastSeen: '3 days ago' },
  { id: 'u-1007', name: 'R. Perera', handle: 'r.perera', role: 'viewer', status: 'Active', joined: '2026-05-06', lastSeen: '20 min ago' },
  { id: 'u-1008', name: 'M. Silva', handle: 'm.silva', role: 'viewer', status: 'Suspended', joined: '2026-05-19', lastSeen: '1 week ago' },
  { id: 'u-1009', name: 'Basement Tapes', handle: 'basement', role: 'creator', status: 'Active', joined: '2026-06-02', lastSeen: '5 h ago' },
  { id: 'u-1010', name: 'T. Nadeeka', handle: 't.nadeeka', role: 'viewer', status: 'Blocked', joined: '2026-06-28', lastSeen: '3 weeks ago' },
]

/** UC-FR6-01: the permission matrix detail is explicitly undecided. */
export const PERMISSIONS = [
  'Browse and watch',
  'Comment and rate',
  'Manage own videos',
  'Manage any video',
  'Manage campaigns',
  'Work complaint queue',
  'Administer plans and refunds',
  'Manage accounts and roles',
  'Change platform settings',
] as const

export const ROLE_MATRIX: Record<Exclude<Role, 'guest'>, boolean[]> = {
  //          watch  comment  own   any   camp  queue  plans  accts  settings
  viewer:    [true,  true,   false, false, false, false, false, false, false],
  creator:   [true,  true,   true,  false, false, false, false, false, false],
  marketing: [true,  true,   false, false, true,  false, false, false, false],
  support:   [true,  true,   false, false, false, true,  false, false, false],
  admin:     [true,  true,   true,  true,  true,  true,  true,  true,  true],
}

export type LogEntry = {
  at: string
  actor: string
  action: string
  target: string
  outcome: 'ok' | 'rejected'
}

export const LOGS: LogEntry[] = [
  { at: '2026-08-26 09:41:12', actor: 'p.punsara', action: 'role.update', target: 'u-1004 → marketing', outcome: 'ok' },
  { at: '2026-08-26 09:12:05', actor: 's.wijesinghe', action: 'complaint.priority', target: 'RPT-2303 → Urgent', outcome: 'ok' },
  { at: '2026-08-26 08:30:44', actor: 'd.fernando', action: 'complaint.assign', target: 'RPT-2291', outcome: 'ok' },
  { at: '2026-08-25 22:18:30', actor: 'm.madhusara', action: 'campaign.publish', target: 'CMP-399', outcome: 'ok' },
  { at: '2026-08-25 17:04:09', actor: 'harbour', action: 'video.publish', target: 'v-1050', outcome: 'rejected' },
  { at: '2026-08-25 16:58:51', actor: 'harbour', action: 'video.create', target: 'v-1050', outcome: 'ok' },
  { at: '2026-08-24 16:22:17', actor: 'd.fernando', action: 'complaint.resolve', target: 'RPT-2288', outcome: 'ok' },
  { at: '2026-08-24 11:03:02', actor: 'p.punsara', action: 'account.suspend', target: 'u-1008', outcome: 'ok' },
  { at: '2026-08-23 14:47:39', actor: 'p.punsara', action: 'video.moderate', target: 'v-1051 → PULLED', outcome: 'ok' },
  { at: '2026-08-22 11:02:55', actor: 'system', action: 'report.route', target: 'RPT-2291', outcome: 'ok' },
]

export const COMMENTS = [
  { id: 'c-1', who: 'R. Perera', at: '2 days ago', body: 'The winter footage in the third act is extraordinary. Who shot it?', likes: 42 },
  { id: 'c-2', who: 'T. Nadeeka', at: '4 days ago', body: 'Captions drift after about four minutes — reported it.', likes: 18 },
  { id: 'c-3', who: 'Meridian Films', at: '4 days ago', body: 'Thanks for flagging — a fix is with the support team.', likes: 61 },
]

/* ------------------------------------------------------------------ helpers */

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`

export const featured = VIDEOS.filter((v) => v.billing === 'NOW SHOWING')
export const continueWatching = VIDEOS.filter((v) => typeof v.progress === 'number')
