/**
 * Reports a viewer files, and the complaints an officer works.
 *
 * Both endpoints identify their actors by path or query parameter rather than by
 * header, which is the convention those modules were written to. That is the
 * server's choice and is followed here rather than argued with.
 */

import { request } from './api'

/* ----------------------------------------------------------------- reports */

/** The categories the server accepts. Anything else is refused as invalid. */
export const REPORT_TYPES = [
  'INAPPROPRIATE_CONTENT',
  'PLAYBACK_ISSUE',
  'ACCESSIBILITY_ISSUE',
  'TECHNICAL_ISSUE',
  'OTHER',
] as const
export type ServerReportType = (typeof REPORT_TYPES)[number]

export type ServerReportStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED'

export type ServerReport = {
  id: number
  viewerId: number
  type: ServerReportType
  details: string
  contentReference: string | null
  status: ServerReportStatus
  createdAt: string
  updatedAt: string | null
}

/** What each category is called on screen, and how to read one back. */
export const REPORT_TYPE_LABEL: Record<ServerReportType, string> = {
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  PLAYBACK_ISSUE: 'Playback problem',
  ACCESSIBILITY_ISSUE: 'Accessibility',
  TECHNICAL_ISSUE: 'Technical problem',
  OTHER: 'Other',
}

export const REPORT_STATUS_LABEL: Record<ServerReportStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  REJECTED: 'Closed',
}

export const REPORT_STATUS_TONE: Record<ServerReportStatus, 'review' | 'live' | 'ok' | 'neutral'> = {
  SUBMITTED: 'review',
  UNDER_REVIEW: 'live',
  RESOLVED: 'ok',
  REJECTED: 'neutral',
}

/** A report is finished when nobody is going to act on it again. */
export const isClosed = (status: ServerReportStatus) =>
  status === 'RESOLVED' || status === 'REJECTED'

export const reports = {
  submit: (input: {
    viewerId: number
    type: ServerReportType
    details: string
    contentReference: string | null
  }) => request<ServerReport>('/api/reports', { method: 'POST', body: input }),

  forViewer: (viewerId: number, signal?: AbortSignal) =>
    request<ServerReport[]>(`/api/reports/viewer/${viewerId}`, { signal }),

  one: (id: number, signal?: AbortSignal) => request<ServerReport>(`/api/reports/${id}`, { signal }),
}

/* -------------------------------------------------------------- complaints */

export type ComplaintStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type ServerComplaint = {
  id: number
  reportId: number | null
  reportingViewerId: number | null
  assignedOfficerId: number | null
  status: ComplaintStatus
  priority: ComplaintPriority
  resolutionNotes: string | null
  createdAt: string
  updatedAt: string | null
  closedAt: string | null
}

export type ComplaintHistoryEntry = {
  id: number
  action?: string | null
  notes?: string | null
  performedAt?: string | null
  performedBy?: number | null
}

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const COMPLAINT_STATUS_TONE: Record<
  ComplaintStatus,
  'review' | 'live' | 'ok' | 'neutral' | 'bad'
> = {
  OPEN: 'review',
  ASSIGNED: 'live',
  IN_PROGRESS: 'live',
  ESCALATED: 'bad',
  RESOLVED: 'ok',
  CLOSED: 'neutral',
}

export const complaints = {
  /** Escalate a report into something an officer owns. */
  fromReport: (reportId: number, viewerId: number) =>
    request<ServerComplaint>(
      `/api/complaints?reportId=${reportId}&viewerId=${viewerId}`,
      { method: 'POST' },
    ),

  queue: (signal?: AbortSignal) =>
    request<ServerComplaint[]>('/api/complaints/queue', { signal }),

  /** Without an officer or a viewer this answers with the open queue. */
  search: (params: { officerId?: number; viewerId?: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams()
    if (params.officerId != null) query.set('officerId', String(params.officerId))
    if (params.viewerId != null) query.set('viewerId', String(params.viewerId))
    const text = query.toString()
    return request<ServerComplaint[]>(`/api/complaints/search${text ? `?${text}` : ''}`, { signal })
  },

  assign: (id: number, officerId: number) =>
    request<ServerComplaint>(`/api/complaints/${id}/assign`, {
      method: 'POST',
      body: { officerId },
    }),

  updateStatus: (
    id: number,
    status: ComplaintStatus,
    priority: ComplaintPriority,
    officerId: number,
  ) =>
    request<ServerComplaint>(`/api/complaints/${id}/status?officerId=${officerId}`, {
      method: 'PUT',
      body: { status, priority },
    }),

  resolve: (id: number, resolutionNotes: string, officerId: number) =>
    request<ServerComplaint>(`/api/complaints/${id}/resolve?officerId=${officerId}`, {
      method: 'POST',
      body: { resolutionNotes },
    }),

  close: (id: number, officerId: number) =>
    request<ServerComplaint>(`/api/complaints/${id}/close?officerId=${officerId}`, {
      method: 'POST',
    }),

  history: (id: number, signal?: AbortSignal) =>
    request<ComplaintHistoryEntry[]>(`/api/complaints/${id}/history`, { signal }),
}

/* -------------------------------------------------- complaints, made legible */

/**
 * A complaint with the report it came from folded in.
 *
 * A `Complaint` row carries ids and a lifecycle and nothing a person can read —
 * what was actually reported lives on the `Report` it was raised from. The queue
 * is unusable without both, so they are fetched together and joined here rather
 * than in each screen.
 */
export type QueueItem = {
  complaint: ServerComplaint
  report: ServerReport | null
}

export async function loadQueue(
  complaintRows: ServerComplaint[],
  signal?: AbortSignal,
): Promise<QueueItem[]> {
  const ids = [...new Set(complaintRows.map((c) => c.reportId).filter((id): id is number => id != null))]
  // One failed report must not empty the whole queue, so each is settled on its
  // own and a complaint whose report cannot be read still lists.
  const settled = await Promise.allSettled(ids.map((id) => reports.one(id, signal)))
  const byId = new Map<number, ServerReport>()
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') byId.set(ids[i], outcome.value)
  })
  return complaintRows.map((complaint) => ({
    complaint,
    report: complaint.reportId != null ? byId.get(complaint.reportId) ?? null : null,
  }))
}

/** A one-line subject for a complaint, taken from what was reported. */
export const subjectOf = (item: QueueItem) =>
  item.report
    ? `${REPORT_TYPE_LABEL[item.report.type]} — ${item.report.details.slice(0, 60)}${
        item.report.details.length > 60 ? '…' : ''
      }`
    : `Complaint ${item.complaint.id}`

export const referenceOf = (complaint: ServerComplaint) =>
  `CMP-${String(complaint.id).padStart(4, '0')}`
