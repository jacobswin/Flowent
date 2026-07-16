import * as http from 'node:http'
import { join } from 'node:path'
import { createAnthropicClient, hasAnthropicApiKey } from './scenario-generation/anthropicClient'
import { generateScenarioDraftWithClaude, type ScenarioDraftGeneratorDependencies } from './scenario-generation/generateScenarioDraftWithClaude'
import { createScenarioDraftRouteHandler } from './scenario-generation/scenarioDraftRoute'
import type { ScenarioDraftRequest } from './scenario-generation/scenarioDraftSchemas'
import { createLibraryRouteHandler } from './library/libraryRoute'
import { createAiRouteHandler } from './ai/aiRoute'

const PORT = Number(process.env.FLOWENT_API_PORT ?? 8787)
const MAX_SCENARIO_REQUEST_BYTES = 24_000
const MAX_LIBRARY_REQUEST_BYTES = 512_000
const MAX_AI_REQUEST_BYTES = 11 * 1024 * 1024
const LIBRARY_FILE = process.env.FLOWENT_LIBRARY_FILE ?? join(process.cwd(), 'data', 'library.json')
const AI_MASTER_KEY_FILE = process.env.FLOWENT_AI_MASTER_KEY_FILE ?? join(process.cwd(), 'data', 'flowent-ai-master.key')

const handleScenarioDraftRequest = createScenarioDraftRouteHandler({
  hasApiKey: hasAnthropicApiKey,
  generateDraft: async (input: ScenarioDraftRequest) =>
    generateScenarioDraftWithClaude(input, {
      anthropic: createAnthropicClient() as ScenarioDraftGeneratorDependencies['anthropic'],
    }),
})

const handleLibraryRequest = createLibraryRouteHandler({ filePath: LIBRARY_FILE })
const handleAiRequest = createAiRouteHandler({ filePath: LIBRARY_FILE, masterKeyFile: AI_MASTER_KEY_FILE })

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/scenario-drafts') {
    try {
      const requestBody = request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await readRequestBody(request, MAX_SCENARIO_REQUEST_BYTES)
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

  if (url.pathname.startsWith('/api/library')) {
    try {
      const requestBody = request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE'
        ? undefined
        : await readRequestBody(request, MAX_LIBRARY_REQUEST_BYTES)
      const webRequest = new Request(url, {
        method: request.method,
        headers: request.headers as HeadersInit,
        body: requestBody,
      })
      const webResponse = await handleLibraryRequest(webRequest)
      response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
      response.end(await webResponse.text())
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: false, error: 'Bad library request.' }))
    }
    return
  }

  if (url.pathname.startsWith('/api/ai')) {
    try {
      const requestBody = request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE'
        ? undefined
        : await readRequestBuffer(request, MAX_AI_REQUEST_BYTES)
      const webRequest = new Request(url, {
        method: request.method,
        headers: request.headers as HeadersInit,
        body: requestBody
          ? requestBody.buffer.slice(requestBody.byteOffset, requestBody.byteOffset + requestBody.byteLength) as ArrayBuffer
          : undefined,
      })
      const webResponse = await handleAiRequest(webRequest)
      response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
      response.end(await webResponse.text())
    } catch {
      response.writeHead(413, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: false, error: 'AI request is too large or malformed.' }))
    }
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ success: false, error: 'Not found.' }))
})

server.listen(PORT)

function readRequestBody(request: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    let byteLength = 0

    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      byteLength += Buffer.byteLength(chunk, 'utf8')

      if (byteLength > maxBytes) {
        reject(new Error('Request body is too large.'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function readRequestBuffer(request: http.IncomingMessage, maxBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let byteLength = 0

    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      byteLength += chunk.byteLength

      if (byteLength > maxBytes) {
        reject(new Error('Request body is too large.'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    request.on('error', reject)
  })
}
