import { ThemeSelect } from './ThemeSelect'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bell, Search, Menu, X, LayoutGrid, Clapperboard, Bookmark,
  History, Sparkles, CreditCard, Flag, LifeBuoy, User, Upload, BarChart3,
  Megaphone, Inbox, Users, ShieldCheck, ScrollText, Settings, Gauge, Receipt,
  MessageSquareWarning, Tv, LogOut, LogIn, ShieldHalf, ListVideo,
  Compass, Flame, ListEnd,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLibrary } from '@/lib/library'
import {
  CHANNELS, STAFF_ROLES, canStaff, describe,
  isCreator, moderatedChannels, ownedChannel,
  type StaffRole,
} from '@/lib/session'
import { useSession } from '@/lib/session-context'
import { Avatar } from './primitives'
import { MarqueeRule } from './world'
import { SearchBox } from './search'

/* ---------------------------------------------------------------- session */

/* The session itself lives in lib/session-context; it is re-exported here
   because every screen already reaches for it through the shell. */
export { SessionProvider, useSession } from '@/lib/session-context'

/* ------------------------------------------------------------ account menu */

function GrantChip({ children, tone }: { children: React.ReactNode; tone: 'staff' | 'channel' | 'mod' }) {
  return (
    <span
      className={cn(
        'letterboard rounded-[3px] border px-1.5 py-0.5',
        tone === 'staff' && 'border-violet-500/45 bg-violet-500/12 text-tone-violet-200',
        tone === 'channel' && 'border-cyan-400/40 bg-cyan-400/10 text-tone-cyan-200',
        tone === 'mod' && 'border-ink-500 bg-ink-800 text-ink-150',
      )}
    >
      {children}
    </span>
  )
}

/**
 * The account menu.
 *
 * It lists what the signed-in account actually holds rather than a single role,
 * because the three grants are independent — see lib/session.ts. An account with
 * nothing beyond signing up sees no grants at all, which is the common case and
 * should look unremarkable.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { viewer, signOut } = useSession()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const own = ownedChannel(viewer)
  const mod = moderatedChannels(viewer)

  const go = (to: string) => {
    setOpen(false)
    nav(to)
  }

  if (!viewer) {
    return (
      <div className={cn('flex items-center gap-2', compact && 'w-full')}>
        <Link
          to="/login"
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-sm border border-ink-600 px-3 text-[13px] font-medium text-ink-100 transition-colors hover:border-ink-500 hover:text-fg"
        >
          <LogIn className="size-3.5" />
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className={cn('relative', compact && 'w-full')}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2.5 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-ink-850',
          compact && 'w-full border border-ink-600 px-2.5 py-2',
        )}
      >
        <Avatar name={viewer.name} size={compact ? 32 : 28} />
        <span className={cn('min-w-0', !compact && 'hidden xl:block')}>
          <span className="block truncate text-[13px] font-medium leading-tight text-fg">
            {viewer.name}
          </span>
          <span className="block truncate font-mono text-[11px] leading-tight text-ink-300">
            @{viewer.handle}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'absolute z-50 mt-2 w-[19rem] overflow-hidden rounded-sm border border-ink-600 bg-ink-850 shadow-e4',
                compact ? 'bottom-full right-0 mb-2 mt-0' : 'right-0',
              )}
            >
              {/* who you are */}
              <div className="border-b border-ink-700 px-3.5 py-3">
                <p className="truncate text-[14px] font-medium text-fg">{viewer.name}</p>
                <p className="truncate font-mono text-[11px] text-ink-300">{viewer.email}</p>
                {(viewer.staff.length > 0 || own || mod.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {viewer.staff.map((r) => (
                      <GrantChip key={r} tone="staff">{STAFF_ROLES[r].label}</GrantChip>
                    ))}
                    {own && <GrantChip tone="channel">Channel · {own.name}</GrantChip>}
                    {mod.map((c) => (
                      <GrantChip key={c.id} tone="mod">Moderator · {c.name}</GrantChip>
                    ))}
                  </div>
                )}
              </div>

              {/* what that lets you reach */}
              <div className="py-1">
                <MenuItem icon={User} onClick={() => go('/profile')}>Your account</MenuItem>
                <MenuItem icon={CreditCard} onClick={() => go('/subscription')}>Your pass</MenuItem>
                {own ? (
                  <MenuItem icon={Tv} onClick={() => go('/studio')}>{own.name}</MenuItem>
                ) : (
                  <MenuItem icon={Tv} onClick={() => go('/studio/create')}>Create a channel</MenuItem>
                )}
                {mod.length > 0 && (
                  <MenuItem icon={ShieldHalf} onClick={() => go('/moderate')}>
                    Moderating {mod.length === 1 ? mod[0].name : `${mod.length} channels`}
                  </MenuItem>
                )}
                {(['marketing', 'support', 'admin'] as StaffRole[])
                  .filter((r) => viewer.staff.includes(r))
                  .map((r) => (
                    <MenuItem key={r} icon={ShieldCheck} onClick={() => go(STAFF_ROLES[r].home)}>
                      {STAFF_ROLES[r].console}
                    </MenuItem>
                  ))}
              </div>

              <div className="border-t border-ink-700 py-1">
                <MenuItem
                  icon={LogOut}
                  onClick={() => {
                    signOut()
                    setOpen(false)
                    nav('/')
                  }}
                >
                  Sign out
                </MenuItem>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof User
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-ink-100 transition-colors hover:bg-ink-800 hover:text-fg"
    >
      <Icon className="size-4 shrink-0 text-ink-300" />
      <span className="truncate">{children}</span>
    </button>
  )
}

