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
function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/**
 * Poster artwork.
 *
 * A poster is type on a plate: the title is the subject and the ground is there
 * to carry it. The ground is generated, but not uniformly — twelve compositions
 * and seven duotones drawn from the brand ramps, so that a shelf of forty titles
 * reads as a wall of different posters rather than one poster re-tinted. The
 * category biases which compositions come up, the way a real art department
 * would: music gets rhythm, documentary gets horizons, learning gets diagrams.
 *
 * All of it is placeholder. Replace with real artwork before production.
 */

/** Duotones, all drawn from the brand ramps in index.css. */
const PLATE_INKS: [string, string][] = [
  ['#7559ff', '#241862'], // violet
  ['#25c7f7', '#0b7194'], // cyan
  ['#a48cff', '#3a2796'], // lifted violet
  ['#5bdbfb', '#125c78'], // lifted cyan
  ['#ffb443', '#5b3fe6'], // gold against violet — the rarest, for emphasis
  ['#8b6fff', '#063145'], // violet over deep teal
  ['#4b5b7c', '#0f1628'], // near-monochrome, for the quiet ones
]

/** Which compositions suit which shelf. Indices into the switch below. */
const CATEGORY_FORMS: Record<string, number[]> = {
  Documentary: [8, 0, 6, 11],
  'Short Film': [5, 9, 0, 3],
  Series: [1, 4, 9, 11],
  Talk: [3, 2, 7, 6],
  Music: [4, 10, 1, 2],
  Learning: [7, 2, 10, 6],
}

