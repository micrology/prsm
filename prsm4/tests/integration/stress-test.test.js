import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { promisify } from 'node:util'
import cytoscape from 'cytoscape'
import { WebsocketProvider } from 'y-websocket'
import WebSocket from 'ws'
import { MapStore } from '../../src/graph/store.js'
import { createDefaultMap } from '../../src/graph/defaults.js'
import { bindGraph } from '../../src/graph/binding.js'
import { docName } from '../../src/app/room.js'

const exec = promisify(execFile)
const script = 'prsm4/tests/stress-test-prsm4.mjs'

/** Reserve an available local port. */
async function unusedPort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )

  return port
}

/** Wait for an observable condition. */
async function waitFor(check) {
  const deadline = Date.now() + 10000
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for stress test')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test(
  'stress clients synchronize PRSM 4 graph edits and only clean up their own factors',
  { timeout: 30000 },
  async () => {
    const port = await unusedPort()
    const ws = `ws://127.0.0.1:${port}`
    const room = 'TEST-STRESS'
    const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), VERBOSE: '1' }
    delete env.YPERSISTENCE
    const server = spawn(process.execPath, ['ws-server/src/server.js'], { env })
    let output = ''
    server.stdout.on('data', (data) => {
      output += data
    })
    server.stderr.on('data', (data) => {
      output += data
    })
    const store = new MapStore()
    let provider
    let cy
    let unbind
    try {
      await waitFor(() => output.includes('running at'))
      provider = new WebsocketProvider(ws, docName(room), store.doc, {
        WebSocketPolyfill: WebSocket,
      })
      await waitFor(() => provider.synced)
      store.loadFile(createDefaultMap())
      store.nodes.set('prior', { label: 'Stress-unrelated', x: 0, y: 0, style: 'group0' })
      cy = cytoscape({ headless: true, styleEnabled: true })
      unbind = bindGraph(cy, store)
      let sawFactor = false
      let sawLink = false
      store.doc.on('afterTransaction', () => {
        sawFactor ||= cy.nodes().some((node) => node.data('label')?.includes(' c1 p1 A'))
        sawLink ||= cy.edges().some((edge) => edge.source().nonempty() && edge.target().nonempty())
      })
      const result = await exec(process.execPath, [
        script,
        '--room',
        room,
        '--ws',
        ws,
        '--clients',
        '3',
        '--factors',
        '4',
        '--cycles',
        '2',
        '--delay-ms',
        '50',
        '--cycle-pause-ms',
        '0',
        '--ramp-ms',
        '0',
        '--flush-ms',
        '100',
      ])
      assert.match(
        result.stdout,
        /24 factors created, 12 links created, 24 factors deleted, 6 client cycles/
      )
      await waitFor(() => store.nodes.size === 1 && store.edges.size === 0)
      assert.equal(store.nodes.get('prior').label, 'Stress-unrelated')
      assert.ok(sawFactor, 'an observer rendered generated factors')
      assert.ok(sawLink, 'an observer rendered generated links with both endpoints')

      store.nodes.set('old', { label: 'Stress-old-1', x: 1, y: 1, style: 'group0' })
      store.edges.set('old-edge', { source: 'old', target: 'prior', style: 'edge0' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      await exec(process.execPath, [
        script,
        '--cleanup-only',
        '--room',
        room,
        '--ws',
        ws,
        '--cleanup-prefix',
        'Stress-old-',
        '--flush-ms',
        '100',
      ])
      await waitFor(() => !store.nodes.has('old') && !store.edges.has('old-edge'))
      assert.equal(store.nodes.get('prior').label, 'Stress-unrelated')
      await assert.rejects(
        exec(process.execPath, [script, '--cleanup-only', '--room', room]),
        /specific --cleanup-prefix/
      )

      const runner = spawn(process.execPath, [
        script,
        '--room',
        room,
        '--ws',
        ws,
        '--clients',
        '2',
        '--factors',
        '10',
        '--delay-ms',
        '100',
        '--ramp-ms',
        '0',
        '--flush-ms',
        '100',
      ])
      let runnerOutput = ''
      runner.stdout.on('data', (data) => {
        runnerOutput += data
      })
      runner.stderr.on('data', (data) => {
        runnerOutput += data
      })
      const exited = new Promise((resolve) => runner.once('exit', (code) => resolve(code)))
      try {
        await waitFor(() => store.nodes.size > 1)
        runner.kill('SIGINT')
        assert.equal(await exited, 0, runnerOutput)
        await waitFor(() => store.nodes.size === 1 && store.edges.size === 0)
        assert.match(runnerOutput, /Cleanup:/)
      } finally {
        if (runner.exitCode === null && runner.signalCode === null) runner.kill('SIGINT')
        await exited
      }
    } finally {
      unbind?.()
      cy?.destroy()
      provider?.destroy()
      store.doc.destroy()
      server.kill('SIGTERM')
      await new Promise((resolve) => server.once('exit', resolve))
    }
  }
)

test('a lost websocket connection fails the stress run', { timeout: 10000 }, async () => {
  const port = await unusedPort()
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port) }
  delete env.YPERSISTENCE
  const server = spawn(process.execPath, ['ws-server/src/server.js'], { env })
  let serverOutput = ''
  server.stdout.on('data', (data) => {
    serverOutput += data
  })
  let runner
  try {
    await waitFor(() => serverOutput.includes('running at'))
    runner = spawn(process.execPath, [
      script,
      '--room',
      'DISCONNECT-TEST',
      '--ws',
      `ws://127.0.0.1:${port}`,
      '--clients',
      '1',
      '--ramp-ms',
      '0',
      '--flush-ms',
      '20',
      '--connect-timeout-ms',
      '300',
    ])
    let output = ''
    runner.stdout.on('data', (data) => {
      output += data
    })
    runner.stderr.on('data', (data) => {
      output += data
    })
    const exited = new Promise((resolve) => runner.once('exit', (code) => resolve(code)))
    await waitFor(() => output.includes('] synced'))
    const stopped = new Promise((resolve) => server.once('exit', resolve))
    server.kill('SIGTERM')
    await stopped
    assert.equal(await exited, 1)
    assert.match(output, /lost its websocket connection/)
  } finally {
    if (runner && runner.exitCode === null && runner.signalCode === null) runner.kill('SIGTERM')
    if (server.exitCode === null && server.signalCode === null) {
      const stopped = new Promise((resolve) => server.once('exit', resolve))
      server.kill('SIGTERM')
      await stopped
    }
  }
})
