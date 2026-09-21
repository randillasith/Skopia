import { describe, expect, it } from 'vitest'
import { setMembership } from './library'

describe('library membership updates', () => {
  it('adds once and removes deterministically', () => {
    expect(setMembership(['1'], '2', true)).toEqual(['1', '2'])
    expect(setMembership(['1', '2'], '2', true)).toEqual(['1', '2'])
    expect(setMembership(['1', '2'], '2', false)).toEqual(['1'])
  })

  it('can roll an optimistic change back to its previous state', () => {
    const optimistic = setMembership(['1'], '2', true)
    expect(setMembership(optimistic, '2', false)).toEqual(['1'])
  })
})
