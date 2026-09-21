/**
 * What a screen shows while the server has not answered, and when it refuses.
 *
 * Both moments used to be impossible — the catalogue was a constant — so every
 * screen rendered as though the data were already there. They are ordinary now,
 * and they are shown the same way everywhere so that "nothing yet" never reads
 * as "nothing at all".
 */

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button, EmptyState } from './primitives'
import { cn } from '@/lib/cn'

export function Loading({ what = 'Loading', className }: { what?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-2.5 py-16 text-ink-300', className)}
    >
      <Loader2 className="size-4 animate-spin" />
      <span className="text-[13px]">{what}…</span>
    </div>
  )
}

/**
 * A refusal, said out loud.
 *
 * `onRetry` is offered because the most common cause is an API that is not up
 * yet, and that fixes itself without a reload of the whole page.
 */
export function Failed({
  message,
  onRetry,
  title = 'That did not load',
}: {
  message: string
  onRetry?: () => void
  title?: string
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-7 text-warning-400" />}
      title={title}
      body={message}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  )
}

/**
 * Loading, refusal and content in the order a reader meets them.
 *
 * Empty is deliberately not handled here: a shelf with nothing on it and a
 * search with no hits need different words, and only the screen knows which.
 */
export function Resolve({
  loading,
  error,
  onRetry,
  what,
  children,
}: {
  loading: boolean
  error: string | null
  onRetry?: () => void
  what?: string
  children: React.ReactNode
}) {
  if (loading) return <Loading what={what} />
  if (error) return <Failed message={error} onRetry={onRetry} />
  return <>{children}</>
}
