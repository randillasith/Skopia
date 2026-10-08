import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Megaphone } from 'lucide-react'
import { FrontOfHouse } from '@/components/Shell'
import { Button, EmptyState, useToast } from '@/components/primitives'
import { announcements, notifications, type Announcement, type DurableNotification } from '@/lib/notifications'

const date = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleString()
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Please try again.'

export function Notifications() {
  const [items, setItems] = useState<DurableNotification[]>([])
  const [published, setPublished] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | 'all' | null>(null)
  const [revision, setRevision] = useState(0)
  const toast = useToast()

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true); setError(null)
    Promise.all([notifications.list(abort.signal), announcements.published(abort.signal)])
      .then(([nextItems, nextAnnouncements]) => { setItems(nextItems); setPublished(nextAnnouncements) })
      .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [revision])

  const markOne = async (id: number) => {
    setBusy(id)
    try {
      await notifications.markRead(id)
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
      window.dispatchEvent(new Event('skopia:notifications-changed'))
    } catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setBusy(null) }
  }
  const markAll = async () => {
    setBusy('all')
    try {
      await notifications.markAllRead()
      const readAt = new Date().toISOString()
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })))
      window.dispatchEvent(new Event('skopia:notifications-changed'))
    } catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setBusy(null) }
  }

  const unread = items.filter((item) => item.readAt == null).length
  return <FrontOfHouse><main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="letterboard text-ink-300">Your account</p><h1 className="font-marquee mt-1 text-3xl font-extrabold text-fg">Notifications</h1></div>
      <Button size="sm" loading={busy === 'all'} disabled={unread === 0 || busy != null} onClick={() => void markAll()}>Mark all read</Button>
    </div>
    {loading && <p className="mt-8" role="status">Loading notifications…</p>}
    {error && <div className="mt-8 rounded border border-danger-500/40 p-4 text-tone-danger-400" role="alert">{error} <Button size="sm" onClick={() => setRevision((n) => n + 1)}>Retry</Button></div>}
    {!loading && !error && <>
      <section className="mt-8" aria-labelledby="account-notifications">
        <div className="mb-4 flex items-baseline justify-between"><h2 id="account-notifications" className="font-marquee text-xl font-bold text-fg">Account notifications</h2><span className="font-mono text-xs text-ink-300">{unread} unread</span></div>
        {items.length === 0 ? <EmptyState icon={<Bell className="size-7" />} title="Nothing waiting" body="Billing, refund and account events will be kept here when they happen." />
          : <ul className="divide-y divide-ink-700 overflow-hidden rounded-lg border border-ink-700 bg-ink-850">{items.map((item) => <li key={item.id} className={`p-4 ${item.readAt == null ? 'bg-violet-500/5' : ''}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-2 size-2 shrink-0 rounded-full ${item.readAt == null ? 'bg-cyan-400' : 'bg-ink-600'}`} aria-hidden />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-medium text-fg">{item.title}</h3><time className="font-mono text-[11px] text-ink-300">{date(item.createdAt)}</time></div>
                <p className="mt-1 text-sm leading-relaxed text-ink-300">{item.body}</p>
                <div className="mt-3 flex gap-3">{item.link && <Link className="text-sm text-tone-cyan-300 hover:underline" to={item.link}>Open</Link>}{item.readAt == null && <Button size="sm" variant="quiet" loading={busy === item.id} disabled={busy != null} onClick={() => void markOne(item.id)}>Mark read</Button>}</div>
              </div>
            </div>
          </li>)}</ul>}
      </section>

      <section className="mt-12 border-t border-ink-700 pt-8" aria-labelledby="announcements">
        <div className="mb-4"><p className="letterboard text-tone-gold-400">From Skopia</p><h2 id="announcements" className="font-marquee mt-1 text-xl font-bold text-fg">Published announcements</h2><p className="mt-1 text-sm text-ink-300">Platform messages are separate from your personal notification inbox and do not affect its unread count.</p></div>
        {published.length === 0 ? <EmptyState icon={<Megaphone className="size-7" />} title="No announcements" body="There are no published platform announcements for your audience." />
          : <ul className="space-y-4">{published.map((item) => <li id={`announcement-${item.id}`} key={item.id} className="scroll-mt-24 rounded-lg border border-gold-400/25 bg-gold-400/5 p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-marquee text-lg font-bold text-fg">{item.title}</h3><time className="font-mono text-[11px] text-ink-300">{date(item.publishDate ?? item.updatedAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-200">{item.body}</p></li>)}</ul>}
      </section>
    </>}
  </main></FrontOfHouse>
}
