import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X, ChevronDown, Check, Search, Inbox, Construction } from 'lucide-react'
import { cn } from '@/lib/cn'

const EASE = [0.16, 1, 0.3, 1] as const

/* ------------------------------------------------------------------ button */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all duration-200',
        // Tactile press. 150ms down so it registers under the finger, and the
        // scale is deliberately small — a button that squashes visibly reads as
        // a toy. Disabled buttons do not move, because nothing happened.
        'active:scale-[0.975] active:duration-75 disabled:active:scale-100',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-[14px]',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variant === 'primary' &&
          'bg-violet-500 text-white hover:bg-brand-hi active:bg-violet-700 shadow-e2',
        variant === 'secondary' &&
          'border border-ink-600 bg-ink-800 text-ink-50 hover:border-ink-500 hover:bg-ink-750',
        variant === 'ghost' && 'text-ink-200 hover:bg-ink-800 hover:text-fg',
        variant === 'quiet' && 'text-ink-300 hover:text-fg',
        variant === 'danger' &&
          'border border-danger-500/40 bg-danger-500/10 text-tone-danger-400 hover:bg-danger-500/18',
        className,
      )}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------- field */

export function Field({
  label,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-ink-150">
        {label}
        {required && <span className="text-tone-danger-400">*</span>}
        {hint && <span className="ml-auto text-[12px] font-normal text-ink-300">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-[12px] text-tone-danger-400">{error}</span>
      )}
    </label>
  )
}

const controlBase =
  'w-full rounded-sm border bg-ink-950 px-3 text-[14px] text-fg transition-colors placeholder:text-ink-300 hover:border-ink-500 focus:border-violet-400 focus:outline-none disabled:opacity-50'

export function Input({
  className,
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      className={cn(controlBase, 'h-10', invalid ? 'border-danger-500/60' : 'border-ink-600', className)}
    />
  )
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(controlBase, 'min-h-24 resize-y border-ink-600 py-2.5 leading-relaxed', className)}
    />
  )
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={cn(controlBase, 'h-10 appearance-none border-ink-600 pr-9', className)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
    </div>
  )
}

