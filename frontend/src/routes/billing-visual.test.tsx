// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { testCardNumber } from '@/lib/billing'

vi.mock('@/components/Shell', () => ({
  useSession: () => ({ viewer: { userId: 42 }, refreshAccount: vi.fn() }),
  FrontOfHouse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/lib/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing')>()
  return { ...actual, billing: { ...actual.billing,
    plans: vi.fn().mockResolvedValue({ previewMode: true, demoEnabled: true, currency: 'LKR', plans: [{ id: 1, planName: 'MONTHLY', durationDays: 30, price: 990, adFree: true, benefit: 'Test-only preview, one-time access' }] }),
    status: vi.fn().mockResolvedValue({ premium: true, adFree: true, planName: 'MONTHLY', status: 'ACTIVE', startDate: '2026-10-08T12:00:00', endDate: '2026-11-07T12:00:00' }),
    orders: vi.fn().mockResolvedValue([{ id: 1, planName: 'MONTHLY', method: 'NO_CHARGE_TEST_CARD', status: 'NO_CHARGE_ACTIVE' }]),
  } }
})
import { Plans, Checkout, CheckoutResult, Subscription } from './billing'

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
    expect(host.textContent).toContain('No charge · test cards only · no payment')
    expect(host.textContent?.match(/No charge · test cards only · no payment/g)).toHaveLength(1)
    expect(host.textContent).not.toContain('Test-only preview')
  })
  it('previews only exact published synthetic numbers and flips by keyboard-operable button without a CVV input', async () => {
    await mount(<Checkout />, '/checkout?plan=MONTHLY')
    expect(host.textContent).toContain('No charge · test cards only · no payment')
    const front = host.querySelector<HTMLElement>('[data-card-face="front"]')!
    const back = host.querySelector<HTMLElement>('[data-card-face="back"]')!
    expect(front).toBeTruthy()
    expect(back).toBeTruthy()
    const number = testCardNumber('VISA')
    expect(front.textContent).not.toContain(number)
    expect(host.textContent).not.toContain(number)
    await type(input('test-card-number'), number)
    await type(input('test-card-expiry'), '12/28')
    expect(front.textContent).toContain(number.match(/.{1,4}/g)!.join(' '))
    expect(front.textContent).toContain('12/28')
    const flip = host.querySelector<HTMLButtonElement>('button[aria-label="Show back of test card"]')!
    expect(flip?.type).toBe('button')
    flip.focus()
    expect(document.activeElement).toBe(flip)
    await click(flip)
    expect(flip.getAttribute('aria-pressed')).toBe('true')
    expect(back.textContent).toMatch(/•••/)
    expect(host.querySelector('input[name*="cvv"], input[name*="cvc"], input[name*="security"]')).toBeNull()
    expect(host.querySelector('button[aria-label="Show front of test card"]')).toBeTruthy()
    await type(input('test-card-number'), number.slice(0, -1) + '0')
    expect(front.textContent).not.toContain(number.match(/.{1,4}/g)!.join(' '))
    expect(front.textContent).toContain('••••')
  })
  it('shows a styled activation result with an obvious subscription action', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host)
    await act(async () => { root!.render(<MemoryRouter initialEntries={[{ pathname: '/checkout/result', state: { order: { id: 1, status: 'NO_CHARGE_ACTIVE' } } }]}><CheckoutResult /></MemoryRouter>) })
    expect(host.textContent).toContain('No payment was processed')
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
