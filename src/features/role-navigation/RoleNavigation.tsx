import { ArrowDownUp, BadgeCheck, Boxes, CheckCircle2, GitBranch, Network, Route } from 'lucide-react'
import type { Role } from '../process-map/types'
import { sampleProcessMap } from '../process-map/sampleProcessMap'
import { deriveRoleView } from './deriveRoleView'
import type { RoleView } from './deriveRoleView'

interface RoleNavigationProps {
  selectedRoleId: string
  onRoleChange: (roleId: string) => void
}

export function RoleNavigation({ selectedRoleId, onRoleChange }: RoleNavigationProps) {
  const roleView = deriveRoleView(sampleProcessMap, selectedRoleId)
  const statusMessage = `Showing ${roleView.role.name} process lens: ${roleView.activities.length} activities, ${roleView.handoffs.length} handoffs, ${roleView.decisions.length} decisions.`

  return (
    <main className="workspace-shell">
      <header className="workspace-header" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Flowent / role-first process navigation</p>
          <h1 id="page-title">Know your part in the process before work starts.</h1>
        </div>
        <dl className="process-state" aria-label="Current process status">
          <div>
            <dt>Status</dt>
            <dd>{roleView.processStatus}</dd>
          </div>
          <div>
            <dt>Process</dt>
            <dd>{roleView.processTitle}</dd>
          </div>
        </dl>
      </header>

      <section className="navigation-grid" aria-label="Role navigation workspace">
        <aside className="role-rail" aria-label="Available roles">
          <div>
            <p className="panel-label">Choose role</p>
            <h2 id="role-selector-title">Process lens</h2>
            <p id="role-selector-help">Choose your role to view activities, dependencies, handoffs, and expectations.</p>
          </div>
          <div
            className="role-list"
            role="group"
            aria-labelledby="role-selector-title"
            aria-describedby="role-selector-help"
          >
            {sampleProcessMap.roles.map((role) => (
              <RoleButton
                key={role.id}
                role={role}
                isSelected={role.id === selectedRoleId}
                onSelect={onRoleChange}
              />
            ))}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {statusMessage}
          </p>
        </aside>

        <RolePath view={roleView} />

        <aside className="context-panel" aria-label="Role context">
          <InsightBlock
            icon={<ArrowDownUp aria-hidden="true" />}
            title="Inputs needed"
            items={roleView.requiredInputs.map((input) => input.title)}
          />
          <InsightBlock
            icon={<Boxes aria-hidden="true" />}
            title="Outputs produced"
            items={roleView.producedOutputs.map((output) => output.title)}
          />
          <InsightBlock
            icon={<GitBranch aria-hidden="true" />}
            title="Decisions affecting this role"
            items={roleView.decisions.map((decision) => decision.title)}
          />
        </aside>
      </section>
    </main>
  )
}

interface RoleButtonProps {
  role: Role
  isSelected: boolean
  onSelect: (roleId: string) => void
}

function RoleButton({ role, isSelected, onSelect }: RoleButtonProps) {
  return (
    <button
      className="role-button"
      type="button"
      aria-pressed={isSelected}
      aria-label={role.name}
      aria-describedby={`${role.id}-focus`}
      onClick={() => onSelect(role.id)}
    >
      <span>
        {role.name}
        {isSelected ? <strong>Current role</strong> : null}
      </span>
      <small id={`${role.id}-focus`}>{role.focus}</small>
    </button>
  )
}

interface RolePathProps {
  view: RoleView
}

function RolePath({ view }: RolePathProps) {
  return (
    <section className="role-path" aria-labelledby="role-path-title">
      <div className="role-path-header">
        <div>
          <p className="panel-label">Selected role</p>
          <h2 id="role-path-title">{view.role.name}</h2>
          <p>{view.role.focus}</p>
        </div>
        <dl className="role-counts" aria-label="Role navigation summary">
          <div>
            <dt>Activities</dt>
            <dd>{view.activities.length}</dd>
          </div>
          <div>
            <dt>Handoffs</dt>
            <dd>{view.handoffs.length}</dd>
          </div>
          <div>
            <dt>Decisions</dt>
            <dd>{view.decisions.length}</dd>
          </div>
        </dl>
      </div>

      <div className="process-scenario">
        <Network aria-hidden="true" />
        <p>{view.scenario}</p>
      </div>

      <div className="dependency-strip" aria-label="Role dependencies">
        <DependencyGroup title="Depends on" values={view.upstreamDependencies.map((actor) => actor.name)} />
        <DependencyGroup title="Hands off to" values={view.downstreamRecipients.map((actor) => actor.name)} />
      </div>

      <ol className="activity-timeline" aria-label="Role activity path" role="list">
        {view.activities.map((activity, index) => {
          const responsibility = activity.responsibilities.find(
            (candidate) => candidate.actorId === view.role.id,
          )

          return (
            <li key={activity.id}>
              <div className="activity-index">{index + 1}</div>
              <article className="activity-card">
                <div>
                  <h3>{activity.title}</h3>
                  {responsibility ? <p className="responsibility-tag">Your role: {responsibility.kind}</p> : null}
                  <p>{activity.summary}</p>
                </div>
                <dl>
                  <div>
                    <dt>Inputs</dt>
                    <dd>{activity.inputIds.length}</dd>
                  </div>
                  <div>
                    <dt>Outputs</dt>
                    <dd>{activity.outputIds.length}</dd>
                  </div>
                  <div>
                    <dt>Checks</dt>
                    <dd>{activity.expectationIds.length}</dd>
                  </div>
                </dl>
              </article>
            </li>
          )
        })}
      </ol>

      <section className="handoff-panel" aria-labelledby="handoffs-title">
        <div>
          <Route aria-hidden="true" />
          <h3 id="handoffs-title">Handoffs to watch</h3>
        </div>
        <ul role="list">
          {view.handoffs.map((handoff) => (
            <li key={handoff.id}>{handoff.title}</li>
          ))}
        </ul>
      </section>

      <section className="expectation-panel" aria-labelledby="expectations-title">
        <div>
          <BadgeCheck aria-hidden="true" />
          <h3 id="expectations-title">Completion expectations</h3>
        </div>
        <ul role="list">
          {view.expectations.map((expectation) => (
            <li key={expectation.id}>
              <CheckCircle2 aria-hidden="true" />
              <span>
                <strong>{expectation.title}</strong>
                {expectation.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

interface DependencyGroupProps {
  title: string
  values: string[]
}

function DependencyGroup({ title, values }: DependencyGroupProps) {
  return (
    <div>
      <p>{title}</p>
      <div>
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </div>
  )
}

interface InsightBlockProps {
  icon: React.ReactNode
  title: string
  items: string[]
}

function InsightBlock({ icon, title, items }: InsightBlockProps) {
  return (
    <section className="insight-block">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      {items.length > 0 ? (
        <ul role="list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No items are required for this role in this process.</p>
      )}
    </section>
  )
}
