import { type ReactNode, useState } from 'react'
import type {
  GraphDocument,
  GuidanceAsset,
  GuidanceKind,
  MilestoneAsset,
  WorkProductActivityLink,
  WorkProductActivityRelation,
  WorkProductAsset,
} from './canvasTypes'
import {
  WORK_PRODUCT_MATURITY_OPTIONS,
  deriveProcessPerspectives,
  getActivityResponsibilities,
  getProcessAssetUsage,
  getWorkProductActivityLinks,
  hasWorkProductActivityMaturityConflict,
} from './processAssets'
import { TopDockPanel } from './TopDockPanel'

type AssetKind = 'workProduct' | 'guidance' | 'milestone'
type AssetTab = 'workProducts' | 'guidance' | 'milestones' | 'perspectives'
type AssetSelection = { kind: AssetKind; id: string }
type AssetCreateData = { title: string; kind?: GuidanceKind }
type AssetRelation =
  | 'producer'
  | 'consumer'
  | 'handoff'
  | 'guidance'
  | 'node'
  | 'edge'
  | 'workProduct'
  | 'stage'
  | 'workProductState'
type AssetPatch = Partial<WorkProductAsset> | Partial<GuidanceAsset> | Partial<MilestoneAsset>
type AssetRelationOptions = { maturity?: string }

