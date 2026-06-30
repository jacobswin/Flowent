import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FocusBar } from './FocusBar'

describe('FocusBar', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('defaults collapsed and expands as a focus view panel', () => {
    render(<FocusBar focus={{ mode: 'all' }} roles={['PM']} onChange={() => {}} />)

    expect(screen.queryByRole('button', { name: /decision points/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand focus view/i }))

    expect(screen.getByRole('button', { name: /decision points/i })).toBeInTheDocument()
  })

  it('keeps the existing focus switching behavior', () => {
    const onChange = vi.fn()
    render(<FocusBar defaultCollapsed={false} focus={{ mode: 'all' }} roles={['PM']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /decision points/i }))
    fireEvent.click(screen.getByRole('button', { name: /handoff paths/i }))
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'PM' } })

    expect(onChange).toHaveBeenCalledWith({ mode: 'decisions' })
    expect(onChange).toHaveBeenCalledWith({ mode: 'handoffs' })
    expect(onChange).toHaveBeenCalledWith({ mode: 'role', role: 'PM' })
  })
})
