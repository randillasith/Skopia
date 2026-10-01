/**
 * Sign-in, sign-up, and turning a server account into the shape this UI uses.
 *
 * The API answers with a flat `LoginResponse` carrying one `roleType`. This UI
 * models capability as three independent grants (lib/session.ts), so the mapping
 * between them lives here and nowhere else — a screen never reads `roleType`.
 */

import { request, ApiError } from './api'
import type { Account, AccountStatus, StaffRole } from './session'
import { channelByHandle } from './session'

/* ------------------------------------------------------------ server shape */

/** What /api/auth/login, /register and /me all answer with. */
export type ServerAccount = {
  id: number | null
  userId: number | null
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  roleType: string | null
  userType: string | null
  accountStatus: string | null
  isPremium: boolean | null
  isVerified: boolean | null
  token: string | null
  message: string | null
}

/**
 * The server's single role word, read as the grants it actually implies.
 *
 * Only the three staff subclasses carry a platform grant. A content creator is
 * not staff — owning a channel is its own grant, and collapsing the two is the
 * mistake lib/session.ts exists to avoid.
 */
function staffFrom(roleType: string | null | undefined): StaffRole[] {
  const role = (roleType ?? '').toUpperCase().replace(/[^A-Z]/g, '')
  if (role.includes('ADMINISTRATOR') || role === 'ADMIN') return ['admin']
  if (role.includes('MARKETING')) return ['marketing']
  if (role.includes('SUPPORT')) return ['support']
  return []
}

/**
 * The server spells status in capitals; the UI spells it as a word.
 *
 * DEACTIVATED is what the administration endpoints write when an account is
 * suspended — the two modules chose different words for the same state — so it
 * reads as Suspended here. Only ACTIVE reads as active: anything unrecognised
 * is treated as not active, because letting an unknown state read as working is
 * the more dangerous of the two mistakes.
 */
function statusFrom(accountStatus: string | null | undefined): AccountStatus {
  switch ((accountStatus ?? 'ACTIVE').toUpperCase()) {
    case 'ACTIVE':
      return 'Active'
    case 'SUSPENDED':
    case 'DEACTIVATED':
    case 'INACTIVE':
      return 'Suspended'
    case 'BLOCKED':
      return 'Blocked'
    case 'INVITED':
      return 'Invited'
    default:
      return 'Suspended'
  }
}

/**
 * Turn a server account into the session's `Account`.
 *
 * `channelId` is resolved by handle against the prototype's channel list, which
 * is the only place channels exist — there is no channel backend yet. A creator
 * whose handle names no known channel still reads as a creator through
 * `isContentCreator`, so the studio is not closed to them.
 */
export function toAccount(server: ServerAccount): Account {
  const userId = server.userId ?? server.id
  const role = (server.roleType ?? server.userType ?? '').toUpperCase()
  const creator = role.includes('CREATOR')
  const channel = creator ? channelByHandle(server.username) : null

  return {
    id: userId == null ? server.username : String(userId),
    userId: userId ?? null,
    name: server.displayName?.trim() ||
      [server.firstName, server.lastName].filter(Boolean).join(' ').trim() ||
      server.username,
    handle: server.username,
    firstName: server.firstName,
    lastName: server.lastName,
    email: server.email,
    joined: '',
    lastSeen: 'now',
    status: statusFrom(server.accountStatus),
    staff: staffFrom(server.roleType ?? server.userType),
    channelId: channel?.id ?? null,
    isContentCreator: creator,
    isPremium: server.isPremium === true,
    isVerified: server.isVerified === true,
  }
}

/* ----------------------------------------------------------------- client */

export type SignUpInput = {
  username: string
  email: string
  password: string
  displayName?: string
  firstName?: string
  lastName?: string
  /**
   * 'CONTENT_CREATOR' asks the server for a creator account, anything else for
   * an ordinary viewer. The field is named as the API names it — sending it as
   * `role` is silently ignored and everybody becomes a viewer.
   */
  roleType?: string
  channelName?: string
}

export const accounts = {
  signIn: (identifier: string, password: string) =>
    request<ServerAccount>('/api/auth/login', {
      method: 'POST',
      body: { identifier, emailOrUsername: identifier, password },
    }),

  signUp: (input: SignUpInput) =>
    request<ServerAccount>('/api/auth/register', { method: 'POST', body: input }),

  /** Re-resolve the account represented by the stored signed bearer token. */
  me: () => request<ServerAccount>('/api/auth/me'),

  handleAvailable: (handle: string) =>
    request<{ handle: string; available: boolean }>(
      `/api/auth/check-handle?handle=${encodeURIComponent(handle)}`,
    ),
}

export { ApiError }

/* ------------------------------------------------------- administration */

