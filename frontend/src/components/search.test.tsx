import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { SearchBox } from './search'
vi.mock('@/lib/library', () => ({ useLibrary: () => ({ recentSearches: ['previous'], recordSearch: () => {}, forgetSearch: () => {} }) }))
vi.mock('@/lib/useCatalogue', () => ({ useCatalogue: () => ({ videos: [] }) }))
it('uses distinct ARIA references for concurrent comboboxes', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SearchBox /><SearchBox /></MemoryRouter>)
  const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(m => m[1])
  expect(controls).toHaveLength(2)
  expect(new Set(controls).size).toBe(2)
})
