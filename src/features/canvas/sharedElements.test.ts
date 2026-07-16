import { describe, expect, it } from 'vitest'
import {
  createEmptySharedElementLibrary,
  deleteSharedElement,
  ensureSharedRole,
  normalizeSharedElementLibrary,
} from './sharedElements'

describe('shared element library', () => {
  it('creates one normalized shared role for repeated free-form RASIC input', () => {
    const library = createEmptySharedElementLibrary()
    const first = ensureSharedRole(library, ' DRE ')
    const second = ensureSharedRole(first.library, 'dre')

    expect(second.role.id).toBe(first.role.id)
    expect(Object.values(second.library.roles)).toEqual([
      expect.objectContaining({ id: first.role.id, name: 'DRE' }),
    ])
  })

  it('keeps existing library data compatible when the shared library is missing', () => {
    expect(normalizeSharedElementLibrary(undefined)).toEqual(createEmptySharedElementLibrary())
  })

  it('removes a deleted role from every activity responsibility', () => {
    const library = {
      ...createEmptySharedElementLibrary(),
      roles: { 'role-dre': { id: 'role-dre', name: 'DRE', description: '' } },
      activities: {
        'activity-review': {
          id: 'activity-review',
          title: 'Review report',
          summary: '',
          expectations: '',
          responsibilities: [
            { id: 'r1', roleId: 'role-dre', kind: 'responsible' as const },
          ],
          workProductLinks: [],
        },
      },
    } satisfies ReturnType<typeof createEmptySharedElementLibrary>

    const result = deleteSharedElement(library, 'role', 'role-dre')

    expect(result.library.roles).toEqual({})
    expect(result.library.activities['activity-review']?.responsibilities).toEqual([])
    expect(result.impact.activities).toEqual(['activity-review'])
  })

  it('removes a deleted work product from every shared Activity link', () => {
    const library = {
      ...createEmptySharedElementLibrary(),
      workProducts: { 'wp-report': { id: 'wp-report', title: 'Report', state: 'Draft', description: '' } },
      activities: {
        'activity-review': {
          id: 'activity-review', title: 'Review', summary: '', expectations: '', responsibilities: [],
          workProductLinks: [{ id: 'link-1', workProductId: 'wp-report', relation: 'input' as const, maturity: 'Draft' }],
        },
      },
    } satisfies ReturnType<typeof createEmptySharedElementLibrary>

    const result = deleteSharedElement(library, 'workProduct', 'wp-report')
    expect(result.library.workProducts).toEqual({})
    expect(result.library.activities['activity-review']?.workProductLinks).toEqual([])
    expect(result.impact.activities).toEqual(['activity-review'])
  })
})
