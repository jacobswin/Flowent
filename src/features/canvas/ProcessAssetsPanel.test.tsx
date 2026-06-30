import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphDocument, ProcessAssets } from './canvasTypes'
import { addEdge, addNode, createEmptyDocument } from './engine/graphDocument'
import { createGraphNode, createHandoffEdge } from './processElements'
import { ProcessAssetsPanel } from './ProcessAssetsPanel'

function makeDocument(): GraphDocument {
  const processAssets: ProcessAssets = {
    workProducts: {
      'wp-1': {
        id: 'wp-1',
        title: 'Research brief',
        state: 'Ready',
        description: 'Context for the research handoff',
        producerNodeIds: ['activity-1'],
        consumerNodeIds: [],
        handoffEdgeIds: ['edge-1'],
        guidanceIds: ['guide-1'],
      },
    },
    guidanceItems: {
      'guide-1': {
        id: 'guide-1',
        title: 'Interview checklist',
        kind: 'checklist',
        description: 'Use during customer interviews',
        url: 'https://example.test/checklist',
        appliesToNodeIds: ['activity-1'],
        appliesToEdgeIds: [],
        workProductIds: ['wp-1'],
      },
    },
    milestones: {
      'ms-1': {
        id: 'ms-1',
        title: 'Discovery exit',
        description: 'Evidence reviewed',
        stageNodeId: 'stage-1',
        workProductStates: [{ workProductId: 'wp-1', state: 'Approved' }],
      },
    },
  }

  let doc = createEmptyDocument('map-1')
  doc = addNode(doc, { ...createGraphNode('activity', 'activity-1', { x: 0, y: 0 }), title: 'Research activity' })
  doc = addNode(doc, { ...createGraphNode('activity', 'activity-2', { x: 300, y: 0 }), title: 'Delivery activity' })
  doc = addNode(doc, { ...createGraphNode('stage', 'stage-1', { x: 0, y: 200 }), title: 'Discovery stage' })
  doc = addEdge(doc, createHandoffEdge('edge-1', 'activity-1', 'out', 'activity-2', 'in'))
  return { ...doc, processAssets }
}

