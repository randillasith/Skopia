export type ThemePreference = 'system' | 'light' | 'dark'
export const THEME_STORAGE_KEY = 'skopia.theme'

export function parseTheme(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** One store for every appearance control; storage failures never block the UI. */
export function createThemeStore(browser: Window) {
  const media = browser.matchMedia('(prefers-color-scheme: dark)')
  const listeners = new Set<() => void>()
  let preference: ThemePreference = 'system'
  try { preference = parseTheme(browser.localStorage.getItem(THEME_STORAGE_KEY)) } catch { /* private browsing */ }

  const apply = () => {
    const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
    const root = browser.document.documentElement
    root.dataset.theme = resolved
    root.style.colorScheme = resolved
    root.classList.toggle('dark', resolved === 'dark')
    browser.document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', resolved === 'dark' ? '#080d1c' : '#dcd9e7',
    )
  }
  const notify = () => { apply(); listeners.forEach((listener) => listener()) }
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== browser.localStorage) return
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      preference = parseTheme(event.newValue)
      notify()
    }
  }
  apply()
  return {
    getSnapshot: () => preference,
    setPreference: (value: ThemePreference) => {
      preference = parseTheme(value)
      try { browser.localStorage.setItem(THEME_STORAGE_KEY, preference) } catch { /* retain in memory */ }
      notify()
    },
    subscribe: (listener: () => void) => {
      if (listeners.size === 0) {
        media.addEventListener('change', apply)
        browser.addEventListener('storage', onStorage)
      }
      listeners.add(listener)
      apply()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          media.removeEventListener('change', apply)
          browser.removeEventListener('storage', onStorage)
        }
      }
    },
  }
}
