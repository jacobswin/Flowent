import { describe, expect, it } from 'vitest'
import { extractTextFromGenerateRequest } from './extractInputText'

describe('extractInputText', () => {
  it('reads pasted JSON input and reports no file warnings', async () => {
    const result = await extractTextFromGenerateRequest(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputText: 'A starts work, then B reviews it.' }),
    }))

    expect(result.inputText).toBe('A starts work, then B reviews it.')
    expect(result.warnings).toEqual([])
  })

  it('reads validated process intelligence settings from the generation request', async () => {
    const result = await extractTextFromGenerateRequest(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inputText: 'Review the release.',
        processAnalysis: { profile: 'manufacturing', wip: 6 },
      }),
    }))

    expect(result.processAnalysis).toEqual({ profile: 'manufacturing', wip: 6 })
  })

  it('accepts an automotive profile from a generation request', async () => {
    const result = await extractTextFromGenerateRequest(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inputText: 'Validate the DVP report before release.',
        processAnalysis: { profile: 'automotive', wip: 4 },
      }),
    }))

    expect(result.processAnalysis).toEqual({ profile: 'automotive', wip: 4 })
  })

  it('extracts text files from multipart requests', async () => {
    const request = multipartRequest('process.md', 'text/markdown', '# Process\nReview release readiness.')

    const result = await extractTextFromGenerateRequest(request)

    expect(result.inputText).toContain('Review release readiness.')
    expect(result.sourceName).toBe('process.md')
  })

  it('rejects legacy binary office files with an explicit message', async () => {
    const request = multipartRequest('process.ppt', 'application/vnd.ms-powerpoint', 'legacy')

    await expect(extractTextFromGenerateRequest(request)).rejects.toThrow(/not supported/i)
  })
})

function multipartRequest(filename: string, contentType: string, content: string): Request {
  const boundary = '----flowent-test-boundary'
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="inputFile"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return new Request('http://test/api/ai/generate-map', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
  })
}
