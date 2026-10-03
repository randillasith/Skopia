import { describe, expect, it } from 'vitest'
import { filterByAccess } from './access-filter'

const videos = [{ id: 1, premium: false }, { id: 2, premium: true }, { id: 3, premium: false }]

describe('browse access filter', () => {
  it('shows both free and premium titles by default', () => {
    expect(filterByAccess(videos, 'all')).toEqual(videos)
  })
  it('shows free titles without a subscription', () => {
    expect(filterByAccess(videos, 'free').map((v) => v.id)).toEqual([1, 3])
  })
  it('lists premium titles separately', () => {
    expect(filterByAccess(videos, 'premium').map((v) => v.id)).toEqual([2])
  })
})
