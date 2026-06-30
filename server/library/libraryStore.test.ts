import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createEmptyLibrary,
  loadLibrary,
  saveLibrary,
  loadAndMutateLibrary,
  addMap,
  addFolder,
  renameMap,
  moveMapToFolder,
  moveFolderToFolder,
  deleteMap,
  deleteFolder,
  setMapDocument,
} from './libraryStore'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flowent-lib-'))
  file = join(dir, 'library.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('libraryStore', () => {
  it('returns an empty library on first load (no file)', async () => {
    const lib = await loadLibrary(file)
    expect(lib.folders).toEqual([])
    expect(lib.maps).toEqual([])
  })

  it('round-trips an empty library', async () => {
    const empty = createEmptyLibrary()
    await saveLibrary(file, empty)
    const loaded = await loadLibrary(file)
    expect(loaded).toEqual(empty)
  })

  it('adds a map and reads it back', async () => {
    let lib = createEmptyLibrary()
    lib = addMap(lib, { id: 'm1', name: 'Onboarding', folderId: null, order: 0 })
    await saveLibrary(file, lib)

    const loaded = await loadLibrary(file)
    expect(loaded.maps).toHaveLength(1)
    expect(loaded.maps[0]).toMatchObject({ id: 'm1', name: 'Onboarding', folderId: null, order: 0 })
    expect(loaded.maps[0].updatedAt).toBeTypeOf('number')
  })

  it('renames a map', () => {
    let lib = createEmptyLibrary()
    lib = addMap(lib, { id: 'm1', name: 'Old', folderId: null, order: 0 })
    lib = renameMap(lib, 'm1', 'New')
    expect(lib.maps[0].name).toBe('New')
  })

  it('deletes a map and any folder reference is preserved', () => {
    let lib = createEmptyLibrary()
    lib = addMap(lib, { id: 'm1', name: 'M', folderId: null, order: 0 })
    lib = deleteMap(lib, 'm1')
    expect(lib.maps).toEqual([])
  })

  it('adds a folder and a child map under it', () => {
    let lib = createEmptyLibrary()
    lib = addFolder(lib, { id: 'f1', name: 'Engineering', parentId: null, order: 0 })
    lib = addMap(lib, { id: 'm1', name: 'Deploy', folderId: 'f1', order: 0 })
    expect(lib.folders).toHaveLength(1)
    expect(lib.maps[0].folderId).toBe('f1')
  })

  it('refuses to delete a folder that still has children', () => {
    let lib = createEmptyLibrary()
    lib = addFolder(lib, { id: 'f1', name: 'Eng', parentId: null, order: 0 })
    lib = addMap(lib, { id: 'm1', name: 'X', folderId: 'f1', order: 0 })
    expect(() => deleteFolder(lib, 'f1')).toThrow(/not empty/i)
  })

  it('moves a map into a folder', () => {
    let lib = createEmptyLibrary()
    lib = addFolder(lib, { id: 'f1', name: 'A', parentId: null, order: 0 })
    lib = addMap(lib, { id: 'm1', name: 'X', folderId: null, order: 0 })
    lib = moveMapToFolder(lib, 'm1', 'f1')
    expect(lib.maps[0].folderId).toBe('f1')
  })

  it('refuses to make a folder a child of itself', () => {
    let lib = createEmptyLibrary()
    lib = addFolder(lib, { id: 'f1', name: 'A', parentId: null, order: 0 })
    expect(() => moveFolderToFolder(lib, 'f1', 'f1')).toThrow(/cycle/i)
  })

  it('refuses to nest a folder under one of its own descendants', () => {
    let lib = createEmptyLibrary()
    lib = addFolder(lib, { id: 'a', name: 'A', parentId: null, order: 0 })
    lib = addFolder(lib, { id: 'b', name: 'B', parentId: 'a', order: 0 })
    expect(() => moveFolderToFolder(lib, 'a', 'b')).toThrow(/cycle/i)
  })

  it('persists and updates a map document', () => {
    let lib = createEmptyLibrary()
    lib = addMap(lib, { id: 'm1', name: 'M', folderId: null, order: 0 })
    const doc = { id: 'm1', nodes: { n1: { id: 'n1', type: 'start' as const, x: 0, y: 0, width: 1, height: 1, title: 'S', roleTags: [], ports: [] } }, edges: {}, selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 }, meta: { dirty: false, version: 1 } }
    lib = setMapDocument(lib, 'm1', doc as never)
    expect(lib.maps[0].document).toEqual(doc)
  })

  it('persists work product activity maturity links in map documents', async () => {
    let lib = createEmptyLibrary()
    lib = addMap(lib, { id: 'm1', name: 'M', folderId: null, order: 0 })
    const doc = {
      id: 'm1',
      nodes: {
        a1: {
          id: 'a1',
          type: 'activity' as const,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          title: 'Activity',
          roleTags: [],
          ports: [],
        },
      },
      edges: {},
      processAssets: {
        workProducts: {
          'wp-1': {
            id: 'wp-1',
            title: 'Brief',
            state: 'Draft',
            description: '',
            activityLinks: [
              { id: 'link-1', nodeId: 'a1', relation: 'input' as const, maturity: 'Draft' },
              { id: 'link-2', nodeId: 'a1', relation: 'output' as const, maturity: 'Approved' },
            ],
            producerNodeIds: ['a1'],
            consumerNodeIds: ['a1'],
            handoffEdgeIds: [],
            guidanceIds: [],
          },
        },
        guidanceItems: {},
        milestones: {},
      },
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { dirty: false, version: 1 },
    }
    lib = setMapDocument(lib, 'm1', doc as never)

    await saveLibrary(file, lib)
    const loaded = await loadLibrary(file)

    expect(loaded.maps[0].document?.processAssets?.workProducts['wp-1']?.activityLinks).toEqual([
      { id: 'link-1', nodeId: 'a1', relation: 'input', maturity: 'Draft' },
      { id: 'link-2', nodeId: 'a1', relation: 'output', maturity: 'Approved' },
    ])
  })

  it('recovers a corrupt file by backing it up and returning empty', async () => {
    writeFileSync(file, '{ this is not json', 'utf8')
    const lib = await loadLibrary(file)
    expect(lib.folders).toEqual([])
    expect(lib.maps).toEqual([])
    // A backup with the broken contents exists alongside, so the user can
    // recover their data even after a bad write.
    const dir = file.replace(/library\.json$/, '')
    const { readdirSync } = await import('node:fs')
    const backups = readdirSync(dir).filter((f) => f.startsWith('library.broken-'))
    expect(backups.length).toBe(1)
    expect(readFileSync(join(dir, backups[0]), 'utf8')).toBe('{ this is not json')
  })

  it('serializes concurrent loadAndMutateLibrary transactions (no lost writes)', async () => {
    // Fire 10 parallel POST-style mutations. With the per-file mutex, all
    // 10 maps should be present afterwards; without it, the read-modify-write
    // race would clobber some of them.
    const promises: Promise<unknown>[] = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        loadAndMutateLibrary(file, (lib) => ({
          next: addMap(lib, { id: `m${i}`, name: `Map ${i}`, folderId: null, order: i }),
          result: undefined,
        })),
      )
    }
    await Promise.all(promises)

    const final = await loadLibrary(file)
    expect(final.maps).toHaveLength(10)
    expect(new Set(final.maps.map((m) => m.id))).toEqual(new Set(Array.from({ length: 10 }, (_, i) => `m${i}`)))
  })
})
