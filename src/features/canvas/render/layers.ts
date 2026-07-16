import { Container, Graphics } from 'pixi.js'

export type CanvasLayers = {
  gridLayer: Container
  laneLayer: Container
  edgeLayer: Container
  nodeLayer: Container
  overlayLayer: Container
}

export function createCanvasLayers(root: Container): CanvasLayers {
  const gridLayer = new Container()
  const laneLayer = new Container()
  const edgeLayer = new Container()
  const nodeLayer = new Container()
  const overlayLayer = new Container()

  root.addChild(gridLayer)
  root.addChild(laneLayer)
  root.addChild(edgeLayer)
  root.addChild(nodeLayer)
  root.addChild(overlayLayer)

  return {
    gridLayer,
    laneLayer,
    edgeLayer,
    nodeLayer,
    overlayLayer,
  }
}

export function drawGrid(layer: Container, width: number, height: number, gap = 24): void {
  layer.removeChildren()

  const grid = new Graphics()
  grid.stroke({ color: 0xe5e5e7, alpha: 0.4, width: 0.5 })

  for (let x = 0; x <= width; x += gap) {
    grid.moveTo(x, 0)
    grid.lineTo(x, height)
  }

  for (let y = 0; y <= height; y += gap) {
    grid.moveTo(0, y)
    grid.lineTo(width, y)
  }

  layer.addChild(grid)
}
