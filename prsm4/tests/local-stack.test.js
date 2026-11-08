import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import WebSocket from 'ws'

const exec = promisify(execFile)
const launcher = path.resolve('utils/prsm4-local.mjs')

async function unusedPort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return port
}

async function waitFor(check) {
  const deadline = Date.now() + 10000
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for Yjs synchronization')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

async function connect(port) {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(`ws://localhost:${port}`, 'prsm4LOCAL-TEST', doc, {
    WebSocketPolyfill: WebSocket,
  })
  try {
    await waitFor(() => provider.synced)
    return { doc, provider }
  } catch (error) {
    provider.destroy()
    doc.destroy()
    throw error
  }
}

test(
  'local stack serves the app, persists rooms, handles conflicts and stops',
  { timeout: 240000 },
  async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'prsm4-local-test-'))
    const httpPort = await unusedPort()
    let wsPort = await unusedPort()
    while (wsPort === httpPort) wsPort = await unusedPort()
    const env = {
      ...process.env,
      PRSM4_LOCAL_DIR: path.join(dir, 'state'),
      PRSM4_DB_DIR: path.join(dir, 'db'),
      PRSM4_HTTP_PORT: String(httpPort),
      PRSM4_WS_PORT: String(wsPort),
    }
    const run = (action, options = {}) =>
      exec(process.execPath, [launcher, action], { env, ...options })
    const clients = []
    try {
      await run('start')
      await assert.rejects(run('start'), /state already exists/)
      const url = `http://127.0.0.1:${httpPort}`
      const redirect = await fetch(`${url}/prsm4.html`, { redirect: 'manual' })
      assert.equal(redirect.status, 302)
      assert.equal(
        new URL(redirect.headers.get('location'), url).searchParams.get('ws'),
        `ws://localhost:${wsPort}`
      )
      const html = await fetch(`${url}${redirect.headers.get('location')}`)
      assert.equal(html.status, 200)
      const script = (await html.text()).match(/<script type="module" src="([^"]+)"/)[1]
      assert.match((await fetch(`${url}/${script}`)).headers.get('content-type'), /javascript/)
      assert.equal((await fetch(`${url}/__prsm4_local`, { method: 'POST' })).status, 403)
      assert.equal((await fetch(`${url}/not-a-file`)).status, 404)

      const a = await connect(wsPort)
      const b = await connect(wsPort)
      clients.push(a, b)
      a.doc.getMap('meta').set('test', 'persisted')
      await waitFor(() => b.doc.getMap('meta').get('test') === 'persisted')
      for (const client of clients.splice(0)) {
        client.provider.destroy()
        client.doc.destroy()
      }
      await run('stop')
      await assert.rejects(fetch(`${url}/prsm4.html`))
      await run('start')
      const reopened = await connect(wsPort)
      clients.push(reopened)
      assert.equal(reopened.doc.getMap('meta').get('test'), 'persisted')

      const conflictEnv = { ...env, PRSM4_LOCAL_DIR: path.join(dir, 'conflict') }
      await assert.rejects(run('start', { env: conflictEnv }), /startup failed/)
      await assert.rejects(readFile(path.join(dir, 'conflict', 'state.json')), { code: 'ENOENT' })
      assert.equal((await fetch(`${url}/prsm4.html`)).status, 200)
    } finally {
      for (const client of clients) {
        client.provider.destroy()
        client.doc.destroy()
      }
      await run('stop')
      await rm(dir, { recursive: true, force: true })
    }
  }
)
