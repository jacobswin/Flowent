import { type FormEvent } from 'react'
import type { ProcessEdge, ProcessNode } from './canvasTypes'
import { REVIEW_STATUS_OPTIONS, isReviewStatusValue } from './reviewStatus'
import { useDraft } from './useDraft'

function makeFieldId(prefix: string, label: string): string {
  // Stable per label so a double-click into the same node keeps the
  // same id and the test can find it. Spaces and colons are normalized.
  return `prop-${prefix}-${label.toLowerCase().replaceAll(' ', '-').replaceAll(':', '')}`
}

interface PropertiesPanelProps {
  node: ProcessNode | null
  edge: ProcessEdge | null
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onUpdateEdge: (edgeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

export function PropertiesPanel({ node, edge, onUpdateNode, onUpdateEdge, onClose }: PropertiesPanelProps) {
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

      {node && <NodeEditor node={node} onUpdate={onUpdateNode} />}
      {edge && !node && <HandoffEditor edge={edge} onUpdate={onUpdateEdge} />}
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

interface NodeEditorProps {
  node: ProcessNode
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function NodeEditor({ node, onUpdate }: NodeEditorProps) {
  const data = node.data

  if (data.kind === 'start' || data.kind === 'end') {
    return <p className="properties-hint">This is a {data.kind} marker.</p>
  }

  if (data.kind === 'activity') {
    return <ActivityEditor nodeId={node.id} title={data.title} summary={data.summary} roleIds={data.roleIds} expectations={data.expectations ?? ''} onUpdate={onUpdate} />
  }

  if (data.kind === 'decision') {
    return <DecisionEditor nodeId={node.id} title={data.title} criteria={data.criteria} owner={data.owner ?? ''} decisionOutcomes={data.decisionOutcomes ?? []} onUpdate={onUpdate} />
  }

  if (data.kind === 'stage') {
    return <StageEditor nodeId={node.id} data={data} onUpdate={onUpdate} />
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
  expectations: string
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function ActivityEditor({ nodeId, title, summary, roleIds, expectations, onUpdate }: ActivityEditorProps) {
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

  function handleRoleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    const trimmed = roleDraft.trim()
    if (!trimmed) return
    if (roleIds.includes(trimmed)) {
      setRoleDraft('')
      return
    }
    onUpdate(nodeId, { roleIds: [...roleIds, trimmed] })
    setRoleDraft('')
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
        onBlur={() => onUpdate(nodeId, { title: titleDraft })}
      />
      <label htmlFor={makeFieldId('activity', 'Summary')}>Summary</label>
      <textarea
        id={makeFieldId('activity', 'Summary')}
        value={summaryDraft}
        onChange={(e) => setSummaryDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { summary: summaryDraft })}
        rows={3}
      />
      <label htmlFor={makeFieldId('activity', 'Expectations')}>Expectations</label>
      <textarea
        id={makeFieldId('activity', 'Expectations')}
        value={expectationsDraft}
        onChange={(e) => setExpectationsDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { expectations: expectationsDraft })}
        rows={3}
      />
      <label htmlFor={makeFieldId('activity', 'Add role')}>Add role</label>
      <input
        id={makeFieldId('activity', 'Add role')}
        className="properties-role-input"
        value={roleDraft}
        onChange={(e) => setRoleDraft(e.target.value)}
        onKeyDown={handleRoleKeyDown}
        onBlur={() => {
          // Commit any pending text on blur (treat as a soft commit).
          const trimmed = roleDraft.trim()
          if (!trimmed) return
          if (roleIds.includes(trimmed)) {
            setRoleDraft('')
            return
          }
          onUpdate(nodeId, { roleIds: [...roleIds, trimmed] })
          setRoleDraft('')
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
  onUpdate,
}: {
  edge: ProcessEdge
  onUpdate: (edgeId: string, data: Record<string, unknown>) => void
}) {
  const data = edge.data ?? {}
  return (
    <form className="properties-form">
      <SemanticTextInput prefix="handoff" label="Label" value={data.label ?? ''} onCommit={(value) => onUpdate(edge.id, { label: value })} />
      <SemanticTextInput prefix="handoff" label="From role" value={data.fromRole ?? ''} onCommit={(value) => onUpdate(edge.id, { fromRole: value })} />
      <SemanticTextInput prefix="handoff" label="To role" value={data.toRole ?? ''} onCommit={(value) => onUpdate(edge.id, { toRole: value })} />
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
    </form>
  )
}

function StageEditor({
  nodeId,
  data,
  onUpdate,
}: {
  nodeId: string
  data: Extract<ProcessNode['data'], { kind: 'stage' }>
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}) {
  return (
    <form className="properties-form">
      <SemanticTextInput prefix="stage" label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea prefix="stage" label="Goal" value={data.goal} onCommit={(value) => onUpdate(nodeId, { goal: value })} />
      <SemanticTextArea prefix="stage" label="Entry condition" value={data.entryCondition} onCommit={(value) => onUpdate(nodeId, { entryCondition: value })} />
      <SemanticTextArea prefix="stage" label="Exit condition" value={data.exitCondition} onCommit={(value) => onUpdate(nodeId, { exitCondition: value })} />
      <SemanticTextInput prefix="stage" label="Owner" value={data.owner} onCommit={(value) => onUpdate(nodeId, { owner: value })} />
    </form>
  )
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
