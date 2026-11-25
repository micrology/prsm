#!/usr/bin/env node
/**
 * Concurrent PRSM 4 edit stress test, adapted from utils/stress-test-prsm.mjs.
 *
 * Headless Yjs clients create pairs of factors and links, then delete them.
 * This exercises collaboration and persistence, not browser rendering.
 * By default it uses a new room on the local PRSM 4 websocket server.
 */

import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import process from 'node:process'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import WebSocket from 'ws'
import { MapStore } from '../src/graph/store.js'
import { createDefaultMap } from '../src/graph/defaults.js'
import { docName, generateRoom, roomFromUrl, serverUrl } from '../src/app/room.js'

// Each websocket provider registers an exit handler.
process.setMaxListeners(0)

const DEFAULTS = {
  clients: 10,
  factors: 10,
  cycles: 0,
  delayMs: 150,
  cyclePauseMs: 500,
  rampMs: 200,
  machine: hostname().split('.')[0].slice(0, 12) || 'host',
  connectTimeoutMs: 30000,
  flushMs: 3000,
  ws: 'ws://localhost:1235',
}

/** Print the available command-line options. */
function printHelp() {
  console.log(`PRSM 4 stress test (headless Yjs clients)

Usage: node prsm4/tests/stress-test-prsm4.mjs [options]

  --room <id>               Map room (default: a new random room)
  --url <prsm4-url>         Use the room and websocket override from a PRSM 4 URL
  --ws <url>                Websocket server (default: ${DEFAULTS.ws})
  --clients <n>             Concurrent clients (default: ${DEFAULTS.clients})
  --factors <n>             Factors per client per cycle, rounded up to even (default: ${DEFAULTS.factors})
  --cycles <n>              Cycles per client; 0 runs until interrupted (default: 0)
  --delay-ms <n>            Delay between pair operations (default: ${DEFAULTS.delayMs})
  --cycle-pause-ms <n>      Delay between cycles (default: ${DEFAULTS.cyclePauseMs})
  --ramp-ms <n>             Stagger client connections (default: ${DEFAULTS.rampMs})
  --machine <id>            Label for this machine
  --connect-timeout-ms <n>  Initial sync timeout (default: ${DEFAULTS.connectTimeoutMs})
  --flush-ms <n>            Wait for updates to propagate (default: ${DEFAULTS.flushMs})
  --cleanup-only            Delete matching factors and their connected links
  --cleanup-prefix <prefix> Required with --cleanup-only; must begin with Stress-
  -h, --help                Show this help

Cleanup-only also requires --room or --url. Normal shutdown removes only this run's factors.`)
}

