import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/Shell', () => ({
  useSession: () => ({ viewer: { name: 'Test Viewer', handle: 'testviewer', userId: 42 } }),
  FrontOfHouse: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  BackOfHouse: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import { ChannelSettings, CreateChannel } from './studio'

describe('channel creation route', () => {
  it('makes no creation promise or write action until a safe server conversion exists', () => {
    const html = renderToStaticMarkup(<MemoryRouter><CreateChannel /></MemoryRouter>)
    expect(html).toContain('Channel creation is not available yet.')
    expect(html).toContain('no channel has been created')
    expect(html).toContain('Test Viewer')
    expect(html).toContain('href="/browse"')
    expect(html).not.toMatch(/<form|<button|<input|publish straight away|the channel exists/)
  })

  it('does not offer an unpersisted channel settings save', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ChannelSettings /></MemoryRouter>)
    expect(html).toContain('Channel settings cannot be changed here yet.')
    expect(html).not.toMatch(/<button|Save changes|Channel updated/)
  })
})
