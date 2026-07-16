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
import { deleteSharedElement, ensureSharedRole, type SharedElementKind } from '../../src/features/canvas/sharedElements'
import { deserializeGraphDocument, serializeGraphDocument, type SerializedGraphDocument } from '../../src/features/canvas/engine/graphSerialization'
import { syncSharedProcessInstances } from '../../src/features/canvas/sharedProcessProjection'

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

const sharedProcessDecisionInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  criteria: z.string().default(''),
  ownerRoleId: z.string().optional(),
  decisionOutcomes: z.array(z.string()).default([]),
  x: z.number(),
  y: z.number(),
})

const sharedProcessStageInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  goal: z.string().default(''),
  entryCondition: z.string().default(''),
  exitCondition: z.string().default(''),
  ownerRoleId: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  memberIds: z.array(z.string()).default([]),
  milestones: z.array(z.object({
    id: z.string(),
    title: z.string().min(1).max(200),
    description: z.string().default(''),
    workProductStates: z.array(z.object({ workProductId: z.string(), state: z.string() })).default([]),
  })).default([]),
})

const sharedProcessHandoffInputSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string().optional(),
  targetNodeId: z.string().optional(),
  sourcePlacementId: z.string().optional(),
  targetPlacementId: z.string().optional(),
  label: z.string().default(''),
  color: z.string().optional(),
})

const sharedElementCreateSchemas = {
  roles: z.object({ name: z.string().min(1).max(160), description: z.string().default('') }),
  workProducts: z.object({ title: z.string().min(1).max(200), state: z.string().default('Draft'), description: z.string().default('') }),
  activities: z.object({
    title: z.string().min(1).max(200),
    summary: z.string().default(''),
    expectations: z.string().default(''),
    responsibilities: z.array(z.object({ id: z.string().optional(), roleId: z.string().min(1), kind: z.enum(['responsible', 'accountable', 'supporting', 'consulted', 'informed']) })).default([]),
    workProductLinks: z.array(z.object({ id: z.string(), workProductId: z.string(), relation: z.enum(['input', 'output']), maturity: z.string() })).default([]),
  }),
  processes: z.object({
    title: z.string().min(1).max(200),
    description: z.string().default(''),
    activities: z.array(z.object({ id: z.string(), activityId: z.string(), x: z.number(), y: z.number() })).default([]),
    decisions: z.array(sharedProcessDecisionInputSchema).default([]),
    stages: z.array(sharedProcessStageInputSchema).default([]),
    handoffs: z.array(sharedProcessHandoffInputSchema).default([]),
  }),
} as const

const sharedElementPatchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  title: z.string().min(1).max(200).optional(),
  state: z.string().optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  expectations: z.string().optional(),
  responsibilities: z.array(z.object({ id: z.string(), roleId: z.string().min(1), kind: z.enum(['responsible', 'accountable', 'supporting', 'consulted', 'informed']) })).optional(),
  workProductLinks: z.array(z.object({ id: z.string(), workProductId: z.string(), relation: z.enum(['input', 'output']), maturity: z.string() })).optional(),
  activities: z.array(z.object({ id: z.string(), activityId: z.string(), x: z.number(), y: z.number() })).optional(),
  decisions: z.array(sharedProcessDecisionInputSchema).optional(),
  stages: z.array(sharedProcessStageInputSchema).optional(),
  handoffs: z.array(sharedProcessHandoffInputSchema).optional(),
})

type SharedElementCollection = keyof typeof sharedElementCreateSchemas

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

type SafeParseResult<T> = { ok: true; value: { success: true; data: T } } | { ok: false; error: string }

