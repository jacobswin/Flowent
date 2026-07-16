import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createCurrentBranchUpdate,
  isCurrentBranchMode,
  parsePushUpdates,
  pathRequiresReadmeReview,
  validatePushUpdates,
} from './check-readme-before-push.mjs'

const ZERO_SHA = '0'.repeat(40)

function update(overrides = {}) {
  return {
    localRef: 'refs/heads/main',
    localSha: 'a'.repeat(40),
    remoteRef: 'refs/heads/main',
    remoteSha: 'b'.repeat(40),
    ...overrides,
  }
}

describe('README pre-push validation', () => {
  it('recognizes explicit current-branch mode without waiting for hook input', () => {
    expect(isCurrentBranchMode(['--current'])).toBe(true)
    expect(isCurrentBranchMode([])).toBe(false)
  })

  it('builds a manual check from the current branch and its upstream', () => {
    const values = new Map([
      ['symbolic-ref --quiet HEAD', 'refs/heads/main\n'],
      ['rev-parse HEAD', `${'a'.repeat(40)}\n`],
      ['symbolic-ref --quiet refs/remotes/origin/main', 'refs/remotes/origin/main\n'],
      ['rev-parse @{upstream}', `${'b'.repeat(40)}\n`],
      ['rev-parse --symbolic-full-name @{upstream}', 'refs/remotes/origin/main\n'],
    ])
    const runGitCommand = (args) => values.get(args.join(' ')) ?? ''

    expect(createCurrentBranchUpdate(runGitCommand)).toEqual(update({
      remoteRef: 'refs/remotes/origin/main',
    }))
  })

  it('parses every ref update supplied by Git', () => {
    const input = [
      `refs/heads/main ${'a'.repeat(40)} refs/heads/main ${'b'.repeat(40)}`,
      `refs/heads/topic ${'c'.repeat(40)} refs/heads/topic ${ZERO_SHA}`,
    ].join('\n')

    expect(parsePushUpdates(input)).toEqual([
      update(),
      update({
        localRef: 'refs/heads/topic',
        localSha: 'c'.repeat(40),
        remoteRef: 'refs/heads/topic',
        remoteSha: ZERO_SHA,
      }),
    ])
  })

  it.each([
    'src/features/canvas/ProcessCanvas.tsx',
    'server/ai/aiRoute.ts',
    'e2e/canvas-modeling.spec.ts',
    'public/favicon.svg',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'tsconfig.app.json',
    'eslint.config.js',
    'playwright.config.ts',
    '.github/workflows/verify.yml',
    'index.html',
  ])('treats %s as a functional project path', (path) => {
    expect(pathRequiresReadmeReview(path)).toBe(true)
  })

  it.each([
    'README.md',
    'docs/architecture.md',
    'data/library.json',
    'data/library.broken-123.json',
    '.agents/skills/process-mapper/SKILL.md',
    '.claude/settings.json',
  ])('does not treat %s as a functional project path', (path) => {
    expect(pathRequiresReadmeReview(path)).toBe(false)
  })

  it('blocks functional changes when README is absent from the pushed range', async () => {
    const result = await validatePushUpdates([update()], async () => [
      'src/features/canvas/ProcessCanvas.tsx',
      'server/index.ts',
    ])

    expect(result.ok).toBe(false)
    expect(result.violations).toEqual([
      expect.objectContaining({ remoteRef: 'refs/heads/main' }),
    ])
  })

  it('allows functional changes when README is reviewed in the pushed range', async () => {
    const result = await validatePushUpdates([update()], async () => [
      'src/features/canvas/ProcessCanvas.tsx',
      'README.md',
    ])

    expect(result).toEqual({ ok: true, violations: [] })
  })

  it('allows documentation-only changes without another README edit', async () => {
    const result = await validatePushUpdates([update()], async () => [
      'docs/superpowers/specs/readme-design.md',
    ])

    expect(result).toEqual({ ok: true, violations: [] })
  })

  it('ignores deleted refs', async () => {
    const listChangedFiles = vi.fn(async () => ['src/App.tsx'])

    const result = await validatePushUpdates([
      update({ localRef: '(delete)', localSha: ZERO_SHA }),
    ], listChangedFiles)

    expect(result).toEqual({ ok: true, violations: [] })
    expect(listChangedFiles).not.toHaveBeenCalled()
  })

  it('checks new remote refs with the same policy', async () => {
    const newRef = update({ remoteRef: 'refs/heads/topic', remoteSha: ZERO_SHA })

    const result = await validatePushUpdates([newRef], async () => [
      'src/App.tsx',
      'README.md',
    ])

    expect(result).toEqual({ ok: true, violations: [] })
  })

  it('reports each violating ref in a multi-ref push', async () => {
    const main = update()
    const topic = update({
      localRef: 'refs/heads/topic',
      localSha: 'c'.repeat(40),
      remoteRef: 'refs/heads/topic',
      remoteSha: 'd'.repeat(40),
    })

    const result = await validatePushUpdates([main, topic], async (candidate) => (
      candidate.remoteRef.endsWith('/main')
        ? ['README.md', 'src/App.tsx']
        : ['server/index.ts']
    ))

    expect(result.ok).toBe(false)
    expect(result.violations.map((violation) => violation.remoteRef)).toEqual([
      'refs/heads/topic',
    ])
  })
})

describe('README pre-push repository wiring', () => {
  it('exposes setup and direct validation commands in package.json', () => {
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))

    expect(packageJson.scripts['setup:git-hooks']).toBe('git config core.hooksPath .githooks')
    expect(packageJson.scripts['check:readme']).toBe('node scripts/check-readme-before-push.mjs --current')
  })

  it('delegates the pre-push hook to the Node validator', () => {
    const hook = readFileSync(resolve('.githooks/pre-push'), 'utf8')

    expect(hook).toContain('node scripts/check-readme-before-push.mjs "$@"')
  })
})
