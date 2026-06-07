import type { Container } from 'pixi.js'

export function destroyChildren(container: Container): void {
  const children = container.removeChildren()
  for (const child of children) {
    child.destroy({ children: true })
  }
}
