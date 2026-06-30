import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PropertiesPanel } from './PropertiesPanel'
import type { ProcessAssets, ProcessNode } from './canvasTypes'

function makeActivity(): ProcessNode {
  return {
    id: 'a1',
    type: 'activity',
    position: { x: 100, y: 100 },
    data: { title: 'Write spec', summary: 'Draft and review', roleIds: [], responsibilities: [], kind: 'activity' },
  }
}

function makeActivityWithId(id: string, title: string): ProcessNode {
  return {
    id,
    type: 'activity',
    position: { x: 100, y: 100 },
    data: { title, summary: '', roleIds: [], kind: 'activity' },
  }
}

function makeAssets(): ProcessAssets {
  return {
    workProducts: {
      'wp-1': {
        id: 'wp-1',
        title: 'Existing brief',
        state: 'Draft',
        description: '',
        producerNodeIds: [],
        consumerNodeIds: [],
        handoffEdgeIds: [],
        guidanceIds: [],
      },
    },
    guidanceItems: {
      'guide-1': {
        id: 'guide-1',
        title: 'Existing checklist',
        kind: 'checklist',
        description: '',
        url: '',
        appliesToNodeIds: [],
        appliesToEdgeIds: [],
        workProductIds: [],
      },
    },
    milestones: {},
  }
}

function makeLinkedAssets(): ProcessAssets {
  return {
    workProducts: {
      'wp-1': {
        id: 'wp-1',
        title: 'Existing brief',
        state: 'Draft',
        description: '',
        producerNodeIds: [],
        consumerNodeIds: [],
        handoffEdgeIds: ['edge-1'],
        guidanceIds: ['guide-1'],
      },
    },
    guidanceItems: {
      'guide-1': {
        id: 'guide-1',
        title: 'Existing checklist',
        kind: 'checklist',
        description: '',
        url: '',
        appliesToNodeIds: ['a1'],
        appliesToEdgeIds: [],
        workProductIds: ['wp-1'],
      },
    },
    milestones: {
      'ms-1': {
        id: 'ms-1',
        title: 'Discovery exit',
        description: '',
        stageNodeId: 'stage-1',
        workProductStates: [{ workProductId: 'wp-1', state: 'Approved' }],
      },
    },
  }
}

function makeStart(): ProcessNode {
  return {
    id: 'start',
    type: 'startEnd',
    position: { x: 100, y: 100 },
    data: { label: 'Start', kind: 'start' },
  }
}

function makeStage(): ProcessNode {
  return {
    id: 'stage-1',
    type: 'stage',
    position: { x: 100, y: 100 },
    data: {
      kind: 'stage',
      title: 'Discovery',
      goal: 'Validate the problem',
      entryCondition: 'Opportunity is selected',
      exitCondition: 'Decision is made',
      owner: 'PM',
    },
  }
}

function makeBottleneck(): ProcessNode {
  return {
    id: 'bottleneck-1',
    type: 'bottleneck',
    position: { x: 100, y: 100 },
    data: {
      kind: 'bottleneck',
      title: 'Waiting for review',
      symptom: 'Work pauses before design approval',
      impact: 'Delivery waits',
      suspectedCause: 'Owner is unclear',
      reviewStatus: 'unclear',
    },
  }
}