function safeParseJsonBody<T>(raw: string, schema: z.ZodType<T>): SafeParseResult<T> {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch (err) {
    return { ok: false, error: `Malformed JSON: ${(err as Error).message}` }
  }
  const result = schema.safeParse(payload)
  if (!result.success) {
    return { ok: false, error: `Invalid payload: ${result.error.issues.map((issue) => issue.message).join('; ')}` }
  }
  return { ok: true, value: result as { success: true; data: T } }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function projectSharedLibraryIntoSavedMaps(library: SavedLibrary): SavedLibrary {
  return {
    ...library,
    maps: library.maps.map((map) => {
      if (!map.document) return map
      try {
        const projected = syncSharedProcessInstances(
          deserializeGraphDocument(map.document as SerializedGraphDocument),
          library.elementLibrary,
        )
        return {
          ...map,
          document: {
            ...serializeGraphDocument({ ...projected, meta: { ...projected.meta, dirty: false } }),
            processAssets: projected.processAssets,
          } as NonNullable<SavedMap['document']>,
          updatedAt: Date.now(),
        }
      } catch {
        // A legacy/corrupt document must never prevent a library edit. The
        // normal map migration path will surface and repair it independently.
        return map
      }
    }),
  }
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

    const elementCollectionMatch = pathname.match(/^\/api\/library\/elements\/(roles|workProducts|activities|processes)$/)
    if (elementCollectionMatch) {
      const collection = elementCollectionMatch[1] as SharedElementCollection
      if (request.method === 'GET') {
        const library = await loadLibrary(deps.filePath)
        return json(Object.values(library.elementLibrary[collection]))
      }
      if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.')
      const raw = await request.text()
      const parsed = safeParseJsonBody(raw, sharedElementCreateSchemas[collection] as z.ZodType<Record<string, unknown>>)
      if (!parsed.ok) return errorResponse(400, parsed.error)
      // The collection determines the concrete item shape at runtime. The
      // endpoint returns JSON, so keep the transaction result intentionally
      // generic instead of forcing the four collection shapes into one union.
      const created = await loadAndMutateLibrary<unknown>(deps.filePath, (library) => {
        const elementLibrary = library.elementLibrary
        const payload = parsed.value.data
        if (collection === 'roles') {
          const ensured = ensureSharedRole(elementLibrary, String(payload.name ?? ''))
          const role = { ...ensured.role, description: typeof payload.description === 'string' ? payload.description : '' }
          const next = { ...library, elementLibrary: { ...ensured.library, roles: { ...ensured.library.roles, [role.id]: role } } }
          return { next: projectSharedLibraryIntoSavedMaps(next), result: role }
        }
        const id = generateId(collection === 'workProducts' ? 'work-product' : collection.slice(0, -1))
        if (collection === 'workProducts') {
          const existing = Object.values(elementLibrary.workProducts).find((workProduct) =>
            workProduct.title.trim().toLocaleLowerCase() === String(payload.title ?? '').trim().toLocaleLowerCase(),
          )
          if (existing) return { next: library, result: existing }
          const item = {
            id,
            title: String(payload.title ?? ''),
            state: typeof payload.state === 'string' ? payload.state : 'Draft',
            description: typeof payload.description === 'string' ? payload.description : '',
          }
          const next = { ...library, elementLibrary: { ...elementLibrary, workProducts: { ...elementLibrary.workProducts, [id]: item } } }
          return { next: projectSharedLibraryIntoSavedMaps(next), result: item }
        }
        if (collection === 'activities') {
          const responsibilities = Array.isArray(payload.responsibilities)
            ? payload.responsibilities.map((responsibility, index) => {
              const item = responsibility as { id?: string; roleId: string; kind: 'responsible' | 'accountable' | 'supporting' | 'consulted' | 'informed' }
              return { id: item.id ?? `${id}-responsibility-${index + 1}`, roleId: item.roleId, kind: item.kind }
            })
            : []
          const item = {
            id,
            title: String(payload.title ?? ''),
            summary: typeof payload.summary === 'string' ? payload.summary : '',
            expectations: typeof payload.expectations === 'string' ? payload.expectations : '',
            responsibilities,
            workProductLinks: Array.isArray(payload.workProductLinks) ? payload.workProductLinks as typeof elementLibrary.activities[string]['workProductLinks'] : [],
          }
          const next = { ...library, elementLibrary: { ...elementLibrary, activities: { ...elementLibrary.activities, [id]: item } } }
          return { next: projectSharedLibraryIntoSavedMaps(next), result: item }
        }
        const item = {
          id,
          title: String(payload.title ?? ''),
          description: typeof payload.description === 'string' ? payload.description : '',
          activities: Array.isArray(payload.activities) ? payload.activities as typeof elementLibrary.processes[string]['activities'] : [],
          decisions: Array.isArray(payload.decisions) ? payload.decisions as typeof elementLibrary.processes[string]['decisions'] : [],
          stages: Array.isArray(payload.stages) ? payload.stages as typeof elementLibrary.processes[string]['stages'] : [],
          handoffs: Array.isArray(payload.handoffs) ? payload.handoffs as typeof elementLibrary.processes[string]['handoffs'] : [],
        }
        const next = { ...library, elementLibrary: { ...elementLibrary, processes: { ...elementLibrary.processes, [id]: item } } }
        return { next: projectSharedLibraryIntoSavedMaps(next), result: item }
      })
      return json(created, 201)
    }

    const elementItemMatch = pathname.match(/^\/api\/library\/elements\/(roles|workProducts|activities|processes)\/([\w-]+)$/)
    if (elementItemMatch) {
      const collection = elementItemMatch[1] as SharedElementCollection
      const id = elementItemMatch[2]
      if (request.method === 'PATCH') {
        const raw = await request.text()
        const parsed = safeParseJsonBody(raw, sharedElementPatchSchema)
        if (!parsed.ok) return errorResponse(400, parsed.error)
        try {
          const updated = await loadAndMutateLibrary(deps.filePath, (library) => {
            const elementLibrary = library.elementLibrary
            const current = elementLibrary[collection][id]
            if (!current) throw new Error('NOT_FOUND')
            const item = { ...current, ...parsed.value.data } as typeof current
            const next = { ...library, elementLibrary: { ...elementLibrary, [collection]: { ...elementLibrary[collection], [id]: item } } as typeof elementLibrary }
            return { next: projectSharedLibraryIntoSavedMaps(next), result: item }
          })
          return json(updated)
        } catch (error) {
          return (error as Error).message === 'NOT_FOUND'
            ? errorResponse(404, 'Shared element not found.')
            : errorResponse(400, (error as Error).message)
        }
      }
      if (request.method === 'DELETE') {
        const confirmed = url.searchParams.get('confirm') === 'true'
        try {
          const result = await loadAndMutateLibrary(deps.filePath, (library) => {
            const elementLibrary = library.elementLibrary
            const kind: SharedElementKind = collection === 'roles' ? 'role' : collection === 'workProducts' ? 'workProduct' : collection === 'activities' ? 'activity' : 'process'
            const deleted = deleteSharedElement(elementLibrary, kind, id)
            deleted.impact.maps = affectedMapIds(library, kind, id)
            const hasImpact = deleted.impact.activities.length > 0 || deleted.impact.processes.length > 0 || deleted.impact.maps.length > 0
            if (hasImpact && !confirmed) throw new Error(`REFERENCED:${JSON.stringify(deleted.impact)}`)
            return { next: projectSharedLibraryIntoSavedMaps({ ...library, elementLibrary: deleted.library }), result: deleted.impact }
          })
          return json({ id, impact: result })
        } catch (error) {
          const message = (error as Error).message
          if (message.startsWith('REFERENCED:')) {
            return new Response(JSON.stringify({ success: false, error: 'Element is still in use.', impact: JSON.parse(message.slice('REFERENCED:'.length)) }), {
              status: 409,
              headers: { 'content-type': 'application/json' },
            })
          }
          return errorResponse(400, message)
        }
      }
      return errorResponse(405, 'Method not allowed.')
    }

    // POST /api/library/maps
    if (pathname === '/api/library/maps' && request.method === 'POST') {
      const raw = await request.text()
      const parsed = safeParseJsonBody(raw, createMapSchema)
      if (!parsed.ok) return errorResponse(400, parsed.error)
      const map = await loadAndMutateLibrary(deps.filePath, (lib) => {
        const order = lib.maps.filter((m) => m.folderId === (parsed.value.data.folderId ?? null)).length
        const newMap: SavedMap = {
          id: generateId('map'),
          name: parsed.value.data.name,
          folderId: parsed.value.data.folderId ?? null,
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
        const parsed = safeParseJsonBody(raw, patchMapSchema)
        if (!parsed.ok) {
          return errorResponse(400, parsed.error)
        }
        try {
          const updated = await loadAndMutateLibrary(deps.filePath, (lib) => {
            const existing = lib.maps.find((m) => m.id === mapId)
            if (!existing) {
              throw new Error('NOT_FOUND')
            }
            let next: SavedLibrary = lib
            if (typeof parsed.value.data.name === 'string') next = renameMap(next, mapId, parsed.value.data.name)
            if (parsed.value.data.folderId !== undefined) {
              next = moveMapToFolder(next, mapId, parsed.value.data.folderId)
            }
            if (parsed.value.data.document !== undefined) {
              next = setMapDocument(next, mapId, parsed.value.data.document)
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
      const parsed = safeParseJsonBody(raw, createFolderSchema)
      if (!parsed.ok) return errorResponse(400, parsed.error)
      const folder = await loadAndMutateLibrary(deps.filePath, (lib) => {
        const order = lib.folders.filter((f) => f.parentId === (parsed.value.data.parentId ?? null)).length
        const newFolder = { id: generateId('folder'), name: parsed.value.data.name, parentId: parsed.value.data.parentId ?? null, order }
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
        const parsed = safeParseJsonBody(raw, patchFolderSchema)
        if (!parsed.ok) return errorResponse(400, parsed.error)
        try {
          const updated = await loadAndMutateLibrary(deps.filePath, (lib) => {
            const existing = lib.folders.find((f) => f.id === folderId)
            if (!existing) throw new Error('NOT_FOUND')
            let next: SavedLibrary = lib
            if (typeof parsed.value.data.name === 'string') next = renameFolder(next, folderId, parsed.value.data.name)
            if (parsed.value.data.parentId !== undefined) {
              next = moveFolderToFolder(next, folderId, parsed.value.data.parentId)
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

function affectedMapIds(library: SavedLibrary, kind: SharedElementKind, id: string): string[] {
  return library.maps.flatMap((map) => {
    const document = map.document as {
      processInstances?: Record<string, { processId?: string }>
      nodes?: Record<string, { sharedActivityId?: string; responsibilities?: Array<{ roleId?: string }> }>
      processAssets?: { workProducts?: Record<string, { sharedWorkProductId?: string }> }
    } | undefined
    if (!document) return []
    if (kind === 'process' && Object.values(document.processInstances ?? {}).some((instance) => instance.processId === id)) return [map.id]
    if (kind === 'activity' && Object.values(document.nodes ?? {}).some((node) => node.sharedActivityId === id)) return [map.id]
    if (kind === 'role' && Object.values(document.nodes ?? {}).some((node) => node.responsibilities?.some((responsibility) => responsibility.roleId === id))) return [map.id]
    if (kind === 'workProduct' && Object.values(document.processAssets?.workProducts ?? {}).some((workProduct) => workProduct.sharedWorkProductId === id)) return [map.id]
    return []
  })
}
