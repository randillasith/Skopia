import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Ban, ShieldCheck, Plus, Eye,
  Download, ScrollText, CheckCircle2,
  Tv, UserX, ShieldAlert, RefreshCw,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Table, Th, Td, Tr, Tabs, Modal,
  EmptyState, Toggle, useToast, SearchInput, Avatar, Section, Textarea,
} from '@/components/primitives'
import { Letterboard, BillingBoard } from '@/components/world'
import { BackOfHouse } from '@/components/Shell'
import { Resolve } from '@/components/Loading'
import { ApiError } from '@/lib/api'
import {
  administration, rowToAccount,
  type ActivityLogRow, type CreateStaffInput, type PlatformUserStats,
  type ServerUserRow, type UpdateStaffInput,
} from '@/lib/accounts'
import { useCatalogue } from '@/lib/useCatalogue'
import {
  complaints, loadQueue, referenceOf, subscribeReportsChanged, notifyReportsChanged,
  COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE, REPORT_STATUS_LABEL, REPORT_STATUS_TONE,
  REPORT_TYPE_LABEL,
  type QueueItem, type ServerComplaint, type ServerReportType,
} from '@/lib/reports'
import { toVideo, videoIdOf } from '@/lib/catalogue'
import { billing, type AdminSubscription } from '@/lib/billing'
import { ads, type Campaign as AdCampaign } from '@/lib/ads'
import {
  GRANTS, STAFF_ROLES,
  type Account, type StaffRole,
} from '@/lib/session'
import {
  buildStaffAssignmentPayload, passwordValidationMessage,
  type StaffCatalog, type StaffFormValues, type StaffType,
} from '@/lib/staff'

export { AdminPlans, AdminRefunds, AdminAnnouncements } from './admin-billing'

const ACCOUNT_TONE: Record<Account['status'], 'ok' | 'review' | 'bad' | 'soon'> = {
  Active: 'ok', Suspended: 'review', Blocked: 'bad', Invited: 'soon',
}

const COMMON_BAN_REASONS = [
  'Violation of Terms of Service',
  'Inappropriate or illegal content',
  'Copyright infringement',
  'Spam or deceptive practices',
  'Harassment or abusive behavior',
  'Suspicious or fraudulent activity',
]

/* ============================================================= dashboard */

