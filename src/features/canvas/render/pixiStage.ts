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
