import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import WebSocket from 'ws'
import { closeHelpCache, initHelpCache, putCachedHelp } from '../../api-server/src/help-cache.mjs'

const exec = promisify(execFile)
const root = path.resolve('.')

/** Create a separate build tree so tests do not alter a running development stack. */
async function createTestProject(dir) {
  const project = path.join(dir, 'project')
  await mkdir(project)
  for (const name of ['prsm4', 'css', 'js', 'icons', 'fonts', 'utils']) {
    await cp(path.join(root, name), path.join(project, name), { recursive: true })
  }
  for (const name of ['package.json', 'package-lock.json', '.parcelrc']) {
    await cp(path.join(root, name), path.join(project, name))
  }
  for (const name of ['node_modules', 'api-server', 'ws-server']) {
    await symlink(path.join(root, name), path.join(project, name), 'dir')
  }
  return project
}

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
    const project = await createTestProject(dir)
    const launcher = path.join(project, 'utils/prsm4-local.mjs')
    const httpPort = await unusedPort()
    let wsPort = await unusedPort()
    while (wsPort === httpPort) wsPort = await unusedPort()
    let apiPort = await unusedPort()
    while (apiPort === httpPort || apiPort === wsPort) apiPort = await unusedPort()
    const secrets = createHttpServer((request, response) => {
      request.resume()
      response.writeHead(200, { 'content-type': 'application/x-amz-json-1.1' })
      response.end(
        JSON.stringify({ SecretString: JSON.stringify({ BEDROCK_API_KEY: 'test-key' }) })
      )
    })
    await new Promise((resolve) => secrets.listen(0, '127.0.0.1', resolve))
    const env = {
      ...process.env,
      PRSM4_LOCAL_DIR: path.join(dir, 'state'),
      PRSM4_DB_DIR: path.join(dir, 'db'),
      PRSM4_HTTP_PORT: String(httpPort),
      PRSM4_WS_PORT: String(wsPort),
      PRSM4_API_PORT: String(apiPort),
      HELP_CACHE_LOCATION: path.join(dir, 'help.db'),
      DONT_CACHE_HELP: 'false',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'false',
      AWS_ENDPOINT_URL: `http://127.0.0.1:${secrets.address().port}`,
      AWS_ENDPOINT_URL_SECRETS_MANAGER: `http://127.0.0.1:${secrets.address().port}`,
    }
    delete env.AWS_PROFILE
    delete env.AWS_SESSION_TOKEN
    const run = (action, options = {}) =>
      exec(process.execPath, [launcher, action], { cwd: project, env, ...options })
    const clients = []
    try {
      await initHelpCache({ path: env.HELP_CACHE_LOCATION })
      assert.equal(
        await putCachedHelp({
          question: 'test question',
          response: 'Cached answer',
          outcome: 'ok',
        }),
        true
      )
      await closeHelpCache()
      await run('start')
      await assert.rejects(run('start'), /state already exists/)
      const url = `http://127.0.0.1:${httpPort}`
      const redirect = await fetch(`${url}/prsm4.html`, { redirect: 'manual' })
      assert.equal(redirect.status, 302)
      assert.equal(
        new URL(redirect.headers.get('location'), url).searchParams.get('ws'),
        `ws://localhost:${wsPort}`
      )
      assert.equal(new URL(redirect.headers.get('location'), url).searchParams.get('localApi'), '1')
      const withWebsocket = await fetch(`${url}/prsm4.html?ws=ws%3A%2F%2Fexample.com`, {
        redirect: 'manual',
      })
      assert.equal(
        new URL(withWebsocket.headers.get('location'), url).searchParams.get('localApi'),
        '1'
      )
      assert.equal(
        new URL(withWebsocket.headers.get('location'), url).searchParams.get('ws'),
        'ws://example.com'
      )
      const html = await fetch(`${url}${redirect.headers.get('location')}`)
      assert.equal(html.status, 200)
      const script = (await html.text()).match(/<script type="module" src="([^"]+)"/)[1]
      assert.match((await fetch(`${url}/${script}`)).headers.get('content-type'), /javascript/)
      assert.equal((await fetch(`${url}/__prsm4_local`, { method: 'POST' })).status, 403)
      assert.equal((await fetch(`${url}/not-a-file`)).status, 404)
      const helpRequest = {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: url },
        body: JSON.stringify({
          messages: [{ role: 'user', content: [{ text: 'test question' }] }],
          room: 'ABC-DEF-GHI-JKL',
        }),
      }
      const answer = await fetch(`${url}/api/helpAssistant`, helpRequest)
      assert.equal(answer.status, 200)
      assert.equal((await answer.json()).response, 'Cached answer')
      const invalid = await fetch(`${url}/api/helpAssistant`, {
        ...helpRequest,
        body: JSON.stringify({ messages: [{ role: 'user', content: [{ text: '' }] }] }),
      })
      assert.equal(invalid.status, 400)
      assert.equal((await invalid.json()).error, 'Message is required')
      assert.equal(
        (
          await fetch(`${url}/api/helpAssistant`, {
            ...helpRequest,
            headers: { ...helpRequest.headers, origin: 'https://example.com' },
          })
        ).status,
        403
      )

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
      await assert.rejects(fetch(`http://127.0.0.1:${apiPort}/api/helpAssistant`))
      await run('start')
      const reopened = await connect(wsPort)
      clients.push(reopened)
      assert.equal(reopened.doc.getMap('meta').get('test'), 'persisted')

      const conflictEnv = { ...env, PRSM4_LOCAL_DIR: path.join(dir, 'conflict') }
      await assert.rejects(run('start', { env: conflictEnv }), /startup failed/)
      await assert.rejects(readFile(path.join(dir, 'conflict', 'state.json')), { code: 'ENOENT' })
      assert.equal((await fetch(`${url}/prsm4.html`)).status, 200)
      let conflictHttpPort = await unusedPort()
      while ([httpPort, wsPort, apiPort].includes(conflictHttpPort)) {
        conflictHttpPort = await unusedPort()
      }
      let conflictWsPort = await unusedPort()
      while ([httpPort, wsPort, apiPort, conflictHttpPort].includes(conflictWsPort)) {
        conflictWsPort = await unusedPort()
      }
      const apiConflictEnv = {
        ...env,
        PRSM4_LOCAL_DIR: path.join(dir, 'api-conflict'),
        PRSM4_DB_DIR: path.join(dir, 'api-conflict-db'),
        PRSM4_HTTP_PORT: String(conflictHttpPort),
        PRSM4_WS_PORT: String(conflictWsPort),
        HELP_CACHE_LOCATION: path.join(dir, 'api-conflict-help.db'),
      }
      await assert.rejects(run('start', { env: apiConflictEnv }), /startup failed/)
      await assert.rejects(readFile(path.join(dir, 'api-conflict', 'state.json')), {
        code: 'ENOENT',
      })
      assert.match(
        await readFile(path.join(dir, 'api-conflict', 'stack.log'), 'utf8'),
        /EADDRINUSE/
      )
      assert.equal((await fetch(`${url}/api/helpAssistant`, helpRequest)).status, 200)
      await assert.rejects(fetch(`http://127.0.0.1:${conflictHttpPort}/prsm4.html`))
    } finally {
      for (const client of clients) {
        client.provider.destroy()
        client.doc.destroy()
      }
      await closeHelpCache()
      await run('stop')
      await new Promise((resolve, reject) =>
        secrets.close((error) => (error ? reject(error) : resolve()))
      )
      await rm(dir, { recursive: true, force: true })
    }
  }
)
