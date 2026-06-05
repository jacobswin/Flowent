import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProcessElementPalette } from './ProcessElementPalette'

describe('ProcessElementPalette', () => {
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
})
