/** Only these synthetic examples are allowed. No real card is accepted or transmitted. */
export const DEMO_CARDS = {
  VISA: '4' + '1'.repeat(15),
  MASTERCARD: ['5555', '5555', '5555', '4444'].join(''),
} as const
export type DemoBrand = keyof typeof DEMO_CARDS
const digits = (value: string) => value.replace(/[ -]/g, '')
function luhn(value: string) {
  let sum = 0
  for (let i = value.length - 1, double = false; i >= 0; i--, double = !double) {
    let n = Number(value[i]) * (double ? 2 : 1)
    if (n > 9) n -= 9
    sum += n
  }
  return sum % 10 === 0
}
export function demoBrand(value: string): DemoBrand | null {
  const number = digits(value)
  if (!/^\d{16}$/.test(number) || !luhn(number)) return null
  if (/^4/.test(number) && number === DEMO_CARDS.VISA) return 'VISA'
  if (/^5[1-5]/.test(number) && number === DEMO_CARDS.MASTERCARD) return 'MASTERCARD'
  return null
}
export function validateDemoCard(number: string, expiry: string, now = new Date()) {
  const errors: { number?: string; expiry?: string } = {}
  if (!demoBrand(number)) errors.number = 'Use the Visa or Mastercard test example below. Real cards are not accepted.'
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry)
  if (!match) errors.expiry = 'Enter an expiry in MM/YY format.'
  else if (Number(match[2]) + 2000 < now.getFullYear() || (Number(match[2]) + 2000 === now.getFullYear() && Number(match[1]) < now.getMonth() + 1)) errors.expiry = 'Use the current month or a future month.'
  return errors
}
export const formatCardNumber = (value: string) => value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ')
export const formatExpiry = (value: string) => value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')
export const futureDemoExpiry = (now = new Date()) => `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 2).slice(-2)}`
export function previewCardNumber(number: string, expiry: string, now = new Date()) {
  return Object.keys(validateDemoCard(number, expiry, now)).length === 0 ? formatCardNumber(number) : '•••• •••• •••• ••••'
}
