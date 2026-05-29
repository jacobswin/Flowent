import { useState, type FormEvent } from 'react'
import type { Activity, DraftState, ProcessMap } from './types'
import type { GeneratedSource } from '../scenario-generation/types'
import { useWorkspace } from './useWorkspace'

interface ProcessMapWorkspaceProps {
  initialMap: ProcessMap
  initialSources?: Record<string, GeneratedSource>
}

const SOURCE_LABELS: Record<GeneratedSource, string> = {
  'user-provided': 'User provided',
  'model-inferred': 'Model inferred',
  'system-derived': 'System derived',
}

const DRAFT_STATE_LABELS: Record<DraftState, string> = {
  draft: 'Draft',
  'in-discussion': 'In discussion',
  'ready-for-confirmation': 'Ready for confirmation',
  confirmed: 'Confirmed',
  approved: 'Approved',
  activated: 'Activated',
  rejected: 'Rejected',
}

export function ProcessMapWorkspace({ initialMap, initialSources = {} }: ProcessMapWorkspaceProps) {
  const workspace = useWorkspace(initialMap, initialSources)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(initialMap.title)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [activityDraft, setActivityDraft] = useState({ title: '', summary: '' })
  const [addingActivity, setAddingActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({ title: '', summary: '' })

  function handleSaveTitle(event: FormEvent): void {
    event.preventDefault()
    workspace.updateTitle(titleDraft)
    setEditingTitle(false)
  }

  function handleEditActivity(activity: Activity): void {
    setEditingActivityId(activity.id)
    setActivityDraft({ title: activity.title, summary: activity.summary })
  }

  function handleSaveActivity(event: FormEvent): void {
    event.preventDefault()
    if (!editingActivityId) return
    workspace.updateActivity(editingActivityId, activityDraft)
    setEditingActivityId(null)
  }

  function handleAddActivity(event: FormEvent): void {
    event.preventDefault()
    const id = `activity-${Date.now()}`
    workspace.addActivity({
      id,
      title: newActivity.title,
      summary: newActivity.summary,
      responsibilities: [],
      inputIds: [],
      outputIds: [],
      decisionIds: [],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    })
    setAddingActivity(false)
    setNewActivity({ title: '', summary: '' })
  }

  return (
    <main className="workspace-shell" aria-labelledby="workspace-title">
      <section className="workspace-header">
        <div>
          <p className="panel-label">Workspace</p>
          {editingTitle ? (
            <form onSubmit={handleSaveTitle} className="inline-edit-form">
              <label htmlFor="map-title">Map title</label>
              <input
                id="map-title"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                autoFocus
              />
              <button type="submit">Save title</button>
            </form>
          ) : (
            <div className="workspace-title-row">
              <h1 id="workspace-title">{workspace.map.title}</h1>
              <button type="button" onClick={() => { setEditingTitle(true); setTitleDraft(workspace.map.title) }}>
                Edit title
              </button>
            </div>
          )}
          <p className="workspace-scenario">{workspace.map.scenario || 'No scenario set.'}</p>
        </div>
        <div className="workspace-controls">
          <div className="readiness-status">
            {workspace.readiness.isReady ? (
              <span className="readiness-ready">Ready for discussion</span>
            ) : (
              <div className="readiness-missing">
                <span className="readiness-not-ready">Not ready</span>
                <ul role="list">
                  {workspace.readiness.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="undo-redo-controls">
            <button type="button" onClick={workspace.undo} disabled={!workspace.canUndo}>
              Undo
            </button>
            <button type="button" onClick={workspace.redo} disabled={!workspace.canRedo}>
              Redo
            </button>
          </div>
        </div>
      </section>

      <section className="workspace-panels" role="region" aria-label="Activities">
        <div className="workspace-panel-header">
          <h2>Activities</h2>
          <button type="button" onClick={() => setAddingActivity(true)}>Add activity</button>
        </div>

        {addingActivity && (
          <form onSubmit={handleAddActivity} className="workspace-add-form">
            <label htmlFor="new-activity-title">Activity title</label>
            <input
              id="new-activity-title"
              value={newActivity.title}
              onChange={(event) => setNewActivity((d) => ({ ...d, title: event.target.value }))}
              required
            />
            <label htmlFor="new-activity-summary">Activity summary</label>
            <textarea
              id="new-activity-summary"
              value={newActivity.summary}
              onChange={(event) => setNewActivity((d) => ({ ...d, summary: event.target.value }))}
            />
            <div className="form-actions">
              <button type="submit">Save</button>
              <button type="button" onClick={() => setAddingActivity(false)}>Cancel</button>
            </div>
          </form>
        )}

        <ul role="list" className="workspace-item-list">
          {workspace.map.activities.map((activity) => (
            <li key={activity.id} className="workspace-item">
              {editingActivityId === activity.id ? (
                <form onSubmit={handleSaveActivity} className="workspace-edit-form">
                  <label htmlFor="activity-title">Activity title</label>
                  <input
                    id="activity-title"
                    value={activityDraft.title}
                    onChange={(event) => setActivityDraft((d) => ({ ...d, title: event.target.value }))}
                  />
                  <label htmlFor="activity-summary">Activity summary</label>
                  <textarea
                    id="activity-summary"
                    value={activityDraft.summary}
                    onChange={(event) => setActivityDraft((d) => ({ ...d, summary: event.target.value }))}
                  />
                  <div className="form-actions">
                    <button type="submit">Save</button>
                    <button type="button" onClick={() => setEditingActivityId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="workspace-item-content">
                  <div>
                    <strong>{activity.title}</strong>
                    <span className="source-pill">{SOURCE_LABELS[workspace.sources[activity.id] ?? 'user-provided']}</span>
                  </div>
                  <p>{activity.summary}</p>
                  <div className="item-actions">
                    <button type="button" onClick={() => handleEditActivity(activity)}>
                      Edit {activity.title}
                    </button>
                    <button type="button" onClick={() => workspace.removeActivity(activity.id)}>
                      Remove {activity.title}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="workspace-panels" role="region" aria-label="Consensus">
        <div className="workspace-panel-header">
          <h2>Consensus</h2>
          <span className={`draft-state-badge draft-state-${workspace.draftState}`}>
            {DRAFT_STATE_LABELS[workspace.draftState]}
          </span>
        </div>

        {workspace.draftState === 'activated' && (
          <div className="consensus-activated">
            <p>This process map is active.</p>
            {workspace.versions.length > 0 && (
              <p className="version-info">Version {workspace.versions.length} activated.</p>
            )}
          </div>
        )}

        {workspace.draftState !== 'activated' && (
          <>
            <div className="confirmation-list">
              <h3>Confirmations</h3>
              <ul role="list">
                {workspace.map.roles.map((role) => {
                  const confirmed = workspace.confirmations.find((c) => c.actorId === role.id)
                  return (
                    <li key={role.id} className={confirmed ? 'confirmed' : 'pending'}>
                      <span className="confirmation-role">{role.name}</span>
                      {confirmed ? (
                        <span className="confirmation-badge confirmed">Confirmed</span>
                      ) : (
                        <span className="confirmation-badge pending">Pending</span>
                      )}
                      {!confirmed ? (
                        <button type="button" onClick={() => workspace.confirmForRole(role.id, role.name, role.kind)}>
                          Confirm for {role.name}
                        </button>
                      ) : (
                        <button type="button" onClick={() => workspace.removeConfirmation(role.id)}>
                          Remove
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            {workspace.draftState === 'draft' || workspace.draftState === 'in-discussion' ? (
              <button type="button" className="mark-ready-button" onClick={workspace.markReady} disabled={!workspace.readiness.isReady}>
                Mark ready for confirmation
              </button>
            ) : null}

            {workspace.draftState === 'ready-for-confirmation' && (
              <div className="approval-controls">
                <p>Ready for approval.</p>
                <button type="button" onClick={() => workspace.approve('Process Owner')}>
                  Approve
                </button>
                <button type="button" onClick={() => workspace.reject('Process Owner')}>
                  Reject
                </button>
              </div>
            )}

            {workspace.draftState === 'approved' && (
              <div className="activation-controls">
                <p>Approved. Ready to activate.</p>
                <button type="button" className="activate-button" onClick={workspace.activate}>
                  Activate map
                </button>
              </div>
            )}

            {workspace.draftState === 'rejected' && (
              <div className="rejected-notice">
                <p>Rejected. Continue editing and re-submit when ready.</p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
