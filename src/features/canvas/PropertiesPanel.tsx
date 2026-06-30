import { type CSSProperties, type FormEvent, useRef, useState } from 'react'
import type {
  ActivityResponsibility,
  GuidanceKind,
  ProcessAssets,
  ProcessEdge,
  ProcessNode,
  ResponsibilityKind,
} from './canvasTypes'
import { EDGE_COLOR_SWATCHES, normalizeEdgeColor } from './edgeColors'
import { REVIEW_STATUS_OPTIONS, isReviewStatusValue } from './reviewStatus'
import { useDraft } from './useDraft'
import {
  WORK_PRODUCT_MATURITY_OPTIONS,
  getWorkProductActivityLinks,
  hasWorkProductActivityMaturityConflict,
} from './processAssets'

function makeFieldId(prefix: string, label: string): string {
  // Stable per label so a double-click into the same node keeps the
  // same id and the test can find it. Spaces and colons are normalized.
  return `prop-${prefix}-${label.toLowerCase().replaceAll(' ', '-').replaceAll(':', '')}`
}

interface PropertiesPanelProps {
  node: ProcessNode | null
  edge: ProcessEdge | null
  nodes?: ProcessNode[]
  processAssets?: ProcessAssets
  assetActions?: PropertiesPanelAssetActions
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onUpdateEdge: (edgeId: string, data: Record<string, unknown>) => void
  onDeleteEdge?: () => void
  onClose: () => void
}

export interface PropertiesPanelAssetActions {
  addResponsibility?: (nodeId: string, responsibility: { roleName: string; kind: ResponsibilityKind }) => void
  removeResponsibility?: (nodeId: string, responsibilityId: string) => void
  createWorkProductForActivity?: (nodeId: string, relation: 'input' | 'output', title: string, maturity?: string) => void
  linkWorkProductToActivity?: (nodeId: string, relation: 'input' | 'output', workProductId: string, maturity?: string) => void
  unlinkWorkProductFromActivity?: (nodeId: string, relation: 'input' | 'output', workProductId: string, maturity?: string) => void
  createGuidanceForActivity?: (nodeId: string, data: { title: string; kind: GuidanceKind }) => void
  linkGuidanceToActivity?: (nodeId: string, guidanceId: string) => void
  unlinkGuidanceFromActivity?: (nodeId: string, guidanceId: string) => void
  linkGuidanceToWorkProduct?: (guidanceId: string, workProductId: string) => void
  createMilestoneForStage?: (stageNodeId: string, title: string) => void
  addMilestoneWorkProductState?: (milestoneId: string, workProductId: string, state: string) => void
  removeMilestoneWorkProductState?: (milestoneId: string, workProductId: string) => void
  createWorkProductForHandoff?: (edgeId: string, title: string) => void
  linkWorkProductToHandoff?: (edgeId: string, workProductId: string) => void
  unlinkWorkProductFromHandoff?: (workProductId: string, edgeId: string) => void
}

const EMPTY_PROCESS_ASSETS: ProcessAssets = {
  workProducts: {},
  guidanceItems: {},
  milestones: {},
}

export function PropertiesPanel({
  node,
  edge,
  nodes = [],
  processAssets = EMPTY_PROCESS_ASSETS,
  assetActions = {},
  onUpdateNode,
  onUpdateEdge,
  onDeleteEdge,
  onClose,
}: PropertiesPanelProps) {
  if (!node && !edge) return null

  return (
    <div className="properties-panel" role="complementary" aria-label="Properties">
      <div className="properties-header">
        <h3>{node ? getNodeLabel(node) : 'Connection'}</h3>
        <button type="button" className="properties-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {node && <NodeEditor node={node} processAssets={processAssets} assetActions={assetActions} onUpdate={onUpdateNode} />}
      {edge && !node && (
        <HandoffEditor
          edge={edge}
          nodes={nodes}
          processAssets={processAssets}
          assetActions={assetActions}
          onUpdate={onUpdateEdge}
          onDelete={onDeleteEdge}
        />
      )}
    </div>
  )
}

function getNodeLabel(node: ProcessNode): string {
  if (node.data.kind === 'activity') return 'Activity'
  if (node.data.kind === 'decision') return 'Decision'
  if (node.data.kind === 'stage') return 'Stage'
  if (node.data.kind === 'bottleneck') return 'Bottleneck'
  return node.data.kind === 'start' ? 'Start' : 'End'
}

function getNodeTitle(node: ProcessNode): string {
  switch (node.data.kind) {
    case 'start':
    case 'end':
      return node.data.label || node.id
    case 'activity':
    case 'decision':
    case 'stage':
    case 'bottleneck':
      return node.data.title || node.id
  }
}

