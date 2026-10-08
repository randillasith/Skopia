/**
 * The three primitives the Skopia world is built from.
 *
 *   Lightbox     — a backlit poster in a luminous frame. Never a card.
 *   Letterboard  — uppercase tracked status on a ruled field, which flips
 *                  character-by-character when the state changes. This is the
 *                  system's one authored motion moment.
 *   PosterPlate  — uploaded artwork with an explicit missing-thumbnail state.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock, Film } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BILLING_TONE, type Billing } from '@/lib/data'

/* ------------------------------------------------------------- letterboard */

const TONE: Record<string, string> = {
  live: 'text-tone-cyan-300 border-cyan-400/40 bg-cyan-400/8',
  soon: 'text-tone-violet-200 border-violet-400/40 bg-violet-400/8',
  held: 'text-tone-gold-400 border-gold-500/35 bg-gold-500/8',
  dead: 'text-ink-300 border-ink-600 bg-ink-800',
  review: 'text-tone-warning-400 border-warning-500/35 bg-warning-500/8',
  ok: 'text-tone-success-400 border-success-500/35 bg-success-500/8',
  bad: 'text-tone-danger-400 border-danger-500/35 bg-danger-500/8',
  neutral: 'text-ink-200 border-ink-600 bg-ink-800',
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ·'

/**
 * Flips to `children` character-by-character when the text changes.
 * Holds the resolved string outright under prefers-reduced-motion.
 */
function FlipText({ text }: { text: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(text)
  const prev = useRef(text)

  useEffect(() => {
    if (text === prev.current) return
    prev.current = text
    if (reduce) {
      setShown(text)
      return
    }
    let frame = 0
    const total = 10
    const id = window.setInterval(() => {
      frame += 1
      const settled = Math.floor((frame / total) * text.length)
      setShown(
        text
          .split('')
          .map((ch, i) =>
            i < settled || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0],
          )
          .join(''),
      )
      if (frame >= total) {
        window.clearInterval(id)
        setShown(text)
      }
    }, 28)
    return () => window.clearInterval(id)
  }, [text, reduce])

  return <>{shown}</>
}

export function Letterboard({
  children,
  tone = 'neutral',
  className,
}: {
  children: string
  tone?: keyof typeof TONE
  className?: string
}) {
  return (
    <span
      className={cn(
        'letterboard inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-1',
        TONE[tone],
        className,
      )}
    >
      <FlipText text={children} />
    </span>
  )
}

export function BillingBoard({ billing, className }: { billing: Billing; className?: string }) {
  return (
    <Letterboard tone={BILLING_TONE[billing]} className={className}>
      {billing}
    </Letterboard>
  )
}

/* ------------------------------------------------------------ poster plate */

/** Deterministic pseudo-random from an integer seed. */
/** Real uploaded artwork, with an explicit neutral state when it is unavailable. */
export function PosterPlate({ title, thumbnailUrl, className, compact = false, lettering = true }: {
  title: string; creator?: string; runtime?: string; seed: number; category?: string
  thumbnailUrl?: string | null; className?: string; compact?: boolean; lettering?: boolean
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const currentSrc = thumbnailUrl && thumbnailUrl !== failedSrc ? thumbnailUrl : null
  return <div className={cn('relative grid size-full place-items-center overflow-hidden bg-ink-850', className)}>
    {currentSrc ? <img src={currentSrc} alt={title} className="size-full object-cover" onError={() => setFailedSrc(currentSrc)} />
      : <div className="flex max-w-full flex-col items-center gap-2 p-4 text-center text-ink-200">
        <Film className="size-7 text-ink-300" aria-hidden="true" />
        <span className="text-[12px]">No thumbnail</span>
        {!compact && lettering && title && <span className="font-marquee line-clamp-2 text-xl font-bold text-fg">{title}</span>}
      </div>}
  </div>
}

export function Lightbox({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode
  className?: string
  /** Lifts and tracks the pointer. Use where the box is a link to something. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Written directly to the node. Routing pointer coordinates through state
  // would re-render the whole shelf on every mousemove; the browser only needs
  // two custom properties to redraw the gradient.
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={interactive ? track : undefined}
      whileHover={interactive ? { y: -4 } : undefined}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className={cn('lightbox', interactive && 'lightbox-glance', className)}
    >
      {children}
    </motion.div>
  )
}

export function MarqueeRule({ className }: { className?: string }) {
  return <div className={cn('marquee-rule w-full', className)} aria-hidden />
}

/* ---------------------------------------------------------------- stations */

/**
 * A staged commit. Progress past the marked station is irreversible —
 * the upload and payment flows both work this way in the documentation.
 */
export function Stations({
  steps,
  active,
  pointOfNoReturn,
}: {
  steps: string[]
  active: number
  pointOfNoReturn?: number
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {steps.map((s, i) => {
        const done = i < active
        const now = i === active
        const locked = pointOfNoReturn !== undefined && i < pointOfNoReturn && active >= pointOfNoReturn
        return (
          <li key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'letterboard flex items-center gap-2 rounded-xs border px-2.5 py-1.5 transition-colors',
                now && 'border-cyan-400/50 bg-cyan-400/10 text-tone-cyan-200',
                done && !now && 'border-ink-600 bg-ink-800 text-ink-200',
                !done && !now && 'border-ink-700 bg-transparent text-ink-300',
              )}
            >
              <span className="font-mono opacity-60">{String(i + 1).padStart(2, '0')}</span>
              {s}
              {locked && <Lock aria-label="Locked — past the point of no return" className="size-3" />}
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'h-px w-6',
                  i < active ? 'bg-cyan-400/40' : 'bg-ink-700',
                  pointOfNoReturn === i + 1 && 'w-10 bg-danger-500/50',
                )}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
