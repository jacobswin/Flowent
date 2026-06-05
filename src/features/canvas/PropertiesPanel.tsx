import { useState, type FormEvent } from 'react'
import type { ProcessNode, ProcessEdge } from './canvasTypes'

interface PropertiesPanelProps {
  node: ProcessNode | null
  edge: ProcessEdge | null
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

export function PropertiesPanel({ node, edge, onUpdateNode, onClose }: PropertiesPanelProps) {
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
      {edge && !node && <EdgeInfo edge={edge} />}
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
    return <ActivityEditor nodeId={node.id} title={data.title} summary={data.summary} expectations={data.expectations ?? ''} onUpdate={onUpdate} />
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
  expectations: string
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function ActivityEditor({ nodeId, title, summary, expectations, onUpdate }: ActivityEditorProps) {
  const [titleDraft, setTitleDraft] = useState(title)
  const [summaryDraft, setSummaryDraft] = useState(summary)
  const [expectationsDraft, setExpectationsDraft] = useState(expectations)

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    onUpdate(nodeId, { title: titleDraft, summary: summaryDraft })
  }

  return (
    <form onSubmit={handleSubmit} className="properties-form">
      <label htmlFor="prop-title">Title</label>
      <input
        id="prop-title"
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { title: titleDraft })}
      />
      <label htmlFor="prop-summary">Summary</label>
      <textarea
        id="prop-summary"
        value={summaryDraft}
        onChange={(e) => setSummaryDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { summary: summaryDraft })}
        rows={3}
      />
      <label htmlFor="prop-expectations">Expectations</label>
      <textarea
        id="prop-expectations"
        value={expectationsDraft}
        onChange={(e) => setExpectationsDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { expectations: expectationsDraft })}
        rows={3}
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
  const [titleDraft, setTitleDraft] = useState(title)
  const [criteriaDraft, setCriteriaDraft] = useState(criteria)
  const [ownerDraft, setOwnerDraft] = useState(owner)
  const [outcomesDraft, setOutcomesDraft] = useState(decisionOutcomes.join('\n'))

  function commitOutcomes(): void {
    const next = outcomesDraft
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    onUpdate(nodeId, { decisionOutcomes: next })
  }

  return (
    <form className="properties-form">
      <label htmlFor="prop-title">Question</label>
      <input
        id="prop-title"
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { title: titleDraft })}
      />
      <label htmlFor="prop-criteria">Criteria</label>
      <textarea
        id="prop-criteria"
        value={criteriaDraft}
        onChange={(e) => setCriteriaDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { criteria: criteriaDraft })}
        rows={3}
      />
      <label htmlFor="prop-owner">Decision owner</label>
      <input
        id="prop-owner"
        value={ownerDraft}
        onChange={(e) => setOwnerDraft(e.target.value)}
        onBlur={() => onUpdate(nodeId, { owner: ownerDraft })}
      />
      <label htmlFor="prop-outcomes">Possible outcomes (one per line)</label>
      <textarea
        id="prop-outcomes"
        value={outcomesDraft}
        onChange={(e) => setOutcomesDraft(e.target.value)}
        onBlur={commitOutcomes}
        rows={3}
      />
    </form>
  )
}

function EdgeInfo({ edge }: { edge: ProcessEdge }) {
  return (
    <p className="properties-hint">
      Connection from <strong>{edge.source}</strong> to <strong>{edge.target}</strong>
    </p>
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
      <SemanticTextInput label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea label="Goal" value={data.goal} onCommit={(value) => onUpdate(nodeId, { goal: value })} />
      <SemanticTextArea label="Entry condition" value={data.entryCondition} onCommit={(value) => onUpdate(nodeId, { entryCondition: value })} />
      <SemanticTextArea label="Exit condition" value={data.exitCondition} onCommit={(value) => onUpdate(nodeId, { exitCondition: value })} />
      <SemanticTextInput label="Owner" value={data.owner} onCommit={(value) => onUpdate(nodeId, { owner: value })} />
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
      <SemanticTextInput label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea label="Symptom" value={data.symptom} onCommit={(value) => onUpdate(nodeId, { symptom: value })} />
      <SemanticTextArea label="Impact" value={data.impact} onCommit={(value) => onUpdate(nodeId, { impact: value })} />
      <SemanticTextArea label="Suspected cause" value={data.suspectedCause} onCommit={(value) => onUpdate(nodeId, { suspectedCause: value })} />
      <label htmlFor="prop-review-status">Review status</label>
      <select
        id="prop-review-status"
        value={data.reviewStatus}
        onChange={(event) => onUpdate(nodeId, { reviewStatus: event.target.value })}
      >
        <option value="unclear">Unclear</option>
        <option value="disputed">Disputed</option>
        <option value="needs-owner">Needs owner</option>
        <option value="approved">Approved</option>
        <option value="changed-since-approval">Changed since approval</option>
      </select>
    </form>
  )
}

function SemanticTextInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const id = `prop-${label.toLowerCase().replaceAll(' ', '-')}`
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
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const id = `prop-${label.toLowerCase().replaceAll(' ', '-')}`
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
