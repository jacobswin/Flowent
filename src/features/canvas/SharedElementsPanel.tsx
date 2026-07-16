import { useMemo, useState } from 'react'
import type { ResponsibilityKind } from './canvasTypes'
import type { SharedActivity, SharedActivityResponsibility, SharedElementLibrary } from './sharedElements'

type ElementTab = 'process' | 'activity' | 'role' | 'workProduct'

type ElementDraft = Record<string, unknown>

export interface SharedElementsPanelProps {
  elementLibrary: SharedElementLibrary
  onCreate: (kind: ElementTab, draft: ElementDraft) => void | Promise<void>
  onUpdate: (kind: ElementTab, id: string, patch: ElementDraft) => void | Promise<void>
  onDelete: (kind: ElementTab, id: string, confirmed?: boolean) => Promise<void>
  onOpenProcess: (processId: string) => void
  onEnsureRoles?: (roleNames: string[]) => Promise<Record<string, string>>
}

const TABS: Array<{ id: ElementTab; label: string; plural: string }> = [
  { id: 'process', label: 'Processes', plural: 'processes' },
  { id: 'activity', label: 'Activities', plural: 'activities' },
  { id: 'role', label: 'Roles', plural: 'roles' },
  { id: 'workProduct', label: 'Work Products', plural: 'workProducts' },
]

