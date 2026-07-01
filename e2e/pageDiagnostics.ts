import type { Page } from '@playwright/test'

type PageDiagnosticsOptions = {
  consoleErrors?: boolean
  consoleIncludes?: string[]
}

export function attachPageDiagnostics(page: Page, options: PageDiagnosticsOptions = {}) {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))

  if (options.consoleErrors || options.consoleIncludes?.length) {
    page.on('console', (msg) => {
      const text = msg.text()
      const shouldLog =
        (options.consoleErrors && msg.type() === 'error') ||
        options.consoleIncludes?.some((snippet) => text.includes(snippet))

      if (shouldLog) console.log('[console]', msg.type(), text)
    })
  }
}