describe('PropertiesPanel — semantic editors', () => {
  it('edits stage process semantics', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeStage()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

    const goal = screen.getByLabelText('Goal')
    fireEvent.change(goal, { target: { value: 'Align on validated direction' } })
    fireEvent.blur(goal)

    expect(onUpdate).toHaveBeenCalledWith('stage-1', { goal: 'Align on validated direction' })
  })

  it('edits bottleneck review status', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeBottleneck()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Review status'), { target: { value: 'needs-owner' } })

    expect(onUpdate).toHaveBeenCalledWith('bottleneck-1', { reviewStatus: 'needs-owner' })
  })

  it('edits activity expectations', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeActivity()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

    const expectations = screen.getByLabelText('Expectations')
    fireEvent.change(expectations, { target: { value: 'Ready when scope and owner are clear' } })
    fireEvent.blur(expectations)

    expect(onUpdate).toHaveBeenCalledWith('a1', { expectations: 'Ready when scope and owner are clear' })
  })

  it('commits the current activity title value on blur even before draft state catches up', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeActivity()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

    const title = screen.getByLabelText('Title') as HTMLInputElement
    title.value = 'Customer onboarding'
    fireEvent.blur(title)

    expect(onUpdate).toHaveBeenCalledWith('a1', { title: 'Customer onboarding' })
  })

  it('adds the current role input value on Enter even before draft state catches up', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeActivity()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

    const role = screen.getByLabelText('Add role') as HTMLInputElement
    role.value = 'Engineer'
    fireEvent.keyDown(role, { key: 'Enter' })

    expect(onUpdate).toHaveBeenCalledWith('a1', { roleIds: ['Engineer'] })
  })

  it('adds a RASIC responsibility from the activity editor', () => {
    const onAddResponsibility = vi.fn()
    render(
      <PropertiesPanel
        node={makeActivity()}
        edge={null}
        processAssets={makeAssets()}
        assetActions={{ addResponsibility: onAddResponsibility }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Responsibility kind'), { target: { value: 'accountable' } })
    const role = screen.getByLabelText('Responsibility role') as HTMLInputElement
    role.value = 'QA'
    fireEvent.click(screen.getByRole('button', { name: 'Add responsibility' }))

    expect(onAddResponsibility).toHaveBeenCalledWith('a1', {
      roleName: 'QA',
      kind: 'accountable',
    })
  })

  it('creates an input work product from the activity editor', () => {
    const onCreateWorkProductForActivity = vi.fn()
    render(
      <PropertiesPanel
        node={makeActivity()}
        edge={null}
        processAssets={makeAssets()}
        assetActions={{ createWorkProductForActivity: onCreateWorkProductForActivity }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    const input = screen.getByLabelText('New input work product') as HTMLInputElement
    input.value = 'Problem brief'
    fireEvent.change(screen.getByLabelText('New input maturity'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add input work product' }))

    expect(onCreateWorkProductForActivity).toHaveBeenCalledWith('a1', 'input', 'Problem brief', 'Draft')
  })

  it('blocks linking the same work product and maturity as both input and output for an activity', () => {
    const onLinkWorkProductToActivity = vi.fn()
    render(
      <PropertiesPanel
        node={makeActivity()}
        edge={null}
        processAssets={{
          ...makeAssets(),
          workProducts: {
            'wp-1': {
              ...makeAssets().workProducts['wp-1'],
              consumerNodeIds: ['a1'],
              activityLinks: [{ id: 'link-1', nodeId: 'a1', relation: 'input', maturity: 'Draft' }],
            },
          },
        }}
        assetActions={{ linkWorkProductToActivity: onLinkWorkProductToActivity }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Existing output work product'), { target: { value: 'wp-1' } })
    expect(screen.getByText('Same maturity cannot be both input and output for this activity. Choose another maturity or unlink first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link output work product' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Existing output maturity'), { target: { value: 'Approved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link output work product' }))

    expect(onLinkWorkProductToActivity).toHaveBeenCalledWith('a1', 'output', 'wp-1', 'Approved')
  })

  it('creates a guidance item from the activity editor', () => {
    const onCreateGuidanceForActivity = vi.fn()
    render(
      <PropertiesPanel
        node={makeActivity()}
        edge={null}
        processAssets={makeAssets()}
        assetActions={{ createGuidanceForActivity: onCreateGuidanceForActivity }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    const guidance = screen.getByLabelText('New guidance') as HTMLInputElement
    guidance.value = 'Review checklist'
    fireEvent.click(screen.getByRole('button', { name: 'Add guidance' }))

    expect(onCreateGuidanceForActivity).toHaveBeenCalledWith('a1', {
      title: 'Review checklist',
      kind: 'checklist',
    })
  })

  it('links activity guidance to a work product from the activity editor', () => {
    const onLinkGuidanceToWorkProduct = vi.fn()
    render(
      <PropertiesPanel
        node={makeActivity()}
        edge={null}
        processAssets={makeLinkedAssets()}
        assetActions={{ linkGuidanceToWorkProduct: onLinkGuidanceToWorkProduct }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Work product for Existing checklist'), { target: { value: 'wp-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link guidance work product' }))

    expect(onLinkGuidanceToWorkProduct).toHaveBeenCalledWith('guide-1', 'wp-1')
  })

  it('edits handoff expectation from the edge panel', () => {
    const onUpdateEdge = vi.fn()
    render(
      <PropertiesPanel
        node={null}
        edge={{
          id: 'edge-1',
          type: 'handoff',
          source: 'a',
          target: 'b',
          data: {
            label: '',
            fromRole: 'PM',
            toRole: 'Engineer',
            artifact: 'Ready brief',
            expectation: '',
            readinessSignal: '',
            reviewStatus: 'unclear',
          },
        }}
        onUpdateNode={() => {}}
        onUpdateEdge={onUpdateEdge}
        onClose={() => {}}
      />,
    )

    const expectation = screen.getByLabelText('Handoff expectation')
    fireEvent.change(expectation, { target: { value: 'Ready work includes context and acceptance expectations.' } })
    fireEvent.blur(expectation)

    expect(onUpdateEdge).toHaveBeenCalledWith('edge-1', {
      expectation: 'Ready work includes context and acceptance expectations.',
    })
  })

  it('creates a moved work product from the handoff editor', () => {
    const onCreateWorkProductForHandoff = vi.fn()
    render(
      <PropertiesPanel
        node={null}
        edge={{
          id: 'edge-1',
          type: 'handoff',
          source: 'a',
          target: 'b',
          data: { label: '' },
        }}
        processAssets={makeAssets()}
        assetActions={{ createWorkProductForHandoff: onCreateWorkProductForHandoff }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    const moved = screen.getByLabelText('New moved work product') as HTMLInputElement
    moved.value = 'Ready brief'
    fireEvent.click(screen.getByRole('button', { name: 'Add moved work product' }))

    expect(onCreateWorkProductForHandoff).toHaveBeenCalledWith('edge-1', 'Ready brief')
  })

  it('unlinks a moved work product from the handoff editor', () => {
    const onUnlinkWorkProductFromHandoff = vi.fn()
    render(
      <PropertiesPanel
        node={null}
        edge={{
          id: 'edge-1',
          type: 'handoff',
          source: 'a',
          target: 'b',
          data: { label: '' },
        }}
        processAssets={makeLinkedAssets()}
        assetActions={{ unlinkWorkProductFromHandoff: onUnlinkWorkProductFromHandoff }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /unlink existing brief/i }))

    expect(onUnlinkWorkProductFromHandoff).toHaveBeenCalledWith('wp-1', 'edge-1')
  })

  it('edits handoff color from the edge panel', () => {
    const onUpdateEdge = vi.fn()
    render(
      <PropertiesPanel
        node={null}
        edge={{
          id: 'edge-1',
          type: 'handoff',
          source: 'a',
          target: 'b',
          data: { label: '', color: '#111827' },
        }}
        onUpdateNode={() => {}}
        onUpdateEdge={onUpdateEdge}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /set connection color red/i }))

    expect(onUpdateEdge).toHaveBeenCalledWith('edge-1', { color: '#dc2626' })
  })

  it('creates a milestone from the stage editor', () => {
    const onCreateMilestoneForStage = vi.fn()
    render(
      <PropertiesPanel
        node={makeStage()}
        edge={null}
        processAssets={makeAssets()}
        assetActions={{ createMilestoneForStage: onCreateMilestoneForStage }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    const milestone = screen.getByLabelText('New milestone') as HTMLInputElement
    milestone.value = 'Discovery exit'
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))

    expect(onCreateMilestoneForStage).toHaveBeenCalledWith('stage-1', 'Discovery exit')
  })

  it('removes a milestone work product state from the stage editor', () => {
    const onRemoveMilestoneWorkProductState = vi.fn()
    render(
      <PropertiesPanel
        node={makeStage()}
        edge={null}
        processAssets={makeLinkedAssets()}
        assetActions={{ removeMilestoneWorkProductState: onRemoveMilestoneWorkProductState }}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /remove maturity existing brief/i }))

    expect(onRemoveMilestoneWorkProductState).toHaveBeenCalledWith('ms-1', 'wp-1')
  })

  it('reroutes a handoff target from the edge panel', () => {
    const onUpdateEdge = vi.fn()
    render(
      <PropertiesPanel
        node={null}
        edge={{
          id: 'edge-1',
          type: 'handoff',
          source: 'start',
          target: 'a1',
          sourceHandle: 'out',
          targetHandle: 'in',
          data: { label: '' },
        }}
        nodes={[
          makeStart(),
          makeActivityWithId('a1', 'Wrong activity'),
          makeActivityWithId('a2', 'Correct activity'),
        ]}
        onUpdateNode={() => {}}
        onUpdateEdge={onUpdateEdge}
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('To node'), { target: { value: 'a2' } })

    expect(onUpdateEdge).toHaveBeenCalledWith('edge-1', {
      targetNodeId: 'a2',
      targetPortId: 'in',
    })
  })

  it('deletes a selected handoff from the edge panel', () => {
    const onDeleteEdge = vi.fn()
    render(
      <PropertiesPanel
        node={null}
        edge={{
          id: 'edge-1',
          type: 'handoff',
          source: 'start',
          target: 'a1',
          sourceHandle: 'out',
          targetHandle: 'in',
          data: { label: '' },
        }}
        nodes={[makeStart(), makeActivityWithId('a1', 'Activity')]}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onDeleteEdge={onDeleteEdge}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete connector' }))

    expect(onDeleteEdge).toHaveBeenCalledTimes(1)
  })

  it('submits all three activity fields on form submit so the panel does not silently drop expectations', () => {
    const onUpdate = vi.fn()
    const { container } = render(
      <PropertiesPanel
        node={{
          id: 'a1',
          type: 'activity',
          position: { x: 100, y: 100 },
          data: {
            kind: 'activity',
            title: 'Write spec',
            summary: 'Draft and review',
            roleIds: ['PM', 'Designer'],
            expectations: '',
          },
        }}
        edge={null}
        onUpdateNode={onUpdate}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    const title = screen.getByLabelText('Title')
    fireEvent.change(title, { target: { value: 'Write spec v2' } })
    const expectations = screen.getByLabelText('Expectations')
    fireEvent.change(expectations, { target: { value: 'Ready when scope is clear' } })

    // Submitting the form (which the user does by pressing Enter on a
    // single-line input) must persist all three fields.
    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    expect(onUpdate).toHaveBeenCalledWith('a1', {
      title: 'Write spec v2',
      summary: 'Draft and review',
      expectations: 'Ready when scope is clear',
    })
  })

  it('renders the bottleneck review status as a human label, not the raw enum', () => {
    render(
      <PropertiesPanel
        node={{
          id: 'b1',
          type: 'bottleneck',
          position: { x: 100, y: 100 },
          data: {
            kind: 'bottleneck',
            title: 'Waiting for review',
            symptom: '',
            impact: '',
            suspectedCause: '',
            reviewStatus: 'needs-owner',
          },
        }}
        edge={null}
        onUpdateNode={() => {}}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />,
    )

    const select = screen.getByLabelText('Review status') as HTMLSelectElement
    // The <select> value is the enum string; the option text is the label.
    expect(select.value).toBe('needs-owner')
    const ownerOption = screen.getByRole('option', { name: 'Needs owner' }) as HTMLOptionElement
    expect(ownerOption.value).toBe('needs-owner')
    expect(ownerOption.selected).toBe(true)
  })
})