describe('ProcessAssetsPanel', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('defaults collapsed and expands from the top dock title', () => {
    render(<ProcessAssetsPanel document={makeDocument()} onSelectAsset={() => {}} onRenameAsset={() => {}} onDeleteAsset={() => {}} />)

    expect(screen.queryByText('Research brief')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand process assets/i }))

    expect(screen.getByText('Research brief')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /collapse process assets/i }))

    expect(screen.queryByText('Research brief')).not.toBeInTheDocument()
  })

  it('shows work products, guidance, milestones, and perspectives', () => {
    render(<ProcessAssetsPanel defaultCollapsed={false} document={makeDocument()} onSelectAsset={() => {}} onRenameAsset={() => {}} onDeleteAsset={() => {}} />)

    const completeness = screen.getByLabelText('Stages completeness')
    expect(completeness).toHaveTextContent('What 1')
    expect(completeness).toHaveTextContent('Who 0')
    expect(completeness).toHaveTextContent('When 1')
    expect(completeness).toHaveTextContent('How 1')

    expect(screen.getByRole('button', { name: 'Work Products' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Research brief')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guidance' }))
    expect(screen.getByText('Interview checklist')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Milestones' }))
    expect(screen.getByText('Discovery exit')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Perspectives' }))
    expect(screen.getByRole('heading', { name: 'What' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'When' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How' })).toBeInTheDocument()
  })

  it('creates standalone assets from each asset tab', () => {
    const onCreateAsset = vi.fn()
    render(
      <ProcessAssetsPanel
        defaultCollapsed={false}
        document={makeDocument()}
        onSelectAsset={() => {}}
        onRenameAsset={() => {}}
        onDeleteAsset={() => {}}
        onCreateAsset={onCreateAsset}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'New work product' }))
    fireEvent.change(screen.getByLabelText('New work product'), { target: { value: 'Opportunity brief' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create work product' }))
    expect(onCreateAsset).toHaveBeenCalledWith('workProduct', { title: 'Opportunity brief' })

    fireEvent.click(screen.getByRole('button', { name: 'Guidance' }))
    fireEvent.click(screen.getByRole('button', { name: 'New guidance' }))
    fireEvent.change(screen.getByLabelText('New guidance'), { target: { value: 'Delivery template' } })
    fireEvent.change(screen.getByLabelText('New guidance kind'), { target: { value: 'template' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create guidance' }))
    expect(onCreateAsset).toHaveBeenCalledWith('guidance', { title: 'Delivery template', kind: 'template' })

    fireEvent.click(screen.getByRole('button', { name: 'Milestones' }))
    fireEvent.click(screen.getByRole('button', { name: 'New milestone' }))
    fireEvent.change(screen.getByLabelText('New milestone'), { target: { value: 'Release readiness' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create milestone' }))
    expect(onCreateAsset).toHaveBeenCalledWith('milestone', { title: 'Release readiness' })
  })

  it('selects and renames an asset', () => {
    const onSelectAsset = vi.fn()
    const onRenameAsset = vi.fn()
    render(<ProcessAssetsPanel defaultCollapsed={false} document={makeDocument()} onSelectAsset={onSelectAsset} onRenameAsset={onRenameAsset} onDeleteAsset={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /select research brief/i }))
    expect(onSelectAsset).toHaveBeenCalledWith('workProduct', 'wp-1')

    const rename = screen.getByLabelText('Rename Research brief') as HTMLInputElement
    fireEvent.change(rename, { target: { value: 'Validated research brief' } })
    fireEvent.blur(rename)

    expect(onRenameAsset).toHaveBeenCalledWith('workProduct', 'wp-1', 'Validated research brief')
  })

  it('deletes an unused asset', () => {
    const onDeleteAsset = vi.fn()
    render(<ProcessAssetsPanel defaultCollapsed={false} document={makeDocument()} onSelectAsset={() => {}} onRenameAsset={() => {}} onDeleteAsset={onDeleteAsset} />)

    fireEvent.click(screen.getByRole('button', { name: /delete research brief/i }))

    fireEvent.click(screen.getByRole('button', { name: /confirm delete research brief/i }))

    expect(onDeleteAsset).toHaveBeenCalledWith('workProduct', 'wp-1')
  })

  it('edits work product fields and manages its relationships from the detail pane', () => {
    const onUpdateAsset = vi.fn()
    const onLinkAsset = vi.fn()
    const onUnlinkAsset = vi.fn()
    const onSelectObjectTarget = vi.fn()
    render(
      <ProcessAssetsPanel
        defaultCollapsed={false}
        document={makeDocument()}
        selectedAsset={{ kind: 'workProduct', id: 'wp-1' }}
        onSelectAsset={() => {}}
        onRenameAsset={() => {}}
        onDeleteAsset={() => {}}
        onUpdateAsset={onUpdateAsset}
        onLinkAsset={onLinkAsset}
        onUnlinkAsset={onUnlinkAsset}
        onSelectObjectTarget={onSelectObjectTarget}
      />,
    )

    fireEvent.change(screen.getByLabelText('Work product title'), { target: { value: 'Validated research brief' } })
    fireEvent.blur(screen.getByLabelText('Work product title'))
    fireEvent.change(screen.getByLabelText('Default maturity'), { target: { value: 'Approved' } })
    fireEvent.blur(screen.getByLabelText('Default maturity'))
    fireEvent.change(screen.getByLabelText('Work product description'), { target: { value: 'Ready for delivery' } })
    fireEvent.blur(screen.getByLabelText('Work product description'))

    expect(onUpdateAsset).toHaveBeenCalledWith('workProduct', 'wp-1', { title: 'Validated research brief' })
    expect(onUpdateAsset).toHaveBeenCalledWith('workProduct', 'wp-1', { state: 'Approved' })
    expect(onUpdateAsset).toHaveBeenCalledWith('workProduct', 'wp-1', { description: 'Ready for delivery' })

    expect(screen.getByText('Research activity · Ready')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /go to producer research activity/i }))
    expect(onSelectObjectTarget).toHaveBeenCalledWith('node', 'activity-1')

    fireEvent.click(screen.getByRole('button', { name: /unlink producer research activity/i }))
    expect(onUnlinkAsset).toHaveBeenCalledWith('workProduct', 'wp-1', 'producer', 'activity-1', { maturity: 'Ready' })

    fireEvent.change(screen.getByLabelText('Add consumer'), { target: { value: 'activity-1' } })
    expect(screen.getByText('Same maturity cannot be both input and output for this activity. Choose another maturity or unlink first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link consumer' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Add consumer maturity'), { target: { value: 'Approved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link consumer' }))
    expect(onLinkAsset).toHaveBeenCalledWith('workProduct', 'wp-1', 'consumer', 'activity-1', { maturity: 'Approved' })
  })

  it('edits guidance fields and links it to a work product', () => {
    const onUpdateAsset = vi.fn()
    const onLinkAsset = vi.fn()
    const onUnlinkAsset = vi.fn()
    render(
      <ProcessAssetsPanel
        defaultCollapsed={false}
        document={makeDocument()}
        selectedAsset={{ kind: 'guidance', id: 'guide-1' }}
        onSelectAsset={() => {}}
        onRenameAsset={() => {}}
        onDeleteAsset={() => {}}
        onUpdateAsset={onUpdateAsset}
        onLinkAsset={onLinkAsset}
        onUnlinkAsset={onUnlinkAsset}
      />,
    )

    fireEvent.change(screen.getByLabelText('Guidance title'), { target: { value: 'Updated checklist' } })
    fireEvent.blur(screen.getByLabelText('Guidance title'))
    fireEvent.change(screen.getByLabelText('Guidance kind'), { target: { value: 'template' } })
    fireEvent.change(screen.getByLabelText('Guidance URL'), { target: { value: 'https://example.test/template' } })
    fireEvent.blur(screen.getByLabelText('Guidance URL'))

    expect(onUpdateAsset).toHaveBeenCalledWith('guidance', 'guide-1', { title: 'Updated checklist' })
    expect(onUpdateAsset).toHaveBeenCalledWith('guidance', 'guide-1', { kind: 'template' })
    expect(onUpdateAsset).toHaveBeenCalledWith('guidance', 'guide-1', { url: 'https://example.test/template' })

    fireEvent.click(screen.getByRole('button', { name: /unlink work product research brief/i }))
    expect(onUnlinkAsset).toHaveBeenCalledWith('guidance', 'guide-1', 'workProduct', 'wp-1')

    fireEvent.change(screen.getByLabelText('Add work product'), { target: { value: 'wp-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Link work product' }))
    expect(onLinkAsset).toHaveBeenCalledWith('guidance', 'guide-1', 'workProduct', 'wp-1')
  })

  it('edits milestone fields and removes work product states', () => {
    const onUpdateAsset = vi.fn()
    const onUnlinkAsset = vi.fn()
    render(
      <ProcessAssetsPanel
        defaultCollapsed={false}
        document={makeDocument()}
        selectedAsset={{ kind: 'milestone', id: 'ms-1' }}
        onSelectAsset={() => {}}
        onRenameAsset={() => {}}
        onDeleteAsset={() => {}}
        onUpdateAsset={onUpdateAsset}
        onUnlinkAsset={onUnlinkAsset}
      />,
    )

    fireEvent.change(screen.getByLabelText('Milestone title'), { target: { value: 'Discovery complete' } })
    fireEvent.blur(screen.getByLabelText('Milestone title'))
    fireEvent.change(screen.getByLabelText('Milestone stage'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Maturity at milestone for Research brief'), { target: { value: 'Published' } })
    fireEvent.blur(screen.getByLabelText('Maturity at milestone for Research brief'))

    expect(onUpdateAsset).toHaveBeenCalledWith('milestone', 'ms-1', { title: 'Discovery complete' })
    expect(onUpdateAsset).toHaveBeenCalledWith('milestone', 'ms-1', { stageNodeId: null })
    expect(onUpdateAsset).toHaveBeenCalledWith('milestone', 'ms-1', {
      workProductStates: [{ workProductId: 'wp-1', state: 'Published' }],
    })

    fireEvent.click(screen.getByRole('button', { name: /remove maturity research brief/i }))
    expect(onUnlinkAsset).toHaveBeenCalledWith('milestone', 'ms-1', 'workProductState', 'wp-1')
  })

  it('opens a selected asset from a diagnostic-controlled selection', () => {
    render(
      <ProcessAssetsPanel
        defaultCollapsed={false}
        document={makeDocument()}
        selectedAsset={{ kind: 'guidance', id: 'guide-1' }}
        onSelectAsset={() => {}}
        onRenameAsset={() => {}}
        onDeleteAsset={() => {}}
      />,
    )

    expect(screen.getByLabelText('Guidance title')).toHaveValue('Interview checklist')
  })
})
