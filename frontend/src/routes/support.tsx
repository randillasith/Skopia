import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate} from 'react-router-dom'
import {
  ArrowLeft, Inbox, Check, Send, UserPlus, AlertTriangle, Search as SearchIcon,
} from 'lucide-react'
import {
  Button, Field, Select, Textarea, Table, Th, Td, Tr, Tabs, EmptyState,
  SearchInput, useToast, Avatar,
} from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { BackOfHouse } from '@/components/Shell'
import { REPORTS, byId, type Priority, type ReportStatus } from '@/lib/data'
import { REPORT_TONE } from '@/routes/reports'

const PRIORITY_TONE: Record<Priority, 'neutral' | 'soon' | 'review' | 'bad'> = {
  Low: 'neutral', Normal: 'soon', High: 'review', Urgent: 'bad',
}

const STATUSES: ReportStatus[] = ['Submitted', 'Under review', 'Needs info', 'Resolved', 'Closed']
const PRIORITIES: Priority[] = ['Low', 'Normal', 'High', 'Urgent']

/* ============================================================ the queue */

export function SupportQueue() {
  const nav = useNavigate()
  const [tab, setTab] = useState('unassigned')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    let l = REPORTS
    if (tab === 'unassigned') l = l.filter((r) => !r.assignee)
    if (tab === 'mine') l = l.filter((r) => r.assignee === 'D. Fernando')
    if (tab === 'open') l = l.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed')
    if (q.trim()) l = l.filter((r) => `${r.id} ${r.subject} ${r.type}`.toLowerCase().includes(q.toLowerCase()))
    return l
  }, [tab, q])

  const urgent = REPORTS.filter((r) => r.priority === 'Urgent' && r.status !== 'Resolved')

  return (
    <BackOfHouse title="Complaint queue">
      {urgent.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-sm border sm:flex-row sm:items-center border-danger-500/35 bg-danger-500/8 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-danger-400" />
          <p className="min-w-0 flex-1 text-[13.5px] text-ink-200">
            <span className="font-medium text-danger-400">
              {urgent.length} urgent complaint{urgent.length > 1 ? 's' : ''} open.
            </span>{' '}
            Urgent items are worked before anything else in the queue.
          </p>
          <Button size="sm" onClick={() => nav(`/queue/${urgent[0].id}`)}>
            Open {urgent[0].id}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'unassigned', label: 'Unassigned', count: REPORTS.filter((r) => !r.assignee).length },
              { id: 'mine', label: 'Assigned to me', count: REPORTS.filter((r) => r.assignee === 'D. Fernando').length },
              { id: 'open', label: 'All open', count: REPORTS.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed').length },
              { id: 'all', label: 'Everything', count: REPORTS.length },
            ]}
          />
        </div>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a complaint" className="w-full sm:w-64" />
      </div>

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Inbox className="size-7" />} title="Queue is clear"
            body="Nothing matches this filter. Try another tab." />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Reference", "Subject", "Type", "Status", "Priority", "Assignee", "Submitted"]}>
            <thead>
              <tr>
                <Th>Reference</Th><Th>Subject</Th><Th>Type</Th><Th>Status</Th>
                <Th>Priority</Th><Th>Assignee</Th><Th>Submitted</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <Tr key={r.id} onClick={() => nav(`/queue/${r.id}`)}>
                  <Td><span className="font-mono tabular-nums text-ink-100">{r.id}</span></Td>
                  <Td><span className="font-medium text-white">{r.subject}</span></Td>
                  <Td className="text-ink-300">{r.type}</Td>
                  <Td><Letterboard tone={REPORT_TONE[r.status]}>{r.status.toUpperCase()}</Letterboard></Td>
                  <Td><Letterboard tone={PRIORITY_TONE[r.priority]}>{r.priority.toUpperCase()}</Letterboard></Td>
                  <Td className="text-ink-300">{r.assignee ?? <span className="text-ink-300">—</span>}</Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{r.submitted}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-ink-300">
        Status and priority value sets, and the assignment rules, are open decisions in the project
        documentation — the values shown here are provisional.
      </p>
    </BackOfHouse>
  )
}

/* ======================================================== complaint detail */

