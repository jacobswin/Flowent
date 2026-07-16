// Pure helpers for the library tree. No JSX, no React, no fetch —
// trivially testable. Types are inlined here so this file compiles in the
// browser tsconfig (which doesn't include the server directory).
import type { SharedElementLibrary } from './sharedElements'

export type SavedFolder = {
  id: string
  name: string
  parentId: string | null
  order: number
}

export type SavedMap = {
  id: string
  name: string
  folderId: string | null
  order: number
  document?: unknown
  updatedAt: number
  /** Activation snapshot — frozen when the user activates the map as the agreed process. */
  activation?: {
    status: 'activated'
    activatedAt: string
    baselineDiagnosticCount: number
  }
}

export type SavedLibrary = {
  folders: SavedFolder[]
  maps: SavedMap[]
  elementLibrary?: SharedElementLibrary
}

export type LibraryNode =
  | { kind: 'folder'; folder: SavedFolder; children: LibraryNode[] }
  | { kind: 'map'; map: SavedMap }

/**
 * Build a tree of folders and maps from the flat arrays the API returns.
 * Folders with missing parents are treated as root (defensive — never crashes
 * the UI on a stale parentId).
 */
export function buildTree(library: SavedLibrary): LibraryNode[] {
  const folderById = new Map(library.folders.map((f) => [f.id, f]))
  const validParent = (id: string | null): boolean => id === null || folderById.has(id)

  const childFolders = new Map<string | null, SavedFolder[]>()
  for (const folder of library.folders) {
    const parent = validParent(folder.parentId) ? folder.parentId : null
    const list = childFolders.get(parent) ?? []
    list.push(folder)
    childFolders.set(parent, list)
  }
  for (const list of childFolders.values()) {
    list.sort((a, b) => a.order - b.order)
  }

  const childMaps = new Map<string | null, SavedMap[]>()
  for (const map of library.maps) {
    const parent = validParent(map.folderId) ? map.folderId : null
    const list = childMaps.get(parent) ?? []
    list.push(map)
    childMaps.set(parent, list)
  }
  for (const list of childMaps.values()) {
    list.sort((a, b) => a.order - b.order)
  }

  return buildLevel(null)

  function buildLevel(parentId: string | null): LibraryNode[] {
    const folders = childFolders.get(parentId) ?? []
    const maps = childMaps.get(parentId) ?? []
    const nodes: LibraryNode[] = []
    for (const folder of folders) {
      nodes.push({ kind: 'folder', folder, children: buildLevel(folder.id) })
    }
    for (const map of maps) {
      nodes.push({ kind: 'map', map })
    }
    return nodes
  }
}

/**
 * Flatten a tree depth-first, pre-order. Useful for keyboard nav and tests.
 */
export function flattenTree(nodes: LibraryNode[]): Array<{ node: LibraryNode; depth: number }> {
  const out: Array<{ node: LibraryNode; depth: number }> = []
  walk(nodes, 0)
  return out

  function walk(items: LibraryNode[], depth: number): void {
    for (const node of items) {
      out.push({ node, depth })
      if (node.kind === 'folder') walk(node.children, depth + 1)
    }
  }
}

/** Find a folder by id; returns null if not present. */
export function findFolder(library: SavedLibrary, id: string): SavedFolder | null {
  return library.folders.find((f) => f.id === id) ?? null
}

/** Find a map by id; returns null if not present. */
export function findMap(library: SavedLibrary, id: string): SavedMap | null {
  return library.maps.find((m) => m.id === id) ?? null
}

/** Pick the most recently updated map; returns null if library is empty. */
export function mostRecentMap(library: SavedLibrary): SavedMap | null {
  if (library.maps.length === 0) return null
  return [...library.maps].sort((a, b) => b.updatedAt - a.updatedAt)[0]
}
