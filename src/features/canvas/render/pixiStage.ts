import { Application, Container } from 'pixi.js'

export type PixiStage = {
  app: Application
  root: Container
  destroy: () => void
}

export async function createPixiStage(host: HTMLDivElement): Promise<PixiStage> {
  const app = new Application()

  await app.init({
    resizeTo: host,
    background: '#fafafa',
    antialias: true,
  })

  host.appendChild(app.canvas)

  // Pixi v8 defaults `stage.eventMode` to 'passive', which only
  // dispatches events to children whose own eventMode is 'static' or
  // 'dynamic'. The hit area we attach in ProcessCanvas sets
  // eventMode = 'static' so it should still receive events, but
  // making the stage 'static' too is harmless and lets future
  // eventMode='static' children behave consistently.
  app.stage.eventMode = 'static'

  const root = new Container()
  app.stage.addChild(root)

  return {
    app,
    root,
    destroy: () => {
      try {
        const canvas = app.canvas
        app.destroy(true)
        if (canvas && canvas.parentElement === host) {
          host.removeChild(canvas)
        }
      } catch {
        // Silently handle cleanup errors during unmount
      }
    },
  }
}
