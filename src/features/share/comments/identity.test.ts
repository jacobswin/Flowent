import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  COMMENT_NAME_MAX,
  COMMENT_ROLE_MAX,
  generateAnonymousId,
  readIdentity,
  validateIdentity,
  writeIdentity,
  type StakeholderIdentity,
} from './identity'

const STORAGE_KEY = 'flowent.stakeholder-identity.v1'

function clearStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

beforeEach(() => {
  clearStorage()
})

afterEach(() => {
  clearStorage()
})

describe('identity', () => {
  it('writeIdentity then readIdentity roundtrips', () => {
    writeIdentity({ anonymousId: 'id-1', name: 'Alex', role: 'PM' })
    const got = readIdentity()

    expect(got).toEqual({
      anonymousId: 'id-1',
      name: 'Alex',
      role: 'PM',
      updatedAt: got?.updatedAt,
    })
  })

  it('readIdentity returns null when nothing is stored', () => {
    expect(readIdentity()).toBeNull()
  })

  it('readIdentity returns null when the stored value is malformed', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(readIdentity()).toBeNull()

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ anonymousId: 'x' }))
    expect(readIdentity()).toBeNull()
  })

  it('writeIdentity overwrites a previous identity', () => {
    writeIdentity({ anonymousId: 'id-1', name: 'Alex', role: 'PM' })
    writeIdentity({ anonymousId: 'id-2', name: 'Sam', role: 'Design' })

    expect(readIdentity()?.name).toBe('Sam')
    expect(readIdentity()?.anonymousId).toBe('id-2')
  })

  it('validateIdentity accepts a valid identity and rejects bad ones', () => {
    const good: StakeholderIdentity = {
      anonymousId: 'id-1',
      name: 'Alex',
      role: 'PM',
      updatedAt: new Date().toISOString(),
    }

    expect(validateIdentity(good)).toBe(good)

    expect(() => validateIdentity({ ...good, name: '' })).toThrow(/name/)
    expect(() => validateIdentity({ ...good, name: 'A'.repeat(COMMENT_NAME_MAX + 1) })).toThrow(/name/)
    expect(() => validateIdentity({ ...good, role: '' })).toThrow(/role/)
    expect(() => validateIdentity({ ...good, role: 'R'.repeat(COMMENT_ROLE_MAX + 1) })).toThrow(/role/)
    expect(() => validateIdentity({ ...good, anonymousId: '' })).toThrow(/anonymousId/)
  })

  it('generateAnonymousId returns a non-empty string id', () => {
    const id = generateAnonymousId()

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(id).not.toEqual(generateAnonymousId())
  })
})
