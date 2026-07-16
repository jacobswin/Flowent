import { spawn } from 'node:child_process'
import { join } from 'node:path'

const webPort = process.env.FLOWENT_E2E_WEB_PORT ?? '5174'
const apiPort = process.env.FLOWENT_E2E_API_PORT ?? '8788'
const libraryFile = process.env.FLOWENT_E2E_LIBRARY_FILE ?? '/tmp/flowent-e2e-library.json'

const env = {
  ...process.env,
  FLOWENT_API_PORT: apiPort,
  FLOWENT_LIBRARY_FILE: libraryFile,
}

const binSuffix = process.platform === 'win32' ? '.cmd' : ''
const localBin = (name) => join(process.cwd(), 'node_modules', '.bin', `${name}${binSuffix}`)

const children = [
  spawn(localBin('vite'), ['preview', '--host', '127.0.0.1', '--port', webPort, '--strictPort'], {
    env,
    stdio: 'inherit',
  }),
  spawn(localBin('tsx'), ['server/index.ts'], {
    env,
    stdio: 'inherit',
  }),
]

let shuttingDown = false

function stopChildren(signal = 'SIGTERM') {
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shuttingDown = true
    stopChildren()
    process.exitCode = code ?? (signal ? 1 : 0)
  })
}

process.on('SIGINT', () => {
  shuttingDown = true
  stopChildren('SIGINT')
})

process.on('SIGTERM', () => {
  shuttingDown = true
  stopChildren('SIGTERM')
})