function getNodeOptionLabel(node: ProcessNode): string {
  return `${getNodeLabel(node)} - ${getNodeTitle(node)}`
}

function getDefaultEndpointPort(node: ProcessNode, role: 'source' | 'target'): 'out' | 'in' | null {
  if (role === 'source') {
    return node.data.kind === 'end' ? null : 'out'
  }

  return node.data.kind === 'start' ? null : 'in'
}

function edgeSwatchStyle(color: string): CSSProperties {
  return { '--edge-color': color } as CSSProperties
}

interface NodeEditorProps {
  node: ProcessNode
  processAssets: ProcessAssets
  assetActions: PropertiesPanelAssetActions
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function NodeEditor({ node, processAssets, assetActions, onUpdate }: NodeEditorProps) {
  const data = node.data

  if (data.kind === 'start' || data.kind === 'end') {
    return <p className="properties-hint">This is a {data.kind} marker.</p>
  }

  if (data.kind === 'activity') {
    return (
      <ActivityEditor
        nodeId={node.id}
        title={data.title}
        summary={data.summary}
        roleIds={data.roleIds}
        responsibilities={data.responsibilities ?? []}
        expectations={data.expectations ?? ''}
        processAssets={processAssets}
        assetActions={assetActions}
        onUpdate={onUpdate}
      />
    )
  }

  if (data.kind === 'decision') {
    return <DecisionEditor nodeId={node.id} title={data.title} criteria={data.criteria} owner={data.owner ?? ''} decisionOutcomes={data.decisionOutcomes ?? []} onUpdate={onUpdate} />
  }

  if (data.kind === 'stage') {
    return <StageEditor nodeId={node.id} data={data} processAssets={processAssets} assetActions={assetActions} onUpdate={onUpdate} />
  }

  if (data.kind === 'bottleneck') {
    return <BottleneckEditor nodeId={node.id} data={data} onUpdate={onUpdate} />
  }

  return null
}

interface ActivityEditorProps {
  nodeId: string
  title: string
  summary: string
  roleIds: string[]
  responsibilities: ActivityResponsibility[]
  expectations: string
  processAssets: ProcessAssets
  assetActions: PropertiesPanelAssetActions
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function ActivityEditor({
  nodeId,
  title,
  summary,
  roleIds,
  responsibilities,
  expectations,
  processAssets,
  assetActions,
  onUpdate,
}: ActivityEditorProps) {
  const [titleDraft, setTitleDraft] = useDraft(title)
  const [summaryDraft, setSummaryDraft] = useDraft(summary)
  const [expectationsDraft, setExpectationsDraft] = useDraft(expectations)
  // Local draft for the role-tag input. The committed list lives in
  // the document; the input just adds new tags on Enter.
  const [roleDraft, setRoleDraft] = useDraft('')

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    onUpdate(nodeId, { title: titleDraft, summary: summaryDraft, expectations: expectationsDraft })
  }

  function commitRole(rawValue: string): void {
    const trimmed = rawValue.trim()
    if (!trimmed) return
    if (roleIds.includes(trimmed)) {
      setRoleDraft('')
      return
    }
    onUpdate(nodeId, { roleIds: [...roleIds, trimmed] })
    setRoleDraft('')
  }

  function handleRoleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    commitRole(event.currentTarget.value)
  }

  function handleRoleRemove(role: string): void {
    onUpdate(nodeId, { roleIds: roleIds.filter((r) => r !== role) })
  }

