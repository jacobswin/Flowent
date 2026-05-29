import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RoleNavigation } from './RoleNavigation'

describe('RoleNavigation', () => {
  it('shows the selected role navigation summary', () => {
    render(<RoleNavigation selectedRoleId="frontend-engineer" onRoleChange={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument()
    expect(screen.getByLabelText('Role navigation summary')).toHaveTextContent('Activities3')
    expect(screen.getByLabelText('Role navigation summary')).toHaveTextContent('Handoffs3')
    expect(screen.getByLabelText('Role navigation summary')).toHaveTextContent('Decisions2')
    expect(screen.getByText('Approved change request')).toBeInTheDocument()
    expect(screen.getByText('Updated role navigation screen')).toBeInTheDocument()
    expect(screen.getByText('Frontend hands build to QA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Frontend Engineer/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /QA Engineer/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets users switch to another role', async () => {
    const user = userEvent.setup()
    const onRoleChange = vi.fn()

    render(<RoleNavigation selectedRoleId="frontend-engineer" onRoleChange={onRoleChange} />)
    await user.click(screen.getByRole('button', { name: /QA Engineer/ }))

    expect(onRoleChange).toHaveBeenCalledWith('qa-engineer')
  })
})
