import type { FederatedPointerEvent, Graphics } from 'pixi.js'

export interface PanCanvasLike {
  panBy: (dx: number, dy: number) => void
}

export interface RegisterCanvasPanHandlerArgs {
  hitArea: Graphics
  getCanvas: () => PanCanvasLike
  /**
   * Returns true while the spacebar is held. The native handler helper
   * owns the spacebar state (so marquee and node handlers can defer to
   * the same flag); the pan handler reads it through this callback so
   * both surfaces stay in sync without a parallel flag.
   */
  getSpaceDown: () => boolean
}

export interface CanvasPanHandlerRegistration {
  destroy: () => void
}

// Owns the Pixi-side spacebar-pan gesture on the canvas hit area. When
// the user holds Space and drags on the background, the canvas viewport
// pans by the delta. Without Space, this listener is a no-op (the cursor
// is reset to default) so the marquee flow owned by the native DOM
// listener on the host div stays the active gesture.
//
// The native-side marquee state and the Pixi-side pan state are kept
// independent so the two paths don't race. The native listeners own
// marquee selection; this helper owns Space+drag panning.
export function registerCanvasPanHandler(
  args: RegisterCanvasPanHandlerArgs,
): CanvasPanHandlerRegistration {
  const { hitArea, getCanvas, getSpaceDown } = args

  let isPanning = false
  let panStartX = 0
  let panStartY = 0

  const onPointerDown = (event: FederatedPointerEvent) => {
    if (getSpaceDown()) {
      isPanning = true
      panStartX = event.globalX
      panStartY = event.globalY
      hitArea.cursor = 'grabbing'
      return
    }

    // No pan gesture: reset cursor and let the native marquee flow take over.
    hitArea.cursor = 'default'
  }

  const onGlobalPointerMove = (event: FederatedPointerEvent) => {
    if (!isPanning) return
    if (!getSpaceDown()) {
      isPanning = false
      hitArea.cursor = 'default'
      return
    }
    const dx = event.globalX - panStartX
    const dy = event.globalY - panStartY
    getCanvas().panBy(dx, dy)
    panStartX = event.globalX
    panStartY = event.globalY
  }

  const onPointerUp = () => {
    if (!isPanning) return
    isPanning = false
    // Restore the cursor: 'grab' while Space is still held, otherwise
    // 'default'. Reading `getSpaceDown()` here keeps the cursor in
    // sync if the user releases Space mid-pan.
    hitArea.cursor = getSpaceDown() ? 'grab' : 'default'
  }

  const onPointerUpOutside = () => {
    if (!isPanning) return
    isPanning = false
    hitArea.cursor = getSpaceDown() ? 'grab' : 'default'
  }

  hitArea.on('pointerdown', onPointerDown)
  hitArea.on('globalpointermove', onGlobalPointerMove)
  hitArea.on('pointerup', onPointerUp)
  hitArea.on('pointerupoutside', onPointerUpOutside)

  return {
    destroy: () => {
      hitArea.off('pointerdown', onPointerDown)
      hitArea.off('globalpointermove', onGlobalPointerMove)
      hitArea.off('pointerup', onPointerUp)
      hitArea.off('pointerupoutside', onPointerUpOutside)
    },
  }
}
