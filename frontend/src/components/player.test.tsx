import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Player } from './player'
import { VIDEOS } from '@/lib/data'

it('renders the feature transport without an unserved demo advertisement', () => {
  const html = renderToStaticMarkup(<Player video={VIDEOS[0]} theater={false}
    onTheater={() => {}} autoplay={false} onAutoplay={() => {}} onReport={() => {}} />)
  expect(html).toContain('aria-label="Play"')
  expect(html).not.toContain('Skip advertisement')
  expect(html).not.toContain('Autumn Season Launch')
})
