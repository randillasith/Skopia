import { useEffect, useState } from 'react'
import { FileDown, Megaphone, Receipt } from 'lucide-react'
import { BackOfHouse } from '@/components/Shell'
import { Button, EmptyState, Field, Input, Modal, SearchInput, Select, Table, Td, Textarea, Th, Tr, useToast } from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { billing, REFUND_CATEGORIES, reviewableOrders, validateRefundDecision, type AdminRefundFilters, type AdminSubscription, type OrderView, type RefundPage, type RefundRequest } from '@/lib/billing'
import { announcements, validateAnnouncement, type Announcement, type AnnouncementInput } from '@/lib/notifications'

const date = (value: string | null | undefined) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : '—'
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Please try again.'
const tone = (status: string): 'ok' | 'review' | 'bad' | 'soon' => status === 'ACTIVE' || status === 'PUBLISHED' || status === 'APPROVED' ? 'ok' : status === 'FREE' || status === 'DRAFT' ? 'soon' : status === 'CANCELLED' || status === 'ARCHIVED' || status === 'REJECTED' ? 'bad' : 'review'

export function AdminPaymentOrders() {
  const [orders, setOrders] = useState<OrderView[]>([])
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<OrderView | null>(null)
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const toast = useToast()
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(null)
    billing.adminOrders(abort.signal).then((rows) => { if (!abort.signal.aborted) setOrders(rows) })
      .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [revision])
  const openSlip = async (id: number) => {
    setBusy(true)
    try {
      const blob = await billing.adminSlip(id)
      const url = URL.createObjectURL(blob)
      // Only an authenticated fetch can retrieve this private file. Never put its API path in an href.
      const anchor = document.createElement('a'); anchor.href = url
      anchor.download = `skopia-sample-slip-${id}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setBusy(false) }
  }
  const submit = async () => {
    if (!selected || busy) return
    if (decision === 'REJECTED' && !note.trim()) { setNoteError('A rejection note is required.'); return }
    setBusy(true); setNoteError(null)
    try {
      await billing.decideOrder(selected.id, decision, note)
      toast({ title: `Sample order ${decision.toLowerCase()}`, tone: 'ok' })
      setSelected(null); setRevision((n) => n + 1)
      window.dispatchEvent(new Event('skopia:notifications-changed'))
    } catch (cause) { setNoteError(errorText(cause)) }
    finally { setBusy(false) }
  }
  const reviewable = reviewableOrders(orders)
  return <BackOfHouse title="Sample payment review" actions={<Button size="sm" onClick={() => setRevision((n) => n + 1)}>Refresh orders</Button>}>
    <p className="mb-5 text-sm text-ink-300">Simulation—no real money or bank transfer. Review sample bank-transfer submissions only. Approval updates simulated entitlement; it does not confirm receipt of funds.</p>
    {loading ? <p role="status">Loading orders…</p> : error ? <p role="alert">{error} <Button size="sm" onClick={() => setRevision((n) => n + 1)}>Retry</Button></p>
      : reviewable.length === 0 ? <EmptyState title="No orders awaiting review" body="Refresh to check for new sample submissions." />
      : <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Order', 'Contact', 'Method', 'Submitted', 'Status', 'Review']}><thead><Tr><Th>Order</Th><Th>Contact</Th><Th>Method</Th><Th>Submitted</Th><Th>Status</Th><Th>Review</Th></Tr></thead><tbody>
        {reviewable.map((order) => <Tr key={order.id}>
          <Td>#{order.id} · {order.planName}<span className="block text-xs text-ink-300">LKR {order.amount ?? 500} · simulated</span></Td>
          <Td>{order.billing?.fullName ?? order.fullName ?? '—'}<span className="block text-xs text-ink-300">{order.billing?.email ?? order.email ?? '—'}</span></Td>
          <Td>{order.paymentMethod ?? order.method ?? 'Bank transfer sample'}{order.reference && <span className="block text-xs">Reference: {order.reference}</span>}</Td>
          <Td>{date(order.submittedAt ?? order.createdAt)}</Td><Td><Letterboard tone={tone(order.status)}>{order.status}</Letterboard></Td>
          <Td><div className="flex gap-2"><Button size="sm" variant="quiet" disabled={busy} onClick={() => void openSlip(order.id)}>View private slip</Button>
            <Button size="sm" disabled={busy} onClick={() => { setSelected(order); setDecision('APPROVED'); setNote(''); setNoteError(null) }}>Decide</Button></div></Td>
        </Tr>)}</tbody></Table></div>}
    <Modal open={selected != null} onClose={() => !busy && setSelected(null)} title="Review sample order" description={selected ? `Order #${selected.id} · no real funds received` : undefined}
      footer={<><Button variant="quiet" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button loading={busy} onClick={() => void submit()}>{decision === 'APPROVED' ? 'Approve simulation' : 'Reject sample'}</Button></>}>
      <p className="mb-4 text-sm">Simulation—no real money or bank transfer.</p>
      <Field label="Decision"><Select value={decision} onChange={(event) => { setDecision(event.target.value as 'APPROVED' | 'REJECTED'); setNoteError(null) }}><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option></Select></Field>
      <Field label="Review note" required={decision === 'REJECTED'} error={noteError ?? undefined}><Textarea maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setNoteError(null) }} /></Field>
    </Modal>
  </BackOfHouse>
}

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
    <p className="mb-5 max-w-3xl text-sm leading-relaxed text-ink-300">Server-derived access and historical synthetic payment metadata. No card credentials are collected by the preview flow.</p>
    {loading ? <p role="status">Loading subscriptions…</p> : error ? <p role="alert" className="text-danger-400">{error}</p> : rows.length === 0 ? <EmptyState title="No subscription records" body="Accounts will appear here when the billing service returns access state." /> :
      <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Account', 'Plan', 'State', 'Term', 'Last simulated payment']}><thead><Tr><Th>Account</Th><Th>Plan</Th><Th>State</Th><Th>Term</Th><Th>Last simulated payment</Th></Tr></thead><tbody>{rows.map((row) => <Tr key={row.userId}>
        <Td><span className="font-medium text-fg">{row.displayName}</span><span className="block text-xs text-ink-300">@{row.username}{row.email ? ` · ${row.email}` : ''}</span><span className="block font-mono text-[11px] text-ink-400">User #{row.userId}</span></Td>
        <Td>{row.planName ?? '—'}</Td><Td><Letterboard tone={tone(row.status)}>{row.status}</Letterboard></Td><Td><span className="block">{date(row.startDate)}</span><span className="block text-xs text-ink-300">to {date(row.endDate)}</span></Td>
        <Td>{row.payment ? <><span className="block">{row.payment.payStatus ?? 'Unknown'} · payment #{row.payment.id}</span><span className="block text-xs text-ink-300">{row.payment.cardBrand ?? row.payment.payMethod ?? 'Synthetic payment'}{row.payment.cardLast4 ? ` ending ${row.payment.cardLast4}` : ''}{row.payment.reference ? ` · ${row.payment.reference}` : ''} · {date(row.payment.paidDatetime)}</span></> : '—'}</Td>
      </Tr>)}</tbody></Table></div>}
  </BackOfHouse>
}

