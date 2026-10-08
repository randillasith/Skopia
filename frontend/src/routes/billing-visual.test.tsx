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
    complimentary: vi.fn().mockResolvedValue({ id: 2, status: 'NO_CHARGE_ACTIVE' }),
    orders: vi.fn().mockResolvedValue([{ id: 1, planName: 'MONTHLY', method: 'COMPLIMENTARY', status: 'NO_CHARGE_ACTIVE' }]),
  } }
})
import { Plans, Checkout, CheckoutResult, Subscription } from './billing'
import { billing } from '@/lib/billing'

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
afterEach(async () => { if (root) await act(async () => { root!.unmount() }); host?.remove(); root = undefined })

describe('subscription visual flow', () => {
  it('offers a filled, prominent plans CTA and a single truthful notice', async () => {
    await mount(<Plans />)
    const cta = host.querySelector<HTMLAnchorElement>('a[href="/checkout?plan=MONTHLY"]')!
    expect(cta).toBeTruthy()
    expect(cta.className).toMatch(/bg-violet-500/)
    expect(cta.className).not.toMatch(/underline/)
    expect(host.textContent).toContain('LKR 500')
    expect(host.textContent).toContain('LKR 0')
    expect(host.textContent).not.toMatch(/test card/i)
  })
  it('collects billing contact without card inputs and activates at zero due', async () => {
    await mount(<Checkout />, '/checkout?plan=MONTHLY')
    expect(host.textContent).toContain('LKR 500')
    expect(host.textContent).toContain('LKR 0')
    expect(host.querySelector('input[name*="card"], input[name*="expir"], [data-card-face]')).toBeNull()
    expect(host.textContent).not.toMatch(/test card/i)
    const values = { fullName: 'Test User', email: 'test@example.test', phone: '0771234567', addressLine1: 'Street', city: 'Colombo', postalCode: '00100' }
    for (const [key, value] of Object.entries(values)) await type(input(key), value)
    await click(host.querySelector<HTMLButtonElement>('button[type="submit"]')!)
    expect(billing.complimentary).toHaveBeenCalledWith(expect.objectContaining(values), 42)
  })
  it('shows a styled activation result with an obvious subscription action', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host)
    await act(async () => { root!.render(<MemoryRouter initialEntries={[{ pathname: '/checkout/result', state: { order: { id: 1, method: 'COMPLIMENTARY', status: 'NO_CHARGE_ACTIVE', amount: 0 } } }]}><CheckoutResult /></MemoryRouter>) })
    expect(host.textContent).toContain('LKR 0')
    expect(host.querySelector<HTMLElement>('[data-activation-result]')).toBeTruthy()
    const action = host.querySelector<HTMLAnchorElement>('a[href="/subscription"]')!
    expect(action.className).toMatch(/bg-violet-500/)
  })
  it('presents subscription status and order details as matching cards', async () => {
    await mount(<Subscription />, '/subscription')
    expect(host.textContent).toContain('Premium access active')
    expect(host.querySelector<HTMLElement>('[data-subscription-summary]')).toBeTruthy()
    expect(host.querySelector<HTMLElement>('[data-subscription-order]')).toBeTruthy()
  })
})
