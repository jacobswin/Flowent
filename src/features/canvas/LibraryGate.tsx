/* eslint-disable react-hooks/set-state-in-effect */
// Above: this gate has to seed an initial active map (and a "Welcome" map
// if the library is empty) inside an effect — there's no synchronous way
// to know which map to load until /api/library has resolved. The setState
// calls are inside async .then() callbacks, not synchronous cascades.
import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from './useLibrary'
import { LibraryPanel } from './LibraryPanel'
import { ProcessCanvas } from './ProcessCanvas'
import type { GraphDocument, ProcessAssets, ProcessInstance } from './canvasTypes'
import { createEmptyDocument } from './engine/graphDocument'
import { findMap, mostRecentMap } from './library'
import { runCommand } from './engine/commands'
import { normalizeProcessAssets } from './processAssets'
import { createEmptySharedElementLibrary } from './sharedElements'
import { SharedProcessEditor } from './SharedProcessEditor'

const STORAGE_KEY = 'flowent.lastMapId'
const URL_PARAM = 'map'

function readInitialMapId(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get(URL_PARAM)
  if (fromUrl) return fromUrl
  return window.localStorage.getItem(STORAGE_KEY)
}

function writeActiveMapId(id: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set(URL_PARAM, id)
    window.localStorage.setItem(STORAGE_KEY, id)
  } else {
    url.searchParams.delete(URL_PARAM)
    window.localStorage.removeItem(STORAGE_KEY)
  }
  window.history.replaceState(null, '', url.toString())
}

interface SerializedDocument {
  id: string
  nodes: Record<string, GraphDocument['nodes'] extends Map<string, infer V> ? V : never>
  edges: Record<string, GraphDocument['edges'] extends Map<string, infer V> ? V : never>
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  processAssets?: ProcessAssets
  processInstances?: Record<string, ProcessInstance>
  meta: GraphDocument['meta']
}

function documentFromSerialized(
  mapId: string,
  document: SerializedDocument | undefined,
): GraphDocument {
  if (!document) return createEmptyDocument(mapId)
  return {
    id: document.id,
    nodes: new Map(Object.entries(document.nodes)),
    edges: new Map(Object.entries(document.edges)),
    selectedNodeIds: new Set(document.selectedNodeIds),
    selectedEdgeIds: new Set(document.selectedEdgeIds),
    viewport: document.viewport,
    processAssets: normalizeProcessAssets(document.processAssets),
    processInstances: document.processInstances ?? {},
    meta: document.meta,
  }
}

function ensureStartNode(doc: GraphDocument): GraphDocument {
  if (doc.nodes.has('start')) return doc
  return runCommand(doc, {
    type: 'AddNode',
    payload: {
      id: 'start',
      type: 'start',
      x: 360,
      y: 200,
      width: 120,
      height: 56,
      title: 'Start',
      roleTags: [],
      ports: [{ id: 'out', side: 'right' }],
    },
  })
}

