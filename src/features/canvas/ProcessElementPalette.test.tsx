import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProcessElementPalette } from './ProcessElementPalette'

describe('ProcessElementPalette', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders process-specific elements', () => {
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    expect(screen.getByRole('button', { name: /stage/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decision/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bottleneck/i })).toBeInTheDocument()
  })

  it('quick-creates the selected element when clicked', () => {
    const onQuickCreate = vi.fn()
    render(<ProcessElementPalette onQuickCreate={onQuickCreate} />)

    fireEvent.click(screen.getByRole('button', { name: /activity/i }))

    expect(onQuickCreate).toHaveBeenCalledWith('activity')
  })

  it('stores the element type in the drag payload', () => {
    const setData = vi.fn()
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    fireEvent.dragStart(screen.getByRole('button', { name: /decision/i }), {
      dataTransfer: { setData, effectAllowed: '' },
    })

    expect(setData).toHaveBeenCalledWith('application/x-flowent-process-element', 'decision')
  })

  it('collapses and expands the floating elements panel', () => {
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /collapse elements/i }))

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand elements/i }))

    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
  })

  it('can be moved by dragging the panel title', () => {
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    const panel = screen.getByLabelText('Process element library')
    const title = screen.getByText('Elements')
    const initialLeft = Number.parseFloat(panel.style.left)
    const initialTop = Number.parseFloat(panel.style.top)

    fireEvent.pointerDown(title, { clientX: 900, clientY: 120, pointerId: 1, button: 0 })
    fireEvent.pointerMove(title, { clientX: 760, clientY: 190, pointerId: 1, button: 0 })
    fireEvent.pointerUp(title, { clientX: 760, clientY: 190, pointerId: 1, button: 0 })

    expect(Number.parseFloat(panel.style.left)).toBeLessThan(initialLeft)
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(initialTop)
  })
})
