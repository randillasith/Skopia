import { Popover } from './Popover'
import { Bell, BellRing, CheckCircle2, Megaphone, PlayCircle, Receipt, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '@/lib/session-context'
import {
  announcements,
  buildNotificationFeed,
  hasNotificationAttention,
  notifications,
  type Announcement,
  type DurableNotification,
  type NotificationFeedItem,
} from '../lib/notifications'

const POLL_INTERVAL_MS = 5_000

function seenStorageKey(userId: number) {
  return `skopia:seen-announcements:${userId}`
}

function readSeenAnnouncements(userId: number) {
  try {
    const stored = JSON.parse(localStorage.getItem(seenStorageKey(userId)) ?? '[]')
    return new Set<number>(Array.isArray(stored) ? stored.filter((id): id is number => Number.isInteger(id)) : [])
  } catch {
    return new Set<number>()
  }
}

function writeSeenAnnouncements(userId: number, ids: Set<number>) {
  localStorage.setItem(seenStorageKey(userId), JSON.stringify([...ids]))
}

function relativeTime(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(timestamp).toLocaleDateString()
}

function notifBadgeMeta(item: NotificationFeedItem) {
  if (item.kind === 'ANNOUNCEMENT') {
    return {
      icon: <Megaphone size={17} />,
      bg: 'bg-amber-500/10 text-tone-amber-400',
      label: 'Announcement',
    }
  }

  const type = (item.type || '').toUpperCase()
  const title = (item.title || '').toLowerCase()

  if (type.includes('REFUND') || title.includes('refund')) {
    return {
      icon: <Receipt size={17} />,
      bg: type.includes('REJECTED') ? 'bg-rose-500/10 text-rose-400' : type.includes('APPROVED') ? 'bg-emerald-500/10 text-tone-success-400' : 'bg-amber-500/10 text-tone-amber-400',
      label: type.includes('ADMIN_NEW') ? 'Refund queue' : 'Refund update',
    }
  }

  if (type.includes('RESOLVED') || title.includes('resolved')) {
    return {
      icon: <ShieldCheck size={17} />,
      bg: 'bg-emerald-500/10 text-tone-success-400',
      label: 'Report resolved',
    }
  }
  if (type.includes('UNDER_REVIEW') || title.includes('under review')) {
    return {
      icon: <ShieldAlert size={17} />,
      bg: 'bg-cyan-500/10 text-tone-cyan-300',
      label: 'Report under review',
    }
  }
  if (type.includes('TAKEDOWN') || title.includes('taken down')) {
    return {
      icon: <ShieldAlert size={17} />,
      bg: 'bg-rose-500/10 text-rose-400',
      label: 'Moderation action',
    }
  }
  if (type.includes('REPUBLISHED') || title.includes('republished')) {
    return {
      icon: <CheckCircle2 size={17} />,
      bg: 'bg-emerald-500/10 text-tone-success-400',
      label: 'Video republished',
    }
  }

  return {
    icon: <PlayCircle size={17} />,
    bg: 'bg-red-500/10 text-tone-danger-400',
    label: 'New video',
  }
}

export function NotificationBell() {
  const { viewer } = useSession()
  const userId = viewer?.userId ?? 0
  const location = useLocation()
  const trigger = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DurableNotification[]>([])
  const [publishedAnnouncements, setPublishedAnnouncements] = useState<Announcement[]>([])
  const [seenAnnouncementIds, setSeenAnnouncementIds] = useState(() => readSeenAnnouncements(userId))

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextAnnouncements] = await Promise.all([
        notifications.list(),
        announcements.published(),
      ])
      setItems(nextItems)
      setPublishedAnnouncements(nextAnnouncements)
    } catch {
      // Header polling must never interrupt navigation or the rest of the application.
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    setSeenAnnouncementIds(readSeenAnnouncements(userId))
    void refresh()
  }, [location.pathname, refresh, userId])

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    const onRefresh = () => void refresh()
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'skopia:notifications-event' || e.key === 'skopia:reports-event') {
        void refresh()
      }
    }
    window.addEventListener('focus', onRefresh)
    window.addEventListener('storage', onStorage)
    window.addEventListener('skopia:notifications-changed', onRefresh)
    window.addEventListener('skopia:reports-changed', onRefresh)
    window.addEventListener('skopia:refunds-changed', onRefresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('skopia:notifications-changed', onRefresh)
      window.removeEventListener('skopia:reports-changed', onRefresh)
      window.removeEventListener('skopia:refunds-changed', onRefresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])


  const feed = useMemo(() => buildNotificationFeed(items, publishedAnnouncements).slice(0, 8), [items, publishedAnnouncements])
  const unreadNotifications = items.filter((item) => item.readAt === null).length
  const unseenAnnouncements = publishedAnnouncements.filter((item) => !seenAnnouncementIds.has(item.id)).length
  const attentionCount = unreadNotifications + unseenAnnouncements
  const hasAttention = hasNotificationAttention(items, publishedAnnouncements, seenAnnouncementIds)

  const markAnnouncementsSeen = useCallback(() => {
    if (!publishedAnnouncements.length) return
    const next = new Set(seenAnnouncementIds)
    publishedAnnouncements.forEach((item) => next.add(item.id))
    setSeenAnnouncementIds(next)
    writeSeenAnnouncements(userId, next)
  }, [publishedAnnouncements, seenAnnouncementIds, userId])

  const toggle = () => {
    setOpen((current) => {
      const next = !current
      if (next) markAnnouncementsSeen()
      return next
    })
  }

  const openItem = (kind: 'NOTIFICATION' | 'ANNOUNCEMENT', sourceId: number, unread: boolean) => {
    setOpen(false)
    if (kind === 'NOTIFICATION' && unread) {
      void notifications.markRead(sourceId).then(() => {
        setItems((current) => current.map((item) => item.id === sourceId ? { ...item, readAt: new Date().toISOString() } : item))
        window.dispatchEvent(new Event('skopia:notifications-changed'))
      }).catch(() => undefined)
    }
  }

  if (!userId) return null

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={toggle}
        aria-label={hasAttention ? `Notifications, ${attentionCount} new` : 'Notifications'}
        aria-expanded={open}
        className={`relative grid h-10 w-10 place-items-center rounded-full border transition-colors ${open || hasAttention ? 'border-red-500/40 bg-red-500/10 text-tone-danger-500' : 'border-ink-800 text-ink-300 hover:border-ink-700 hover:text-fg'}`}
      >
        <span className="relative z-10">
          {hasAttention ? <BellRing size={19} /> : <Bell size={19} />}
        </span>
        {attentionCount > 0 && (
          <span className="absolute -right-1 -top-1 z-20 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-4 text-white shadow-lg shadow-red-950/50">
            {attentionCount > 99 ? '99+' : attentionCount}
          </span>
        )}
      </button>

      {open && <Popover anchor={trigger} onClose={() => setOpen(false)} width={400}
        role="dialog" label="Notifications" id={popoverId}>
            <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
              <div>
                <p className="text-sm font-black text-fg">Notifications</p>
                <p className="text-[11px] text-ink-300">Activity, refund and report updates, and announcements</p>
              </div>
              {hasAttention && <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-label="New activity" />}
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {feed.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Bell size={24} className="mx-auto mb-3 text-ink-700" />
                  <p className="text-sm font-semibold text-ink-300">No notifications yet</p>
                </div>
              ) : feed.map((item) => {
                const meta = notifBadgeMeta(item)
                return (
                  <Link
                    key={item.id}
                    to={item.link}
                    onClick={() => openItem(item.kind, item.sourceId, item.unread)}
                    className={`flex gap-3 border-b border-ink-900 px-4 py-3 transition-colors last:border-b-0 hover:bg-ink-900/80 ${item.unread ? 'bg-red-500/[0.055]' : ''}`}
                  >
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.bg}`}>
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 break-words text-sm font-bold leading-snug text-ink-100">{item.title}</span>
                        {item.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-300">{item.body}</span>
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-ink-300">
                        {meta.label} · {relativeTime(item.occurredAt)}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-ink-800 px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-tone-danger-400 transition-colors hover:bg-ink-900 hover:text-tone-danger-300"
            >
              View all notifications
            </Link>
      </Popover>}
    </div>
  )
}
