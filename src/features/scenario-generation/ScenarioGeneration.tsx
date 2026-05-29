import { useState, type FormEvent, type ReactNode } from 'react'
import { ProcessMapWorkspace } from '../process-map/ProcessMapWorkspace'
import { parseScenarioLines, validateScenarioInput } from './scenarioInputValidation'
import { requestScenarioDraft as defaultRequestScenarioDraft } from './scenarioDraftApi'
import type {
  GeneratedMapFinding,
  GeneratedSource,
  ScenarioDraft,
  ScenarioDraftApiResponse,
  ScenarioInput,
  ScenarioInputValidationError,
} from './types'

interface ScenarioGenerationProps {
  requestDraft?: (input: ScenarioInput) => Promise<ScenarioDraftApiResponse>
}

interface ScenarioFormState {
  scenario: string
  problemGoal: string
  trigger: string
  roles: string
  stakeholders: string
  upstreamActors: string
  downstreamActors: string
  inputs: string
  outputs: string
  activities: string
  decisions: string
}

const EMPTY_FORM_STATE: ScenarioFormState = {
  scenario: '',
  problemGoal: '',
  trigger: '',
  roles: '',
  stakeholders: '',
  upstreamActors: '',
  downstreamActors: '',
  inputs: '',
  outputs: '',
  activities: '',
  decisions: '',
}

const SOURCE_LABELS: Record<GeneratedSource, string> = {
  'user-provided': 'User provided',
  'model-inferred': 'Model inferred',
  'system-derived': 'System derived',
}

const FINDING_LABELS: Record<GeneratedMapFinding['kind'], string> = {
  'missing-information': 'Missing information',
  assumption: 'Assumption',
  'risk-point': 'Risk point',
  'required-confirmation': 'Required confirmation',
}

