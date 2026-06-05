import { describe, expect, it } from 'vitest'
import type { SavedLibrary, SavedMap, SavedFolder } from './library'
import { buildTree, flattenTree, findFolder, findMap, mostRecentMap } from './library'

function lib(maps: SavedMap[], folders: SavedFolder[] = []): SavedLibrary {
  return { maps, folders }
}

function map(partial: Partial<SavedMap> = {}): SavedMap {
  return { id: 'm', name: 'M', folderId: null, order: 0, updatedAt: 0, ...partial }
}

function folder(partial: Partial<SavedFolder> = {}): SavedFolder {
  return { id: 'f', name: 'F', parentId: null, order: 0, ...partial }
}

describe('buildTree', () => {
  it('returns an empty array for an empty library', () => {
    expect(buildTree(lib([]))).toEqual([])
  })

  it('puts root maps and folders in the correct order', () => {
    const f = folder({ id: 'f1', order: 0 })
    const m1 = map({ id: 'm1', order: 0 })
    const m2 = map({ id: 'm2', order: 1 })
    const tree = buildTree(lib([m1, m2], [f]))
    expect(tree).toHaveLength(3)
    expect(tree[0].kind).toBe('folder')
    expect(tree[0].kind === 'folder' && tree[0].folder.id).toBe('f1')
    expect(tree[0].kind === 'folder' && tree[0].children).toEqual([])
    expect(tree[1].kind).toBe('map')
    expect(tree[1].kind === 'map' && tree[1].map.id).toBe('m1')
    expect(tree[2].kind).toBe('map')
    expect(tree[2].kind === 'map' && tree[2].map.id).toBe('m2')
  })

  it('nests maps inside their folder', () => {
    const f = folder({ id: 'f1' })
    const m = map({ id: 'm1', folderId: 'f1' })
    const tree = buildTree(lib([m], [f]))
    expect(tree).toHaveLength(1)
    if (tree[0].kind === 'folder') {
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].kind).toBe('map')
    } else {
      throw new Error('expected folder at root')
    }
  })

  it('sorts children by order', () => {
    const f1 = folder({ id: 'f1', order: 0 })
    const f2 = folder({ id: 'f2', order: 1 })
    const tree = buildTree(lib([], [f2, f1]))
    expect(tree[0].kind === 'folder' && tree[0].folder.id).toBe('f1')
    expect(tree[1].kind === 'folder' && tree[1].folder.id).toBe('f2')
  })

  it('treats a folder with a missing parent as a root folder', () => {
    const orphan = folder({ id: 'orphan', parentId: 'does-not-exist' })
    const tree = buildTree(lib([], [orphan]))
    expect(tree).toHaveLength(1)
  })

  it('builds a multi-level folder tree', () => {
    const a = folder({ id: 'a', parentId: null, order: 0 })
    const b = folder({ id: 'b', parentId: 'a', order: 0 })
    const c = folder({ id: 'c', parentId: 'b', order: 0 })
    const tree = buildTree(lib([], [a, b, c]))
    expect(tree).toHaveLength(1)
    if (tree[0].kind !== 'folder') throw new Error('expected folder')
    expect(tree[0].folder.id).toBe('a')
    expect(tree[0].children).toHaveLength(1)
    if (tree[0].children[0].kind !== 'folder') throw new Error('expected folder')
    expect(tree[0].children[0].folder.id).toBe('b')
    expect(tree[0].children[0].children).toHaveLength(1)
    if (tree[0].children[0].children[0].kind !== 'folder') throw new Error('expected folder')
    expect(tree[0].children[0].children[0].folder.id).toBe('c')
  })
})

describe('flattenTree', () => {
  it('flattens depth-first pre-order', () => {
    const f = folder({ id: 'f1' })
    const m1 = map({ id: 'm1', folderId: 'f1' })
    const m2 = map({ id: 'm2', folderId: null })
    const tree = buildTree(lib([m1, m2], [f]))
    const flat = flattenTree(tree)
    expect(flat).toHaveLength(3)
    expect(flat[0].depth).toBe(0)
    expect(flat[1].depth).toBe(1)
    expect(flat[2].depth).toBe(0)
  })
})

describe('finders', () => {
  it('findFolder returns the folder or null', () => {
    const f = folder({ id: 'a' })
    expect(findFolder(lib([], [f]), 'a')).toEqual(f)
    expect(findFolder(lib([], [f]), 'missing')).toBeNull()
  })

  it('findMap returns the map or null', () => {
    const m = map({ id: 'a' })
    expect(findMap(lib([m]), 'a')).toEqual(m)
    expect(findMap(lib([m]), 'missing')).toBeNull()
  })

  it('mostRecentMap returns the map with the largest updatedAt', () => {
    const a = map({ id: 'a', updatedAt: 10 })
    const b = map({ id: 'b', updatedAt: 50 })
    const c = map({ id: 'c', updatedAt: 20 })
    expect(mostRecentMap(lib([a, b, c]))?.id).toBe('b')
  })

  it('mostRecentMap returns null for empty library', () => {
    expect(mostRecentMap(lib([]))).toBeNull()
  })
})
