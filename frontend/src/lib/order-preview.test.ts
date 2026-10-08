import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billing, monthlyPreviewPlan, normalizePlans, reviewableOrders, validateBilling, validateSlip, type BillingContact } from './billing'
import { writeSession } from './auth-storage'

const contact: BillingContact = { fullName: 'Ada Viewer', email: 'ada@example.com', phone: '+94771234567', addressLine1: '12 Main St', addressLine2: '', city: 'Colombo', postalCode: '00100', country: 'LK' }
const storage = new Map<string, string>()
beforeEach(() => { storage.clear(); vi.stubGlobal('fetch', vi.fn(async () => new Response('{}'))); vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) }); writeSession({ userId: 7, token: 'signed' }) })
describe('safe subscription preview', () => {
  it('validates contact details and rejects missing or invalid fields', () => {
    expect(validateBilling(contact)).toEqual({})
    expect(validateBilling({ ...contact, fullName: ' ', email: 'bad', phone: '12', addressLine1: '', city: '', postalCode: '', country: 'US' as 'LK' })).toMatchObject({ fullName: expect.any(String), email: expect.any(String), phone: expect.any(String), addressLine1: expect.any(String), city: expect.any(String), postalCode: expect.any(String), country: expect.any(String) })
  })
  it('gates preview checkout on an explicit server flag', () => {
    expect(normalizePlans({ plans: [], previewMode: true, currency: 'LKR', demoEnabled: false }).previewMode).toBe(true)
    expect(normalizePlans({ plans: [], demoEnabled: true }).previewMode).toBe(false)
  })
  it('shows only monthly and limits admin decisions to submitted bank samples', () => {
    const yearly = { id: 2, planName: 'YEARLY', durationDays: 365, price: 5000, adFree: true, benefit: null }
    const monthly = { ...yearly, id: 1, planName: 'MONTHLY', durationDays: 30, price: 500 }
    expect(monthlyPreviewPlan({ previewMode: true, demoEnabled: false, currency: 'LKR', plans: [yearly, monthly] })).toEqual(monthly)
    expect(reviewableOrders([{ id: 1, planName: 'MONTHLY', status: 'PENDING_REVIEW' }, { id: 2, planName: 'MONTHLY', status: 'APPROVED' }, { id: 3, planName: 'MONTHLY', status: 'SUBMITTED' }]).map((order) => order.id)).toEqual([1, 3])
  })
  it('posts only brand and billing, never card credentials', async () => {
    await billing.cardPreview('MASTERCARD', contact, 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/billing/orders/card-preview')
    expect(JSON.parse(String(init?.body))).toEqual({ planName: 'MONTHLY', brand: 'MASTERCARD', billing: contact })
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer signed' })
  })
  it('rejects unsupported brands and never sends an invalid request', async () => {
    expect(() => billing.cardPreview('OTHER' as 'VISA', contact, 7)).toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not turn a server refusal into a successful preview', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Preview unavailable' }), { status: 409 })))
    await expect(billing.cardPreview('VISA', contact, 7)).rejects.toThrow('Preview unavailable')
  })
  it('validates slip type and size, then uploads billing and reference without setting multipart Content-Type', async () => {
    const slip = new File(['preview'], 'sample.pdf', { type: 'application/pdf' })
    expect(validateSlip(slip)).toBeNull()
    expect(validateSlip(new File(['x'], 'bad.txt', { type: 'text/plain' }))).toBeTruthy()
    expect(validateSlip(new File(['x'], 'sample.webp', { type: 'image/webp' }))).toBeTruthy()
    expect(validateSlip(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }))).toBeTruthy()
    expect(() => billing.bankTransfer(contact, '', new File(['bad'], 'bad.txt', { type: 'text/plain' }), 7)).toThrow()
    expect(fetch).not.toHaveBeenCalled()
    await billing.bankTransfer(contact, ' SAMPLE-1 ', slip, 7)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/billing/orders/bank-transfer')
    expect(init?.headers).not.toHaveProperty('Content-Type')
    const form = init?.body as FormData
    expect(form.get('planName')).toBe('MONTHLY')
    expect(JSON.parse(String(form.get('billing')))).toEqual(contact)
    expect(form.get('reference')).toBe('SAMPLE-1')
    expect(form.get('slip')).toBe(slip)
  })
  it('reads orders and private admin slips and posts decisions with a rejection note', async () => {
    await billing.orders(7); await billing.adminOrders(); await billing.adminSlip(12)
    await billing.decideOrder(12, 'REJECTED', 'Not a valid sample')
    expect(vi.mocked(fetch).mock.calls.map(([path]) => path)).toEqual(['/api/billing/orders', '/api/billing/admin/orders', '/api/billing/admin/orders/12/slip', '/api/billing/admin/orders/12/decision'])
    expect(vi.mocked(fetch).mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer signed' })
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[3][1]?.body))).toEqual({ decision: 'REJECTED', note: 'Not a valid sample' })
    vi.mocked(fetch).mockClear()
    expect(() => billing.decideOrder(12, 'REJECTED', '')).toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