interface ProcessAssetsPanelProps {
  document: GraphDocument
  defaultCollapsed?: boolean
  selectedAsset?: AssetSelection | null
  onSelectAsset: (kind: AssetKind, id: string) => void
  onCreateAsset?: (kind: AssetKind, data: AssetCreateData) => void
  onRenameAsset: (kind: AssetKind, id: string, title: string) => void
  onDeleteAsset: (kind: AssetKind, id: string) => void
  onUpdateAsset?: (kind: AssetKind, id: string, patch: AssetPatch) => void
  onLinkAsset?: (kind: AssetKind, id: string, relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
  onUnlinkAsset?: (kind: AssetKind, id: string, relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
  onSelectObjectTarget?: (type: 'node' | 'edge', id: string) => void
}

export function ProcessAssetsPanel({
  document,
  defaultCollapsed = true,
  selectedAsset,
  onSelectAsset,
  onCreateAsset,
  onRenameAsset,
  onDeleteAsset,
  onUpdateAsset,
  onLinkAsset,
  onUnlinkAsset,
  onSelectObjectTarget,
}: ProcessAssetsPanelProps) {
  const [tab, setTab] = useState<AssetTab>('workProducts')
  const [localSelection, setLocalSelection] = useState<AssetSelection | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AssetSelection | null>(null)
  const activeSelection = selectedAsset ?? localSelection
  const totalAssets =
    Object.keys(document.processAssets.workProducts).length +
    Object.keys(document.processAssets.guidanceItems).length +
    Object.keys(document.processAssets.milestones).length
  const completeness = getProcessCompleteness(document)

  const selectAsset = (kind: AssetKind, id: string) => {
    setLocalSelection({ kind, id })
    onSelectAsset(kind, id)
  }

  const updateAsset = (kind: AssetKind, id: string, patch: AssetPatch) => {
    if (onUpdateAsset) {
      onUpdateAsset(kind, id, patch)
      return
    }
    if ('title' in patch && typeof patch.title === 'string') {
      onRenameAsset(kind, id, patch.title)
    }
  }

  const requestDelete = (kind: AssetKind, id: string) => {
    const usage = getProcessAssetUsage(document, kind, id)
    if (usage.total === 0) {
      onDeleteAsset(kind, id)
      return
    }
    setPendingDelete({ kind, id })
  }

  return (
    <TopDockPanel
      as="aside"
      className="process-assets-panel"
      ariaLabel="Process assets"
      storageKey="flowent:top-dock:process-assets:collapsed"
      title="Process assets"
      subtitle="What / Who / When / How"
      badge={<strong>{totalAssets}</strong>}
      width={520}
      collapsedWidth={260}
      defaultCollapsed={defaultCollapsed}
    >
      <div className="process-assets-workspace">
        <div className="process-assets-master">
          <div className="process-assets-tabs" role="group" aria-label="Process asset views">
            <TabButton active={tab === 'workProducts'} onClick={() => setTab('workProducts')}>Work Products</TabButton>
            <TabButton active={tab === 'guidance'} onClick={() => setTab('guidance')}>Guidance</TabButton>
            <TabButton active={tab === 'milestones'} onClick={() => setTab('milestones')}>Milestones</TabButton>
            <TabButton active={tab === 'perspectives'} onClick={() => setTab('perspectives')}>Perspectives</TabButton>
          </div>
          <ProcessCompletenessSummary counts={completeness} />

          {tab === 'workProducts' && (
            <>
              <AssetCreateForm kind="workProduct" onCreateAsset={onCreateAsset} />
              <AssetList
                document={document}
                empty="No work products yet."
                items={Object.values(document.processAssets.workProducts)}
                kind="workProduct"
                pendingDelete={pendingDelete}
                getMeta={(item) => formatWorkProductMeta(item)}
                onSelectAsset={selectAsset}
                onRenameAsset={onRenameAsset}
                onDeleteAsset={requestDelete}
                onConfirmDelete={(kind, id) => {
                  onDeleteAsset(kind, id)
                  setPendingDelete(null)
                }}
                onCancelDelete={() => setPendingDelete(null)}
              />
            </>
          )}
          {tab === 'guidance' && (
            <>
              <AssetCreateForm kind="guidance" onCreateAsset={onCreateAsset} />
              <AssetList
                document={document}
                empty="No guidance yet."
                items={Object.values(document.processAssets.guidanceItems)}
                kind="guidance"
                pendingDelete={pendingDelete}
                getMeta={(item) => `${formatGuidanceKind(item.kind)} · ${countGuidanceLinks(item)} links`}
                onSelectAsset={selectAsset}
                onRenameAsset={onRenameAsset}
                onDeleteAsset={requestDelete}
                onConfirmDelete={(kind, id) => {
                  onDeleteAsset(kind, id)
                  setPendingDelete(null)
                }}
                onCancelDelete={() => setPendingDelete(null)}
              />
            </>
          )}
          {tab === 'milestones' && (
            <>
              <AssetCreateForm kind="milestone" onCreateAsset={onCreateAsset} />
              <AssetList
                document={document}
                empty="No milestones yet."
                items={Object.values(document.processAssets.milestones)}
                kind="milestone"
                pendingDelete={pendingDelete}
                getMeta={(item) => `${item.stageNodeId ? 'Stage linked' : 'No stage'} · ${item.workProductStates.length} maturities`}
                onSelectAsset={selectAsset}
                onRenameAsset={onRenameAsset}
                onDeleteAsset={requestDelete}
                onConfirmDelete={(kind, id) => {
                  onDeleteAsset(kind, id)
                  setPendingDelete(null)
                }}
                onCancelDelete={() => setPendingDelete(null)}
              />
            </>
          )}
          {tab === 'perspectives' && <Perspectives document={document} onSelectAsset={selectAsset} />}
        </div>

        <AssetDetail
          document={document}
          selection={activeSelection}
          onUpdateAsset={updateAsset}
          onLinkAsset={onLinkAsset}
          onUnlinkAsset={onUnlinkAsset}
          onSelectAsset={selectAsset}
          onSelectObjectTarget={onSelectObjectTarget}
        />
      </div>
    </TopDockPanel>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

function ProcessCompletenessSummary({ counts }: { counts: { what: number; who: number; when: number; how: number } }) {
  return (
    <div className="process-assets-completeness" aria-label="Process completeness">
      <span><strong>What</strong> {counts.what}</span>
      <span><strong>Who</strong> {counts.who}</span>
      <span><strong>When</strong> {counts.when}</span>
      <span><strong>How</strong> {counts.how}</span>
    </div>
  )
}

function AssetCreateForm({
  kind,
  onCreateAsset,
}: {
  kind: AssetKind
  onCreateAsset?: (kind: AssetKind, data: AssetCreateData) => void
}) {
  const [title, setTitle] = useState('')
  const [guidanceKind, setGuidanceKind] = useState<GuidanceKind>('checklist')
  const [expanded, setExpanded] = useState(false)
  if (!onCreateAsset) return null

  const config = getCreateFormCopy(kind)
  if (!expanded) {
    return (
      <button type="button" className="process-assets-create-toggle" onClick={() => setExpanded(true)}>
        {config.toggleLabel}
      </button>
    )
  }

  return (
    <form
      className="process-assets-create"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = title.trim()
        if (!trimmed) return
        onCreateAsset(kind, kind === 'guidance' ? { title: trimmed, kind: guidanceKind } : { title: trimmed })
        setTitle('')
        setExpanded(false)
      }}
    >
      <label htmlFor={`process-assets-create-${kind}`}>{config.inputLabel}</label>
      <input
        id={`process-assets-create-${kind}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={config.placeholder}
      />
      {kind === 'guidance' && (
        <>
          <label htmlFor="process-assets-create-guidance-kind">New guidance kind</label>
          <select
            id="process-assets-create-guidance-kind"
            value={guidanceKind}
            onChange={(event) => setGuidanceKind(event.target.value as GuidanceKind)}
          >
            <option value="checklist">Checklist</option>
            <option value="template">Template</option>
            <option value="practice">Practice</option>
            <option value="tool">Tool</option>
            <option value="training">Training</option>
            <option value="link">Link</option>
            <option value="other">Other</option>
          </select>
        </>
      )}
      <button type="submit">{config.buttonLabel}</button>
      <button type="button" className="process-assets-create-cancel" onClick={() => setExpanded(false)}>Cancel</button>
    </form>
  )
}

function AssetList<T extends WorkProductAsset | GuidanceAsset | MilestoneAsset>({
  document,
  empty,
  items,
  kind,
  pendingDelete,
  getMeta,
  onSelectAsset,
  onRenameAsset,
  onDeleteAsset,
  onConfirmDelete,
  onCancelDelete,
}: {
  document: GraphDocument
  empty: string
  items: T[]
  kind: AssetKind
  pendingDelete: AssetSelection | null
  getMeta: (item: T) => string
  onSelectAsset: (kind: AssetKind, id: string) => void
  onRenameAsset: (kind: AssetKind, id: string, title: string) => void
  onDeleteAsset: (kind: AssetKind, id: string) => void
  onConfirmDelete: (kind: AssetKind, id: string) => void
  onCancelDelete: () => void
}) {
  if (items.length === 0) {
    return <p className="process-assets-empty">{empty}</p>
  }

  return (
    <ul className="process-assets-list">
      {items.map((item) => {
        const confirmOpen = pendingDelete?.kind === kind && pendingDelete.id === item.id
        const usage = confirmOpen ? getProcessAssetUsage(document, kind, item.id) : null
        return (
          <li key={item.id} className="process-assets-item">
            <button
              type="button"
              className="process-assets-select"
              aria-label={`Select ${item.title}`}
              onClick={() => onSelectAsset(kind, item.id)}
            >
              <span className="process-assets-item-title">{item.title}</span>
              <span className="process-assets-item-meta">{getMeta(item)}</span>
            </button>
            <input
              aria-label={`Rename ${item.title}`}
              defaultValue={item.title}
              onBlur={(event) => onRenameAsset(kind, item.id, event.currentTarget.value)}
            />
            <button
              type="button"
              className="process-assets-delete"
              aria-label={`Delete ${item.title}`}
              onClick={() => onDeleteAsset(kind, item.id)}
            >
              Delete
            </button>
            {confirmOpen && usage && (
              <div className="process-assets-delete-confirm">
                <p>{usage.total} references will be cleared.</p>
                <button type="button" aria-label={`Confirm delete ${item.title}`} onClick={() => onConfirmDelete(kind, item.id)}>
                  Confirm delete
                </button>
                <button type="button" onClick={onCancelDelete}>Cancel</button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function AssetDetail({
  document,
  selection,
  onUpdateAsset,
  onLinkAsset,
  onUnlinkAsset,
  onSelectAsset,
  onSelectObjectTarget,
}: {
  document: GraphDocument
  selection: AssetSelection | null
  onUpdateAsset: (kind: AssetKind, id: string, patch: AssetPatch) => void
  onLinkAsset?: (kind: AssetKind, id: string, relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
  onUnlinkAsset?: (kind: AssetKind, id: string, relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
  onSelectAsset: (kind: AssetKind, id: string) => void
  onSelectObjectTarget?: (type: 'node' | 'edge', id: string) => void
}) {
  if (!selection) {
    return <p className="process-assets-detail-empty">Select an asset to edit details and relationships.</p>
  }

  if (selection.kind === 'workProduct') {
    const asset = document.processAssets.workProducts[selection.id]
    if (!asset) return <p className="process-assets-detail-empty">Work product no longer exists.</p>
    return (
      <WorkProductDetail
        document={document}
        asset={asset}
        onUpdate={(patch) => onUpdateAsset('workProduct', asset.id, patch)}
        onLink={(relation, targetId, options) => onLinkAsset?.('workProduct', asset.id, relation, targetId, options)}
        onUnlink={(relation, targetId, options) => onUnlinkAsset?.('workProduct', asset.id, relation, targetId, options)}
        onSelectAsset={onSelectAsset}
        onSelectObjectTarget={onSelectObjectTarget}
      />
    )
  }

  if (selection.kind === 'guidance') {
    const asset = document.processAssets.guidanceItems[selection.id]
    if (!asset) return <p className="process-assets-detail-empty">Guidance no longer exists.</p>
    return (
      <GuidanceDetail
        document={document}
        asset={asset}
        onUpdate={(patch) => onUpdateAsset('guidance', asset.id, patch)}
        onLink={(relation, targetId) => onLinkAsset?.('guidance', asset.id, relation, targetId)}
        onUnlink={(relation, targetId) => onUnlinkAsset?.('guidance', asset.id, relation, targetId)}
        onSelectObjectTarget={onSelectObjectTarget}
      />
    )
  }

  const asset = document.processAssets.milestones[selection.id]
  if (!asset) return <p className="process-assets-detail-empty">Milestone no longer exists.</p>
  return (
    <MilestoneDetail
      document={document}
      asset={asset}
      onUpdate={(patch) => onUpdateAsset('milestone', asset.id, patch)}
      onUnlink={(relation, targetId) => onUnlinkAsset?.('milestone', asset.id, relation, targetId)}
      onSelectObjectTarget={onSelectObjectTarget}
    />
  )
}

function WorkProductDetail({
  document,
  asset,
  onUpdate,
  onLink,
  onUnlink,
  onSelectAsset,
  onSelectObjectTarget,
}: {
  document: GraphDocument
  asset: WorkProductAsset
  onUpdate: (patch: Partial<WorkProductAsset>) => void
  onLink: (relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
  onUnlink: (relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
  onSelectAsset: (kind: AssetKind, id: string) => void
  onSelectObjectTarget?: (type: 'node' | 'edge', id: string) => void
}) {
  const activities = activityOptions(document)
  const handoffs = edgeOptions(document)
  const guidance = Object.values(document.processAssets.guidanceItems)
  const activityLinks = getWorkProductActivityLinks(asset)
  return (
    <section className="process-assets-detail" aria-label="Work product details">
      <h4>Work product details</h4>
      <FieldInput label="Work product title" value={asset.title} onCommit={(value) => onUpdate({ title: value })} />
      <FieldInput label="Default maturity" value={asset.state} onCommit={(value) => onUpdate({ state: value })} />
      <FieldTextarea label="Work product description" value={asset.description} onCommit={(value) => onUpdate({ description: value })} />

      <ActivityLinkRelationList
        title="Producers"
        relation="producer"
        links={activityLinks.filter((link) => link.relation === 'output')}
        labelFor={(link) => `${nodeTitle(document, link.nodeId)} · ${link.maturity}`}
        onGo={(link) => onSelectObjectTarget?.('node', link.nodeId)}
        onUnlink={onUnlink}
      />
      <ActivityLinkSelector
        asset={asset}
        relation="producer"
        label="Add producer"
        maturityLabel="Add producer maturity"
        buttonLabel="Link producer"
        options={activities}
        onLink={(id, maturity) => onLink('producer', id, { maturity })}
      />

      <ActivityLinkRelationList
        title="Consumers"
        relation="consumer"
        links={activityLinks.filter((link) => link.relation === 'input')}
        labelFor={(link) => `${nodeTitle(document, link.nodeId)} · ${link.maturity}`}
        onGo={(link) => onSelectObjectTarget?.('node', link.nodeId)}
        onUnlink={onUnlink}
      />
      <ActivityLinkSelector
        asset={asset}
        relation="consumer"
        label="Add consumer"
        maturityLabel="Add consumer maturity"
        buttonLabel="Link consumer"
        options={activities}
        onLink={(id, maturity) => onLink('consumer', id, { maturity })}
      />

      <RelationList
        title="Handoffs"
        relation="handoff"
        ids={asset.handoffEdgeIds}
        labelFor={(id) => edgeTitle(document, id)}
        onGo={(id) => onSelectObjectTarget?.('edge', id)}
        onUnlink={onUnlink}
      />
      <RelationSelector label="Add handoff" buttonLabel="Link handoff" options={handoffs} onLink={(id) => onLink('handoff', id)} />

      <RelationList
        title="Guidance"
        relation="guidance"
        ids={asset.guidanceIds}
        labelFor={(id) => document.processAssets.guidanceItems[id]?.title ?? id}
        onGo={(id) => onSelectAsset('guidance', id)}
        onUnlink={onUnlink}
      />
      <RelationSelector label="Add guidance" buttonLabel="Link guidance" options={guidance.map((item) => ({ id: item.id, label: item.title }))} onLink={(id) => onLink('guidance', id)} />
    </section>
  )
}

function GuidanceDetail({
  document,
  asset,
  onUpdate,
  onLink,
  onUnlink,
  onSelectObjectTarget,
}: {
  document: GraphDocument
  asset: GuidanceAsset
  onUpdate: (patch: Partial<GuidanceAsset>) => void
  onLink: (relation: AssetRelation, targetId: string) => void
  onUnlink: (relation: AssetRelation, targetId: string) => void
  onSelectObjectTarget?: (type: 'node' | 'edge', id: string) => void
}) {
  return (
    <section className="process-assets-detail" aria-label="Guidance details">
      <h4>Guidance details</h4>
      <FieldInput label="Guidance title" value={asset.title} onCommit={(value) => onUpdate({ title: value })} />
      <label htmlFor="process-asset-guidance-kind">Guidance kind</label>
      <select
        id="process-asset-guidance-kind"
        value={asset.kind}
        onChange={(event) => onUpdate({ kind: event.target.value as GuidanceKind })}
      >
        <option value="checklist">Checklist</option>
        <option value="template">Template</option>
        <option value="practice">Practice</option>
        <option value="tool">Tool</option>
        <option value="training">Training</option>
        <option value="link">Link</option>
        <option value="other">Other</option>
      </select>
      <FieldTextarea label="Guidance description" value={asset.description} onCommit={(value) => onUpdate({ description: value })} />
      <FieldInput label="Guidance URL" value={asset.url} onCommit={(value) => onUpdate({ url: value })} />

      <RelationList
        title="Applies to nodes"
        relation="node"
        ids={asset.appliesToNodeIds}
        labelFor={(id) => nodeTitle(document, id)}
        onGo={(id) => onSelectObjectTarget?.('node', id)}
        onUnlink={onUnlink}
      />
      <RelationSelector label="Add node" buttonLabel="Link node" options={nodeOptions(document)} onLink={(id) => onLink('node', id)} />

      <RelationList
        title="Applies to handoffs"
        relation="edge"
        ids={asset.appliesToEdgeIds}
        labelFor={(id) => edgeTitle(document, id)}
        onGo={(id) => onSelectObjectTarget?.('edge', id)}
        onUnlink={onUnlink}
      />
      <RelationSelector label="Add handoff" buttonLabel="Link handoff" options={edgeOptions(document)} onLink={(id) => onLink('edge', id)} />

      <RelationList
        title="Work products"
        relation="workProduct"
        ids={asset.workProductIds}
        labelFor={(id) => document.processAssets.workProducts[id]?.title ?? id}
        onUnlink={onUnlink}
      />
      <RelationSelector
        label="Add work product"
        buttonLabel="Link work product"
        options={Object.values(document.processAssets.workProducts).map((item) => ({ id: item.id, label: item.title }))}
        onLink={(id) => onLink('workProduct', id)}
      />
    </section>
  )
}

function MilestoneDetail({
  document,
  asset,
  onUpdate,
  onUnlink,
  onSelectObjectTarget,
}: {
  document: GraphDocument
  asset: MilestoneAsset
  onUpdate: (patch: Partial<MilestoneAsset>) => void
  onUnlink: (relation: AssetRelation, targetId: string) => void
  onSelectObjectTarget?: (type: 'node' | 'edge', id: string) => void
}) {
  const [newStateWorkProductId, setNewStateWorkProductId] = useState('')
  const [newState, setNewState] = useState('')
  const workProducts = Object.values(document.processAssets.workProducts)
  const upsertState = (workProductId: string, state: string) => {
    const withoutCurrent = asset.workProductStates.filter((item) => item.workProductId !== workProductId)
    onUpdate({ workProductStates: [...withoutCurrent, { workProductId, state }] })
  }

  return (
    <section className="process-assets-detail" aria-label="Milestone details">
      <h4>Milestone details</h4>
      <FieldInput label="Milestone title" value={asset.title} onCommit={(value) => onUpdate({ title: value })} />
      <FieldTextarea label="Milestone description" value={asset.description} onCommit={(value) => onUpdate({ description: value })} />
      <label htmlFor="process-asset-milestone-stage">Milestone stage</label>
      <select
        id="process-asset-milestone-stage"
        value={asset.stageNodeId ?? ''}
        onChange={(event) => onUpdate({ stageNodeId: event.target.value || null })}
      >
        <option value="">No stage</option>
        {stageOptions(document).map((stage) => (
          <option key={stage.id} value={stage.id}>{stage.label}</option>
        ))}
      </select>
      {asset.stageNodeId && (
        <button type="button" className="process-assets-inline-link" onClick={() => onSelectObjectTarget?.('node', asset.stageNodeId!)}>
          Go to stage {nodeTitle(document, asset.stageNodeId)}
        </button>
      )}

      <h5>Work product maturities</h5>
      {asset.workProductStates.length === 0 ? (
        <p className="process-assets-empty">No work product maturities yet.</p>
      ) : (
        <ul className="process-assets-relation-list">
          {asset.workProductStates.map((state) => {
            const title = document.processAssets.workProducts[state.workProductId]?.title ?? state.workProductId
            return (
              <li key={state.workProductId}>
                <span>{title}</span>
                <input
                  aria-label={`Maturity at milestone for ${title}`}
                  defaultValue={state.state}
                  onBlur={(event) => upsertState(state.workProductId, event.currentTarget.value)}
                />
                <button type="button" aria-label={`Remove maturity ${title}`} onClick={() => onUnlink('workProductState', state.workProductId)}>
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {workProducts.length > 0 && (
        <div className="process-assets-inline-create">
          <select aria-label="Add work product maturity" value={newStateWorkProductId} onChange={(event) => setNewStateWorkProductId(event.target.value)}>
            <option value="">Work product</option>
            {workProducts.map((workProduct) => (
              <option key={workProduct.id} value={workProduct.id}>{workProduct.title}</option>
            ))}
          </select>
          <input aria-label="New maturity at milestone" value={newState} onChange={(event) => setNewState(event.target.value)} placeholder="Maturity" />
          <button
            type="button"
            onClick={() => {
              if (!newStateWorkProductId || !newState.trim()) return
              upsertState(newStateWorkProductId, newState.trim())
              setNewState('')
            }}
          >
            Add work product maturity
          </button>
        </div>
      )}
    </section>
  )
}

function FieldInput({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const id = fieldId(label)
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} defaultValue={value} onBlur={(event) => onCommit(event.currentTarget.value)} />
    </>
  )
}

function FieldTextarea({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const id = fieldId(label)
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} defaultValue={value} rows={3} onBlur={(event) => onCommit(event.currentTarget.value)} />
    </>
  )
}

function RelationList({
  title,
  relation,
  ids,
  labelFor,
  onGo,
  onUnlink,
}: {
  title: string
  relation: AssetRelation
  ids: string[]
  labelFor: (id: string) => string
  onGo?: (id: string) => void
  onUnlink: (relation: AssetRelation, targetId: string) => void
}) {
  return (
    <section className="process-assets-relation-block">
      <h5>{title}</h5>
      {ids.length === 0 ? (
        <p className="process-assets-empty">None linked.</p>
      ) : (
        <ul className="process-assets-relation-list">
          {ids.map((id) => {
            const label = labelFor(id)
            const relationLabel = formatRelationLabel(relation)
            return (
              <li key={id}>
                <span>{label}</span>
                {onGo && (
                  <button type="button" aria-label={`Go to ${relationLabel} ${label}`} onClick={() => onGo(id)}>
                    Go
                  </button>
                )}
                <button type="button" aria-label={`Unlink ${relationLabel} ${label}`} onClick={() => onUnlink(relation, id)}>
                  Unlink
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ActivityLinkRelationList({
  title,
  relation,
  links,
  labelFor,
  onGo,
  onUnlink,
}: {
  title: string
  relation: 'producer' | 'consumer'
  links: WorkProductActivityLink[]
  labelFor: (link: WorkProductActivityLink) => string
  onGo?: (link: WorkProductActivityLink) => void
  onUnlink: (relation: AssetRelation, targetId: string, options?: AssetRelationOptions) => void
}) {
  return (
    <section className="process-assets-relation-block">
      <h5>{title}</h5>
      {links.length === 0 ? (
        <p className="process-assets-empty">None linked.</p>
      ) : (
        <ul className="process-assets-relation-list">
          {links.map((link) => {
            const label = labelFor(link)
            return (
              <li key={link.id}>
                <span>{label}</span>
                {onGo && (
                  <button type="button" aria-label={`Go to ${relation} ${label}`} onClick={() => onGo(link)}>
                    Go
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Unlink ${relation} ${label}`}
                  onClick={() => onUnlink(relation, link.nodeId, { maturity: link.maturity })}
                >
                  Unlink
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RelationSelector({
  label,
  buttonLabel,
  options,
  onLink,
}: {
  label: string
  buttonLabel: string
  options: { id: string; label: string }[]
  onLink: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  if (options.length === 0) return null
  return (
    <div className="process-assets-inline-create">
      <label htmlFor={fieldId(label)}>{label}</label>
      <select id={fieldId(label)} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <button type="button" onClick={() => selectedId && onLink(selectedId)}>
        {buttonLabel}
      </button>
    </div>
  )
}

function ActivityLinkSelector({
  asset,
  relation,
  label,
  maturityLabel,
  buttonLabel,
  options,
  onLink,
}: {
  asset: WorkProductAsset
  relation: 'producer' | 'consumer'
  label: string
  maturityLabel: string
  buttonLabel: string
  options: { id: string; label: string }[]
  onLink: (id: string, maturity: string) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [maturity, setMaturity] = useState(asset.state || 'Draft')
  if (options.length === 0) return null

  const normalizedMaturity = maturity.trim()
  const activityRelation: WorkProductActivityRelation = relation === 'producer' ? 'output' : 'input'
  const hasConflict = Boolean(selectedId && normalizedMaturity) &&
    hasWorkProductActivityMaturityConflict(asset, selectedId, activityRelation, normalizedMaturity)

  return (
    <div className="process-assets-inline-create">
      <label htmlFor={fieldId(label)}>{label}</label>
      <select id={fieldId(label)} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <MaturityInput label={maturityLabel} value={maturity} onChange={setMaturity} />
      {hasConflict && (
        <p className="process-assets-warning">
          Same maturity cannot be both input and output for this activity. Choose another maturity or unlink first.
        </p>
      )}
      <button
        type="button"
        disabled={!selectedId || !normalizedMaturity || hasConflict}
        onClick={() => selectedId && normalizedMaturity && onLink(selectedId, normalizedMaturity)}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function MaturityInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = fieldId(label)
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        list={`${id}-options`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={`${id}-options`}>
        {WORK_PRODUCT_MATURITY_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}

function Perspectives({ document, onSelectAsset }: { document: GraphDocument; onSelectAsset: (kind: AssetKind, id: string) => void }) {
  const perspectives = deriveProcessPerspectives(document)

  return (
    <div className="process-perspectives">
      <PerspectiveSection title="What">
        {perspectives.what.workProducts.length === 0 ? (
          <p>No work product flow yet.</p>
        ) : (
          perspectives.what.workProducts.map((item) => (
            <p key={item.id}>
              <button type="button" onClick={() => onSelectAsset('workProduct', item.id)}>Open {item.title}</button>
              : {formatPerspectiveList('from', item.producedBy)}; {formatPerspectiveList('to', item.consumedBy)}
              {item.maturityFlows.length > 0 ? `; ${item.maturityFlows.join(', ')}` : ''}
            </p>
          ))
        )}
      </PerspectiveSection>
      <PerspectiveSection title="Who">
        {perspectives.who.roles.length === 0 ? (
          <p>No RASIC roles yet.</p>
        ) : (
          perspectives.who.roles.map((role) => (
            <p key={role.roleName}>
              <strong>{role.roleName}</strong>: {role.activities.map((activity) => `${activity.kind} ${activity.activityTitle}`).join(', ')}
            </p>
          ))
        )}
      </PerspectiveSection>
      <PerspectiveSection title="When">
        {perspectives.when.milestones.length === 0 ? (
          <p>No milestone timing yet.</p>
        ) : (
          perspectives.when.milestones.map((milestone) => {
            const asset = Object.values(document.processAssets.milestones).find((candidate) => candidate.title === milestone.title)
            return (
              <p key={milestone.title}>
                {asset ? <button type="button" onClick={() => onSelectAsset('milestone', asset.id)}>Open {milestone.title}</button> : <strong>{milestone.title}</strong>}
                : {milestone.stageTitle} · {milestone.workProductStates.join(', ') || 'no maturities'}
              </p>
            )
          })
        )}
      </PerspectiveSection>
      <PerspectiveSection title="How">
        {perspectives.how.guidance.length === 0 ? (
          <p>No guidance linked yet.</p>
        ) : (
          perspectives.how.guidance.map((guidance) => (
            <p key={guidance.id}>
              <button type="button" onClick={() => onSelectAsset('guidance', guidance.id)}>Open {guidance.title}</button>
              : {formatGuidanceKind(guidance.kind)} · {guidance.appliesTo.join(', ') || 'unlinked'}
            </p>
          ))
        )}
      </PerspectiveSection>
    </div>
  )
}

function PerspectiveSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="process-perspective-section">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function getProcessCompleteness(document: GraphDocument): { what: number; who: number; when: number; how: number } {
  return {
    what: Object.keys(document.processAssets.workProducts).length,
    who: Array.from(document.nodes.values()).filter((node) => (
      node.type === 'activity' &&
      getActivityResponsibilities(node).some((responsibility) => (
        responsibility.kind === 'responsible' || responsibility.kind === 'accountable'
      ))
    )).length,
    when: Object.keys(document.processAssets.milestones).length,
    how: Object.keys(document.processAssets.guidanceItems).length,
  }
}

function getCreateFormCopy(kind: AssetKind): { inputLabel: string; buttonLabel: string; placeholder: string; toggleLabel: string } {
  if (kind === 'workProduct') {
    return {
      inputLabel: 'New work product',
      buttonLabel: 'Create work product',
      placeholder: 'e.g. Research brief',
      toggleLabel: 'New work product',
    }
  }
  if (kind === 'guidance') {
    return {
      inputLabel: 'New guidance',
      buttonLabel: 'Create guidance',
      placeholder: 'e.g. Interview checklist',
      toggleLabel: 'New guidance',
    }
  }
  return {
    inputLabel: 'New milestone',
    buttonLabel: 'Create milestone',
    placeholder: 'e.g. Discovery exit',
    toggleLabel: 'New milestone',
  }
}

function formatWorkProductMeta(item: WorkProductAsset): string {
  const totalLinks = getWorkProductActivityLinks(item).length + item.handoffEdgeIds.length
  return `${item.state || 'No default maturity'} · ${totalLinks} links`
}

function countGuidanceLinks(item: GuidanceAsset): number {
  return item.appliesToNodeIds.length + item.appliesToEdgeIds.length + item.workProductIds.length
}

function formatGuidanceKind(kind: string): string {
  return kind.slice(0, 1).toUpperCase() + kind.slice(1)
}

function formatPerspectiveList(prefix: string, values: string[]): string {
  return `${prefix} ${values.length > 0 ? values.join(', ') : 'unassigned'}`
}

function nodeOptions(document: GraphDocument): { id: string; label: string }[] {
  return Array.from(document.nodes.values()).map((node) => ({ id: node.id, label: node.title }))
}

function activityOptions(document: GraphDocument): { id: string; label: string }[] {
  return Array.from(document.nodes.values())
    .filter((node) => node.type === 'activity')
    .map((node) => ({ id: node.id, label: node.title }))
}

function stageOptions(document: GraphDocument): { id: string; label: string }[] {
  return Array.from(document.nodes.values())
    .filter((node) => node.type === 'stage')
    .map((node) => ({ id: node.id, label: node.title }))
}

function edgeOptions(document: GraphDocument): { id: string; label: string }[] {
  return Array.from(document.edges.values()).map((edge) => ({ id: edge.id, label: edgeTitle(document, edge.id) }))
}

function nodeTitle(document: GraphDocument, nodeId: string): string {
  return document.nodes.get(nodeId)?.title ?? nodeId
}

function edgeTitle(document: GraphDocument, edgeId: string): string {
  const edge = document.edges.get(edgeId)
  if (!edge) return edgeId
  return `${nodeTitle(document, edge.sourceNodeId)} -> ${nodeTitle(document, edge.targetNodeId)}`
}

function fieldId(label: string): string {
  return `process-asset-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function formatRelationLabel(relation: AssetRelation): string {
  if (relation === 'workProduct') return 'work product'
  if (relation === 'workProductState') return 'work product maturity'
  return relation
}
