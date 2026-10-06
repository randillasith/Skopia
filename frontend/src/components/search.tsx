import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Clock, X, CornerDownLeft, Tv } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCatalogue } from '@/lib/useCatalogue'
import { CHANNELS } from '@/lib/session'
import { useLibrary } from '@/lib/library'
import { Avatar } from './primitives'

/**
 * The search box, with suggestions.
 *
 * It is a combobox, not a text field with a list under it: arrow keys move an
 * active option, Enter takes it, Escape closes without changing what was typed,
 * and `aria-activedescendant` keeps a screen reader on the same item the eye is
 * on. The pattern matters more here than almost anywhere else, because this is
 * how most people start every session.
 *
 * Empty query shows what you searched before. A query mixes titles and channels,
 * because "harbour" is as likely to mean the studio as the word in a synopsis.
 */

type Suggestion =
  | { kind: 'recent'; text: string }
  | { kind: 'title'; text: string; id: string }
  | { kind: 'channel'; text: string; handle: string }

/** Two titles can read the same; their ids cannot. */
const keyOf = (s: Suggestion) =>
  s.kind === 'title' ? `t-${s.id}` : s.kind === 'channel' ? `c-${s.handle}` : `r-${s.text}`

export function SearchBox({
  compact = false,
  autoFocus = false,
  initial = '',
  onSubmitted,
}: {
  compact?: boolean
  autoFocus?: boolean
  initial?: string
  onSubmitted?: () => void
}) {
  const nav = useNavigate()
  const { recentSearches, recordSearch, forgetSearch } = useLibrary()
  // Suggestions come from the catalogue already loaded for the page rather than
  // from a request per keystroke: the point of a suggestion is that it is
  // instant, and the search itself asks the server anyway.
  const { videos } = useCatalogue()
  const [q, setQ] = useState(initial)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => setQ(initial), [initial])

  const suggestions = useMemo<Suggestion[]>(() => {
    const t = q.trim().toLowerCase()
    if (!t) return recentSearches.slice(0, 6).map((text) => ({ kind: 'recent', text }))

    const channels: Suggestion[] = CHANNELS.filter((c) =>
      `${c.name} ${c.handle}`.toLowerCase().includes(t),
    )
      .slice(0, 2)
      .map((c) => ({ kind: 'channel', text: c.name, handle: c.handle }))

    const titles: Suggestion[] = videos.filter(
      (v) => v.billing !== 'PULLED' && `${v.title} ${v.creator}`.toLowerCase().includes(t),
    )
      .slice(0, 6 - channels.length)
      .map((v) => ({ kind: 'title', text: v.title, id: v.id }))

    return [...channels, ...titles]
  }, [q, recentSearches, videos])

  useEffect(() => setActive(-1), [q])

  // Clicking anywhere else closes it; the query typed so far is kept.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const go = (s: Suggestion) => {
    setOpen(false)
    onSubmitted?.()
    if (s.kind === 'channel') return nav(`/channel/${s.handle}`)
    if (s.kind === 'title') return nav(`/watch/${s.id}`)
    setQ(s.text)
    recordSearch(s.text)
    nav(`/search?q=${encodeURIComponent(s.text)}`)
  }

  const submit = () => {
    const t = q.trim()
    if (!t) return
    recordSearch(t)
    setOpen(false)
    onSubmitted?.()
    nav(`/search?q=${encodeURIComponent(t)}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % Math.max(1, suggestions.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && suggestions[active]) go(suggestions[active])
      else submit()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={box} className={cn('relative', compact ? 'w-full' : 'w-full sm:w-72 lg:w-96')}>
      <div className="flex h-10 items-center gap-2 rounded-sm border border-ink-700 bg-ink-850 px-3 transition-colors focus-within:border-ink-500">
        <Search className="size-4 shrink-0 text-ink-300" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `sugg-${active}` : undefined}
          placeholder="Search the programme"
          aria-label="Search the programme"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-50 outline-none placeholder:text-ink-300"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setOpen(true) }}
            aria-label="Clear search"
            className="rounded-sm p-0.5 text-ink-300 hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.ul
            id="search-suggestions"
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-sm border border-ink-600 bg-ink-850 py-1 shadow-e4"
          >
            {suggestions.map((s, i) => (
              <li key={keyOf(s)} id={`sugg-${i}`} role="option" aria-selected={i === active}>
                <div
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-[13px]',
                    i === active ? 'bg-ink-800 text-fg' : 'text-ink-100',
                  )}
                >
                  <button onClick={() => go(s)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    {s.kind === 'recent' && <Clock className="size-3.5 shrink-0 text-ink-300" />}
                    {s.kind === 'title' && <Search className="size-3.5 shrink-0 text-ink-300" />}
                    {s.kind === 'channel' && <Avatar name={s.text} size={20} />}
                    <span className="truncate">{s.text}</span>
                    {s.kind === 'channel' && (
                      <span className="letterboard shrink-0 text-ink-300">
                        <Tv className="mr-1 inline size-3" />Channel
                      </span>
                    )}
                  </button>
                  {s.kind === 'recent' ? (
                    <button
                      onClick={() => forgetSearch(s.text)}
                      aria-label={`Forget “${s.text}”`}
                      className="shrink-0 rounded-sm p-1 text-ink-300 hover:text-fg"
                    >
                      <X className="size-3" />
                    </button>
                  ) : (
                    i === active && <CornerDownLeft className="size-3 shrink-0 text-ink-300" />
                  )}
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