export function ScenarioGeneration({ requestDraft = defaultRequestScenarioDraft }: ScenarioGenerationProps) {
  const [formState, setFormState] = useState<ScenarioFormState>(EMPTY_FORM_STATE)
  const [validationErrors, setValidationErrors] = useState<ScenarioInputValidationError[]>([])
  const [draft, setDraft] = useState<ScenarioDraft | null>(null)
  const [refineInWorkspace, setRefineInWorkspace] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const input = buildScenarioInput(formState)
    const validationResult = validateScenarioInput(input)

    if (!validationResult.success) {
      setValidationErrors(validationResult.errors)
      setError(null)
      return
    }

    setValidationErrors([])
    setError(null)
    setIsGenerating(true)

    const response = await requestDraft(validationResult.data)

    if (response.success) {
      setDraft(response.data)
    } else {
      setError(response.error)
    }

    setIsGenerating(false)
  }

  function updateField(field: keyof ScenarioFormState, value: string): void {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  return (
    <main className="scenario-generation-shell" aria-labelledby="scenario-generation-title">
      <section className="scenario-generation-hero">
        <p className="panel-label">Scenario to map</p>
        <h1 id="scenario-generation-title">Generate a draft process map</h1>
        <p>
          Give Flowent the working context from an R&D discussion. Claude will help shape a first draft for
          everyone to inspect, challenge, and refine before any consensus or activation step.
        </p>
        <p className="scenario-disclosure">
          Scenario details are sent to Claude for draft generation. Do not include secrets, credentials, or sensitive
          customer data.
        </p>
      </section>

      <form className="scenario-form" onSubmit={handleSubmit}>
        <ScenarioTextarea
          label="Work scenario"
          value={formState.scenario}
          onChange={(value) => updateField('scenario', value)}
          help="What is the work moving through the process?"
        />
        <ScenarioTextarea
          label="Problem or goal"
          value={formState.problemGoal}
          onChange={(value) => updateField('problemGoal', value)}
          help="What alignment problem or improvement goal should the map solve?"
        />
        <ScenarioTextarea
          label="Trigger"
          value={formState.trigger}
          onChange={(value) => updateField('trigger', value)}
          help="What starts this process?"
        />
        <ScenarioTextarea label="Roles" value={formState.roles} onChange={(value) => updateField('roles', value)} />
        <ScenarioTextarea
          label="Stakeholders"
          value={formState.stakeholders}
          onChange={(value) => updateField('stakeholders', value)}
        />
        <ScenarioTextarea
          label="Upstream actors"
          value={formState.upstreamActors}
          onChange={(value) => updateField('upstreamActors', value)}
        />
        <ScenarioTextarea
          label="Downstream actors"
          value={formState.downstreamActors}
          onChange={(value) => updateField('downstreamActors', value)}
        />
        <ScenarioTextarea
          label="Known inputs"
          value={formState.inputs}
          onChange={(value) => updateField('inputs', value)}
        />
        <ScenarioTextarea
          label="Expected outputs"
          value={formState.outputs}
          onChange={(value) => updateField('outputs', value)}
        />
        <ScenarioTextarea
          label="Known activities"
          value={formState.activities}
          onChange={(value) => updateField('activities', value)}
        />
        <ScenarioTextarea
          label="Known decisions"
          value={formState.decisions}
          onChange={(value) => updateField('decisions', value)}
        />

        {validationErrors.length > 0 && (
          <div className="scenario-validation" role="alert">
            <p>Flowent needs a little more structure before asking Claude for a draft.</p>
            <ul role="list">
              {validationErrors.map((validationError) => (
                <li key={`${validationError.field}-${validationError.message}`}>{validationError.message}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="scenario-validation" role="alert">
            {error}
          </div>
        )}

        <button className="scenario-generate-button" type="submit" disabled={isGenerating}>
          Generate draft map
        </button>
        {isGenerating && <p className="scenario-loading">Generating draft map with Claude…</p>}
      </form>

      {draft && refineInWorkspace && (
        <ProcessMapWorkspace initialMap={draft.processMap} initialSources={draft.sourcesById} />
      )}

      {draft && !refineInWorkspace && (
        <>
          <ScenarioDraftReview draft={draft} />
          <div className="scenario-refine-actions">
            <button type="button" className="scenario-refine-button" onClick={() => setRefineInWorkspace(true)}>
              Refine in workspace
            </button>
          </div>
        </>
      )}
    </main>
  )
}

interface ScenarioTextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  help?: string
}

function ScenarioTextarea({ label, value, onChange, help }: ScenarioTextareaProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const helpId = `${id}-help`

  return (
    <div className="scenario-field">
      <label htmlFor={id}>{label}</label>
      {help && <small id={helpId}>{help}</small>}
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        aria-describedby={help ? helpId : undefined}
      />
    </div>
  )
}

interface ScenarioDraftReviewProps {
  draft: ScenarioDraft
}

function ScenarioDraftReview({ draft }: ScenarioDraftReviewProps) {
  return (
    <section className="scenario-draft-review" role="region" aria-label="Generated draft review">
      <div className="scenario-draft-heading">
        <p className="draft-badge">Draft for discussion</p>
        <h2>{draft.processMap.title}</h2>
        <p>{draft.processMap.scenario}</p>
      </div>

      <div className="scenario-review-grid">
        <ReviewCard title="Candidate activity sequence">
          <ol role="list">
            {draft.processMap.activities.map((activity) => (
              <li key={activity.id}>
                <strong>{activity.title}</strong>
                <span>{activity.summary}</span>
                <SourcePill source={draft.sourcesById[activity.id]} />
              </li>
            ))}
          </ol>
        </ReviewCard>

        <ReviewCard title="Inferred handoffs">
          <ul role="list">
            {draft.processMap.handoffs.map((handoff) => (
              <li key={handoff.id}>
                {handoff.title}
                <SourcePill source={draft.sourcesById[handoff.id]} />
              </li>
            ))}
          </ul>
        </ReviewCard>

        <ReviewCard title="Decisions and criteria">
          <ul role="list">
            {draft.processMap.decisions.map((decision) => (
              <li key={decision.id}>
                <strong>{decision.title}</strong>
                <span>{decision.criteria}</span>
              </li>
            ))}
          </ul>
        </ReviewCard>

        <ReviewCard title="Completion expectations">
          <ul role="list">
            {draft.processMap.expectations.map((expectation) => (
              <li key={expectation.id}>
                <strong>{expectation.title}</strong>
                <span>{expectation.detail}</span>
              </li>
            ))}
          </ul>
        </ReviewCard>

        <ReviewCard title="Findings to discuss">
          <ul role="list">
            {draft.findings.map((finding) => (
              <li key={`${finding.kind}-${finding.message}`}>
                <strong>{FINDING_LABELS[finding.kind]}</strong>
                <span>{finding.message}</span>
              </li>
            ))}
          </ul>
        </ReviewCard>
      </div>
    </section>
  )
}

interface ReviewCardProps {
  title: string
  children: ReactNode
}

function ReviewCard({ title, children }: ReviewCardProps) {
  return (
    <article className="scenario-review-card">
      <h3>{title}</h3>
      {children}
    </article>
  )
}

interface SourcePillProps {
  source: GeneratedSource | undefined
}

function SourcePill({ source }: SourcePillProps) {
  if (!source) {
    return null
  }

  return <span className="source-pill">{SOURCE_LABELS[source]}</span>
}

function buildScenarioInput(formState: ScenarioFormState): ScenarioInput {
  return {
    scenario: formState.scenario,
    problemGoal: formState.problemGoal,
    trigger: formState.trigger,
    roles: parseScenarioLines(formState.roles),
    stakeholders: parseScenarioLines(formState.stakeholders),
    upstreamActors: parseScenarioLines(formState.upstreamActors),
    downstreamActors: parseScenarioLines(formState.downstreamActors),
    inputs: parseScenarioLines(formState.inputs),
    outputs: parseScenarioLines(formState.outputs),
    activities: parseScenarioLines(formState.activities),
    decisions: parseScenarioLines(formState.decisions),
  }
}
