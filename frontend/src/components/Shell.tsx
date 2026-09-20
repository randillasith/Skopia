import { createContext, useContext, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bell, Search, Menu, X, ChevronsUpDown, LayoutGrid, Clapperboard, Bookmark,
  History, Sparkles, CreditCard, Flag, LifeBuoy, User, Upload, BarChart3,
  Megaphone, Inbox, Users, ShieldCheck, ScrollText, Settings, Gauge, Receipt,
  SlidersHorizontal, MessageSquareWarning,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { ROLES, NOTIFICATIONS, type Role } from '@/lib/data'
import { MarqueeRule } from './world'

/* ---------------------------------------------------------------- session */

type Session = { role: Role; setRole: (r: Role) => void }
const SessionCtx = createContext<Session>({ role: 'guest', setRole: () => {} })
export const useSession = () => useContext(SessionCtx)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('viewer')
  const value = useMemo(() => ({ role, setRole }), [role])
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

/* ----------------------------------------------------------- role switcher */

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { role, setRole } = useSession()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-left transition-colors hover:border-ink-500',
          compact && 'w-full',
        )}
      >
        <span className="min-w-0">
          <span className="letterboard block text-ink-300">Viewing as</span>
          <span className="block truncate text-[13px] font-medium text-white">
            {ROLES[role].label}
          </span>
        </span>
        <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-ink-300" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-sm border border-ink-600 bg-ink-850 py-1 shadow-e4"
            >
              <li className="letterboard px-3 py-2 text-ink-300">Switch role — prototype only</li>
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <li key={r}>
                  <button
                    onClick={() => {
                      setRole(r)
                      setOpen(false)
                      nav(ROLES[r].home)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-ink-800',
                      r === role ? 'text-cyan-300' : 'text-ink-100',
                    )}
                  >
                    {ROLES[r].label}
                    {r === role && <span className="letterboard text-cyan-300">Active</span>}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------- brand */

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="Skopia — home">
      <img
        src="/skopia-logo.png"
        alt=""
        className="size-8 rounded-[7px] object-cover ring-1 ring-violet-500/40"
      />
      <span className="font-marquee text-[19px] font-extrabold tracking-tight text-white">
        SKOPIA
      </span>
    </Link>
  )
}

/* -------------------------------------------------- front of house (viewer) */

const VIEWER_NAV = [
  { to: '/browse', label: 'Lobby', icon: LayoutGrid },
  { to: '/for-you', label: 'For you', icon: Sparkles },
  { to: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { to: '/history', label: 'History', icon: History },
]

export function FrontOfHouse({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false)
  const unread = NOTIFICATIONS.filter((n) => !n.read).length

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 bg-canvas/88 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Wordmark to="/browse" />

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
            {VIEWER_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-sm px-3 py-2 text-[14px] font-medium transition-colors',
                    isActive ? 'text-white' : 'text-ink-300 hover:text-white',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <Link
            to="/search"
            className="ml-auto flex h-10 items-center gap-2 rounded-sm border border-ink-700 bg-ink-850 px-3 text-[13px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-200 sm:w-64"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search the programme</span>
          </Link>

          <Link
            to="/notifications"
            aria-label={`Notifications — ${unread} unread`}
            className="relative rounded-sm p-2 text-ink-300 transition-colors hover:bg-ink-850 hover:text-white"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-cyan-400 ring-2 ring-canvas" />
            )}
          </Link>

          <div className="hidden sm:block">
            <RoleSwitcher />
          </div>

          <button
            onClick={() => setMenu(true)}
            aria-label="Open menu"
            className="rounded-sm p-2 text-ink-200 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
        <MarqueeRule />
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur lg:hidden"
          >
            <div className="flex h-16 items-center justify-between px-4">
              <Wordmark to="/browse" />
              <button onClick={() => setMenu(false)} aria-label="Close menu" className="p-2">
                <X className="size-5 text-ink-200" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-4 py-4">
              {[...VIEWER_NAV,
                { to: '/plans', label: 'Passes', icon: CreditCard },
                { to: '/reports', label: 'My reports', icon: Flag },
                { to: '/profile', label: 'Account', icon: User },
                { to: '/help', label: 'Help', icon: LifeBuoy },
              ].map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMenu(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-sm px-3 py-3 text-[15px]',
                      isActive ? 'bg-ink-800 text-white' : 'text-ink-200',
                    )
                  }
                >
                  <n.icon className="size-4.5" />
                  {n.label}
                </NavLink>
              ))}
              <div className="mt-4">
                <RoleSwitcher compact />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main>{children}</main>

      <footer className="mt-20 border-t border-ink-800">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-8 text-[13px] text-ink-300 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <Wordmark to="/browse" />
          <p className="sm:ml-6">Watch beyond limits.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 sm:ml-auto">
            <Link to="/help" className="hover:text-ink-100">Help</Link>
            <Link to="/reports" className="hover:text-ink-100">Report a problem</Link>
            <Link to="/plans" className="hover:text-ink-100">Passes</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

/* --------------------------------------------------- back of house (staff) */

const CONSOLES: Record<
  Exclude<Role, 'guest' | 'viewer'>,
  { name: string; groups: { label: string; items: { to: string; label: string; icon: typeof Gauge }[] }[] }
