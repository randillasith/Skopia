// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
vi.mock('@/components/Shell', () => ({ useSession: () => ({ viewer: { userId: 42 } }), FrontOfHouse: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/lib/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing')>()
  return { ...actual, billing: { ...actual.billing, payments: vi.fn(), refunds: vi.fn(), refundEligibility: vi.fn(), requestRefund: vi.fn() } }
})
import { BillingHistory } from './billing'
import { billing, type RefundRequest } from '@/lib/billing'
let root: Root | undefined
let host: HTMLDivElement
let requests: RefundRequest[]
const payment = { id: 9, amount: 500, currency: 'LKR', paidDatetime: '2026-10-08T12:00:00', payMethod: 'DEMO_CARD', payStatus: 'SIMULATED_APPROVED', planName: 'MONTHLY' }
const pending: RefundRequest = { id: 10, paymentId: 9, subscriptionId: 3, planName: 'MONTHLY', amount: 500, currency: 'LKR', category: 'ACCIDENTAL_PURCHASE', simulation: true, eligibleUntil: null, reason: 'Purchased by mistake', status: 'PENDING', requestedAt: '2026-10-08T12:00:00', processedById: null, processedByUsername: null, processedByEmail: null, decidedAt: null, processingNote: null, username: 'viewer', email: 'viewer@example.test' }
async function mount() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => { root!.render(<MemoryRouter><BillingHistory /></MemoryRouter>) })
}
function button(label: string) { return [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label)! }
async function click(label: string) { await act(async () => { button(label).click() }) }
beforeEach(() => {
  requests = []
  vi.mocked(billing.payments).mockResolvedValue([payment])
  vi.mocked(billing.refunds).mockImplementation(async () => [...requests])
  vi.mocked(billing.refundEligibility).mockResolvedValue({ eligible: true, reason: 'ELIGIBLE', windowDays: 7 })
  vi.mocked(billing.requestRefund).mockImplementation(async () => { requests = [pending]; return pending })
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined; vi.clearAllMocks() })
describe('refundable simulated billing', () => {
  it('requests LKR 500, shows pending and queued email, then refreshes approval without repeat request', async () => {
    await mount()
    expect(host.textContent).toContain('LKR 500')
    await click('Request refund')
    const reason = document.querySelector('[role="dialog"] textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Purchased by mistake')
      reason.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('Submit request')
    expect(billing.requestRefund).toHaveBeenCalledWith(9, 'ACCIDENTAL_PURCHASE', 'Purchased by mistake', 42)
    expect(host.textContent).toContain('Refund pending')
    expect(host.textContent).toContain('Request confirmation queued')
    expect(button('Request refund')).toBeUndefined()
    requests = [{ ...pending, status: 'APPROVED' }]
    await click('Refresh')
    expect(host.textContent).toContain('Refund approved')
    expect(host.textContent).toContain('Refund amount: LKR 500')
    expect(host.textContent).toContain('Approval confirmation queued')
    expect(host.textContent).not.toMatch(/email delivered/i)
    expect(button('Request refund')).toBeUndefined()
    expect(button('Cancel request')).toBeUndefined()
  })
  it.each(['REJECTED', 'CANCELLED'])('shows terminal %s without another request even if eligibility is stale', async status => {
    requests = [{ ...pending, status }]
    await mount()
    expect(host.textContent).toContain(`Refund ${status.toLowerCase()}`)
    expect(button('Request refund')).toBeUndefined()
    expect(button('Cancel request')).toBeUndefined()
  })
  it('refreshes on focus and visibility without resetting an open request draft, and removes listeners', async () => {
    await mount(); await click('Request refund')
    const reason = document.querySelector('[role="dialog"] textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'My unfinished refund reason')
      reason.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const calls = vi.mocked(billing.refunds).mock.calls.length
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(billing.refunds).toHaveBeenCalledTimes(calls + 2)
    expect(document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')?.value).toBe('My unfinished refund reason')
    await act(async () => { root!.unmount() }); root = undefined
    const afterUnmount = vi.mocked(billing.refunds).mock.calls.length
    await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
    expect(billing.refunds).toHaveBeenCalledTimes(afterUnmount)
  })
})
