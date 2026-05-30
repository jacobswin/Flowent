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
    return <ActivityEditor nodeId={node.id} title={data.title} summary={data.summary} onUpdate={onUpdate} />
  }

  if (data.kind === 'decision') {
    return <DecisionEditor nodeId={node.id} title={data.title} criteria={data.criteria} onUpdate={onUpdate} />
  }

  return null
}

interface ActivityEditorProps {
  nodeId: string
  title: string
  summary: string
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function ActivityEditor({ nodeId, title, summary, onUpdate }: ActivityEditorProps) {
  const [titleDraft, setTitleDraft] = useState(title)
  const [summaryDraft, setSummaryDraft] = useState(summary)

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
    </form>
  )
}

interface DecisionEditorProps {
  nodeId: string
  title: string
  criteria: string
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}

function DecisionEditor({ nodeId, title, criteria, onUpdate }: DecisionEditorProps) {
  const [titleDraft, setTitleDraft] = useState(title)
  const [criteriaDraft, setCriteriaDraft] = useState(criteria)

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
