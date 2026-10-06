export type ThemePreference = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'skopia.theme'

export function parseTheme(value: string | null): ThemePreference {
  return value === 'light' ? 'light' : 'dark'
}

/** One store for every appearance control; storage failures never block the UI. */
export function createThemeStore(browser: Window) {
  const listeners = new Set<() => void>()
  let preference: ThemePreference = 'dark'
  try { preference = parseTheme(browser.localStorage.getItem(THEME_STORAGE_KEY)) } catch { /* private browsing */ }

  const apply = () => {
    const root = browser.document.documentElement
    root.dataset.theme = preference
    root.style.colorScheme = preference
    root.classList.toggle('dark', preference === 'dark')
    browser.document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', preference === 'dark' ? '#080d1c' : '#ffffff',
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
        browser.addEventListener('storage', onStorage)
      }
      listeners.add(listener)
      apply()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          browser.removeEventListener('storage', onStorage)
        }
      }
    },
  }
}
