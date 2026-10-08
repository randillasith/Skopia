import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billing, buildAdminRefundQuery, normalizePlans, validateBilling, validateRefundDecision, validateRefundReason, testCardNumber, validateTestCard } from './billing'
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

describe('no-charge test-card checkout', () => {
  const now = new Date(2026, 9, 8)
  it('accepts only the published Visa/Mastercard test numbers with valid future expiry', () => {
    for (const brand of ['VISA', 'MASTERCARD'] as const) {
      const number = testCardNumber(brand)
      expect(number).toHaveLength(16)
      expect(validateTestCard(number, '10/26', now)).toEqual({ brand })
      expect(validateTestCard(number, '10/26', new Date(2026, 9, 31, 23, 59, 59, 999))).toEqual({ brand })
      expect(validateTestCard(number, '11/26', new Date(2026, 9, 31, 23, 59, 59, 999))).toEqual({ brand })
      expect(validateTestCard(number, '09/26', now)).toHaveProperty('error')
      expect(validateTestCard(number, '13/27', now)).toHaveProperty('error')
      expect(validateTestCard(number, '1/27', now)).toHaveProperty('error')
      expect(validateTestCard(number.slice(0, -1) + (number.at(-1) === '0' ? '1' : '0'), '11/26', now)).toHaveProperty('error')
      expect(validateTestCard(number.slice(0, -2) + '01', '11/26', now)).toHaveProperty('error')
    }
    expect(validateTestCard('4' + '2'.repeat(15), '12/27', now)).toHaveProperty('error')
    expect(validateTestCard('3' + '4'.repeat(14), '12/27', now)).toHaveProperty('error')
  })
  it('rejects card-like contact text locally without blocking an ordinary phone', () => {
    const contact = { fullName: 'Test User', email: 'user@example.test', phone: '0771234567', addressLine1: 'Street', addressLine2: '', city: 'Colombo', postalCode: '00100', country: 'LK' as const }
    const testNumber = '4' + '1'.repeat(15)
    const grouped = 'Sample ' + ['4111', '1111', '1111', '1111'].join('-') + ' detail'
    expect(validateBilling(contact)).toEqual({})
    for (const field of ['fullName', 'addressLine1', 'addressLine2', 'city', 'postalCode'] as const) {
      expect(validateBilling({ ...contact, [field]: grouped })[field]).toBeTruthy()
    }
    expect(validateBilling({ ...contact, email: `user${testNumber}@example.test` }).email).toBeTruthy()
    expect(validateBilling({ ...contact, phone: testNumber }).phone).toBeTruthy()
    expect(validateBilling({ ...contact, addressLine1: 'Unit ' + '4' + '2'.repeat(12) }).addressLine1).toBeTruthy()
    expect(validateBilling({ ...contact, addressLine1: 'Unit ' + '4' + '0'.repeat(17) + '6' }).addressLine1).toBeTruthy()
    expect(validateBilling({ ...contact, addressLine1: 'Unit ' + '4' + '1'.repeat(14) + '2' })).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })
  it('sends only derived brand and contact, never card input or expiration', async () => {
    const contact = { fullName: 'Test User', email: 'user@example.test', phone: '0771234567', addressLine1: 'Street', addressLine2: '', city: 'Colombo', postalCode: '00100', country: 'LK' as const }
    await billing.noChargeCard(testCardNumber('VISA'), '11/27', contact, 7, now)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/billing/orders/no-charge-card')
    expect(JSON.parse(String(init?.body))).toEqual({ planName: 'MONTHLY', brand: 'VISA', billing: contact })
    expect(() => billing.noChargeCard('4' + '2'.repeat(15), '11/27', contact, 7, now)).toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
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