const DEFAULT_REFUND_FILTERS: AdminRefundFilters = { status: '', category: '', q: '', from: '', to: '', page: 0, size: 25 }

export function AdminRefunds() {
  const [result, setResult] = useState<RefundPage | null>(null)
  const [filters, setFilters] = useState<AdminRefundFilters>(DEFAULT_REFUND_FILTERS)
  const [draft, setDraft] = useState<AdminRefundFilters>(DEFAULT_REFUND_FILTERS)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RefundRequest | null>(null)
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [revision, setRevision] = useState(0)
  const toast = useToast()
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(null)
    Promise.all([billing.adminRefunds(filters, abort.signal), billing.pendingRefundCount(abort.signal)])
      .then(([nextResult, count]) => { setResult(nextResult); setPendingCount(count) })
      .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)) })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [filters, revision])
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener('skopia:refunds-changed', refresh)
    return () => window.removeEventListener('skopia:refunds-changed', refresh)
  }, [])
  const changed = () => {
    window.dispatchEvent(new Event('skopia:refunds-changed'))
    window.dispatchEvent(new Event('skopia:notifications-changed'))
  }
  const decide = async () => {
    if (!selected || saving) return
    const validation = validateRefundDecision(decision, note)
    setNoteError(validation)
    if (validation) return
    setSaving(true)
    try {
      await billing.decideRefund(selected.id, decision, note)
      toast({ title: `Refund ${decision.toLowerCase()}`, tone: decision === 'APPROVED' ? 'ok' : 'info' })
      setSelected(null); changed()
    } catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setSaving(false) }
  }
  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await billing.exportRefunds(filters)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `skopia-refunds-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Refund CSV exported', tone: 'ok' })
    } catch (cause) { toast({ title: errorText(cause), tone: 'bad' }) }
    finally { setExporting(false) }
  }
  const rows = result?.content ?? []
  return <BackOfHouse title="Refund requests" actions={<div className="flex items-center gap-2"><span className="rounded-full border border-gold-400/40 px-3 py-1 text-xs text-tone-gold-300">{pendingCount} pending</span><Button size="sm" icon={<FileDown className="size-4" />} loading={exporting} onClick={() => void exportCsv()}>Export CSV</Button></div>}>
    <p className="mb-5 max-w-3xl text-sm text-ink-300">Review categorized requests against their owned simulated payment. Rejections require a note shown to the requester.</p>
    <form className="mb-5 grid gap-3 rounded-lg border border-ink-700 bg-ink-850 p-4 md:grid-cols-2 xl:grid-cols-7" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft, q: draft.q.trim(), page: 0 }) }}>
      <Field label="Search"><SearchInput value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder="Username, email, payment or request" /></Field>
      <Field label="Status"><Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="">All statuses</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status) => <option key={status}>{status}</option>)}</Select></Field>
      <Field label="Category"><Select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">All categories</option>{REFUND_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
      <Field label="From"><Input type="date" value={draft.from ?? ''} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></Field>
      <Field label="To"><Input type="date" value={draft.to ?? ''} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></Field>
      <Field label="Page size"><Select value={draft.size} onChange={(event) => setDraft({ ...draft, size: Number(event.target.value), page: 0 })}>{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</Select></Field>
      <div className="flex items-end gap-2"><Button type="submit">Apply</Button><Button type="button" variant="quiet" onClick={() => { setDraft(DEFAULT_REFUND_FILTERS); setFilters(DEFAULT_REFUND_FILTERS) }}>Reset</Button></div>
    </form>
    {loading ? <p role="status">Loading refund requests…</p> : error ? <p role="alert" className="text-danger-400">{error}</p> : rows.length === 0 ? <EmptyState icon={<Receipt className="size-7" />} title="No refund requests" body="No requests match the current filters." /> :
      <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Request', 'Payment', 'Category & reason', 'Requested', 'Status', '']}><thead><Tr><Th>Request</Th><Th>Payment</Th><Th>Category & reason</Th><Th>Requested</Th><Th>Status</Th><Th /></Tr></thead><tbody>{rows.map((row) => <Tr key={row.id}>
        <Td><span className="block text-fg">{row.username ? `@${row.username}` : `Request #${row.id}`}</span><span className="block text-xs text-ink-300">{row.email ?? `Subscription #${row.subscriptionId ?? '—'}`}</span><span className="block font-mono text-[11px] text-ink-400">Refund #{row.id}</span></Td>
        <Td>#{row.paymentId}{row.planName ? ` · ${row.planName}` : ''}<span className="block text-xs text-ink-300">{row.amount != null ? `${row.amount} ${row.currency ?? ''}` : 'Amount unavailable'}{row.simulation ? ' · simulated' : ''}</span></Td>
        <Td className="max-w-sm whitespace-normal"><span className="letterboard text-[10px] text-tone-cyan-300">{row.category?.replaceAll('_', ' ') ?? 'UNCATEGORIZED'}</span><span className="mt-1 block">{row.reason}</span>{row.processingNote && <span className="mt-1 block text-xs text-ink-300">Decision: {row.processingNote}</span>}</Td><Td>{date(row.requestedAt)}{row.eligibleUntil && <span className="block text-xs text-ink-300">Eligible until {date(row.eligibleUntil)}</span>}</Td><Td><Letterboard tone={tone(row.status)}>{row.status}</Letterboard></Td><Td>{row.status === 'PENDING' && <Button size="sm" onClick={() => { setSelected(row); setDecision('APPROVED'); setNote(''); setNoteError(null) }}>Decide</Button>}</Td>
      </Tr>)}</tbody></Table></div>}
    {result && result.totalPages > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-300"><span>Page {result.page + 1} of {result.totalPages} · {result.totalElements} requests</span><div className="flex gap-2"><Button size="sm" variant="quiet" disabled={result.page === 0 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button><Button size="sm" variant="quiet" disabled={!result.hasNext || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</Button></div></div>}
    <Modal open={selected != null} onClose={() => !saving && setSelected(null)} title="Decide refund request" description={selected ? `Request #${selected.id} for payment #${selected.paymentId}` : undefined} footer={<><Button variant="quiet" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button><Button variant={decision === 'REJECTED' ? 'danger' : 'primary'} loading={saving} onClick={() => void decide()}>{decision === 'APPROVED' ? 'Approve refund' : 'Reject request'}</Button></>}>
      <div className="space-y-4"><Field label="Decision"><Select value={decision} onChange={(event) => { setDecision(event.target.value as 'APPROVED' | 'REJECTED'); setNoteError(null) }}><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option></Select></Field><Field label="Decision note" required={decision === 'REJECTED'} hint={decision === 'APPROVED' ? 'Optional' : undefined} error={noteError ?? undefined}><Textarea maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setNoteError(null) }} placeholder={decision === 'REJECTED' ? 'Explain why this request is rejected.' : 'Add an optional note for the requester.'} /></Field></div>
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
