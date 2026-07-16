import { useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import type { LibraryNode } from './library'
import { buildTree } from './library'
import { PROCESS_MAP_TEMPLATES, type ProcessMapTemplateId } from './templates/processMapTemplates'
import type { useLibrary } from './useLibrary'
import type { SavedFolder, SavedMap } from './library'
import { SharedElementsPanel } from './SharedElementsPanel'
import { createEmptySharedElementLibrary, type SharedElementKind, type SharedProcess } from './sharedElements'
import type { ProcessInstance } from './canvasTypes'

interface LibraryPanelProps {
  library: ReturnType<typeof useLibrary>
  activeMapId: string | null
  onSelectMap: (mapId: string) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onOpenSharedProcess?: (processId: string) => void
  onInsertSharedProcess?: (processId: string) => void
  activeProcessInstances?: ProcessInstance[]
  onRemoveSharedProcessInstance?: (instanceId: string) => void
}

export function LibraryPanel({ library, activeMapId, onSelectMap, collapsed, onCollapsedChange, onOpenSharedProcess, onInsertSharedProcess, activeProcessInstances = [], onRemoveSharedProcessInstance }: LibraryPanelProps) {
  const [view, setView] = useState<'maps' | 'elements'>('maps')
  const [creating, setCreating] = useState<'map' | 'folder' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [movePickerFor, setMovePickerFor] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'map' | 'folder'; id: string; name: string } | null>(null)

  const tree = useMemo(() => buildTree(library.library), [library.library])

  const ctx: RenderCtx = {
    activeMapId,
    onSelectMap,
    editingId, setEditingId, editingName, setEditingName,
    movePickerFor, setMovePickerFor,
    confirmDelete, setConfirmDelete,
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="library-rail"
        onClick={() => onCollapsedChange(false)}
        aria-label="Expand library"
      >
        <span className="library-rail-brand">Flowent</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    )
  }

  return (
    <aside className={`library-panel library-panel-${view}`} aria-label="Process library">
      <div className="library-header">
        <span className="library-title">Flowent</span>
        <button
          type="button"
          className="library-collapse"
          onClick={() => onCollapsedChange(true)}
          aria-label="Collapse library"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="library-primary-tabs" role="tablist" aria-label="Library views">
        <button type="button" role="tab" aria-selected={view === 'maps'} className={view === 'maps' ? 'active' : ''} onClick={() => setView('maps')}>Maps</button>
        <button type="button" role="tab" aria-selected={view === 'elements'} className={view === 'elements' ? 'active' : ''} onClick={() => setView('elements')}>Elements</button>
      </div>

      {view === 'maps' ? <>
      <div className="library-list" role="tree">
        <div id="process-status-slot" className="process-status-slot" />
        {library.library.maps.length === 0 && library.library.folders.length === 0 && !creating && (
          <p className="library-empty">No maps yet. Create one to get started.</p>
        )}

        {tree.map((node) => renderNode(node, library, ctx, 0))}

        {creating === 'map' && (
          <NewMapForm
            onSubmit={async (name, templateId) => {
              const map = await library.createMapFromTemplate(name, null, templateId)
              onSelectMap(map.id)
              setCreating(null)
            }}
            onCancel={() => setCreating(null)}
          />
        )}
        {creating === 'folder' && (
          <NewItemForm
            placeholder="New folder name"
            onSubmit={async (name) => {
              await library.createFolder(name, null)
              setCreating(null)
            }}
            onCancel={() => setCreating(null)}
          />
        )}
      </div>

      <div className="library-footer">
        <button type="button" className="library-add" onClick={() => setCreating('map')}>
          + Map
        </button>
        <button type="button" className="library-add" onClick={() => setCreating('folder')}>
          + Folder
        </button>
      </div>
      <MapProcessesSection
        processes={Object.values(library.library.elementLibrary?.processes ?? {})}
        activeInstances={activeProcessInstances}
        onInsert={(processId) => onInsertSharedProcess?.(processId)}
        onRemove={(instanceId) => onRemoveSharedProcessInstance?.(instanceId)}
      />
      </> : (
        <div className="library-elements-view">
          <SharedElementsPanel
            elementLibrary={library.library.elementLibrary ?? createEmptySharedElementLibrary()}
            onCreate={async (kind, draft) => { await library.createSharedElement(kind as SharedElementKind, draft) }}
            onUpdate={(kind, id, patch) => library.updateSharedElement(kind as SharedElementKind, id, patch)}
            onDelete={(kind, id, confirmed) => library.deleteSharedElement(kind as SharedElementKind, id, confirmed)}
            onOpenProcess={(processId) => onOpenSharedProcess?.(processId)}
            onEnsureRoles={library.ensureSharedRoles}
          />
        </div>
      )}

      {library.saveStatus === 'saving' && <span className="library-status">Saving…</span>}
      {library.saveStatus === 'saved' && <span className="library-status library-status-saved">Saved</span>}
      {library.saveStatus === 'error' && (
        <span className="library-status library-status-error">Save failed: {library.error}</span>
      )}

      {confirmDelete && (
        <DeleteConfirm
          target={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (confirmDelete.kind === 'map') {
              await library.deleteMap(confirmDelete.id)
              if (activeMapId === confirmDelete.id) onSelectMap('')
            } else {
              await library.deleteFolder(confirmDelete.id)
            }
            setConfirmDelete(null)
          }}
        />
      )}
    </aside>
  )
}