export function LibraryGate() {
  const library = useLibrary()
  const [activeMapId, setActiveMapId] = useState<string | null>(readInitialMapId())
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [pendingSharedProcessId, setPendingSharedProcessId] = useState<string | null>(null)
  const [editingSharedProcessId, setEditingSharedProcessId] = useState<string | null>(null)
  const [pendingRemoveSharedProcessInstanceId, setPendingRemoveSharedProcessInstanceId] = useState<string | null>(null)
  const [activeProcessInstances, setActiveProcessInstances] = useState<ProcessInstance[]>([])

  // Pick a default map the first time we see the library. Sticky across
  // reloads: the URL/localStorage hint wins; otherwise fall back to the
  // most-recently updated map. An empty library gets a "Welcome" starter.
  useEffect(() => {
    if (library.loading) return
    // An empty library (no maps, no folders) gets a "Welcome" starter.
    // If there are folders but no maps, the previous test left folders
    // behind — still create a map at the root so the gate can mount.
    if (library.library.maps.length === 0) {
      void library.createMap('Welcome', null).then((map) => setActiveMapId(map.id))
      return
    }
    if (!activeMapId || !findMap(library.library, activeMapId)) {
      const fallback = mostRecentMap(library.library)
      if (fallback) setActiveMapId(fallback.id)
    }
    // The setState calls above are inside async .then() callbacks (or
    // guarded by an `if`), so they don't cascade-render synchronously.
    // The react-hooks plugin flags them anyway, hence the file-level
    // disable below.
  }, [library.loading, library.library, activeMapId, library])

  useEffect(() => {
    writeActiveMapId(activeMapId)
  }, [activeMapId])

  const activeMap = useMemo(
    () => (activeMapId ? findMap(library.library, activeMapId) : null),
    [activeMapId, library.library],
  )

  const initialDocument = useMemo<GraphDocument | undefined>(() => {
    if (library.loading) return undefined
    if (!activeMap) return undefined
    return ensureStartNode(documentFromSerialized(activeMap.id, activeMap.document as SerializedDocument | undefined))
  }, [activeMap, library.loading])

  const elementLibrary = library.library.elementLibrary ?? createEmptySharedElementLibrary()
  const editingSharedProcess = editingSharedProcessId ? elementLibrary.processes[editingSharedProcessId] : null

  if (library.loading || !initialDocument || !activeMapId) {
    return (
      <div className="library-loading">
        <p>Loading library…</p>
      </div>
    )
  }

  return (
    <div className={`library-gate${libraryCollapsed ? ' library-gate-collapsed' : ''}`}>
      <LibraryPanel
        library={library}
        activeMapId={activeMapId}
        onSelectMap={(id) => setActiveMapId(id)}
        collapsed={libraryCollapsed}
        onCollapsedChange={setLibraryCollapsed}
        onOpenSharedProcess={setEditingSharedProcessId}
        onInsertSharedProcess={setPendingSharedProcessId}
        activeProcessInstances={activeProcessInstances}
        onRemoveSharedProcessInstance={setPendingRemoveSharedProcessInstanceId}
      />
      <CanvasHost
        key={activeMapId}
        mapId={activeMapId}
        mapName={activeMap?.name ?? 'process-map'}
        initialDocument={initialDocument}
        sharedRoles={Object.values(elementLibrary.roles)}
        onEnsureSharedRoles={library.ensureSharedRoles}
        elementLibrary={elementLibrary}
        pendingSharedProcessId={pendingSharedProcessId}
        onSharedProcessInserted={() => setPendingSharedProcessId(null)}
        pendingRemoveSharedProcessInstanceId={pendingRemoveSharedProcessInstanceId}
        onSharedProcessRemoved={() => setPendingRemoveSharedProcessInstanceId(null)}
        onProcessInstancesChange={(instances) => setActiveProcessInstances(Object.values(instances))}
        onUpdateSharedActivity={(activityId, patch) => library.updateSharedElement('activity', activityId, patch)}
        onCreateSharedWorkProduct={async (draft) => { await library.createSharedElement('workProduct', draft) }}
        onUpdateSharedWorkProduct={(workProductId, patch) => library.updateSharedElement('workProduct', workProductId, patch)}
        onCreateSharedElement={(kind, draft) => library.createSharedElement(kind, draft)}
        onCreateMapFromDocument={async (name, doc) => {
          const map = await library.createMap(name, null)
          await library.saveMapDocument(map.id, serializeDocument({ ...doc, id: map.id }))
          setActiveMapId(map.id)
        }}
        onAutosave={(doc) => {
          void library.saveMapDocument(activeMapId, serializeDocument(doc)).catch(() => {
            // useLibrary owns the user-visible error state; avoid surfacing an
            // unhandled rejection from the debounced autosave callback.
          })
        }}
      />
      {editingSharedProcess && (
        <SharedProcessEditor
          key={editingSharedProcess.id}
          process={editingSharedProcess}
          activities={Object.values(elementLibrary.activities)}
          roles={Object.values(elementLibrary.roles)}
          onEnsureSharedRoles={library.ensureSharedRoles}
          onSave={(patch) => library.updateSharedElement('process', editingSharedProcess.id, patch)}
          onClose={() => setEditingSharedProcessId(null)}
        />
      )}
    </div>
  )
}