export function SearchInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
      <input {...rest} className={cn(controlBase, 'h-10 border-ink-600 pl-9')} />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-medium text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-ink-300">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-250',
          checked ? 'border-violet-400 bg-violet-500' : 'border-ink-600 bg-ink-800',
        )}
      >
        <motion.span
          layout
          transition={{ duration: 0.28, ease: EASE }}
          className={cn(
            'absolute top-1/2 block size-4 -translate-y-1/2 rounded-full bg-white shadow-e1',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </button>
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-left text-[14px] text-ink-100 hover:text-fg"
    >
      <span
        className={cn(
          'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          checked ? 'border-violet-400 bg-violet-500 text-white' : 'border-ink-500 bg-ink-950',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------- table */

/**
 * Below the `md` breakpoint each row stacks as a labelled record instead of
 * becoming a horizontal scroller. `labels` supplies the column names the
 * stacked cells are captioned with, in column order.
 */
export function Table({
  children,
  className,
  labels,
}: {
  children: React.ReactNode
  className?: string
  labels?: string[]
}) {
  const vars = Object.fromEntries(
    (labels ?? []).map((l, i) => [`--col-${i + 1}`, JSON.stringify(l)]),
  ) as React.CSSProperties
  return (
    <div className={cn('w-full md:overflow-x-auto', className)}>
      <table
        style={vars}
        className="skopia-table w-full border-collapse text-left text-[13px] md:min-w-[720px]"
      >
        {children}
      </table>
    </div>
  )
}

export function Th({
  children,
  className,
  numeric,
}: {
  children?: React.ReactNode
  className?: string
  numeric?: boolean
}) {
  return (
    <th
      scope="col"
      className={cn(
        'letterboard border-b border-ink-700 px-3 py-2.5 text-ink-300',
        numeric && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  numeric,
}: {
  children?: React.ReactNode
  className?: string
  numeric?: boolean
}) {
  return (
    <td
      className={cn(
        'border-b border-ink-800 px-3 py-3 align-middle text-ink-100',
        numeric && 'text-right font-mono tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(onClick && 'cursor-pointer transition-colors hover:bg-ink-800/60', className)}
    >
      {children}
    </tr>
  )
}

/* -------------------------------------------------------------------- tabs */

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[]
  value: string
  onChange: (id: string) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
    if (!buttons.length) return
    e.preventDefault()
    const current = buttons.indexOf(e.target as HTMLButtonElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1
      : (current + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus()
    onChange(tabs[next].id)
  }
  return (
    <div ref={list} role="tablist" onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-ink-700">
      {tabs.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative shrink-0 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-medium transition-colors',
              on ? 'text-fg' : 'text-ink-300 hover:text-ink-100',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 font-mono text-[11px] tabular-nums text-ink-300">
                {t.count}
              </span>
            )}
            {on && (
              <motion.span
                layoutId="tab-underline"
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-violet-500"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () => [...(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter(el => el.getClientRects().length > 0 || el.offsetParent !== null || el instanceof HTMLButtonElement)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current() }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { e.preventDefault(); dialog.current?.focus(); return }
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(focusable()[0] ?? dialog.current)?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = oldOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            ref={dialog}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.34, ease: EASE }}
            className={cn(
              'relative flex max-h-[calc(100dvh-3rem)] w-full flex-col rounded-2xl border border-ink-700 bg-ink-850 shadow-e4 sm:rounded-lg',
              width === 'sm' && 'sm:max-w-md',
              width === 'md' && 'sm:max-w-xl',
              width === 'lg' && 'sm:max-w-3xl',
            )}
          >
            <div className="flex shrink-0 items-start gap-4 border-b border-ink-700 px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-marquee text-[19px] font-bold text-fg">{title}</h2>
                {description && <p className="mt-1 text-[13px] text-ink-300">{description}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="-m-1 rounded-sm p-1 text-ink-300 transition-colors hover:bg-ink-800 hover:text-fg"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && (
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body
  )
}

/* ------------------------------------------------------------------- toast */

type Toast = { id: number; title: string; tone?: 'ok' | 'bad' | 'info' }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { ...t, id }])
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3600)
  }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.32, ease: EASE }}
              className={cn(
                'pointer-events-auto rounded-sm border px-3.5 py-3 text-[13px] shadow-e3 backdrop-blur',
                t.tone === 'ok' && 'border-success-500/40 bg-ink-850/95 text-tone-success-400',
                t.tone === 'bad' && 'border-danger-500/40 bg-ink-850/95 text-tone-danger-400',
                (!t.tone || t.tone === 'info') && 'border-ink-600 bg-ink-850/95 text-ink-100',
              )}
            >
              {t.title}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/* -------------------------------------------------------------- empty state */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body: string
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-700 px-6 py-14 text-center">
      <div className="mb-3 text-ink-300">{icon ?? <Inbox className="size-7" />}</div>
      <h3 className="font-marquee text-[17px] font-bold text-ink-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-300">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------- misc */

export function Placeholder({ children = 'Not yet decided' }: { children?: string }) {
  return (
    <span
      title="This value is an open decision in the project documentation."
      className="letterboard rounded-xs border border-dashed border-ink-600 px-1.5 py-0.5 text-ink-300"
    >
      {children}
    </span>
  )
}

/** Marks a value that is a working choice, not a decided fact. */
export function Working({
  children,
  what = 'name',
}: {
  children: React.ReactNode
  what?: string
}) {
  return (
    <span
      title={`Working ${what} — this is an open decision in the project documentation`}
      className="underline decoration-ink-500 decoration-dotted underline-offset-[6px]"
    >
      {children}
    </span>
  )
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-800 font-semibold text-ink-150"
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function Meter({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'accent' }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        className={cn('h-full rounded-full', tone === 'brand' ? 'bg-violet-500' : 'bg-cyan-400')}
      />
    </div>
  )
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-marquee text-[20px] font-bold tracking-tight text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/* --------------------------------------------------------- not built yet */

/**
 * A module whose screen exists but whose server side does not.
 *
 * <p>The alternative was a screen full of invented plans, payments and
 * notifications with controls that quietly did nothing when pressed. Showing
 * fabricated rows as though they were the account's own is worse than showing
 * none: somebody eventually reads one as a fact. This says plainly what the
 * screen will do and that it cannot do it yet, and offers no control that
 * cannot act.
 */
export function NotAvailableYet({
  what,
  body,
  icon,
  action,
}: {
  /** The module, named as the person would name it. */
  what: string
  /** What the screen will show once it has something to read. */
  body: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="mb-3 text-ink-300">{icon ?? <Construction className="size-7" />}</div>
        <p className="letterboard mb-2 text-ink-400">Not available yet</p>
        <h3 className="font-marquee text-[18px] font-bold text-fg">{what}</h3>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-300">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}
