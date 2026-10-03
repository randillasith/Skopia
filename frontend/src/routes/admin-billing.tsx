import { useEffect, useState } from 'react'
import { Megaphone, Receipt } from 'lucide-react'
import { BackOfHouse } from '@/components/Shell'
import { Button, EmptyState, Field, Input, Modal, Select, Table, Td, Textarea, Th, Tr, useToast } from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { billing, type AdminSubscription, type RefundRequest } from '@/lib/billing'
import { announcements, validateAnnouncement, type Announcement, type AnnouncementInput } from '@/lib/notifications'

const date = (value: string | null | undefined) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : '—'
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Please try again.'
const tone = (status: string): 'ok' | 'review' | 'bad' | 'soon' => status === 'ACTIVE' || status === 'PUBLISHED' || status === 'APPROVED' ? 'ok' : status === 'FREE' || status === 'DRAFT' ? 'soon' : status === 'CANCELLED' || status === 'ARCHIVED' || status === 'REJECTED' ? 'bad' : 'review'

export function AdminPlans() {
  const [rows, setRows] = useState<AdminSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    billing.adminUsers(abort.signal).then(setRows).catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)) }).finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [])
  return <BackOfHouse title="Subscription access">
    <p className="mb-5 max-w-3xl text-sm leading-relaxed text-ink-300">Server-derived access and safe synthetic payment metadata. Full card numbers, expiry values and cardholder names are never available here.</p>
    {loading ? <p role="status">Loading subscriptions…</p> : error ? <p role="alert" className="text-danger-400">{error}</p> : rows.length === 0 ? <EmptyState title="No subscription records" body="Accounts will appear here when the billing service returns access state." /> :
      <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Account', 'Plan', 'State', 'Term', 'Last simulated payment']}><thead><Tr><Th>Account</Th><Th>Plan</Th><Th>State</Th><Th>Term</Th><Th>Last simulated payment</Th></Tr></thead><tbody>{rows.map((row) => <Tr key={row.userId}>
        <Td><span className="font-medium text-fg">{row.displayName}</span><span className="block text-xs text-ink-300">@{row.username}{row.email ? ` · ${row.email}` : ''}</span><span className="block font-mono text-[11px] text-ink-400">User #{row.userId}</span></Td>
        <Td>{row.planName ?? '—'}</Td><Td><Letterboard tone={tone(row.status)}>{row.status}</Letterboard></Td><Td><span className="block">{date(row.startDate)}</span><span className="block text-xs text-ink-300">to {date(row.endDate)}</span></Td>
        <Td>{row.payment ? <><span className="block">{row.payment.payStatus ?? 'Unknown'} · payment #{row.payment.id}</span><span className="block text-xs text-ink-300">{row.payment.cardBrand ?? row.payment.payMethod ?? 'Synthetic payment'}{row.payment.cardLast4 ? ` ending ${row.payment.cardLast4}` : ''}{row.payment.reference ? ` · ${row.payment.reference}` : ''} · {date(row.payment.paidDatetime)}</span></> : '—'}</Td>
      </Tr>)}</tbody></Table></div>}
  </BackOfHouse>
}

export function AdminRefunds() {
  const [rows, setRows] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RefundRequest | null>(null)
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const toast = useToast()
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(null)
    billing.adminRefunds(abort.signal).then(setRows).catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)) }).finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [revision])
  const decide = async () => {
    if (!selected || saving) return
    setSaving(true)
    try { await billing.decideRefund(selected.id, decision, note); toast({ title: `Refund ${decision.toLowerCase()}`, tone: decision === 'APPROVED' ? 'ok' : 'info' }); setSelected(null); setRevision((n) => n + 1) }
    catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setSaving(false) }
  }
  return <BackOfHouse title="Refund requests">
    <p className="mb-5 max-w-3xl text-sm text-ink-300">Review requests against their owned simulated payment. Decisions are final in this console; an optional note is shown to the requester.</p>
    {loading ? <p role="status">Loading refund requests…</p> : error ? <p role="alert" className="text-danger-400">{error}</p> : rows.length === 0 ? <EmptyState icon={<Receipt className="size-7" />} title="No refund requests" body="Submitted demo refund requests will appear here." /> :
      <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Request', 'Payment', 'Reason', 'Requested', 'Status', '']}><thead><Tr><Th>Request</Th><Th>Payment</Th><Th>Reason</Th><Th>Requested</Th><Th>Status</Th><Th /></Tr></thead><tbody>{rows.map((row) => <Tr key={row.id}>
        <Td><span className="block text-fg">{row.username ? `@${row.username}` : `Request #${row.id}`}</span><span className="block text-xs text-ink-300">{row.email ?? `Subscription #${row.subscriptionId ?? '—'}`}</span></Td><Td>#{row.paymentId}{row.planName ? ` · ${row.planName}` : ''}{row.amount != null ? ` · ${row.amount}` : ''}</Td><Td className="max-w-sm whitespace-normal">{row.reason}{row.processingNote && <span className="mt-1 block text-xs text-ink-300">Decision: {row.processingNote}</span>}</Td><Td>{date(row.requestedAt)}</Td><Td><Letterboard tone={tone(row.status)}>{row.status}</Letterboard></Td><Td>{row.status === 'PENDING' && <Button size="sm" onClick={() => { setSelected(row); setDecision('APPROVED'); setNote('') }}>Decide</Button>}</Td>
      </Tr>)}</tbody></Table></div>}
    <Modal open={selected != null} onClose={() => !saving && setSelected(null)} title="Decide refund request" description={selected ? `Request #${selected.id} for payment #${selected.paymentId}` : undefined} footer={<><Button variant="quiet" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button variant={decision === 'REJECTED' ? 'danger' : 'primary'} loading={saving} onClick={() => void decide()}>{decision === 'APPROVED' ? 'Approve refund' : 'Reject request'}</Button></>}>
      <div className="space-y-4"><Field label="Decision"><Select value={decision} onChange={(event) => setDecision(event.target.value as 'APPROVED' | 'REJECTED')}><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option></Select></Field><Field label="Decision note" hint="Optional"><Textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the decision to the requester." /></Field></div>
    </Modal>
  </BackOfHouse>
}

