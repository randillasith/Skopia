export type AccessFilter = 'all' | 'free' | 'premium'

/** Catalogue access tier, independent of publication status or subscription state. */
export function filterByAccess<T extends { premium: boolean }>(videos: T[], access: AccessFilter): T[] {
  if (access === 'all') return videos
  return videos.filter((video) => video.premium === (access === 'premium'))
}