/* ------------------------------------------------------------------- brand */

export function Wordmark({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="Skopia — home">
      <img
        src="/skopia-logo.png"
        alt=""
        className="size-8 rounded-[7px] object-cover ring-1 ring-violet-500/40"
      />
      <span className={cn("font-marquee text-[19px] font-extrabold tracking-tight text-fg", compact && "hidden sm:inline")}>
        SKOPIA
      </span>
    </Link>
  )
}

/* -------------------------------------------------- front of house (viewer) */

/**
 * Front of house.
 *
 * A persistent left rail rather than a top nav. A catalogue this shape needs
 * three things reachable at all times — the feeds, your own library, and the
 * channels you follow — and a row of tabs cannot hold them without either
 * truncating or turning into a menu. It collapses to icons on narrow desktops
 * and becomes a drawer below `lg`, so the same structure survives to a phone.
 */
const FEEDS = [
  { to: '/browse', label: 'Home', icon: LayoutGrid },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/trending', label: 'Trending', icon: Flame },
  { to: '/subscriptions', label: 'Following', icon: Users },
]

const LIBRARY = [
  { to: '/history', label: 'History', icon: History },
  { to: '/watchlist', label: 'Watch later', icon: Bookmark },
  { to: '/playlists', label: 'Playlists', icon: ListVideo },
  { to: '/for-you', label: 'For you', icon: Sparkles },
]

