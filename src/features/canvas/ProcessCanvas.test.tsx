import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProcessCanvas } from './ProcessCanvas'
import { createEmptyDocument, addEdge, addNode } from './engine/graphDocument'
import { createGraphNode, createHandoffEdge } from './processElements'

describe('ProcessCanvas', () => {
  it('renders toolbar and title in the canvas shell', () => {
    render(<ProcessCanvas />)

    expect(screen.getByRole('toolbar', { name: /canvas tools/i })).toBeInTheDocument()
    expect(screen.queryByText('Flowent')).not.toBeInTheDocument()
  })

  it('groups dock panels and the main toolbar in one top control rail', () => {
    render(<ProcessCanvas />)

    const rail = screen.getByLabelText('Canvas control rail')
    expect(rail).toContainElement(screen.getByRole('toolbar', { name: /canvas tools/i }))
    expect(rail).toContainElement(screen.getByLabelText('Process element library'))
    expect(rail).toContainElement(screen.getByLabelText('Alignment checklist'))
    expect(rail).toContainElement(screen.getByLabelText('Process assets'))
    expect(rail).toContainElement(screen.getByLabelText('Focus view'))
  })

  it('assigns proportionate compact dimensions to the collapsed top dock panels', () => {
    render(<ProcessCanvas />)

    const panels = [
      { label: 'Process element library', width: '190px', minWidth: '108px', weight: '0.9', compactTitle: 'Elements' },
      { label: 'Alignment checklist', width: '212px', minWidth: '134px', weight: '1.15', compactTitle: 'Align' },
      { label: 'Process assets', width: '176px', minWidth: '112px', weight: '0.85', compactTitle: 'Assets' },
      { label: 'Focus view', width: '206px', minWidth: '120px', weight: '1.1', compactTitle: 'Focus' },
    ]

    for (const panel of panels) {
      const element = screen.getByLabelText(panel.label)
      expect(element.style.getPropertyValue('--top-dock-collapsed-width')).toBe(panel.width)
      expect(element.style.getPropertyValue('--top-dock-collapsed-min-width')).toBe(panel.minWidth)
      expect(element.style.getPropertyValue('--top-dock-collapsed-weight')).toBe(panel.weight)
      expect(element.getAttribute('data-compact-title')).toBe(panel.compactTitle)
    }
  })

  it('shows shell selection affordances for edge-only selection', async () => {
    const start = createGraphNode('start', 'start', { x: 100, y: 100 })
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('edge-selection-test')
    document = addNode(document, start)
    document = addNode(document, activity)
    document = addEdge(document, createHandoffEdge('edge-1', 'start', 'out', 'activity-1', 'in'))

    render(<ProcessCanvas initialDocument={document} />)

    const edgeButton = await screen.findByRole('button', {
      name: /connection from start to activity-1, no label/i,
    })
    fireEvent.click(edgeButton)

    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument()
      expect(
        within(screen.getByRole('toolbar', { name: /canvas tools/i })).getByRole('button', { name: /delete/i }),
      ).toBeInTheDocument()
    })

    const connectionActions = screen.getByRole('toolbar', { name: /connection quick actions/i })
    expect(within(connectionActions).getByRole('button', { name: /edit connection/i })).toBeInTheDocument()
    expect(within(connectionActions).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(connectionActions).getByRole('button', { name: 'Label' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /properties/i })).not.toBeInTheDocument()

    fireEvent.click(within(connectionActions).getByRole('button', { name: /edit connection/i }))

    expect(await screen.findByRole('complementary', { name: /properties/i })).toBeInTheDocument()
    expect(screen.getByText('Connection')).toBeInTheDocument()
  })

  it('shows node quick actions on selection and opens node editing explicitly', async () => {
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('node-quick-actions-test')
    document = addNode(document, createGraphNode('start', 'start', { x: 100, y: 100 }))
    document = addNode(document, activity)

    render(<ProcessCanvas initialDocument={document} />)

    fireEvent.click(await screen.findByRole('button', { name: 'New activity' }))

    const nodeActions = await screen.findByRole('toolbar', { name: /node quick actions/i })
    expect(within(nodeActions).getByRole('button', { name: /edit node/i })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /properties/i })).not.toBeInTheDocument()

    fireEvent.click(within(nodeActions).getByRole('button', { name: /edit node/i }))

    expect(await screen.findByRole('complementary', { name: /properties/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('New activity')
  })

  it('replaces object quick actions when selecting a different canvas object', async () => {
    const start = createGraphNode('start', 'start', { x: 100, y: 100 })
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('exclusive-quick-actions-test')
    document = addNode(document, start)
    document = addNode(document, activity)
    document = addEdge(document, createHandoffEdge('edge-1', 'start', 'out', 'activity-1', 'in'))

    render(<ProcessCanvas initialDocument={document} />)

    const activityButton = await screen.findByRole('button', { name: 'New activity' })
    fireEvent.click(activityButton)

    await screen.findByRole('toolbar', { name: /node quick actions/i })
    expect(screen.queryByRole('toolbar', { name: /connection quick actions/i })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', {
      name: /connection from start to activity-1, no label/i,
    }))

    await screen.findByRole('toolbar', { name: /connection quick actions/i })
    expect(screen.queryByRole('toolbar', { name: /node quick actions/i })).not.toBeInTheDocument()

    fireEvent.click(activityButton)

    await screen.findByRole('toolbar', { name: /node quick actions/i })
    expect(screen.queryByRole('toolbar', { name: /connection quick actions/i })).not.toBeInTheDocument()
  })

  it('deletes the selected connection with the Delete key', async () => {
    const start = createGraphNode('start', 'start', { x: 100, y: 100 })
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('edge-delete-key-test')
    document = addNode(document, start)
    document = addNode(document, activity)
    document = addEdge(document, createHandoffEdge('edge-1', 'start', 'out', 'activity-1', 'in'))

    render(<ProcessCanvas initialDocument={document} />)

    fireEvent.click(await screen.findByRole('button', {
      name: /connection from start to activity-1, no label/i,
    }))
    fireEvent.keyDown(window, { key: 'Delete' })

    await waitFor(() => {
      expect(screen.getByText('0 edges')).toBeInTheDocument()
    })
  })

  it('changes the selected connection color from the quick actions', async () => {
    const start = createGraphNode('start', 'start', { x: 100, y: 100 })
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('edge-color-test')
    document = addNode(document, start)
    document = addNode(document, activity)
    document = addEdge(document, createHandoffEdge('edge-1', 'start', 'out', 'activity-1', 'in'))

    render(<ProcessCanvas initialDocument={document} />)

    fireEvent.click(await screen.findByRole('button', {
      name: /connection from start to activity-1, no label/i,
    }))

    const quickActions = await screen.findByRole('toolbar', { name: /connection quick actions/i })
    const redSwatch = within(quickActions).getByRole('button', { name: /set connection color red/i })
    fireEvent.click(redSwatch)

    await waitFor(() => {
      expect(within(quickActions).getByRole('button', { name: /set connection color red/i }))
        .toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('opens a right-click connection menu that can delete the edge', async () => {
    const start = createGraphNode('start', 'start', { x: 100, y: 100 })
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('edge-context-menu-test')
    document = addNode(document, start)
    document = addNode(document, activity)
    document = addEdge(document, createHandoffEdge('edge-1', 'start', 'out', 'activity-1', 'in'))

    render(<ProcessCanvas initialDocument={document} />)

    const edgeButton = await screen.findByRole('button', {
      name: /connection from start to activity-1, no label/i,
    })
    fireEvent.contextMenu(edgeButton, { clientX: 380, clientY: 240 })

    const menu = await screen.findByRole('menu', { name: /connection actions/i })
    fireEvent.click(within(menu).getByRole('menuitem', { name: /delete connector/i }))

    await waitFor(() => {
      expect(screen.getByText('0 edges')).toBeInTheDocument()
    })
  })

  it('does not run canvas shortcuts while typing in a block editor field', async () => {
    const start = createGraphNode('start', 'start', { x: 100, y: 100 })
    const activity = createGraphNode('activity', 'activity-1', { x: 320, y: 100 })
    let document = createEmptyDocument('typing-shortcut-test')
    document = addNode(document, start)
    document = addNode(document, activity)

    render(<ProcessCanvas initialDocument={document} />)

    const activityButton = await screen.findByRole('button', { name: 'New activity' })
    fireEvent.keyDown(activityButton, { key: 'Enter' })

    const title = await screen.findByLabelText('Title')
    title.focus()
    fireEvent.keyDown(title, { key: 'a' })
    fireEvent.keyDown(title, { key: 'Delete' })
    fireEvent.change(title, { target: { value: 'New activity a' } })

    expect(screen.getByText('2 nodes')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('New activity a')
  })

  it('offers Creately-style Plus Create from the selected node', async () => {
    render(<ProcessCanvas />)

    const startButton = await screen.findByRole('button', { name: 'Start' })
    fireEvent.click(startButton)

    const quickConnect = await screen.findByRole('button', { name: /quick connect from start/i })
    fireEvent.pointerDown(quickConnect, { clientX: 482, clientY: 228, pointerId: 1, button: 0 })
    fireEvent.pointerUp(quickConnect, { clientX: 482, clientY: 228, pointerId: 1, button: 0 })

    const picker = await screen.findByRole('menu', { name: /choose next node type/i })
    const pickerLeft = Number.parseFloat(picker.style.left)
    const pickerTop = Number.parseFloat(picker.style.top)
    expect(pickerLeft).toBeGreaterThanOrEqual(492)
    expect(pickerLeft).toBeLessThanOrEqual(496)
    expect(pickerTop).toBeGreaterThanOrEqual(216)
    expect(pickerTop).toBeLessThanOrEqual(220)

    fireEvent.click(within(picker).getByRole('menuitem', { name: /decision/i }))

    await waitFor(() => {
      expect(screen.getByText('2 nodes')).toBeInTheDocument()
      expect(screen.getByText('1 edges')).toBeInTheDocument()
    })
  })

  it('closes Plus Create when opening the selected node editor', async () => {
    render(<ProcessCanvas />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

    const quickConnect = await screen.findByRole('button', { name: /quick connect from start/i })
    fireEvent.pointerDown(quickConnect, { clientX: 482, clientY: 228, pointerId: 1, button: 0 })
    fireEvent.pointerUp(quickConnect, { clientX: 482, clientY: 228, pointerId: 1, button: 0 })

    expect(await screen.findByRole('menu', { name: /choose next node type/i })).toBeInTheDocument()

    const nodeActions = await screen.findByRole('toolbar', { name: /node quick actions/i })
    fireEvent.click(within(nodeActions).getByRole('button', { name: /edit node/i }))

    expect(await screen.findByRole('complementary', { name: /properties/i })).toBeInTheDocument()
    expect(screen.queryByRole('menu', { name: /choose next node type/i })).not.toBeInTheDocument()
  })

  it('closes Plus Create when clicking blank canvas', async () => {
    render(<ProcessCanvas />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

    const quickConnect = await screen.findByRole('button', { name: /quick connect from start/i })
    fireEvent.pointerDown(quickConnect, { clientX: 482, clientY: 228, pointerId: 1, button: 0 })
    fireEvent.pointerUp(quickConnect, { clientX: 482, clientY: 228, pointerId: 1, button: 0 })

    expect(await screen.findByRole('menu', { name: /choose next node type/i })).toBeInTheDocument()

    const canvasHost = screen.getByLabelText('Process canvas')
    fireEvent.pointerDown(canvasHost, { clientX: 820, clientY: 520, pointerId: 2, button: 0 })
    fireEvent.pointerUp(canvasHost, { clientX: 820, clientY: 520, pointerId: 2, button: 0 })

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /choose next node type/i })).not.toBeInTheDocument()
    })
  })

  it('opens Plus Create with Tab when a node is selected', async () => {
    render(<ProcessCanvas />)

    const startButton = await screen.findByRole('button', { name: 'Start' })
    fireEvent.click(startButton)
    fireEvent.keyDown(window, { key: 'Tab' })

    const picker = await screen.findByRole('menu', { name: /choose next node type/i })
    expect(within(picker).getByRole('menuitem', { name: /activity/i })).toBeInTheDocument()
  })
})
