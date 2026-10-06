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
  /** Server visibility state; used in the creator's video settings. */
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

const RAW_VIDEOS: Video[] = [
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
  /* ---- the rest of the catalogue ------------------------------------- */
  { id: 'v-1053', title: 'The Breaking Yard', creator: 'Harbour Studio', category: 'Documentary', genre: 'History', runtime: '1:12:40', published: '2026-07-19', views: 96340, likes: 7120, comments: 431, premium: true, billing: 'NOW SHOWING', captions: ['English', 'Sinhala'], synopsis: 'Three generations of a shipbreaking family on the Gujarat coast, and the week the yard finally closed.', seed: 11 },
  { id: 'v-1054', title: 'The Quiet Bench', creator: 'Aster Lane', category: 'Short Film', genre: 'Drama', runtime: '14:08', published: '2026-08-30', views: 22180, likes: 3040, comments: 188, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'Two strangers share a park bench every Thursday for a year without exchanging a word.', progress: 0.77, seed: 12 },
  { id: 'v-1055', title: 'Night Shift — Episode 4', creator: 'Northbound', category: 'Series', genre: 'Drama', runtime: '42:55', published: '2026-09-04', views: 141020, likes: 10860, comments: 1204, premium: true, billing: 'NOW SHOWING', captions: ['English', 'Tamil'], synopsis: 'The ward loses power for eleven minutes. Nobody agrees afterwards on what happened in the dark.', seed: 13 },
  { id: 'v-1056', title: 'How a Lens Actually Works', creator: 'Fern & Field', category: 'Learning', genre: 'Science', runtime: '18:22', published: '2026-06-11', views: 310540, likes: 28400, comments: 2210, premium: false, billing: 'HELD OVER', captions: ['English', 'Sinhala', 'Tamil'], synopsis: 'Glass, curvature and light, explained with a bathtub and a laser pointer.', progress: 0.15, seed: 14 },
  { id: 'v-1057', title: 'Cadence Hall Sessions — Vol. II', creator: 'Cadence Hall', category: 'Music', genre: 'Performance', runtime: '06:41', published: '2026-09-12', views: 68920, likes: 9140, comments: 402, premium: false, billing: 'NOW SHOWING', captions: [], synopsis: 'A string quartet recorded in one take in an empty concert hall at six in the morning.', seed: 15 },
  { id: 'v-1058', title: 'What We Owe the River', creator: 'Meridian Films', category: 'Documentary', genre: 'Nature', runtime: '58:03', published: '2026-05-28', views: 214760, likes: 19240, comments: 1580, premium: true, billing: 'HELD OVER', captions: ['English'], synopsis: 'The Kelani flooded four times in two years. This follows the people who decided not to move.', seed: 16 },
  { id: 'v-1059', title: 'On Being Wrong in Public', creator: 'Basement Tapes', category: 'Talk', genre: 'Technology', runtime: '36:17', published: '2026-08-21', views: 87410, likes: 11020, comments: 1840, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'A retired engineer on the three bridges she signed off, and the one she would not sign today.', seed: 17 },
  { id: 'v-1060', title: 'Last Bus to Nuwara Eliya', creator: 'Aster Lane', category: 'Short Film', genre: 'Drama', runtime: '21:36', published: '2026-07-02', views: 45230, likes: 5410, comments: 297, premium: false, billing: 'NOW SHOWING', captions: ['English', 'Sinhala'], synopsis: 'A conductor works out that the woman in seat nine has been riding the same route for six days.', seed: 18 },
  { id: 'v-1061', title: 'Night Shift — Episode 5', creator: 'Northbound', category: 'Series', genre: 'Drama', runtime: '44:12', published: '2026-09-11', views: 128440, likes: 9980, comments: 1102, premium: true, billing: 'NOW SHOWING', captions: ['English', 'Tamil'], synopsis: 'Ravindra takes the blame. The rota for the following week arrives with one name missing.', seed: 19 },
  { id: 'v-1062', title: 'Bread, Twice Risen', creator: 'Fern & Field', category: 'Learning', genre: 'Science', runtime: '24:50', published: '2026-04-16', views: 402110, likes: 41200, comments: 3390, premium: false, billing: 'HELD OVER', captions: ['English', 'Sinhala'], synopsis: 'Why the second prove matters, told through eighteen loaves and one very patient baker.', progress: 1, seed: 20 },
  { id: 'v-1063', title: 'The Colombo Tapes', creator: 'Basement Tapes', category: 'Documentary', genre: 'History', runtime: '1:04:18', published: '2026-03-30', views: 176880, likes: 14760, comments: 1320, premium: true, billing: 'HELD OVER', captions: ['English', 'Sinhala', 'Tamil'], synopsis: 'Four hundred hours of reel-to-reel found in a demolished radio station, and the year spent identifying the voices.', seed: 21 },
  { id: 'v-1064', title: 'Rooftop, 5 a.m.', creator: 'Cadence Hall', category: 'Music', genre: 'Performance', runtime: '04:12', published: '2026-09-16', views: 31240, likes: 4820, comments: 214, premium: false, billing: 'NOW SHOWING', captions: [], synopsis: 'One song, one take, one camera, and the traffic starting up underneath.', seed: 22 },
  { id: 'v-1065', title: 'Anatomy of a Retraction', creator: 'Harbour Studio', category: 'Talk', genre: 'Science', runtime: '52:09', published: '2026-06-24', views: 64180, likes: 7340, comments: 986, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'The author of a withdrawn paper walks through every decision that led to it, slide by slide.', seed: 23 },
  { id: 'v-1066', title: 'Fifty Metres of Coast', creator: 'Meridian Films', category: 'Short Film', genre: 'Nature', runtime: '11:45', published: '2026-08-08', views: 38970, likes: 4610, comments: 238, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'The same stretch of shoreline, photographed every morning for a year, played back in eleven minutes.', seed: 24 },
  { id: 'v-1067', title: 'Night Shift — Episode 6', creator: 'Northbound', category: 'Series', genre: 'Drama', runtime: '46:30', published: '2026-09-18', views: 41260, likes: 3910, comments: 508, premium: true, billing: 'COMING SOON', captions: ['English'], synopsis: 'The inquiry opens. Everyone has had three weeks to decide what they remember.', seed: 25 },
  { id: 'v-1068', title: 'Reading a Circuit Board', creator: 'Fern & Field', category: 'Learning', genre: 'Technology', runtime: '31:07', published: '2026-05-09', views: 268330, likes: 24180, comments: 1960, premium: false, billing: 'HELD OVER', captions: ['English', 'Tamil'], synopsis: 'Start at the power rail and follow it. A repair shop owner explains what she looks at first.', progress: 0.33, seed: 26 },
  { id: 'v-1069', title: 'Three Weddings, One Kitchen', creator: 'Aster Lane', category: 'Documentary', genre: 'Nature', runtime: '49:55', published: '2026-07-27', views: 119640, likes: 13280, comments: 1044, premium: false, billing: 'NOW SHOWING', captions: ['English', 'Sinhala'], synopsis: 'A catering family works three receptions in one Saturday. Nothing goes to plan and everything arrives on time.', seed: 27 },
  { id: 'v-1070', title: 'The Understudy', creator: 'Cadence Hall', category: 'Short Film', genre: 'Performance', runtime: '17:29', published: '2026-06-02', views: 29840, likes: 3720, comments: 176, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'She has learned the part for two years. Tonight the call comes at the interval.', seed: 28 },
  { id: 'v-1071', title: 'Why Bridges Sing', creator: 'Basement Tapes', category: 'Learning', genre: 'Science', runtime: '15:38', published: '2026-09-09', views: 187250, likes: 21440, comments: 1608, premium: false, billing: 'NOW SHOWING', captions: ['English', 'Sinhala', 'Tamil'], synopsis: 'Resonance, wind and one famously wobbly footbridge, measured with a phone.', seed: 29 },
  { id: 'v-1072', title: 'A Studio Above the Bakery', creator: 'Cadence Hall', category: 'Talk', genre: 'Performance', runtime: '28:44', published: '2026-04-03', views: 52910, likes: 6180, comments: 394, premium: false, billing: 'HELD OVER', captions: ['English'], synopsis: 'Four musicians on recording in a room too small, above an oven that never turns off.', seed: 30 },
  { id: 'v-1073', title: 'Monsoon, Interrupted', creator: 'Meridian Films', category: 'Documentary', genre: 'Nature', runtime: '1:18:22', published: '2026-02-14', views: 341070, likes: 31820, comments: 2740, premium: true, billing: 'HELD OVER', captions: ['English', 'Sinhala', 'Tamil'], synopsis: 'The year the rains came six weeks late, followed across four farms and one meteorological office.', seed: 31 },
  { id: 'v-1074', title: 'Ten Minutes of Static', creator: 'Harbour Studio', category: 'Short Film', genre: 'Technology', runtime: '09:58', published: '2026-09-01', views: 18420, likes: 2140, comments: 141, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'A radio operator on a cargo ship keeps a channel open for someone who stopped answering in March.', seed: 32 },
  { id: 'v-1075', title: 'Counterpoint for Beginners', creator: 'Fern & Field', category: 'Learning', genre: 'Performance', runtime: '39:16', published: '2026-03-11', views: 96480, likes: 11340, comments: 872, premium: false, billing: 'HELD OVER', captions: ['English'], synopsis: 'Two melodies that should not work together, taken apart bar by bar at a kitchen piano.', seed: 33 },
  { id: 'v-1076', title: 'The Last Projectionist', creator: 'Northbound', category: 'Documentary', genre: 'History', runtime: '54:31', published: '2026-08-14', views: 158920, likes: 17620, comments: 1418, premium: true, billing: 'NOW SHOWING', captions: ['English', 'Sinhala'], synopsis: 'One man still threads 35mm for a living. The cinema he works in has four months left.', progress: 0.08, seed: 34 },
  { id: 'v-1077', title: 'Sessions — Vol. III', creator: 'Cadence Hall', category: 'Music', genre: 'Performance', runtime: '08:03', published: '2026-09-19', views: 9840, likes: 1620, comments: 88, premium: false, billing: 'COMING SOON', captions: [], synopsis: 'Recorded last Tuesday. Released whenever the mix stops bothering us.', seed: 35 },
  { id: 'v-1078', title: 'Field Notes: Wet Zone', creator: 'Fern & Field', category: 'Series', genre: 'Nature', runtime: '33:40', published: '2026-07-10', views: 74160, likes: 8290, comments: 604, premium: false, billing: 'NOW SHOWING', captions: ['English', 'Sinhala'], synopsis: 'Six weeks in the rainforest with two biologists, one camera trap and a great deal of rain.', seed: 36 },
  { id: 'v-1079', title: 'An Argument About Tea', creator: 'Aster Lane', category: 'Talk', genre: 'History', runtime: '44:58', published: '2026-05-21', views: 61370, likes: 7010, comments: 1126, premium: false, billing: 'NOW SHOWING', captions: ['English', 'Tamil'], synopsis: 'Two historians disagree, politely and at length, about who the plantations actually belonged to.', seed: 37 },
  { id: 'v-1080', title: 'Overnight Freight', creator: 'Harbour Studio', category: 'Series', genre: 'Technology', runtime: '38:12', published: '2026-06-18', views: 88730, likes: 9440, comments: 712, premium: true, billing: 'HELD OVER', captions: ['English'], synopsis: 'What moves through the port between midnight and six, and the eleven people who decide where it goes.', seed: 38 },
  { id: 'v-1081', title: 'Paper Boats', creator: 'Aster Lane', category: 'Short Film', genre: 'Comedy', runtime: '07:44', published: '2026-09-06', views: 26510, likes: 4180, comments: 263, premium: false, billing: 'NOW SHOWING', captions: ['English'], synopsis: 'A flooded street, two competitive neighbours, and a race that gets steadily out of hand.', seed: 39 },
  { id: 'v-1082', title: 'Everything at Once', creator: 'Basement Tapes', category: 'Music', genre: 'Performance', runtime: '05:27', published: '2026-08-25', views: 44290, likes: 6730, comments: 331, premium: false, billing: 'NOW SHOWING', captions: [], synopsis: 'Eleven musicians, one room, no click track, and a conductor who has given up.', seed: 40 },
  { id: 'v-1083', title: 'The Slow Repair', creator: 'Northbound', category: 'Learning', genre: 'Technology', runtime: '27:19', published: '2026-02-27', views: 133840, likes: 15180, comments: 1074, premium: false, billing: 'HELD OVER', captions: ['English', 'Sinhala'], synopsis: 'A watchmaker takes eight hours over a movement worth less than her time, and explains why.', seed: 41 },
  { id: 'v-1084', title: 'Draft — Untitled Rough Cut', creator: 'Harbour Studio', category: 'Documentary', genre: 'History', runtime: '41:03', published: '2026-09-17', views: 0, likes: 0, comments: 0, premium: false, billing: 'IN REVIEW', captions: [], synopsis: 'Submitted for review. Not visible to viewers until a decision is recorded.', seed: 42 },
]

