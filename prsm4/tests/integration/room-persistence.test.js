import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import WebSocket from 'ws'
import { initialiseClone } from '../../src/app/clone.js'
import { docName } from '../../src/app/room.js'

async function unusedPort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return port
}

function waitFor(check, description) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - start > 10000) {
        clearInterval(timer)
        reject(new Error(`Timed out waiting for ${description}`))
      }
    }, 20)
  })
}

test('a room without disk persistence survives all clients leaving', async () => {
  const port = await unusedPort()
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
  const clients = []
  const connect = async (room) => {
    const doc = new Y.Doc()
    const provider = new WebsocketProvider(`ws://127.0.0.1:${port}`, room, doc, {
      WebSocketPolyfill: WebSocket,
    })
    clients.push({ provider, doc })
    await waitFor(() => provider.synced, 'client sync')
    return { provider, doc }
  }
  try {
    await waitFor(() => output.includes('running at'), 'server startup')
    const a = await connect('test-room-a')
    const peer = await connect('test-room-a')
    a.doc.getMap('nodes').set('factor', { label: 'loaded factor' })
    await waitFor(() => peer.doc.getMap('nodes').has('factor'), 'factor sync')
    a.provider.destroy()
    peer.provider.destroy()
    await waitFor(() => output.includes('Keeping document "test-room-a"'), 'last client disconnect')
    const b = await connect('test-room-b')
    b.provider.destroy()
    const reopened = await connect('test-room-a')
    assert.deepEqual(reopened.doc.getMap('nodes').get('factor'), { label: 'loaded factor' })
    const snapshot = {
      meta: { title: 'Copy test', settings: { sizing: 'Equal' } },
      styles: { group1: { kind: 'node', name: 'Example', css: {} } },
      nodes: [{ id: 'factor', label: 'loaded factor', x: 10, y: 20 }],
      edges: [],
    }
    const serverUrl = `ws://127.0.0.1:${port}`
    const release = await initialiseClone(snapshot, serverUrl, 'CLONE-TEST', {
      WebSocketPolyfill: WebSocket,
    })
    const clone = await connect(docName('CLONE-TEST'))
    release()
    assert.equal(clone.doc.getMap('meta').get('title'), 'Copy test')
    assert.deepEqual(clone.doc.getMap('nodes').get('factor'), {
      label: 'loaded factor',
      x: 10,
      y: 20,
    })
    assert.deepEqual(clone.doc.getMap('styles').get('group1'), snapshot.styles.group1)
    clone.doc.getMap('nodes').set('factor', { label: 'changed copy' })
    assert.deepEqual(reopened.doc.getMap('nodes').get('factor'), { label: 'loaded factor' })
    await assert.rejects(
      initialiseClone(snapshot, serverUrl, 'CLONE-TEST', { WebSocketPolyfill: WebSocket }),
      /already in use/
    )
    assert.equal(clone.doc.getMap('nodes').get('factor').label, 'changed copy')
  } finally {
    for (const { provider, doc } of clients) {
      provider.destroy()
      doc.destroy()
    }
    server.kill('SIGTERM')
    await new Promise((resolve) => server.once('exit', resolve))
  }
})
