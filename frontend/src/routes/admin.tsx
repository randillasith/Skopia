import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate} from 'react-router-dom'
import {
  Users, AlertTriangle, Ban, ShieldCheck, Plus, Megaphone, Eye,
  Download, ScrollText, CreditCard, Receipt,
} from 'lucide-react'
import {
  Button, Field, Input, Select, Table, Th, Td, Tr, Tabs, Modal,
  EmptyState, Toggle, useToast, SearchInput, Avatar, Section,
  NotAvailableYet,
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
  complaints, loadQueue, referenceOf, COMPLAINT_STATUS_LABEL,
  type QueueItem, type ServerComplaint,
} from '@/lib/reports'
import { videoIdOf } from '@/lib/catalogue'

import { ads, type Campaign as AdCampaign } from '@/lib/ads'
import {
  GRANTS, STAFF_ROLES,
  type Account, type StaffRole,
} from '@/lib/session'

const ACCOUNT_TONE: Record<Account['status'], 'ok' | 'review' | 'bad' | 'soon'> = {
  Active: 'ok', Suspended: 'review', Blocked: 'bad', Invited: 'soon',
}

/* ============================================================= dashboard */

export function AdminDashboard() {
  // The dashboard is a summary of three modules, so it reads the same endpoints
  // those modules do. A count that cannot be read is shown as a dash rather than
  // as a zero, because "none" and "could not tell" are different things.
  const { videos, loading: catalogueLoading } = useCatalogue()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [queue, setQueue] = useState<ServerComplaint[] | null>(null)
  const [stats, setStats] = useState<PlatformUserStats | null>(null)
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [campaigns, setCampaigns] = useState<AdCampaign[] | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    administration.users(abort.signal).then((rows) => setAccounts(rows.map(rowToAccount))).catch(() => setAccounts(null))
    administration.stats().then(setStats).catch(() => setStats(null))
    administration.activityLogs(abort.signal).then((rows) => setLogs(rows.slice(0, 6))).catch(() => setLogs([]))
    complaints.queue(abort.signal).then(setQueue).catch(() => setQueue(null))
    // An administrator may read advertising, so the campaign figure is the real
    // one rather than a count of fixtures.
    ads.campaigns.list(null).then(setCampaigns).catch(() => setCampaigns(null))
    return () => abort.abort()
  }, [])

  const openComplaints = queue?.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED') ?? []
  const inReview = videos.filter((v) => v.billing === 'IN REVIEW')
  const count = (n: number | undefined | null) => (n == null ? '—' : String(n))

  return (
    <BackOfHouse title="Dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Accounts', count(stats?.totalUsers ?? accounts?.length), stats ? `${stats.activeUsers} active` : accounts ? `${accounts.filter((a) => a.status === 'Active').length} active` : 'could not be read'],
          ['Titles', catalogueLoading ? '—' : String(videos.length), `${inReview.length} awaiting review`],
          ['Open complaints', count(queue ? openComplaints.length : null), queue ? `${queue.filter((c) => c.priority === 'URGENT').length} urgent` : 'could not be read'],
          [
            'Active campaigns',
            count(campaigns ? campaigns.filter((c) => c.status === 'ACTIVE').length : null),
            campaigns
              ? `${campaigns.filter((c) => c.status === 'SCHEDULED').length} scheduled`
              : 'could not be read',
          ],
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
              ...inReview.map((v) => ({ k: `v-${v.id}`, board: 'IN REVIEW', title: v.title, sub: `${v.creator} · awaiting moderation`, to: '/admin/moderation' })),
              ...openComplaints.slice(0, 3).map((c) => ({
                k: `c-${c.id}`,
                board: c.priority,
                title: `Complaint ${referenceOf(c)}`,
                sub: `${COMPLAINT_STATUS_LABEL[c.status]} · raised ${c.createdAt?.slice(0, 10)}`,
                to: `/queue/${c.id}`,
              })),
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
            {logs.map((l) => (
              <li key={l.logId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="size-1.5 shrink-0 rounded-full bg-success-500" />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-200">
                  <span className="text-cyan-300">@{l.actorUsername ?? 'system'}</span>{' '}
                  {l.actionType} {l.targetUsername ? `@${l.targetUsername}` : ''}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-300">
                  {l.actionTime?.slice(11, 16)}
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

/**
 * Every account on the platform.
 *
 * Two of the three grants are shown as facts rather than as controls, because
 * an administrator does not hold them: channel ownership is self-service and
 * moderation is granted by channel owners. The third — the staff role — is an
 * administrator's to give, but no endpoint grants one yet, so the control says
 * so instead of pretending.
 */
export function AdminAccounts() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('All')
  const [acting, setActing] = useState<Account | null>(null)
  const [editingStaff, setEditingStaff] = useState<{ row: ServerUserRow; form: UpdateStaffInput } | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const [accounts, setAccounts] = useState<Account[]>([])
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

  const list = useMemo(
    () =>
      accounts.filter((a) => {
        if (role === 'staff' && a.staff.length === 0) return false
        if (role === 'creator' && !a.isContentCreator) return false
        if (role === 'none' && (a.staff.length > 0 || a.isContentCreator)) return false
        if (role !== 'All' && ['marketing', 'support', 'admin'].includes(role)
            && !a.staff.includes(role as StaffRole)) return false
        if (q.trim() && !`${a.name} ${a.handle} ${a.id}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [accounts, q, role],
  )

  const setStatus = async () => {
    if (!acting || acting.userId == null) return
    const suspending = acting.status === 'Active'
    setBusy(true)
    try {
      await administration.setStatus(
        acting.userId,
        suspending ? 'SUSPENDED' : 'ACTIVE',
        suspending ? 'Suspended from the admin console' : 'Restored from the admin console',
      )
      toast({
        title: suspending ? `${acting.name} suspended` : `${acting.name} restored`,
        tone: suspending ? 'bad' : 'ok',
      })
      setActing(null)
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

  const setCreatorVerification = async (account: Account) => {
    if (account.userId == null) return
    setBusy(true)
    try {
      await administration.setCreatorVerified(account.userId, account.isVerified !== true)
      toast({
        title: account.isVerified ? `${account.name} is no longer verified` : `${account.name} verified`,
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
          designation: row.designation ?? '', firstName: row.firstName ?? '', lastName: row.lastName ?? '',
          adminLevel: row.adminLevel ?? undefined, supportLevel: row.supportLevel ?? undefined,
          officerCode: row.officerCode ?? undefined,
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
      await administration.updateStaff(editingStaff.row.id, editingStaff.form)
      toast({ title: `@${editingStaff.row.username} updated`, tone: 'ok' })
      setEditingStaff(null)
      refresh()
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'The staff profile could not be updated.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <BackOfHouse title="Accounts">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, handle or id" className="flex-1" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter accounts" className="sm:w-56">
          <option value="All">Every account</option>
          <option value="staff">Holds a staff role</option>
          <option value="creator">Owns a channel</option>
          <option value="none">Ordinary account</option>
          <option value="marketing">{STAFF_ROLES.marketing.label}</option>
          <option value="support">{STAFF_ROLES.support.label}</option>
          <option value="admin">{STAFF_ROLES.admin.label}</option>
        </Select>
      </div>

      <p className="mt-4 font-mono text-[12px] tabular-nums text-ink-300">
        {loading ? 'Reading' : `${list.length} accounts`}
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
            body="Nothing matched that search and role filter."
            action={<Button onClick={() => { setQ(''); setRole('All') }}>Clear filters</Button>} />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Account", "Staff role", "Channel", "Status", "Joined", ""]}>
            <thead>
              <tr>
                <Th>Account</Th><Th>Staff role</Th><Th>Channel</Th><Th>Status</Th>
                <Th>Joined</Th><Th />
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
                          @{a.handle} · #{a.id}
                        </span>
                      </span>
                    </span>
                  </Td>
                  {/* None of the three grants can be changed from here. Channel
                      ownership is self-service, moderation belongs to channel
                      owners, and nothing in the API grants a staff role — so the
                      role is stated rather than offered as a control that would
                      do nothing. */}
                  <Td>
                    {a.staff.length > 0 ? (
                      <span className="text-ink-150">
                        {a.staff.map((r) => STAFF_ROLES[r].label).join(', ')}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td>
                    {a.isContentCreator ? (
                      <span className="text-ink-150">{a.name}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td><Letterboard tone={ACCOUNT_TONE[a.status]}>{a.status.toUpperCase()}</Letterboard></Td>
                  <Td><span className="font-mono tabular-nums text-ink-300">{a.joined || '—'}</span></Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {a.staff.length > 0 && (
                        <Button size="sm" variant="quiet" disabled={busy} onClick={() => openStaffEditor(a)}>Edit staff</Button>
                      )}
                      {a.isContentCreator && (
                        <Button size="sm" variant="quiet" disabled={busy} onClick={() => setCreatorVerification(a)}>
                          {a.isVerified ? 'Unverify' : 'Verify'}
                        </Button>
                      )}
                      <Button size="sm" variant="quiet" disabled={busy} onClick={() => setActing(a)}>
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

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-300">
        Staff accounts can be created and their profiles updated. Changing an existing account's
        entity subtype is not supported, so a staff role itself cannot be converted in place.
      </p>

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
              loading={busy}
              onClick={setStatus}
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

      <Modal
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title={editingStaff ? `Edit @${editingStaff.row.username}` : 'Edit staff'}
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
            <Field label="Designation"><Input value={editingStaff.form.designation ?? ''} onChange={(e) => setEditingStaff({ ...editingStaff, form: { ...editingStaff.form, designation: e.target.value } })} /></Field>
            {editingStaff.row.roleType === 'ADMINISTRATOR' && <Field label="Admin level"><Input value={editingStaff.form.adminLevel ?? ''} onChange={(e) => setEditingStaff({ ...editingStaff, form: { ...editingStaff.form, adminLevel: e.target.value } })} /></Field>}
            {editingStaff.row.roleType === 'SUPPORT_OFFICER' && <Field label="Support level"><Input value={editingStaff.form.supportLevel ?? ''} onChange={(e) => setEditingStaff({ ...editingStaff, form: { ...editingStaff.form, supportLevel: e.target.value } })} /></Field>}
            {editingStaff.row.roleType === 'MARKETING_OFFICER' && <Field label="Officer code"><Input value={editingStaff.form.officerCode ?? ''} onChange={(e) => setEditingStaff({ ...editingStaff, form: { ...editingStaff.form, officerCode: e.target.value } })} /></Field>}
          </div>
        )}
      </Modal>
    </BackOfHouse>
  )
}

/* ================================================================= roles */

const EMPTY_STAFF: CreateStaffInput = {
  username: '', email: '', password: '', firstName: '', lastName: '',
  designation: '', hireDate: '', staffType: 'SUPPORT_OFFICER',
}

export function AdminRoles() {
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [staffForm, setStaffForm] = useState<CreateStaffInput>(EMPTY_STAFF)
  const [roleAccounts, setRoleAccounts] = useState<Account[]>([])
  const [roleNonce, setRoleNonce] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    administration.users(abort.signal)
      .then((rows) => setRoleAccounts(rows.map(rowToAccount)))
      .catch(() => setRoleAccounts([]))
    return () => abort.abort()
  }, [roleNonce])

  const staffCounts = (Object.keys(STAFF_ROLES) as StaffRole[]).map((r) => ({
    role: r,
    holders: roleAccounts.filter((a) => a.staff.includes(r)),
  }))

  const createStaff = async () => {
    setSaving(true)
    try {
      await administration.createStaff(staffForm)
      toast({ title: `@${staffForm.username} created`, tone: 'ok' })
      setRoleNonce((n) => n + 1)
      setStaffForm(EMPTY_STAFF)
      setCreating(false)
    } catch (cause) {
      toast({ title: cause instanceof ApiError ? cause.message : 'The staff account could not be created.', tone: 'bad' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <BackOfHouse title="Roles &amp; permissions" actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Create staff</Button>}>
      <div className="flex items-start gap-2.5 rounded-sm border border-warning-500/35 bg-warning-500/8 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-400" />
        <p className="text-[13.5px] leading-relaxed text-ink-200">
          The detailed permission set is an open decision in the project documentation. What follows
          is a working draft, not a confirmed specification.
        </p>
      </div>

      <p className="mt-6 max-w-[74ch] text-[14px] leading-relaxed text-ink-200">
        Three grants decide what an account can do, and they are independent of one another. You
        control only the first. The other two are not yours to give: a channel is opened by whoever
        wants one, and a moderator is appointed by the owner of the channel they moderate.
      </p>

      <Section title="What each grant carries, and who gives it" className="mt-8">
        <div className="rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={['Can', 'Scope', 'Granted by']}>
            <thead>
              <tr><Th className="w-[46%]">Can</Th><Th>Scope</Th><Th>Granted by</Th></tr>
            </thead>
            <tbody>
              {GRANTS.map((g) => (
                <Tr key={g.what}>
                  <Td className="font-medium text-white">{g.what}</Td>
                  <Td>
                    <Letterboard
                      tone={
                        g.scope === 'Platform' ? 'soon'
                          : g.scope === 'Channel' ? 'live'
                            : g.scope === 'Account' ? 'neutral' : 'dead'
                      }
                    >
                      {g.scope}
                    </Letterboard>
                  </Td>
                  <Td className="text-ink-300">{g.by}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Section>

      <Section title="Staff roles you have granted" className="mt-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {staffCounts.map(({ role, holders }) => (
            <div key={role} className="rounded-lg border border-ink-700 bg-ink-850 p-4">
              <p className="letterboard text-ink-300">{STAFF_ROLES[role].console}</p>
              <p className="font-marquee mt-1 text-[15px] font-bold text-white">
                {STAFF_ROLES[role].label}
              </p>
              <p className="font-marquee mt-3 text-[30px] font-bold tabular-nums leading-none text-white">
                {holders.length}
              </p>
              <ul className="mt-3 space-y-1 border-t border-ink-800 pt-3">
                {holders.map((h) => (
                  <li key={h.id} className="truncate font-mono text-[12px] text-ink-300">
                    @{h.handle}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Channel moderators — for reference only" className="mt-10">
        <p className="mb-4 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-300">
          A channel owner appoints their own moderators, and the grant reaches that channel alone.
          An administrator can see them during an investigation but cannot grant or revoke one.
        </p>
        <NotAvailableYet
          what="Channel moderator grants"
          icon={<ShieldCheck className="size-7" />}
          body="Channels and their moderators are not stored on the server yet, so this cannot be
            listed. It previously showed a fixed example list, which is no basis for an
            investigation."
        />
      </Section>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create staff account"
        width="lg"
        footer={
          <>
            <Button variant="quiet" onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              loading={saving}
              disabled={!staffForm.username || !staffForm.email || staffForm.password.length < 8 || !staffForm.designation || !staffForm.hireDate}
              onClick={createStaff}
            >Create staff</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username"><Input value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></Field>
          <Field label="First name"><Input value={staffForm.firstName} onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })} /></Field>
          <Field label="Last name"><Input value={staffForm.lastName} onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })} /></Field>
          <Field label="Role">
            <Select value={staffForm.staffType} onChange={(e) => setStaffForm({ ...staffForm, staffType: e.target.value as CreateStaffInput['staffType'] })}>
              <option value="ADMINISTRATOR">Administrator</option>
              <option value="SUPPORT_OFFICER">Support officer</option>
              <option value="MARKETING_OFFICER">Marketing officer</option>
            </Select>
          </Field>
          <Field label="Designation"><Input value={staffForm.designation} onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })} /></Field>
          <Field label="Hire date"><Input type="date" value={staffForm.hireDate} onChange={(e) => setStaffForm({ ...staffForm, hireDate: e.target.value })} /></Field>
          <Field label="Temporary password" hint="At least 8 characters"><Input type="password" maxLength={72} value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} /></Field>
        </div>
      </Modal>
    </BackOfHouse>
  )
}

/* ============================================================ moderation */

/**
 * Content complaints, and the whole catalogue.
 *
 * A moderation decision is an act on the title itself, which is why it lives
 * here rather than in the support queue: an officer can resolve a complaint but
 * cannot pull a title. Pulling one archives it, which is the strongest thing the
 * catalogue API offers — there is no "blocked" state a title can be put into.
 */
export function AdminModeration() {
  const nav = useNavigate()
  const toast = useToast()
  const { videos, loading, error, refresh } = useCatalogue()
  const [tab, setTab] = useState('queue')
  const [busy, setBusy] = useState<string | null>(null)

  const [reported, setReported] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const reloadQueue = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const abort = new AbortController()
    setQueueLoading(true)
    complaints
      .queue(abort.signal)
      .then((rows) => loadQueue(rows, abort.signal))
      .then((joined) => {
        setReported(joined.filter((i) => i.report?.type === 'INAPPROPRIATE_CONTENT'))
        setQueueError(null)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setQueueError(cause instanceof ApiError ? cause.message : 'Could not read the queue.')
        setReported([])
      })
      .finally(() => {
        if (!abort.signal.aborted) setQueueLoading(false)
      })
    return () => abort.abort()
  }, [nonce])

  /** The title a report names, if it named one this page can resolve. */
  const titleFor = (reference: string | null | undefined) => {
    const match = /^video:(\d+)$/.exec(reference ?? '')
    return match ? videos.find((v) => v.id === match[1]) : undefined
  }

  const pull = async (video: { id: string; title: string }) => {
    const numeric = videoIdOf(video.id)
    if (numeric == null) return
    setBusy(video.id)
    try {
      await administration.moderateVideo(numeric, 'ARCHIVED', 'Removed from the admin moderation console')
      toast({ title: `${video.title} pulled from the programme`, tone: 'bad' })
      refresh()
    } catch (cause) {
      toast({
        title: cause instanceof ApiError ? cause.message : 'That did not go through.',
        tone: 'bad',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <BackOfHouse title="Moderation">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'queue', label: 'Reported content', count: reported.length },
          { id: 'titles', label: 'All titles', count: videos.length },
        ]}
      />

      {tab === 'queue' ? (
        queueLoading || queueError ? (
          <div className="mt-8">
            <Resolve loading={queueLoading} error={queueError} onRetry={reloadQueue} what="Reading reported content">
              {null}
            </Resolve>
          </div>
        ) : reported.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<ShieldCheck className="size-7" />} title="Nothing reported"
              body="No content complaints are waiting for a moderation decision." />
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {reported.map(({ complaint, report }) => {
              const v = titleFor(report?.contentReference)
              return (
                <li key={complaint.id} className="rounded-lg border border-ink-700 bg-ink-850 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] text-ink-300">{referenceOf(complaint)}</span>
                        <Letterboard tone={complaint.priority === 'URGENT' ? 'bad' : 'review'}>
                          {complaint.priority}
                        </Letterboard>
                        {v && <BillingBoard billing={v.billing} />}
                      </div>
                      <p className="mt-2 text-[15px] font-medium text-white">Inappropriate content</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-300">
                        {report?.details ?? 'The report behind this complaint could not be read.'}
                      </p>
                      {v ? (
                        <p className="mt-2 text-[12.5px] text-ink-300">
                          On{' '}
                          <Link to={`/watch/${v.id}`} className="text-cyan-300 hover:underline">
                            {v.title}
                          </Link>{' '}
                          by {v.creator}
                        </p>
                      ) : (
                        report?.contentReference && (
                          <p className="mt-2 font-mono text-[12.5px] text-ink-300">
                            {report.contentReference} — no longer in the catalogue
                          </p>
                        )
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" icon={<Eye className="size-4" />} disabled={!v}
                        onClick={() => v && nav(`/watch/${v.id}`)}>
                        Review
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => nav(`/queue/${complaint.id}`)}>
                        Open complaint
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Ban className="size-4" />}
                        disabled={!v}
                        loading={busy === v?.id}
                        onClick={() => v && pull(v)}
                      >
                        Pull title
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : loading || error ? (
        <div className="mt-8">
          <Resolve loading={loading} error={error} onRetry={refresh} what="Reading the catalogue">
            {null}
          </Resolve>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Title", "Creator", "Billing", "Views", ""]}>
            <thead>
              <tr><Th>Title</Th><Th>Creator</Th><Th>Billing</Th><Th numeric>Views</Th><Th /></tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <Tr key={v.id}>
                  <Td><span className="font-medium text-white">{v.title}</span></Td>
                  <Td className="text-ink-300">{v.creator}</Td>
                  <Td><BillingBoard billing={v.billing} /></Td>
                  <Td numeric>{v.views.toLocaleString()}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="quiet" onClick={() => nav(`/watch/${v.id}`)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        loading={busy === v.id}
                        disabled={v.billing === 'HELD OVER'}
                        onClick={() => pull(v)}
                      >
                        Pull
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
  return (
    <BackOfHouse title="Subscription plans">
      <NotAvailableYet
        what="Subscription plans"
        icon={<CreditCard className="size-7" />}
        body="This is where plans are created and priced, and where what each one unlocks is
          decided. Nothing on the server stores a plan yet, so there is nothing to list — and
          rather than show invented ones, this screen waits for the subscription module."
      />
    </BackOfHouse>
  )
}

/* =============================================================== refunds */

export function AdminRefunds() {
  return (
    <BackOfHouse title="Refunds">
      <NotAvailableYet
        what="Refunds"
        icon={<Receipt className="size-7" />}
        body="Approved refunds are processed here against the payment that was taken. No payment
          is recorded anywhere yet, so there is nothing to refund. The screen opens for real the
          day billing does."
      />
    </BackOfHouse>
  )
}

/* ========================================================= announcements */

export function AdminAnnouncements() {
  return (
    <BackOfHouse title="Announcements">
      <NotAvailableYet
        what="Platform announcements"
        icon={<Megaphone className="size-7" />}
        body="Announcements are written here and shown to everyone on the platform. Writing one
          would have nowhere to be kept and nobody to reach, so the composer stays closed until
          announcements are stored and delivered."
      />
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
      title="Activity log"
      actions={
        <Button size="sm" icon={<Download className="size-4" />} onClick={exportCsv} disabled={list.length === 0}>
          Export
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
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850">
          <Table labels={["Timestamp", "Actor", "Action", "Target", "Detail"]}>
            <thead>
              <tr><Th>Timestamp</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Detail</Th></tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <Tr key={l.logId}>
                  <Td><span className="font-mono tabular-nums text-ink-300">{l.actionTime}</span></Td>
                  <Td><span className="font-mono text-cyan-300">@{l.actorUsername ?? 'system'}</span></Td>
                  <Td><span className="font-mono text-ink-100">{l.actionType}</span></Td>
                  <Td><span className="font-mono text-ink-300">{l.targetUsername ? `@${l.targetUsername}` : '—'}</span></Td>
                  <Td><span className="text-ink-300">{l.detail ?? '—'}</span></Td>
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
      actions={<Button size="sm" variant="primary" onClick={() => toast({ title: 'Settings persistence is not implemented yet', tone: 'bad' })}>Save settings</Button>}
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
