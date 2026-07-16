import { useMemo, useState, type DragEvent } from 'react'
import {
  getSharedProcessHandoffSourceId,
  getSharedProcessHandoffTargetId,
  type SharedActivity,
  type SharedProcess,
  type SharedRole,
  type SharedProcessStage,
} from './sharedElements'

export function SharedProcessEditor({
  process,
  activities,
  roles = [],
  onEnsureSharedRoles,
  onSave,
  onClose,
}: {
  process: SharedProcess
  activities: SharedActivity[]
  roles?: SharedRole[]
  onEnsureSharedRoles?: (roleNames: string[]) => Promise<Record<string, string>>
  onSave: (patch: Pick<SharedProcess, 'title' | 'description' | 'activities' | 'decisions' | 'stages' | 'handoffs'>) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(process.title)
  const [description, setDescription] = useState(process.description)
  const [placements, setPlacements] = useState(process.activities)
  const [decisions, setDecisions] = useState(process.decisions)
  const [stages, setStages] = useState(process.stages)
  const [handoffs, setHandoffs] = useState(process.handoffs)
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [label, setLabel] = useState('')
  const activityById = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities])
  const processNodes = useMemo(() => [
    ...placements.map((placement) => ({ id: placement.id, title: activityById.get(placement.activityId)?.title ?? 'Missing activity', x: placement.x, y: placement.y, width: 210, height: 62, kind: 'activity' as const })),
    ...decisions.map((decision) => ({ id: decision.id, title: decision.title, x: decision.x, y: decision.y, width: 164, height: 92, kind: 'decision' as const })),
  ], [activityById, decisions, placements])

  function addActivity(activityId: string): void {
    if (!activityById.has(activityId)) return
    const index = placements.length
    setPlacements((current) => [
      ...current,
      {
        id: `placement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        activityId,
        x: 72,
        y: 56 + index * 138,
      },
    ])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    addActivity(event.dataTransfer.getData('application/x-flowent-activity'))
  }

  function removePlacement(placementId: string): void {
    setPlacements((current) => current.filter((placement) => placement.id !== placementId))
    setHandoffs((current) => current.filter((handoff) => getSharedProcessHandoffSourceId(handoff) !== placementId && getSharedProcessHandoffTargetId(handoff) !== placementId))
    setStages((current) => current.map((stage) => ({ ...stage, memberIds: stage.memberIds.filter((memberId) => memberId !== placementId) })))
  }

  function addDecision(): void {
    const index = decisions.length
    setDecisions((current) => [...current, {
      id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: 'New decision',
      criteria: '',
      decisionOutcomes: [],
      x: 340,
      y: 56 + index * 138,
    }])
  }

  function removeDecision(decisionId: string): void {
    setDecisions((current) => current.filter((decision) => decision.id !== decisionId))
    setHandoffs((current) => current.filter((handoff) => getSharedProcessHandoffSourceId(handoff) !== decisionId && getSharedProcessHandoffTargetId(handoff) !== decisionId))
    setStages((current) => current.map((stage) => ({ ...stage, memberIds: stage.memberIds.filter((memberId) => memberId !== decisionId) })))
  }

  function addStage(): void {
    const index = stages.length
    setStages((current) => [...current, {
      id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: 'New stage',
      description: '',
      goal: '',
      entryCondition: '',
      exitCondition: '',
      x: 28,
      y: 28 + index * 210,
      width: 560,
      height: 180,
      memberIds: [],
      milestones: [],
    }])
  }

  function autoLayout(): void {
    setPlacements((current) => current.map((placement, index) => ({ ...placement, x: 72, y: 56 + index * 138 })))
    setDecisions((current) => current.map((decision, index) => ({ ...decision, x: 340, y: 56 + index * 138 })))
  }

  async function save(): Promise<void> {
    await onSave({ title: title.trim() || process.title, description, activities: placements, decisions, stages, handoffs })
    onClose()
  }

  return (
    <div className="shared-process-editor-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="shared-process-editor" role="dialog" aria-modal="true" aria-label={`Edit ${process.title}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Reusable process</span>
            <h2>Process editor</h2>
          </div>
          <button type="button" aria-label="Close process editor" onClick={onClose}>x</button>
        </header>
        <div className="shared-process-editor-body">
          <aside className="shared-process-activity-library">
            <h3>Activities</h3>
            <p>Drag an Activity onto the subflow, or add it directly.</p>
            {activities.length === 0 && <p className="shared-process-empty">Create shared Activities in Elements first.</p>}
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="shared-process-activity-source"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('application/x-flowent-activity', activity.id)}
              >
                <span title={activity.title}>{activity.title}</span>
                <button type="button" onClick={() => addActivity(activity.id)}>Add</button>
              </div>
            ))}
            <div className="shared-process-tools">
              <button type="button" onClick={addDecision}>Add decision</button>
              <button type="button" onClick={addStage}>Add stage</button>
            </div>
          </aside>
          <main className="shared-process-workspace">
            <div className="shared-process-fields">
              <label>Process title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>
              <button type="button" onClick={autoLayout}>Arrange</button>
            </div>
            <div className="shared-process-canvas" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
              {placements.length === 0 && <p>Drop reusable Activities here to compose this Process.</p>}
              <svg className="shared-process-canvas-edges" aria-hidden="true">
                <defs>
                  <marker id="shared-process-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
                  </marker>
                </defs>
                {handoffs.map((handoff) => {
                  const source = processNodes.find((node) => node.id === getSharedProcessHandoffSourceId(handoff))
                  const target = processNodes.find((node) => node.id === getSharedProcessHandoffTargetId(handoff))
                  if (!source || !target) return null
                  return <path
                    key={handoff.id}
                    d={`M ${source.x + source.width} ${source.y + source.height / 2} H ${target.x - 18} V ${target.y + target.height / 2} H ${target.x}`}
                    markerEnd="url(#shared-process-arrow)"
                  />
                })}
              </svg>
              {stages.map((stage) => (
                <div key={stage.id} className="shared-process-stage" style={{ left: stage.x, top: stage.y, width: stage.width, height: stage.height }}>
                  <strong>{stage.title}</strong>
                  <button type="button" aria-label={`Remove ${stage.title}`} onClick={() => setStages((current) => current.filter((item) => item.id !== stage.id))}>x</button>
                </div>
              ))}
              {placements.map((placement) => {
                const activity = activityById.get(placement.activityId)
                return (
                  <div
                    key={placement.id}
                    className="shared-process-placement"
                    style={{ left: placement.x, top: placement.y }}
                    title={activity?.summary || activity?.title}
                  >
                    <strong>{activity?.title ?? 'Missing activity'}</strong>
                    <button type="button" aria-label={`Remove ${activity?.title ?? 'activity'}`} onClick={() => removePlacement(placement.id)}>x</button>
                  </div>
                )
              })}
              {decisions.map((decision) => (
                <div key={decision.id} className="shared-process-decision" style={{ left: decision.x, top: decision.y }} title={decision.criteria || decision.title}>
                  <strong>{decision.title}</strong>
                  <button type="button" aria-label={`Remove ${decision.title}`} onClick={() => removeDecision(decision.id)}>x</button>
                </div>
              ))}
            </div>
            <section className="shared-process-handoffs" aria-label="Internal handoffs">
              <h3>Internal handoffs</h3>
              <div className="shared-process-handoff-add">
                <select aria-label="Handoff source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                  <option value="">From item</option>
                  {processNodes.map((node) => <option key={node.id} value={node.id}>{node.kind === 'decision' ? 'Decision: ' : ''}{node.title}</option>)}
                </select>
                <select aria-label="Handoff target" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                  <option value="">To item</option>
                  {processNodes.map((node) => <option key={node.id} value={node.id}>{node.kind === 'decision' ? 'Decision: ' : ''}{node.title}</option>)}
                </select>
                <input aria-label="Handoff label" placeholder="Optional label" value={label} onChange={(event) => setLabel(event.target.value)} />
                <button type="button" disabled={!sourceId || !targetId || sourceId === targetId} onClick={() => {
                  if (!sourceId || !targetId || sourceId === targetId) return
                  setHandoffs((current) => [...current, {
                    id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    sourceNodeId: sourceId,
                    targetNodeId: targetId,
                    sourcePlacementId: sourceId,
                    targetPlacementId: targetId,
                    label: label.trim(),
                  }])
                  setLabel('')
                }}>Connect</button>
              </div>
              {handoffs.map((handoff) => (
                <div key={handoff.id} className="shared-process-handoff-row">
                  <span>{processNodes.find((node) => node.id === getSharedProcessHandoffSourceId(handoff))?.title ?? 'Missing'} to {processNodes.find((node) => node.id === getSharedProcessHandoffTargetId(handoff))?.title ?? 'Missing'}{handoff.label ? ` - ${handoff.label}` : ''}</span>
                  <button type="button" aria-label="Remove handoff" onClick={() => setHandoffs((current) => current.filter((item) => item.id !== handoff.id))}>x</button>
                </div>
              ))}
            </section>
            <section className="shared-process-stages" aria-label="Process stages">
              <h3>Stages</h3>
              {stages.length === 0 && <p className="shared-process-empty">Add a Stage to group Activities and Decisions.</p>}
              {stages.map((stage) => (
                <StageFields
                  key={stage.id}
                  stage={stage}
                  nodes={processNodes}
                  roles={roles}
                  onEnsureSharedRoles={onEnsureSharedRoles}
                  onChange={(patch) => setStages((current) => current.map((item) => item.id === stage.id ? { ...item, ...patch } : item))}
                />
              ))}
            </section>
          </main>
        </div>
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="shared-process-save" onClick={() => void save()}>Save process</button>
        </footer>
      </section>
    </div>
  )
}

