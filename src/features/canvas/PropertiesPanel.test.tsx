import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PropertiesPanel } from './PropertiesPanel'
import type { ProcessNode } from './canvasTypes'

function makeActivity(): ProcessNode {
  return {
    id: 'a1',
    type: 'activity',
    position: { x: 100, y: 100 },
    data: { title: 'Write spec', summary: 'Draft and review', roleIds: [], kind: 'activity' },
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
