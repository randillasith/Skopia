// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { Popover, popoverPosition } from './Popover'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('viewport-safe menus', () => {
  it('keeps a sidebar menu fully inside the viewport', () => {
    const p = popoverPosition({left:12, right:228, top:780, bottom:820}, 320, 410, 1440, 900, true)
    expect(p.left).toBe(12)
    expect(p.top).toBe(362)
    expect(p.width).toBe(320)
  })
  it('fits a phone and flips above a bottom trigger', () => {
    const p = popoverPosition({left:278,right:318,top:570,bottom:610},400,460,320,640)
    expect(p.left).toBe(12)
    expect(p.width).toBe(296)
    expect(p.top).toBeGreaterThanOrEqual(12)
    expect(p.top + Math.min(460,p.maxHeight)).toBeLessThanOrEqual(628)
  })
  it('makes long menus scroll in a short viewport', () => {
    const p = popoverPosition({left:240,right:280,top:24,bottom:64},320,700,320,360)
    expect(p.maxHeight).toBe(276)
    expect(p.top).toBe(72)
  })
  it('escapes clipping ancestors, supports keyboard navigation, and restores focus', async () => {
    const host = document.createElement('div'); host.style.overflow = 'hidden'; document.body.append(host)
    const root = createRoot(host)
    function Harness() {
      const anchor = useRef<HTMLButtonElement>(null), [open,setOpen] = useState(false)
      return <><button ref={anchor} onClick={() => setOpen(true)}>Account</button>
        {open && <Popover anchor={anchor} label="Account menu" onClose={() => setOpen(false)}>
          <button role="menuitem">Profile</button><button role="menuitem">Sign out</button>
        </Popover>}</>
    }
    try {
      await act(async () => root.render(<Harness />))
      const trigger = host.querySelector('button')!; trigger.focus()
      await act(async () => trigger.click())
      const menu = document.querySelector('[role=menu]')!
      expect(host.contains(menu)).toBe(false)
      expect(document.activeElement?.textContent).toBe('Profile')
      await act(async () => menu.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true})))
      expect(document.activeElement?.textContent).toBe('Sign out')
      await act(async () => menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
      expect(document.querySelector('[role=menu]')).toBeNull()
      expect(document.activeElement).toBe(trigger)
    } finally { await act(async () => root.unmount()); host.remove() }
  })
})