export const VIDEOS: Video[] = RAW_VIDEOS.map((v) => ({
  ...v,
  thumbnailUrl: v.thumbnailUrl || `https://picsum.photos/seed/${v.seed * 37 + 11}/640/360`,
}))

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

export const COMMENTS: Comment[] = [
  { id: 'c-0', who: 'Meridian Films', at: '5 days ago', body: 'A note on the third act: the winter footage was shot over two separate seasons, four years apart, from the same position. The dome is the only thing in frame that did not change.', likes: 892, pinned: true, byCreator: true, replies: 34 },
  { id: 'c-1', who: 'R. Perera', at: '2 days ago', body: 'The winter footage in the third act is extraordinary. Who shot it?', likes: 42, hearted: true, replies: 3 },
  { id: 'c-2', who: 'T. Nadeeka', at: '4 days ago', body: 'Captions drift after about four minutes — reported it.', likes: 18, replies: 1 },
  { id: 'c-3', who: 'Meridian Films', at: '4 days ago', body: 'Thanks for flagging — a fix is with the support team.', likes: 61, byCreator: true },
  { id: 'c-4', who: 'Kasun Alwis', at: '6 days ago', body: 'Watched this twice. The second time with the commentary on the observatory logs open beside it, which I recommend.', likes: 128, replies: 7 },
]