function StageFields({
  stage,
  nodes,
  roles,
  onEnsureSharedRoles,
  onChange,
}: {
  stage: SharedProcessStage
  nodes: Array<{ id: string; title: string; kind: 'activity' | 'decision' }>
  roles: SharedRole[]
  onEnsureSharedRoles?: (roleNames: string[]) => Promise<Record<string, string>>
  onChange: (patch: Partial<SharedProcessStage>) => void
}) {
  const availableNodes = nodes.filter((node) => !stage.memberIds.includes(node.id))
  const [newMilestone, setNewMilestone] = useState('')
  const ownerName = roles.find((role) => role.id === stage.ownerRoleId)?.name ?? ''
  const [ownerDraft, setOwnerDraft] = useState(ownerName)
  return (
    <div className="shared-process-stage-fields">
      <label>Stage title<input value={stage.title} onChange={(event) => onChange({ title: event.target.value })} /></label>
      <label>Goal<textarea value={stage.goal} rows={2} onChange={(event) => onChange({ goal: event.target.value })} /></label>
      <label>Entry condition<input value={stage.entryCondition} onChange={(event) => onChange({ entryCondition: event.target.value })} /></label>
      <label>Exit condition<input value={stage.exitCondition} onChange={(event) => onChange({ exitCondition: event.target.value })} /></label>
      <label>Owner
        <input
          list={`shared-stage-role-options-${stage.id}`}
          value={ownerDraft}
          placeholder="Person or role"
          onChange={(event) => {
            const value = event.target.value
            setOwnerDraft(value)
            const existing = roles.find((role) => role.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase())
            if (existing) onChange({ ownerRoleId: existing.id })
          }}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim()
            if (!value) {
              onChange({ ownerRoleId: undefined })
              return
            }
            const existing = roles.find((role) => role.name.trim().toLocaleLowerCase() === value.toLocaleLowerCase())
            if (existing) {
              onChange({ ownerRoleId: existing.id })
            } else if (onEnsureSharedRoles) {
              void onEnsureSharedRoles([value]).then((ids) => onChange({ ownerRoleId: ids[value.toLocaleLowerCase()] }))
            }
          }}
        />
        <datalist id={`shared-stage-role-options-${stage.id}`}>{roles.map((role) => <option key={role.id} value={role.name} />)}</datalist>
      </label>
      <label>Add member
        <select value="" onChange={(event) => {
          const nodeId = event.target.value
          if (nodeId) onChange({ memberIds: [...stage.memberIds, nodeId] })
        }}>
          <option value="">Activity or Decision</option>
          {availableNodes.map((node) => <option key={node.id} value={node.id}>{node.kind === 'decision' ? 'Decision: ' : ''}{node.title}</option>)}
        </select>
      </label>
      {stage.memberIds.length > 0 && (
        <div className="shared-process-stage-members">
          {stage.memberIds.map((memberId) => {
            const node = nodes.find((item) => item.id === memberId)
            return <button key={memberId} type="button" onClick={() => onChange({ memberIds: stage.memberIds.filter((id) => id !== memberId) })}>
              {node?.title ?? 'Missing item'} x
            </button>
          })}
        </div>
      )}
      <div className="shared-process-stage-milestones">
        <strong>Milestones</strong>
        <div>
          <input value={newMilestone} placeholder="Milestone title" onChange={(event) => setNewMilestone(event.target.value)} />
          <button type="button" disabled={!newMilestone.trim()} onClick={() => {
            const title = newMilestone.trim()
            if (!title) return
            onChange({ milestones: [...stage.milestones, { id: `milestone-${Date.now()}`, title, description: '', workProductStates: [] }] })
            setNewMilestone('')
          }}>Add</button>
        </div>
        {stage.milestones.map((milestone) => (
          <div key={milestone.id} className="shared-process-stage-milestone">
            <input value={milestone.title} onChange={(event) => onChange({ milestones: stage.milestones.map((item) => item.id === milestone.id ? { ...item, title: event.target.value } : item) })} />
            <button type="button" onClick={() => onChange({ milestones: stage.milestones.filter((item) => item.id !== milestone.id) })}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
