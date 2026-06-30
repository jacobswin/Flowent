import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

function renderToolbar(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const props: Parameters<typeof Toolbar>[0] = {
    onRemove: vi.fn(),
    onAutoLayout: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onExport: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    canUndo: true,
    canRedo: true,
    hasSelection: false,
    zoomPercent: 100,
    ...overrides,
  }
  render(<Toolbar {...props} />)
  return props
}

describe('Toolbar', () => {
  it('does not expose a visible connect button', () => {
    renderToolbar()

    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument()
  })

  it('calls zoom actions from the main toolbar', () => {
    const props = renderToolbar({ zoomPercent: 125 })
    const toolbar = screen.getByRole('toolbar', { name: /canvas tools/i })

    fireEvent.click(within(toolbar).getByRole('button', { name: /zoom out/i }))
    fireEvent.click(within(toolbar).getByRole('button', { name: /125%/i }))
    fireEvent.click(within(toolbar).getByRole('button', { name: /zoom in/i }))

    expect(props.onZoomOut).toHaveBeenCalledTimes(1)
    expect(props.onZoomReset).toHaveBeenCalledTimes(1)
    expect(props.onZoomIn).toHaveBeenCalledTimes(1)
  })
})