const EMPTY: AnnouncementInput = { title: '', body: '', audience: 'ALL' }
export function AdminAnnouncements() {
  const [rows, setRows] = useState<Announcement[]>([])
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)
  const [form, setForm] = useState<AnnouncementInput>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof AnnouncementInput, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const toast = useToast()
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(null)
    announcements.admin.list(abort.signal).then(setRows).catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)) }).finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [revision])
  const open = (item: Announcement | 'new') => { setEditing(item); setErrors({}); setForm(item === 'new' ? EMPTY : { title: item.title, body: item.body, audience: item.audience }) }
  const save = async () => {
    const validation = validateAnnouncement(form); setErrors(validation); if (Object.keys(validation).length || !editing) return
    setSaving(true)
    try {
      if (editing === 'new') await announcements.admin.create(form)
      else await announcements.admin.update(editing.id, form)
      toast({ title: editing === 'new' ? 'Draft created' : 'Draft updated', tone: 'ok' })
      setEditing(null); setRevision((n) => n + 1)
    }
    catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setSaving(false) }
  }
  const action = async (item: Announcement, next: 'publish' | 'archive') => {
    setSaving(true)
    try {
      if (next === 'publish') await announcements.admin.publish(item.id)
      else await announcements.admin.archive(item.id)
      toast({ title: next === 'publish' ? 'Announcement published' : 'Announcement archived', tone: 'ok' })
      window.dispatchEvent(new Event('skopia:notifications-changed'))
      setRevision((n) => n + 1)
    }
    catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setSaving(false) }
  }
  return <BackOfHouse title="Announcements" actions={<Button size="sm" onClick={() => open('new')}>New draft</Button>}>
    <p className="mb-5 max-w-3xl text-sm text-ink-300">Draft and publish platform messages to everyone, viewers, or creators. Published announcements appear separately from personal durable notifications.</p>
    {loading ? <p role="status">Loading announcements…</p> : error ? <p role="alert" className="text-danger-400">{error}</p> : rows.length === 0 ? <EmptyState icon={<Megaphone className="size-7" />} title="No announcements" body="Create a draft, review its audience, then publish it." action={<Button onClick={() => open('new')}>Create draft</Button>} /> :
      <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Announcement', 'Audience', 'State', 'Updated', '']}><thead><Tr><Th>Announcement</Th><Th>Audience</Th><Th>State</Th><Th>Updated</Th><Th /></Tr></thead><tbody>{rows.map((row) => <Tr key={row.id}><Td><span className="font-medium text-fg">{row.title}</span><span className="mt-1 block max-w-xl truncate text-xs text-ink-300">{row.body}</span></Td><Td>{row.audience}</Td><Td><Letterboard tone={tone(row.status)}>{row.status}</Letterboard></Td><Td>{date(row.updatedAt)}</Td><Td><div className="flex justify-end gap-1">{row.status === 'DRAFT' && <><Button size="sm" variant="quiet" disabled={saving} onClick={() => open(row)}>Edit</Button><Button size="sm" disabled={saving} onClick={() => void action(row, 'publish')}>Publish</Button></>}{row.status !== 'ARCHIVED' && <Button size="sm" variant="quiet" disabled={saving} onClick={() => void action(row, 'archive')}>Archive</Button>}</div></Td></Tr>)}</tbody></Table></div>}
    <Modal open={editing != null} onClose={() => !saving && setEditing(null)} title={editing === 'new' ? 'New announcement draft' : 'Edit announcement draft'} footer={<><Button variant="quiet" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button loading={saving} onClick={() => void save()}>Save draft</Button></>}>
      <div className="space-y-4"><Field label="Title" required error={errors.title}><Input maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="Audience" required error={errors.audience}><Select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as AnnouncementInput['audience'] })}><option value="ALL">Everyone</option><option value="VIEWERS">Viewers</option><option value="CREATORS">Creators</option></Select></Field><Field label="Message" required error={errors.body} hint={`${form.body.length}/5000`}><Textarea className="min-h-44" maxLength={5000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field></div>
    </Modal>
  </BackOfHouse>
}
