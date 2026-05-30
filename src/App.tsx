import { ReactFlowProvider } from '@xyflow/react'
import { ProcessCanvas } from './features/canvas/ProcessCanvas'

export default function App() {
  return (
    <ReactFlowProvider>
      <ProcessCanvas />
    </ReactFlowProvider>
  )
}