function RailLink({
  to,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
  badge,
}: {
  to: string
  label: string
  icon: typeof LayoutGrid
  collapsed: boolean
  onNavigate?: () => void
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group/link relative flex items-center gap-3 rounded-sm px-2.5 py-2 text-[13.5px] transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-ink-800 text-fg' : 'text-ink-200 hover:bg-ink-850 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="rail-marker"
              transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }}
              className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-cyan-400"
            />
          )}
          <Icon className="size-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
          {!collapsed && badge !== undefined && badge > 0 && (
            <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-300">{badge}</span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function FrontOfHouse({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { viewer } = useSession()
  const { subscriptions, queue } = useLibrary()
  const nav = useNavigate()
  const followed = CHANNELS.filter((c) => subscriptions.includes(c.handle))
  const canUpload = isCreator(viewer)

  // "/" and Cmd-K reach the search box, the way every catalogue of this size
  // does. Ignored while the caret is already in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const railBody = (inDrawer: boolean) => {
    const c = inDrawer ? false : collapsed
    const close = inDrawer ? () => setDrawer(false) : undefined
    return (
      <nav className="flex h-full flex-col gap-1 overflow-y-auto px-2.5 py-3">
        <ul className="space-y-0.5">
          {FEEDS.map((n) => (
            <li key={n.to}><RailLink {...n} collapsed={c} onNavigate={close} /></li>
          ))}
        </ul>

        <hr className="my-3 border-ink-800" />
        {!c && <p className="letterboard px-2.5 pb-1.5 text-ink-300">Library</p>}
        <ul className="space-y-0.5">
          {LIBRARY.map((n) => (
            <li key={n.to}><RailLink {...n} collapsed={c} onNavigate={close} /></li>
          ))}
          <li>
            <RailLink to="/queue-up" label="Queue" icon={ListEnd} collapsed={c} onNavigate={close} badge={queue.length} />
          </li>
        </ul>

        {followed.length > 0 && (
          <>
            <hr className="my-3 border-ink-800" />
            {!c && <p className="letterboard px-2.5 pb-1.5 text-ink-300">Channels</p>}
            <ul className="space-y-0.5">
              {followed.map((ch) => (
                <li key={ch.id}>
                  <NavLink
                    to={`/channel/${ch.handle}`}
                    onClick={close}
                    title={c ? ch.name : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-sm px-2.5 py-1.5 text-[13.5px] transition-colors',
                        c && 'justify-center px-0',
                        isActive ? 'bg-ink-800 text-fg' : 'text-ink-200 hover:bg-ink-850 hover:text-fg',
                      )
                    }
                  >
                    <Avatar name={ch.name} size={22} />
                    {!c && <span className="truncate">{ch.name}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        )}

        <hr className="my-3 border-ink-800" />
        <ul className="space-y-0.5">
          {canUpload && <li><RailLink to="/studio" label="Creator Studio" icon={Tv} collapsed={c} onNavigate={close} /></li>}
          <li><RailLink to="/plans" label="Passes" icon={CreditCard} collapsed={c} onNavigate={close} /></li>
          <li><RailLink to="/reports" label="My reports" icon={Flag} collapsed={c} onNavigate={close} /></li>
          <li><RailLink to="/help" label="Help" icon={LifeBuoy} collapsed={c} onNavigate={close} /></li>
        </ul>

        <div className="mt-auto pt-3">
          {inDrawer && <AccountMenu compact />}
        </div>
      </nav>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 bg-canvas/88 backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => (window.innerWidth >= 1024 ? setCollapsed((v) => !v) : setDrawer(true))}
            aria-label="Toggle navigation"
            className="rounded-sm p-2 text-ink-200 transition-colors hover:bg-ink-850 hover:text-fg"
          >
            <Menu className="size-5" />
          </button>
          <Wordmark to="/browse" compact />

          <div className="ml-auto hidden min-w-0 flex-1 justify-center px-4 sm:flex lg:ml-0">
            <SearchBox />
          </div>

          <Link
            to="/search"
            aria-label="Search"
            className="ml-auto rounded-sm p-2 text-ink-300 transition-colors hover:bg-ink-850 hover:text-fg sm:hidden"
          >
            <Search className="size-5" />
          </Link>

          {canUpload && (
            <button
              onClick={() => nav('/studio/upload')}
              className="hidden h-9 items-center gap-2 rounded-sm border border-ink-600 px-3 text-[13px] font-medium text-ink-100 transition-colors hover:border-ink-500 hover:text-fg sm:flex"
            >
              <Upload className="size-4" />
              Upload
            </button>
          )}

          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative rounded-sm p-2 text-ink-300 transition-colors hover:bg-ink-850 hover:text-fg"
          >
            {/* No badge: nothing raises a notification yet, so a dot here would
                promise something waiting that is not. */}
            <Bell className="size-5" />
          </Link>

          <ThemeSelect />
          <div className="hidden sm:block"><AccountMenu /></div>
        </div>
        <MarqueeRule />
      </header>

      <div className="flex">
        {/* the rail, desktop */}
        <aside
          className={cn(
            'sticky top-[4.0625rem] hidden h-[calc(100dvh-4.0625rem)] shrink-0 border-r border-ink-800 transition-[width] duration-200 lg:block',
            collapsed ? 'w-[68px]' : 'w-[232px]',
          )}
        >
          {railBody(false)}
        </aside>

        {/* the rail, as a drawer */}
        <AnimatePresence>
          {drawer && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setDrawer(false)}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-ink-800 bg-ink-900 lg:hidden"
              >
                <div className="flex h-16 shrink-0 items-center justify-between px-3">
                  <Wordmark to="/browse" />
                  <button onClick={() => setDrawer(false)} aria-label="Close navigation" className="p-2">
                    <X className="size-5 text-ink-200" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">{railBody(true)}</div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

/* --------------------------------------------------- back of house (staff) */

type ConsoleKey = 'creator' | 'moderator' | 'marketing' | 'support' | 'admin'

const CONSOLES: Record<
  ConsoleKey,
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
      {
        label: 'Channel',
        items: [
          { to: '/studio/moderators', label: 'Moderators', icon: ShieldHalf },
          { to: '/studio/channel', label: 'Channel settings', icon: Settings },
        ],
      },
    ],
  },
  moderator: {
    name: 'Moderation',
    groups: [
      {
        label: 'Channels you moderate',
        items: [
          { to: '/moderate', label: 'Comment queue', icon: MessageSquareWarning },
          { to: '/moderate/history', label: 'Decisions', icon: History },
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
  const key: ConsoleKey = loc.pathname.startsWith('/studio')
    ? 'creator'
    : loc.pathname.startsWith('/moderate')
      ? 'moderator'
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
        <p className="font-marquee text-[17px] font-bold text-fg">{console_.name}</p>
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
                      ? 'bg-ink-800 text-fg'
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
        <AccountMenu compact />
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
              className="fixed inset-0 z-40 bg-black/75 lg:hidden"
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
          <h1 className="font-marquee truncate text-[17px] font-bold text-fg">{title}</h1>
          <div className="ml-auto flex items-center gap-2">{actions}<ThemeSelect /></div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ guards */

/**
 * Every guard renders the same named refusal rather than hiding the link. Hiding
 * a surface teaches nothing when somebody arrives from a shared URL or a
 * bookmark, and it hides the one thing they need to know: who can let them in.
 */
function Denied({
  heading,
  explain,
  action,
}: {
  heading: string
  explain: React.ReactNode
  action?: React.ReactNode
}) {
  const { viewer } = useSession()
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex h-20 w-full max-w-[1500px] items-center px-4 sm:px-6 lg:px-8">
        <Wordmark to="/browse" />
        <div className="ml-auto"><ThemeSelect /></div>
      </header>
      <MarqueeRule />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
        <p className="letterboard text-ink-300">Access</p>
        <h1 className="font-marquee mt-2 text-[clamp(1.7rem,4vw,2.3rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-fg">
          {heading}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-200">{explain}</p>
        <p className="mt-4 text-[13px] text-ink-300">
          Signed in as <span className="text-ink-100">{viewer ? viewer.name : 'nobody'}</span>
          {viewer && <> — {describe(viewer)}</>}.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {action}
          <Link
            to="/browse"
            className="inline-flex h-10 items-center rounded-sm border border-ink-600 px-4 text-[14px] font-medium text-ink-100 transition-colors hover:border-ink-500 hover:text-fg"
          >
            Back to the programme
          </Link>
        </div>
      </main>
    </div>
  )
}

const primaryAction =
  'inline-flex h-10 items-center rounded-sm bg-violet-500 px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-hi'

/** Anything tied to an account: watchlist, pass, reports, notifications. */
export function RequireAuth({ what, children }: { what: string; children: React.ReactNode }) {
  const { viewer } = useSession()
  if (viewer) return <>{children}</>
  return (
    <Denied
      heading={`${what} belongs to an account`}
      explain="Browsing and watching the free programme need no account. This does, because it is yours and has to be kept somewhere."
      action={<Link to="/login" className={primaryAction}>Sign in</Link>}
    />
  )
}

/** The studio. Owning a channel is self-service, so this offers the way in. */
export function RequireChannel({ children }: { children: React.ReactNode }) {
  const { viewer } = useSession()
  if (!viewer) {
    return (
      <Denied
        heading="Creator Studio belongs to an account"
        explain="Sign in first, then create a channel. Nobody has to approve it."
        action={<Link to="/login" className={primaryAction}>Sign in</Link>}
      />
    )
  }
  if (isCreator(viewer)) return <>{children}</>
  return (
    <Denied
      heading="You do not have a channel yet"
      explain="Publishing happens through a channel. Creating one takes a name and a handle, and there is no approval step — an administrator is not involved."
      action={<Link to="/studio/create" className={primaryAction}>Create a channel</Link>}
    />
  )
}

/** Channel-scoped moderation. The grant comes from a channel owner, not staff. */
export function RequireModerator({ children }: { children: React.ReactNode }) {
  const { viewer } = useSession()
  if (viewer && (moderatedChannels(viewer).length > 0 || isCreator(viewer))) return <>{children}</>
  return (
    <Denied
      heading="You do not moderate a channel"
      explain="Moderation is granted per channel by the person who owns it, and it reaches only that channel's videos. An administrator cannot grant it for somebody else's channel."
    />
  )
}

/** Platform staff consoles. Only an administrator grants these. */
export function RequireStaff({
  role,
  children,
}: {
  role: StaffRole
  children: React.ReactNode
}) {
  const { viewer } = useSession()
  if (viewer?.userId != null && canStaff(viewer, role)) return <>{children}</>
  return (
    <Denied
      heading={`${STAFF_ROLES[role].console} is staff only`}
      explain={
        <>
          This console needs the{' '}
          <span className="text-fg">{STAFF_ROLES[role].label}</span> role, which only an
          administrator can grant. It is not something an account can take for itself, and owning
          a channel does not confer it.
        </>
      }
      action={<Link to="/help" className={primaryAction}>Ask for access</Link>}
    />
  )
}
