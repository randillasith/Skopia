export type StaffType = 'ADMINISTRATOR' | 'SUPPORT_OFFICER' | 'MARKETING_OFFICER'
export type StaffOption = { value: string; label: string }
export type StaffCatalog = {
  staffTypes: StaffOption[]
  adminLevels: StaffOption[]
  supportLevels: StaffOption[]
  supportShifts: StaffOption[]
  marketingDepartments: StaffOption[]
}

export type StaffFormValues = {
  username?: string
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  staffType: StaffType
  designation: string
  hireDate: string
  adminLevel?: string
  supportLevel?: string
  shift?: string
  officerCode?: string
  department?: string
}

export function designationForStaffType(type: StaffType) {
  if (type === 'ADMINISTRATOR') return 'Administrator'
  if (type === 'MARKETING_OFFICER') return 'Marketing Officer'
  return 'Support Officer'
}

export function buildStaffAssignmentPayload(values: StaffFormValues, mode: 'assign' | 'create' | 'edit') {
  const common: Record<string, string> = {
    staffType: values.staffType,
    designation: designationForStaffType(values.staffType),
    hireDate: values.hireDate,
  }
  if (mode !== 'assign') {
    if (values.firstName?.trim()) common.firstName = values.firstName.trim()
    if (values.lastName?.trim()) common.lastName = values.lastName.trim()
  }
  if (mode === 'create') {
    common.username = values.username?.trim() ?? ''
    common.email = values.email?.trim().toLowerCase() ?? ''
    common.password = values.password ?? ''
  }
  if (values.staffType === 'ADMINISTRATOR') common.adminLevel = values.adminLevel ?? ''
  if (values.staffType === 'SUPPORT_OFFICER') {
    common.supportLevel = values.supportLevel ?? ''
    common.shift = values.shift ?? ''
  }
  if (values.staffType === 'MARKETING_OFFICER') {
    common.department = values.department ?? ''
  }
  return common
}

export function passwordValidationMessage(value: string) {
  if (value.length < 8) return 'Use at least 8 characters.'
  if (new TextEncoder().encode(value).length > 72) return 'Use no more than 72 UTF-8 bytes.'
  return null
}

export function staffKind(value: string | null | undefined) {
  const normalized = (value ?? '').toUpperCase()
  if (normalized.includes('ADMIN')) return 'admin'
  if (normalized.includes('SUPPORT')) return 'support'
  if (normalized.includes('MARKETING')) return 'marketing'
  return null
}

export function optionLabel(options: StaffOption[], value: string | null | undefined) {
  if (!value) return null
  return options.find((option) => option.value === value)?.label ?? `Legacy value: ${value}`
}