/* ------------------------------------------------------------------ helpers */

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`

export const featured = VIDEOS.filter((v) => v.billing === 'NOW SHOWING')
export const continueWatching = VIDEOS.filter((v) => typeof v.progress === 'number')

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

export const MODERATION_QUEUE: PendingComment[] = [
  { id: 'm-1', channelId: 'ch-01', video: 'The Longest Winter', who: 'T. Nadeeka', at: '18 min ago', body: 'Captions drift after about four minutes — reported it.', flag: 'Reported by a viewer' },
  { id: 'm-2', channelId: 'ch-01', video: 'The Longest Winter', who: 'anon_4417', at: '1 h ago', body: 'Visit my page for free streams of everything on here', flag: 'Held by a filter' },
  { id: 'm-3', channelId: 'ch-01', video: 'The Breaking Yard', who: 'M. Silva', at: '3 h ago', body: 'Completely wasted my evening. Whoever cut this should not be allowed near an edit suite again.', flag: 'Reported by a viewer' },
  { id: 'm-4', channelId: 'ch-03', video: 'Night Shift', who: 'K. Fernando', at: '5 h ago', body: 'Is there a longer cut anywhere? The ending felt abrupt.', flag: 'First comment from this account' },
  { id: 'm-5', channelId: 'ch-01', video: 'Harbour Lights', who: 'anon_9902', at: 'yesterday', body: 'FIRST!!!! 🎉🎉🎉', flag: 'Held by a filter' },
]

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

export const MODERATION_LOG: ModerationDecision[] = [
  { id: 'd-1', channelId: 'ch-01', video: 'The Longest Winter', who: 'R. Perera', at: '2026-09-18 14:02', by: 'd.fernando', outcome: 'Published', note: 'Reported in error — ordinary criticism.' },
  { id: 'd-2', channelId: 'ch-01', video: 'The Breaking Yard', who: 'anon_3310', at: '2026-09-18 09:44', by: 'd.fernando', outcome: 'Removed', note: 'Advertising an unrelated service.' },
  { id: 'd-3', channelId: 'ch-03', video: 'Night Shift', who: 'anon_7781', at: '2026-09-17 21:15', by: 'r.perera', outcome: 'Author blocked', note: 'Third removal on this channel this week.' },
  { id: 'd-4', channelId: 'ch-01', video: 'Harbour Lights', who: 'M. Silva', at: '2026-09-17 11:30', by: 'd.fernando', outcome: 'Published', note: 'Held by the filter, read fine.' },
]

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
export const CHAPTERS: Record<string, Chapter[]> = {
  'v-1041': [
    { at: 0, title: 'Cold open — the dome at 4 a.m.' },
    { at: 236, title: 'Who still works here' },
    { at: 902, title: 'The winter the roof failed' },
    { at: 1744, title: 'Rebuilding the drive' },
    { at: 2410, title: 'First light' },
  ],
  'v-1053': [
    { at: 0, title: 'The yard' },
    { at: 415, title: 'Three generations' },
    { at: 1690, title: 'The last cut' },
    { at: 3320, title: 'After the closure' },
  ],
  'v-1056': [
    { at: 0, title: 'What a lens is for' },
    { at: 185, title: 'Curvature and focal length' },
    { at: 604, title: 'The bathtub demonstration' },
    { at: 940, title: 'Why your phone has five of them' },
  ],
  'v-1062': [
    { at: 0, title: 'Why prove twice' },
    { at: 302, title: 'Gluten, plainly' },
    { at: 880, title: 'Eighteen loaves' },
    { at: 1310, title: 'The one that failed' },
  ],
  'v-1076': [
    { at: 0, title: 'Threading up' },
    { at: 512, title: 'Forty years of Fridays' },
    { at: 1830, title: 'What happens to the prints' },
    { at: 2905, title: 'Four months left' },
  ],
}

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
export const VERIFIED = ['Meridian Films', 'Fern & Field', 'Northbound', 'Cadence Hall']
export const isVerified = (creator: string) => VERIFIED.includes(creator)

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

export const LIVE: Live[] = [
  { id: 'lv-1', title: 'Night Shift — Episode 7 Premiere & Q&A', creator: 'Northbound', category: 'Series', watching: 4820, startedAt: '38 min ago', seed: 51, premium: true },
  { id: 'lv-2', title: 'Cadence Hall: Friday Session, Live', creator: 'Cadence Hall', category: 'Music', watching: 1240, startedAt: '12 min ago', seed: 52, premium: false },
  { id: 'lv-3', title: 'Open Workshop — Reading a Repair Manual', creator: 'Fern & Field', category: 'Learning', watching: 610, startedAt: '2 h ago', seed: 53, premium: false },
]

/** Hashtags, authored per title rather than derived from the category. */
export const TAGS: Record<string, string[]> = {
  'v-1041': ['observatory', 'winter', 'longform'],
  'v-1053': ['shipbreaking', 'labour', 'gujarat'],
  'v-1056': ['optics', 'explainer', 'physics'],
  'v-1062': ['baking', 'chemistry', 'slowtv'],
  'v-1076': ['35mm', 'projection', 'lastofitskind'],
}
export const tagsFor = (id: string) => TAGS[id] ?? []
