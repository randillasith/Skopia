import { beforeEach, describe, expect, it, vi } from 'vitest'
import { administration, profile, rowToAccount, type ServerUserRow } from './accounts'
import { writeSession } from './auth-storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('secure user API contracts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    writeSession({ token: 'admin-token', userId: 1 })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  it('uses admin list, stats, logs, and status endpoints', async () => {
    await administration.users()
    await administration.stats()
    await administration.activityLogs()
    await administration.setStatus(9, 'SUSPENDED', 'Policy review')
    await administration.setCreatorVerified(9, true)
    await administration.moderateVideo(7, 'ARCHIVED', 'Policy review')

    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/api/admin/users',
      '/api/admin/users/stats',
      '/api/admin/users/activity-logs',
      '/api/admin/users/9/status',
      '/api/admin/users/9/creator-verification',
      '/api/admin/videos/7/status',
    ])
    expect(vi.mocked(fetch).mock.calls[3][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'SUSPENDED', reason: 'Policy review' }),
    })
  })

  it('maps the explicit roleType before subclass detail fields', () => {
    const row = {
      id: 8,
      username: 'support_user',
      email: 'support@example.test',
      firstName: 'Support',
      lastName: 'User',
      accountStatus: 'ACTIVE',
      registeredDate: '2026-09-01T00:00:00',
      roleType: 'SUPPORT_OFFICER',
    } satisfies ServerUserRow
    expect(rowToAccount(row).staff).toEqual(['support'])
  })

  it('uses principal-derived self-service profile endpoints', async () => {
    await profile.update({ displayName: 'Changed' })
    await profile.close()
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/api/users/me/profile',
      '/api/users/me',
    ])
  })
})