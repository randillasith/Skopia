import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Inbox, Check, UserPlus, AlertTriangle, Search as SearchIcon,
} from 'lucide-react'
import {
  Button, Field, Select, Textarea, Table, Th, Td, Tr, Tabs, EmptyState,
  SearchInput, useToast, Avatar,
} from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { BackOfHouse, useSession } from '@/components/Shell'
import { Resolve } from '@/components/Loading'
import { ApiError } from '@/lib/api'
import { actorId as actorIdOf } from '@/lib/session'
import {
  complaints, loadQueue, reports, referenceOf, subjectOf,
  COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE, REPORT_TYPE_LABEL,
  type ComplaintHistoryEntry, type ComplaintPriority, type ComplaintStatus,
  type QueueItem, type ServerReport,
} from '@/lib/reports'

const PRIORITY_TONE: Record<ComplaintPriority, 'neutral' | 'soon' | 'review' | 'bad'> = {
  LOW: 'neutral', MEDIUM: 'soon', HIGH: 'review', URGENT: 'bad',
}
const PRIORITY_LABEL: Record<ComplaintPriority, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent',
}

const STATUSES: ComplaintStatus[] = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED',
]
const PRIORITIES: ComplaintPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

/** A complaint nobody is going to touch again. */
const settled = (s: ComplaintStatus) => s === 'RESOLVED' || s === 'CLOSED'

/**
 * The queue, with each complaint's report fetched alongside it.
 *
 * `search` without an officer answers with the open queue, so which call is made
 * depends on the tab: "assigned to me" is a different question from "what is
 * open", not a filter over the same answer.
 */
function useQueue(officerId: number | null, scope: 'open' | 'mine') {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    const rows =
      scope === 'mine' && officerId != null
        ? complaints.search({ officerId }, abort.signal)
        : complaints.queue(abort.signal)
    rows
      .then((list) => loadQueue(list, abort.signal))
      .then((joined) => {
        setItems(joined)
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not read the queue.')
        setItems([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [officerId, scope, nonce])

  return { items, loading, error, refresh: useCallback(() => setNonce((n) => n + 1), []) }
}

/* ============================================================ the queue */

export function SupportQueue() {
  const nav = useNavigate()
  const { viewer } = useSession()
  const officerId = actorIdOf(viewer)
  const [tab, setTab] = useState('unassigned')
  const [q, setQ] = useState('')
  const { items, loading, error, refresh } = useQueue(officerId, tab === 'mine' ? 'mine' : 'open')

  const list = useMemo(() => {
    let l = items
    if (tab === 'unassigned') l = l.filter((i) => i.complaint.assignedOfficerId == null)
    if (tab === 'open') l = l.filter((i) => !settled(i.complaint.status))
    if (q.trim()) {
      const t = q.toLowerCase()
      l = l.filter((i) => `${referenceOf(i.complaint)} ${subjectOf(i)}`.toLowerCase().includes(t))
    }
    return l
  }, [items, tab, q])

  const urgent = items.filter((i) => i.complaint.priority === 'URGENT' && !settled(i.complaint.status))

  return (
    <BackOfHouse title="Complaint queue">
      {urgent.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-sm border sm:flex-row sm:items-center border-danger-500/35 bg-danger-500/8 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-tone-danger-400" />
          <p className="min-w-0 flex-1 text-[13.5px] text-ink-200">
            <span className="font-medium text-tone-danger-400">
              {urgent.length} urgent complaint{urgent.length > 1 ? 's' : ''} open.
            </span>{' '}
            Urgent items are worked before anything else in the queue.
          </p>
          <Button size="sm" onClick={() => nav(`/queue/${urgent[0].complaint.id}`)}>
            Open {referenceOf(urgent[0].complaint)}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'unassigned', label: 'Unassigned', count: items.filter((i) => i.complaint.assignedOfficerId == null).length },
              { id: 'mine', label: 'Assigned to me' },
              { id: 'open', label: 'All open', count: items.filter((i) => !settled(i.complaint.status)).length },
              { id: 'all', label: 'Everything', count: items.length },
            ]}
          />
        </div>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a complaint" className="w-full sm:w-64" />
      </div>

      {loading || error ? (
        <div className="mt-8">
          <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the queue">
            {null}
          </Resolve>
        </div>
      ) : list.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Inbox className="size-7" />} title="Queue is clear"
            body="Nothing matches this filter. Try another tab." />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Reference", "Subject", "Type", "Status", "Priority", "Assignee", "Raised"]}>
            <thead>
              <tr>
                <Th>Reference</Th><Th>Subject</Th><Th>Type</Th><Th>Status</Th>
                <Th>Priority</Th><Th>Assignee</Th><Th>Raised</Th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ complaint, report }) => (
                <Tr key={complaint.id} onClick={() => nav(`/queue/${complaint.id}`)}>
                  <Td><span className="font-mono tabular-nums text-ink-100">{referenceOf(complaint)}</span></Td>
                  <Td><span className="font-medium text-fg">{subjectOf({ complaint, report })}</span></Td>
                  <Td className="text-ink-300">{report ? REPORT_TYPE_LABEL[report.type] : '—'}</Td>
                  <Td>
                    <Letterboard tone={COMPLAINT_STATUS_TONE[complaint.status]}>
                      {COMPLAINT_STATUS_LABEL[complaint.status].toUpperCase()}
                    </Letterboard>
                  </Td>
                  <Td>
                    <Letterboard tone={PRIORITY_TONE[complaint.priority]}>
                      {PRIORITY_LABEL[complaint.priority].toUpperCase()}
                    </Letterboard>
                  </Td>
                  {/* The API records who is assigned by id, not by name; there is
                      no endpoint that turns an officer id into a person. */}
                  <Td className="text-ink-300">
                    {complaint.assignedOfficerId != null
                      ? `Officer #${complaint.assignedOfficerId}`
                      : '—'}
                  </Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{complaint.createdAt?.slice(0, 10)}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </BackOfHouse>
  )
}

