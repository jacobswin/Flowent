import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

// === Schemas ===

// Serialize-friendly view of GraphDocument: nodes and edges are objects (not
// Maps), selection sets are arrays (not Sets). The client converts to/from
// the runtime GraphDocument type at the boundary.
const reviewStatusSchema = z.enum(['unclear', 'disputed', 'needs-owner', 'approved', 'changed-since-approval'])

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['activity', 'decision', 'stage', 'bottleneck', 'start', 'end']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  title: z.string(),
  summary: z.string().optional(),
  criteria: z.string().optional(),
  decisionOutcomes: z.array(z.string()).optional(),
  roleTags: z.array(z.string()),
  expectations: z.string().optional(),
  owner: z.string().optional(),
  goal: z.string().optional(),
  entryCondition: z.string().optional(),
  exitCondition: z.string().optional(),
  symptom: z.string().optional(),
  impact: z.string().optional(),
  suspectedCause: z.string().optional(),
  reviewStatus: reviewStatusSchema.optional(),
  ports: z.array(z.object({ id: z.string(), side: z.enum(['top', 'right', 'bottom', 'left']) })),
})

const edgeSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  sourcePortId: z.string(),
  targetNodeId: z.string(),
  targetPortId: z.string(),
  label: z.string(),
  kind: z.literal('handoff').optional(),
  fromRole: z.string().optional(),
  toRole: z.string().optional(),
  artifact: z.string().optional(),
  expectation: z.string().optional(),
  readinessSignal: z.string().optional(),
  reviewStatus: reviewStatusSchema.optional(),
})

const documentSchema = z.object({
  id: z.string(),
  nodes: z.record(z.string(), nodeSchema),
  edges: z.record(z.string(), edgeSchema),
  selectedNodeIds: z.array(z.string()),
  selectedEdgeIds: z.array(z.string()),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }),
  meta: z.object({ dirty: z.boolean(), version: z.number() }),
})

export const folderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  parentId: z.string().nullable(),
  order: z.number().int(),
})

export const mapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  folderId: z.string().nullable(),
  order: z.number().int(),
  document: documentSchema.optional(),
  updatedAt: z.number().int(),
  activation: z
    .object({
      status: z.literal('activated'),
      activatedAt: z.string(),
      baselineDiagnosticCount: z.number().int().nonnegative(),
    })
    .optional(),
})

export const librarySchema = z.object({
  folders: z.array(folderSchema),
  maps: z.array(mapSchema),
})

export type SavedFolder = z.infer<typeof folderSchema>
export type SavedMap = z.infer<typeof mapSchema>
export type SavedLibrary = z.infer<typeof librarySchema>

// === CRUD ===

export function createEmptyLibrary(): SavedLibrary {
  return { folders: [], maps: [] }
}

export function addFolder(lib: SavedLibrary, folder: Omit<SavedFolder, never>): SavedLibrary {
  return { ...lib, folders: [...lib.folders, folder] }
}

export function addMap(lib: SavedLibrary, map: Omit<SavedMap, 'updatedAt'>): SavedLibrary {
  return {
    ...lib,
    maps: [...lib.maps, { ...map, updatedAt: Date.now() }],
  }
}

export function renameFolder(lib: SavedLibrary, id: string, name: string): SavedLibrary {
  return {
    ...lib,
    folders: lib.folders.map((f) => (f.id === id ? { ...f, name } : f)),
  }
}

export function renameMap(lib: SavedLibrary, id: string, name: string): SavedLibrary {
  return {
    ...lib,
    maps: lib.maps.map((m) => (m.id === id ? { ...m, name, updatedAt: Date.now() } : m)),
  }
}

export function moveMapToFolder(lib: SavedLibrary, mapId: string, folderId: string | null): SavedLibrary {
  if (folderId !== null && !lib.folders.some((f) => f.id === folderId)) {
    throw new Error(`Folder ${folderId} does not exist.`)
  }
  return {
    ...lib,
    maps: lib.maps.map((m) => (m.id === mapId ? { ...m, folderId, updatedAt: Date.now() } : m)),
  }
}

export function moveFolderToFolder(lib: SavedLibrary, folderId: string, parentId: string | null): SavedLibrary {
  if (parentId !== null && !lib.folders.some((f) => f.id === parentId)) {
    throw new Error(`Parent folder ${parentId} does not exist.`)
  }
  if (parentId !== null && wouldCreateFolderCycle(lib, folderId, parentId)) {
    throw new Error('Cannot move a folder into one of its own descendants (would create a cycle).')
  }
  return {
    ...lib,
    folders: lib.folders.map((f) => (f.id === folderId ? { ...f, parentId } : f)),
  }
}