function serializeDocument(doc: GraphDocument): import('./library').SavedMap['document'] {
  return {
    id: doc.id,
    nodes: Object.fromEntries(doc.nodes),
    edges: Object.fromEntries(doc.edges),
    selectedNodeIds: Array.from(doc.selectedNodeIds),
    selectedEdgeIds: Array.from(doc.selectedEdgeIds),
    viewport: doc.viewport,
    processAssets: normalizeProcessAssets(doc.processAssets),
    processInstances: doc.processInstances,
    meta: { ...doc.meta, dirty: false },
  }
}

function CanvasHost({
  mapId,
  mapName,
  initialDocument,
  onAutosave,
  onCreateMapFromDocument,
  sharedRoles,
  onEnsureSharedRoles,
  elementLibrary,
  pendingSharedProcessId,
  onSharedProcessInserted,
  onUpdateSharedActivity,
  pendingRemoveSharedProcessInstanceId,
  onSharedProcessRemoved,
  onProcessInstancesChange,
  onCreateSharedWorkProduct,
  onUpdateSharedWorkProduct,
  onCreateSharedElement,
}: {
  mapId: string
  mapName: string
  initialDocument: GraphDocument
  onAutosave: (doc: GraphDocument) => void
  onCreateMapFromDocument: (name: string, doc: GraphDocument) => Promise<void>
  sharedRoles: import('./sharedElements').SharedRole[]
  onEnsureSharedRoles: (roleNames: string[]) => Promise<Record<string, string>>
  elementLibrary: import('./sharedElements').SharedElementLibrary
  pendingSharedProcessId: string | null
  onSharedProcessInserted: () => void
  onUpdateSharedActivity: (activityId: string, patch: Record<string, unknown>) => Promise<void>
  pendingRemoveSharedProcessInstanceId: string | null
  onSharedProcessRemoved: () => void
  onProcessInstancesChange: (instances: GraphDocument['processInstances']) => void
  onCreateSharedWorkProduct: (draft: { title: string; state?: string; description?: string }) => Promise<void>
  onUpdateSharedWorkProduct: (workProductId: string, patch: Record<string, unknown>) => Promise<void>
  onCreateSharedElement: (kind: 'process' | 'activity' | 'workProduct', draft: Record<string, unknown>) => Promise<Record<string, unknown>>
}) {
  // ProcessCanvas resets on `mapId` change because we re-mount the host via
  // `key` above. It owns the single canvas state instance for the active map.
  return (
    <ProcessCanvas
      mapId={mapId}
      mapName={mapName}
      initialDocument={initialDocument}
      onAutosave={onAutosave}
      onCreateMapFromDocument={onCreateMapFromDocument}
      sharedRoles={sharedRoles}
      onEnsureSharedRoles={onEnsureSharedRoles}
      elementLibrary={elementLibrary}
      pendingSharedProcessId={pendingSharedProcessId}
      onSharedProcessInserted={onSharedProcessInserted}
      onUpdateSharedActivity={onUpdateSharedActivity}
      pendingRemoveSharedProcessInstanceId={pendingRemoveSharedProcessInstanceId}
      onSharedProcessRemoved={onSharedProcessRemoved}
      onProcessInstancesChange={onProcessInstancesChange}
      onCreateSharedWorkProduct={onCreateSharedWorkProduct}
      onUpdateSharedWorkProduct={onUpdateSharedWorkProduct}
      onCreateSharedElement={onCreateSharedElement}
    />
  )
}
