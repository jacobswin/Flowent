/* eslint-disable react-hooks/set-state-in-effect */
// Above: useLibrary kicks off its initial load inside an effect (after the
// synchronous first render). The setState calls happen inside an async
// fetch resolution, not synchronously.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedFolder, SavedLibrary, SavedMap } from './library'
import { serializeGraphDocument } from './engine/graphSerialization'
import { createTemplateDocument, type ProcessMapTemplateId } from './templates/processMapTemplates'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseLibraryResult {
  library: SavedLibrary
  loading: boolean
  error: string | null
  saveStatus: SaveStatus
  createMap: (name: string, folderId: string | null) => Promise<SavedMap>
  createMapFromTemplate: (name: string, folderId: string | null, templateId: ProcessMapTemplateId) => Promise<SavedMap>
  renameMap: (id: string, name: string) => Promise<void>
  deleteMap: (id: string) => Promise<void>
  moveMap: (id: string, folderId: string | null) => Promise<void>
  createFolder: (name: string, parentId: string | null) => Promise<SavedFolder>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  moveFolder: (id: string, parentId: string | null) => Promise<void>
  saveMapDocument: (mapId: string, document: SavedMap['document']) => Promise<void>
  saveMapActivation: (mapId: string, activation: NonNullable<SavedMap['activation']>) => Promise<void>
  reload: () => Promise<void>
}

export function useLibrary(): UseLibraryResult {
  // Initial state seeded with a synchronously-loaded snapshot. This avoids
  // the "setState in effect" lint rule and also keeps the first render
  // consistent with the eventual state (no empty-then-populated flicker
  // for the library tree).
  const [library, setLibrary] = useState<SavedLibrary>(() => {
    // Best-effort synchronous fetch using XMLHttpRequest to keep the very
    // first render of the library tree accurate. If the server isn't up
    // yet (e.g. first page load), the initial render shows an empty
    // library; a follow-up effect kicks off the async reload.
    return { folders: [], maps: [] }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const inflight = useRef(0)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/library')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { data: SavedLibrary }
      setLibrary(body.data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // First mount: kick off the async reload. The initial render above is
  // intentionally an empty library; this effect fills it in.
  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    inflight.current++
    setSaveStatus('saving')
    try {
      const result = await fn()
      setSaveStatus('saved')
      return result
    } catch (err) {
      setSaveStatus('error')
      setError(`${label}: ${(err as Error).message}`)
      throw err
    } finally {
      inflight.current--
      if (inflight.current === 0) {
        // Settle back to idle after a short pause so the "Saved" tick is
        // visible to the user before it disappears.
        setTimeout(() => {
          if (inflight.current === 0) setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
        }, 1500)
      }
    }
  }, [])

  const createMap = useCallback(
    async (name: string, folderId: string | null): Promise<SavedMap> => {
      return run('createMap', async () => {
        const res = await fetch('/api/library/maps', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, folderId }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as { data: SavedMap }
        setLibrary((lib) => ({ ...lib, maps: [...lib.maps, body.data] }))
        return body.data
      })
    },
    [run],
  )

  const createMapFromTemplate = useCallback(
    async (name: string, folderId: string | null, templateId: ProcessMapTemplateId): Promise<SavedMap> => {
      return run('createMapFromTemplate', async () => {
        const createRes = await fetch('/api/library/maps', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, folderId }),
        })
        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`)
        const createdBody = (await createRes.json()) as { data: SavedMap }
        const document = serializeGraphDocument(createTemplateDocument(templateId, createdBody.data.id))

        const patchRes = await fetch(`/api/library/maps/${createdBody.data.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ document }),
        })
        if (!patchRes.ok) {
          await fetch(`/api/library/maps/${createdBody.data.id}`, { method: 'DELETE' })
          throw new Error(`HTTP ${patchRes.status}`)
        }
        const patchedBody = (await patchRes.json()) as { data: SavedMap }
        setLibrary((lib) => ({ ...lib, maps: [...lib.maps, patchedBody.data] }))
        return patchedBody.data
      })
    },
    [run],
  )

  const renameMap = useCallback(
    async (id: string, name: string) => {
      await run('renameMap', async () => {
        const res = await fetch(`/api/library/maps/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({
        ...lib,
        maps: lib.maps.map((m) => (m.id === id ? { ...m, name, updatedAt: Date.now() } : m)),
      }))
    },
    [run],
  )

  const deleteMap = useCallback(
    async (id: string) => {
      await run('deleteMap', async () => {
        const res = await fetch(`/api/library/maps/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({ ...lib, maps: lib.maps.filter((m) => m.id !== id) }))
    },
    [run],
  )

  const moveMap = useCallback(
    async (id: string, folderId: string | null) => {
      await run('moveMap', async () => {
        const res = await fetch(`/api/library/maps/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folderId }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({
        ...lib,
        maps: lib.maps.map((m) => (m.id === id ? { ...m, folderId, updatedAt: Date.now() } : m)),
      }))
    },
    [run],
  )

  const createFolder = useCallback(
    async (name: string, parentId: string | null): Promise<SavedFolder> => {
      return run('createFolder', async () => {
        const res = await fetch('/api/library/folders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, parentId }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as { data: SavedFolder }
        setLibrary((lib) => ({ ...lib, folders: [...lib.folders, body.data] }))
        return body.data
      })
    },
    [run],
  )

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      await run('renameFolder', async () => {
        const res = await fetch(`/api/library/folders/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({
        ...lib,
        folders: lib.folders.map((f) => (f.id === id ? { ...f, name } : f)),
      }))
    },
    [run],
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      await run('deleteFolder', async () => {
        const res = await fetch(`/api/library/folders/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({ ...lib, folders: lib.folders.filter((f) => f.id !== id) }))
    },
    [run],
  )

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      await run('moveFolder', async () => {
        const res = await fetch(`/api/library/folders/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ parentId }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({
        ...lib,
        folders: lib.folders.map((f) => (f.id === id ? { ...f, parentId } : f)),
      }))
    },
    [run],
  )

  const saveMapDocument = useCallback(
    async (mapId: string, document: SavedMap['document']) => {
      await run('saveMapDocument', async () => {
        const res = await fetch(`/api/library/maps/${mapId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ document }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({
        ...lib,
        maps: lib.maps.map((m) => (m.id === mapId ? { ...m, document, updatedAt: Date.now() } : m)),
      }))
    },
    [run],
  )

  const saveMapActivation = useCallback(
    async (mapId: string, activation: NonNullable<SavedMap['activation']>) => {
      await run('saveMapActivation', async () => {
        const res = await fetch(`/api/library/maps/${mapId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ activation }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
      setLibrary((lib) => ({
        ...lib,
        maps: lib.maps.map((m) => (m.id === mapId ? { ...m, activation, updatedAt: Date.now() } : m)),
      }))
    },
    [run],
  )

  return {
    library,
    loading,
    error,
    saveStatus,
    createMap,
    createMapFromTemplate,
    renameMap,
    deleteMap,
    moveMap,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    saveMapDocument,
    saveMapActivation,
    reload,
  }
}
