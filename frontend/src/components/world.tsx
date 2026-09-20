/**
 * The three primitives the Skopia world is built from.
 *
 *   Lightbox     — a backlit poster in a luminous frame. Never a card.
 *   Letterboard  — uppercase tracked status on a ruled field, which flips
 *                  character-by-character when the state changes. This is the
 *                  system's one authored motion moment.
 *   PosterPlate  — authored placeholder poster art. Synthetic by design: the
 *                  prototype has no real imagery, and a designed plate is what
 *                  a lobby lightbox actually holds. Replace with real artwork.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BILLING_TONE, type Billing } from '@/lib/data'

/* ------------------------------------------------------------- letterboard */

const TONE: Record<string, string> = {
  live: 'text-cyan-300 border-cyan-400/40 bg-cyan-400/8',
  soon: 'text-violet-200 border-violet-400/40 bg-violet-400/8',
  held: 'text-gold-400 border-gold-500/35 bg-gold-500/8',
  dead: 'text-ink-300 border-ink-600 bg-ink-800',
  review: 'text-warning-400 border-warning-500/35 bg-warning-500/8',
  ok: 'text-success-400 border-success-500/35 bg-success-500/8',
  bad: 'text-danger-400 border-danger-500/35 bg-danger-500/8',
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
function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function PosterPlate({
  title,
  creator,
  runtime,
  seed,
  className,
  compact = false,
  lettering = true,
}: {
  title: string
  creator?: string
  runtime?: string
  seed: number
  className?: string
  /** Drops the studio/runtime line but keeps the title. */
  compact?: boolean
  /** Ground only. Use on thumbnails under ~140px, where type cannot be read. */
  lettering?: boolean
}) {
  const r = rng(seed)
  const variant = seed % 6
  const rot = -28 + r() * 56
  const cx = 20 + r() * 60
  const cy = 20 + r() * 60
  const uid = `p${seed}`

  // A poster is type on a plate. Wrap the title to at most two lines so the
  // lettering stays the subject at every size the plate is used at.
  const words = title.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length > 13 && line) {
      lines.push(line)
      line = w
    } else line = next
    if (lines.length === 2) break
  }
  if (line && lines.length < 2) lines.push(line)

  // Fit to the plate: Archivo ExtraBold runs about 0.52em per character, and
  // the lettering must clear the 18px gutters on both sides.
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const titleSize = Math.max(
    15,
    Math.min(lines.length > 1 ? 30 : 36, Math.floor(284 / (longest * 0.52))),
  )
  const baseY = 148 - (lines.length - 1) * titleSize * 0.88

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`Poster for ${title}`}
    >
      <defs>
        <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7559FF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#241862" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#25C7F7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0B7194" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060A16" stopOpacity="0" />
          <stop offset="48%" stopColor="#060A16" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#060A16" stopOpacity="0.94" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect width="320" height="180" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        <rect width="320" height="180" fill="#060A16" />

        {variant === 0 && (
          <>
            <polygon points="0,180 320,0 320,180" fill={`url(#${uid}-a)`} />
            <polygon points="0,0 190,0 0,140" fill={`url(#${uid}-b)`} opacity="0.75" />
          </>
        )}
        {variant === 1 && (
          <>
            <rect y="24" width="320" height="52" fill={`url(#${uid}-a)`} />
            <rect y="88" width="320" height="26" fill={`url(#${uid}-b)`} opacity="0.8" />
            <rect y="122" width="320" height="10" fill="#7559FF" opacity="0.45" />
          </>
        )}
        {variant === 2 && (
          <g transform={`translate(${cx * 2} ${cy * 0.8}) rotate(${rot})`}>
            {[92, 70, 48, 26].map((rr, i) => (
              <circle
                key={rr}
                r={rr}
                fill="none"
                stroke={i % 2 ? '#25C7F7' : '#7559FF'}
                strokeWidth={i % 2 ? 10 : 16}
                opacity={0.55 + i * 0.08}
              />
            ))}
          </g>
        )}
        {variant === 3 && (
          <>
            <circle cx={cx * 3} cy={cy * 1.1} r="92" fill={`url(#${uid}-a)`} />
            <circle cx={cx * 3 + 74} cy={cy * 1.1 + 18} r="54" fill={`url(#${uid}-b)`} opacity="0.8" />
          </>
        )}
        {variant === 4 && (
          <g transform={`rotate(${rot / 4} 160 90)`}>
            {Array.from({ length: 11 }).map((_, i) => (
              <rect
                key={i}
                x={i * 30 + 4}
                y={-20}
                width={10 + (i % 3) * 7}
                height={220}
                fill={i % 3 === 0 ? '#25C7F7' : '#7559FF'}
                opacity={0.22 + (i % 4) * 0.14}
              />
            ))}
          </g>
        )}
        {variant === 5 && (
          <>
            <polygon points="320,0 320,180 130,180" fill={`url(#${uid}-b)`} />
            <polygon points="0,0 200,0 60,180 0,180" fill={`url(#${uid}-a)`} opacity="0.9" />
          </>
        )}

        {/* the plate the lettering sits on */}
        {lettering && <rect width="320" height="180" fill={`url(#${uid}-plate)`} />}

        {/* house rule */}
        {lettering && (
          <rect
            x="18"
            y={baseY - titleSize - 13}
            width="44"
            height="2"
            fill="#25C7F7"
            fillOpacity="0.9"
          />
        )}

        {/* the title — the poster's whole job */}
        {lettering &&
          lines.map((l, i) => (
          <text
            key={i}
            x="18"
            y={baseY - (lines.length - 1 - i) * titleSize * 0.88}
            fill="#ffffff"
            fontFamily="Archivo, sans-serif"
            fontSize={titleSize}
            fontWeight="800"
            letterSpacing="-1.1"
            >
              {l}
            </text>
          ))}

        {lettering && !compact && (creator || runtime) && (
          <text
            x="18"
            y="170"
            fill="#B6C1D6"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="10"
            letterSpacing="1.1"
          >
            {[creator, runtime].filter(Boolean).join('   ·   ').toUpperCase()}
          </text>
        )}
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- lightbox */

export function Lightbox({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <motion.div
      whileHover={interactive ? { y: -4 } : undefined}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className={cn('lightbox', className)}
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
                now && 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200',
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
