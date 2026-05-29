import { ClipboardCheck, Eye, Flag, Layers3, Route, ShieldCheck, UsersRound } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { sampleProcessMap } from '../process-map/sampleProcessMap'
import type {
  Activity,
  Actor,
  Decision,
  Expectation,
  Handoff,
  ProcessOutput,
  Role,
  WorkProduct,
} from '../process-map/types'
import {
  deriveManagerView,
  deriveProcessOwnerView,
  deriveQualityReviewView,
  deriveStakeholderView,
} from './deriveProcessViews'
import type { ProcessGap, ProcessViewKind } from './deriveProcessViews'

const VIEW_OPTIONS: Array<{
  kind: ProcessViewKind
  label: string
  description: string
}> = [
  {
    kind: 'manager',
    label: 'Manager',
    description: 'Readiness, participants, and handoff risk.',
  },
  {
    kind: 'process-owner',
    label: 'Process owner',
    description: 'Completeness gaps and structural health.',
  },
  {
    kind: 'quality-review',
    label: 'Quality review',
    description: 'Review standards, work products, and decisions.',
  },
  {
    kind: 'stakeholder',
    label: 'Stakeholder',
    description: 'Why Design Lead is involved and affected.',
  },
]

export function MultiRoleProcessViews() {
  const [selectedView, setSelectedView] = useState<ProcessViewKind>('manager')

  function selectView(view: ProcessViewKind, shouldFocus = false): void {
    setSelectedView(view)

    if (shouldFocus) {
      document.getElementById(`${view}-view-tab`)?.focus()
    }
  }

  function handleViewKeyDown(event: KeyboardEvent<HTMLButtonElement>, view: ProcessViewKind): void {
    const currentIndex = VIEW_OPTIONS.findIndex((option) => option.kind === view)
    const lastIndex = VIEW_OPTIONS.length - 1
    const nextViewByKey: Partial<Record<string, ProcessViewKind>> = {
      ArrowRight: VIEW_OPTIONS[currentIndex === lastIndex ? 0 : currentIndex + 1].kind,
      ArrowDown: VIEW_OPTIONS[currentIndex === lastIndex ? 0 : currentIndex + 1].kind,
      ArrowLeft: VIEW_OPTIONS[currentIndex === 0 ? lastIndex : currentIndex - 1].kind,
      ArrowUp: VIEW_OPTIONS[currentIndex === 0 ? lastIndex : currentIndex - 1].kind,
      Home: VIEW_OPTIONS[0].kind,
      End: VIEW_OPTIONS[lastIndex].kind,
    }
    const nextView = nextViewByKey[event.key]

    if (!nextView) {
      return
    }

    event.preventDefault()
    selectView(nextView, true)
  }

  return (
    <main className="workspace-shell process-views-shell">
      <header className="workspace-header process-views-header" aria-labelledby="process-views-title">
        <div>
          <p className="eyebrow">Flowent / multi-role process views</p>
          <h1 id="process-views-title">See the same map through every process concern.</h1>
        </div>
        <dl className="process-state" aria-label="Current process status">
          <div>
            <dt>Status</dt>
            <dd>{sampleProcessMap.status}</dd>
          </div>
          <div>
            <dt>Process</dt>
            <dd>{sampleProcessMap.title}</dd>
          </div>
        </dl>
      </header>

      <section className="process-view-grid" aria-label="Multi-role process view workspace">
        <aside className="process-view-rail" aria-label="Available process views">
          <div>
            <p className="panel-label">Choose view</p>
            <h2 id="process-view-selector-title">Process lens</h2>
            <p id="process-view-selector-help">
              Switch between readiness, completeness, reviewability, and stakeholder involvement.
            </p>
          </div>
          <div
            className="process-view-options"
            role="tablist"
            aria-labelledby="process-view-selector-title"
            aria-describedby="process-view-selector-help"
          >
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.kind}
                id={`${option.kind}-view-tab`}
                className="process-view-button"
                type="button"
                role="tab"
                aria-selected={option.kind === selectedView}
                aria-controls={`${option.kind}-view-panel`}
                tabIndex={option.kind === selectedView ? 0 : -1}
                onClick={() => selectView(option.kind)}
                onKeyDown={(event) => handleViewKeyDown(event, option.kind)}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </aside>

        <ManagerViewPanel isActive={selectedView === 'manager'} />
        <ProcessOwnerPanel isActive={selectedView === 'process-owner'} />
        <QualityReviewPanel isActive={selectedView === 'quality-review'} />
        <StakeholderPanel isActive={selectedView === 'stakeholder'} />
      </section>
    </main>
  )
}

