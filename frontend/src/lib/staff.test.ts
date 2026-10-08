import { describe, expect, it } from 'vitest'
import {
  buildStaffAssignmentPayload,
  passwordValidationMessage,
  staffKind,
  type StaffFormValues,
} from './staff'

const base: StaffFormValues = {
  username: 'new_staff',
  email: 'new@example.test',
  password: 'temporary-password',
  firstName: 'New',
  lastName: 'Staff',
  staffType: 'SUPPORT_OFFICER',
  designation: 'Support specialist',
  hireDate: '2026-10-08',
  adminLevel: 'SUPER',
  supportLevel: 'TIER_2',
  shift: 'EVENING',
  officerCode: 'MKT-9',
  department: 'PARTNERSHIPS',
}

describe('staff payloads', () => {
  it('keeps only support fields for an assignment', () => {
    expect(buildStaffAssignmentPayload(base, 'assign')).toEqual({
      staffType: 'SUPPORT_OFFICER',
      designation: 'Support specialist',
      hireDate: '2026-10-08',
      supportLevel: 'TIER_2',
      shift: 'EVENING',
    })
  })

  it('keeps account credentials only when creating a new staff account', () => {
    const payload = buildStaffAssignmentPayload({ ...base, staffType: 'ADMINISTRATOR' }, 'create')
    expect(payload).toEqual({
      username: 'new_staff',
      email: 'new@example.test',
      password: 'temporary-password',
      firstName: 'New',
      lastName: 'Staff',
      staffType: 'ADMINISTRATOR',
      designation: 'Support specialist',
      hireDate: '2026-10-08',
      adminLevel: 'SUPER',
    })
    expect(payload).not.toHaveProperty('supportLevel')
    expect(payload).not.toHaveProperty('shift')
  })

  it('recognises canonical staff values without hardcoding the catalogue list', () => {
    expect(staffKind('ADMINISTRATOR')).toBe('admin')
    expect(staffKind('SUPPORT_OFFICER')).toBe('support')
    expect(staffKind('MARKETING_OFFICER')).toBe('marketing')
  })

  it('validates temporary passwords by characters and UTF-8 bytes', () => {
    expect(passwordValidationMessage('short')).toBe('Use at least 8 characters.')
    expect(passwordValidationMessage('😀'.repeat(19))).toBe('Use no more than 72 UTF-8 bytes.')
    expect(passwordValidationMessage('correct horse')).toBeNull()
  })
})
