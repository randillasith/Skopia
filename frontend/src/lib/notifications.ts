import { request } from './api'

export type NotificationKind = 'BILLING' | 'REFUND' | 'SYSTEM' | 'CONTENT' | string
export type DurableNotification = {
  id: number
  type: NotificationKind
  title: string
  body: string
  createdAt: string
  readAt: string | null
  link: string | null
}

export type AnnouncementAudience = 'ALL' | 'VIEWERS' | 'CREATORS'
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type Announcement = {
  id: number
  title: string
  body: string
  audience: AnnouncementAudience
  status: AnnouncementStatus
  createdAt: string
  updatedAt: string
  publishDate: string | null
  publisherId?: number | null
  publisherUsername?: string | null
}

export type AnnouncementInput = {
  title: string
  body: string
  audience: AnnouncementAudience
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export function validateAnnouncement(input: AnnouncementInput) {
  const errors: Partial<Record<keyof AnnouncementInput, string>> = {}
  if (text(input.title).length < 1 || text(input.title).length > 255) errors.title = 'Use a title between 1 and 255 characters.'
  if (text(input.body).length < 1 || text(input.body).length > 5000) errors.body = 'Use a message between 1 and 5,000 characters.'
  if (!['ALL', 'VIEWERS', 'CREATORS'].includes(input.audience)) errors.audience = 'Choose a valid audience.'
  return errors
}

export function normalizeUnreadCount(payload: unknown) {
  if (typeof payload === 'number') return Math.max(0, Math.floor(payload))
  if (payload && typeof payload === 'object' && typeof (payload as { count?: unknown }).count === 'number') {
    return Math.max(0, Math.floor((payload as { count: number }).count))
  }
  return 0
}

export const notifications = {
  list: (signal?: AbortSignal) => request<DurableNotification[]>('/api/notifications', { signal }),
  unreadCount: async (signal?: AbortSignal) => normalizeUnreadCount(await request<unknown>('/api/notifications/unread-count', { signal })),
  markRead: (id: number) => request<DurableNotification>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<void>('/api/notifications/read-all', { method: 'POST' }),
}

export const announcements = {
  published: (signal?: AbortSignal) => request<Announcement[]>('/api/announcements', { signal }),
  admin: {
    list: (signal?: AbortSignal) => request<Announcement[]>('/api/announcements/admin', { signal }),
    create: (input: AnnouncementInput) => {
      const errors = validateAnnouncement(input)
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
      return request<Announcement>('/api/announcements/admin', { method: 'POST', body: {
        title: text(input.title), body: text(input.body), audience: input.audience,
      } })
    },
    update: (id: number, input: AnnouncementInput) => {
      const errors = validateAnnouncement(input)
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
      return request<Announcement>(`/api/announcements/admin/${id}`, { method: 'PUT', body: {
        title: text(input.title), body: text(input.body), audience: input.audience,
      } })
    },
    publish: (id: number) => request<Announcement>(`/api/announcements/admin/${id}/publish`, { method: 'POST' }),
    archive: (id: number) => request<Announcement>(`/api/announcements/admin/${id}/archive`, { method: 'POST' }),
  },
}