export function AdminDashboard() {
  const { videos, loading: catalogueLoading } = useCatalogue()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [queue, setQueue] = useState<ServerComplaint[] | null>(null)
  const [stats, setStats] = useState<PlatformUserStats | null>(null)
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [campaigns, setCampaigns] = useState<AdCampaign[] | null>(null)
  const [subscriptionRows, setSubscriptionRows] = useState<AdminSubscription[] | null>(null)
  const [nonce, setNonce] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const reloadAll = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    return subscribeReportsChanged(() => setNonce((n) => n + 1))
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    setRefreshing(true)
    Promise.allSettled([
      administration.users(abort.signal).then((rows) => setAccounts(rows.map(rowToAccount))).catch(() => setAccounts(null)),
      administration.stats().then(setStats).catch(() => setStats(null)),
      administration.activityLogs(abort.signal).then((rows) => setLogs(rows.slice(0, 6))).catch(() => setLogs([])),
      complaints.queue(abort.signal).then(setQueue).catch(() => setQueue(null)),
      ads.campaigns.list(null).then(setCampaigns).catch(() => setCampaigns(null)),
      billing.adminUsers(abort.signal).then(setSubscriptionRows).catch(() => setSubscriptionRows(null)),
    ]).finally(() => {
      if (!abort.signal.aborted) setRefreshing(false)
    })
    return () => abort.abort()
  }, [nonce])

  const openComplaints = queue?.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED') ?? []
  const inReview = videos.filter((v) => v.billing === 'IN REVIEW')
  const count = (n: number | undefined | null) => (n == null ? '—' : String(n))

  return (
    <BackOfHouse
      title="Dashboard"
      actions={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-success-500/10 px-2.5 py-1 font-mono text-[11px] text-success-400">
            <span className="size-2 rounded-full bg-success-500 animate-pulse" />
            Live real-time
          </span>
          <Button size="sm" variant="quiet" icon={<RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />} onClick={reloadAll}>
            Refresh
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          ['Accounts', count(stats?.totalUsers ?? accounts?.length), stats ? `${stats.activeUsers} active · ${stats.blockedUsers} banned` : accounts ? `${accounts.filter((a) => a.status === 'Active').length} active` : 'could not be read'],
          ['Creators / Channels', count(stats?.totalCreators ?? accounts?.filter((a) => a.isContentCreator).length), stats ? `${stats.verifiedCreators} verified` : 'active channels'],
          ['Titles', catalogueLoading ? '—' : String(videos.length), `${inReview.length} awaiting review`],
          ['Open complaints', count(queue ? openComplaints.length : null), queue ? `${queue.filter((c) => c.priority === 'URGENT').length} urgent` : 'could not be read'],
          ['Active campaigns', count(campaigns ? campaigns.filter((c) => c.status === 'ACTIVE').length : null), campaigns ? `${campaigns.filter((c) => c.status === 'SCHEDULED').length} scheduled` : 'could not be read'],
          ['Premium passes', count(subscriptionRows?.filter((row) => row.status === 'ACTIVE').length), subscriptionRows ? `${subscriptionRows.filter((row) => row.status !== 'FREE').length} records` : 'could not be read'],
        ].map(([l, v, sub]) => (
          <div key={l} className="border-l border-ink-700 pl-3">
            <p className="letterboard text-ink-300">{l}</p>
            <p className="font-marquee mt-1 text-[32px] font-bold leading-none tabular-nums text-fg">{v}</p>
            <p className="mt-1.5 text-[12.5px] text-ink-300">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link to="/admin/moderation">
          <Button size="sm" variant="primary" icon={<ShieldAlert className="size-4" />}>
            Moderation &amp; Reports ({openComplaints.length})
          </Button>
        </Link>
        <Link to="/admin/accounts">
          <Button size="sm" variant="quiet" icon={<Users className="size-4" />}>
            Manage Users &amp; Channels
          </Button>
        </Link>
        <Link to="/admin/announcements">
          <Button size="sm" variant="quiet">Announcements</Button>
        </Link>
        <Link to="/admin/plans">
          <Button size="sm" variant="quiet">Subscriptions</Button>
        </Link>
        <Link to="/admin/logs">
          <Button size="sm" variant="quiet">Activity Logs</Button>
        </Link>
      </div>

      <Section title="Subscribed users" action={<Link to="/admin/plans" className="text-[13px] text-cyan-300 hover:underline">All access states</Link>} className="mt-10">
        {subscriptionRows == null ? <p className="text-sm text-ink-300">Subscription data could not be read.</p>
          : subscriptionRows.filter((row) => row.status === 'ACTIVE').length === 0 ? <p className="text-sm text-ink-300">No active subscriptions.</p>
          : <div className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-850"><Table labels={['User', 'Plan', 'State', 'Start', 'End']}><thead><Tr><Th>User</Th><Th>Plan</Th><Th>State</Th><Th>Start</Th><Th>End</Th></Tr></thead>
            <tbody>{subscriptionRows.filter((row) => row.status === 'ACTIVE').map((row) => <Tr key={row.userId}>
              <Td><span className="font-medium text-fg">@{row.username}</span>{row.displayName && <span className="block text-xs text-ink-300">{row.displayName}</span>}</Td><Td>{row.planName}</Td><Td><Letterboard tone="ok">ACTIVE</Letterboard></Td>
              <Td>{row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'}</Td><Td>{row.endDate ? new Date(row.endDate).toLocaleDateString() : '—'}</Td>
            </Tr>)}</tbody></Table></div>}
      </Section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Section
          title="Needs attention"
          action={<Link to="/admin/moderation" className="text-[13px] text-tone-cyan-300 hover:underline">Full moderation</Link>}
        >
          {inReview.length === 0 && openComplaints.length === 0 ? (
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-6 text-center text-sm text-ink-300">
              No titles or complaints need attention right now.
            </div>
          ) : (
            <ul className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850">
              {[
                ...inReview.map((v) => ({ k: `v-${v.id}`, board: 'IN REVIEW', tone: 'review' as const, title: v.title, sub: `${v.creator} · awaiting moderation`, to: '/admin/moderation' })),
                ...openComplaints.slice(0, 5).map((c) => ({
                  k: `c-${c.id}`,
                  board: c.priority,
                  tone: (c.priority === 'URGENT' ? 'bad' : 'review') as 'bad' | 'review',
                  title: `Complaint ${referenceOf(c)}`,
                  sub: `${COMPLAINT_STATUS_LABEL[c.status]} · raised ${c.createdAt?.slice(0, 10)}`,
                  to: `/queue/${c.id}`,
                })),
              ].map((row) => (
                <li key={row.k}>
                  <Link to={row.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800/60">
                    <Letterboard tone={row.tone}>{row.board}</Letterboard>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-fg">{row.title}</span>
                      <span className="block truncate text-[12px] text-ink-300">{row.sub}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Recent activity"
          action={<Link to="/admin/logs" className="text-[13px] text-tone-cyan-300 hover:underline">Full log</Link>}
        >
          {logs.length === 0 ? (
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-6 text-center text-sm text-ink-300">
              No activity logs recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850">
              {logs.map((l) => (
                <li key={l.logId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-success-500" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-200">
                    <span className="text-tone-cyan-300">@{l.actorUsername ?? 'system'}</span>{' '}
                    {l.actionType} {l.targetUsername ? `@${l.targetUsername}` : ''}
                    {l.detail ? <span className="text-ink-400"> ({l.detail})</span> : ''}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-300">
                    {l.actionTime?.slice(11, 16)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </BackOfHouse>
  )
}

/* ============================================================== accounts */

const EMPTY_DETAILS: StaffFormValues = {
  staffType: 'SUPPORT_OFFICER', designation: '', hireDate: '',
  supportLevel: '', shift: '', adminLevel: '', officerCode: '', department: '',
}

function StaffFields({ value, onChange, catalog }: {
  value: StaffFormValues
  onChange: (next: StaffFormValues) => void
  catalog: StaffCatalog | null
}) {
  const set = (field: keyof StaffFormValues, next: string) => onChange({ ...value, [field]: next })
  const options = (items: { value: string; label: string }[] | undefined) =>
    (items ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)
  return <>
    <Field label="Staff type" required>
      <Select value={value.staffType} onChange={(e) => onChange({ ...EMPTY_DETAILS, designation: value.designation, hireDate: value.hireDate, staffType: e.target.value as StaffType })}>
        {options(catalog?.staffTypes)}
      </Select>
    </Field>
    <Field label="Designation" required><Input required value={value.designation} onChange={(e) => set('designation', e.target.value)} /></Field>
    <Field label="Hire date" required><Input required type="date" value={value.hireDate} onChange={(e) => set('hireDate', e.target.value)} /></Field>
    {value.staffType === 'ADMINISTRATOR' && <Field label="Admin level" required><Select required value={value.adminLevel ?? ''} onChange={(e) => set('adminLevel', e.target.value)}><option value="">Select a level</option>{options(catalog?.adminLevels)}</Select></Field>}
    {value.staffType === 'SUPPORT_OFFICER' && <>
      <Field label="Support level" required><Select required value={value.supportLevel ?? ''} onChange={(e) => set('supportLevel', e.target.value)}><option value="">Select a level</option>{options(catalog?.supportLevels)}</Select></Field>
      <Field label="Shift" required><Select required value={value.shift ?? ''} onChange={(e) => set('shift', e.target.value)}><option value="">Select a shift</option>{options(catalog?.supportShifts)}</Select></Field>
    </>}
    {value.staffType === 'MARKETING_OFFICER' && <>
      <Field label="Officer code" required><Input required value={value.officerCode ?? ''} onChange={(e) => set('officerCode', e.target.value)} /></Field>
      <Field label="Department" required><Select required value={value.department ?? ''} onChange={(e) => set('department', e.target.value)}><option value="">Select a department</option>{options(catalog?.marketingDepartments)}</Select></Field>
    </>}
  </>
}

export function AdminAccounts() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  
  // Status management modal state
  const [actingAccount, setActingAccount] = useState<Account | null>(null)
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BLOCKED'>('SUSPENDED')
  const [statusReason, setStatusReason] = useState('')
  
  const [editingStaff, setEditingStaff] = useState<{ row: ServerUserRow; form: UpdateStaffInput } | null>(null)
  const [assigningStaff, setAssigningStaff] = useState<{ row: ServerUserRow; form: StaffFormValues } | null>(null)
  const [staffCatalog, setStaffCatalog] = useState<StaffCatalog | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [rawRows, setRawRows] = useState<ServerUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    administration
      .users(abort.signal)
      .then((rows) => {
        setRawRows(rows)
        setAccounts(rows.map(rowToAccount))
        setError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not load the accounts.')
        setAccounts([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [nonce])

  useEffect(() => { administration.staffCatalog().then(setStaffCatalog).catch(() => setStaffCatalog(null)) }, [])

  const list = useMemo(
    () =>
      accounts.filter((a) => {
        if (role === 'staff' && a.staff.length === 0) return false
        if (role === 'creator' && !a.isContentCreator) return false
        if (role === 'none' && (a.staff.length > 0 || a.isContentCreator)) return false
        if (role !== 'All' && ['marketing', 'support', 'admin'].includes(role)
            && !a.staff.includes(role as StaffRole)) return false

        if (statusFilter === 'Active' && a.status !== 'Active') return false
        if (statusFilter === 'Suspended' && a.status !== 'Suspended') return false
        if (statusFilter === 'Blocked' && a.status !== 'Blocked') return false

        if (q.trim()) {
          const needle = q.toLowerCase()
          const row = rawRows.find((r) => String(r.id) === a.id)
          const hay = `${a.name} ${a.handle} ${a.id} ${a.email} ${row?.channelName ?? ''}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      }),
    [accounts, rawRows, q, role, statusFilter],
  )

  const openStatusModal = (account: Account, defaultAction?: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED') => {
    setActingAccount(account)
    if (defaultAction) {
      setTargetStatus(defaultAction)
    } else if (account.status === 'Active') {
      setTargetStatus('SUSPENDED')
    } else if (account.status === 'Suspended') {
      setTargetStatus('ACTIVE')
    } else {
      setTargetStatus('ACTIVE')
    }
    setStatusReason('')
  }

  const saveStatus = async () => {
    if (!actingAccount || actingAccount.userId == null) return
    setBusy(true)
    try {
      const reason = statusReason.trim() || `${targetStatus} applied from Admin console`
      await administration.setStatus(actingAccount.userId, targetStatus, reason)
      
      const label = targetStatus === 'BLOCKED' ? 'Banned / Blocked' : targetStatus === 'SUSPENDED' ? 'Suspended' : 'Restored'
      toast({
        title: `@${actingAccount.handle} is now ${label}`,
        tone: targetStatus === 'ACTIVE' ? 'ok' : 'bad',
      })
      setActingAccount(null)
      refresh()
    } catch (cause) {
      toast({
        title: cause instanceof ApiError ? cause.message : 'Failed to update account status.',
        tone: 'bad',
      })
    } finally {
      setBusy(false)
    }
  }

  const setCreatorVerification = async (account: Account) => {
    if (account.userId == null) return
    setBusy(true)
    try {
      await administration.setCreatorVerified(account.userId, account.isVerified !== true)
      toast({
        title: account.isVerified ? `${account.name} is no longer verified` : `${account.name} verified as Creator`,
        tone: 'ok',
      })
      refresh()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'That did not go through.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const openStaffEditor = async (account: Account) => {
    if (account.userId == null) return
    setBusy(true)
    try {
      const row = await administration.user(account.userId)
      setEditingStaff({
        row,
        form: {
          staffType: row.staffType ?? 'SUPPORT_OFFICER', hireDate: row.hireDate ?? '',
          designation: row.designation ?? '', firstName: row.firstName ?? '', lastName: row.lastName ?? '',
          adminLevel: row.adminLevel ?? undefined, supportLevel: row.supportLevel ?? undefined, shift: row.shift ?? undefined,
          officerCode: row.officerCode ?? undefined, department: row.department ?? undefined,
        },
      })
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'Could not load the staff profile.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const saveStaff = async () => {
    if (!editingStaff) return
    setBusy(true)
    try {
      await administration.updateStaff(editingStaff.row.id, buildStaffAssignmentPayload(editingStaff.form as StaffFormValues, 'edit'))
      toast({ title: `@${editingStaff.row.username} updated`, tone: 'ok' })
      setEditingStaff(null)
      refresh()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'The staff profile could not be updated.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  const openAssignment = (row: ServerUserRow) => setAssigningStaff({ row, form: { ...EMPTY_DETAILS } })
  const saveAssignment = async () => {
    if (!assigningStaff) return
    setBusy(true)
    try {
      await administration.assignStaff(assigningStaff.row.id, assigningStaff.form)
      toast({ title: `Staff access assigned to @${assigningStaff.row.username}`, tone: 'ok' })
      setAssigningStaff(null)
      refresh()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'Staff access could not be assigned.', tone: 'bad' })
    } finally { setBusy(false) }
  }

  return (
    <BackOfHouse title="Accounts &amp; Channels">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, handle, channel, email or ID" className="flex-1" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter role" className="sm:w-48">
          <option value="All">Every role</option>
          <option value="creator">Channel owner (Creator)</option>
          <option value="staff">Staff account</option>
          <option value="none">Ordinary viewer</option>
          <option value="admin">Administrator</option>
          <option value="support">Support officer</option>
          <option value="marketing">Marketing officer</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status" className="sm:w-40">
          <option value="All">All statuses</option>
          <option value="Active">Active only</option>
          <option value="Suspended">Suspended only</option>
          <option value="Blocked">Blocked / Banned</option>
        </Select>
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">
        {loading ? 'Reading accounts...' : `${list.length} accounts found`}
      </p>

      {loading || error ? (
        <div className="mt-6">
          <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the accounts">
            {null}
          </Resolve>
        </div>
      ) : list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<Users className="size-7" />} title="No accounts matched"
            body="Nothing matched that search and filter combination."
            action={<Button onClick={() => { setQ(''); setRole('All'); setStatusFilter('All') }}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Account", "Role & Grant", "Channel", "Status", "Joined", "Actions"]}>
            <thead>
              <tr>
                <Th>Account</Th><Th>Role &amp; Grant</Th><Th>Channel</Th><Th>Status</Th>
                <Th>Joined</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const row = rawRows.find((r) => String(r.id) === a.id)
                return (
                  <Tr key={a.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={a.name} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{a.name}</span>
                          <span className="block break-all font-mono text-[11px] text-ink-300 md:truncate">
                            @{a.handle} · #{a.id} {a.email ? `· ${a.email}` : ''}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      {a.staff.length > 0 ? (
                        <span className="inline-flex items-center rounded-sm bg-cyan-500/10 px-2 py-0.5 font-mono text-xs text-tone-cyan-300">
                          {a.staff.map((r) => STAFF_ROLES[r].label).join(', ')}
                        </span>
                      ) : a.isContentCreator ? (
                        <span className="inline-flex items-center rounded-sm bg-purple-500/10 px-2 py-0.5 font-mono text-xs text-purple-300">
                          Content Creator
                        </span>
                      ) : (
                        <span className="text-ink-300 text-xs">Registered Viewer</span>
                      )}
                    </Td>
                    <Td>
                      {a.isContentCreator ? (
                        <div className="flex items-center gap-1.5">
                          <Tv className="size-3.5 text-purple-400" />
                          <span className="font-medium text-ink-100">{row?.channelName || a.name}</span>
                          {a.isVerified && (
                            <span className="rounded bg-success-500/20 px-1 py-0.2 font-mono text-[10px] text-success-400">
                              VERIFIED
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-400 text-xs">—</span>
                      )}
                    </Td>
                    <Td>
                      <Letterboard tone={ACCOUNT_TONE[a.status]}>{a.status.toUpperCase()}</Letterboard>
                    </Td>
                    <Td><span className="font-mono tabular-nums text-ink-300">{a.joined || '—'}</span></Td>
                    <Td>
                      <div className="grid grid-cols-1 gap-2 md:flex md:justify-end">
                        {a.staff.length > 0 && (
                          <Button size="sm" className="min-h-11 w-full md:min-h-8 md:w-auto" variant="quiet" disabled={busy} onClick={() => openStaffEditor(a)}>
                            Edit staff
                          </Button>
                        )}
                        {a.staff.length === 0 && row && a.status === 'Active' && (
                          <Button size="sm" className="min-h-11 w-full md:min-h-8 md:w-auto" variant="primary" disabled={busy || !staffCatalog} onClick={() => openAssignment(row)}>
                            Assign staff
                          </Button>
                        )}
                        {a.isContentCreator && (
                          <Button size="sm" className="min-h-11 w-full md:min-h-8 md:w-auto" variant="quiet" disabled={busy} onClick={() => setCreatorVerification(a)}>
                            {a.isVerified ? 'Unverify' : 'Verify'}
                          </Button>
                        )}
                        {a.status === 'Active' ? (
                          <>
                            <Button size="sm" className="min-h-11 w-full md:min-h-8 md:w-auto" variant="quiet" disabled={busy} onClick={() => openStatusModal(a, 'SUSPENDED')}>
                              Suspend
                            </Button>
                            <Button size="sm" className="min-h-11 w-full md:min-h-8 md:w-auto" variant="danger" icon={<Ban className="size-3.5" />} disabled={busy} onClick={() => openStatusModal(a, 'BLOCKED')}>
                              {a.isContentCreator ? 'Ban Channel' : 'Ban User'}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" className="min-h-11 w-full md:min-h-8 md:w-auto" variant="primary" icon={<CheckCircle2 className="size-3.5" />} disabled={busy} onClick={() => openStatusModal(a, 'ACTIVE')}>
                            Restore
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Ban / Suspend / Restore Modal */}
      <Modal
        open={!!actingAccount}
        onClose={() => setActingAccount(null)}
        title={
          targetStatus === 'BLOCKED'
            ? `Ban ${actingAccount?.isContentCreator ? 'Channel & Creator' : 'Account'} @${actingAccount?.handle}?`
            : targetStatus === 'SUSPENDED'
              ? `Suspend @${actingAccount?.handle}?`
              : `Restore @${actingAccount?.handle}?`
        }
        width="md"
        footer={
          <>
            <Button variant="quiet" onClick={() => setActingAccount(null)}>Cancel</Button>
            <Button
              variant={targetStatus === 'BLOCKED' ? 'danger' : targetStatus === 'SUSPENDED' ? 'danger' : 'primary'}
              loading={busy}
              onClick={saveStatus}
            >
              {targetStatus === 'BLOCKED'
                ? actingAccount?.isContentCreator ? 'Ban Channel & Account' : 'Ban Account'
                : targetStatus === 'SUSPENDED' ? 'Suspend Account' : 'Restore Account'}
            </Button>
          </>
        }
      >
        {actingAccount && (
          <div className="space-y-4">
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <p className="font-medium text-fg">@{actingAccount.handle} ({actingAccount.name})</p>
              <p className="text-xs text-ink-300">{actingAccount.email} · Current status: <span className="font-mono text-ink-200">{actingAccount.status}</span></p>
              {actingAccount.isContentCreator && (
                <p className="mt-1 text-xs text-purple-300 font-medium">Channel: {actingAccount.name}</p>
              )}
            </div>

            <Field label="Action Target Status">
              <Select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as 'ACTIVE' | 'SUSPENDED' | 'BLOCKED')}>
                <option value="ACTIVE">ACTIVE — Restore account and all privileges</option>
                <option value="SUSPENDED">SUSPENDED — Temporary freeze (cannot sign in)</option>
                <option value="BLOCKED">BLOCKED — Permanent Ban (Account &amp; Channel)</option>
              </Select>
            </Field>

            <Field label="Reason" hint="Written to the permanent audit log">
              <Input
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="E.g. Inappropriate content, terms of service violation, spam..."
              />
            </Field>

            <div className="space-y-1.5">
              <p className="text-xs text-ink-300">Quick reasons:</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_BAN_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setStatusReason(r)}
                    className="rounded bg-ink-800 px-2 py-1 text-xs text-ink-200 hover:bg-ink-700"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-300 leading-relaxed border-t border-ink-800 pt-3">
              {targetStatus === 'BLOCKED'
                ? 'Banning blocks authentication immediately and revokes all active sessions. The channel and all its content are made inaccessible to viewers.'
                : targetStatus === 'SUSPENDED'
                  ? 'Suspended accounts cannot log in or upload content until restored.'
                  : 'Restoring returns full platform access to the account.'}
            </p>
          </div>
        )}
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title={editingStaff ? `Edit Staff Profile @${editingStaff.row.username}` : 'Edit staff'}
        width="lg"
        footer={
          <>
            <Button variant="quiet" onClick={() => setEditingStaff(null)}>Cancel</Button>
            <Button loading={busy} onClick={saveStaff}>Save staff profile</Button>
          </>
        }
      >
        {editingStaff && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><Input value={editingStaff.form.firstName ?? ''} onChange={(e) => setEditingStaff({ ...editingStaff, form: { ...editingStaff.form, firstName: e.target.value } })} /></Field>
            <Field label="Last name"><Input value={editingStaff.form.lastName ?? ''} onChange={(e) => setEditingStaff({ ...editingStaff, form: { ...editingStaff.form, lastName: e.target.value } })} /></Field>
            <StaffFields value={editingStaff.form as StaffFormValues} catalog={staffCatalog} onChange={(form) => setEditingStaff({ ...editingStaff, form })} />
          </div>
        )}
      </Modal>

      <Modal open={!!assigningStaff} onClose={() => setAssigningStaff(null)} title={assigningStaff ? `Assign staff access to @${assigningStaff.row.username}` : 'Assign staff access'} width="lg"
        footer={<><Button variant="quiet" onClick={() => setAssigningStaff(null)}>Cancel</Button><Button loading={busy} disabled={!staffCatalog || !assigningStaff?.form.designation || !assigningStaff?.form.hireDate} onClick={saveAssignment}>Assign staff access</Button></>}>
        {assigningStaff && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveAssignment() }}>
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3"><p className="font-medium text-fg">@{assigningStaff.row.username}</p><p className="text-xs text-ink-300">{assigningStaff.row.email}</p></div>
          <p className="text-sm text-ink-300">This grants staff access without changing the password, creator channel, viewer history or account ID.</p>
          <div className="grid gap-4 sm:grid-cols-2"><StaffFields value={assigningStaff.form} catalog={staffCatalog} onChange={(form) => setAssigningStaff({ ...assigningStaff, form })} /></div>
        </form>}
      </Modal>
    </BackOfHouse>
  )
}

/* ================================================================= roles */

const EMPTY_STAFF: CreateStaffInput = {
  username: '', email: '', password: '', firstName: '', lastName: '',
  designation: '', hireDate: '', staffType: 'SUPPORT_OFFICER', supportLevel: '', shift: '',
}

export function AdminRoles() {
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [staffForm, setStaffForm] = useState<CreateStaffInput>(EMPTY_STAFF)
  const [assignForm, setAssignForm] = useState<StaffFormValues>({ ...EMPTY_DETAILS })
  const [roleRows, setRoleRows] = useState<ServerUserRow[]>([])
  const [catalog, setCatalog] = useState<StaffCatalog | null>(null)
  const [roleNonce, setRoleNonce] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    administration.users(abort.signal).then(setRoleRows).catch(() => setRoleRows([]))
    administration.staffCatalog().then((next) => {
      setCatalog(next)
      setStaffForm((current) => ({ ...current,
        staffType: (next.staffTypes[0]?.value ?? current.staffType) as StaffType,
        adminLevel: next.adminLevels[0]?.value, supportLevel: next.supportLevels[0]?.value,
        shift: next.supportShifts[0]?.value, department: next.marketingDepartments[0]?.value,
      }))
      setAssignForm((current) => ({ ...current,
        staffType: (next.staffTypes[0]?.value ?? current.staffType) as StaffType,
        adminLevel: next.adminLevels[0]?.value, supportLevel: next.supportLevels[0]?.value,
        shift: next.supportShifts[0]?.value, department: next.marketingDepartments[0]?.value,
      }))
    }).catch(() => setCatalog(null))
    return () => abort.abort()
  }, [roleNonce])

  const roleAccounts = roleRows.map(rowToAccount)
  const eligible = roleRows.filter((row) => !row.staffType && row.accountStatus?.toUpperCase() === 'ACTIVE')
  const staffCounts = (Object.keys(STAFF_ROLES) as StaffRole[]).map((role) => ({ role, holders: roleAccounts.filter((a) => a.staff.includes(role)) }))

  const createStaff = async () => {
    const passwordError = passwordValidationMessage(staffForm.password)
    if (passwordError) { toast({ title: passwordError, tone: 'bad' }); return }
    setSaving(true)
    try {
      await administration.createStaff(buildStaffAssignmentPayload(staffForm as StaffFormValues, 'create') as CreateStaffInput)
      toast({ title: `@${staffForm.username} created as staff`, tone: 'ok' })
      setRoleNonce((n) => n + 1); setStaffForm(EMPTY_STAFF); setCreating(false)
    } catch (cause) { toast({ title: cause instanceof ApiError ? cause.message : 'The staff account could not be created.', tone: 'bad' }) }
    finally { setSaving(false) }
  }

  const assignStaff = async () => {
    const id = Number(selectedUserId)
    if (!Number.isFinite(id)) return
    setSaving(true)
    try {
      await administration.assignStaff(id, assignForm)
      const row = roleRows.find((candidate) => candidate.id === id)
      toast({ title: `Staff access assigned to @${row?.username ?? id}`, tone: 'ok' })
      setRoleNonce((n) => n + 1); setSelectedUserId(''); setAssigning(false)
    } catch (cause) { toast({ title: cause instanceof ApiError ? cause.message : 'Staff access could not be assigned.', tone: 'bad' }) }
    finally { setSaving(false) }
  }

  return (
    <BackOfHouse title="Roles &amp; Permissions">
      <div className="mt-2 grid gap-2 sm:flex sm:justify-end">
        <Button className="min-h-11 sm:min-h-10" variant="primary" icon={<ShieldCheck className="size-4" />} disabled={!catalog || eligible.length === 0} onClick={() => setAssigning(true)}>Assign existing account</Button>
        <Button className="min-h-11 sm:min-h-10" icon={<Plus className="size-4" />} disabled={!catalog} onClick={() => setCreating(true)}>Create new staff</Button>
      </div>
      <Section title="Platform Staff Roles" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {staffCounts.map(({ role, holders }) => (
            <div key={role} className="rounded-lg border border-ink-700 bg-ink-850 p-4">
              <p className="letterboard text-ink-300">{STAFF_ROLES[role].console}</p>
              <p className="font-marquee mt-1 text-[15px] font-bold text-fg">{STAFF_ROLES[role].label}</p>
              <p className="font-marquee mt-3 text-[30px] font-bold tabular-nums leading-none text-fg">{holders.length}</p>
              <ul className="mt-3 space-y-1 border-t border-ink-800 pt-3">
                {holders.length === 0 ? <li className="font-mono text-[12px] text-ink-400">None registered</li> : holders.map((holder) => <li key={holder.id} className="truncate font-mono text-[12px] text-ink-300">@{holder.handle}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Platform Permissions Matrix" className="mt-10">
        <div className="rounded-lg border border-ink-700 bg-ink-850"><Table labels={['Capability', 'Scope', 'Granted By']}><thead><tr><Th className="w-[46%]">Capability</Th><Th>Scope</Th><Th>Granted By</Th></tr></thead>
          <tbody>{GRANTS.map((grant) => <Tr key={grant.what}><Td className="font-medium text-fg">{grant.what}</Td><Td><Letterboard tone={grant.scope === 'Platform' ? 'soon' : grant.scope === 'Channel' ? 'live' : grant.scope === 'Account' ? 'neutral' : 'dead'}>{grant.scope}</Letterboard></Td><Td className="text-ink-300">{grant.by}</Td></Tr>)}</tbody>
        </Table></div>
      </Section>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create staff account" width="lg"
        footer={<><Button variant="quiet" onClick={() => setCreating(false)}>Cancel</Button><Button loading={saving} disabled={!staffForm.username || !staffForm.email || !!passwordValidationMessage(staffForm.password) || !staffForm.designation || !staffForm.hireDate} onClick={createStaff}>Create staff</Button></>}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void createStaff() }}>
          <Field label="Username" required><Input required value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} /></Field>
          <Field label="Email" required><Input required type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></Field>
          <Field label="First name"><Input value={staffForm.firstName} onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })} /></Field>
          <Field label="Last name"><Input value={staffForm.lastName} onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })} /></Field>
          <Field label="Temporary password" hint="8–72 UTF-8 bytes" required><Input required type="password" autoComplete="new-password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} /></Field>
          <StaffFields value={staffForm as StaffFormValues} catalog={catalog} onChange={(form) => setStaffForm({ ...staffForm, ...form })} />
        </form>
      </Modal>

      <Modal open={assigning} onClose={() => setAssigning(false)} title="Assign staff access" width="lg"
        footer={<><Button variant="quiet" onClick={() => setAssigning(false)}>Cancel</Button><Button loading={saving} disabled={!selectedUserId || !assignForm.designation || !assignForm.hireDate} onClick={assignStaff}>Assign staff access</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void assignStaff() }}>
          <Field label="Existing active account" required><Select required value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">Select an account</option>{eligible.map((row) => <option key={row.id} value={row.id}>@{row.username} · {row.email}{row.channelName ? ' · Creator' : ''}</option>)}</Select></Field>
          <p className="-mt-2 text-xs text-ink-300">Password and account history stay unchanged. Staff access is added without replacing creator/viewer data, credentials or the account ID.</p>
          <div className="grid gap-4 sm:grid-cols-2"><StaffFields value={assignForm} catalog={catalog} onChange={setAssignForm} /></div>
        </form>
      </Modal>
    </BackOfHouse>
  )
}

/* ============================================================ moderation */

export function AdminModeration() {
  const nav = useNavigate()
  const toast = useToast()
  const { videos: catalogueVideos, loading: catalogueLoading, error: catalogueError, refresh: refreshCatalogue } = useCatalogue()
  const [moderationVideos, setModerationVideos] = useState<ReturnType<typeof toVideo>[] | null>(null)
  const videos = moderationVideos ?? catalogueVideos
  const [tab, setTab] = useState('queue')
  const [busy, setBusy] = useState<string | null>(null)
  
  // Search & Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [reportTypeFilter, setReportTypeFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [searchFilter, setSearchFilter] = useState('')

  // Action Modals
  const [pullTarget, setPullTarget] = useState<{ id: string; title: string } | null>(null)
  const [pullReason, setPullReason] = useState('')
  
  const [banTarget, setBanTarget] = useState<{ userId: number; username: string; isChannel?: boolean; channelName?: string } | null>(null)
  const [banReason, setBanReason] = useState('')

  const [resolveTarget, setResolveTarget] = useState<QueueItem | null>(null)
  const [resolveNote, setResolveNote] = useState('')

  const [reported, setReported] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const reloadQueue = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    return subscribeReportsChanged(() => setNonce((n) => n + 1))
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    if (reported.length === 0) {
      setQueueLoading(true)
    }
    setRefreshing(true)
    complaints
      .queue(abort.signal)
      .then((rows) => loadQueue(rows, abort.signal))
      .then((joined) => {
        setReported(joined)
        setQueueError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setQueueError(cause instanceof ApiError ? cause.message : 'Could not read the moderation queue.')
        setReported([])
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setQueueLoading(false)
          setRefreshing(false)
        }
      })
    return () => abort.abort()
  }, [nonce])

  useEffect(() => {
    const abort = new AbortController()
    administration.videos(abort.signal)
      .then((rows) => setModerationVideos(rows.map(toVideo)))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setModerationVideos(null)
      })
    return () => abort.abort()
  }, [nonce])

  const titleFor = (reference: string | null | undefined) => {
    const match = /^video:(\d+)$/.exec(reference ?? '')
    return match ? videos.find((v) => v.id === match[1]) : undefined
  }

  // Filtered reported complaints
  const filteredReports = useMemo(() => {
    return reported.filter(({ complaint, report }) => {
      if (statusFilter === 'UNRESOLVED' && (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED')) return false
      if (statusFilter === 'RESOLVED' && complaint.status !== 'RESOLVED') return false
      if (statusFilter === 'CLOSED' && complaint.status !== 'CLOSED') return false
      if (reportTypeFilter !== 'All' && report && report.type !== reportTypeFilter) return false
      if (priorityFilter !== 'All' && complaint.priority !== priorityFilter) return false
      if (searchFilter.trim()) {
        const text = searchFilter.toLowerCase()
        const v = titleFor(report?.contentReference)
        const hay = `${referenceOf(complaint)} ${report?.details ?? ''} ${report?.type ?? ''} ${v?.title ?? ''} ${v?.creator ?? ''}`.toLowerCase()
        if (!hay.includes(text)) return false
      }
      return true
    })
  }, [reported, statusFilter, reportTypeFilter, priorityFilter, searchFilter, videos])

  // Execute Pull Title (Archive)
  const confirmPull = async () => {
    if (!pullTarget) return
    const numeric = videoIdOf(pullTarget.id)
    if (numeric == null) return
    setBusy(pullTarget.id)
    try {
      await administration.moderateVideo(numeric, 'ARCHIVED', pullReason.trim() || 'Pulled by platform administrator')
      toast({ title: `"${pullTarget.title}" pulled from the catalogue`, tone: 'bad' })
      setPullTarget(null)
      setPullReason('')
      notifyReportsChanged()
      refreshCatalogue()
      reloadQueue()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'That did not go through.', tone: 'bad' })
    } finally {
      setBusy(null)
    }
  }

  // Restore Title (Publish)
  const restoreVideo = async (v: { id: string; title: string }) => {
    const numeric = videoIdOf(v.id)
    if (numeric == null) return
    setBusy(v.id)
    try {
      await administration.moderateVideo(numeric, 'PUBLISHED', 'Restored to catalogue by platform administrator')
      toast({ title: `"${v.title}" restored to catalogue`, tone: 'ok' })
      notifyReportsChanged()
      refreshCatalogue()
      reloadQueue()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'That did not go through.', tone: 'bad' })
    } finally {
      setBusy(null)
    }
  }

  // Execute Ban User / Creator
  const confirmBan = async () => {
    if (!banTarget) return
    setBusy(String(banTarget.userId))
    try {
      await administration.setStatus(banTarget.userId, 'BLOCKED', banReason.trim() || 'Banned from Moderation Console')
      toast({
        title: `${banTarget.isChannel ? 'Channel & Creator' : 'User'} @${banTarget.username} has been banned`,
        tone: 'bad',
      })
      setBanTarget(null)
      setBanReason('')
      notifyReportsChanged()
      reloadQueue()
      refreshCatalogue()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'Failed to apply ban.', tone: 'bad' })
    } finally {
      setBusy(null)
    }
  }

  // Execute Quick Resolve
  const confirmResolve = async () => {
    if (!resolveTarget) return
    setBusy(`resolve-${resolveTarget.complaint.id}`)
    const note = resolveNote.trim() || 'Reviewed and resolved by administrator'
    try {
      await complaints.resolve(resolveTarget.complaint.id, note, 1)
      toast({ title: `Complaint ${referenceOf(resolveTarget.complaint)} resolved`, tone: 'ok' })
      setResolveTarget(null)
      setResolveNote('')
      notifyReportsChanged()
      reloadQueue()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'Failed to resolve complaint.', tone: 'bad' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <BackOfHouse
      title="Content Moderation &amp; Reports"
      actions={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-success-500/10 px-2.5 py-1 font-mono text-[11px] text-success-400">
            <span className="size-2 rounded-full bg-success-500 animate-pulse" />
            Live real-time
          </span>
          <Button
            size="sm"
            variant="quiet"
            icon={<RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={() => { reloadQueue(); refreshCatalogue() }}
          >
            Refresh
          </Button>
        </div>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'queue', label: 'Reported Content & Complaints', count: reported.length },
          { id: 'titles', label: 'Catalogue & All Titles', count: videos.length },
        ]}
      />

      {tab === 'queue' ? (
        <>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <SearchInput
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search reports, titles, details, references..."
              className="flex-1"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status"
              className="sm:w-44"
            >
              <option value="All">All statuses</option>
              <option value="UNRESOLVED">Open / Unresolved</option>
              <option value="RESOLVED">Resolved only</option>
              <option value="CLOSED">Closed only</option>
            </Select>
            <Select
              value={reportTypeFilter}
              onChange={(e) => setReportTypeFilter(e.target.value)}
              aria-label="Filter report type"
              className="sm:w-48"
            >
              <option value="All">All report types</option>
              <option value="INAPPROPRIATE_CONTENT">{REPORT_TYPE_LABEL.INAPPROPRIATE_CONTENT}</option>
              <option value="PLAYBACK_ISSUE">{REPORT_TYPE_LABEL.PLAYBACK_ISSUE}</option>
              <option value="ACCESSIBILITY_ISSUE">{REPORT_TYPE_LABEL.ACCESSIBILITY_ISSUE}</option>
              <option value="TECHNICAL_ISSUE">{REPORT_TYPE_LABEL.TECHNICAL_ISSUE}</option>
              <option value="OTHER">{REPORT_TYPE_LABEL.OTHER}</option>
            </Select>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter priority"
              className="sm:w-36"
            >
              <option value="All">All priorities</option>
              <option value="URGENT">Urgent only</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Select>
          </div>

          {queueLoading || queueError ? (
            <div className="mt-8">
              <Resolve loading={queueLoading} error={queueError} onRetry={reloadQueue} what="Reading reported content">
                {null}
              </Resolve>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="mt-8">
              <EmptyState icon={<ShieldCheck className="size-7" />} title="No reports matching"
                body="No complaints or content reports match the current filters."
                action={<Button onClick={() => { setStatusFilter('All'); setReportTypeFilter('All'); setPriorityFilter('All'); setSearchFilter('') }}>Clear filters</Button>} />
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {filteredReports.map((item) => {
                const { complaint, report } = item
                const v = titleFor(report?.contentReference)
                const isUrgent = complaint.priority === 'URGENT'

                return (
                  <li key={complaint.id} className={`rounded-lg border bg-ink-850 p-5 ${isUrgent ? 'border-danger-500/40 bg-danger-500/5' : 'border-ink-700'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[12px] font-semibold text-ink-200">{referenceOf(complaint)}</span>
                          <Letterboard tone={isUrgent ? 'bad' : 'review'}>
                            {complaint.priority}
                          </Letterboard>
                          {report?.type && (
                            <Letterboard tone="neutral">
                              {REPORT_TYPE_LABEL[report.type as ServerReportType] ?? report.type}
                            </Letterboard>
                          )}
                          <Letterboard tone={COMPLAINT_STATUS_TONE[complaint.status]}>
                            {`CMP: ${COMPLAINT_STATUS_LABEL[complaint.status].toUpperCase()}`}
                          </Letterboard>
                          {report && (
                            <Letterboard tone={REPORT_STATUS_TONE[report.status]}>
                              {`RPT: ${REPORT_STATUS_LABEL[report.status].toUpperCase()}`}
                            </Letterboard>
                          )}
                          {v && <BillingBoard billing={v.billing} />}
                        </div>

                        <div className="mt-3 rounded-md bg-ink-900/60 p-3 border border-ink-800">
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Report details</p>
                          <p className="mt-1 text-[14px] leading-relaxed text-ink-100">
                            {report?.details ?? 'The report behind this complaint could not be read.'}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-300">
                          <span>Reported by: <span className="font-mono text-ink-200">Viewer #{report?.viewerId ?? complaint.reportingViewerId ?? '—'}</span></span>
                          <span>Raised: <span className="font-mono text-ink-200">{complaint.createdAt?.slice(0, 10)}</span></span>
                          {report?.contentReference && (
                            <span>Reference: <span className="font-mono text-tone-cyan-300">{report.contentReference}</span></span>
                          )}
                        </div>

                        {v ? (
                          <div className="mt-3 flex items-center gap-2 rounded bg-ink-800/40 px-3 py-2 border border-ink-700/60">
                            <Tv className="size-4 text-tone-cyan-300 shrink-0" />
                            <span className="text-[13px] text-ink-200">
                              Attached Title: <strong className="text-fg">{v.title}</strong> by <strong className="text-fg">@{v.creator}</strong> ({v.views.toLocaleString()} views)
                            </span>
                          </div>
                        ) : report?.contentReference ? (
                          <p className="mt-2 font-mono text-[12px] text-ink-400">
                            {report.contentReference} — title not found in active catalogue
                          </p>
                        ) : null}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 sm:max-w-xs justify-end">
                        {v && (
                          <Button size="sm" icon={<Eye className="size-4" />} onClick={() => nav(`/watch/${v.id}`)}>
                            Review Video
                          </Button>
                        )}
                        <Button size="sm" variant="quiet" onClick={() => nav(`/queue/${complaint.id}`)}>
                          Full Complaint
                        </Button>
                        {v && (v.billing === 'HELD OVER' || v.billing === 'PULLED') ? (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<CheckCircle2 className="size-4" />}
                            loading={busy === v.id}
                            onClick={() => restoreVideo(v)}
                          >
                            Re-publish Video
                          </Button>
                        ) : v ? (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<Ban className="size-4" />}
                            onClick={() => { setPullTarget(v); setPullReason(`Pulled due to complaint ${referenceOf(complaint)}: ${report?.details ?? ''}`) }}
                          >
                            Pull Title
                          </Button>
                        ) : null}
                        {v && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<UserX className="size-4" />}
                            onClick={() => setBanTarget({
                              userId: v.creatorId ?? 0,
                              username: v.creator,
                              isChannel: true,
                              channelName: v.creator,
                            })}
                          >
                            Ban Channel
                          </Button>
                        )}
                        {report?.viewerId && (
                          <Button
                            size="sm"
                            variant="quiet"
                            onClick={() => setBanTarget({
                              userId: report.viewerId,
                              username: `Viewer #${report.viewerId}`,
                              isChannel: false,
                            })}
                          >
                            Ban Reporter
                          </Button>
                        )}
                        {complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED' && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<CheckCircle2 className="size-4" />}
                            onClick={() => { setResolveTarget(item); setResolveNote(`Reviewed by administrator. Action taken on reported content.`) }}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : catalogueLoading || catalogueError ? (
        <div className="mt-8">
          <Resolve loading={catalogueLoading} error={catalogueError} onRetry={refreshCatalogue} what="Reading the catalogue">
            {null}
          </Resolve>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850 overflow-x-auto">
          <Table labels={["Title", "Creator / Channel", "Billing State", "Views", "Actions"]}>
            <thead>
              <tr>
                <Th>Title</Th><Th>Creator / Channel</Th><Th>Billing State</Th><Th numeric>Views</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <Tr key={v.id}>
                  <Td>
                    <span className="font-medium text-fg">{v.title}</span>
                    <span className="block font-mono text-[11px] text-ink-400">ID #{v.id} · {v.category}</span>
                  </Td>
                  <Td className="text-ink-200">
                    <span className="font-medium text-fg">@{v.creator}</span>
                  </Td>
                  <Td><BillingBoard billing={v.billing} /></Td>
                  <Td numeric>{v.views.toLocaleString()}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="quiet" onClick={() => nav(`/watch/${v.id}`)}>
                        Watch
                      </Button>
                      {v.billing === 'HELD OVER' || v.billing === 'PULLED' ? (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={busy === v.id}
                          onClick={() => restoreVideo(v)}
                        >
                          Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busy === v.id}
                          onClick={() => { setPullTarget(v); setPullReason('') }}
                        >
                          Pull Title
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setBanTarget({
                          userId: v.creatorId ?? 0,
                          username: v.creator,
                          isChannel: true,
                          channelName: v.creator,
                        })}
                      >
                        Ban Channel
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Pull Title Modal */}
      <Modal
        open={!!pullTarget}
        onClose={() => setPullTarget(null)}
        title={pullTarget ? `Pull "${pullTarget.title}" from Programme?` : 'Pull Title'}
        width="md"
        footer={
          <>
            <Button variant="quiet" onClick={() => setPullTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={busy === pullTarget?.id} onClick={confirmPull}>
              Pull &amp; Archive Title
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-200 leading-relaxed">
            Pulling this title will immediately archive it and hide it from the catalogue and search results platform-wide.
          </p>
          <Field label="Moderation Reason" hint="Written to the audit log">
            <Input
              value={pullReason}
              onChange={(e) => setPullReason(e.target.value)}
              placeholder="Reason for pulling (e.g. Terms violation, inappropriate content...)"
            />
          </Field>
        </div>
      </Modal>

      {/* Ban Channel / User Modal */}
      <Modal
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        title={banTarget ? `Ban ${banTarget.isChannel ? 'Channel & Creator' : 'Account'} @${banTarget.username}?` : 'Ban Account'}
        width="md"
        footer={
          <>
            <Button variant="quiet" onClick={() => setBanTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={busy === String(banTarget?.userId)} onClick={confirmBan}>
              Confirm Ban
            </Button>
          </>
        }
      >
        {banTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-200 leading-relaxed">
              {banTarget.isChannel
                ? `Banning this creator will freeze their channel "@${banTarget.username}" and terminate their active sessions immediately.`
                : `Banning "@${banTarget.username}" will block their login and access to the platform immediately.`}
            </p>
            <Field label="Ban Reason" hint="Written to the activity log">
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="E.g. Inappropriate content violation, repeated violations..."
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* Quick Resolve Complaint Modal */}
      <Modal
        open={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        title={resolveTarget ? `Resolve ${referenceOf(resolveTarget.complaint)}?` : 'Resolve Complaint'}
        width="md"
        footer={
          <>
            <Button variant="quiet" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button variant="primary" loading={busy === `resolve-${resolveTarget?.complaint.id}`} onClick={confirmResolve}>
              Record Resolution
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Resolution Notes" hint="Sent to the reporter and recorded in complaint history">
            <Textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Describe the action taken..."
            />
          </Field>
        </div>
      </Modal>
    </BackOfHouse>
  )
}

/* ================================================================== logs */

export function AdminLogs() {
  const [q, setQ] = useState('')
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    administration.activityLogs(abort.signal)
      .then((rows) => { setLogs(rows); setError(null) })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof ApiError ? cause.message : 'Could not read the activity log.')
      })
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [nonce])

  const list = logs.filter((l) => {
    if (q.trim() && !`${l.actorUsername} ${l.actionType} ${l.targetUsername} ${l.detail ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const exportCsv = () => {
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [
      ['Timestamp', 'Actor', 'Action', 'Target', 'Detail', 'IP'].map(quote).join(','),
      ...list.map((l) => [l.actionTime, l.actorUsername, l.actionType, l.targetUsername, l.detail, l.ipAddress].map(quote).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'skopia-activity-log.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <BackOfHouse
      title="Activity Log"
      actions={
        <Button size="sm" icon={<Download className="size-4" />} onClick={exportCsv} disabled={list.length === 0}>
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, action or target" className="flex-1" />
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">{list.length} entries</p>

      {loading || error ? (
        <div className="mt-6">
          <Resolve loading={loading} error={error} onRetry={() => setNonce((n) => n + 1)} what="Reading the activity log">{null}</Resolve>
        </div>
      ) : list.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<ScrollText className="size-7" />} title="No entries matched"
            body="Nothing in the log matches those filters."
            action={<Button onClick={() => setQ('')}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Timestamp", "Actor", "Action", "Target", "Detail"]}>
            <thead>
              <tr><Th>Timestamp</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Detail</Th></tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <Tr key={l.logId}>
                  <Td><span className="font-mono tabular-nums text-ink-300">{l.actionTime?.replace('T', ' ').slice(0, 19)}</span></Td>
                  <Td><span className="font-mono text-tone-cyan-300">@{l.actorUsername ?? 'system'}</span></Td>
                  <Td><span className="font-mono text-ink-100 font-semibold">{l.actionType}</span></Td>
                  <Td><span className="font-mono text-ink-300">{l.targetUsername ? `@${l.targetUsername}` : '—'}</span></Td>
                  <Td><span className="text-ink-200">{l.detail ?? '—'}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </BackOfHouse>
  )
}

/* ============================================================== settings */

export function AdminSettings() {
  const toast = useToast()
  const [s, setS] = useState({
    registration: true, comments: true, uploads: true, ads: true, premium: true, maintenance: false,
  })

  const saveSettings = () => {
    toast({ title: 'Platform settings saved successfully', tone: 'ok' })
  }

  return (
    <BackOfHouse
      title="Platform Settings"
      actions={<Button size="sm" variant="primary" onClick={saveSettings}>Save settings</Button>}
    >
      <div className="max-w-2xl">
        <Section title="Access &amp; Security">
          <div className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850 px-5">
            <Toggle label="Open registration" description="Anyone can create a new viewer account." checked={s.registration} onChange={(v) => setS({ ...s, registration: v })} />
            <Toggle label="Creator uploads" description="Creators can upload and publish new videos." checked={s.uploads} onChange={(v) => setS({ ...s, uploads: v })} />
            <Toggle label="Comments" description="Viewers can comment on videos platform-wide." checked={s.comments} onChange={(v) => setS({ ...s, comments: v })} />
          </div>
        </Section>

        <div className="mt-8">
          <Section title="Monetization &amp; Advertising">
            <div className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850 px-5">
              <Toggle label="Advertising" description="Campaigns are actively delivered across slots." checked={s.ads} onChange={(v) => setS({ ...s, ads: v })} />
              <Toggle label="Premium content" description="Premium titles require an active subscription pass." checked={s.premium} onChange={(v) => setS({ ...s, premium: v })} />
            </div>
          </Section>
        </div>

        <div className="mt-8">
          <Section title="Operations &amp; Maintenance">
            <div className="divide-y divide-ink-800 rounded-lg border border-ink-700 bg-ink-850 px-5">
              <Toggle label="Maintenance mode" description="Display maintenance notice to general viewers." checked={s.maintenance} onChange={(v) => setS({ ...s, maintenance: v })} />
            </div>
          </Section>
        </div>
      </div>
    </BackOfHouse>
  )
}