export function deleteMap(lib: SavedLibrary, id: string): SavedLibrary {
  return { ...lib, maps: lib.maps.filter((m) => m.id !== id) }
}

export function deleteFolder(lib: SavedLibrary, id: string): SavedLibrary {
  const hasChildFolder = lib.folders.some((f) => f.parentId === id)
  const hasChildMap = lib.maps.some((m) => m.folderId === id)
  if (hasChildFolder || hasChildMap) {
    throw new Error('Folder is not empty.')
  }
  return { ...lib, folders: lib.folders.filter((f) => f.id !== id) }
}

export function setMapDocument(
  lib: SavedLibrary,
  mapId: string,
  document: SavedMap['document'],
): SavedLibrary {
  return {
    ...lib,
    maps: lib.maps.map((m) => (m.id === mapId ? { ...m, document, updatedAt: Date.now() } : m)),
  }
}

// === I/O ===

// Serialize all file operations through a per-file mutex so concurrent
// loadLibrary → mutate → saveLibrary cycles don't clobber each other. The
// earlier non-locking design was a read-modify-write race: A reads, B
// reads, A writes, B writes (and clobbers A). Each route handler does
// read-mutate-write, so without this guard two requests at the same time
// can produce a torn file with trailing JSON garbage.
const fileLocks = new Map<string, Promise<unknown>>()

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(filePath) ?? Promise.resolve()
  let release: () => void
  const next = new Promise<void>((resolve) => { release = resolve })
  fileLocks.set(filePath, previous.then(() => next))
  await previous
  try {
    return await fn()
  } finally {
    release!()
    // If no further work is queued, drop the entry so the map doesn't
    // grow unbounded for long-lived processes.
    if (fileLocks.get(filePath) === next) {
      fileLocks.delete(filePath)
    }
  }
}

export async function loadLibrary(filePath: string): Promise<SavedLibrary> {
  return withFileLock(filePath, () => loadLibraryNoLock(filePath))
}

async function loadLibraryNoLock(filePath: string): Promise<SavedLibrary> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return createEmptyLibrary()
    }
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    await backUpCorruptFile(filePath, raw)
    return createEmptyLibrary()
  }

  const result = librarySchema.safeParse(parsed)
  if (!result.success) {
    await backUpCorruptFile(filePath, raw)
    return createEmptyLibrary()
  }
  return result.data
}

export async function saveLibrary(filePath: string, lib: SavedLibrary): Promise<void> {
  return withFileLock(filePath, () => writeLibraryNoLock(filePath, lib))
}

async function writeLibraryNoLock(filePath: string, lib: SavedLibrary): Promise<void> {
  // Atomic write: stage to .tmp, then rename. POSIX rename is atomic, so a
  // crash mid-write leaves the previous file intact rather than half-written
  // JSON that the next load would have to recover from.
  await fs.mkdir(dirname(filePath), { recursive: true })
  const tmp = filePath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(lib, null, 2), 'utf8')
  await fs.rename(tmp, filePath)
}

/**
 * Read-modify-write under the file lock. The mutator runs after the load
 * completes and before the write begins, so two concurrent transactions
 * against the same file see a serialized sequence rather than racing.
 */
export async function loadAndMutateLibrary<T>(
  filePath: string,
  mutator: (lib: SavedLibrary) => { next: SavedLibrary; result: T } | Promise<{ next: SavedLibrary; result: T }>,
): Promise<T> {
  return withFileLock(filePath, async () => {
    const lib = await loadLibraryNoLock(filePath)
    const { next, result } = await mutator(lib)
    await writeLibraryNoLock(filePath, next)
    return result
  })
}

async function backUpCorruptFile(filePath: string, raw: string): Promise<void> {
  const ts = Date.now()
  const backupPath = join(dirname(filePath), `library.broken-${ts}.json`)
  try {
    await fs.writeFile(backupPath, raw, 'utf8')
  } catch {
    // best-effort: never let backup failure break load
  }
}

// === Helpers ===

function wouldCreateFolderCycle(lib: SavedLibrary, folderId: string, proposedParentId: string): boolean {
  // Walk proposedParentId's ancestry; if we ever reach folderId, this move
  // would close a cycle.
  let cursor: string | null = proposedParentId
  const seen = new Set<string>()
  while (cursor !== null) {
    if (cursor === folderId) return true
    if (seen.has(cursor)) return true // existing cycle, refuse anyway
    seen.add(cursor)
    const parent: SavedFolder | undefined = lib.folders.find((f) => f.id === cursor)
    cursor = parent ? parent.parentId : null
  }
  return false
}
