#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const ZERO_SHA_PATTERN = /^0+$/
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i

const FUNCTIONAL_PREFIXES = [
  'src/',
  'server/',
  'e2e/',
  'public/',
  'scripts/',
  '.githooks/',
  '.github/workflows/',
]

const FUNCTIONAL_ROOT_FILES = new Set([
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'eslint.config.js',
  'playwright.config.ts',
])

export function parsePushUpdates(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/)
      if (!localRef || !localSha || !remoteRef || !remoteSha) {
        throw new Error(`Could not parse pre-push ref update: ${line}`)
      }
      return { localRef, localSha, remoteRef, remoteSha }
    })
}

export function isCurrentBranchMode(args) {
  return args.includes('--current')
}

export function createCurrentBranchUpdate(runGitCommand = runGit) {
  return {
    localRef: runGitCommand(['symbolic-ref', '--quiet', 'HEAD']).trim(),
    localSha: runGitCommand(['rev-parse', 'HEAD']).trim(),
    remoteRef: runGitCommand(['rev-parse', '--symbolic-full-name', '@{upstream}']).trim(),
    remoteSha: runGitCommand(['rev-parse', '@{upstream}']).trim(),
  }
}

export function pathRequiresReadmeReview(rawPath) {
  const path = rawPath.replaceAll('\\', '/').replace(/^\.\//, '')
  if (FUNCTIONAL_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  if (FUNCTIONAL_ROOT_FILES.has(path)) return true
  return /^tsconfig(?:\.[^/]+)?\.json$/.test(path)
}

export async function validatePushUpdates(updates, listChangedFiles) {
  const violations = []

  for (const update of updates) {
    if (ZERO_SHA_PATTERN.test(update.localSha)) continue

    const changedFiles = unique(await listChangedFiles(update))
    const functionalFiles = changedFiles.filter(pathRequiresReadmeReview)
    const readmeReviewed = changedFiles.includes('README.md')

    if (functionalFiles.length > 0 && !readmeReviewed) {
      violations.push({
        localRef: update.localRef,
        remoteRef: update.remoteRef,
        functionalFiles,
      })
    }
  }

  return { ok: violations.length === 0, violations }
}

function listChangedFilesForUpdate(update) {
  assertCommitSha(update.localSha, 'local')

  if (ZERO_SHA_PATTERN.test(update.remoteSha)) {
    const unpushed = runGit([
      'log',
      '--format=',
      '--name-only',
      update.localSha,
      '--not',
      '--remotes',
    ])
    return parseChangedFiles(unpushed)
  }

  assertCommitSha(update.remoteSha, 'remote')
  return parseChangedFiles(runGit([
    'diff',
    '--name-only',
    `${update.remoteSha}..${update.localSha}`,
  ]))
}

function assertCommitSha(value, label) {
  if (!COMMIT_SHA_PATTERN.test(value)) {
    throw new Error(`The ${label} ref did not contain a valid commit SHA.`)
  }
}

function runGit(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args[0]} failed.`)
  }
  return result.stdout
}

function parseChangedFiles(output) {
  return unique(output.split(/\r?\n/).map((path) => path.trim()).filter(Boolean))
}

function unique(values) {
  return [...new Set(values)]
}

async function main() {
  const updates = isCurrentBranchMode(process.argv.slice(2))
    ? [createCurrentBranchUpdate()]
    : parsePushUpdates(readFileSync(0, 'utf8'))
  const result = await validatePushUpdates(updates, listChangedFilesForUpdate)
  if (result.ok) return

  console.error('Flowent README review required before this push.')
  for (const violation of result.violations) {
    console.error(`\n${violation.remoteRef}:`)
    for (const path of violation.functionalFiles.slice(0, 12)) {
      console.error(`  - ${path}`)
    }
    if (violation.functionalFiles.length > 12) {
      console.error(`  - ...and ${violation.functionalFiles.length - 12} more`)
    }
  }
  console.error('\nReview Current capabilities, Current plan, TODO, and Quality status in README.md, commit the update, then push again.')
  process.exitCode = 1
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`Flowent README check failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
