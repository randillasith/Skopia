import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, readSession, writeSession } from './auth-storage'
import { request, submitForm, upload } from './api'

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