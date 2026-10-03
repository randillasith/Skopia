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

/** Legacy arrays are readable, but cannot implicitly switch on a checkout. */
export function normalizePlans(payload: DemoPlan[] | PlansResponse): PlansResponse {
  if (Array.isArray(payload)) return { demoEnabled: false, plans: payload }
  return { demoEnabled: payload.demoEnabled === true, plans: Array.isArray(payload.plans) ? payload.plans : [] }
}

export const billing = {
  plans: async (signal?: AbortSignal) => normalizePlans(await request<DemoPlan[] | PlansResponse>('/api/billing/plans', { signal })),
  status: (actorId: number, signal?: AbortSignal) => request<SubscriptionStatus>('/api/billing/status', { actorId, signal }),
  payments: (actorId: number, signal?: AbortSignal) => request<DemoPayment[]>('/api/billing/payments', { actorId, signal }),
  checkout: async (planName: PlanChoice, actorId: number) => {
    if (planName !== 'MONTHLY' && planName !== 'YEARLY') throw new Error('Unknown plan')
    return request<unknown>('/api/billing/checkout', { method: 'POST', actorId, body: { planName } })
  },
  cancel: (actorId: number) => request<unknown>('/api/billing/cancel', { method: 'POST', actorId }),
}
