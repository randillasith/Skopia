import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, readSession, writeSession } from './auth-storage'
import { request, submitForm, upload } from './api'
import { ads } from './ads'
import { accounts } from './accounts'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('authenticated API requests', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  it('persists and clears the signed token with its user id', () => {
    writeSession({ token: 'signed-token', userId: 42 })
    expect(readSession()).toEqual({ token: 'signed-token', userId: 42 })
    clearSession()
    expect(readSession()).toBeNull()
  })

  it('authenticates ad delivery and tracked clicks without exposing the token in URLs', async () => {
    writeSession({ token: 'signed-token', userId: 42 })
    await ads.serving.active(7, 'PREROLL')
    await ads.serving.click(9)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/ads/active?videoId=7&slot=PREROLL')
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/ads/click/9')
    expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe('POST')
    for (const [path, init] of vi.mocked(fetch).mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer signed-token' })
      expect(String(path)).not.toContain('signed-token')
      expect(String(path)).not.toContain('viewerId')
    }
  })

  it('adds bearer and legacy actor headers to JSON requests', async () => {
    writeSession({ token: 'signed-token', userId: 42 })
    await request('/api/videos/7', { method: 'POST', body: { title: 'x' }, actorId: 42 })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer signed-token',
      'Content-Type': 'application/json',
      'X-User-Id': '42',
    })
  })

  it('posts reset request and confirmation as JSON without putting the secret in the URL', async () => {
    writeSession({ token: 'signed-token', userId: 42 })
    await accounts.requestPasswordReset('viewer@example.com')
    await accounts.confirmPasswordReset('private-token', 'new-password')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/auth/password-reset/request')
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ email: 'viewer@example.com' }) })
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/auth/password-reset/confirm')
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ token: 'private-token', newPassword: 'new-password' }) })
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init?.headers).not.toHaveProperty('Authorization')
      expect(init?.referrerPolicy).toBe('no-referrer')
    }
    expect(readSession()).toEqual({ token: 'signed-token', userId: 42 })
  })

  it('downloads campaign CSV with authentication and the displayed inclusive date range', async () => {
    writeSession({ token: 'signed-token', userId: 42 })
    vi.mocked(fetch).mockResolvedValueOnce(new Response('day,impressions,clicks\n2026-10-08,2,1', {
      headers: { 'Content-Type': 'text/csv' },
    }))
    const csv = await ads.campaigns.csv(42, 7, '2026-10-01', '2026-10-08')
    expect(await csv.text()).toContain('2026-10-08,2,1')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/ad-campaigns/7/metrics.csv?from=2026-10-01&to=2026-10-08')
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer signed-token' })
  })

  it('requests every advertisement position with cancellation support', async () => {
    const controller = new AbortController()
    for (const slot of ['PREROLL', 'MIDROLL', 'POSTROLL', 'OVERLAY', 'LOBBY'] as const) {
      await ads.serving.active(7, slot, { signal: controller.signal })
      expect(vi.mocked(fetch).mock.lastCall?.[0]).toContain(`slot=${slot}`)
      expect(vi.mocked(fetch).mock.lastCall?.[1]?.signal).toBe(controller.signal)
    }
  })

  it('adds bearer headers to upload and multipart requests without setting content type', async () => {
    writeSession({ token: 'signed-token', userId: 42 })
    await upload('/api/advertisements/media', new File(['x'], 'x.png'), 42)
    await submitForm('/api/videos', new FormData(), 42)

    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer signed-token', 'X-User-Id': '42' })
      expect(init?.headers).not.toHaveProperty('Content-Type')
    }
  })
})