/* ======================================================== complaint detail */

export function ComplaintDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const toast = useToast()
  const { viewer } = useSession()
  const officerId = actorIdOf(viewer)
  const numericId = Number(id)

  const [item, setItem] = useState<QueueItem | null>(null)
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resolution, setResolution] = useState('')
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  // There is no endpoint that fetches one complaint, so it is found in the queue
  // it belongs to. Its history comes from its own endpoint.
  useEffect(() => {
    if (!Number.isFinite(numericId)) {
      setError('That is not a complaint reference.')
      setLoading(false)
      return
    }
    const abort = new AbortController()
    setLoading(true)
    complaints
      .search({}, abort.signal)
      .then(async (rows) => {
        const found = rows.find((c) => c.id === numericId)
        if (!found) {
          // Not in the open queue — it may be assigned to this officer instead.
          const mine = officerId != null ? await complaints.search({ officerId }, abort.signal) : []
          const other = mine.find((c) => c.id === numericId)
          if (!other) throw new ApiError(404, 'That reference is not in the queue.')
          return other
        }
        return found
      })
      .then(async (complaint) => {
        const report: ServerReport | null =
          complaint.reportId != null
            ? await reports.one(complaint.reportId, abort.signal).catch(() => null)
            : null
        setItem({ complaint, report })
        setResolution(complaint.resolutionNotes ?? '')
        setError(null)
        return complaints.history(complaint.id, abort.signal).catch(() => [])
      })
      .then((entries) => setHistory(entries ?? []))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not open that complaint.')
        setItem(null)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [numericId, officerId, nonce])

  /** Every handling action goes the same way, so failure is reported once. */
  const handle = async (what: () => Promise<unknown>, said: string, tone?: 'ok' | 'bad') => {
    if (officerId == null) return toast({ title: 'Sign in as an officer first.', tone: 'bad' })
    setBusy(true)
    try {
      await what()
      toast({ title: said, tone })
      refresh()
    } catch (cause) {
      toast({
        title: cause instanceof ApiError ? cause.message : 'That did not go through.',
        tone: 'bad',
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading || error || !item) {
    return (
      <BackOfHouse title="Complaint">
        <Resolve loading={loading} error={error} onRetry={refresh} what="Opening the complaint">
          <EmptyState title="No such complaint" body="That reference does not exist in the queue."
            action={<Button onClick={() => nav('/queue')}>Back to the queue</Button>} />
        </Resolve>
      </BackOfHouse>
    )
  }

  const { complaint, report } = item
  const assigned = complaint.assignedOfficerId != null
  const resolved = settled(complaint.status)

  return (
    <BackOfHouse
      title={referenceOf(complaint)}
      actions={
        !assigned ? (
          <Button
            size="sm"
            variant="primary"
            icon={<UserPlus className="size-4" />}
            loading={busy}
            onClick={() =>
              handle(
                () => complaints.assign(complaint.id, officerId!),
                'Assigned to you',
                'ok',
              )
            }
          >
            Accept this complaint
          </Button>
        ) : null
      }
    >
      <Link to="/queue" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-fg">
        <ArrowLeft className="size-4" /> Back to the queue
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Letterboard tone={COMPLAINT_STATUS_TONE[complaint.status]}>
              {COMPLAINT_STATUS_LABEL[complaint.status].toUpperCase()}
            </Letterboard>
            <Letterboard tone={PRIORITY_TONE[complaint.priority]}>
              {PRIORITY_LABEL[complaint.priority].toUpperCase()}
            </Letterboard>
            {report && <Letterboard>{REPORT_TYPE_LABEL[report.type]}</Letterboard>}
          </div>

          <h2 className="font-marquee mt-3 text-[clamp(1.4rem,3vw,1.9rem)] font-extrabold tracking-[-0.025em] text-fg">
            {subjectOf(item)}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[13px] text-ink-300">
            <Avatar name={`Viewer ${complaint.reportingViewerId ?? ''}`} size={26} />
            Raised by viewer #{complaint.reportingViewerId ?? '—'} on{' '}
            {complaint.createdAt?.slice(0, 10)}
            {report?.contentReference && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">{report.contentReference}</span>
              </>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850 p-5">
            <p className="letterboard mb-2 text-ink-300">What was reported</p>
            <p className="text-[14.5px] leading-relaxed text-ink-100">
              {report?.details ?? 'The report behind this complaint could not be read.'}
            </p>
          </div>

          <div className="mt-6">
            <Field label="Resolution" hint={resolved ? 'Recorded' : 'Required to resolve or close'}>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="What was done, and what the reporter should expect. This is sent to them."
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<Check className="size-4" />}
                disabled={!resolution.trim() || busy}
                onClick={() =>
                  handle(
                    () => complaints.resolve(complaint.id, resolution.trim(), officerId!),
                    'Resolved — reporter notified',
                    'ok',
                  )
                }
              >
                Record resolution
              </Button>
              {complaint.status === 'RESOLVED' && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    handle(
                      () => complaints.close(complaint.id, officerId!),
                      'Complaint closed — history kept',
                    )
                  }
                >
                  Close complaint
                </Button>
              )}
            </div>
          </div>

          <div className="mt-9">
            <p className="letterboard mb-3 text-ink-300">History</p>
            {history.length === 0 ? (
              <p className="text-[13.5px] text-ink-300">Nothing recorded yet beyond it being raised.</p>
            ) : (
              <ol className="space-y-4 border-l border-ink-700 pl-4">
                {history.map((h, i) => (
                  <li key={h.id ?? i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-violet-500 ring-2 ring-canvas" />
                    <p className="text-[13.5px] text-ink-100">{h.action ?? 'Updated'}</p>
                    {h.notes && <p className="mt-0.5 text-[13px] text-ink-300">{h.notes}</p>}
                    <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                      {h.performedAt?.replace('T', ' ').slice(0, 16)}
                      {h.performedBy != null && ` · Officer #${h.performedBy}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
            <p className="letterboard mb-3 text-ink-300">Handling</p>
            <div className="space-y-4">
              <Field label="Status">
                <Select
                  value={complaint.status}
                  disabled={busy}
                  onChange={(e) =>
                    handle(
                      () =>
                        complaints.updateStatus(
                          complaint.id,
                          e.target.value as ComplaintStatus,
                          complaint.priority,
                          officerId!,
                        ),
                      'Status updated',
                    )
                  }
                >
                  {STATUSES.map((s) => (
                    // Resolving or closing without a resolution is refused by the
                    // server, so it is not offered here either.
                    <option
                      key={s}
                      value={s}
                      disabled={!resolution.trim() && settled(s) && complaint.status !== s}
                    >
                      {COMPLAINT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={complaint.priority}
                  disabled={busy}
                  onChange={(e) =>
                    handle(
                      () =>
                        complaints.updateStatus(
                          complaint.id,
                          complaint.status,
                          e.target.value as ComplaintPriority,
                          officerId!,
                        ),
                      'Priority updated',
                    )
                  }
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Assignee" hint="Accepting a complaint assigns it to you.">
                <Select disabled value={complaint.assignedOfficerId != null ? 'me' : ''}>
                  <option value="">Unassigned</option>
                  <option value="me">Officer #{complaint.assignedOfficerId ?? ''}</option>
                </Select>
              </Field>
            </div>
          </div>

          {report?.type === 'INAPPROPRIATE_CONTENT' && (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/6 p-4">
              <p className="font-marquee text-[15px] font-bold text-tone-warning-400">
                Moderation may be needed
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">
                Content complaints can require an administrator to act on the title itself.
              </p>
              <Button size="sm" className="mt-3 w-full" onClick={() => nav('/admin/moderation')}>
                Refer to moderation
              </Button>
            </div>
          )}
        </aside>
      </div>
    </BackOfHouse>
  )
}

/* ====================================================== complaint history */

export function ComplaintHistory() {
  const nav = useNavigate()
  const { viewer } = useSession()
  const officerId = actorIdOf(viewer)
  const { items, loading, error, refresh } = useQueue(officerId, 'open')
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')

  const list = items.filter(({ complaint, report }) => {
    if (type !== 'All' && (!report || REPORT_TYPE_LABEL[report.type] !== type)) return false
    if (q.trim()) {
      const t = q.toLowerCase()
      const hay = `${referenceOf(complaint)} ${subjectOf({ complaint, report })} ${report?.details ?? ''}`
      if (!hay.toLowerCase().includes(t)) return false
    }
    return true
  })

  return (
    <BackOfHouse title="Complaint history">
      <p className="max-w-[64ch] text-[14px] leading-relaxed text-ink-300">
        Every complaint is kept after it is closed, with its full handling history.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search references, subjects and detail" className="flex-1" />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className="sm:w-56">
          <option>All</option>
          {Object.values(REPORT_TYPE_LABEL).map((label) => (
            <option key={label}>{label}</option>
          ))}
        </Select>
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">
        {loading ? 'Reading' : `${list.length} ${list.length === 1 ? 'complaint' : 'complaints'}`}
      </p>

      {loading || error ? (
        <div className="mt-6">
          <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the history">
            {null}
          </Resolve>
        </div>
      ) : list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<SearchIcon className="size-7" />} title="Nothing matched"
            body="No complaint matched that search. Try a different word or clear the type filter."
            action={<Button onClick={() => { setQ(''); setType('All') }}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Reference", "Subject", "Type", "Status", "Handled by", "Raised", "Events"]}>
            <thead>
              <tr>
                <Th>Reference</Th><Th>Subject</Th><Th>Type</Th><Th>Status</Th>
                <Th>Handled by</Th><Th>Raised</Th><Th>Closed</Th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ complaint, report }) => (
                <Tr key={complaint.id} onClick={() => nav(`/queue/${complaint.id}`)}>
                  <Td><span className="font-mono tabular-nums text-ink-100">{referenceOf(complaint)}</span></Td>
                  <Td><span className="font-medium text-fg">{subjectOf({ complaint, report })}</span></Td>
                  <Td className="text-ink-300">{report ? REPORT_TYPE_LABEL[report.type] : '—'}</Td>
                  <Td>
                    <Letterboard tone={COMPLAINT_STATUS_TONE[complaint.status]}>
                      {COMPLAINT_STATUS_LABEL[complaint.status].toUpperCase()}
                    </Letterboard>
                  </Td>
                  <Td className="text-ink-300">
                    {complaint.assignedOfficerId != null ? `Officer #${complaint.assignedOfficerId}` : '—'}
                  </Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{complaint.createdAt?.slice(0, 10)}</span></Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{complaint.closedAt?.slice(0, 10) ?? '—'}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </BackOfHouse>
  )
}