/**
 * An account as `GET /api/users` returns it.
 *
 * That endpoint serialises the entity rather than a DTO, so which fields are
 * present is what tells you what kind of account it is: there is no type
 * discriminator. `designation` marks staff, and the three staff kinds are told
 * apart by the field only they carry.
 */
export type ServerUserRow = {
  id: number
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  displayName?: string | null
  accountStatus: string | null
  registeredDate: string | null
  roleType?: string | null
  userType?: string | null
  designation?: string | null
  adminLevel?: string | null
  officerCode?: string | null
  supportLevel?: string | null
  channelName?: string | null
  isVerified?: boolean | null
  isPremium?: boolean | null
  totalUploads?: number | null
}

/** Read an account row as the session's `Account`, grants and all. */
export function rowToAccount(row: ServerUserRow): Account {
  const staff = staffFrom(row.roleType ?? row.userType)
  if (staff.length === 0 && row.adminLevel != null) staff.push('admin')
  else if (staff.length === 0 && row.officerCode != null) staff.push('marketing')
  else if (staff.length === 0 && row.supportLevel != null) staff.push('support')
  else if (staff.length === 0 && row.designation != null) {
    // Staff whose kind cannot be told from the fields present. Naming the
    // designation is more honest than guessing at a grant.
    staff.push(...staffFrom(row.designation))
  }

  const creator = row.channelName != null
  return {
    id: String(row.id),
    userId: row.id,
    name:
      row.displayName?.trim() ||
      row.channelName?.trim() ||
      [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
      row.username,
    handle: row.username,
    email: row.email,
    joined: (row.registeredDate ?? '').slice(0, 10),
    lastSeen: '—',
    status: statusFrom(row.accountStatus),
    staff,
    channelId: creator ? channelByHandle(row.username)?.id ?? null : null,
    isContentCreator: creator,
    isPremium: row.isPremium === true,
    isVerified: row.isVerified === true,
  }
}

export const administration = {
  users: (signal?: AbortSignal) => request<ServerUserRow[]>('/api/admin/users', { signal }),
  user: (userId: number) => request<ServerUserRow>(`/api/admin/users/${userId}`),
  stats: () => request<PlatformUserStats>('/api/admin/users/stats'),
  activityLogs: (signal?: AbortSignal) =>
    request<ActivityLogRow[]>('/api/admin/users/activity-logs', { signal }),
  setStatus: (userId: number, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', reason: string) =>
    request<ServerUserRow>(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: { status, reason },
    }),
  createStaff: (input: CreateStaffInput) =>
    request<ServerUserRow>('/api/admin/users/staff', { method: 'POST', body: input }),
  updateStaff: (userId: number, input: UpdateStaffInput) =>
    request<ServerUserRow>(`/api/admin/users/staff/${userId}`, { method: 'PATCH', body: input }),
  setCreatorVerified: (userId: number, isVerified: boolean) =>
    request<ServerUserRow>(`/api/admin/users/${userId}/creator-verification`, {
      method: 'PATCH', body: { isVerified },
    }),
  moderateVideo: (videoId: number, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED', reason: string) =>
    request<unknown>(`/api/admin/videos/${videoId}/status`, {
      method: 'PATCH', body: { status, reason },
    }),
}

export type PlatformUserStats = {
  totalUsers: number
  activeUsers: number
  suspendedUsers: number
  blockedUsers: number
  totalViewers: number
  premiumViewers: number
  totalCreators: number
  verifiedCreators: number
  totalStaff: number
  administratorsCount: number
  supportOfficersCount: number
  marketingOfficersCount: number
}

export type ActivityLogRow = {
  logId: number
  actorUserId: number | null
  actorUsername: string | null
  targetUserId: number | null
  targetUsername: string | null
  detail: string | null
  actionType: string
  actionTime: string
  ipAddress: string
}

export type CreateStaffInput = {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  designation: string
  hireDate: string
  staffType: 'ADMINISTRATOR' | 'SUPPORT_OFFICER' | 'MARKETING_OFFICER'
  adminLevel?: string
  supportLevel?: string
  shift?: string
  officerCode?: string
  department?: string
}

export type UpdateStaffInput = Partial<Omit<CreateStaffInput, 'username' | 'email' | 'password' | 'hireDate' | 'staffType'>>

/** What an account holder can change about themselves. */
export type ProfileChanges = {
  firstName?: string
  lastName?: string
  displayName?: string
  email?: string
  bio?: string
  contactNo?: string
}

export const profile = {
  update: (changes: ProfileChanges) =>
    request<ServerUserRow>('/api/users/me/profile', { method: 'PUT', body: changes }),

  /** Closing an account. The server deletes rather than deactivates. */
  close: () => request<void>('/api/users/me', { method: 'DELETE' }),
}