export function SharedElementsPanel({
  elementLibrary,
  onCreate,
  onUpdate,
  onDelete,
  onOpenProcess,
  onEnsureRoles,
}: SharedElementsPanelProps) {
  const [tab, setTab] = useState<ElementTab>('process')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  const items = useMemo(() => getItems(elementLibrary, tab).filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase())), [elementLibrary, search, tab])
  const selected = items.find((item) => item.id === selectedId) ?? null
  const tabMeta = TABS.find((item) => item.id === tab)!

  function switchTab(next: ElementTab): void {
    setTab(next)
    setSelectedId(null)
    setCreating(false)
    setPendingDelete(false)
  }

  return (
    <section className="shared-elements-panel" aria-label="Shared elements library">
      <div className="shared-elements-heading">
        <div>
          <span className="shared-elements-eyebrow">Shared across maps</span>
          <h2>Elements</h2>
        </div>
      </div>

      <div className="shared-elements-tabs" role="tablist" aria-label="Shared element types">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => switchTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="shared-elements-toolbar">
        <input
          aria-label={`Search ${tabMeta.label}`}
          placeholder={`Search ${tabMeta.label.toLowerCase()}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className="shared-elements-create" onClick={() => { setCreating(true); setSelectedId(null) }}>
          New {singularLabel(tab)}
        </button>
      </div>

      <div className="shared-elements-master-detail">
        <div className="shared-elements-list" role="list" aria-label={`${tabMeta.label} list`}>
          {items.length === 0 && <p className="shared-elements-empty">No {tabMeta.plural} yet.</p>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={item.id === selectedId ? 'selected' : ''}
              onClick={() => { setSelectedId(item.id); setCreating(false); setPendingDelete(false) }}
              title={item.title}
            >
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </button>
          ))}
        </div>

        <div className="shared-elements-detail">
          {creating && (
            <ElementCreateForm
              kind={tab}
              onCancel={() => setCreating(false)}
              onCreate={(draft) => {
                void onCreate(tab, draft)
                setCreating(false)
              }}
            />
          )}
          {selected && !creating && (
            tab === 'activity' ? (
              <SharedActivityDetail
                activity={selected.data as unknown as SharedActivity}
                elementLibrary={elementLibrary}
                onEnsureRoles={onEnsureRoles}
                onUpdate={(patch) => void onUpdate('activity', selected.id, patch)}
                pendingDelete={pendingDelete}
                onDelete={() => {
                  if (pendingDelete) {
                    void onDelete('activity', selected.id, true).then(() => setSelectedId(null))
                    return
                  }
                  void onDelete('activity', selected.id).then(() => setSelectedId(null)).catch(() => setPendingDelete(true))
                }}
                onCancelDelete={() => setPendingDelete(false)}
              />
            ) : <ElementDetail
              kind={tab}
              item={selected}
              onUpdate={(patch) => void onUpdate(tab, selected.id, patch)}
              onOpenProcess={tab === 'process' ? () => onOpenProcess(selected.id) : undefined}
              pendingDelete={pendingDelete}
              onDelete={() => {
                if (pendingDelete) {
                  void onDelete(tab, selected.id, true).then(() => setSelectedId(null))
                  return
                }
                void onDelete(tab, selected.id).then(() => setSelectedId(null)).catch(() => setPendingDelete(true))
              }}
              onCancelDelete={() => setPendingDelete(false)}
            />
          )}
          {!selected && !creating && <p className="shared-elements-placeholder">Select an element to manage its details and use it across process maps.</p>}
        </div>
      </div>
    </section>
  )
}

function getItems(library: SharedElementLibrary, kind: ElementTab): Array<{ id: string; title: string; meta: string; data: Record<string, unknown> }> {
  if (kind === 'role') return Object.values(library.roles).map((item) => ({ id: item.id, title: item.name, meta: item.description || 'Role', data: item }))
  if (kind === 'workProduct') return Object.values(library.workProducts).map((item) => ({ id: item.id, title: item.title, meta: item.state, data: item }))
  if (kind === 'activity') return Object.values(library.activities).map((item) => ({ id: item.id, title: item.title, meta: `${item.responsibilities.length} RASIC links`, data: item }))
  return Object.values(library.processes).map((item) => ({ id: item.id, title: item.title, meta: `${item.activities.length} activities`, data: item }))
}

function singularLabel(kind: ElementTab): string {
  return kind === 'workProduct' ? 'work product' : kind
}

function ElementCreateForm({ kind, onCancel, onCreate }: { kind: ElementTab; onCancel: () => void; onCreate: (draft: ElementDraft) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [state, setState] = useState('Draft')
  const label = singularLabel(kind)
  const fieldLabel = kind === 'role' ? 'Role name' : `${label[0]!.toUpperCase()}${label.slice(1)} title`

  return (
    <form className="shared-elements-form" onSubmit={(event) => {
      event.preventDefault()
      if (!name.trim()) return
      const base = kind === 'role' ? { name: name.trim(), description } : { title: name.trim(), description }
      onCreate(kind === 'workProduct' ? { ...base, state } : base)
    }}>
      <h3>New {label}</h3>
      <label htmlFor={`shared-create-${kind}-name`}>{fieldLabel}</label>
      <input id={`shared-create-${kind}-name`} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      {kind === 'workProduct' && (
        <>
          <label htmlFor="shared-create-work-product-state">Default maturity</label>
          <input id="shared-create-work-product-state" value={state} onChange={(event) => setState(event.target.value)} />
        </>
      )}
      <label htmlFor={`shared-create-${kind}-description`}>Description</label>
      <textarea id={`shared-create-${kind}-description`} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      <div className="shared-elements-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit">Create {label}</button>
      </div>
    </form>
  )
}

function SharedActivityDetail({
  activity,
  elementLibrary,
  onEnsureRoles,
  onUpdate,
  pendingDelete,
  onDelete,
  onCancelDelete,
}: {
  activity: SharedActivity
  elementLibrary: SharedElementLibrary
  onEnsureRoles?: (roleNames: string[]) => Promise<Record<string, string>>
  onUpdate: (patch: ElementDraft) => void
  pendingDelete: boolean
  onDelete: () => void
  onCancelDelete: () => void
}) {
  const [title, setTitle] = useState(activity.title)
  const [summary, setSummary] = useState(activity.summary)
  const [expectations, setExpectations] = useState(activity.expectations)
  const [fields, setFields] = useState<Record<ResponsibilityKind, string>>(() => responsibilityFields(activity, elementLibrary))
  const [workProductId, setWorkProductId] = useState('')
  const [relation, setRelation] = useState<'input' | 'output'>('input')
  const [maturity, setMaturity] = useState('Draft')

  async function save(): Promise<void> {
    const parsed = parseResponsibilityFields(fields)
    const roleIdsByName = onEnsureRoles ? await onEnsureRoles(parsed.map((item) => item.roleName)) : roleIdsFromLibrary(parsed, elementLibrary)
    const responsibilities: SharedActivityResponsibility[] = parsed.flatMap((item, index) => {
      const roleId = roleIdsByName[normalizeRoleName(item.roleName)]
      return roleId ? [{ id: `shared-responsibility-${activity.id}-${roleId}-${item.kind}-${index}`, roleId, kind: item.kind }] : []
    })
    onUpdate({ title: title.trim() || activity.title, summary, expectations, responsibilities, workProductLinks: activity.workProductLinks })
  }

  const linkedProducts = activity.workProductLinks.map((link) => ({ link, workProduct: elementLibrary.workProducts[link.workProductId] })).filter((item) => item.workProduct)

  return (
    <form className="shared-elements-form shared-activity-detail" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <h3>Shared activity</h3>
      <label htmlFor={`shared-detail-${activity.id}-title`}>Activity title</label>
      <input id={`shared-detail-${activity.id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} />
      <label htmlFor={`shared-detail-${activity.id}-summary`}>Summary</label>
      <textarea id={`shared-detail-${activity.id}-summary`} value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} />
      <label htmlFor={`shared-detail-${activity.id}-expectations`}>Expectations</label>
      <textarea id={`shared-detail-${activity.id}-expectations`} value={expectations} onChange={(event) => setExpectations(event.target.value)} rows={2} />
      <section className="shared-activity-rasic" aria-label="Shared activity RASIC">
        <h4>RASIC responsibilities</h4>
        {(Object.entries(RASIC_LABELS) as Array<[ResponsibilityKind, string]>).map(([kind, label]) => (
          <label key={kind} htmlFor={`shared-activity-${activity.id}-${kind}`}>
            {label}
            {kind === 'responsible' ? (
              <input id={`shared-activity-${activity.id}-${kind}`} list="shared-element-role-options" value={fields[kind]} onChange={(event) => setFields((current) => ({ ...current, [kind]: event.target.value }))} placeholder="Person or role" />
            ) : (
              <textarea id={`shared-activity-${activity.id}-${kind}`} value={fields[kind]} onChange={(event) => setFields((current) => ({ ...current, [kind]: event.target.value }))} rows={2} placeholder="People or roles" />
            )}
          </label>
        ))}
        <datalist id="shared-element-role-options">
          {Object.values(elementLibrary.roles).map((role) => <option key={role.id} value={role.name} />)}
        </datalist>
      </section>
      <section className="shared-activity-work-products" aria-label="Shared activity work products">
        <h4>Work products</h4>
        {linkedProducts.map(({ link, workProduct }) => (
          <div key={link.id} className="shared-activity-work-product-link">
            <span>{workProduct!.title} - {link.relation === 'input' ? 'In' : 'Out'} - {link.maturity}</span>
            <button type="button" aria-label={`Unlink ${workProduct!.title}`} onClick={() => onUpdate({ workProductLinks: activity.workProductLinks.filter((item) => item.id !== link.id) })}>x</button>
          </div>
        ))}
        <div className="shared-activity-work-product-add">
          <select aria-label="Shared work product" value={workProductId} onChange={(event) => setWorkProductId(event.target.value)}>
            <option value="">Select work product</option>
            {Object.values(elementLibrary.workProducts).map((workProduct) => <option key={workProduct.id} value={workProduct.id}>{workProduct.title}</option>)}
          </select>
          <select aria-label="Work product relation" value={relation} onChange={(event) => setRelation(event.target.value as 'input' | 'output')}>
            <option value="input">Input</option>
            <option value="output">Output</option>
          </select>
          <input aria-label="Work product maturity" value={maturity} onChange={(event) => setMaturity(event.target.value)} />
          <button type="button" disabled={!workProductId || !maturity.trim()} onClick={() => {
            if (!workProductId || !maturity.trim()) return
            onUpdate({ workProductLinks: [...activity.workProductLinks, {
              id: `shared-work-product-link-${activity.id}-${Date.now()}`,
              workProductId,
              relation,
              maturity: maturity.trim(),
            }] })
            setWorkProductId('')
          }}>Link</button>
        </div>
      </section>
      <div className="shared-elements-actions"><button type="submit">Save shared activity</button></div>
      {pendingDelete ? (
        <div className="shared-elements-delete-confirm" role="alert">
          <p>This Activity is used by a Process. Deleting it will remove its placements and handoffs.</p>
          <button type="button" onClick={onCancelDelete}>Cancel</button>
          <button type="button" className="shared-elements-danger" onClick={onDelete}>Delete everywhere</button>
        </div>
      ) : <button type="button" className="shared-elements-danger" onClick={onDelete}>Delete</button>}
    </form>
  )
}

