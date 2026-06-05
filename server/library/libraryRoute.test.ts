import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLibraryRouteHandler } from './libraryRoute'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flowent-lib-route-'))
  file = join(dir, 'library.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function dispatch(handle: (req: Request) => Promise<Response>, req: Request): Promise<Response> {
  return handle(req)
}

describe('libraryRoute', () => {
  it('GET / returns empty library initially', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/library'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean, data: { folders: unknown[], maps: unknown[] } }
    expect(body.success).toBe(true)
    expect(body.data.folders).toEqual([])
    expect(body.data.maps).toEqual([])
  })

  it('POST /maps creates a map and returns it', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Onboarding' }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean, data: { id: string, name: string } }
    expect(body.data.name).toBe('Onboarding')
    expect(body.data.id).toBeTypeOf('string')
  })

  it('PATCH /maps/:id renames and moves', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const create = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'X' }),
    }))
    const { data: map } = await create.json() as { data: { id: string } }

    const folderRes = await dispatch(handle, new Request('http://test/api/library/folders', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Eng' }),
    }))
    const { data: folder } = await folderRes.json() as { data: { id: string } }

    const patch = await dispatch(handle, new Request(`http://test/api/library/maps/${map.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', folderId: folder.id }),
    }))
    expect(patch.status).toBe(200)
    const get = await dispatch(handle, new Request('http://test/api/library'))
    const getBody = await get.json() as { data: { maps: { name: string, folderId: string }[] } }
    expect(getBody.data.maps[0].name).toBe('Renamed')
    expect(getBody.data.maps[0].folderId).toBe(folder.id)
  })

  it('rejects malformed JSON with a precise 400 message', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ "name": "broken"',
    }))

    expect(res.status).toBe(400)
    const body = await res.json() as { success: boolean, error: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/Malformed JSON/)
  })

  it('rejects invalid document patches before persisting them', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const create = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'X' }),
    }))
    const { data: map } = await create.json() as { data: { id: string } }

    const patch = await dispatch(handle, new Request(`http://test/api/library/maps/${map.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document: { id: 'broken' } }),
    }))

    expect(patch.status).toBe(400)

    const get = await dispatch(handle, new Request('http://test/api/library'))
    const body = await get.json() as { data: { maps: Array<{ id: string; document?: unknown }> } }
    expect(body.data.maps[0].id).toBe(map.id)
    expect(body.data.maps[0].document).toBeUndefined()
  })

  it('persists a valid semantic document patch', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const create = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'X' }),
    }))
    const { data: map } = await create.json() as { data: { id: string } }

    const document = {
      id: map.id,
      nodes: {
        start: {
          id: 'start',
          type: 'start',
          x: 360,
          y: 200,
          width: 120,
          height: 56,
          title: 'Start',
          roleTags: [],
          ports: [{ id: 'out', side: 'right' as const }],
        },
      },
      edges: {},
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { dirty: false, version: 1 },
    }

    const patch = await dispatch(handle, new Request(`http://test/api/library/maps/${map.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document }),
    }))

    expect(patch.status).toBe(200)
  })

  it('DELETE /maps/:id removes the map', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const create = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'X' }),
    }))
    const { data: map } = await create.json() as { data: { id: string } }

    const del = await dispatch(handle, new Request(`http://test/api/library/maps/${map.id}`, { method: 'DELETE' }))
    expect(del.status).toBe(200)

    const get = await dispatch(handle, new Request('http://test/api/library'))
    const getBody = await get.json() as { data: { maps: unknown[] } }
    expect(getBody.data.maps).toEqual([])
  })

  it('rejects bad input on POST /maps', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/library/maps', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown map', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/library/maps/nope', { method: 'DELETE' }))
    expect(res.status).toBe(404)
  })

  it('returns 405 for unsupported method', async () => {
    const handle = createLibraryRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/library', { method: 'PUT' }))
    expect(res.status).toBe(405)
  })
})
