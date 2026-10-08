// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/Shell', () => ({
  useSession: () => ({ viewer: { userId: 42 }, refreshAccount: vi.fn() }),
  FrontOfHouse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/lib/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing')>()
  return { ...actual, billing: { ...actual.billing,
    plans: vi.fn().mockResolvedValue({ previewMode: true, demoEnabled: true, currency: 'LKR', plans: [{ id: 1, planName: 'MONTHLY', durationDays: 30, price: 500, adFree: true, benefit: '30 days of access' }] }),
    status: vi.fn().mockResolvedValue({ premium: true, adFree: true, planName: 'MONTHLY', status: 'ACTIVE', startDate: '2026-10-08T12:00:00', endDate: '2026-11-07T12:00:00' }),
    demoCard: vi.fn().mockResolvedValue({ id: 2, status: 'NO_CHARGE_ACTIVE' }),
    orders: vi.fn().mockResolvedValue([{ id: 1, planName: 'MONTHLY', method: 'COMPLIMENTARY', status: 'NO_CHARGE_ACTIVE' }]),
  } }
})
import { Plans, Checkout, CheckoutResult, Subscription } from './billing'
import { billing } from '@/lib/billing'
import { ApiError } from '@/lib/api'

let root: Root | undefined
let host: HTMLDivElement
async function mount(node: React.ReactNode, url = '/plans') {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => { root!.render(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>) })
  return host
}
function input(name: string) { return host.querySelector<HTMLInputElement>(`input[name="${name}"]`)! }
async function click(button: HTMLElement) { await act(async () => { button.click() }) }
async function type(element: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
afterEach(async () => { if (root) await act(async () => { root!.unmount() }); host?.remove(); root = undefined; vi.clearAllMocks() })

describe('subscription visual flow', () => {
  it('requires test-card number and expiry for the Rs 500 demo checkout', async () => {
    await mount(<Checkout />, '/checkout?plan=MONTHLY')
    expect(input('testCardNumber')).toBeTruthy()
    expect(input('testCardExpiry')).toBeTruthy()
    expect(host.textContent).toContain('Demo')
    expect(host.textContent).toContain('LKR 500')
    expect(host.querySelector('input[name="cvv"]')).toBeNull()
  })
  it('blocks missing or arbitrary cards and focuses the invalid field', async () => {
    await mount(<Checkout />, '/checkout?plan=MONTHLY')
    await click(host.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    expect(billing.demoCard).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(input('testCardNumber'))
    expect(input('testCardNumber').getAttribute('aria-invalid')).toBe('true')
    await type(input('testCardNumber'), '4'.repeat(16))
    expect(host.querySelector('[data-demo-face="front"]')?.textContent).not.toContain('4444 4444')
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Mastercard')!)
    expect(host.querySelector('[data-demo-face="front"]')?.textContent).toContain('Mastercard')
    await click([...host.querySelectorAll('button')].find(b => b.textContent?.includes('Show card back'))!)
    expect(host.querySelector('[data-demo-face="front"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(host.querySelector('[data-demo-face="back"]')?.getAttribute('aria-hidden')).toBe('false')
  })
  it('offers a filled, prominent plans CTA and a single truthful notice', async () => {
    await mount(<Plans />)
    const cta = host.querySelector<HTMLAnchorElement>('a[href="/checkout?plan=MONTHLY"]')!
    expect(cta).toBeTruthy()
    expect(cta.className).toMatch(/bg-violet-500/)
    expect(cta.className).not.toMatch(/underline/)
    expect(host.textContent).toContain('LKR 500')
    expect(host.textContent).toContain('LKR 0')
    expect(host.textContent).toContain('test cards')
  })
  it('requires synthetic details and submits only derived brand and contact', async () => {
    await mount(<Checkout />, '/checkout?plan=MONTHLY')
    expect(host.textContent).toContain('LKR 500')
    expect(host.textContent).toContain('LKR 0')
    expect(host.querySelector('[data-demo-face]')).toBeTruthy()
    expect(host.textContent).toContain('test cards')
    const values = { fullName: 'Test User', email: 'test@example.test', phone: '0771234567', addressLine1: 'Street', city: 'Colombo', postalCode: '00100' }
    for (const [key, value] of Object.entries(values)) await type(input(key), value)
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Visa')!)
    await click(host.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    expect(billing.demoCard).toHaveBeenCalledWith(expect.objectContaining(values), 'VISA', 42)
  })
  it('explains an existing-pass conflict and links to the active subscription', async () => {
    vi.mocked(billing.demoCard).mockRejectedValueOnce(new ApiError(409, 'The request failed (409).'))
    await mount(<Checkout />, '/checkout?plan=MONTHLY')
    const values = { fullName: 'Test User', email: 'test@example.test', phone: '0771234567', addressLine1: 'Street', city: 'Colombo', postalCode: '00100' }
    for (const [key, value] of Object.entries(values)) await type(input(key), value)
    await click([...host.querySelectorAll('button')].find(b => b.textContent === 'Visa')!)
    await click(host.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('You already have an active pass.')
    expect(host.textContent).not.toContain('The request failed (409).')
    expect(host.querySelector<HTMLAnchorElement>('a[href="/subscription"]')?.textContent).toContain('View your active subscription')
  })
  it('shows a styled activation result with an obvious subscription action', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host)
    await act(async () => { root!.render(<MemoryRouter initialEntries={[{ pathname: '/checkout/result', state: { order: { id: 1, method: 'COMPLIMENTARY', status: 'NO_CHARGE_ACTIVE', amount: 0 } } }]}><CheckoutResult /></MemoryRouter>) })
    expect(host.textContent).toContain('Subscription activated')
    expect(host.textContent).toContain('LKR 500')
    expect(host.textContent).toContain('LKR 0')
    expect(host.textContent).toContain('Confirmation queued')
    expect(host.textContent).not.toMatch(/NO_CHARGE_ACTIVE|payment successful|email delivered/i)
    expect(host.querySelector<HTMLElement>('[data-activation-result]')).toBeTruthy()
    const action = host.querySelector<HTMLAnchorElement>('a[href="/subscription"]')!
    expect(action.className).toMatch(/bg-violet-500/)
  })
  it('presents subscription status and order details as matching cards', async () => {
    await mount(<Subscription />, '/subscription')
    expect(host.textContent).toContain('Premium access active')
    expect(host.querySelector<HTMLElement>('[data-subscription-summary]')).toBeTruthy()
    expect(host.querySelector<HTMLElement>('[data-subscription-order]')).toBeTruthy()
    expect(host.textContent).toContain('Monthly pass')
    expect(host.textContent).toContain('Complimentary activation')
    expect(host.textContent).not.toMatch(/NO CHARGE ACTIVE|SIMULATED APPROVED|MONTHLY/)
    expect(host.querySelector('details')?.open).toBe(false)
    const history = host.querySelector<HTMLAnchorElement>('a[href="/billing"]')!
    expect(history.className).toContain('billing-action')
    expect(history.className).not.toContain('underline')
    expect(host.textContent).toContain('Canceling ends access immediately')
  })
  it('uses a decorative membership pass without collecting payment credentials', async () => {
    for (const node of [<Plans key="plans" />, <Subscription key="subscription" />]) {
      await mount(node, '/checkout?plan=MONTHLY')
      const pass = host.querySelector('[data-membership-pass]')!
      expect(pass.textContent).toContain('Membership pass')
      expect(pass.textContent).toContain('30-day access')
      expect(pass.textContent).toContain('not a payment card')
      expect(pass.querySelector('.membership-chip')?.getAttribute('aria-hidden')).toBe('true')
      expect(host.querySelector('input[name*="card"], input[name*="expir"], input[name*="cvv"], input[name*="pan"]')).toBeNull()
      await act(async () => { root!.unmount() }); host.remove(); root = undefined
    }
  })
  it('does not treat successful historical orders as current entitlement', async () => {
    vi.mocked(billing.status).mockResolvedValueOnce({ premium: false, adFree: false, planName: null, status: 'CANCELLED', startDate: null, endDate: null })
    vi.mocked(billing.orders).mockResolvedValueOnce([
      { id: 7, planName: 'MONTHLY', method: 'COMPLIMENTARY', status: 'NO_CHARGE_ACTIVE', amount: 0, currency: 'LKR', reference: 'PASS-7', submittedAt: '2026-10-01T10:00:00' },
      { id: 3, planName: 'MONTHLY', method: 'TEST_CARD', status: 'SIMULATED_APPROVED', amount: 500, reference: 'PREVIEW-3' },
      { id: 2, planName: 'MONTHLY', method: 'BANK_TRANSFER', status: 'PENDING_REVIEW' },
    ])
    await mount(<Subscription />, '/subscription')
    expect(host.querySelector('[data-subscription-summary]')?.textContent).toContain('No active premium pass')
    expect(host.querySelector('[data-subscription-summary]')?.textContent).not.toContain('Premium access active')
    expect(host.querySelector('a[href="/plans"]')).toBeTruthy()
    expect(host.querySelector('a[href="/browse"]')).toBeNull()
    expect(host.textContent).toContain('Previous preview')
    expect(host.textContent).toContain('Awaiting review')
    expect(host.textContent).toContain('Recorded amount (simulated)')
    expect(host.textContent).toContain('PASS-7')
    expect(host.textContent).toContain('PREVIEW-3')
    expect(host.textContent).not.toContain('SIMULATED_APPROVED')
    expect(host.querySelector('.billing-history summary')?.textContent).toContain('3 records')
    await click(host.querySelector('summary')!)
    expect(host.querySelector('details')?.open).toBe(true)
  })
  it('never announces subscription activation for a simulated result', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host)
    await act(async () => { root!.render(<MemoryRouter initialEntries={[{ pathname: '/checkout/result', state: { order: { id: 3, method: 'TEST_CARD', status: 'SIMULATED_APPROVED', amount: 500 } } }]}><CheckoutResult /></MemoryRouter>) })
    expect(host.textContent).not.toContain('Subscription activated')
    expect(host.textContent).toContain('Previous preview')
    expect(host.textContent).toContain('not a payment')
  })
})
