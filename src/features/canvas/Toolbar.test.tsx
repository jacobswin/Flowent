import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

function renderToolbar(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const props: Parameters<typeof Toolbar>[0] = {
    onRemove: vi.fn(),
    onApplyFlowLayout: vi.fn(),
    onApplySwimlaneLayout: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onExport: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onZoomSet: vi.fn(),
    onOpenAiGenerate: vi.fn(),
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
    fireEvent.click(within(toolbar).getByRole('button', { name: /zoom in/i }))

    expect(props.onZoomOut).toHaveBeenCalledTimes(1)
    expect(props.onZoomIn).toHaveBeenCalledTimes(1)
    expect(props.onZoomReset).not.toHaveBeenCalled()
  })

  it('opens the AI generation modal from the toolbar', () => {
    const props = renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: /generate with ai/i }))

    expect(props.onOpenAiGenerate).toHaveBeenCalledTimes(1)
  })

  it('offers export formats from an accessible menu', () => {
    const props = renderToolbar()

    const exportButton = screen.getByRole('button', { name: /^export map$/i })
    expect(exportButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(exportButton)

    const menu = screen.getByRole('menu', { name: /export format/i })
    expect(within(menu).getByRole('menuitem', { name: 'SVG' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'PDF' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'PNG' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'JPG' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Flowent JSON' })).toBeInTheDocument()

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'PDF' }))

    expect(props.onExport).toHaveBeenCalledWith('pdf')
    expect(screen.queryByRole('menu', { name: /export format/i })).not.toBeInTheDocument()
  })

  it('exposes separate Flow and Swimlane layout actions', () => {
    const props = renderToolbar()
    const toolbar = screen.getByRole('toolbar', { name: /canvas tools/i })

    fireEvent.click(within(toolbar).getByRole('button', { name: /^flow layout$/i }))
    fireEvent.click(within(toolbar).getByRole('button', { name: /^swimlane layout$/i }))

    expect(props.onApplyFlowLayout).toHaveBeenCalledTimes(1)
    expect(props.onApplySwimlaneLayout).toHaveBeenCalledTimes(1)
    expect(within(toolbar).queryByRole('button', { name: /^layout$/i })).not.toBeInTheDocument()
  })

  it('opens a zoom menu with preset percentages from the current zoom button', () => {
    const props = renderToolbar({ zoomPercent: 125 })
    const toolbar = screen.getByRole('toolbar', { name: /canvas tools/i })

    fireEvent.click(within(toolbar).getByRole('button', { name: /zoom level 125%/i }))

    const menu = screen.getByRole('menu', { name: /zoom level/i })
    for (const preset of ['25%', '50%', '75%', '100%', '125%', '150%', '175%', '200%']) {
      expect(within(menu).getByRole('menuitem', { name: preset })).toBeInTheDocument()
    }

    fireEvent.click(within(menu).getByRole('menuitem', { name: '150%' }))

    expect(props.onZoomSet).toHaveBeenCalledWith(150)
  })

  it('applies custom zoom values clamped to the supported range', () => {
    const props = renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: /zoom level 100%/i }))

    const input = screen.getByRole('spinbutton', { name: /custom zoom percentage/i })
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /apply custom zoom/i }))
    expect(props.onZoomSet).toHaveBeenLastCalledWith(5)

    fireEvent.click(screen.getByRole('button', { name: /zoom level 100%/i }))
    fireEvent.change(screen.getByRole('spinbutton', { name: /custom zoom percentage/i }), { target: { value: '777' } })
    fireEvent.click(screen.getByRole('button', { name: /apply custom zoom/i }))
    expect(props.onZoomSet).toHaveBeenLastCalledWith(500)
  })
})
