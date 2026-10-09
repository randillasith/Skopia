import { useLayoutEffect, useRef, type RefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

export function popoverPosition(anchor: { left: number; right: number; top: number; bottom: number },
  width: number, height: number, viewportWidth: number, viewportHeight: number, above = false) {
  const margin = 12, gap = 8
  const actualWidth = Math.max(0, Math.min(width, viewportWidth - margin * 2))
  const below = Math.max(0, viewportHeight - anchor.bottom - gap - margin)
  const over = Math.max(0, anchor.top - gap - margin)
  const onTop = above ? over >= height || over > below : below < height && over > below
  const maxHeight = Math.max(0, onTop ? over : below)
  return {
    left: Math.max(margin, Math.min(anchor.right - actualWidth, viewportWidth - actualWidth - margin)),
    top: Math.max(margin, onTop ? anchor.top - gap - Math.min(height, maxHeight) : anchor.bottom + gap),
    width: actualWidth, maxHeight,
  }
}

/** Portalled menus escape scrolling rails and transformed/sticky stacking contexts. */
export function Popover({ anchor, onClose, children, above = false, width = 320, role = 'menu', label, id, className } : {
  anchor: RefObject<HTMLButtonElement | null>; onClose: () => void; children: ReactNode
  above?: boolean; width?: number; role?: 'menu' | 'dialog'; label: string; id?: string; className?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose }, [onClose])
  useLayoutEffect(() => {
    const element = panel.current, trigger = anchor.current
    if (!element || !trigger) return
    const focusable = () => [...element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, [tabindex="0"]')]
    const position = () => {
      const bounds = trigger.getBoundingClientRect()
      const placement = popoverPosition(bounds, width, element.scrollHeight,
        window.innerWidth, window.innerHeight, above)
      Object.assign(element.style, Object.fromEntries(Object.entries(placement).map(([key, value]) => [key, `${value}px`])))
      element.style.visibility = 'visible'
    }
    position()
    ;(focusable()[0] ?? element).focus({ preventScroll: true })
    const dismiss = (restore: boolean) => {
      if (restore) trigger.focus({ preventScroll: true })
      close.current()
    }
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node) && !trigger.contains(event.target as Node)) dismiss(false)
    }
    const focusOutside = (event: FocusEvent) => {
      if (!element.contains(event.target as Node) && !trigger.contains(event.target as Node)) dismiss(false)
    }
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(true) }
      if (event.key === 'Tab' && role === 'menu') { dismiss(true); return }
      if (role !== 'menu' || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const items = focusable(), index = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    observer?.observe(element)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focusOutside)
    element.addEventListener('keydown', keys)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', focusOutside)
      element.removeEventListener('keydown', keys)
    }
  }, [anchor, above, width, role])
  return createPortal(<div ref={panel} id={id} role={role} aria-label={label} tabIndex={-1}
    style={{ position: 'fixed', visibility: 'hidden', width }}
    className={cn('skopia-popover z-[100] overflow-y-auto overscroll-contain rounded-xl border border-rule-strong bg-surface text-fg shadow-e4', className)}>
    {children}
  </div>, document.body)
}
