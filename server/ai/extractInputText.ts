import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import JSZip from 'jszip'
import type { ProcessAnalysisSettings } from '../../src/features/canvas/canvasTypes'
import { isProcessIntelligenceProfile } from '../../src/features/canvas/processIntelligenceProfiles'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_CHARS = 80_000

export type ExtractedGenerateInput = {
  providerId?: string
  model?: string
  processAnalysis?: ProcessAnalysisSettings
  inputText: string
  sourceName?: string
  warnings: string[]
}

export async function extractTextFromGenerateRequest(request: Request): Promise<ExtractedGenerateInput> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    return extractMultipart(request)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    throw new Error('Request body must be valid JSON or multipart form data.')
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Request body must include inputText.')
  }
  const record = payload as Record<string, unknown>
  const inputText = typeof record.inputText === 'string' ? record.inputText.trim() : ''
  if (!inputText) throw new Error('Please provide text or upload a supported file before generating a map.')

  return {
    providerId: typeof record.providerId === 'string' ? record.providerId : undefined,
    model: typeof record.model === 'string' ? record.model : undefined,
    ...(readProcessAnalysis(record.processAnalysis) ? { processAnalysis: readProcessAnalysis(record.processAnalysis) } : {}),
    ...truncateText(inputText),
  }
}

async function extractMultipart(request: Request): Promise<ExtractedGenerateInput> {
  const form = await parseMultipartRequest(request)
  const providerId = readOptionalString(form.get('providerId') ?? null)
  const model = readOptionalString(form.get('model') ?? null)
  const processAnalysis = readProcessAnalysis(readOptionalString(form.get('processAnalysis') ?? null))
  const pastedText = readOptionalString(form.get('inputText') ?? null)
  const file = form.get('inputFile') ?? null

  if (isUploadFile(file) && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Uploaded file is larger than the 10MB limit.')
    }
    const extracted = await extractFileText(file)
    return { providerId, model, ...(processAnalysis ? { processAnalysis } : {}), sourceName: file.name, ...truncateText(extracted) }
  }

  if (pastedText) {
    return { providerId, model, ...(processAnalysis ? { processAnalysis } : {}), ...truncateText(pastedText) }
  }

  throw new Error('Please provide text or upload a supported file before generating a map.')
}

type UploadFile = {
  name: string
  size: number
  text: () => Promise<string>
  arrayBuffer: () => Promise<ArrayBuffer>
}

async function extractFileText(file: UploadFile): Promise<string> {
  const extension = getExtension(file.name)
  if (['.doc', '.ppt'].includes(extension)) {
    throw new Error('Legacy .doc and .ppt files are not supported. Please upload .docx, .pptx, .pdf, or text files.')
  }

  if (['.txt', '.md', '.csv', '.json'].includes(extension)) {
    return file.text()
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  if (extension === '.pptx') {
    return extractPptxText(buffer)
  }
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()
    if (!result.text.trim()) {
      throw new Error('This PDF does not contain selectable text. Scanned PDFs are not supported yet.')
    }
    return result.text
  }

  throw new Error('Unsupported file type. Upload .txt, .md, .csv, .json, .docx, .pptx, or .pdf.')
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const chunks: string[] = []
  for (const fileName of slideFiles) {
    const xml = await zip.files[fileName].async('string')
    const matches = xml.matchAll(/<a:t>(.*?)<\/a:t>/g)
    for (const match of matches) {
      chunks.push(decodeXmlText(match[1]))
    }
  }
  const text = chunks.join('\n').trim()
  if (!text) throw new Error('This .pptx file did not contain extractable slide text.')
  return text
}

function truncateText(text: string): { inputText: string; warnings: string[] } {
  if (text.length <= MAX_TEXT_CHARS) return { inputText: text, warnings: [] }
  return {
    inputText: text.slice(0, MAX_TEXT_CHARS),
    warnings: [`Input text was truncated to ${MAX_TEXT_CHARS.toLocaleString('en-US')} characters before sending it to the selected provider.`],
  }
}

type MultipartValue = string | UploadFile

async function parseMultipartRequest(request: Request): Promise<Map<string, MultipartValue>> {
  const contentType = request.headers.get('content-type') ?? ''
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1]?.replace(/^"|"$/g, '')
  if (!boundary) throw new Error('Multipart request is missing a boundary.')

  const body = Buffer.from(await request.arrayBuffer())
  const parts = splitMultipartBody(body, boundary)
  const result = new Map<string, MultipartValue>()

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd < 0) continue
    const headerText = part.slice(0, headerEnd).toString('utf8')
    const content = trimTrailingCrlf(part.slice(headerEnd + 4))
    const name = headerText.match(/name="([^"]+)"/)?.[1]
    if (!name) continue
    const filename = headerText.match(/filename="([^"]*)"/)?.[1]
    if (filename !== undefined) {
      result.set(name, {
        name: filename,
        size: content.length,
        text: async () => content.toString('utf8'),
        arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer,
      })
    } else {
      result.set(name, content.toString('utf8'))
    }
  }

  return result
}

function splitMultipartBody(body: Buffer, boundary: string): Buffer[] {
  const boundaryText = `--${boundary}`
  const sections = body.toString('latin1').split(boundaryText)
  return sections
    .slice(1, -1)
    .map((section) => Buffer.from(section.replace(/^\r\n/, ''), 'latin1'))
    .filter((section) => section.length > 0)
}

function trimTrailingCrlf(buffer: Buffer): Buffer {
  if (buffer.length >= 2 && buffer[buffer.length - 2] === 13 && buffer[buffer.length - 1] === 10) {
    return buffer.slice(0, -2)
  }
  return buffer
}

function readOptionalString(value: MultipartValue | FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readProcessAnalysis(value: unknown): ProcessAnalysisSettings | undefined {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return undefined
    }
  }
  if (!candidate || typeof candidate !== 'object') return undefined
  const record = candidate as Record<string, unknown>
  if (!isProcessIntelligenceProfile(record.profile)) return undefined
  const wip = typeof record.wip === 'number' && Number.isFinite(record.wip) && record.wip > 0 ? record.wip : undefined
  return { profile: record.profile as ProcessAnalysisSettings['profile'], ...(wip ? { wip } : {}) }
}

function isUploadFile(value: unknown): value is UploadFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<UploadFile>
  return typeof candidate.name === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.text === 'function' &&
    typeof candidate.arrayBuffer === 'function'
}

function getExtension(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
