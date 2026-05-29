import * as http from 'node:http'
import { createAnthropicClient, hasAnthropicApiKey } from './scenario-generation/anthropicClient'
import { generateScenarioDraftWithClaude, type ScenarioDraftGeneratorDependencies } from './scenario-generation/generateScenarioDraftWithClaude'
import { createScenarioDraftRouteHandler } from './scenario-generation/scenarioDraftRoute'
import type { ScenarioDraftRequest } from './scenario-generation/scenarioDraftSchemas'

const PORT = Number(process.env.FLOWENT_API_PORT ?? 8787)
const MAX_REQUEST_BYTES = 24_000

const handleScenarioDraftRequest = createScenarioDraftRouteHandler({
  hasApiKey: hasAnthropicApiKey,
  generateDraft: async (input: ScenarioDraftRequest) =>
    generateScenarioDraftWithClaude(input, {
      anthropic: createAnthropicClient() as ScenarioDraftGeneratorDependencies['anthropic'],
    }),
})

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/scenario-drafts') {
    try {
      const requestBody = request.method === 'GET' || request.method === 'HEAD' ? undefined : await readRequestBody(request)
      const webRequest = new Request(url, {
        method: request.method,
        headers: request.headers as HeadersInit,
        body: requestBody,
      })
      const webResponse = await handleScenarioDraftRequest(webRequest)

      response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
      response.end(await webResponse.text())
    } catch {
      response.writeHead(413, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: false, error: 'Scenario input is too large for draft generation.' }))
    }
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ success: false, error: 'Not found.' }))
})

server.listen(PORT)

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''

    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk

      if (body.length > MAX_REQUEST_BYTES) {
        reject(new Error('Request body is too large.'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}
