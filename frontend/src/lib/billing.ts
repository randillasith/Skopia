import { request } from './api'

/** Billing is a server-backed DEMO only. No card or real-money checkout exists here. */
export type DemoPlan = {
  id: number
  planName: string
  durationDays: number
  price: number
  benefit: string | null
}
export type PlansResponse = { demoEnabled: boolean; plans: DemoPlan[] }
export type SubscriptionStatus = {
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
}
export type PlanChoice = 'MONTHLY' | 'YEARLY'
export type DemoPaymentInput = { cardNumber: string; expiry: string; cardholderName: string }
export type AdminSubscription = { userId: number; username: string; displayName: string; planName: string | null; status: string; startDate: string | null; endDate: string | null }
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
  cancel: (actorId: number) => request<unknown>('/api/billing/cancel', { method: 'POST', actorId }),
  adminUsers: (signal?: AbortSignal) => request<AdminSubscription[]>('/api/billing/admin/users', { signal }),
}
