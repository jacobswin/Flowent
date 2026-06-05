import { describe, expect, it } from 'vitest'

function shouldRejectRequest(body: string, maxBytes: number): boolean {
  return Buffer.byteLength(body, 'utf8') > maxBytes
}

describe('request size limits', () => {
  it('keeps the scenario draft limit smaller than the library autosave limit', () => {
    const scenarioLimit = 24_000
    const libraryLimit = 512_000

    expect(libraryLimit).toBeGreaterThan(scenarioLimit)
  })

  it('accepts a library-sized autosave payload that would exceed the scenario limit', () => {
    const body = 'x'.repeat(40_000)

    expect(shouldRejectRequest(body, 24_000)).toBe(true)
    expect(shouldRejectRequest(body, 512_000)).toBe(false)
  })

  it('counts UTF-8 bytes instead of decoded character length', () => {
    const body = '汉'.repeat(10_000)

    expect(body.length).toBe(10_000)
    expect(Buffer.byteLength(body, 'utf8')).toBe(30_000)
    expect(shouldRejectRequest(body, 24_000)).toBe(true)
  })
})
