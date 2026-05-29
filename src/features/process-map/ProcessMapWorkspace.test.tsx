import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProcessMapWorkspace } from './ProcessMapWorkspace'
import type { ProcessMap } from './types'

const sampleMap: ProcessMap = {
  id: 'test-map',
  title: 'Role navigation improvement draft',
  status: 'draft',
  scenario: 'Customer feedback needs to become a release-ready navigation improvement.',
  roles: [{ id: 'pm', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' }],
  stakeholders: [{ id: 'design-lead', name: 'Design Lead', kind: 'stakeholder' }],
  upstreamActors: [],
  downstreamActors: [],
  inputs: [{ id: 'req', title: 'Change request', sourceActorIds: [] }],
  outputs: [{ id: 'update', title: 'Feature update', producerActorIds: ['pm'], recipientActorIds: [] }],
  workProducts: [],
  expectations: [],
  decisions: [
    { id: 'ready', title: 'Is release risk acceptable?', affectedActorIds: ['pm'], criteria: 'Risk has owner.' },
  ],
  handoffs: [],
  activities: [
    {
      id: 'plan',
      title: 'Plan work',
      summary: 'PM plans the work.',
      responsibilities: [{ actorId: 'pm', kind: 'responsible' }],
      inputIds: ['req'],
      outputIds: ['update'],
      decisionIds: ['ready'],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    },
  ],
}

describe('ProcessMapWorkspace', () => {
  it('renders the workspace with map title and scenario', () => {
    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{ plan: 'model-inferred' }} />)

    expect(screen.getByRole('heading', { name: 'Role navigation improvement draft' })).toBeInTheDocument()
    expect(screen.getByText(/Customer feedback/)).toBeInTheDocument()
  })

  it('shows source labels on activities', () => {
    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{ plan: 'model-inferred' }} />)

    const activitiesPanel = screen.getByRole('region', { name: 'Activities' })

    expect(within(activitiesPanel).getByText('Model inferred')).toBeInTheDocument()
  })

  it('allows editing an activity title', async () => {
    const user = userEvent.setup()

    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{ plan: 'model-inferred' }} />)

    const activitiesPanel = screen.getByRole('region', { name: 'Activities' })
    const editButton = within(activitiesPanel).getByRole('button', { name: /Edit.*Plan work/ })

    await user.click(editButton)

    const titleInput = within(activitiesPanel).getByLabelText('Activity title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Plan the work carefully')

    const saveButton = within(activitiesPanel).getByRole('button', { name: 'Save' })
    await user.click(saveButton)

    expect(within(activitiesPanel).getByText('Plan the work carefully')).toBeInTheDocument()
    expect(within(activitiesPanel).getByText('User provided')).toBeInTheDocument()
  })

  it('allows adding a new activity', async () => {
    const user = userEvent.setup()

    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{}} />)

    const activitiesPanel = screen.getByRole('region', { name: 'Activities' })
    const addButton = within(activitiesPanel).getByRole('button', { name: 'Add activity' })

    await user.click(addButton)

    const titleInput = within(activitiesPanel).getByLabelText('Activity title')
    await user.type(titleInput, 'Validate release')

    const summaryInput = within(activitiesPanel).getByLabelText('Activity summary')
    await user.type(summaryInput, 'QA validates the release.')

    const saveButton = within(activitiesPanel).getByRole('button', { name: 'Save' })
    await user.click(saveButton)

    expect(within(activitiesPanel).getByText('Validate release')).toBeInTheDocument()
  })

  it('allows removing an activity', async () => {
    const user = userEvent.setup()

    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{ plan: 'model-inferred' }} />)

    const activitiesPanel = screen.getByRole('region', { name: 'Activities' })
    const removeButton = within(activitiesPanel).getByRole('button', { name: /Remove.*Plan work/ })

    await user.click(removeButton)

    expect(within(activitiesPanel).queryByText('Plan work')).not.toBeInTheDocument()
  })

  it('supports undo and redo', async () => {
    const user = userEvent.setup()

    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{}} />)

    const titleEditButton = screen.getByRole('button', { name: /Edit title/ })
    await user.click(titleEditButton)

    const titleInput = screen.getByLabelText('Map title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Changed title')

    const saveTitleButton = screen.getByRole('button', { name: 'Save title' })
    await user.click(saveTitleButton)

    expect(screen.getByRole('heading', { name: 'Changed title' })).toBeInTheDocument()

    const undoButton = screen.getByRole('button', { name: 'Undo' })
    await user.click(undoButton)

    expect(screen.getByRole('heading', { name: 'Role navigation improvement draft' })).toBeInTheDocument()

    const redoButton = screen.getByRole('button', { name: 'Redo' })
    await user.click(redoButton)

    expect(screen.getByRole('heading', { name: 'Changed title' })).toBeInTheDocument()
  })

  it('shows readiness status', () => {
    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{}} />)

    expect(screen.getByText(/Ready for discussion/)).toBeInTheDocument()
  })

  it('shows not ready when activities are removed', async () => {
    const user = userEvent.setup()

    render(<ProcessMapWorkspace initialMap={sampleMap} initialSources={{}} />)

    const activitiesPanel = screen.getByRole('region', { name: 'Activities' })
    const removeButton = within(activitiesPanel).getByRole('button', { name: /Remove.*Plan work/ })

    await user.click(removeButton)

    expect(screen.getByText(/Not ready/)).toBeInTheDocument()
    expect(screen.getByText(/Add at least one activity/)).toBeInTheDocument()
  })
})