/** Parse and validate command-line options. */
function parseArgs(argv) {
  const opts = { ...DEFAULTS }
  const numeric = {
    '--clients': ['clients', 1],
    '--factors': ['factors', 2],
    '--cycles': ['cycles', 0],
    '--delay-ms': ['delayMs', 0],
    '--cycle-pause-ms': ['cyclePauseMs', 0],
    '--ramp-ms': ['rampMs', 0],
    '--connect-timeout-ms': ['connectTimeoutMs', 1],
    '--flush-ms': ['flushMs', 0],
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--cleanup-only') {
      opts.cleanupOnly = true
      continue
    }
    const value = argv[++i]
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value after ${arg}`)
    if (numeric[arg]) {
      const [key, min] = numeric[arg]
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min) {
        throw new Error(`Invalid value for ${arg}: ${value}`)
      }
      opts[key] = Number(value)
    } else if (arg === '--room') {
      opts.room = value.toUpperCase()
    } else if (arg === '--url') {
      opts.url = new URL(value)
      opts.room = roomFromUrl(opts.url)
    } else if (arg === '--ws') {
      opts.ws = value
      opts.wsExplicit = true
    } else if (arg === '--machine') {
      opts.machine = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)
      if (!opts.machine) throw new Error('Machine name must contain letters or digits')
    } else if (arg === '--cleanup-prefix') {
      opts.cleanupPrefix = value
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (
    opts.cleanupOnly &&
    (!opts.room || !opts.cleanupPrefix?.startsWith('Stress-') || opts.cleanupPrefix === 'Stress-')
  ) {
    throw new Error(
      'Cleanup requires a room and a specific --cleanup-prefix beginning with Stress-'
    )
  }
  opts.room ||= generateRoom()
  if (opts.url && !opts.wsExplicit) {
    const localStack =
      ['localhost', '127.0.0.1'].includes(opts.url.hostname) && opts.url.port === '4174'
    opts.ws = opts.url.searchParams.get('ws') || (localStack ? DEFAULTS.ws : serverUrl(opts.url))
  }
  const ws = new URL(opts.ws)
  if (!['ws:', 'wss:'].includes(ws.protocol)) throw new Error('Websocket URL must use ws: or wss:')
  if (opts.factors % 2) opts.factors++
  return opts
}

/** Wait for the configured delay or an interruption. */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted || ms === 0) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal?.addEventListener('abort', finish, { once: true })
  })
}

/** Wait for a websocket provider to complete its initial synchronization. */
function waitForSync(provider, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve()
    if (signal?.aborted) {
      return reject(new DOMException('Interrupted while connecting', 'AbortError'))
    }
    const finish = (error) => {
      clearTimeout(timer)
      provider.off('sync', onSync)
      signal?.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve()
    }
    const onSync = (synced) => {
      if (synced) finish()
    }
    const onAbort = () => finish(new DOMException('Interrupted while connecting', 'AbortError'))
    const timer = setTimeout(
      () => finish(new Error('Timed out waiting for websocket sync')),
      timeoutMs
    )
    provider.on('sync', onSync)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Connect a separate PRSM 4 document to the target room. */
async function connect(opts, signal) {
  const store = new MapStore(new Y.Doc())
  const provider = new WebsocketProvider(opts.ws, docName(opts.room), store.doc, {
    WebSocketPolyfill: WebSocket,
    disableBc: true,
  })
  try {
    await waitForSync(provider, opts.connectTimeoutMs, signal)
    return { store, provider }
  } catch (error) {
    provider.destroy()
    store.doc.destroy()
    throw error
  }
}

/** Close a client and its document. */
function disconnect(client) {
  client.provider.awareness.setLocalState(null)
  client.provider.destroy()
  client.store.doc.destroy()
}

/** Initialize a genuinely empty room, without replacing an existing map. */
async function initializeRoom(opts, signal) {
  const client = await connect(opts, signal)
  try {
    const { store } = client
    if (store.meta.get('viewOnly')) throw new Error('The target map is read-only')
    if (!store.styles.size) {
      if (store.nodes.size || store.edges.size || store.meta.size) {
        throw new Error('The target room has data but no styles; refusing to replace it')
      }
      store.loadFile(createDefaultMap())
      await sleep(opts.flushMs, signal)
    }
  } finally {
    disconnect(client)
  }
}

/** Create one pair of factors and their link using PRSM 4's map store. */
function createPair(client, stats, cycle, pair) {
  const { store, name, owned } = client
  const x = ((client.index * 17 + pair * 13) % 40) * 40 - 400
  const y = ((client.index * 11 + cycle * 7 + pair * 19) % 30) * 40 - 300
  const label = `${name} c${cycle} p${pair}`
  const ids = []
  owned.push(ids)
  ids.push(store.addNode({ label: `${label} A`, x, y, style: 'group0' }))
  stats.created++
  ids.push(store.addNode({ label: `${label} B`, x: x + 180, y: y + 40, style: 'group0' }))
  stats.created++
  const edge = store.addEdge({ source: ids[0], target: ids[1], label: '', style: 'edge0' })
  if (!edge) throw new Error('Could not create link between stress factors')
  stats.linked++
}

/** Execute create/link/delete cycles for one client. */
async function runClient(client, opts, stats, signal) {
  for (let cycle = 1; !signal.aborted && (!opts.cycles || cycle <= opts.cycles); cycle++) {
    const started = Date.now()
    for (let pair = 1; pair <= opts.factors / 2 && !signal.aborted; pair++) {
      createPair(client, stats, cycle, pair)
      await sleep(opts.delayMs, signal)
    }
    await sleep(Math.max(opts.delayMs, 50), signal)
    while (client.owned.length && !signal.aborted) {
      const ids = client.owned.shift()
      client.store.remove(ids)
      stats.deleted += ids.length
      await sleep(opts.delayMs, signal)
    }
    if (signal.aborted) break
    client.store.undoManager.clear()
    stats.cycles++
    if (cycle === 1 || cycle % 5 === 0) {
      console.log(`[${client.name}] cycle ${cycle} done in ${Date.now() - started}ms`)
    }
    if (!opts.cycles || cycle < opts.cycles) await sleep(opts.cyclePauseMs, signal)
  }
}

/** Delete matching factors and their connected links, then verify using a new connection. */
async function cleanupRoom(opts, prefix) {
  const client = await connect(opts)
  try {
    const ids = [...client.store.nodes.entries()]
      .filter(([, node]) => typeof node.label === 'string' && node.label.startsWith(prefix))
      .map(([id]) => id)
    const idSet = new Set(ids)
    const edges = [...client.store.edges.values()].filter(
      (edge) => idSet.has(edge.source) || idSet.has(edge.target)
    ).length
    if (ids.length) client.store.remove(ids)
    await sleep(opts.flushMs)
    console.log(
      `Cleanup: deleted ${ids.length} factors and ${edges} connected links (prefix ${prefix})`
    )
  } finally {
    disconnect(client)
  }
  const verify = await connect(opts)
  try {
    const remaining = [...verify.store.nodes.values()].filter(
      (node) => typeof node.label === 'string' && node.label.startsWith(prefix)
    )
    if (remaining.length) throw new Error(`${remaining.length} stress factors remain after cleanup`)
  } finally {
    disconnect(verify)
  }
}

/** Run the requested stress test and report its results. */
async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return printHelp()
  if (opts.cleanupOnly) return cleanupRoom(opts, opts.cleanupPrefix)

  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  const prefix = `Stress-${opts.machine}-${randomUUID()}-`
  const stats = { created: 0, linked: 0, deleted: 0, cycles: 0 }
  const clients = []
  const started = Date.now()
  const observer = new URL(opts.url || 'http://localhost:4174/prsm4.html')
  observer.searchParams.set('room', opts.room)
  observer.searchParams.set('ws', opts.ws)
  console.log(`PRSM 4 stress test
  room: ${opts.room}
  websocket: ${opts.ws}
  clients: ${opts.clients}
  factors: ${opts.factors} per client per cycle
  cycles: ${opts.cycles || 'until interrupted'}
  cleanup prefix: ${prefix}
  observer: ${observer}`)
  let failure
  try {
    await initializeRoom(opts, controller.signal)
    for (let i = 1; i <= opts.clients && !controller.signal.aborted; i++) {
      const client = await connect(opts, controller.signal)
      client.index = i
      client.name = `${prefix}${String(i).padStart(2, '0')}`
      client.owned = []
      clients.push(client)
      client.provider.on('status', ({ status }) => {
        if (status === 'disconnected' && !controller.signal.aborted) {
          failure ||= new Error(`${client.name} lost its websocket connection`)
          controller.abort()
        }
      })
      if (!client.provider.wsconnected) {
        throw new Error(`${client.name} lost its websocket connection`)
      }
      client.store.userName = client.name
      client.provider.awareness.setLocalState({
        user: {
          id: client.store.doc.clientID,
          name: client.name,
          color: '#87ceeb',
          isLight: true,
          anon: false,
          asleep: false,
        },
      })
      console.log(`[${client.name}] synced`)
      await sleep(opts.rampMs, controller.signal)
    }
    const results = await Promise.allSettled(
      clients.map((client) =>
        runClient(client, opts, stats, controller.signal).catch((error) => {
          controller.abort()
          throw error
        })
      )
    )
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length) throw new AggregateError(errors, 'One or more stress clients failed')
  } catch (error) {
    if (!controller.signal.aborted || error.name !== 'AbortError') failure = error
  } finally {
    controller.abort()
    for (const client of clients) {
      for (const ids of client.owned) {
        try {
          client.store.remove(ids)
          stats.deleted += ids.length
        } catch (error) {
          console.error(`Cleanup failed for ${client.name}:`, error)
          failure ||= error
        }
      }
    }
    if (clients.length) {
      await sleep(opts.flushMs)
      for (const client of clients) disconnect(client)
      try {
        await cleanupRoom(opts, prefix)
      } catch (error) {
        console.error(`Final cleanup failed for ${prefix}:`, error)
        failure ||= error
      }
    }
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
  console.log(
    `Stress test summary: ${stats.created} factors created, ${stats.linked} links created, ${stats.deleted} factors deleted, ${stats.cycles} client cycles in ${((Date.now() - started) / 1000).toFixed(1)}s`
  )
  if (failure) throw failure
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
