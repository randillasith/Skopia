import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billing, buildAdminRefundQuery, normalizePlans, validateRefundDecision, validateRefundReason } from './billing'
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



  it('edits a comment with PUT and a text-only body', async () => {
    await catalogue.editComment(12, 'Updated text', 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/comments/12')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual({ text: 'Updated text' })
    expect(init?.headers).toMatchObject({ 'X-User-Id': '7' })
  })


  it('does not enable checkout if the gate is missing', () => {
    expect(normalizePlans({ plans: [], demoEnabled: false }).demoEnabled).toBe(false)
  })

  it('posts cancellation with signed identity', async () => {
    await billing.cancel(7)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/billing/cancel')
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('POST')
  })

  it('validates and normalizes categorized refund requests before sending', async () => {
    expect(validateRefundReason('too short')).toBeTruthy()
    expect(validateRefundReason('  A clear reason for this request.  ')).toBeNull()
    await billing.requestRefund(12, 'ACCIDENTAL_PURCHASE', '  Duplicate demo purchase   made by mistake. ', 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/billing/payments/12/refunds')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ category: 'ACCIDENTAL_PURCHASE', reason: 'Duplicate demo purchase made by mistake.' })
  })

  it('uses eligibility, cancellation and history contracts', async () => {
    await billing.refundEligibility(12, 7)
    await billing.cancelRefund(9, 7)
    await billing.refundHistory(9, 7)
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([path]) => path)).toEqual([
      '/api/billing/payments/12/refund-eligibility',
      '/api/billing/refunds/9/cancel',
      '/api/billing/refunds/9/history',
    ])
    expect(calls[1][1]?.method).toBe('POST')
    expect(calls[0][1]?.headers).toMatchObject({ 'X-User-Id': '7' })
  })

  it('builds filtered paginated admin requests and reads pending counts', async () => {
    expect(buildAdminRefundQuery({ status: 'PENDING', category: 'TECHNICAL_ISSUE', q: '  ada viewer ', page: 2, size: 25 }))
      .toBe('status=PENDING&category=TECHNICAL_ISSUE&q=ada+viewer&page=2&size=25')
    await billing.adminRefunds({ status: 'PENDING', category: 'TECHNICAL_ISSUE', q: 'ada', page: 0, size: 25 })
    await billing.pendingRefundCount()
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/billing/admin/refunds?status=PENDING&category=TECHNICAL_ISSUE&q=ada&page=0&size=25')
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/billing/admin/refunds/pending-count')
  })

  it('requires a rejection note before sending a decision', async () => {
    expect(validateRefundDecision('APPROVED', '')).toBeNull()
    expect(validateRefundDecision('REJECTED', '   ')).toContain('required')
    await expect(billing.decideRefund(9, 'REJECTED', '   ')).rejects.toThrow('required')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('downloads the CSV export with active filters', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('id,status\n9,REJECTED', { headers: { 'Content-Type': 'text/csv' } })))
    const blob = await billing.exportRefunds({ status: 'REJECTED', category: '', q: 'ada', page: 0, size: 25 })
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/billing/admin/refunds/export.csv?status=REJECTED&q=ada')
    expect(await blob.text()).toContain('REJECTED')
  })

  it('uses the admin refund decision contract', async () => {
    await billing.decideRefund(9, 'REJECTED', ' Outside policy. ')
    const calls = vi.mocked(fetch).mock.calls
    expect(calls[0][0]).toBe('/api/billing/admin/refunds/9/decision')
    expect(calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ decision: 'REJECTED', note: 'Outside policy.' })
  })
})
