import { z } from 'zod'
import {
  addFolder,
  addMap,
  deleteFolder as removeFolder,
  deleteMap as removeMap,
  librarySchema,
  loadLibrary,
  loadAndMutateLibrary,
  moveFolderToFolder,
  moveMapToFolder,
  renameFolder,
  renameMap,
  setMapDocument,
  type SavedLibrary,
  type SavedMap,
} from './libraryStore'

interface LibraryRouteDeps {
  filePath: string
}

const createMapSchema = z.object({
  name: z.string().min(1).max(120),
  folderId: z.string().nullable().optional(),
})

const patchMapSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  folderId: z.string().nullable().optional(),
  document: librarySchema.shape.maps.element.shape.document.optional(),
})

const createFolderSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
})

const patchFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  parentId: z.string().nullable().optional(),
})

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: status < 400, data: body }), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  })
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createLibraryRouteHandler(deps: LibraryRouteDeps) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // GET /api/library  (no trailing /maps or /folders)
    if (pathname === '/api/library') {
      if (request.method !== 'GET') return errorResponse(405, 'Method not allowed.')
      const lib = await loadLibrary(deps.filePath)
      return json(lib)
    }

    // POST /api/library/maps
    if (pathname === '/api/library/maps' && request.method === 'POST') {
      const raw = await request.text()
      const parsed = createMapSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) return errorResponse(400, 'Invalid map payload.')
      const map = await loadAndMutateLibrary(deps.filePath, (lib) => {
        const order = lib.maps.filter((m) => m.folderId === (parsed.data.folderId ?? null)).length
        const newMap: SavedMap = {
          id: generateId('map'),
          name: parsed.data.name,
          folderId: parsed.data.folderId ?? null,
          order,
          updatedAt: Date.now(),
        }
        return {
          next: addMap(lib, { id: newMap.id, name: newMap.name, folderId: newMap.folderId, order: newMap.order }),
          result: newMap,
        }
      })
      return json(map, 201)
    }

    // PATCH /api/library/maps/:id
    const mapMatch = pathname.match(/^\/api\/library\/maps\/([\w-]+)$/)
    if (mapMatch) {
      const mapId = mapMatch[1]
      if (request.method === 'PATCH') {
        const raw = await request.text()
        const parsed = patchMapSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) {
          return errorResponse(400, 'Invalid map patch.')
        }
        try {
          const updated = await loadAndMutateLibrary(deps.filePath, (lib) => {
            const existing = lib.maps.find((m) => m.id === mapId)
            if (!existing) {
              throw new Error('NOT_FOUND')
            }
            let next: SavedLibrary = lib
            if (typeof parsed.data.name === 'string') next = renameMap(next, mapId, parsed.data.name)
            if (parsed.data.folderId !== undefined) {
              next = moveMapToFolder(next, mapId, parsed.data.folderId)
            }
            if (parsed.data.document !== undefined) {
              next = setMapDocument(next, mapId, parsed.data.document)
            }
            return { next, result: next.maps.find((m) => m.id === mapId)! }
          })
          return json(updated)
        } catch (err) {
          if ((err as Error).message === 'NOT_FOUND') return errorResponse(404, 'Map not found.')
          return errorResponse(400, (err as Error).message)
        }
      }

      if (request.method === 'DELETE') {
        const ok = await loadAndMutateLibrary(deps.filePath, (lib) => {
          if (!lib.maps.some((m) => m.id === mapId)) {
            return { next: lib, result: false }
          }
          return { next: removeMap(lib, mapId), result: true }
        })
        if (!ok) return errorResponse(404, 'Map not found.')
        return json({ id: mapId })
      }

      return errorResponse(405, 'Method not allowed.')
    }

    // POST /api/library/folders
    if (pathname === '/api/library/folders' && request.method === 'POST') {
      const raw = await request.text()
      const parsed = createFolderSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) return errorResponse(400, 'Invalid folder payload.')
      const folder = await loadAndMutateLibrary(deps.filePath, (lib) => {
        const order = lib.folders.filter((f) => f.parentId === (parsed.data.parentId ?? null)).length
        const newFolder = { id: generateId('folder'), name: parsed.data.name, parentId: parsed.data.parentId ?? null, order }
        return { next: addFolder(lib, newFolder), result: newFolder }
      })
      return json(folder, 201)
    }

    // PATCH /api/library/folders/:id
    const folderMatch = pathname.match(/^\/api\/library\/folders\/([\w-]+)$/)
    if (folderMatch) {
      const folderId = folderMatch[1]
      if (request.method === 'PATCH') {
        const raw = await request.text()
        const parsed = patchFolderSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) return errorResponse(400, 'Invalid folder patch.')
        try {
          const updated = await loadAndMutateLibrary(deps.filePath, (lib) => {
            const existing = lib.folders.find((f) => f.id === folderId)
            if (!existing) throw new Error('NOT_FOUND')
            let next: SavedLibrary = lib
            if (typeof parsed.data.name === 'string') next = renameFolder(next, folderId, parsed.data.name)
            if (parsed.data.parentId !== undefined) {
              next = moveFolderToFolder(next, folderId, parsed.data.parentId)
            }
            return { next, result: next.folders.find((f) => f.id === folderId)! }
          })
          return json(updated)
        } catch (err) {
          if ((err as Error).message === 'NOT_FOUND') return errorResponse(404, 'Folder not found.')
          return errorResponse(400, (err as Error).message)
        }
      }

      if (request.method === 'DELETE') {
        try {
          await loadAndMutateLibrary(deps.filePath, (lib) => {
            if (!lib.folders.some((f) => f.id === folderId)) {
              throw new Error('NOT_FOUND')
            }
            return { next: removeFolder(lib, folderId), result: undefined }
          })
          return json({ id: folderId })
        } catch (err) {
          if ((err as Error).message === 'NOT_FOUND') return errorResponse(404, 'Folder not found.')
          return errorResponse(400, (err as Error).message)
        }
      }

      return errorResponse(405, 'Method not allowed.')
    }

    return errorResponse(404, 'Not found.')
  }
}
