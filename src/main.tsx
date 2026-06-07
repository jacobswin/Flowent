import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Flowent root element was not found')
}

// Render without <StrictMode> in production-like usage. Pixi's WebGL
// stage construction and Ticker setup are expensive; StrictMode's
// double-invocation in dev would create and tear the stage down twice
// on every mount, visibly hurting first-paint time.
createRoot(rootElement).render(<App />)
