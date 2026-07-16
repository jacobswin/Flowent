import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SharedProcessEditor } from './SharedProcessEditor'

describe('SharedProcessEditor', () => {
  it('adds shared Activities to a reusable Process and saves their placement', async () => {
    const onSave = vi.fn(async () => {})
    render(
      <SharedProcessEditor
        process={{ id: 'process-1', title: 'Review process', description: '', activities: [], decisions: [], stages: [], handoffs: [] }}
        activities={[{ id: 'activity-1', title: 'Review report', summary: '', expectations: '', responsibilities: [], workProductLinks: [] }]}
        onSave={onSave}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save process' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      activities: [expect.objectContaining({ activityId: 'activity-1' })],
    })))
  })
})
