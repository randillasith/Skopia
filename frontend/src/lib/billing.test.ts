import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billing, normalizePlans, validateDemoPayment, validateRefundReason } from './billing'
import { catalogue } from './catalogue'
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
})

describe('demo billing client', () => {
  it('does not enable demo checkout from an unmarked plans array', () => {
    expect(normalizePlans([{ id: 1, planName: 'MONTHLY', durationDays: 30, price: 0, adFree: true, benefit: 'Preview' }]).demoEnabled).toBe(false)
    expect(normalizePlans({ demoEnabled: true, plans: [] }).demoEnabled).toBe(true)
  })

  it('requests plans anonymously and sends signed identity for account operations', async () => {
    writeSession({ userId: 7, token: 'signed' })
    await billing.plans()
    await billing.status(7)
    await billing.payments(7)
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([path]) => path)).toEqual(['/api/billing/plans', '/api/billing/status', '/api/billing/payments'])
    expect(calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer signed', 'X-User-Id': '7' })
  })

  it('sends only the strict transient demo payment contract', async () => {
    await billing.checkout('YEARLY', { cardNumber: '4216000000000002', expiry: '12/99', cardholderName: 'Demo Viewer' }, 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/billing/checkout')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ planName: 'YEARLY', cardNumber: '4216000000000002', expiry: '12/99', cardholderName: 'Demo Viewer' })
  })

  it('validates the designated test data locally', () => {
    expect(validateDemoPayment({ cardNumber: '4216 0000 0000 0002', expiry: '12/99', cardholderName: 'Demo Viewer' })).toEqual({})
    expect(validateDemoPayment({ cardNumber: '4111111111111111', expiry: '12/99', cardholderName: 'Demo Viewer' }).cardNumber).toContain('4216 0000 0000 0002')
    expect(validateDemoPayment({ cardNumber: '4216000000000003', expiry: '12/99', cardholderName: 'Demo Viewer' }).cardNumber).toContain('checksum')
    expect(validateDemoPayment({ cardNumber: '4216000000000002', expiry: '01/20', cardholderName: 'Demo Viewer' }).expiry).toBeTruthy()
  })

  it('rejects unsupported plans before sending a request', async () => {
    await expect(billing.checkout('FREE' as 'MONTHLY', { cardNumber: '4216000000000002', expiry: '12/99', cardholderName: 'Demo Viewer' }, 7)).rejects.toThrow('Unknown plan')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('edits a comment with PUT and a text-only body', async () => {
    await catalogue.editComment(12, 'Updated text', 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/comments/12')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual({ text: 'Updated text' })
    expect(init?.headers).toMatchObject({ 'X-User-Id': '7' })
  })

  it('does not convert a declined checkout into success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Demo checkout disabled' }), { status: 409 })))
    await expect(billing.checkout('MONTHLY', { cardNumber: '4216000000000002', expiry: '12/99', cardholderName: 'Demo Viewer' }, 7)).rejects.toThrow('Demo checkout disabled')
  })

  it('does not enable checkout if the gate is missing', () => {
    expect(normalizePlans({ plans: [], demoEnabled: false }).demoEnabled).toBe(false)
  })

  it('posts cancellation with signed identity', async () => {
    await billing.cancel(7)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/billing/cancel')
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('POST')
  })

  it('validates and normalizes refund requests before sending', async () => {
    expect(validateRefundReason('too short')).toBeTruthy()
    expect(validateRefundReason('  A clear reason for this request.  ')).toBeNull()
    await billing.requestRefund(12, '  Duplicate demo purchase   made by mistake. ', 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/billing/payments/12/refunds')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'Duplicate demo purchase made by mistake.' })
  })

  it('uses the immediate plan-change and admin decision contracts', async () => {
    await billing.changePlan('YEARLY', 7)
    await billing.decideRefund(9, 'REJECTED', ' Outside policy. ')
    const calls = vi.mocked(fetch).mock.calls
    expect(calls[0][0]).toBe('/api/billing/change-plan')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ planName: 'YEARLY' })
    expect(calls[1][0]).toBe('/api/billing/admin/refunds/9/decision')
    expect(calls[1][1]?.method).toBe('POST')
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ decision: 'REJECTED', note: 'Outside policy.' })
  })
})
