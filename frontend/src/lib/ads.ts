/**
 * FR5 — advertisement management, as this UI sees it.
 *
 * The types mirror the API's responses rather than the database: a campaign here
 * carries the status the screen should show and the delivery figures the list
 * needs, because working those out in the browser is how two screens end up
 * disagreeing about the same campaign.
 */

import { request, upload } from './api'

/* ------------------------------------------------------------- vocabulary */

export type CampaignStatus =
  | 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'

export type AdStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type AdType = 'VIDEO' | 'IMAGE'
export type SlotPosition = 'PREROLL' | 'MIDROLL' | 'POSTROLL' | 'OVERLAY' | 'LOBBY'

/** The letterboard word for each status, and the tone the world uses for it. */
export const STATUS_TONE: Record<CampaignStatus, 'live' | 'soon' | 'dead' | 'review' | 'neutral' | 'held'> = {
  ACTIVE: 'live',
  SCHEDULED: 'soon',
  EXPIRED: 'dead',
  PAUSED: 'review',
  DRAFT: 'neutral',
  ARCHIVED: 'held',
}

export const SLOT_LABEL: Record<SlotPosition, string> = {
  PREROLL: 'Pre-roll',
  MIDROLL: 'Mid-roll',
  POSTROLL: 'Post-roll',
  OVERLAY: 'Overlay',
  LOBBY: 'Lobby standee',
}

/* ------------------------------------------------------------------ shapes */

export type Campaign = {
  id: number
  campaignName: string
  advertiser: string | null
  /** What the screen shows. Already accounts for the dates having passed. */
  status: CampaignStatus
  /**
   * What the database holds. Differs from `status` between expiry sweeps, and
   * the difference is what tells "paused by someone" apart from "ran out".
   */
  storedStatus: CampaignStatus
  startDate: string
  endDate: string
  budget: number | null
  createdById: number | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  adCount: number
  targets: string[]
  impressions: number
  clicks: number
  ctr: number
}

export type Placement = {
  id: number
  adId: number
  videoId: number | null
  videoTitle: string | null
  categoryId: number | null
  categoryName: string | null
  slotPosition: SlotPosition
  priority: number
  activeFrom: string
  activeTo: string
  targetKind: 'video' | 'category'
  targetLabel: string
}

export type Advertisement = {
  id: number
  campaignId: number
  campaignName: string
  adTitle: string
  mediaUrl: string
  adType: AdType
  adDuration: number
  clickUrl: string | null
  status: AdStatus
  /** False once the campaign's window has closed, whatever `status` says. */
  servable: boolean
  createdAt: string
  updatedAt: string
  placements: Placement[]
  impressions: number
  clicks: number
  ctr: number
}

export type TargetOption = {
  id: number
  label: string
  sublabel: string | null
  /** Titles behind a category. Null for a title, which counts only itself. */
  count: number | null
}

export type TargetOptions = { categories: TargetOption[]; videos: TargetOption[] }

export type UploadedMedia = {
  mediaUrl: string
  originalFilename: string
  sizeBytes: number
  contentType: string
  adType: AdType
}

export type MetricPoint = { day: string; impressions: number; clicks: number; ctr: number }

export type Breakdown = {
  dimension: string
  rows: { label: string; impressions: number; clicks: number; ctr: number }[]
}

export type Metrics = {
  subject: string
  subjectId: number
  subjectName: string
  from: string
  to: string
  impressions: number
  clicks: number
  ctr: number
  daily: MetricPoint[]
  breakdowns: Breakdown[]
}

export type AdvertisingSession = {
  actorId: number
  handle: string
  displayName: string
  role: string
  canOwnCampaigns: boolean
}

/** One advertisement, as served to a viewer. */
export type ServedAd = {
  impressionId: number
  adId: number
  placementId: number
  adTitle: string
  advertiser: string | null
  mediaUrl: string
  adType: AdType
  adDuration: number
  slotPosition: SlotPosition
  /** The platform's tracking URL, never the advertiser's own. */
  clickUrl: string | null
  label: string
}

export type CampaignInput = {
  campaignName: string
  advertiser?: string | null
  startDate: string
  endDate: string
  budget?: number | null
}

export type AdvertisementInput = {
  campaignId: number
  adTitle: string
  mediaUrl: string
  adType: AdType
  adDuration?: number
  clickUrl?: string | null
}

export type PlacementInput = {
  videoId?: number | null
  categoryId?: number | null
  slotPosition: SlotPosition
  priority?: number
  activeFrom?: string | null
  activeTo?: string | null
}

/* ------------------------------------------------------------------ the API */

type Actor = number | null

