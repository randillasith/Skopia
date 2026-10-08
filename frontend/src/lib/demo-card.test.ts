import { describe, expect, it } from 'vitest'
import { DEMO_CARDS, formatCardNumber, formatExpiry, demoBrand, validateDemoCard, previewCardNumber, futureDemoExpiry } from './demo-card'
const today = new Date(2026, 9, 8)
describe('local synthetic-card validation', () => {
  it('accepts only approved Visa and Mastercard examples with correct checksums', () => {
    expect(demoBrand(DEMO_CARDS.VISA)).toBe('VISA')
    expect(demoBrand(DEMO_CARDS.MASTERCARD)).toBe('MASTERCARD')
    for (const value of Object.values(DEMO_CARDS)) expect(validateDemoCard(value, '10/26', today)).toEqual({})
    for (const value of ['', '4'.repeat(16), '4'+'2'.repeat(12), DEMO_CARDS.VISA.slice(0,15)+'2', 'hello', DEMO_CARDS.VISA+'0']) {
      expect(validateDemoCard(value, '10/26', today).number).toBeTruthy()
      expect(demoBrand(value)).toBeNull()
    }
    expect(demoBrand(DEMO_CARDS.VISA+' letters')).toBeNull()
  })
  it('accepts current month through month end, rejects past or malformed expiry', () => {
    for (const expiry of ['', '00/27', '13/27', '9/27', '10/2026', '09/26']) expect(validateDemoCard(DEMO_CARDS.VISA, expiry, today).expiry).toBeTruthy()
    expect(validateDemoCard(DEMO_CARDS.VISA, '10/26', new Date(2026,9,31,23,59))).toEqual({})
    expect(validateDemoCard(DEMO_CARDS.VISA, '10/26', new Date(2026,10,1)).expiry).toBeTruthy()
    expect(validateDemoCard(DEMO_CARDS.MASTERCARD, futureDemoExpiry(today), today)).toEqual({})
  })
  it('formats number and expiry progressively, without accepting arbitrary text', () => {
    expect(formatCardNumber('41111')).toBe('4111 1')
    expect(formatCardNumber('4111-1111')).toBe('4111 1111')
    expect(formatExpiry('1')).toBe('1')
    expect(formatExpiry('1026')).toBe('10/26')
  })
  it('only reveals approved synthetic numbers with valid expiry on the preview', () => {
    expect(previewCardNumber(DEMO_CARDS.VISA, '10/26', today)).toBe(formatCardNumber(DEMO_CARDS.VISA))
    expect(previewCardNumber(DEMO_CARDS.VISA, '09/26', today)).toBe('•••• •••• •••• ••••')
    expect(previewCardNumber('4'.repeat(16), '10/26', today)).toBe('•••• •••• •••• ••••')
    expect(previewCardNumber('', '', today)).toBe('•••• •••• •••• ••••')
  })
})