function MapProcessesSection({ processes, activeInstances, onInsert, onRemove }: { processes: SharedProcess[]; activeInstances: ProcessInstance[]; onInsert: (processId: string) => void; onRemove: (instanceId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="library-map-processes" aria-label="Reusable processes for this map">
      <button type="button" className="library-map-processes-heading" onClick={() => setExpanded((value) => !value)}>
        <span>Processes</span>
        <span aria-hidden="true">{expanded ? '-' : '+'}</span>
      </button>
      {expanded && (
        <div className="library-map-processes-list">
          {activeInstances.length > 0 && <>
            <p className="library-map-processes-subheading">In this map</p>
            {activeInstances.map((instance) => {
              const process = processes.find((item) => item.id === instance.processId)
              return (
                <div key={instance.id} className="library-map-process-row">
                  <span title={process?.title ?? instance.processId}>{process?.title ?? 'Missing process'}</span>
                  <button type="button" className="library-map-process-remove" onClick={() => onRemove(instance.id)}>Remove</button>
                </div>
              )
            })}
          </>}
          <p className="library-map-processes-subheading">Insert process</p>
          {processes.length === 0 ? <p>Create a reusable Process in Elements first.</p> : processes.map((process) => (
            <div key={process.id} className="library-map-process-row">
              <span title={process.title}>{process.title}</span>
              <button type="button" onClick={() => onInsert(process.id)}>Insert</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface RenderCtx {
  activeMapId: string | null
  onSelectMap: (id: string) => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  editingName: string
  setEditingName: (name: string) => void
  movePickerFor: string | null
  setMovePickerFor: (id: string | null) => void
  confirmDelete: { kind: 'map' | 'folder'; id: string; name: string } | null
  setConfirmDelete: (c: { kind: 'map' | 'folder'; id: string; name: string } | null) => void
}

function renderNode(
  node: LibraryNode,
  lib: ReturnType<typeof useLibrary>,
  ctx: RenderCtx,
  depth: number,
) {
  if (node.kind === 'folder') {
    return (
      <FolderRow
        key={node.folder.id}
        folder={node.folder}
        lib={lib}
        ctx={ctx}
        depth={depth}
      >
        {node.children.map((c) => renderNode(c, lib, ctx, depth + 1))}
      </FolderRow>
    )
  }
  return (
    <MapRow
      key={node.map.id}
      map={node.map}
      lib={lib}
      ctx={ctx}
      depth={depth}
    />
  )
}

function FolderRow({
  folder,
  lib,
  ctx,
  depth,
  children,
}: {
  folder: SavedFolder
  lib: ReturnType<typeof useLibrary>
  ctx: RenderCtx
  depth: number
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(true)
  const isEditing = ctx.editingId === folder.id
  const isMovePicker = ctx.movePickerFor === folder.id

  return (
    <div className="library-folder" role="treeitem" aria-expanded={expanded}>
      <div className="library-row" style={{ paddingLeft: 8 + depth * 16 }}>
        <button
          type="button"
          className="library-caret"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        {isEditing ? (
          <InlineEdit
            value={ctx.editingName}
            onChange={ctx.setEditingName}
            onCommit={async () => {
              if (ctx.editingName.trim()) await lib.renameFolder(folder.id, ctx.editingName.trim())
              ctx.setEditingId(null)
            }}
            onCancel={() => ctx.setEditingId(null)}
          />
        ) : (
          <span
            className="library-folder-name"
            onDoubleClick={() => {
              ctx.setEditingId(folder.id)
              ctx.setEditingName(folder.name)
            }}
          >
            {folder.name}
          </span>
        )}
        <RowActions
          onRename={() => { ctx.setEditingId(folder.id); ctx.setEditingName(folder.name) }}
          onMove={() => ctx.setMovePickerFor(isMovePicker ? null : folder.id)}
          onDelete={() => ctx.setConfirmDelete({ kind: 'folder', id: folder.id, name: folder.name })}
        />
      </div>
      {isMovePicker && (
        <MovePicker
          current={folder.parentId}
          folders={lib.library.folders}
          excludeId={folder.id}
          onPick={async (parentId) => {
            await lib.moveFolder(folder.id, parentId)
            ctx.setMovePickerFor(null)
          }}
          onCancel={() => ctx.setMovePickerFor(null)}
        />
      )}
      {expanded && children}
    </div>
  )
}

function MapRow({
  map,
  lib,
  ctx,
  depth,
}: {
  map: SavedMap
  lib: ReturnType<typeof useLibrary>
  ctx: RenderCtx
  depth: number
}) {
  const isActive = ctx.activeMapId === map.id
  const isEditing = ctx.editingId === map.id
  const isMovePicker = ctx.movePickerFor === map.id

  return (
    <div className={`library-map${isActive ? ' library-map-active' : ''}`} role="treeitem" aria-selected={isActive}>
      <div className="library-row library-row-clickable" style={{ paddingLeft: 8 + depth * 16 + 18 }}>
        <button
          type="button"
          className="library-map-button"
          onClick={() => ctx.onSelectMap(map.id)}
        >
          {isEditing ? (
            <InlineEdit
              value={ctx.editingName}
              onChange={ctx.setEditingName}
              onCommit={async () => {
                if (ctx.editingName.trim()) await lib.renameMap(map.id, ctx.editingName.trim())
                ctx.setEditingId(null)
              }}
              onCancel={() => ctx.setEditingId(null)}
              stopPropagation
            />
          ) : (
            <span
              className="library-map-name"
              onDoubleClick={(e) => {
                e.stopPropagation()
                ctx.setEditingId(map.id)
                ctx.setEditingName(map.name)
              }}
            >
              {map.name}
            </span>
          )}
        </button>
        <RowActions
          onRename={(e) => { e.stopPropagation(); ctx.setEditingId(map.id); ctx.setEditingName(map.name) }}
          onMove={(e) => { e.stopPropagation(); ctx.setMovePickerFor(isMovePicker ? null : map.id) }}
          onDelete={(e) => { e.stopPropagation(); ctx.setConfirmDelete({ kind: 'map', id: map.id, name: map.name }) }}
        />
      </div>
      {isMovePicker && (
        <div style={{ paddingLeft: 8 + depth * 16 + 18 }}>
          <MovePicker
            current={map.folderId}
            folders={lib.library.folders}
            excludeId={null}
            onPick={async (folderId) => {
              await lib.moveMap(map.id, folderId)
              ctx.setMovePickerFor(null)
            }}
            onCancel={() => ctx.setMovePickerFor(null)}
          />
        </div>
      )}
    </div>
  )
}

function RowActions({
  onRename,
  onMove,
  onDelete,
}: {
  onRename: (e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onDelete: (e: MouseEvent) => void
}) {
  return (
    <span className="library-row-actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="library-icon-button" onClick={onRename} title="Rename" aria-label="Rename">✎</button>
      <button type="button" className="library-icon-button" onClick={onMove} title="Move" aria-label="Move">↗</button>
      <button type="button" className="library-icon-button library-icon-danger" onClick={onDelete} title="Delete" aria-label="Delete">×</button>
    </span>
  )
}

function InlineEdit({
  value,
  onChange,
  onCommit,
  onCancel,
  stopPropagation,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void | Promise<void>
  onCancel: () => void
  stopPropagation?: boolean
}) {
  return (
    <input
      autoFocus
      className="library-inline-edit"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => void onCommit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void onCommit()
        if (e.key === 'Escape') onCancel()
      }}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    />
  )
}

function MovePicker({
  current,
  folders,
  excludeId,
  onPick,
  onCancel,
}: {
  current: string | null
  folders: SavedFolder[]
  excludeId: string | null
  onPick: (parentId: string | null) => void | Promise<void>
  onCancel: () => void
}) {
  const candidates = folders.filter((f) => f.id !== excludeId)
  return (
    <div className="library-move-picker" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`library-move-option${current === null ? ' library-move-active' : ''}`}
        onClick={() => void onPick(null)}
      >
        (root)
      </button>
      {candidates.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`library-move-option${current === f.id ? ' library-move-active' : ''}`}
          onClick={() => void onPick(f.id)}
        >
          {f.name}
        </button>
      ))}
      <button type="button" className="library-move-cancel" onClick={onCancel}>cancel</button>
    </div>
  )
}

function NewItemForm({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string
  onSubmit: (name: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  return (
    <form
      className="library-new-form"
      onSubmit={async (e: FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        await onSubmit(name.trim())
        setName('')
      }}
    >
      <input
        autoFocus
        className="library-new-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
      />
      <button type="submit" className="library-new-confirm" aria-label="Confirm">✓</button>
      <button type="button" className="library-new-cancel" onClick={onCancel} aria-label="Cancel">×</button>
    </form>
  )
}

function NewMapForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, templateId: ProcessMapTemplateId) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState<ProcessMapTemplateId>('blank')

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await onSubmit(trimmed, templateId)
  }

  return (
    <form className="library-new-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        aria-label="New map name"
        placeholder="New map name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}
      />
      <label className="library-template-label" htmlFor="new-map-template">
        Template
      </label>
      <select
        id="new-map-template"
        value={templateId}
        onChange={(event) => setTemplateId(event.target.value as ProcessMapTemplateId)}
      >
        {PROCESS_MAP_TEMPLATES.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      <div className="library-template-description">
        {PROCESS_MAP_TEMPLATES.find((template) => template.id === templateId)?.description}
      </div>
      <div className="library-new-actions">
        <button type="submit" aria-label="Confirm">Create</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function DeleteConfirm({
  target,
  onCancel,
  onConfirm,
}: {
  target: { kind: 'map' | 'folder'; id: string; name: string }
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <div className="library-confirm-overlay" role="dialog" aria-modal="true">
      <div className="library-confirm">
        <p>Delete <strong>{target.name}</strong>?</p>
        <p className="library-confirm-hint">This cannot be undone.</p>
        <div className="library-confirm-actions">
          <button type="button" className="library-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="library-confirm-danger" onClick={() => void onConfirm()}>Delete</button>
        </div>
      </div>
    </div>
  )
}
