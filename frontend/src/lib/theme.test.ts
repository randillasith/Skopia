import { describe, expect, it, vi } from 'vitest'
import { createThemeStore, THEME_STORAGE_KEY } from './theme'

function harness(saved: string | null = null, dark = false, blocked = false) {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' }, classList: { toggle: vi.fn() } }
  const meta = { setAttribute: vi.fn() }
  const storage = {
    getItem: vi.fn(() => { if (blocked) throw Error('blocked'); return saved }),
    setItem: vi.fn(() => { if (blocked) throw Error('blocked') }),
  }
  const mediaListeners = new Set<() => void>()
  const storageListeners = new Set<(event: StorageEvent) => void>()
  const media = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => mediaListeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => mediaListeners.delete(cb),
  }
  const browser = {
    localStorage: storage,
    matchMedia: () => media,
    document: { documentElement: root, querySelector: () => meta },
    addEventListener: (_: string, cb: (e: StorageEvent) => void) => storageListeners.add(cb),
    removeEventListener: (_: string, cb: (e: StorageEvent) => void) => storageListeners.delete(cb),
  } as unknown as Window
  const store = createThemeStore(browser)
  return {
    store, root, storage, meta, mediaListeners, storageListeners,
    os: (value: boolean) => { media.matches = value; mediaListeners.forEach((cb) => cb()) },
    otherTab: (key: string | null, newValue: string | null) => {
      storageListeners.forEach((cb) => cb({ key, newValue, storageArea: storage } as unknown as StorageEvent))
    },
  }
}

describe('appearance preference', () => {
  it.each([false, true])('defaults to system and follows OS changes (dark=%s)', (dark) => {
    const h = harness(null, dark)
    const unsubscribe = h.store.subscribe(vi.fn())
    expect(h.store.getSnapshot()).toBe('system')
    expect(h.root.dataset.theme).toBe(dark ? 'dark' : 'light')
    h.os(!dark)
    expect(h.root.dataset.theme).toBe(dark ? 'light' : 'dark')
    expect(h.root.style.colorScheme).toBe(h.root.dataset.theme)
    unsubscribe()
    expect(h.mediaListeners.size).toBe(0)
    expect(h.storageListeners.size).toBe(0)
  })

  it.each(['light', 'dark'] as const)('restores and persists explicit %s, ignoring OS changes', (value) => {
    const h = harness(value)
    h.store.subscribe(vi.fn())
    h.os(true)
    h.os(false)
    expect(h.root.dataset.theme).toBe(value)
    h.store.setPreference(value)
    expect(h.storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, value)
    expect(h.meta.setAttribute).toHaveBeenLastCalledWith('content', value === 'dark' ? '#080d1c' : '#ffffff')
    h.store.setPreference('system')
    expect(h.root.dataset.theme).toBe('light')
    h.os(true)
    expect(h.root.dataset.theme).toBe('dark')
  })

  it('synchronizes all subscribers with other tabs and storage clearing', () => {
    const h = harness(null, true)
    const first = vi.fn(), second = vi.fn()
    const stopFirst = h.store.subscribe(first)
    const stopSecond = h.store.subscribe(second)
    expect(h.mediaListeners.size).toBe(1)
    h.otherTab('unrelated', 'light')
    expect(first).not.toHaveBeenCalled()
    h.otherTab(THEME_STORAGE_KEY, 'light')
    expect(h.store.getSnapshot()).toBe('light')
    expect(h.root.dataset.theme).toBe('light')
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    stopFirst()
    expect(h.mediaListeners.size).toBe(1)
    h.otherTab(null, null)
    expect(h.store.getSnapshot()).toBe('system')
    expect(h.root.dataset.theme).toBe('dark')
    stopSecond()
    expect(h.mediaListeners.size).toBe(0)
  })

  it('recovers from invalid saved preferences and unavailable storage', () => {
    expect(harness('invalid', true).root.dataset.theme).toBe('dark')
    const h = harness(null, false, true)
    expect(h.store.getSnapshot()).toBe('system')
    expect(() => h.store.setPreference('dark')).not.toThrow()
    expect(h.root.dataset.theme).toBe('dark')
  })
})
