import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, readSession, writeSession } from './auth-storage'
import { request, submitForm, upload } from './api'
import { ads } from './ads'

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