interface ProcessViewPanelProps {
  isActive: boolean
}

function ManagerViewPanel({ isActive }: ProcessViewPanelProps) {
  const view = deriveManagerView(sampleProcessMap)

  return (
    <section
      id="manager-view-panel"
      className="process-view-stage manager-view"
      role="tabpanel"
      aria-labelledby="manager-view-tab manager-view-title"
      hidden={!isActive}
    >
      <ViewHeader
        headingId="manager-view-title"
        eyebrow="Product / project manager"
        title="Manager readiness view"
        summary="A release-facing lens for checking whether the process is understandable enough to coordinate real work."
      />
      <ul className="readiness-ribbon" aria-label="Readiness signals" role="list">
        {view.readinessSignals.map((signal) => (
          <li key={signal}>
            <ClipboardCheck aria-hidden="true" />
            <span>{signal}</span>
          </li>
        ))}
      </ul>
      <div className="view-panel-grid">
        <NamedList title="Participating roles" items={view.participatingRoles} getLabel={(role) => role.name} />
        <NamedList title="Stakeholders" items={view.stakeholders} getLabel={(stakeholder) => stakeholder.name} />
        <section className="view-card timeline-card">
          <div>
            <Flag aria-hidden="true" />
            <h3>Start and end points</h3>
          </div>
          <ol role="list">
            <li>
              <strong>Start</strong>
              {view.startActivity.title}
            </li>
            <li>
              <strong>End</strong>
              {view.endActivity.title}
            </li>
          </ol>
        </section>
        <NamedList title="Visible handoffs" items={view.handoffs} getLabel={(handoff) => handoff.title} />
      </div>
    </section>
  )
}

function ProcessOwnerPanel({ isActive }: ProcessViewPanelProps) {
  const view = deriveProcessOwnerView(sampleProcessMap)

  return (
    <section
      id="process-owner-view-panel"
      className="process-view-stage owner-view"
      role="tabpanel"
      aria-labelledby="process-owner-view-tab owner-view-title"
      hidden={!isActive}
    >
      <ViewHeader
        headingId="owner-view-title"
        eyebrow="Process owner"
        title="Process owner completeness view"
        summary="A structure-first lens for finding missing owners, sources, recipients, criteria, and expectations."
      />
      <div className="view-panel-grid emphasis-grid">
        <StringList title="Completeness signals" items={view.completenessSignals} icon={<Layers3 aria-hidden="true" />} />
        <GapList gaps={view.gaps} />
      </div>
    </section>
  )
}

function QualityReviewPanel({ isActive }: ProcessViewPanelProps) {
  const view = deriveQualityReviewView(sampleProcessMap)

  return (
    <section
      id="quality-review-view-panel"
      className="process-view-stage quality-view"
      role="tabpanel"
      aria-labelledby="quality-review-view-tab quality-view-title"
      hidden={!isActive}
    >
      <ViewHeader
        headingId="quality-view-title"
        eyebrow="Quality / review"
        title="Quality review view"
        summary="A reviewability lens for seeing standards, evidence, decision rationale, and handoff checks."
      />
      <div className="view-panel-grid quality-grid">
        <NamedList title="Reviewable work products" items={view.reviewableWorkProducts} getLabel={(item) => item.title} />
        <NamedList title="Completion standards" items={view.completionStandards} getLabel={(expectation) => expectation.title} />
        <NamedList title="Decision rationale" items={view.decisionRationale} getLabel={(decision) => decision.title} />
        <NamedList title="Review handoffs" items={view.reviewHandoffs} getLabel={(handoff) => handoff.title} />
      </div>
    </section>
  )
}

