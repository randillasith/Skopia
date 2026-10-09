// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { Player } from './player'
import type { Video } from '@/lib/data'

it('does not offer playback or report playback for a record without media', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const started = vi.fn()
  const ended = vi.fn()
  const video = { id: '9', title: 'Unavailable upload', runtime: '30:00', seed: 9, mediaUrl: null } as Video
  try {
    await act(async () => root.render(<Player video={video} theater={false} onTheater={() => {}} autoplay={false} onAutoplay={() => {}} onReport={() => {}} onPlaybackStarted={started} onEnded={ended} />))
    expect(host.textContent).toContain('Video unavailable')
    expect(host.querySelector('video')).toBeNull()
    expect(host.querySelector('button')).toBeNull()
    expect(started).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
