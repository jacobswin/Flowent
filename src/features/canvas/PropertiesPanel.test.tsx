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
    render(<PropertiesPanel node={makeStage()} edge={null} onUpdateNode={onUpdate} onClose={() => {}} />)

    const goal = screen.getByLabelText('Goal')
    fireEvent.change(goal, { target: { value: 'Align on validated direction' } })
    fireEvent.blur(goal)

    expect(onUpdate).toHaveBeenCalledWith('stage-1', { goal: 'Align on validated direction' })
  })

  it('edits bottleneck review status', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeBottleneck()} edge={null} onUpdateNode={onUpdate} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Review status'), { target: { value: 'needs-owner' } })

    expect(onUpdate).toHaveBeenCalledWith('bottleneck-1', { reviewStatus: 'needs-owner' })
  })

  it('edits activity expectations', () => {
    const onUpdate = vi.fn()
    render(<PropertiesPanel node={makeActivity()} edge={null} onUpdateNode={onUpdate} onClose={() => {}} />)

    const expectations = screen.getByLabelText('Expectations')
    fireEvent.change(expectations, { target: { value: 'Ready when scope and owner are clear' } })
    fireEvent.blur(expectations)

    expect(onUpdate).toHaveBeenCalledWith('a1', { expectations: 'Ready when scope and owner are clear' })
  })
})
