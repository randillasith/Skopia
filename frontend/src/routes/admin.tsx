import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Check, X, AlertTriangle, Ban, ShieldCheck, Plus, Megaphone, Eye,
  Download, Trash2, ScrollText,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Textarea, Table, Th, Td, Tr, Tabs, Modal,
  EmptyState, Placeholder, Toggle, useToast, SearchInput, Avatar, Section, Checkbox,
} from '@/components/primitives'
import { Letterboard, BillingBoard } from '@/components/world'
import { BackOfHouse } from '@/components/Shell'
import {
  ACCOUNTS, PERMISSIONS, ROLE_MATRIX, LOGS, VIDEOS, REPORTS, CAMPAIGNS, PLANS,
  PAYMENTS, ANNOUNCEMENTS, ROLES, UNDECIDED, type Role, type Account,
} from '@/lib/data'
import { cn } from '@/lib/cn'

const ACCOUNT_TONE: Record<Account['status'], 'ok' | 'review' | 'bad' | 'soon'> = {
  Active: 'ok', Suspended: 'review', Blocked: 'bad', Invited: 'soon',
}

/* ============================================================= dashboard */

export function AdminDashboard() {
  const openReports = REPORTS.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed')
  const inReview = VIDEOS.filter((v) => v.billing === 'IN REVIEW')

  return (
    <BackOfHouse title="Dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Accounts', String(ACCOUNTS.length), `${ACCOUNTS.filter((a) => a.status === 'Active').length} active`],
          ['Titles', String(VIDEOS.length), `${inReview.length} awaiting review`],
          ['Open complaints', String(openReports.length), `${REPORTS.filter((r) => r.priority === 'Urgent').length} urgent`],
          ['Active campaigns', String(CAMPAIGNS.filter((c) => c.status === 'Active').length), `${CAMPAIGNS.filter((c) => c.status === 'Expired').length} expired`],
        ].map(([l, v, sub]) => (
          <div key={l} className="border-l border-ink-700 pl-3">
            <p className="letterboard text-ink-300">{l}</p>
            <p className="font-marquee mt-1 text-[32px] font-bold leading-none tabular-nums text-white">{v}</p>
            <p className="mt-1.5 text-[12.5px] text-ink-300">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Section
          title="Needs attention"
          action={<Link to="/admin/moderation" className="text-[13px] text-cyan-300 hover:underline">Moderation</Link>}
        >
          <ul className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850">
            {[
              ...inReview.map((v) => ({ k: v.id, board: 'IN REVIEW', title: v.title, sub: `${v.creator} · awaiting moderation`, to: '/admin/moderation' })),
              ...openReports.slice(0, 3).map((r) => ({ k: r.id, board: r.priority.toUpperCase(), title: r.subject, sub: `${r.id} · ${r.type}`, to: `/queue/${r.id}` })),
            ].map((row) => (
              <li key={row.k}>
                <Link to={row.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800/60">
                  <Letterboard tone={row.board === 'URGENT' ? 'bad' : 'review'}>{row.board}</Letterboard>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-white">{row.title}</span>
                    <span className="block truncate text-[12px] text-ink-300">{row.sub}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Recent activity"
          action={<Link to="/admin/logs" className="text-[13px] text-cyan-300 hover:underline">Full log</Link>}
        >
          <ul className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850">
            {LOGS.slice(0, 6).map((l, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('size-1.5 shrink-0 rounded-full', l.outcome === 'ok' ? 'bg-success-500' : 'bg-danger-500')} />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-200">
                  <span className="text-cyan-300">{l.actor}</span> {l.action} {l.target}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-300">
                  {l.at.slice(11, 16)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </BackOfHouse>
  )
}

/* ============================================================== accounts */

export function AdminAccounts() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('All')
  const [acting, setActing] = useState<Account | null>(null)
  const toast = useToast()

  const list = useMemo(
    () =>
      ACCOUNTS.filter((a) => {
        if (role !== 'All' && a.role !== role) return false
        if (q.trim() && !`${a.name} ${a.handle} ${a.id}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [q, role],
  )

  return (
    <BackOfHouse
      title="Accounts"
      actions={<Button size="sm" variant="primary" icon={<Plus className="size-4" />}>Invite account</Button>}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, handle or id" className="flex-1" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="sm:w-52">
          <option>All</option>
          {(Object.keys(ROLES) as Role[]).filter((r) => r !== 'guest').map((r) => (
            <option key={r} value={r}>{ROLES[r].label}</option>
          ))}
        </Select>
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">{list.length} accounts</p>

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<Users className="size-7" />} title="No accounts matched"
            body="Nothing matched that search and role filter."
            action={<Button onClick={() => { setQ(''); setRole('All') }}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Account", "Role", "Status", "Joined", "Last seen", ""]}>
            <thead>
              <tr>
                <Th>Account</Th><Th>Role</Th><Th>Status</Th><Th>Joined</Th><Th>Last seen</Th><Th />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Avatar name={a.name} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-white">{a.name}</span>
                        <span className="block truncate font-mono text-[11px] text-ink-300">
                          @{a.handle} · {a.id}
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <Select
                      defaultValue={a.role}
                      aria-label={`Role for ${a.name}`}
                      className="w-40"
                      onChange={() => toast({ title: `Role updated for ${a.name}`, tone: 'ok' })}
                    >
                      {(Object.keys(ROLES) as Role[]).filter((r) => r !== 'guest').map((r) => (
                        <option key={r} value={r}>{ROLES[r].short}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td><Letterboard tone={ACCOUNT_TONE[a.status]}>{a.status.toUpperCase()}</Letterboard></Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{a.joined}</span></Td>
                  <Td className="text-ink-300">{a.lastSeen}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="quiet" onClick={() => setActing(a)}>
                        {a.status === 'Active' ? 'Suspend' : 'Restore'}
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal
        open={!!acting}
        onClose={() => setActing(null)}
        title={acting?.status === 'Active' ? `Suspend ${acting?.name}?` : `Restore ${acting?.name}?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setActing(null)}>Cancel</Button>
            <Button
              variant={acting?.status === 'Active' ? 'danger' : 'primary'}
              onClick={() => {
                toast({
                  title: acting?.status === 'Active' ? `${acting?.name} suspended` : `${acting?.name} restored`,
                  tone: acting?.status === 'Active' ? 'bad' : 'ok',
                })
                setActing(null)
              }}
            >
              {acting?.status === 'Active' ? 'Suspend account' : 'Restore account'}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          {acting?.status === 'Active'
            ? 'The account cannot sign in while suspended. Their content stays in place, and the action is written to the activity log.'
            : 'The account regains its previous role and access. The action is written to the activity log.'}
        </p>
      </Modal>
    </BackOfHouse>
  )
}

/* ================================================================= roles */

export function AdminRoles() {
  const toast = useToast()
  const roles = Object.keys(ROLE_MATRIX) as (keyof typeof ROLE_MATRIX)[]

  return (
    <BackOfHouse
      title="Roles & permissions"
      actions={<Button size="sm" variant="primary" onClick={() => toast({ title: 'Matrix saved', tone: 'ok' })}>Save matrix</Button>}
    >
      <div className="flex items-start gap-2.5 rounded-sm border border-warning-500/35 bg-warning-500/8 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-400" />
        <p className="text-[13.5px] leading-relaxed text-ink-200">
          The detailed role hierarchy and permission matrix are an open decision in the project
          documentation. What follows is a working draft, not a confirmed specification.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-ink-700 bg-ink-850">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead>
            <tr>
              <Th className="w-64">Permission</Th>
              {roles.map((r) => <Th key={r} className="text-center">{ROLES[r].short}</Th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p, pi) => (
              <tr key={p}>
                <Td className="font-medium text-white">{p}</Td>
                {roles.map((r) => {
                  const on = ROLE_MATRIX[r][pi]
                  return (
                    <Td key={r} className="text-center">
                      <span
                        className={cn(
                          'inline-flex size-6 items-center justify-center rounded-xs border',
                          on
                            ? 'border-success-500/40 bg-success-500/12 text-success-400'
                            : 'border-ink-700 bg-ink-900 text-ink-300',
                        )}
                        aria-label={on ? 'Allowed' : 'Not allowed'}
                      >
                        {on ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" />}
                      </span>
                    </Td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BackOfHouse>
  )
}

/* ============================================================ moderation */

export function AdminModeration() {
  const toast = useToast()
  const reported = REPORTS.filter((r) => r.type === 'Inappropriate content')
  const [tab, setTab] = useState('queue')

  return (
    <BackOfHouse title="Moderation">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'queue', label: 'Reported content', count: reported.length },
          { id: 'titles', label: 'All titles', count: VIDEOS.length },
        ]}
      />

      {tab === 'queue' ? (
        reported.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<ShieldCheck className="size-7" />} title="Nothing reported"
              body="No content complaints are waiting for a moderation decision." />
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {reported.map((r) => {
              const v = r.target ? VIDEOS.find((x) => x.id === r.target) : undefined
              return (
                <li key={r.id} className="rounded-lg border border-ink-700 bg-ink-850 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-300">{r.id}</span>
                        <Letterboard tone={r.priority === 'Urgent' ? 'bad' : 'review'}>
                          {r.priority.toUpperCase()}
                        </Letterboard>
                        {v && <BillingBoard billing={v.billing} />}
                      </div>
                      <p className="mt-2 text-[15px] font-medium text-white">{r.subject}</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-300">{r.detail}</p>
                      {v && (
                        <p className="mt-2 text-[12.5px] text-ink-300">
                          On{' '}
                          <Link to={`/watch/${v.id}`} className="text-cyan-300 hover:underline">
                            {v.title}
                          </Link>{' '}
                          by {v.creator}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" icon={<Eye className="size-4" />}
                        onClick={() => v && (window.location.href = `/watch/${v.id}`)}>
                        Review
                      </Button>
                      <Button size="sm" variant="secondary"
                        onClick={() => toast({ title: 'No action taken — content left as it is' })}>
                        Leave as is
                      </Button>
                      <Button size="sm" variant="danger" icon={<Ban className="size-4" />}
                        onClick={() => toast({ title: 'Title pulled from the programme', tone: 'bad' })}>
                        Pull title
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Title", "Creator", "Billing", "Views", ""]}>
            <thead>
              <tr><Th>Title</Th><Th>Creator</Th><Th>Billing</Th><Th numeric>Views</Th><Th /></tr>
            </thead>
            <tbody>
              {VIDEOS.map((v) => (
                <Tr key={v.id}>
                  <Td><span className="font-medium text-white">{v.title}</span></Td>
                  <Td className="text-ink-300">{v.creator}</Td>
                  <Td><BillingBoard billing={v.billing} /></Td>
                  <Td numeric>{v.views.toLocaleString()}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="quiet"
                        onClick={() => toast({ title: `${v.title} — moderation action recorded` })}>
                        Act
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </BackOfHouse>
  )
}

/* ================================================================= plans */

export function AdminPlans() {
  const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <BackOfHouse
      title="Subscription plans"
      actions={<Button size="sm" variant="primary" icon={<Plus className="size-4" />}>New plan</Button>}
    >
      <div className="flex items-start gap-2.5 rounded-sm border border-warning-500/35 bg-warning-500/8 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-400" />
        <p className="text-[13.5px] leading-relaxed text-ink-200">
          Plan names, prices, durations and entitlements are not yet decided. The fields are here;
          the values are placeholders.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850">
        <Table labels={["Plan", "Price", "Period", "Entitlements", ""]}>
          <thead>
            <tr><Th>Plan</Th><Th numeric>Price</Th><Th>Period</Th><Th>Entitlements</Th><Th /></tr>
          </thead>
          <tbody>
            {PLANS.map((p) => (
              <Tr key={p.id}>
                <Td><span className="font-marquee font-bold text-white">{p.name}</span></Td>
                <Td numeric><Placeholder>{UNDECIDED}</Placeholder></Td>
                <Td><Placeholder>{UNDECIDED}</Placeholder></Td>
                <Td className="text-ink-300">{p.entitlements.length} listed</Td>
                <Td>
                  <div className="flex justify-end">
                    <Button size="sm" variant="quiet" onClick={() => setEditing(p.id)}>Edit</Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${PLANS.find((p) => p.id === editing)?.name ?? ''}`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setEditing(null); toast({ title: 'Plan saved', tone: 'ok' }) }}>
              Save plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Plan name" required>
            <Input defaultValue={PLANS.find((p) => p.id === editing)?.name} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price" hint="Not yet decided"><Input placeholder="—" /></Field>
            <Field label="Billing period" hint="Not yet decided">
              <Select defaultValue=""><option value="">Choose</option><option>Monthly</option><option>Yearly</option></Select>
            </Field>
          </div>
          <Field label="Entitlements">
            <Textarea defaultValue={PLANS.find((p) => p.id === editing)?.entitlements.join('\n')} />
          </Field>
        </div>
      </Modal>
    </BackOfHouse>
  )
}

/* =============================================================== refunds */

export function AdminRefunds() {
  const toast = useToast()
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <BackOfHouse title="Refunds">
      <div className="flex items-start gap-2.5 rounded-sm border border-ink-700 bg-ink-850 px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" />
        <p className="text-[13.5px] leading-relaxed text-ink-200">
          Only refunds that have already been approved can be processed here. Who approves them, and
          by what workflow, is an open decision in the project documentation.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850">
        <Table labels={["Transaction", "Date", "Pass", "Amount", "Status", ""]}>
          <thead>
            <tr>
              <Th>Transaction</Th><Th>Date</Th><Th>Pass</Th><Th numeric>Amount</Th>
              <Th>Status</Th><Th />
            </tr>
          </thead>
          <tbody>
            {PAYMENTS.map((p) => (
              <Tr key={p.id}>
                <Td><span className="font-mono tabular-nums text-ink-100">{p.id}</span></Td>
                <Td><span className="font-mono tabular-nums text-ink-300">{p.date}</span></Td>
                <Td>{p.plan}</Td>
                <Td numeric><Placeholder>{UNDECIDED}</Placeholder></Td>
                <Td>
                  <Letterboard tone={p.status === 'Refunded' ? 'soon' : p.status === 'Failed' ? 'bad' : 'ok'}>
                    {p.status.toUpperCase()}
                  </Letterboard>
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="quiet"
                      disabled={p.status !== 'Settled'}
                      onClick={() => setConfirming(p.id)}
                    >
                      Process refund
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={`Process refund for ${confirming}?`}
        width="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setConfirming(null); toast({ title: 'Refund sent to the gateway', tone: 'ok' }) }}>
              Confirm refund
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-200">
          The refund is sent to the payment gateway and recorded against the subscription. If the
          gateway rejects it, nothing is marked as completed and you can try again.
        </p>
        <Checkbox checked onChange={() => {}} label="This refund has already been approved" />
      </Modal>
    </BackOfHouse>
  )
}

/* ========================================================= announcements */

export function AdminAnnouncements() {
  const toast = useToast()
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [err, setErr] = useState('')

  const publish = () => {
    if (!title.trim() || !body.trim()) return setErr('Both a title and a message are required before publishing.')
    setErr('')
    setComposing(false)
    setTitle(''); setBody('')
    toast({ title: 'Announcement published', tone: 'ok' })
  }

  return (
    <BackOfHouse
      title="Announcements"
      actions={
        <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setComposing(true)}>
          New announcement
        </Button>
      }
    >
      <ul className="space-y-3">
        {ANNOUNCEMENTS.map((a) => (
          <li key={a.id} className="rounded-lg border border-ink-700 bg-ink-850 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Letterboard tone={a.status === 'Published' ? 'ok' : a.status === 'Scheduled' ? 'soon' : 'neutral'}>
                    {a.status.toUpperCase()}
                  </Letterboard>
                  <Letterboard>{a.audience}</Letterboard>
                </div>
                <h3 className="font-marquee mt-2 text-[17px] font-bold text-white">{a.title}</h3>
                <p className="mt-1 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-300">{a.body}</p>
                {a.published && (
                  <p className="mt-1.5 font-mono text-[11px] text-ink-300">Published {a.published}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="quiet">Edit</Button>
                <Button size="sm" variant="quiet" onClick={() => toast({ title: 'Announcement withdrawn', tone: 'bad' })}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title="New announcement"
        description="Viewers see this clearly marked as coming from Skopia."
        footer={
          <>
            <Button variant="quiet" onClick={() => setComposing(false)}>Cancel</Button>
            <Button onClick={() => { setComposing(false); toast({ title: 'Saved as a draft' }) }}>Save draft</Button>
            <Button variant="primary" onClick={publish}>Publish</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required error={err && !title.trim() ? err : undefined}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance" />
          </Field>
          <Field label="Message" required error={err && title.trim() && !body.trim() ? err : undefined}>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="What is happening, when, and what it means for viewers." />
          </Field>
          <Field label="Audience">
            <Select defaultValue="Everyone">
              <option>Everyone</option><option>Subscribers</option><option>Creators</option>
            </Select>
          </Field>
          <p className="text-[12.5px] text-ink-300">
            Targeting, scheduling and expiry rules are not fully defined yet.
          </p>

          <div className="rounded-sm border border-ink-700 bg-ink-950 p-4">
            <p className="letterboard mb-2 text-ink-300">Preview</p>
            <div className="flex items-start gap-2.5 rounded-sm border border-cyan-400/30 bg-cyan-400/6 px-3.5 py-3">
              <Megaphone className="mt-0.5 size-4 shrink-0 text-cyan-400" />
              <div>
                <p className="text-[13px] font-medium text-white">
                  {title || 'Announcement title'}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-300">
                  {body || 'Your message appears here.'}
                </p>
                <p className="mt-1 font-mono text-[10px] text-cyan-300">FROM SKOPIA</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </BackOfHouse>
  )
}

/* ================================================================== logs */

export function AdminLogs() {
  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState('All')
  const toast = useToast()

  const list = LOGS.filter((l) => {
    if (outcome !== 'All' && l.outcome !== outcome.toLowerCase()) return false
    if (q.trim() && !`${l.actor} ${l.action} ${l.target}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <BackOfHouse
      title="Activity log"
      actions={
        <Button size="sm" icon={<Download className="size-4" />} onClick={() => toast({ title: 'Log export would download here' })}>
          Export
        </Button>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, action or target" className="flex-1" />
        <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Outcome" className="sm:w-44">
          <option>All</option><option>Ok</option><option>Rejected</option>
        </Select>
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">{list.length} entries</p>

      {list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<ScrollText className="size-7" />} title="No entries matched"
            body="Nothing in the log matches those filters."
            action={<Button onClick={() => { setQ(''); setOutcome('All') }}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Timestamp", "Actor", "Action", "Target", "Outcome"]}>
            <thead>
              <tr><Th>Timestamp</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Outcome</Th></tr>
            </thead>
            <tbody>
              {list.map((l, i) => (
                <Tr key={i}>
                  <Td><span className="font-mono tabular-nums text-ink-300">{l.at}</span></Td>
                  <Td><span className="font-mono text-cyan-300">{l.actor}</span></Td>
                  <Td><span className="font-mono text-ink-100">{l.action}</span></Td>
                  <Td><span className="font-mono text-ink-300">{l.target}</span></Td>
                  <Td>
                    <Letterboard tone={l.outcome === 'ok' ? 'ok' : 'bad'}>
                      {l.outcome.toUpperCase()}
                    </Letterboard>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-ink-300">
        Log retention and alert thresholds are an open decision in the project documentation.
      </p>
    </BackOfHouse>
  )
}

/* ============================================================== settings */

export function AdminSettings() {
  const toast = useToast()
  const [s, setS] = useState({
    registration: true, comments: true, uploads: true, ads: true, premium: true, maintenance: false,
  })

  return (
    <BackOfHouse
      title="Platform settings"
      actions={<Button size="sm" variant="primary" onClick={() => toast({ title: 'Settings saved and logged', tone: 'ok' })}>Save settings</Button>}
    >
      <div className="max-w-2xl">
        <Section title="Access">
          <div className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850 px-5">
            <Toggle label="Open registration" description="Anyone can create a viewer account." checked={s.registration} onChange={(v) => setS({ ...s, registration: v })} />
            <Toggle label="Creator uploads" description="Creators can publish new videos." checked={s.uploads} onChange={(v) => setS({ ...s, uploads: v })} />
            <Toggle label="Comments" description="Viewers can comment on videos platform-wide." checked={s.comments} onChange={(v) => setS({ ...s, comments: v })} />
          </div>
        </Section>

        <div className="mt-8">
          <Section title="Commercial">
            <div className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850 px-5">
              <Toggle label="Advertising" description="Campaigns are delivered against their targets." checked={s.ads} onChange={(v) => setS({ ...s, ads: v })} />
              <Toggle label="Premium content" description="Premium titles require an active pass." checked={s.premium} onChange={(v) => setS({ ...s, premium: v })} />
            </div>
          </Section>
        </div>

        <div className="mt-8">
          <Section title="Operations">
            <div className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850 px-5">
              <Toggle label="Maintenance mode" description="Viewers see a maintenance notice instead of the programme." checked={s.maintenance} onChange={(v) => setS({ ...s, maintenance: v })} />
            </div>
            <div className="mt-4 space-y-4 rounded-lg border border-ink-700 bg-ink-850 p-5">
              <Field label="Payment gateway" hint="Provider not yet selected">
                <Select defaultValue=""><option value="">Not configured</option></Select>
              </Field>
              <Field label="Accepted video formats" hint="Not yet defined">
                <Input placeholder="—" />
              </Field>
              <Field label="Maximum upload size" hint="Not yet defined">
                <Input placeholder="—" />
              </Field>
              <Field label="Log retention" hint="Not yet defined">
                <Input placeholder="—" />
              </Field>
            </div>
          </Section>
        </div>
      </div>
    </BackOfHouse>
  )
}