> = {
  creator: {
    name: 'Creator Studio',
    groups: [
      {
        label: 'Content',
        items: [
          { to: '/studio', label: 'Video library', icon: Clapperboard },
          { to: '/studio/upload', label: 'Upload', icon: Upload },
          { to: '/studio/analytics', label: 'Analytics', icon: BarChart3 },
        ],
      },
    ],
  },
  marketing: {
    name: 'Box Office',
    groups: [
      {
        label: 'Advertising',
        items: [
          { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
          { to: '/campaigns/new', label: 'New campaign', icon: Upload },
          { to: '/campaigns/performance', label: 'Performance', icon: BarChart3 },
        ],
      },
    ],
  },
  support: {
    name: 'House Log',
    groups: [
      {
        label: 'Complaints',
        items: [
          { to: '/queue', label: 'Queue', icon: Inbox },
          { to: '/queue/history', label: 'History', icon: History },
        ],
      },
    ],
  },
  admin: {
    name: 'Projection Booth',
    groups: [
      {
        label: 'Overview',
        items: [{ to: '/admin', label: 'Dashboard', icon: Gauge }],
      },
      {
        label: 'People',
        items: [
          { to: '/admin/accounts', label: 'Accounts', icon: Users },
          { to: '/admin/roles', label: 'Roles & permissions', icon: ShieldCheck },
        ],
      },
      {
        label: 'Platform',
        items: [
          { to: '/admin/moderation', label: 'Moderation', icon: MessageSquareWarning },
          { to: '/admin/plans', label: 'Plans', icon: CreditCard },
          { to: '/admin/refunds', label: 'Refunds', icon: Receipt },
          { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
          { to: '/admin/logs', label: 'Activity log', icon: ScrollText },
          { to: '/admin/settings', label: 'Settings', icon: Settings },
        ],
      },
    ],
  },
}

export function BackOfHouse({
  children,
  title,
  actions,
}: {
  children: React.ReactNode
  title: string
  actions?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  // The console is decided by where you are, not by which role is selected —
  // otherwise a viewer opening an admin route sees the wrong console name.
  const key: keyof typeof CONSOLES = loc.pathname.startsWith('/studio')
    ? 'creator'
    : loc.pathname.startsWith('/campaigns')
      ? 'marketing'
      : loc.pathname.startsWith('/queue')
        ? 'support'
        : 'admin'
  const console_ = CONSOLES[key]

  const rail = (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Wordmark to="/browse" />
      </div>
      <div className="px-4 pb-3">
        <p className="letterboard text-ink-300">Console</p>
        <p className="font-marquee text-[17px] font-bold text-white">{console_.name}</p>
      </div>
      <div className="mx-4 mb-3 h-px bg-ink-800" />
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {console_.groups.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="letterboard px-2 py-1.5 text-ink-300">{g.label}</p>
            {g.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/admin' || i.to === '/studio' || i.to === '/campaigns' || i.to === '/queue'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2.5 rounded-sm px-2 py-2 text-[13.5px] transition-colors',
                    isActive
                      ? 'bg-ink-800 text-white'
                      : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-cyan-400" />
                    )}
                    <i.icon className="size-4 shrink-0" />
                    {i.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-800 p-3">
        <RoleSwitcher compact />
        <Link
          to="/browse"
          className="mt-2 flex items-center gap-2 rounded-sm px-2 py-2 text-[13px] text-ink-300 transition-colors hover:text-ink-100"
        >
          <LayoutGrid className="size-4" /> Back to the lobby
        </Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="hidden w-60 shrink-0 border-r border-ink-800 bg-ink-900 lg:block">
        <div className="sticky top-0 h-dvh">{rail}</div>
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-ink-950/75 lg:hidden"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-60 border-r border-ink-800 bg-ink-900 lg:hidden"
            >
              {rail}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-800 bg-canvas/90 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open console menu"
            className="rounded-sm p-1.5 text-ink-200 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="font-marquee truncate text-[17px] font-bold text-white">{title}</h1>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

export { SlidersHorizontal }

/* ------------------------------------------------------------- role guard */

/**
 * Role-based access control decides reach (PRODUCT.md § Positioning).
 * A role that cannot reach a console is told so plainly and given the way
 * back — the control is never silently hidden.
 */
export function RequireRole({
  allow,
  console: consoleName,
  children,
}: {
  allow: Role[]
  console: string
  children: React.ReactNode
}) {
  const { role } = useSession()
  if (allow.includes(role)) return <>{children}</>

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex h-20 w-full max-w-[1500px] items-center px-4 sm:px-6 lg:px-8">
        <Wordmark to="/browse" />
      </header>
      <MarqueeRule />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
        <p className="letterboard text-ink-300">Access</p>
        <h1 className="font-marquee mt-2 text-[clamp(1.7rem,4vw,2.3rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
          {consoleName} is not open to your role
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-200">
          You are signed in as <span className="text-white">{ROLES[role].label}</span>. This
          console is reachable by{' '}
          <span className="text-white">
            {allow.map((r) => ROLES[r].label).join(', ')}
          </span>
          . Ask a Platform Administrator to change your role, or switch role below — the switcher
          exists for this prototype only.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            to="/browse"
            className="inline-flex h-10 items-center rounded-sm bg-violet-500 px-4 text-[14px] font-medium text-white transition-colors hover:bg-violet-400"
          >
            Back to the lobby
          </Link>
          <div className="w-56">
            <RoleSwitcher compact />
          </div>
        </div>
      </main>
    </div>
  )
}
