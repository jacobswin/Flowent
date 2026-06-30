import type { DragEventHandler, RefObject } from 'react'
import type { ConnectionCreateRequest, GraphDocument, GraphNode, GuidanceKind, ProcessAssets, ProcessEdge, ProcessNode } from './canvasTypes'
import type { EdgeLabelEditorApi } from './useEdgeLabelEditor'
import type { ProcessFocusState } from './focus/processFocus'
import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'
import type { ActivationState } from './activation/processActivation'
import type { BottleneckMetrics } from './diagnostics/bottleneckMetrics'
import { Toolbar } from './Toolbar'
import { ProcessElementPalette } from './ProcessElementPalette'
import { CanvasOverlays } from './CanvasOverlays'
import { FocusBar } from './FocusBar'
import { AlignmentChecklist } from './AlignmentChecklist'
import { ActivationBar } from './ActivationBar'
import { PropertiesPanel } from './PropertiesPanel'
import type { PropertiesPanelAssetActions } from './PropertiesPanel'
import { ProcessAssetsPanel } from './ProcessAssetsPanel'

type ProcessAssetKind = 'workProduct' | 'guidance' | 'milestone'
type ProcessAssetRelation =
  | 'producer'
  | 'consumer'
  | 'handoff'
  | 'guidance'
  | 'node'
  | 'edge'
  | 'workProduct'
  | 'stage'
  | 'workProductState'
type ProcessAssetRelationOptions = { maturity?: string }

interface CanvasChromeToolbarModel {
  onRemove: () => void
  onAutoLayout: () => void
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  zoomPercent: number
}

interface CanvasChromeOverlayModel {
  hostOrigin: { left: number; top: number }
  labelEditor: EdgeLabelEditorApi
  viewport: { x: number; y: number; zoom: number }
  edges: ProcessEdge[]
  nodes: ProcessNode[]
  selectedNodeIds: Set<string>
  selectedEdge: ProcessEdge | null
  connectionCreateMenu: ConnectionCreateRequest | null
  edgeContextMenu: { edgeId: string; screenPosition: { x: number; y: number } } | null
  onPickConnectionNodeType: (type: 'stage' | 'activity' | 'decision' | 'bottleneck' | 'end') => void
  onCancelConnectionCreate: () => void
  onConnect: (sourceNodeId: string, targetNodeId: string, sourcePortId?: string, targetPortId?: string) => void
  onOpenConnectionCreateMenu: (request: ConnectionCreateRequest) => void
  onOpenEdgeContextMenu: (edgeId: string, screenPosition: { x: number; y: number }) => void
  onCloseEdgeContextMenu: () => void
  onUpdateEdgeColor: (edgeId: string, color: string) => void
  onEdgeClick: (edgeId: string, additive: boolean) => void
  onNodeClick: (nodeId: string, additive: boolean) => void
  openEditor: (nodeId: string) => void
  openEdgeEditor: (edgeId: string) => void
  removeSelected: () => void
  nodesById: Map<string, GraphNode>
}

interface CanvasChromeFocusModel {
  focus: ProcessFocusState
  roles: string[]
  onChange: (focus: ProcessFocusState) => void
}

interface CanvasChromeChecklistModel {
  diagnostics: ProcessMapDiagnostic[]
  onSelectDiagnostic: (diagnostic: ProcessMapDiagnostic) => void
}

interface CanvasChromeActivationModel {
  activation: ActivationState
  eligible: boolean
  reasons: string[]
  bottlenecks: BottleneckMetrics
  onActivate: () => void
}

interface CanvasChromeStatusModel {
  nodeCount: number
  edgeCount: number
  zoomPercent: number
  selectedNodeCount: number
}

interface CanvasChromePropertiesModel {
  node: ProcessNode | null
  edge: ProcessEdge | null
  nodes: ProcessNode[]
  processAssets: ProcessAssets
  assetActions: PropertiesPanelAssetActions
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onUpdateEdge: (edgeId: string, data: Record<string, unknown>) => void
  onDeleteEdge: () => void
  onClose: () => void
}

interface CanvasChromeProcessAssetsModel {
  document: GraphDocument
  selectedAsset: { kind: ProcessAssetKind; id: string } | null
  onSelectAsset: (kind: ProcessAssetKind, id: string) => void
  onCreateAsset: (kind: ProcessAssetKind, data: { title: string; kind?: GuidanceKind }) => void
  onRenameAsset: (kind: ProcessAssetKind, id: string, title: string) => void
  onDeleteAsset: (kind: ProcessAssetKind, id: string) => void
  onUpdateAsset: (kind: ProcessAssetKind, id: string, patch: Record<string, unknown>) => void
  onLinkAsset: (kind: ProcessAssetKind, id: string, relation: ProcessAssetRelation, targetId: string, options?: ProcessAssetRelationOptions) => void
  onUnlinkAsset: (kind: ProcessAssetKind, id: string, relation: ProcessAssetRelation, targetId: string, options?: ProcessAssetRelationOptions) => void
  onSelectObjectTarget: (type: 'node' | 'edge', id: string) => void
}