function StakeholderPanel({ isActive }: ProcessViewPanelProps) {
  const view = deriveStakeholderView(sampleProcessMap, 'design-lead')

  return (
    <section
      id="stakeholder-view-panel"
      className="process-view-stage stakeholder-view"
      role="tabpanel"
      aria-labelledby="stakeholder-view-tab stakeholder-view-title"
      hidden={!isActive}
    >
      <ViewHeader
        headingId="stakeholder-view-title"
        eyebrow="Stakeholder"
        title="Stakeholder involvement view"
        summary="A participation lens for explaining why a stakeholder is consulted, informed, or affected."
      />
      <section className="stakeholder-hero" aria-label="Selected stakeholder">
        <UsersRound aria-hidden="true" />
        <div>
          <p>Selected stakeholder</p>
          <h3>{view.stakeholder.name}</h3>
        </div>
      </section>
      <div className="view-panel-grid">
        <StringList title="Involvement summary" items={view.involvementSummary} icon={<Eye aria-hidden="true" />} />
        <NamedList title="Consulted activities" items={view.consultedActivities} getLabel={(activity) => activity.title} />
        <NamedList
          title="Informed activities"
          items={view.informedActivities}
          getLabel={(activity) => activity.title}
          emptyMessage="No informed activities yet"
        />
        <NamedList title="Affected outputs" items={view.affectedOutputs} getLabel={(output) => output.title} />
        <NamedList
          title="Affected decisions"
          items={view.affectedDecisions}
          getLabel={(decision) => decision.title}
          emptyMessage="No affected decisions are mapped yet"
        />
      </div>
    </section>
  )
}

interface ViewHeaderProps {
  headingId: string
  eyebrow: string
  title: string
  summary: string
}

function ViewHeader({ headingId, eyebrow, title, summary }: ViewHeaderProps) {
  return (
    <header className="process-view-stage-header">
      <p className="panel-label">{eyebrow}</p>
      <h2 id={headingId}>{title}</h2>
      <p>{summary}</p>
    </header>
  )
}

interface NamedListProps<T> {
  title: string
  items: T[]
  getLabel: (item: T) => string
  emptyMessage?: string
}

function NamedList<T extends Activity | Actor | Decision | Expectation | Handoff | ProcessOutput | Role | WorkProduct>({
  title,
  items,
  getLabel,
  emptyMessage = 'No items yet',
}: NamedListProps<T>) {
  return (
    <section className="view-card">
      <div>
        <Route aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      {items.length > 0 ? (
        <ul role="list">
          {items.map((item) => (
            <li key={item.id}>{getLabel(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </section>
  )
}

interface StringListProps {
  title: string
  items: string[]
  icon: React.ReactNode
}

function StringList({ title, items, icon }: StringListProps) {
  return (
    <section className="view-card">
      <div>
        {icon}
        <h3>{title}</h3>
      </div>
      <ul role="list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

interface GapListProps {
  gaps: ProcessGap[]
}

function GapList({ gaps }: GapListProps) {
  return (
    <section className="view-card gap-card">
      <div>
        <ShieldCheck aria-hidden="true" />
        <h3>Completeness gaps</h3>
      </div>
      {gaps.length > 0 ? (
        <ul role="list">
          {gaps.map((gap) => (
            <li key={gap.id}>
              <strong>{gap.severity}</strong>
              {gap.title}
            </li>
          ))}
        </ul>
      ) : (
        <p>No structural gaps are visible in this map.</p>
      )}
    </section>
  )
}
