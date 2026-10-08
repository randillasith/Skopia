import { describe, expect, it } from 'vitest'
import { visibilityAction, visibilityLabel } from './video-visibility'
import { toVideo, type ServerVideo } from './catalogue'

const row = (status: string): ServerVideo => ({
  id: 12, title: 'Test', description: '', videoUrl: null, thumbnailUrl: null,
  durationSeconds: 60, viewCount: 0, accessType: 'FREE', status, uploadedAt: null,
  categoryId: null, category: null, creatorId: 1, creatorName: 'Creator',
  creatorAvatar: null, likeCount: 0, liked: false, saved: false, lastPosition: 0,
})

describe('creator visibility', () => {
  it('preserves the server status instead of guessing from billing', () => {
    expect(toVideo(row('DRAFT')).status).toBe('DRAFT')
    expect(toVideo(row('PUBLISHED')).status).toBe('PUBLISHED')
  })
  it('offers public/private transitions and labels both', () => {
    expect(visibilityLabel('DRAFT')).toBe('Private')
    expect(visibilityAction('DRAFT')).toBe('PUBLISHED')
    expect(visibilityLabel('PUBLIC')).toBe('Public')
    expect(visibilityAction('PUBLIC')).toBe('DRAFT')
  })
  it('does not offer visibility bypass for moderated statuses', () => {
    expect(visibilityAction('PULLED')).toBeNull()
    expect(visibilityAction('HELD_OVER')).toBeNull()
    expect(visibilityAction('ARCHIVED')).toBeNull()
  })
})
