import { lazy, Suspense } from 'react'

// Code-split the entire canvas + library + PIXI behind a lazy boundary so
// the page title can render immediately while the WebGL-backed chunk
// loads in the background. Without this, the main JS chunk has to pull
// in the full Pixi.js bundle (~1MB) before React can mount anything.
const LibraryGateLazy = lazy(() =>
  import('./features/canvas/LibraryGate').then(m => ({ default: m.LibraryGate })),
)

function CanvasLoading() {
  return (
    <div className="canvas-container">
      <div className="canvas-header">
        <h1 className="canvas-title">Flowent</h1>
        <p className="canvas-subtitle">Process maps for aligned product teams</p>
      </div>
      <div className="canvas-loading">Loading canvas…</div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<CanvasLoading />}>
      <LibraryGateLazy />
    </Suspense>
  )
}