const RASIC_LABELS: Record<ResponsibilityKind, string> = {
  responsible: 'Responsible',
  accountable: 'Accountable',
  supporting: 'Supporting',
  consulted: 'Consulted',
  informed: 'Informed',
}

function responsibilityFields(activity: SharedActivity, library: SharedElementLibrary): Record<ResponsibilityKind, string> {
  const fields: Record<ResponsibilityKind, string> = { responsible: '', accountable: '', supporting: '', consulted: '', informed: '' }
  for (const responsibility of activity.responsibilities) {
    const role = library.roles[responsibility.roleId]
    if (!role) continue
    fields[responsibility.kind] = [fields[responsibility.kind], role.name].filter(Boolean).join(', ')
  }
  return fields
}

function parseResponsibilityFields(fields: Record<ResponsibilityKind, string>): Array<{ roleName: string; kind: ResponsibilityKind }> {
  const result: Array<{ roleName: string; kind: ResponsibilityKind }> = []
  const seen = new Set<string>()
  for (const kind of Object.keys(RASIC_LABELS) as ResponsibilityKind[]) {
    const names = fields[kind].split(/[\n,，;；]+/).map((value) => value.trim()).filter(Boolean)
    for (const [index, roleName] of names.entries()) {
      if (kind === 'responsible' && index > 0) break
      const key = normalizeRoleName(roleName)
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ roleName, kind })
    }
  }
  return result
}

