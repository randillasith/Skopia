// @vitest-environment jsdom
import indexHtml from '../../index.html?raw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, accounts } from '@/lib/accounts'
import { ResetPassword, ConfirmPasswordReset } from './auth'

vi.mock('@/lib/accounts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/accounts')>()
  return { ...original, accounts: { ...original.accounts,
    requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn(),
  } }
})
vi.mock('@/components/ThemeSelect', () => ({ ThemeSelect: () => <span>Theme</span> }))
vi.mock('@/lib/useCatalogue', () => ({ useCatalogue: () => ({ videos: [] }) }))
vi.mock('@/components/Shell', () => ({ Wordmark: () => <span>Skopia</span> }))

let host: HTMLDivElement
let root: Root | undefined
async function mount(page: React.ReactNode) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => { root!.render(<MemoryRouter>{page}</MemoryRouter>) })
}
async function type(label: string, value: string) {
  const field = [...host.querySelectorAll('label')].find((node) => node.textContent?.includes(label))?.querySelector('input')
  expect(field).toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit() {
  await act(async () => { host.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}
const pending = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const resetSlot = window as Window & { __skopiaResetToken?: string }
const inlineCapture = indexHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1]
function captureFromDocument() {
  expect(inlineCapture).toBeTruthy()
  window.eval(inlineCapture!)
}

beforeEach(() => {
  delete resetSlot.__skopiaResetToken
  vi.mocked(accounts.requestPasswordReset).mockReset()
  vi.mocked(accounts.confirmPasswordReset).mockReset()
  window.history.replaceState(null, '', '/reset')
})
afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  host?.remove()
  root = undefined
})

describe('password reset request', () => {
  it('does not claim an email was sent until the API succeeds, and prevents duplicate submits', async () => {
    const call = pending<void>()
    vi.mocked(accounts.requestPasswordReset).mockReturnValueOnce(call.promise)
    await mount(<ResetPassword />)
    await type('Email', ' viewer@example.com ')
    await submit()
    expect(accounts.requestPasswordReset).toHaveBeenCalledWith('viewer@example.com')
    expect(host.textContent).not.toContain('Check your inbox')
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
    await act(async () => { call.resolve() })
    expect(host.textContent).toContain('If the address is registered and delivery succeeds')
    expect(host.querySelector('form')).toBeNull()
  })
  it('keeps the form on failure without disclosing account existence', async () => {
    vi.mocked(accounts.requestPasswordReset).mockRejectedValueOnce(new ApiError(503, 'Account viewer@example.com not found'))
    await mount(<ResetPassword />)
    await type('Email', 'viewer@example.com')
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).not.toContain('viewer@example.com')
    expect(host.textContent).not.toContain('Check your inbox')
    expect(host.querySelector('form')).toBeTruthy()
  })
})

describe('password reset confirmation', () => {
  it('captures and scrubs in the first head script, before any external asset reference', () => {
    const head = indexHtml.split('<head>')[1].split('</head>')[0]
    expect(head.match(/<(?:script|link)\b[^>]*>/g)?.[0]).toBe('<script>')
    expect(head.indexOf('</script>')).toBeLessThan(head.indexOf('<link'))
    window.history.replaceState(null, '', '/reset/confirm#token=fragment-secret')
    captureFromDocument()
    expect(resetSlot.__skopiaResetToken).toBe('fragment-secret')
    expect(window.location.pathname).toBe('/reset/confirm')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    delete resetSlot.__skopiaResetToken
    window.history.replaceState(null, '', '/reset/confirm?token=unsafe-query-secret')
    captureFromDocument()
    expect(resetSlot.__skopiaResetToken).toBeNull()
    expect(window.location.href).not.toContain('unsafe-query-secret')
  })
  it('scrubs the URL before submitting a valid token, keeps it out of the request URL, and links to sign in on success', async () => {
    const token = 'sensitive-link-token'
    window.history.replaceState(null, '', `/reset/confirm#token=${token}`)
    captureFromDocument()
    expect(window.location.href).not.toContain(token)
    expect(resetSlot.__skopiaResetToken).toBe(token)
    const call = pending<void>()
    vi.mocked(accounts.confirmPasswordReset).mockReturnValueOnce(call.promise)
    await mount(<ConfirmPasswordReset />)
    expect(resetSlot.__skopiaResetToken).toBeUndefined()
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain(token)
    await type('New password', 'valid-password')
    await type('Confirm password', 'valid-password')
    await submit()
    expect(accounts.confirmPasswordReset).toHaveBeenCalledWith(token, 'valid-password')
    expect(host.textContent).not.toContain('Password updated')
    await act(async () => { call.resolve() })
    expect(host.textContent).toContain('Password updated')
    expect(host.querySelector('a[href="/login"]')).toBeTruthy()
    await act(async () => { root!.unmount() })
    root = undefined
    host.remove()
    await mount(<ConfirmPasswordReset />)
    expect(host.querySelector('form')).toBeNull()
  })
  it('rejects mismatch, short passwords and over 72 UTF-8 bytes before contacting the API', async () => {
    window.history.replaceState(null, '', '/reset/confirm#token=another-token')
    captureFromDocument()
    await mount(<ConfirmPasswordReset />)
    await type('New password', 'short')
    await type('Confirm password', 'different')
    await submit()
    expect(accounts.confirmPasswordReset).not.toHaveBeenCalled()
    await type('New password', 'é'.repeat(37))
    await type('Confirm password', 'é'.repeat(37))
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('72 UTF-8 bytes')
    expect(accounts.confirmPasswordReset).not.toHaveBeenCalled()
    await type('New password', 'valid-password')
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/match/i)
    expect(accounts.confirmPasswordReset).not.toHaveBeenCalled()
  })
  it('handles missing and used tokens without leaking a server error or showing false success', async () => {
    window.history.replaceState(null, '', '/reset/confirm')
    await mount(<ConfirmPasswordReset />)
    expect(host.querySelector('form')).toBeNull()
    expect(host.textContent).toMatch(/expired|invalid/i)
    await act(async () => { root!.unmount() })
    root = undefined
    host.remove()
    window.history.replaceState(null, '', '/reset/confirm#token=used-token')
    captureFromDocument()
    vi.mocked(accounts.confirmPasswordReset).mockRejectedValueOnce(new ApiError(410, 'used-token expired'))
    await mount(<ConfirmPasswordReset />)
    await type('New password', 'valid-password')
    await type('Confirm password', 'valid-password')
    await submit()
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/expired|used/i)
    expect(host.textContent).not.toContain('used-token')
    expect(host.textContent).not.toContain('Password updated')
  })
})