export function PosterPlate({
  title,
  creator,
  runtime,
  seed,
  category,
  thumbnailUrl,
  className,
  compact = false,
  lettering = true,
}: {
  title: string
  creator?: string
  runtime?: string
  seed: number
  /** Biases the composition. Omit for an even spread across all twelve. */
  category?: string
  thumbnailUrl?: string | null
  className?: string
  /** Drops the studio/runtime line but keeps the title. */
  compact?: boolean
  /** Ground only. Use on thumbnails under ~140px, where type cannot be read. */
  lettering?: boolean
}) {
  const [primaryError, setPrimaryError] = useState(false)
  const [fallbackError, setFallbackError] = useState(false)

  const seedThumbnail = seed ? `https://picsum.photos/seed/${seed * 37 + 11}/640/360` : null
  const currentSrc = (thumbnailUrl && !primaryError) ? thumbnailUrl : (!fallbackError ? seedThumbnail : null)

  if (currentSrc) {
    return (
      <div className={cn('relative size-full overflow-hidden bg-ink-950', className)}>
        <img
          src={currentSrc}
          alt={title}
          className="size-full object-cover"
          onError={() => {
            if (thumbnailUrl && !primaryError) {
              setPrimaryError(true)
            } else {
              setFallbackError(true)
            }
          }}
        />
      </div>
    )
  }

  const r = rng(seed)
  const forms = (category && CATEGORY_FORMS[category]) || null
  const form = forms ? forms[seed % forms.length] : seed % 12
  const [ink, deep] = PLATE_INKS[(seed * 3) % PLATE_INKS.length]
  const rot = -28 + r() * 56
  const cx = 20 + r() * 60
  const cy = 20 + r() * 60
  const uid = `p${seed}`

  // Wrap the title to at most two lines so the lettering stays the subject at
  // every size the plate is used at.
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

  const A = `url(#${uid}-a)`
  const B = `url(#${uid}-b)`

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
          <stop offset="0%" stopColor={ink} stopOpacity="0.95" />
          <stop offset="100%" stopColor={deep} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={deep} stopOpacity="0.9" />
          <stop offset="100%" stopColor={ink} stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={`${uid}-r`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={ink} stopOpacity="1" />
          <stop offset="100%" stopColor={deep} stopOpacity="0.65" />
        </radialGradient>
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

        {/* 0 — diagonal split */}
        {form === 0 && (
          <>
            <polygon points="0,180 320,0 320,180" fill={A} />
            <polygon points="0,0 190,0 0,140" fill={B} opacity="0.75" />
          </>
        )}

        {/* 1 — bands */}
        {form === 1 && (
          <>
            <rect y="24" width="320" height="52" fill={A} />
            <rect y="88" width="320" height="26" fill={B} opacity="0.8" />
            <rect y="122" width="320" height="10" fill={ink} opacity="0.45" />
          </>
        )}

        {/* 2 — concentric rings */}
        {form === 2 && (
          <g transform={`translate(${cx * 2} ${cy * 0.8}) rotate(${rot})`}>
            {[92, 70, 48, 26].map((rr, i) => (
              <circle key={rr} r={rr} fill="none" stroke={i % 2 ? deep : ink}
                strokeWidth={i % 2 ? 10 : 16} opacity={0.55 + i * 0.08} />
            ))}
          </g>
        )}

        {/* 3 — orb and companion */}
        {form === 3 && (
          <>
            <circle cx={cx * 3} cy={cy * 1.1} r="92" fill={`url(#${uid}-r)`} />
            <circle cx={cx * 3 + 74} cy={cy * 1.1 + 18} r="54" fill={B} opacity="0.8" />
          </>
        )}

        {/* 4 — rhythm, uneven bars */}
        {form === 4 && (
          <g transform={`rotate(${rot / 4} 160 90)`}>
            {Array.from({ length: 11 }).map((_, i) => (
              <rect key={i} x={i * 30 + 4} y={-20} width={10 + (i % 3) * 7} height={220}
                fill={i % 3 === 0 ? deep : ink} opacity={0.22 + (i % 4) * 0.14} />
            ))}
          </g>
        )}

        {/* 5 — wedges */}
        {form === 5 && (
          <>
            <polygon points="320,0 320,180 130,180" fill={B} />
            <polygon points="0,0 200,0 60,180 0,180" fill={A} opacity="0.9" />
          </>
        )}

        {/* 6 — arc sweep */}
        {form === 6 && (
          <>
            <path d={`M0,180 A220,220 0 0 1 ${190 + cx},0 L0,0 Z`} fill={A} opacity="0.85" />
            <path d={`M320,0 A150,150 0 0 0 ${150 - cy},180 L320,180 Z`} fill={B} opacity="0.55" />
          </>
        )}

        {/* 7 — halftone grid */}
        {form === 7 && (
          <g opacity="0.85">
            {Array.from({ length: 8 }).map((_, row) =>
              Array.from({ length: 14 }).map((__, col) => (
                <circle key={`${row}-${col}`} cx={14 + col * 23} cy={12 + row * 23}
                  r={1.5 + ((row + col) % 5) * 1.9}
                  fill={(row + col) % 3 === 0 ? deep : ink}
                  opacity={0.3 + ((col * row) % 6) * 0.11} />
              )),
            )}
          </g>
        )}

        {/* 8 — horizon */}
        {form === 8 && (
          <>
            <rect width="320" height={96 + cy * 0.3} fill={B} opacity="0.55" />
            <circle cx={70 + cx * 1.6} cy={86 + cy * 0.3} r={38 + cx * 0.2} fill={ink} opacity="0.95" />
            <rect y={96 + cy * 0.3} width="320" height={180} fill={A} />
          </>
        )}

        {/* 9 — overlapping planes */}
        {form === 9 && (
          <>
            <rect x={cx * 0.6} y="8" width="150" height="150" fill={A} opacity="0.92" />
            <rect x={cx * 0.6 + 96} y={38} width="170" height="120" fill={B} opacity="0.7" />
            <rect x={cx * 0.6 + 52} y={70} width="80" height="80" fill={ink} opacity="0.35" />
          </>
        )}

        {/* 10 — radial burst */}
        {form === 10 && (
          <g transform={`translate(${60 + cx * 2} 180)`}>
            {Array.from({ length: 13 }).map((_, i) => (
              <polygon key={i}
                points={`0,0 ${-220 + i * 36},-260 ${-196 + i * 36},-260`}
                fill={i % 2 ? ink : deep} opacity={0.18 + (i % 5) * 0.12} />
            ))}
          </g>
        )}

        {/* 11 — terraces */}
        {form === 11 && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={-20 + i * 46} y={40 + i * 26} width="200" height="180"
                fill={i % 2 ? deep : ink} opacity={0.75 - i * 0.13} />
            ))}
          </>
        )}

        {/* the plate the lettering sits on */}
        {lettering && <rect width="320" height="180" fill={`url(#${uid}-plate)`} />}

        {/* house rule */}
        {lettering && (
          <rect x="18" y={baseY - titleSize - 13} width="44" height="2" fill={ink} fillOpacity="0.95" />
        )}

        {/* the title — the poster's whole job */}
        {lettering &&
          lines.map((l, i) => (
            <text
              key={i}
              x="18"
              y={baseY - (lines.length - 1 - i) * titleSize * 0.88}
              fill="#ffffff"
              fontFamily="'Archivo Variable', Archivo, sans-serif"
              fontSize={titleSize}
              fontWeight="800"
              letterSpacing="-1.1"
            >
              {l}
            </text>
          ))}

        {lettering && !compact && (creator || runtime) && (
          <text x="18" y="170" fill="#B6C1D6" fontFamily="'JetBrains Mono Variable', monospace"
            fontSize="10" letterSpacing="1.1">
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