function roleIdsFromLibrary(items: Array<{ roleName: string }>, library: SharedElementLibrary): Record<string, string> {
  const result: Record<string, string> = {}
  for (const item of items) {
    const match = Object.values(library.roles).find((role) => normalizeRoleName(role.name) === normalizeRoleName(item.roleName))
    if (match) result[normalizeRoleName(item.roleName)] = match.id
  }
  return result
}

function normalizeRoleName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function ElementDetail({
  kind,
  item,
  onUpdate,
  onOpenProcess,
  pendingDelete,
  onDelete,
  onCancelDelete,
}: {
  kind: ElementTab
  item: { id: string; title: string; meta: string; data: Record<string, unknown> }
  onUpdate: (patch: ElementDraft) => void
  onOpenProcess?: () => void
  pendingDelete: boolean
  onDelete: () => void
  onCancelDelete: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(String(item.data.description ?? ''))
  const [state, setState] = useState(String(item.data.state ?? 'Draft'))
  const nameKey = kind === 'role' ? 'name' : 'title'
  const label = kind === 'role' ? 'Role name' : `${singularLabel(kind)} title`

  return (
    <form className="shared-elements-form" onSubmit={(event) => {
      event.preventDefault()
      onUpdate({ [nameKey]: title.trim(), description, ...(kind === 'workProduct' ? { state } : {}) })
    }}>
      <h3>{kind === 'process' ? 'Reusable process' : `Shared ${singularLabel(kind)}`}</h3>
      <label htmlFor={`shared-detail-${item.id}-title`}>{label}</label>
      <input id={`shared-detail-${item.id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} />
      {kind === 'workProduct' && (
        <>
          <label htmlFor={`shared-detail-${item.id}-state`}>Default maturity</label>
          <input id={`shared-detail-${item.id}-state`} value={state} onChange={(event) => setState(event.target.value)} />
        </>
      )}
      <label htmlFor={`shared-detail-${item.id}-description`}>Description</label>
      <textarea id={`shared-detail-${item.id}-description`} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      <div className="shared-elements-actions">
        <button type="submit">Save</button>
        {onOpenProcess && <button type="button" onClick={onOpenProcess}>Open process editor</button>}
      </div>
      {pendingDelete ? (
        <div className="shared-elements-delete-confirm" role="alert">
          <p>This element is still used. Deleting it will clear its linked references.</p>
          <button type="button" onClick={onCancelDelete}>Cancel</button>
          <button type="button" className="shared-elements-danger" onClick={onDelete}>Delete everywhere</button>
        </div>
      ) : (
        <button type="button" className="shared-elements-danger" onClick={onDelete}>Delete</button>
      )}
    </form>
  )
}
