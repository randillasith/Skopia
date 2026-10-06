import { useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'
import { createThemeStore, parseTheme } from '@/lib/theme'

const theme = createThemeStore(window)

/** Native select supplies keyboard, touch and screen-reader support. */
export function ThemeSelect() {
  const preference = useSyncExternalStore(theme.subscribe, theme.getSnapshot)
  const Icon = preference === 'light' ? Sun : Moon
  return (
    <label className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-rule-strong bg-surface pl-2 text-fg">
      <Icon aria-hidden="true" className="pointer-events-none size-3.5" />
      <span className="sr-only">Appearance</span>
      <select
        aria-label="Appearance"
        value={preference}
        onChange={(event) => theme.setPreference(parseTheme(event.target.value))}
        className="h-full max-w-22 cursor-pointer rounded-sm bg-surface pr-1 text-[12px] font-medium text-fg"
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
  )
}
