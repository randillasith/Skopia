import { beforeEach, describe, expect, it, vi } from 'vitest'
import { announcements, normalizeUnreadCount, notifications, validateAnnouncement } from './notifications'
import { writeSession } from './auth-storage'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
  writeSession({ userId: 8, token: 'signed' })
})

describe('notifications and announcements clients', () => {
  it('normalizes unread count responses defensively', () => {
    expect(normalizeUnreadCount({ count: 4 })).toBe(4)
    expect(normalizeUnreadCount(2.8)).toBe(2)
    expect(normalizeUnreadCount({ count: -3 })).toBe(0)
    expect(normalizeUnreadCount({ unread: 9 })).toBe(0)
  })

  it('uses durable notification routes', async () => {
    vi.mocked(fetch).mockImplementation(async (path) => new Response(path === '/api/notifications/unread-count' ? '{"count":3}' : '{}'))
    await notifications.unreadCount()
    await notifications.markRead(14)
    await notifications.markAllRead()
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([path]) => path)).toEqual(['/api/notifications/unread-count', '/api/notifications/14/read', '/api/notifications/read-all'])
    expect(calls[1][1]?.method).toBe('POST')
    expect(calls[2][1]?.method).toBe('POST')
  })

  it('normalizes and sends an announcement draft to the backend contract', async () => {
    await announcements.admin.create({ title: '  Service window  ', body: '  Playback will pause briefly.  ', audience: 'VIEWERS' })
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/announcements/admin')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ title: 'Service window', body: 'Playback will pause briefly.', audience: 'VIEWERS' })
  })

  it('validates announcement limits and audience before sending', async () => {
    expect(() => announcements.admin.create({ title: '   ', body: '', audience: 'ALL' })).toThrow()
    expect(validateAnnouncement({ title: 'Valid title', body: 'A useful platform message.', audience: 'STAFF' as 'ALL' }).audience).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
