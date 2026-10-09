// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal, Tabs } from './primitives'
import { Player } from './player'
import { VIDEOS } from '@/test/video-fixture'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLElement
let root: Root
async function mount(node: React.ReactNode) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(node))
}
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
})

it('traps focus in a dialog, closes on Escape, and restores the trigger', async () => {
  const close = vi.fn()
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  await mount(<Modal open onClose={close} title="Dialog"><button>First</button><button>Last</button></Modal>)
  const dialog = document.querySelector('[role="dialog"]')!
  expect(host.contains(dialog)).toBe(false)
  expect(dialog.contains(document.activeElement)).toBe(true)
  const buttons = [...dialog.querySelectorAll('button')]
  buttons.at(-1)!.focus()
  await act(async () => buttons.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
  expect(document.activeElement).toBe(buttons[0])
  buttons[0].focus()
  await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(buttons.at(-1))
  await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(close).toHaveBeenCalledOnce()
  await act(async () => root.render(<Modal open={false} onClose={close} title="Dialog"><button>First</button></Modal>))
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})

it('keeps focus inside a changing modal form when inline close callback changes on rerender', async () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  function Form() {
    const [text, setText] = useState('')
    return <Modal open onClose={() => setText('closed')} title="Refund">
      <input aria-label="Refund reason" value={text} onChange={e => setText(e.target.value)} />
    </Modal>
  }
  await mount(<Form />)
  const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!
  input.focus()
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, 'reason')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(input.value).toBe('reason')
  expect(document.activeElement).toBe(input)
  await act(async () => root.unmount())
  root = undefined as unknown as Root
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})

describe('tabs', () => {
  it('has one tab stop and arrows/Home/End change selected focus', async () => {
    const change = vi.fn()
    await mount(<Tabs tabs={[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}]} value="a" onChange={change} />)
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    expect(tabs.map(t => t.tabIndex)).toEqual([0, -1, -1])
    tabs[0].focus()
    await act(async () => tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})))
    expect(change).toHaveBeenCalledWith('b')
    expect(document.activeElement).toBe(tabs[1])
    await act(async () => tabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})))
    expect(change).toHaveBeenCalledWith('c')
  })
})

it('never presents caption labels as actual tracks without a source; slider keys work without global collision', async () => {
  const video = {...VIDEOS[0], mediaUrl: '/video.mp4', captions: ['English']}
  await mount(<Player video={video} theater={false} onTheater={() => {}} autoplay={false} onAutoplay={() => {}} onReport={() => {}} />)
  expect(host.querySelector('track')).toBeNull()
  expect(host.querySelector('button[aria-label="Captions unavailable"]')).toHaveProperty('disabled', true)
  const slider = host.querySelector<HTMLElement>('[role="slider"]')!
  slider.focus()
  const before = Number(slider.getAttribute('aria-valuenow'))
  await act(async () => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })))
  expect(slider.getAttribute('aria-valuenow')).toBe(String(before + 5))
  await act(async () => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })))
  expect(slider.getAttribute('aria-valuenow')).toBe(String(Number(slider.getAttribute('aria-valuemax'))))
  const play = host.querySelector<HTMLButtonElement>('button[aria-label="Play"]')!
  play.focus()
  await act(async () => play.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })))
  expect(play.getAttribute('aria-label')).toBe('Play')
})

it('does not draw fabricated captions for a playing title with only a language label', async () => {
  await mount(<Player video={{...VIDEOS[0], captions: ['English'], mediaUrl: '/uploads/test-video.mp4'}} theater={false}
    onTheater={() => {}} autoplay={false} onAutoplay={() => {}} onReport={() => {}} />)
  await act(async () => host.querySelector<HTMLVideoElement>('video')!.dispatchEvent(new Event('play')))
  expect(host.textContent).not.toContain('placeholder caption line')
  expect(host.querySelector('button[aria-label="Captions unavailable"]')).toHaveProperty('disabled', true)
})