export const ads = {
  /** Resolve a signed-in handle to the id the management calls identify by. */
  /**
   * Who the signed-in account is, as far as advertising is concerned.
   *
   * It used to take a handle. The server answered for whatever handle it was
   * given, which let anyone resolve any account and find out who holds
   * advertising — so it now answers for the bearer token and nothing else, and
   * there is nothing left to pass.
   */
  session: () => request<AdvertisingSession>('/api/advertising/session'),

  campaigns: {
    list: (actorId: Actor, opts: { search?: string; status?: CampaignStatus } = {}) => {
      const query = new URLSearchParams()
      if (opts.search) query.set('search', opts.search)
      if (opts.status) query.set('status', opts.status)
      const suffix = query.toString() ? `?${query}` : ''
      return request<Campaign[]>(`/api/ad-campaigns${suffix}`, { actorId })
    },
    get: (actorId: Actor, id: number) =>
      request<Campaign>(`/api/ad-campaigns/${id}`, { actorId }),
    create: (actorId: Actor, body: CampaignInput) =>
      request<Campaign>('/api/ad-campaigns', { method: 'POST', body, actorId }),
    update: (actorId: Actor, id: number, body: CampaignInput) =>
      request<Campaign>(`/api/ad-campaigns/${id}`, { method: 'PUT', body, actorId }),
    confirm: (actorId: Actor, id: number) =>
      request<Campaign>(`/api/ad-campaigns/${id}/confirm`, { method: 'POST', actorId }),
    pause: (actorId: Actor, id: number) =>
      request<Campaign>(`/api/ad-campaigns/${id}/pause`, { method: 'POST', actorId }),
    resume: (actorId: Actor, id: number) =>
      request<Campaign>(`/api/ad-campaigns/${id}/resume`, { method: 'POST', actorId }),
    archive: (actorId: Actor, id: number) =>
      request<Campaign>(`/api/ad-campaigns/${id}/archive`, { method: 'POST', actorId }),
    remove: (actorId: Actor, id: number) =>
      request<void>(`/api/ad-campaigns/${id}`, { method: 'DELETE', actorId }),
    sweepExpired: (actorId: Actor) =>
      request<{ updated: number }>('/api/ad-campaigns/sweep-expired', { method: 'POST', actorId }),
    metrics: (actorId: Actor, id: number, from?: string, to?: string) =>
      request<Metrics>(`/api/ad-campaigns/${id}/metrics${range(from, to)}`, { actorId }),
    csvUrl: (id: number, from?: string, to?: string) =>
      `/api/ad-campaigns/${id}/metrics.csv${range(from, to)}`,
  },

  advertisements: {
    forCampaign: (actorId: Actor, campaignId: number) =>
      request<Advertisement[]>(`/api/advertisements?campaignId=${campaignId}`, { actorId }),
    get: (actorId: Actor, id: number) =>
      request<Advertisement>(`/api/advertisements/${id}`, { actorId }),
    create: (actorId: Actor, body: AdvertisementInput) =>
      request<Advertisement>('/api/advertisements', { method: 'POST', body, actorId }),
    update: (actorId: Actor, id: number, body: AdvertisementInput) =>
      request<Advertisement>(`/api/advertisements/${id}`, { method: 'PUT', body, actorId }),
    activate: (actorId: Actor, id: number) =>
      request<Advertisement>(`/api/advertisements/${id}/activate`, { method: 'POST', actorId }),
    deactivate: (actorId: Actor, id: number) =>
      request<Advertisement>(`/api/advertisements/${id}/deactivate`, { method: 'POST', actorId }),
    remove: (actorId: Actor, id: number) =>
      request<void>(`/api/advertisements/${id}`, { method: 'DELETE', actorId }),
    metrics: (actorId: Actor, id: number, from?: string, to?: string) =>
      request<Metrics>(`/api/advertisements/${id}/metrics${range(from, to)}`, { actorId }),
    uploadMedia: (actorId: Actor, file: File) =>
      upload<UploadedMedia>('/api/advertisements/media', file, actorId ?? null),
  },

  targets: {
    options: (actorId: Actor, search?: string) =>
      request<TargetOptions>(
        `/api/advertisements/target-options${search ? `?search=${encodeURIComponent(search)}` : ''}`,
        { actorId },
      ),
    forAdvertisement: (actorId: Actor, adId: number) =>
      request<Placement[]>(`/api/advertisements/${adId}/targets`, { actorId }),
    attach: (actorId: Actor, adId: number, body: PlacementInput) =>
      request<Placement>(`/api/advertisements/${adId}/targets`, { method: 'POST', body, actorId }),
    detach: (actorId: Actor, placementId: number) =>
      request<void>(`/api/advertisements/targets/${placementId}`, { method: 'DELETE', actorId }),
  },

  /** What the player calls. No actor: viewers, including guests, hit these. */
  serving: {
    // No viewer is passed: the server takes it from the bearer token, because a
    // delivery record naming a viewer the caller chose is not a record of
    // anything. A guest simply has no token and counts as a guest.
    active: (videoId: number, slot: SlotPosition, opts: { device?: string } = {}) => {
      const query = new URLSearchParams({ videoId: String(videoId), slot })
      if (opts.device) query.set('device', opts.device)
      return request<ServedAd[]>(`/api/ads/active?${query}`)
    },
  },
}

function range(from?: string, to?: string) {
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  return query.toString() ? `?${query}` : ''
}

/* ---------------------------------------------------------------- helpers */

/** `2026-09-21T14:30:00` from a date input's `2026-09-21`. */
export const startOfDay = (date: string) => `${date}T00:00:00`
/** The end of a day, so "to the 30th" includes the 30th. */
export const endOfDay = (date: string) => `${date}T23:59:59`
/** The `yyyy-mm-dd` half of an API timestamp, for a date input. */
export const dateOnly = (timestamp: string | null | undefined) =>
  timestamp ? timestamp.slice(0, 10) : ''

/** What the viewer's device looks like, for the delivery breakdown. */
export function deviceKind(): string {
  if (typeof window === 'undefined') return 'Unknown'
  const width = window.innerWidth
  return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
}
