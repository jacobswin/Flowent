import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProcessElementPalette } from './ProcessElementPalette'

describe('ProcessElementPalette', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders process-specific elements', () => {
    render(<ProcessElementPalette defaultCollapsed={false} onQuickCreate={() => {}} />)

    expect(screen.getByRole('button', { name: /stage/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decision/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bottleneck/i })).toBeInTheDocument()
  })

  it('quick-creates the selected element when clicked', () => {
    const onQuickCreate = vi.fn()
    render(<ProcessElementPalette defaultCollapsed={false} onQuickCreate={onQuickCreate} />)

    fireEvent.click(screen.getByRole('button', { name: /activity/i }))

    expect(onQuickCreate).toHaveBeenCalledWith('activity')
  })

  it('stores the element type in the drag payload', () => {
    const setData = vi.fn()
    render(<ProcessElementPalette defaultCollapsed={false} onQuickCreate={() => {}} />)

    fireEvent.dragStart(screen.getByRole('button', { name: /decision/i }), {
      dataTransfer: { setData, effectAllowed: '' },
    })

    expect(setData).toHaveBeenCalledWith('application/x-flowent-process-element', 'decision')
  })

  it('defaults collapsed and expands from the top dock title', () => {
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand elements/i }))

    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /collapse elements/i }))

    expect(screen.queryByRole('button', { name: /activity/i })).not.toBeInTheDocument()
  })

  it('uses a fixed top dock panel instead of draggable coordinates', () => {
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    const panel = screen.getByLabelText('Process element library')

    expect(panel).toHaveClass('top-dock-panel')
    expect(panel.style.left).toBe('')
    expect(panel.style.top).toBe('')
    expect(panel.style.getPropertyValue('--top-dock-width')).toBe('260px')
  })
})
