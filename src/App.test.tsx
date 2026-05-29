import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('supports keyboard navigation between prototype section tabs', async () => {
    const user = userEvent.setup()

    render(<App />)
    const roleNavigationTab = screen.getByRole('tab', { name: 'Role navigation' })
    roleNavigationTab.focus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Process views' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Process views' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Process views' })).toBeInTheDocument()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Scenario generation' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Scenario generation' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Scenario generation' })).toBeInTheDocument()

    await user.keyboard('{Home}')

    expect(screen.getByRole('tab', { name: 'Role navigation' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Role navigation' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')

    expect(screen.getByRole('tab', { name: 'Scenario generation' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Scenario generation' })).toHaveAttribute('aria-selected', 'true')
  })
})