  return (
    <form onSubmit={handleSubmit} className="properties-form">
      <label htmlFor={makeFieldId('activity', 'Title')}>Title</label>
      <input
        id={makeFieldId('activity', 'Title')}
        autoFocus
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={(event) => onUpdate(nodeId, { title: event.currentTarget.value })}
      />
      <label htmlFor={makeFieldId('activity', 'Summary')}>Summary</label>
      <textarea
        id={makeFieldId('activity', 'Summary')}
        value={summaryDraft}
        onChange={(e) => setSummaryDraft(e.target.value)}
        onBlur={(event) => onUpdate(nodeId, { summary: event.currentTarget.value })}
        rows={3}
      />
      <label htmlFor={makeFieldId('activity', 'Expectations')}>Expectations</label>
      <textarea
        id={makeFieldId('activity', 'Expectations')}
        value={expectationsDraft}
        onChange={(e) => setExpectationsDraft(e.target.value)}
        onBlur={(event) => onUpdate(nodeId, { expectations: event.currentTarget.value })}
        rows={3}
      />
      <label htmlFor={makeFieldId('activity', 'Add role')}>Add role</label>
      <input
        id={makeFieldId('activity', 'Add role')}
        className="properties-role-input"
        value={roleDraft}
        onChange={(e) => setRoleDraft(e.target.value)}
        onKeyDown={handleRoleKeyDown}
        onBlur={(event) => {
          // Commit any pending text on blur (treat as a soft commit).
          commitRole(event.currentTarget.value)
        }}
        placeholder="Type a role and press Enter"
      />
      {roleIds.length > 0 && (
        <ul className="role-tag-chips" aria-label="Role tags">
          {roleIds.map((role) => (
            <li key={role} className="role-tag-chip">
              <span>{role}</span>
              <button
                type="button"
                className="role-tag-chip-remove"
                onClick={() => handleRoleRemove(role)}
                aria-label={`Remove role ${role}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <RasicEditor
        nodeId={nodeId}
        responsibilities={responsibilities}
        onAdd={assetActions.addResponsibility}
        onRemove={assetActions.removeResponsibility}
      />
      <ActivityWorkProductsEditor
        nodeId={nodeId}
        relation="input"
        processAssets={processAssets}
        onCreate={assetActions.createWorkProductForActivity}
        onLink={assetActions.linkWorkProductToActivity}
        onUnlink={assetActions.unlinkWorkProductFromActivity}
      />
      <ActivityWorkProductsEditor
        nodeId={nodeId}
        relation="output"
        processAssets={processAssets}
        onCreate={assetActions.createWorkProductForActivity}
        onLink={assetActions.linkWorkProductToActivity}
        onUnlink={assetActions.unlinkWorkProductFromActivity}
      />
      <ActivityGuidanceEditor
        nodeId={nodeId}
        processAssets={processAssets}
        onCreate={assetActions.createGuidanceForActivity}
        onLink={assetActions.linkGuidanceToActivity}
        onUnlink={assetActions.unlinkGuidanceFromActivity}
        onLinkWorkProduct={assetActions.linkGuidanceToWorkProduct}
      />
    </form>
  )
}

interface DecisionEditorProps {
  nodeId: string
  title: string
  criteria: string
  owner: string
  decisionOutcomes: string[]
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function DecisionEditor({ nodeId, title, criteria, owner, decisionOutcomes, onUpdate }: DecisionEditorProps) {
  const [titleDraft, setTitleDraft] = useDraft(title)
  const [criteriaDraft, setCriteriaDraft] = useDraft(criteria)
  const [ownerDraft, setOwnerDraft] = useDraft(owner)
  const [outcomesDraft, setOutcomesDraft] = useDraft(decisionOutcomes.join('\n'))

  function commitOutcomes(): void {
    const next = outcomesDraft
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
    onUpdate(nodeId, { decisionOutcomes: next })
  }

  return (
    <form className="properties-form">
      <label htmlFor={makeFieldId('decision', 'Question')}>Question</label>
      <input
        id={makeFieldId('decision', 'Question')}
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { title: titleDraft })}
      />
      <label htmlFor={makeFieldId('decision', 'Criteria')}>Criteria</label>
      <textarea
        id={makeFieldId('decision', 'Criteria')}
        value={criteriaDraft}
        onChange={(e) => setCriteriaDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { criteria: criteriaDraft })}
        rows={3}
      />
      <label htmlFor={makeFieldId('decision', 'Decision owner')}>Decision owner</label>
      <input
        id={makeFieldId('decision', 'Decision owner')}
        value={ownerDraft}
        onChange={(e) => setOwnerDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { owner: ownerDraft })}
      />
      <label htmlFor={makeFieldId('decision', 'Possible outcomes')}>Possible outcomes (one per line)</label>
      <textarea
        id={makeFieldId('decision', 'Possible outcomes')}
        value={outcomesDraft}
        onChange={(e) => setOutcomesDraft(e.target.value)}
        onBlur={commitOutcomes}
        rows={3}
      />
    </form>
  )
}

function HandoffEditor({
  edge,
  nodes,
  processAssets,
  assetActions,
  onUpdate,
  onDelete,
}: {
  edge: ProcessEdge
  nodes: ProcessNode[]
  processAssets: ProcessAssets
  assetActions: PropertiesPanelAssetActions
  onUpdate: (edgeId: string, data: Record<string, unknown>) => void
  onDelete?: () => void
}) {
  const data = edge.data ?? {}
  const sourceOptions = nodes.filter(
    (candidate) => candidate.id !== edge.target && getDefaultEndpointPort(candidate, 'source'),
  )
  const targetOptions = nodes.filter(
    (candidate) => candidate.id !== edge.source && getDefaultEndpointPort(candidate, 'target'),
  )

  function handleSourceChange(nodeId: string): void {
    if (nodeId === edge.target) return
    const sourceNode = nodes.find((candidate) => candidate.id === nodeId)
    if (!sourceNode) return
    const sourcePortId = getDefaultEndpointPort(sourceNode, 'source')
    if (!sourcePortId) return
    onUpdate(edge.id, { sourceNodeId: nodeId, sourcePortId })
  }

  function handleTargetChange(nodeId: string): void {
    if (nodeId === edge.source) return
    const targetNode = nodes.find((candidate) => candidate.id === nodeId)
    if (!targetNode) return
    const targetPortId = getDefaultEndpointPort(targetNode, 'target')
    if (!targetPortId) return
    onUpdate(edge.id, { targetNodeId: nodeId, targetPortId })
  }

  return (
    <form className="properties-form">
      {nodes.length > 0 && (
        <>
          <label htmlFor={makeFieldId('handoff', 'From node')}>From node</label>
          <select
            id={makeFieldId('handoff', 'From node')}
            value={edge.source}
            onChange={(event) => handleSourceChange(event.target.value)}
          >
            {sourceOptions.map((option) => (
              <option key={option.id} value={option.id}>{getNodeOptionLabel(option)}</option>
            ))}
          </select>
          <label htmlFor={makeFieldId('handoff', 'To node')}>To node</label>
          <select
            id={makeFieldId('handoff', 'To node')}
            value={edge.target}
            onChange={(event) => handleTargetChange(event.target.value)}
          >
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>{getNodeOptionLabel(option)}</option>
            ))}
          </select>
        </>
      )}
      <SemanticTextInput prefix="handoff" label="Label" value={data.label ?? ''} onCommit={(value) => onUpdate(edge.id, { label: value })} />
      <ConnectionColorPicker
        color={data.color}
        onPick={(color) => onUpdate(edge.id, { color })}
      />
      <SemanticTextInput prefix="handoff" label="From role" value={data.fromRole ?? ''} onCommit={(value) => onUpdate(edge.id, { fromRole: value })} />
      <SemanticTextInput prefix="handoff" label="To role" value={data.toRole ?? ''} onCommit={(value) => onUpdate(edge.id, { toRole: value })} />
      <HandoffWorkProductsEditor
        edgeId={edge.id}
        processAssets={processAssets}
        onCreate={assetActions.createWorkProductForHandoff}
        onLink={assetActions.linkWorkProductToHandoff}
        onUnlink={assetActions.unlinkWorkProductFromHandoff}
      />
      <SemanticTextInput prefix="handoff" label="Artifact" value={data.artifact ?? ''} onCommit={(value) => onUpdate(edge.id, { artifact: value })} />
      <SemanticTextArea prefix="handoff" label="Handoff expectation" value={data.expectation ?? ''} onCommit={(value) => onUpdate(edge.id, { expectation: value })} />
      <SemanticTextArea prefix="handoff" label="Readiness signal" value={data.readinessSignal ?? ''} onCommit={(value) => onUpdate(edge.id, { readinessSignal: value })} />
      <label htmlFor={makeFieldId('handoff', 'Review status')}>Review status</label>
      <select
        id={makeFieldId('handoff', 'Review status')}
        value={data.reviewStatus ?? 'unclear'}
        onChange={(event) => {
          const value = event.target.value
          if (!isReviewStatusValue(value)) return
          onUpdate(edge.id, { reviewStatus: value })
        }}
      >
        {REVIEW_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {onDelete && (
        <button
          type="button"
          className="properties-danger-action"
          onClick={onDelete}
        >
          Delete connector
        </button>
      )}
    </form>
  )
}

function ConnectionColorPicker({
  color,
  onPick,
}: {
  color?: string
  onPick: (color: string) => void
}) {
  const selectedColor = normalizeEdgeColor(color)

  return (
    <div className="properties-color-field">
      <span className="properties-color-label">Color</span>
      <div className="edge-color-swatches properties-edge-color-swatches" aria-label="Connection color">
        {EDGE_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            className="edge-color-swatch"
            aria-label={`Set connection color ${swatch.name}`}
            aria-pressed={selectedColor === swatch.value}
            title={swatch.name}
            style={edgeSwatchStyle(swatch.value)}
            onClick={() => onPick(swatch.value)}
          />
        ))}
      </div>
    </div>
  )
}

function StageEditor({
  nodeId,
  data,
  processAssets,
  assetActions,
  onUpdate,
}: {
  nodeId: string
  data: Extract<ProcessNode['data'], { kind: 'stage' }>
  processAssets: ProcessAssets
  assetActions: PropertiesPanelAssetActions
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}) {
  return (
    <form className="properties-form">
      <SemanticTextInput prefix="stage" label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea prefix="stage" label="Goal" value={data.goal} onCommit={(value) => onUpdate(nodeId, { goal: value })} />
      <SemanticTextArea prefix="stage" label="Entry condition" value={data.entryCondition} onCommit={(value) => onUpdate(nodeId, { entryCondition: value })} />
      <SemanticTextArea prefix="stage" label="Exit condition" value={data.exitCondition} onCommit={(value) => onUpdate(nodeId, { exitCondition: value })} />
      <SemanticTextInput prefix="stage" label="Owner" value={data.owner} onCommit={(value) => onUpdate(nodeId, { owner: value })} />
      <StageMilestonesEditor
        stageNodeId={nodeId}
        processAssets={processAssets}
        onCreate={assetActions.createMilestoneForStage}
        onAddWorkProductState={assetActions.addMilestoneWorkProductState}
        onRemoveWorkProductState={assetActions.removeMilestoneWorkProductState}
      />
    </form>
  )
}

function RasicEditor({
  nodeId,
  responsibilities,
  onAdd,
  onRemove,
}: {
  nodeId: string
  responsibilities: ActivityResponsibility[]
  onAdd?: (nodeId: string, responsibility: { roleName: string; kind: ResponsibilityKind }) => void
  onRemove?: (nodeId: string, responsibilityId: string) => void
}) {
  const roleRef = useRef<HTMLInputElement | null>(null)
  const [kind, setKind] = useState<ResponsibilityKind>('responsible')

  return (
    <section className="properties-section" aria-label="RASIC responsibilities">
      <h4>RASIC responsibilities</h4>
      {responsibilities.length > 0 && (
        <ul className="asset-chip-list">
          {responsibilities.map((responsibility) => (
            <li key={responsibility.id} className="asset-chip">
              <span>{formatResponsibilityKind(responsibility.kind)} · {responsibility.roleName}</span>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove responsibility ${responsibility.roleName}`}
                  onClick={() => onRemove(nodeId, responsibility.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={makeFieldId('activity', 'Responsibility kind')}>Responsibility kind</label>
      <select
        id={makeFieldId('activity', 'Responsibility kind')}
        value={kind}
        onChange={(event) => setKind(event.target.value as ResponsibilityKind)}
      >
        <option value="responsible">Responsible</option>
        <option value="accountable">Accountable</option>
        <option value="supporting">Supporting</option>
        <option value="consulted">Consulted</option>
        <option value="informed">Informed</option>
      </select>
      <label htmlFor={makeFieldId('activity', 'Responsibility role')}>Responsibility role</label>
      <div className="asset-inline-create">
        <input id={makeFieldId('activity', 'Responsibility role')} ref={roleRef} />
        <button
          type="button"
          onClick={() => {
            const roleName = roleRef.current?.value.trim() ?? ''
            if (!roleName) return
            onAdd?.(nodeId, { roleName, kind })
            if (roleRef.current) roleRef.current.value = ''
          }}
        >
          Add responsibility
        </button>
      </div>
    </section>
  )
}

function ActivityWorkProductsEditor({
  nodeId,
  relation,
  processAssets,
  onCreate,
  onLink,
  onUnlink,
}: {
  nodeId: string
  relation: 'input' | 'output'
  processAssets: ProcessAssets
  onCreate?: (nodeId: string, relation: 'input' | 'output', title: string, maturity?: string) => void
  onLink?: (nodeId: string, relation: 'input' | 'output', workProductId: string, maturity?: string) => void
  onUnlink?: (nodeId: string, relation: 'input' | 'output', workProductId: string, maturity?: string) => void
}) {
  const createRef = useRef<HTMLInputElement | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const defaultMaturity = relation === 'input' ? 'Needed' : 'Draft'
  const [createMaturity, setCreateMaturity] = useState(defaultMaturity)
  const [selectedMaturity, setSelectedMaturity] = useState(defaultMaturity)
  const assets = Object.values(processAssets.workProducts)
  const linked = assets.flatMap((asset) =>
    getWorkProductActivityLinks(asset)
      .filter((link) => link.nodeId === nodeId && link.relation === relation)
      .map((link) => ({ asset, link })),
  )
  const labelPrefix = relation === 'input' ? 'input' : 'output'
  const selectedAsset = selectedId ? processAssets.workProducts[selectedId] : null
  const trimmedSelectedMaturity = selectedMaturity.trim()
  const hasMaturityConflict = selectedAsset
    ? hasWorkProductActivityMaturityConflict(selectedAsset, nodeId, relation, trimmedSelectedMaturity)
    : false

  return (
    <section className="properties-section" aria-label={`${labelPrefix} work products`}>
      <h4>{relation === 'input' ? 'Inputs' : 'Outputs'}</h4>
      <AssetChipList
        items={linked.map(({ asset, link }) => ({
          id: encodeWorkProductActivityLinkId(asset.id, link.maturity),
          label: `${asset.title} · ${link.maturity}`,
        }))}
        removeLabel={(label) => `Unlink ${label}`}
        onRemove={onUnlink ? (encodedId) => {
          const decoded = decodeWorkProductActivityLinkId(encodedId)
          onUnlink(nodeId, relation, decoded.workProductId, decoded.maturity)
        } : undefined}
      />
      <label htmlFor={makeFieldId('activity', `New ${labelPrefix} work product`)}>New {labelPrefix} work product</label>
      <div className="asset-inline-create">
        <input id={makeFieldId('activity', `New ${labelPrefix} work product`)} ref={createRef} />
        <MaturityInput
          id={makeFieldId('activity', `New ${labelPrefix} maturity`)}
          label={`New ${labelPrefix} maturity`}
          value={createMaturity}
          onChange={setCreateMaturity}
        />
        <button
          type="button"
          onClick={() => {
            const title = createRef.current?.value.trim() ?? ''
            if (!title) return
            onCreate?.(nodeId, relation, title, createMaturity)
            if (createRef.current) createRef.current.value = ''
          }}
        >
          Add {labelPrefix} work product
        </button>
      </div>
      {assets.length > 0 && onLink && (
        <>
          <label htmlFor={makeFieldId('activity', `Existing ${labelPrefix} work product`)}>Existing {labelPrefix} work product</label>
          <div className="asset-inline-create">
            <select
              id={makeFieldId('activity', `Existing ${labelPrefix} work product`)}
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Select work product</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.title}</option>
              ))}
            </select>
            <MaturityInput
              id={makeFieldId('activity', `Existing ${labelPrefix} maturity`)}
              label={`Existing ${labelPrefix} maturity`}
              value={selectedMaturity}
              onChange={setSelectedMaturity}
            />
            <button
              type="button"
              disabled={!selectedId || !trimmedSelectedMaturity || hasMaturityConflict}
              onClick={() => selectedId && trimmedSelectedMaturity && !hasMaturityConflict && onLink(nodeId, relation, selectedId, trimmedSelectedMaturity)}
            >
              Link {labelPrefix} work product
            </button>
          </div>
          {hasMaturityConflict && (
            <p className="asset-inline-warning">Same maturity cannot be both input and output for this activity. Choose another maturity or unlink first.</p>
          )}
        </>
      )}
    </section>
  )
}

function ActivityGuidanceEditor({
  nodeId,
  processAssets,
  onCreate,
  onLink,
  onUnlink,
  onLinkWorkProduct,
}: {
  nodeId: string
  processAssets: ProcessAssets
  onCreate?: (nodeId: string, data: { title: string; kind: GuidanceKind }) => void
  onLink?: (nodeId: string, guidanceId: string) => void
  onUnlink?: (nodeId: string, guidanceId: string) => void
  onLinkWorkProduct?: (guidanceId: string, workProductId: string) => void
}) {
  const createRef = useRef<HTMLInputElement | null>(null)
  const [kind, setKind] = useState<GuidanceKind>('checklist')
  const [selectedId, setSelectedId] = useState('')
  const [workProductByGuidance, setWorkProductByGuidance] = useState<Record<string, string>>({})
  const assets = Object.values(processAssets.guidanceItems)
  const workProducts = Object.values(processAssets.workProducts)
  const linked = assets.filter((asset) => asset.appliesToNodeIds.includes(nodeId))

  return (
    <section className="properties-section" aria-label="Guidance">
      <h4>Guidance</h4>
      <AssetChipList
        items={linked.map((asset) => ({ id: asset.id, label: `${asset.title} · ${asset.kind}` }))}
        removeLabel={(label) => `Unlink ${label}`}
        onRemove={onUnlink ? (id) => onUnlink(nodeId, id) : undefined}
      />
      <label htmlFor={makeFieldId('activity', 'Guidance kind')}>Guidance kind</label>
      <select
        id={makeFieldId('activity', 'Guidance kind')}
        value={kind}
        onChange={(event) => setKind(event.target.value as GuidanceKind)}
      >
        <option value="checklist">Checklist</option>
        <option value="template">Template</option>
        <option value="practice">Practice</option>
        <option value="tool">Tool</option>
        <option value="training">Training</option>
        <option value="link">Link</option>
        <option value="other">Other</option>
      </select>
      <label htmlFor={makeFieldId('activity', 'New guidance')}>New guidance</label>
      <div className="asset-inline-create">
        <input id={makeFieldId('activity', 'New guidance')} ref={createRef} />
        <button
          type="button"
          onClick={() => {
            const title = createRef.current?.value.trim() ?? ''
            if (!title) return
            onCreate?.(nodeId, { title, kind })
            if (createRef.current) createRef.current.value = ''
          }}
        >
          Add guidance
        </button>
      </div>
      {assets.length > 0 && onLink && (
        <div className="asset-inline-create">
          <select aria-label="Existing guidance" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Select guidance</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.title}</option>
            ))}
          </select>
          <button type="button" onClick={() => selectedId && onLink(nodeId, selectedId)}>
            Link
          </button>
        </div>
      )}
      {linked.length > 0 && workProducts.length > 0 && onLinkWorkProduct && (
        <div className="milestone-state-list">
          {linked.map((guidance) => (
            <div key={guidance.id} className="milestone-state-row">
              <span>{guidance.title}</span>
              <select
                aria-label={`Work product for ${guidance.title}`}
                value={workProductByGuidance[guidance.id] ?? ''}
                onChange={(event) => setWorkProductByGuidance((current) => ({ ...current, [guidance.id]: event.target.value }))}
              >
                <option value="">Work product</option>
                {workProducts.map((workProduct) => (
                  <option key={workProduct.id} value={workProduct.id}>{workProduct.title}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const workProductId = workProductByGuidance[guidance.id]
                  if (!workProductId) return
                  onLinkWorkProduct(guidance.id, workProductId)
                }}
              >
                Link guidance work product
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function HandoffWorkProductsEditor({
  edgeId,
  processAssets,
  onCreate,
  onLink,
  onUnlink,
}: {
  edgeId: string
  processAssets: ProcessAssets
  onCreate?: (edgeId: string, title: string) => void
  onLink?: (edgeId: string, workProductId: string) => void
  onUnlink?: (workProductId: string, edgeId: string) => void
}) {
  const createRef = useRef<HTMLInputElement | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const assets = Object.values(processAssets.workProducts)
  const linked = assets.filter((asset) => asset.handoffEdgeIds.includes(edgeId))

  return (
    <section className="properties-section" aria-label="Work products moved">
      <h4>Work products moved</h4>
      <AssetChipList
        items={linked.map((asset) => ({ id: asset.id, label: asset.title }))}
        removeLabel={(label) => `Unlink ${label}`}
        onRemove={onUnlink ? (id) => onUnlink(id, edgeId) : undefined}
      />
      <label htmlFor={makeFieldId('handoff', 'New moved work product')}>New moved work product</label>
      <div className="asset-inline-create">
        <input id={makeFieldId('handoff', 'New moved work product')} ref={createRef} />
        <button
          type="button"
          onClick={() => {
            const title = createRef.current?.value.trim() ?? ''
            if (!title) return
            onCreate?.(edgeId, title)
            if (createRef.current) createRef.current.value = ''
          }}
        >
          Add moved work product
        </button>
      </div>
      {assets.length > 0 && onLink && (
        <div className="asset-inline-create">
          <select aria-label="Existing moved work product" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Select work product</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.title}</option>
            ))}
          </select>
          <button type="button" onClick={() => selectedId && onLink(edgeId, selectedId)}>
            Link
          </button>
        </div>
      )}
    </section>
  )
}

function StageMilestonesEditor({
  stageNodeId,
  processAssets,
  onCreate,
  onAddWorkProductState,
  onRemoveWorkProductState,
}: {
  stageNodeId: string
  processAssets: ProcessAssets
  onCreate?: (stageNodeId: string, title: string) => void
  onAddWorkProductState?: (milestoneId: string, workProductId: string, state: string) => void
  onRemoveWorkProductState?: (milestoneId: string, workProductId: string) => void
}) {
  const createRef = useRef<HTMLInputElement | null>(null)
  const [stateDraftByMilestone, setStateDraftByMilestone] = useState<Record<string, string>>({})
  const [workProductByMilestone, setWorkProductByMilestone] = useState<Record<string, string>>({})
  const milestones = Object.values(processAssets.milestones).filter((milestone) => milestone.stageNodeId === stageNodeId)
  const workProducts = Object.values(processAssets.workProducts)

  return (
    <section className="properties-section" aria-label="Milestones">
      <h4>Milestones</h4>
      <AssetChipList
        items={milestones.map((milestone) => ({
          id: milestone.id,
          label: `${milestone.title}${milestone.workProductStates.length > 0 ? ` · ${milestone.workProductStates.length} maturities` : ''}`,
        }))}
      />
      <label htmlFor={makeFieldId('stage', 'New milestone')}>New milestone</label>
      <div className="asset-inline-create">
        <input id={makeFieldId('stage', 'New milestone')} ref={createRef} />
        <button
          type="button"
          onClick={() => {
            const title = createRef.current?.value.trim() ?? ''
            if (!title) return
            onCreate?.(stageNodeId, title)
            if (createRef.current) createRef.current.value = ''
          }}
        >
          Add milestone
        </button>
      </div>
      {milestones.length > 0 && workProducts.length > 0 && (onAddWorkProductState || onRemoveWorkProductState) && (
        <div className="milestone-state-list">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="milestone-state-row">
              <span>{milestone.title}</span>
              {milestone.workProductStates.map((state) => {
                const workProduct = processAssets.workProducts[state.workProductId]
                const label = workProduct?.title ?? state.workProductId
                return (
                  <button
                    key={state.workProductId}
                    type="button"
                    className="asset-chip"
                    aria-label={`Remove maturity ${label}`}
                    onClick={() => onRemoveWorkProductState?.(milestone.id, state.workProductId)}
                  >
                    {label} · {state.state}
                  </button>
                )
              })}
              <select
                aria-label={`Work product for ${milestone.title}`}
                value={workProductByMilestone[milestone.id] ?? ''}
                onChange={(event) => setWorkProductByMilestone((current) => ({ ...current, [milestone.id]: event.target.value }))}
                disabled={!onAddWorkProductState}
              >
                <option value="">Work product</option>
                {workProducts.map((workProduct) => (
                  <option key={workProduct.id} value={workProduct.id}>{workProduct.title}</option>
                ))}
              </select>
              <input
                aria-label={`Maturity at milestone for ${milestone.title}`}
                value={stateDraftByMilestone[milestone.id] ?? ''}
                onChange={(event) => setStateDraftByMilestone((current) => ({ ...current, [milestone.id]: event.target.value }))}
                placeholder="Maturity"
                disabled={!onAddWorkProductState}
              />
              <button
                type="button"
                disabled={!onAddWorkProductState}
                onClick={() => {
                  const workProductId = workProductByMilestone[milestone.id]
                  const state = stateDraftByMilestone[milestone.id]
                  if (!workProductId || !state) return
                  onAddWorkProductState?.(milestone.id, workProductId, state)
                }}
              >
                Add maturity
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function MaturityInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const listId = `${id}-options`
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {WORK_PRODUCT_MATURITY_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}

function encodeWorkProductActivityLinkId(workProductId: string, maturity: string): string {
  return `${workProductId}::${encodeURIComponent(maturity)}`
}

function decodeWorkProductActivityLinkId(encodedId: string): { workProductId: string; maturity: string } {
  const [workProductId, encodedMaturity = ''] = encodedId.split('::')
  return { workProductId, maturity: decodeURIComponent(encodedMaturity) }
}

function AssetChipList({
  items,
  removeLabel,
  onRemove,
}: {
  items: { id: string; label: string }[]
  removeLabel?: (label: string) => string
  onRemove?: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <ul className="asset-chip-list">
      {items.map((item) => (
        <li key={item.id} className="asset-chip">
          <span>{item.label}</span>
          {onRemove && (
            <button type="button" aria-label={removeLabel?.(item.label) ?? `Remove ${item.label}`} onClick={() => onRemove(item.id)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function formatResponsibilityKind(kind: ResponsibilityKind): string {
  switch (kind) {
    case 'responsible':
      return 'R'
    case 'accountable':
      return 'A'
    case 'supporting':
      return 'S'
    case 'consulted':
      return 'C'
    case 'informed':
      return 'I'
  }
}

function BottleneckEditor({
  nodeId,
  data,
  onUpdate,
}: {
  nodeId: string
  data: Extract<ProcessNode['data'], { kind: 'bottleneck' }>
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}) {
  return (
    <form className="properties-form">
      <SemanticTextInput prefix="bottleneck" label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea prefix="bottleneck" label="Symptom" value={data.symptom} onCommit={(value) => onUpdate(nodeId, { symptom: value })} />
      <SemanticTextArea prefix="bottleneck" label="Impact" value={data.impact} onCommit={(value) => onUpdate(nodeId, { impact: value })} />
      <SemanticTextArea prefix="bottleneck" label="Suspected cause" value={data.suspectedCause} onCommit={(value) => onUpdate(nodeId, { suspectedCause: value })} />
      <label htmlFor={makeFieldId('bottleneck', 'Review status')}>Review status</label>
      <select
        id={makeFieldId('bottleneck', 'Review status')}
        value={data.reviewStatus}
        onChange={(event) => {
          const value = event.target.value
          if (!isReviewStatusValue(value)) return
          onUpdate(nodeId, { reviewStatus: value })
        }}
      >
        {REVIEW_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </form>
  )
}

function SemanticTextInput({
  prefix,
  label,
  value,
  onCommit,
}: {
  prefix: string
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useDraft(value)
  const id = makeFieldId(prefix, label)
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
        }}
      />
    </>
  )
}

function SemanticTextArea({
  prefix,
  label,
  value,
  onCommit,
}: {
  prefix: string
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useDraft(value)
  const id = makeFieldId(prefix, label)
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        rows={3}
      />
    </>
  )
}
