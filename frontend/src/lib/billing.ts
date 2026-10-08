import { request, requestBlob, submitForm } from './api'

/** Billing preview is server-backed simulation only. No card credentials or real-money checkout. */
export type DemoPlan = {
  id: number
  planName: string
  durationDays: number
  price: number
  adFree: boolean
  benefit: string | null
}
export type PlansResponse = { demoEnabled: boolean; previewMode: boolean; currency: string; plans: DemoPlan[] }
export type BillingContact = { fullName: string; email: string; phone: string; addressLine1: string; addressLine2: string; city: string; postalCode: string; country: 'LK' }
export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX'
export type OrderView = {
  id: number; planName: string; amount?: number; currency?: string; method?: string; paymentMethod?: string;
  brand?: CardBrand | null; cardBrand?: CardBrand | null; status: string; reference?: string | null;
  createdAt?: string | null; submittedAt?: string | null; billing?: BillingContact | null;
  fullName?: string | null; email?: string | null; note?: string | null; decisionNote?: string | null;
  hasSlip?: boolean; slipAvailable?: boolean
}
export const SAMPLE_BANK_INSTRUCTIONS = 'Sample only: use a fictional reference such as SAMPLE-001. Do not send money to any bank account or upload a real transfer receipt.'
export function validateBilling(billing: BillingContact): Partial<Record<keyof BillingContact, string>> {
  const errors: Partial<Record<keyof BillingContact, string>> = {}
  if (billing.fullName.trim().length < 2 || billing.fullName.trim().length > 100) errors.fullName = 'Enter your full name (2–100 characters).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email.trim()) || billing.email.length > 254) errors.email = 'Enter a valid email address.'
  if (!/^\+?[0-9 ()-]{9,20}$/.test(billing.phone.trim())) errors.phone = 'Enter a valid contact phone number.'
  if (!billing.addressLine1.trim() || billing.addressLine1.length > 160) errors.addressLine1 = 'Enter your street address.'
  if (billing.addressLine2.length > 160) errors.addressLine2 = 'Keep the second address line under 160 characters.'
  if (!billing.city.trim() || billing.city.length > 80) errors.city = 'Enter your city.'
  if (!billing.postalCode.trim() || billing.postalCode.length > 20) errors.postalCode = 'Enter your postal code.'
  if (billing.country !== 'LK') errors.country = 'Only Sri Lanka is supported.'
  return errors
}
export function validateSlip(slip: File | null): string | null {
  if (!slip) return 'Upload a sample image or PDF slip.'
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(slip.type) || !/\.(pdf|png|jpe?g)$/i.test(slip.name)) return 'Use a PDF, PNG, or JPEG image.'
  if (!slip.size || slip.size > 5 * 1024 * 1024) return 'Slip must be nonempty and no larger than 5 MB.'
  return null
}
function cleanBilling(input: BillingContact) {
  const errors = validateBilling(input)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()])) as BillingContact
}
export type SubscriptionStatus = {
  adFree: boolean
  premium: boolean
  planName: string | null
  startDate: string | null
  endDate: string | null
  status: string | null
}
export type DemoPayment = {
  id: number
  amount: number
  currency?: string | null
  paidDatetime: string | null
  payMethod: string | null
  payStatus: string | null
  planName: string | null
  reference?: string | null
  cardBrand?: string | null
  cardLast4?: string | null
}

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string
export type RefundCategory = 'ACCIDENTAL_PURCHASE' | 'TECHNICAL_ISSUE' | 'DUPLICATE_PURCHASE' | 'SERVICE_DISSATISFACTION' | 'OTHER'
export const REFUND_CATEGORIES: { value: RefundCategory; label: string }[] = [
  { value: 'ACCIDENTAL_PURCHASE', label: 'Accidental purchase' },
  { value: 'TECHNICAL_ISSUE', label: 'Technical issue' },
  { value: 'DUPLICATE_PURCHASE', label: 'Duplicate purchase' },
  { value: 'SERVICE_DISSATISFACTION', label: 'Service dissatisfaction' },
  { value: 'OTHER', label: 'Other' },
]
export type RefundRequest = {
  id: number
  paymentId: number
  subscriptionId: number | null
  planName: string | null
  amount: number | null
  currency: string | null
  category: RefundCategory | string
  simulation: boolean
  eligibleUntil: string | null
  reason: string
  status: RefundStatus
  requestedAt: string
  processedById: number | null
  processedByUsername: string | null
  processedByEmail: string | null
  decidedAt: string | null
  processingNote: string | null
  username: string | null
  email: string | null
}
export type RefundEligibility = {
  eligible: boolean
  reason: string
  windowDays: number
  eligibleUntil?: string | null
}
export type RefundHistoryEntry = {
  id?: number
  refundId?: number
  fromStatus: string | null
  toStatus: string
  changedById?: number | null
  changedByUsername?: string | null
  note?: string | null
  changedAt?: string | null
}
export type AdminRefundFilters = { status: string; category: string; q: string; from?: string; to?: string; page: number; size: number }
export type RefundPage = {
  content: RefundRequest[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}
export type AdminSubscription = {
  userId: number
  username: string
  displayName: string
  email: string | null
  subscriptionId: number | null
  planName: string | null
  status: string
  startDate: string | null
  endDate: string | null
  payment: DemoPayment | null
  refund: RefundRequest | null
}

/** Legacy arrays are readable, but cannot implicitly switch on a checkout. */
export function normalizePlans(payload: DemoPlan[] | { demoEnabled?: boolean; previewMode?: boolean; currency?: string; plans: DemoPlan[] }): PlansResponse {
  if (Array.isArray(payload)) return { demoEnabled: false, previewMode: false, currency: 'LKR', plans: payload }
  return { demoEnabled: payload.demoEnabled === true, previewMode: payload.previewMode === true, currency: payload.currency || 'LKR', plans: Array.isArray(payload.plans) ? payload.plans : [] }
}
export const monthlyPreviewPlan = (plans: PlansResponse) => plans.plans.find((plan) => plan.planName === 'MONTHLY')
export const reviewableOrders = (orders: OrderView[]) => orders.filter((order) => ['PENDING_REVIEW', 'SUBMITTED'].includes(order.status))

export function validateRefundReason(reason: string) {
  const clean = reason.trim().replace(/\s+/g, ' ')
  if (clean.length < 10) return 'Explain the refund request in at least 10 characters.'
  if (clean.length > 255) return 'Keep the refund reason under 255 characters.'
  return null
}

export function validateRefundDecision(decision: 'APPROVED' | 'REJECTED', note: string) {
  if (decision === 'REJECTED' && !note.trim()) return 'A rejection note is required.'
  if (note.trim().length > 500) return 'Keep the decision note under 500 characters.'
  return null
}

export function buildAdminRefundQuery(filters: AdminRefundFilters, includePaging = true) {
  const query = new URLSearchParams()
  if (filters.status) query.set('status', filters.status)
  if (filters.category) query.set('category', filters.category)
  if (filters.q.trim()) query.set('q', filters.q.trim())
  if (filters.from) query.set('requestedFrom', filters.from)
  if (filters.to) query.set('requestedTo', filters.to)
  if (includePaging) {
    query.set('page', String(Math.max(0, Math.floor(filters.page))))
    query.set('size', String(Math.max(1, Math.floor(filters.size))))
  }
  return query.toString()
}

export function normalizeUnreadCount(payload: unknown) {
  if (typeof payload === 'number') return Math.max(0, Math.floor(payload))
  if (payload && typeof payload === 'object' && typeof (payload as { count?: unknown }).count === 'number') {
    return Math.max(0, Math.floor((payload as { count: number }).count))
  }
  return 0
}

export const billing = {
  plans: async (signal?: AbortSignal) => normalizePlans(await request<DemoPlan[] | { demoEnabled?: boolean; previewMode?: boolean; currency?: string; plans: DemoPlan[] }>('/api/billing/plans', { signal })),
  orders: (actorId: number, signal?: AbortSignal) => request<OrderView[]>('/api/billing/orders', { actorId, signal }),
  cardPreview: (brand: CardBrand, contact: BillingContact, actorId: number) => {
    if (!['VISA', 'MASTERCARD', 'AMEX'].includes(brand)) throw new Error('Choose a supported preview brand.')
    return request<OrderView>('/api/billing/orders/card-preview', { method: 'POST', actorId, body: { planName: 'MONTHLY', brand, billing: cleanBilling(contact) } })
  },
  bankTransfer: (contact: BillingContact, reference: string, slip: File | null, actorId: number) => {
    const billingContact = cleanBilling(contact)
    const error = validateSlip(slip)
    if (error || !slip) throw new Error(error || 'Upload a sample slip.')
    if (reference.trim().length > 100) throw new Error('Keep the sample reference under 100 characters.')
    const form = new FormData()
    form.append('planName', 'MONTHLY'); form.append('billing', JSON.stringify(billingContact))
    if (reference.trim()) form.append('reference', reference.trim())
    form.append('slip', slip)
    return submitForm<OrderView>('/api/billing/orders/bank-transfer', form, actorId)
  },
  adminOrders: (signal?: AbortSignal) => request<OrderView[]>('/api/billing/admin/orders', { signal }),
  adminSlip: (id: number) => requestBlob(`/api/billing/admin/orders/${id}/slip`),
  decideOrder: (id: number, decision: 'APPROVED' | 'REJECTED', note: string) => {
    if (!Number.isInteger(id) || id <= 0 || !['APPROVED', 'REJECTED'].includes(decision)) throw new Error('Invalid order decision.')
    if (decision === 'REJECTED' && !note.trim()) throw new Error('A rejection note is required.')
    if (note.length > 500) throw new Error('Keep the note under 500 characters.')
    return request<OrderView>(`/api/billing/admin/orders/${id}/decision`, { method: 'POST', body: { decision, note: note.trim() } })
  },
  status: (actorId: number, signal?: AbortSignal) => request<SubscriptionStatus>('/api/billing/status', { actorId, signal }),
  payments: (actorId: number, signal?: AbortSignal) => request<DemoPayment[]>('/api/billing/payments', { actorId, signal }),
  cancel: (actorId: number) => request<SubscriptionStatus>('/api/billing/cancel', { method: 'POST', actorId }),
  refunds: (actorId: number, signal?: AbortSignal) => request<RefundRequest[]>('/api/billing/refunds', { actorId, signal }),
  refundEligibility: (paymentId: number, actorId: number, signal?: AbortSignal) => request<RefundEligibility>(`/api/billing/payments/${paymentId}/refund-eligibility`, { actorId, signal }),
  requestRefund: (paymentId: number, category: RefundCategory, reason: string, actorId: number) => {
    if (!Number.isInteger(paymentId) || paymentId <= 0) throw new Error('Choose a valid payment.')
    if (!REFUND_CATEGORIES.some((item) => item.value === category)) throw new Error('Choose a refund category.')
    const error = validateRefundReason(reason)
    if (error) throw new Error(error)
    return request<RefundRequest>(`/api/billing/payments/${paymentId}/refunds`, { method: 'POST', actorId, body: {
      category,
      reason: reason.trim().replace(/\s+/g, ' '),
    } })
  },
  cancelRefund: (id: number, actorId: number) => request<RefundRequest>(`/api/billing/refunds/${id}/cancel`, { method: 'POST', actorId }),
  refundHistory: (id: number, actorId: number, signal?: AbortSignal) => request<RefundHistoryEntry[]>(`/api/billing/refunds/${id}/history`, { actorId, signal }),
  adminUsers: (signal?: AbortSignal) => request<AdminSubscription[]>('/api/billing/admin/users', { signal }),
  adminRefunds: (filters: AdminRefundFilters, signal?: AbortSignal) => request<RefundPage>(`/api/billing/admin/refunds?${buildAdminRefundQuery(filters)}`, { signal }),
  pendingRefundCount: async (signal?: AbortSignal) => normalizeUnreadCount(await request<unknown>('/api/billing/admin/refunds/pending-count', { signal })),
  exportRefunds: (filters: AdminRefundFilters, signal?: AbortSignal) => requestBlob(`/api/billing/admin/refunds/export.csv?${buildAdminRefundQuery(filters, false)}`, { signal }),
  decideRefund: async (id: number, status: 'APPROVED' | 'REJECTED', decisionNote: string) => {
    const error = validateRefundDecision(status, decisionNote)
    if (error) throw new Error(error)
    return request<RefundRequest>(`/api/billing/admin/refunds/${id}/decision`, {
      method: 'POST', body: { decision: status, note: decisionNote.trim() || null },
    })
  },
}
