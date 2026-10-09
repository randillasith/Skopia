// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { LibraryProvider, useLibrary } from './library'
import { useSession } from './session-context'
import { catalogue } from './catalogue'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./session-context', () => ({ useSession: vi.fn() }))
vi.mock('./catalogue', () => ({ catalogue: { watchlist: vi.fn(), history: vi.fn(), toggleSaved: vi.fn() } }))
const session = vi.mocked(useSession)
const watchlist = vi.mocked(catalogue.watchlist)
const history = vi.mocked(catalogue.history)
let lib: ReturnType<typeof useLibrary>
function Probe() { const current = useLibrary(); useEffect(() => { lib = current }, [current]); return <div>{current.playlists.map(p => p.name).join(',')}|{current.subscriptions.join(',')}|{current.queue.join(',')}|{current.recentSearches.join(',')}|{current.downloads.join(',')}|{current.watchLater.join(',')}<button onClick={() => current.importLegacyLibrary()}>Import legacy library</button><span>{current.hasLegacyLibrary ? 'Legacy available' : 'No legacy'}</span></div> }
const account = (userId: number) => ({ userId, id: `u-${userId}`, name: 'Test', handle: 'test', email: 'test@example.com', joined: '', lastSeen: '', status: 'Active' as const, staff: [], channelId: null })

beforeEach(() => { localStorage.clear(); watchlist.mockResolvedValue([]); history.mockResolvedValue([]) })
it('switches account state before rendering and ignores a previous account response', async () => {
  session.mockReturnValue({viewer: account(1), resolving: false} as unknown as ReturnType<typeof useSession>)
  let resolveOld!: (v: never[]) => void
  watchlist.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve as typeof resolveOld }))
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<LibraryProvider><Probe /></LibraryProvider>))
  await act(async () => { lib.createPlaylist('Private A', 'Private'); lib.toggleSubscribe('channel-a'); lib.playNext('a'); lib.recordSearch('secret'); lib.toggleDownload('a') })
  expect(host.textContent).toContain('Private A|channel-a|a|secret|a')
  session.mockReturnValue({viewer: account(2), resolving: false} as unknown as ReturnType<typeof useSession>)
  await act(async () => root.render(<LibraryProvider><Probe /></LibraryProvider>))
  expect(host.textContent).toContain('|||||Import legacy library')
  await act(async () => resolveOld([{id:99}] as never[]))
  expect(host.textContent).toContain('|||||Import legacy library')
  session.mockReturnValue({viewer: account(1), resolving: false} as unknown as ReturnType<typeof useSession>)
  await act(async () => root.render(<LibraryProvider><Probe /></LibraryProvider>))
  expect(host.textContent).toContain('Private A|channel-a|a|secret|a')
  await act(async () => root.unmount()); host.remove()
})

it('recovers legacy local-only data only after explicit import and keeps the original', async () => {
  localStorage.setItem('skopia.library', JSON.stringify({ playlists: [{id:'old', name:'Recovered', visibility:'Private', videoIds:[], created:'2020-01-01'}], subscriptions:['old-channel'], watchLater:['123'] }))
  session.mockReturnValue({viewer: account(1), resolving: false} as unknown as ReturnType<typeof useSession>)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<LibraryProvider><Probe /></LibraryProvider>))
    expect(host.textContent).toContain('Legacy available')
    expect(lib.playlists).toEqual([])
    await act(async () => { lib.createPlaylist('Existing', 'Private') })
    await act(async () => { host.querySelector('button')!.click() })
    expect(lib.playlists.map(p => p.name)).toEqual(['Existing', 'Recovered'])
    await act(async () => { host.querySelector('button')!.click() })
    expect(lib.playlists.map(p => p.name)).toEqual(['Existing', 'Recovered'])
    expect(lib.subscriptions).toEqual(['old-channel'])
    expect(lib.watchLater).toEqual([])
    expect(localStorage.getItem('skopia.library')).not.toBeNull()
    session.mockReturnValue({viewer: account(2), resolving: false} as unknown as ReturnType<typeof useSession>)
    await act(async () => root.render(<LibraryProvider><Probe /></LibraryProvider>))
    expect(lib.playlists).toEqual([])
    expect(host.textContent).toContain('Legacy available')
  } finally { await act(async () => root.unmount()); host.remove() }
})

it('confirms saves through the API, coalesces duplicate requests, and preserves state on failure', async () => {
  session.mockReturnValue({viewer: account(1), resolving: false} as unknown as ReturnType<typeof useSession>)
  const save = vi.mocked(catalogue.toggleSaved)
  let finish!: (value: {active: boolean}) => void
  save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<LibraryProvider><Probe /></LibraryProvider>))
    const first = lib.toggleWatchLater('12')
    const second = lib.toggleWatchLater('12')
    expect(first).toBe(second)
    expect(save).toHaveBeenCalledTimes(1)
    expect(lib.watchLater).toEqual([])
    await act(async () => { finish({active: true}); await first })
    expect(lib.watchLater).toEqual(['12'])
    save.mockRejectedValueOnce(new Error('Offline'))
    await act(async () => { await expect(lib.toggleWatchLater('12')).rejects.toThrow('Offline') })
    expect(lib.watchLater).toEqual(['12'])
  } finally { await act(async () => root.unmount()); host.remove(); save.mockReset() }
})
