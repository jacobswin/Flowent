import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SharedElementsPanel } from './SharedElementsPanel'
import { createEmptySharedElementLibrary } from './sharedElements'

describe('SharedElementsPanel', () => {
  it('creates a shared role from the Elements library', () => {
    const onCreate = vi.fn()
    render(
      <SharedElementsPanel
        elementLibrary={createEmptySharedElementLibrary()}
        onCreate={onCreate}
        onUpdate={() => {}}
        onDelete={() => Promise.resolve()}
        onOpenProcess={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }))
    fireEvent.click(screen.getByRole('button', { name: 'New role' }))
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'DRE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }))

    expect(onCreate).toHaveBeenCalledWith('role', { name: 'DRE', description: '' })
  })

  it('opens a reusable process in its dedicated editor', () => {
    const onOpenProcess = vi.fn()
    render(
      <SharedElementsPanel
        elementLibrary={{
          ...createEmptySharedElementLibrary(),
          processes: {
            'process-release': { id: 'process-release', title: 'Release readiness', description: '', activities: [], decisions: [], stages: [], handoffs: [] },
          },
        }}
        onCreate={() => {}}
        onUpdate={() => {}}
        onDelete={() => Promise.resolve()}
        onOpenProcess={onOpenProcess}
      />,
    )

    fireEvent.click(screen.getByText('Release readiness'))
    fireEvent.click(screen.getByRole('button', { name: 'Open process editor' }))

    expect(onOpenProcess).toHaveBeenCalledWith('process-release')
  })

  it('saves a shared Activity with Role-backed RASIC and Work Product links', async () => {
    const onUpdate = vi.fn()
    const onEnsureRoles = vi.fn(async () => ({ dre: 'role-dre' }))
    render(
      <SharedElementsPanel
        elementLibrary={{
          ...createEmptySharedElementLibrary(),
          roles: { 'role-dre': { id: 'role-dre', name: 'DRE', description: '' } },
          workProducts: { 'wp-report': { id: 'wp-report', title: 'Report', state: 'Draft', description: '' } },
          activities: { 'activity-review': { id: 'activity-review', title: 'Review', summary: '', expectations: '', responsibilities: [], workProductLinks: [] } },
        }}
        onCreate={() => {}}
        onUpdate={onUpdate}
        onDelete={() => Promise.resolve()}
        onOpenProcess={() => {}}
        onEnsureRoles={onEnsureRoles}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Activities' }))
    fireEvent.click(screen.getByText('Review'))
    fireEvent.change(screen.getByLabelText('Responsible'), { target: { value: 'DRE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save shared activity' }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('activity', 'activity-review', expect.objectContaining({
      responsibilities: [expect.objectContaining({ roleId: 'role-dre', kind: 'responsible' })],
    })))
  })
})