export function ComplaintDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const r = REPORTS.find((x) => x.id === id)
  const toast = useToast()
  const [status, setStatus] = useState<ReportStatus>(r?.status ?? 'Submitted')
  const [priority, setPriority] = useState<Priority>(r?.priority ?? 'Normal')
  const [resolution, setResolution] = useState('')
  const [assigned, setAssigned] = useState(!!r?.assignee)

  if (!r) {
    return (
      <BackOfHouse title="Complaint not found">
        <EmptyState title="No such complaint" body="That reference does not exist in the queue."
          action={<Button onClick={() => nav('/queue')}>Back to the queue</Button>} />
      </BackOfHouse>
    )
  }

  const target = r.target ? byId(r.target) : undefined
  const resolved = status === 'Resolved' || status === 'Closed'

  return (
    <BackOfHouse
      title={r.id}
      actions={
        !assigned ? (
          <Button size="sm" variant="primary" icon={<UserPlus className="size-4" />}
            onClick={() => { setAssigned(true); setStatus('Under review'); toast({ title: 'Assigned to you', tone: 'ok' }) }}>
            Accept this complaint
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => toast({ title: 'Handling saved', tone: 'ok' })}>
            Save handling
          </Button>
        )
      }
    >
      <Link to="/queue" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white">
        <ArrowLeft className="size-4" /> Back to the queue
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Letterboard tone={REPORT_TONE[status]}>{status.toUpperCase()}</Letterboard>
            <Letterboard tone={PRIORITY_TONE[priority]}>{priority.toUpperCase()}</Letterboard>
            <Letterboard>{r.type}</Letterboard>
          </div>

          <h2 className="font-marquee mt-3 text-[clamp(1.4rem,3vw,1.9rem)] font-extrabold tracking-[-0.025em] text-white">
            {r.subject}
          </h2>

          <div className="mt-4 flex items-center gap-2.5 text-[13px] text-ink-300">
            <Avatar name={r.reporter === 'you' ? 'You There' : r.reporter} size={26} />
            Reported by {r.reporter === 'you' ? 'you' : r.reporter} on {r.submitted}
            {target && (
              <>
                <span aria-hidden>·</span>
                <Link to={`/watch/${target.id}`} className="text-cyan-300 hover:underline">
                  {target.title}
                </Link>
              </>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-ink-700 bg-ink-850 p-5">
            <p className="letterboard mb-2 text-ink-300">What was reported</p>
            <p className="text-[14.5px] leading-relaxed text-ink-100">{r.detail}</p>
          </div>

          {/* resolution */}
          <div className="mt-6">
            <Field
              label="Resolution"
              hint={resolved ? 'Recorded' : 'Required to resolve or close'}
            >
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
                disabled={!resolution.trim()}
                onClick={() => { setStatus('Resolved'); toast({ title: 'Resolved — reporter notified', tone: 'ok' }) }}
              >
                Record resolution
              </Button>
              <Button
                icon={<Send className="size-4" />}
                onClick={() => { setStatus('Needs info'); toast({ title: 'Reporter asked for more detail' }) }}
              >
                Ask the reporter for more
              </Button>
              {status === 'Resolved' && (
                <Button variant="ghost" onClick={() => { setStatus('Closed'); toast({ title: 'Complaint closed — history kept' }) }}>
                  Close complaint
                </Button>
              )}
            </div>
          </div>

          {/* history */}
          <div className="mt-9">
            <p className="letterboard mb-3 text-ink-300">History</p>
            <ol className="space-y-4 border-l border-ink-700 pl-4">
              {r.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-violet-500 ring-2 ring-canvas" />
                  <p className="text-[13.5px] text-ink-100">{h.what}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-300">{h.at} · {h.who}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* controls */}
        <aside className="space-y-5">
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-4">
            <p className="letterboard mb-3 text-ink-300">Handling</p>
            <div className="space-y-4">
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
                  {STATUSES.map((s) => (
                    // A complaint cannot be resolved or closed until a resolution is
                    // recorded — the same rule the Record resolution button enforces.
                    <option
                      key={s}
                      disabled={
                        !resolution.trim() && (s === 'Resolved' || s === 'Closed') && status !== s
                      }
                    >
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Assignee">
                <Select defaultValue={r.assignee ?? ''}>
                  <option value="">Unassigned</option>
                  <option>D. Fernando</option>
                  <option>S. Wijesinghe</option>
                  <option>K. Laknadi</option>
                </Select>
              </Field>
            </div>
          </div>

          {r.type === 'Inappropriate content' && (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/6 p-4">
              <p className="font-marquee text-[15px] font-bold text-warning-400">
                Moderation may be needed
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">
                Content complaints can require an administrator to act on the title itself.
              </p>
              <Button size="sm" className="mt-3 w-full"
                onClick={() => nav('/admin/moderation')}>
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
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')

  const list = REPORTS.filter((r) => {
    if (type !== 'All' && r.type !== type) return false
    if (q.trim() && !`${r.id} ${r.subject} ${r.detail}`.toLowerCase().includes(q.toLowerCase())) return false
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
          <option>Inappropriate content</option>
          <option>Playback problem</option>
          <option>Accessibility</option>
          <option>Other</option>
        </Select>
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">
        {list.length} {list.length === 1 ? 'complaint' : 'complaints'}
      </p>

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<SearchIcon className="size-7" />} title="Nothing matched"
            body="No complaint matched that search. Try a different word or clear the type filter."
            action={<Button onClick={() => { setQ(''); setType('All') }}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Reference", "Subject", "Type", "Status", "Handled by", "Submitted", "Events"]}>
            <thead>
              <tr>
                <Th>Reference</Th><Th>Subject</Th><Th>Type</Th><Th>Status</Th>
                <Th>Handled by</Th><Th>Submitted</Th><Th numeric>Events</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <Tr key={r.id} onClick={() => nav(`/queue/${r.id}`)}>
                  <Td><span className="font-mono tabular-nums text-ink-100">{r.id}</span></Td>
                  <Td><span className="font-medium text-white">{r.subject}</span></Td>
                  <Td className="text-ink-300">{r.type}</Td>
                  <Td><Letterboard tone={REPORT_TONE[r.status]}>{r.status.toUpperCase()}</Letterboard></Td>
                  <Td className="text-ink-300">{r.assignee ?? <span className="text-ink-300">—</span>}</Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{r.submitted}</span></Td>
                  <Td numeric>{r.history.length}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </BackOfHouse>
  )
}
