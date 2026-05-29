import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MultiRoleProcessViews } from './MultiRoleProcessViews'

describe('MultiRoleProcessViews', () => {
  it('shows the manager readiness view by default', () => {
    render(<MultiRoleProcessViews />)

    const panel = screen.getByRole('tabpanel', { name: /Manager readiness view/ })

    expect(panel).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: /Manager readiness view/ })).toBeInTheDocument()
    expect(within(panel).getByRole('list', { name: 'Readiness signals' })).toHaveTextContent('4 activities mapped')
    expect(within(panel).getByText('3 handoffs visible')).toBeInTheDocument()
    expect(within(panel).getByText('Product Manager')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Manager/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Process owner/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('lets users switch to the process owner completeness view', async () => {
    const user = userEvent.setup()

    render(<MultiRoleProcessViews />)
    await user.click(screen.getByRole('tab', { name: /Process owner/ }))

    const panel = screen.getByRole('tabpanel', { name: /Process owner completeness view/ })

    expect(panel).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: /Process owner completeness view/ })).toBeInTheDocument()
    expect(within(panel).getByText('Support release readiness review has no completion expectations')).toBeInTheDocument()
    expect(within(panel).getByText('Every activity has a responsible or accountable actor')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Process owner/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('supports keyboard navigation between process view tabs', async () => {
    const user = userEvent.setup()

    render(<MultiRoleProcessViews />)
    const managerTab = screen.getByRole('tab', { name: /Manager/ })
    managerTab.focus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: /Process owner/ })).toHaveFocus()
    expect(await screen.findByRole('tabpanel', { name: /Process owner completeness view/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Process owner/ })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')

    expect(screen.getByRole('tab', { name: /Stakeholder/ })).toHaveFocus()
    expect(await screen.findByRole('tabpanel', { name: /Stakeholder involvement view/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Stakeholder/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('lets users inspect quality and stakeholder concerns', async () => {
    const user = userEvent.setup()

    render(<MultiRoleProcessViews />)
    await user.click(screen.getByRole('tab', { name: /Quality review/ }))

    const qualityPanel = screen.getByRole('tabpanel', { name: /Quality review view/ })

    expect(qualityPanel).toBeInTheDocument()
    expect(within(qualityPanel).getByRole('heading', { name: /Quality review view/ })).toBeInTheDocument()
    expect(within(qualityPanel).getByText('Role navigation expectation note')).toBeInTheDocument()
    expect(within(qualityPanel).getByText('Is release risk acceptable?')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Stakeholder/ }))

    const stakeholderPanel = screen.getByRole('tabpanel', { name: /Stakeholder involvement view/ })

    expect(stakeholderPanel).toBeInTheDocument()
    expect(within(stakeholderPanel).getByRole('heading', { name: /Stakeholder involvement view/ })).toBeInTheDocument()
    expect(within(stakeholderPanel).getByText('Design Lead')).toBeInTheDocument()
    expect(within(stakeholderPanel).getByText('Consulted on 1 activity')).toBeInTheDocument()
    expect(within(stakeholderPanel).getByText('No informed activities yet')).toBeInTheDocument()
    expect(within(stakeholderPanel).getByText('Affected by 1 decision')).toBeInTheDocument()
    expect(within(stakeholderPanel).getByText('Is release risk acceptable?')).toBeInTheDocument()
    expect(within(stakeholderPanel).getByText('UI impact notes')).toBeInTheDocument()
  })
})
