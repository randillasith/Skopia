import { describe, expect, it, vi } from 'vitest'
import { createThemeStore, THEME_STORAGE_KEY } from './theme'

function harness(saved: string | null = null, blocked = false) {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' }, classList: { toggle: vi.fn() } }
  const meta = { setAttribute: vi.fn() }
  const storage = {
    getItem: vi.fn(() => { if (blocked) throw Error('blocked'); return saved }),
    setItem: vi.fn(() => { if (blocked) throw Error('blocked') }),
  }
  const storageListeners = new Set<(event: StorageEvent) => void>()
  const browser = {
    localStorage: storage,
    matchMedia: vi.fn(),
    document: { documentElement: root, querySelector: () => meta },
    addEventListener: (_: string, cb: (e: StorageEvent) => void) => storageListeners.add(cb),
    removeEventListener: (_: string, cb: (e: StorageEvent) => void) => storageListeners.delete(cb),
  } as unknown as Window
  const store = createThemeStore(browser)
  return {
    store, root, storage, meta, storageListeners, browser,
    otherTab: (key: string | null, newValue: string | null) => {
      storageListeners.forEach((cb) => cb({ key, newValue, storageArea: storage } as unknown as StorageEvent))
    },
  }
}

describe('appearance preference', () => {
  it('defaults to dark without using the operating system theme', () => {
    const h = harness()
    const unsubscribe = h.store.subscribe(vi.fn())
    expect(h.store.getSnapshot()).toBe('dark')
    expect(h.root.dataset.theme).toBe('dark')
    expect(h.root.style.colorScheme).toBe('dark')
    expect(h.browser.matchMedia).not.toHaveBeenCalled()
    unsubscribe()
    expect(h.storageListeners.size).toBe(0)
  })

  it.each(['light', 'dark'] as const)('restores %s and switches between the two choices', (value) => {
    const h = harness(value)
    expect(h.root.dataset.theme).toBe(value)
    const other = value === 'light' ? 'dark' : 'light'
    h.store.setPreference(other)
    expect(h.store.getSnapshot()).toBe(other)
    expect(h.root.dataset.theme).toBe(other)
    expect(h.storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, other)
    expect(h.meta.setAttribute).toHaveBeenLastCalledWith('content', other === 'dark' ? '#080d1c' : '#ffffff')
  })

  it('synchronizes all subscribers with other tabs and storage clearing', () => {
    const h = harness()
    const first = vi.fn(), second = vi.fn()
    const stopFirst = h.store.subscribe(first)
    const stopSecond = h.store.subscribe(second)
    expect(h.storageListeners.size).toBe(1)
    h.otherTab('unrelated', 'light')
    expect(first).not.toHaveBeenCalled()
    h.otherTab(THEME_STORAGE_KEY, 'light')
    expect(h.store.getSnapshot()).toBe('light')
    expect(h.root.dataset.theme).toBe('light')
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    stopFirst()
    expect(h.storageListeners.size).toBe(1)
    h.otherTab(null, null)
    expect(h.store.getSnapshot()).toBe('dark')
    expect(h.root.dataset.theme).toBe('dark')
    stopSecond()
    expect(h.storageListeners.size).toBe(0)
  })

  it('maps old system and invalid preferences to dark and tolerates unavailable storage', () => {
    expect(harness('system').root.dataset.theme).toBe('dark')
    expect(harness('invalid').root.dataset.theme).toBe('dark')
    const h = harness(null, true)
    expect(h.store.getSnapshot()).toBe('dark')
    expect(() => h.store.setPreference('light')).not.toThrow()
    expect(h.root.dataset.theme).toBe('light')
  })
})
