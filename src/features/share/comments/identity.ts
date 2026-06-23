import { COMMENT_NAME_MAX, COMMENT_ROLE_MAX } from './commentTypes'

export { COMMENT_NAME_MAX, COMMENT_ROLE_MAX }

const STORAGE_KEY = 'flowent.stakeholder-identity.v1'

export interface StakeholderIdentity {
  anonymousId: string
  name: string
  role: string
  updatedAt: string
}

export interface IdentityInput {
  anonymousId: string
  name: string
  role: string
}

export function generateAnonymousId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `anon-${timestamp}-${random}`
}

export function validateIdentity(value: unknown): StakeholderIdentity {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Identity must be an object.')
  }

  const identity = value as Partial<StakeholderIdentity>
  if (typeof identity.anonymousId !== 'string' || identity.anonymousId.length === 0) {
    throw new Error('Identity anonymousId is required.')
  }

  const name = typeof identity.name === 'string' ? identity.name.trim() : ''
  if (name.length === 0) throw new Error('Identity name is required.')
  if (name.length > COMMENT_NAME_MAX) {
    throw new Error(`Identity name must be ${COMMENT_NAME_MAX} chars or fewer.`)
  }

  const role = typeof identity.role === 'string' ? identity.role.trim() : ''
  if (role.length === 0) throw new Error('Identity role is required.')
  if (role.length > COMMENT_ROLE_MAX) {
    throw new Error(`Identity role must be ${COMMENT_ROLE_MAX} chars or fewer.`)
  }

  if (typeof identity.updatedAt !== 'string' || identity.updatedAt.length === 0) {
    throw new Error('Identity updatedAt is required.')
  }

  if (identity.name === name && identity.role === role) return identity as StakeholderIdentity

  return {
    anonymousId: identity.anonymousId,
    name,
    role,
    updatedAt: identity.updatedAt,
  }
}

export function writeIdentity(input: IdentityInput): StakeholderIdentity {
  const identity = validateIdentity({
    anonymousId: input.anonymousId,
    name: input.name.trim(),
    role: input.role.trim(),
    updatedAt: new Date().toISOString(),
  })

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    /* localStorage may be unavailable in private mode; ignore for v1 */
  }

  return identity
}

export function readIdentity(): StakeholderIdentity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return validateIdentity(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function clearIdentity(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

export const __test = { STORAGE_KEY }
