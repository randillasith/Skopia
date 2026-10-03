import { request } from './api'

/** Billing is a server-backed DEMO only. No card or real-money checkout exists here. */
export type DemoPlan = {
  id: number
  planName: string
  durationDays: number
  price: number
  adFree: boolean
  benefit: string | null
}
export type PlansResponse = { demoEnabled: boolean; plans: DemoPlan[] }
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
  paidDatetime: string | null
  payMethod: string | null
  payStatus: string | null
  planName: string | null
  reference?: string | null
  cardBrand?: string | null
  cardLast4?: string | null
}
export type PlanChoice = 'MONTHLY' | 'YEARLY'
export type DemoPaymentInput = { cardNumber: string; expiry: string; cardholderName: string }
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string
export type RefundRequest = {
  id: number
  paymentId: number
  subscriptionId: number | null
  planName: string | null
  amount: number | null
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
export const DEMO_TEST_CARD = '4216 0000 0000 0002'

const luhn = (value: string) => {
  let sum = 0; let doubleDigit = false
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = Number(value[i])
    if (doubleDigit && (digit *= 2) > 9) digit -= 9
    sum += digit; doubleDigit = !doubleDigit
  }
  return sum % 10 === 0
}

export function validateDemoPayment(input: DemoPaymentInput) {
  const errors: Partial<Record<keyof DemoPaymentInput, string>> = {}
  const card = input.cardNumber.replace(/[ -]/g, '')
  if (!/^4216\d{12}$/.test(card) || !luhn(card)) errors.cardNumber = `Use the exact demo card ${DEMO_TEST_CARD}; other 4216 numbers may fail the checksum.`
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(input.expiry)
  if (!match) errors.expiry = 'Use MM/YY.'
  else {
    const end = new Date(2000 + Number(match[2]), Number(match[1]), 0, 23, 59, 59)
    if (end < new Date()) errors.expiry = 'The test expiry must be in the future.'
  }
  const name = input.cardholderName.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80 || !/^\p{L}[\p{L} .'-]*[\p{L}.]$/u.test(name)) errors.cardholderName = 'Enter a reasonable test cardholder name.'
  return errors
}

/** Legacy arrays are readable, but cannot implicitly switch on a checkout. */
export function normalizePlans(payload: DemoPlan[] | PlansResponse): PlansResponse {
  if (Array.isArray(payload)) return { demoEnabled: false, plans: payload }
  return { demoEnabled: payload.demoEnabled === true, plans: Array.isArray(payload.plans) ? payload.plans : [] }
}

export function validateRefundReason(reason: string) {
  const clean = reason.trim().replace(/\s+/g, ' ')
  if (clean.length < 10) return 'Explain the refund request in at least 10 characters.'
  if (clean.length > 255) return 'Keep the refund reason under 255 characters.'
  return null
}

export function normalizeUnreadCount(payload: unknown) {
  if (typeof payload === 'number') return Math.max(0, Math.floor(payload))
  if (payload && typeof payload === 'object' && typeof (payload as { count?: unknown }).count === 'number') {
    return Math.max(0, Math.floor((payload as { count: number }).count))
  }
  return 0
}

export const billing = {
  plans: async (signal?: AbortSignal) => normalizePlans(await request<DemoPlan[] | PlansResponse>('/api/billing/plans', { signal })),
  status: (actorId: number, signal?: AbortSignal) => request<SubscriptionStatus>('/api/billing/status', { actorId, signal }),
  payments: (actorId: number, signal?: AbortSignal) => request<DemoPayment[]>('/api/billing/payments', { actorId, signal }),
  checkout: async (planName: PlanChoice, payment: DemoPaymentInput, actorId: number) => {
    if (planName !== 'MONTHLY' && planName !== 'YEARLY') throw new Error('Unknown plan')
    const errors = validateDemoPayment(payment)
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
    return request<unknown>('/api/billing/checkout', { method: 'POST', actorId, body: {
      planName, cardNumber: payment.cardNumber.replace(/[ -]/g, ''), expiry: payment.expiry,
      cardholderName: payment.cardholderName.trim().replace(/\s+/g, ' '),
    } })
  },
  cancel: (actorId: number) => request<SubscriptionStatus>('/api/billing/cancel', { method: 'POST', actorId }),
  changePlan: (planName: PlanChoice, actorId: number) => {
    if (planName !== 'MONTHLY' && planName !== 'YEARLY') throw new Error('Unknown plan')
    return request<unknown>('/api/billing/change-plan', { method: 'POST', actorId, body: { planName } })
  },
  refunds: (actorId: number, signal?: AbortSignal) => request<RefundRequest[]>('/api/billing/refunds', { actorId, signal }),
  requestRefund: (paymentId: number, reason: string, actorId: number) => {
    if (!Number.isInteger(paymentId) || paymentId <= 0) throw new Error('Choose a valid payment.')
    const error = validateRefundReason(reason)
    if (error) throw new Error(error)
    return request<RefundRequest>(`/api/billing/payments/${paymentId}/refunds`, { method: 'POST', actorId, body: {
      reason: reason.trim().replace(/\s+/g, ' '),
    } })
  },
  adminUsers: (signal?: AbortSignal) => request<AdminSubscription[]>('/api/billing/admin/users', { signal }),
  adminRefunds: (signal?: AbortSignal) => request<RefundRequest[]>('/api/billing/admin/refunds', { signal }),
  decideRefund: (id: number, status: 'APPROVED' | 'REJECTED', decisionNote: string) => request<RefundRequest>(`/api/billing/admin/refunds/${id}/decision`, {
    method: 'POST', body: { decision: status, note: decisionNote.trim() || null },
  }),
}