export interface CanvasChromeProps {
  hostRef: RefObject<HTMLDivElement | null>
  onDragOver: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
  onQuickCreate: (type: 'stage' | 'activity' | 'decision' | 'bottleneck' | 'end') => void
  toolbar: CanvasChromeToolbarModel
  overlays: CanvasChromeOverlayModel
  focusBar: CanvasChromeFocusModel
  checklist: CanvasChromeChecklistModel
  activationBar: CanvasChromeActivationModel
  processAssets: CanvasChromeProcessAssetsModel
  statusBar: CanvasChromeStatusModel
  propertiesPanel: CanvasChromePropertiesModel
}

export function CanvasChrome({
  hostRef,
  onDragOver,
  onDrop,
  onQuickCreate,
  toolbar,
  overlays,
  focusBar,
  checklist,
  activationBar,
  processAssets,
  statusBar,
  propertiesPanel,
}: CanvasChromeProps) {
  return (
    <div className="canvas-container">
      <div className="canvas-header">
        <h1 className="canvas-title">Flowent</h1>
        <p className="canvas-subtitle">Process maps for aligned product teams</p>
      </div>

      <Toolbar
        onRemove={toolbar.onRemove}
        onAutoLayout={toolbar.onAutoLayout}
        onUndo={toolbar.onUndo}
        onRedo={toolbar.onRedo}
        onExport={toolbar.onExport}
        onZoomIn={toolbar.onZoomIn}
        onZoomOut={toolbar.onZoomOut}
        onZoomReset={toolbar.onZoomReset}
        canUndo={toolbar.canUndo}
        canRedo={toolbar.canRedo}
        hasSelection={toolbar.hasSelection}
        zoomPercent={toolbar.zoomPercent}
      />

      <div className="canvas-top-dock" aria-label="Canvas control panels">
        <ProcessElementPalette onQuickCreate={onQuickCreate} />
        <AlignmentChecklist
          diagnostics={checklist.diagnostics}
          onSelectDiagnostic={checklist.onSelectDiagnostic}
        />
        <ProcessAssetsPanel
          document={processAssets.document}
          selectedAsset={processAssets.selectedAsset}
          onSelectAsset={processAssets.onSelectAsset}
          onCreateAsset={processAssets.onCreateAsset}
          onRenameAsset={processAssets.onRenameAsset}
          onDeleteAsset={processAssets.onDeleteAsset}
          onUpdateAsset={processAssets.onUpdateAsset}
          onLinkAsset={processAssets.onLinkAsset}
          onUnlinkAsset={processAssets.onUnlinkAsset}
          onSelectObjectTarget={processAssets.onSelectObjectTarget}
        />
        <FocusBar focus={focusBar.focus} roles={focusBar.roles} onChange={focusBar.onChange} />
      </div>

      <div
        ref={hostRef}
        className="pixi-host"
        aria-label="Process canvas"
        tabIndex={0}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />

      <CanvasOverlays
        hostOrigin={overlays.hostOrigin}
        viewport={overlays.viewport}
        labelEditor={overlays.labelEditor}
        edges={overlays.edges}
        nodes={overlays.nodes}
        selectedNodeIds={overlays.selectedNodeIds}
        selectedEdge={overlays.selectedEdge}
        connectionCreateMenu={overlays.connectionCreateMenu}
        edgeContextMenu={overlays.edgeContextMenu}
        onPickConnectionNodeType={overlays.onPickConnectionNodeType}
        onCancelConnectionCreate={overlays.onCancelConnectionCreate}
        onConnect={overlays.onConnect}
        onOpenConnectionCreateMenu={overlays.onOpenConnectionCreateMenu}
        onOpenEdgeContextMenu={overlays.onOpenEdgeContextMenu}
        onCloseEdgeContextMenu={overlays.onCloseEdgeContextMenu}
        onUpdateEdgeColor={overlays.onUpdateEdgeColor}
        onEdgeClick={overlays.onEdgeClick}
        onNodeClick={overlays.onNodeClick}
        openEditor={overlays.openEditor}
        openEdgeEditor={overlays.openEdgeEditor}
        removeSelected={overlays.removeSelected}
        nodesById={overlays.nodesById}
      />

      <ActivationBar
        activation={activationBar.activation}
        eligible={activationBar.eligible}
        reasons={activationBar.reasons}
        bottlenecks={activationBar.bottlenecks}
        onActivate={activationBar.onActivate}
      />

      <div className="status-bar" aria-live="polite">
        <span>{statusBar.nodeCount} nodes</span>
        <span>·</span>
        <span>{statusBar.edgeCount} edges</span>
        <span>·</span>
        <span>{statusBar.zoomPercent}%</span>
        {statusBar.selectedNodeCount > 0 && (
          <>
            <span>·</span>
            <span>{statusBar.selectedNodeCount} selected</span>
          </>
        )}
      </div>

      <PropertiesPanel
        node={propertiesPanel.node}
        edge={propertiesPanel.edge}
        nodes={propertiesPanel.nodes}
        processAssets={propertiesPanel.processAssets}
        assetActions={propertiesPanel.assetActions}
        onUpdateNode={propertiesPanel.onUpdateNode}
        onUpdateEdge={propertiesPanel.onUpdateEdge}
        onDeleteEdge={propertiesPanel.onDeleteEdge}
        onClose={propertiesPanel.onClose}
      />
    </div>
  )
}
