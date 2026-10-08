export function visibilityLabel(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'PUBLISHED':
    case 'PUBLIC': return 'Public'
    case 'DRAFT':
    case 'PRIVATE': return 'Private'
    default: return status ?? 'Unknown'
  }
}

/** Only creator-controlled states may toggle; moderation is deliberately excluded. */
export function visibilityAction(status?: string | null): 'PUBLISHED' | 'DRAFT' | null {
  switch ((status ?? '').toUpperCase()) {
    case 'PUBLISHED':
    case 'PUBLIC': return 'DRAFT'
    case 'DRAFT':
    case 'PRIVATE': return 'PUBLISHED'
    default: return null
  }
}
