#!/usr/bin/env node
/**
 * PRSM concurrent edit stress test (classic PRSM, not PRSM4).
 *
 * Simulates N concurrent users against one map room by speaking the same
 * Yjs / y-websocket protocol as real browsers. Each client repeatedly:
 *   1. Creates pairs of factors and a link between them until TARGET_FACTORS
 *   2. Deletes every factor (and their links) that *this* client created
 *   3. Repeats
 *
 * Why not 15 real browser tabs?
 *   - 15 Chromium tabs ≈ several GB RAM and CPU on the client machine;
 *     the bottleneck becomes the test harness, not PRSM.
 *   - Headless Yjs clients stress the websocket server, LevelDB persistence,
 *     and CRDT merge path — the real multi-user bottlenecks — with far less
 *     local resource use. You can still open one real browser on the room URL
 *     to *feel* responsiveness while the load runs.
 *
 * Recommended setup for ~45 concurrent users:
 *   Machine A: node utils/stress-test-prsm.mjs --clients 15 --machine a
 *   Machine B: node utils/stress-test-prsm.mjs --clients 15 --machine b
 *   Machine C: node utils/stress-test-prsm.mjs --clients 15 --machine c
 *   Plus one human browser tab on the room URL as the "observer".
 *
 * Clean up leftover stress factors after a messy stop:
 *   node utils/stress-test-prsm.mjs --cleanup-only
 *
 * Usage examples:
 *   node utils/stress-test-prsm.mjs
 *   node utils/stress-test-prsm.mjs --room DOT-BCQ-ROW-XFA --clients 15
 *   node utils/stress-test-prsm.mjs --ws wss://www.prsm.uk/wss --cycles 5
 *   node utils/stress-test-prsm.mjs --url 'https://prsm.uk/prsm.html?room=DOT-BCQ-ROW-XFA'
 *
 * Stop with Ctrl+C; clients stop quickly, delete owned factors, wait for the
 * websocket to flush, then disconnect.
 */

import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import process from 'node:process'

// y-websocket registers process.on('exit') per provider; 15 clients trip the default max of 10.
process.setMaxListeners(0)
// Node 22+ exposes experimental localStorage that warns unless --localstorage-file is set.
// yjs/lib0 may touch it; suppress that noise only.
const _emitWarning = process.emitWarning.bind(process)
process.emitWarning = (warning, ...args) => {
  const msg = typeof warning === 'string' ? warning : warning?.message
  if (msg && /localStorage/i.test(msg)) return
  return _emitWarning(warning, ...args)
}

const Y = await import('yjs')
const { WebsocketProvider } = await import('y-websocket')

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const DEFAULTS = {
  room: 'DOT-BCQ-ROW-XFA',
  ws: 'wss://www.prsm.uk/wss',
  clients: 15,
  factors: 10, // target factors owned per client before delete phase (must be even)
  cycles: 0, // 0 = run until Ctrl+C
  delayMs: 150, // pause between individual create/delete ops
  cyclePauseMs: 500, // pause between full create→delete cycles
  rampMs: 200, // stagger client start
  machine: hostname().split('.')[0].slice(0, 12) || 'host',
  connectTimeoutMs: 30000,
  flushMs: 3000, // wait after deletes before disconnect so updates reach the server
  cleanupOnly: false,
  cleanupPrefix: 'Stress-', // label prefix for --cleanup-only
}

function parseArgs(argv) {
  const opts = { ...DEFAULTS }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Missing value after ${a}`)
      return v
    }
    switch (a) {
      case '--help':
      case '-h':
        opts.help = true
        break
      case '--url': {
        const u = new URL(next())
        const room = u.searchParams.get('room')
        if (room) opts.room = room.toUpperCase()
        break
      }
      case '--room':
        opts.room = next().toUpperCase()
        break
      case '--ws':
        opts.ws = next()
        break
      case '--clients':
        opts.clients = Math.max(1, parseInt(next(), 10))
        break
      case '--factors':
        opts.factors = Math.max(2, parseInt(next(), 10))
        if (opts.factors % 2 !== 0) opts.factors += 1
        break
      case '--cycles':
        opts.cycles = Math.max(0, parseInt(next(), 10))
        break
      case '--delay-ms':
        opts.delayMs = Math.max(0, parseInt(next(), 10))
        break
      case '--cycle-pause-ms':
        opts.cyclePauseMs = Math.max(0, parseInt(next(), 10))
        break
      case '--ramp-ms':
        opts.rampMs = Math.max(0, parseInt(next(), 10))
        break
      case '--machine':
        opts.machine = String(next()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || 'host'
        break
      case '--connect-timeout-ms':
        opts.connectTimeoutMs = Math.max(1000, parseInt(next(), 10))
        break
      case '--flush-ms':
        opts.flushMs = Math.max(0, parseInt(next(), 10))
        break
      case '--cleanup-only':
        opts.cleanupOnly = true
        break
      case '--cleanup-prefix':
        opts.cleanupPrefix = next()
        break
      default:
        throw new Error(`Unknown argument: ${a}`)
    }
  }
  return opts
}

function printHelp() {
  console.log(`PRSM stress test (Yjs headless clients)

Usage: node utils/stress-test-prsm.mjs [options]

Options:
  --url <prsm-url>          Parse room from a full PRSM URL
  --room <code>             Room code (default: ${DEFAULTS.room})
  --ws <websocket-url>      Websocket endpoint (default: ${DEFAULTS.ws})
  --clients <n>             Concurrent clients on this machine (default: ${DEFAULTS.clients})
  --factors <n>             Factors each client creates per cycle, even (default: ${DEFAULTS.factors})
  --cycles <n>              Cycles then exit; 0 = forever (default: ${DEFAULTS.cycles})
  --delay-ms <n>            Delay between ops (default: ${DEFAULTS.delayMs})
  --cycle-pause-ms <n>      Pause between cycles (default: ${DEFAULTS.cyclePauseMs})
  --ramp-ms <n>             Stagger client starts (default: ${DEFAULTS.rampMs})
  --machine <id>            Tag in factor labels / user names (default: hostname)
  --connect-timeout-ms <n>  Wait for initial sync (default: ${DEFAULTS.connectTimeoutMs})
  --flush-ms <n>            Wait after deletes before disconnect (default: ${DEFAULTS.flushMs})
  --cleanup-only            Connect once and delete all factors with Stress- labels
  --cleanup-prefix <str>    Label prefix for cleanup-only (default: Stress-)
  -h, --help                Show this help

Doc name on the server is "prsm" + room, matching js/prsm.js.`)
}

// ---------------------------------------------------------------------------
// Factor / link shapes (match what real PRSM clients store in yMaps)
// ---------------------------------------------------------------------------

const NODE_STYLE = {
  borderWidth: 0,
  borderWidthSelected: 4,
  color: {
    border: 'rgb(154, 219, 180)',
    background: 'rgb(154, 219, 180)',
    highlight: { border: 'rgb(154, 219, 180)', background: 'rgb(154, 219, 180)' },
    hover: { border: 'rgb(154, 219, 180)', background: 'rgb(154, 219, 180)' },
  },
  fixed: false,
  font: { face: 'Oxygen', color: 'rgb(0, 0, 0)', size: 14 },
  labelHighlightBold: true,
  margin: 20,
  shape: 'box',
  shapeProperties: { borderDashes: false },
  scaling: { min: 10, max: 40, label: { enabled: false, min: 10, max: 40 } },
  size: 25,
  heightConstraint: false,
  widthConstraint: false,
}

const EDGE_STYLE = {
  arrows: {
    to: { enabled: true, type: 'vee' },
    middle: { enabled: false },
    from: { enabled: false },
  },
  color: {
    color: 'rgb(0, 0, 0)',
    highlight: 'rgb(0, 0, 0)',
    hover: 'rgb(0, 0, 0)',
    inherit: false,
    opacity: 1,
  },
  dashes: false,
  font: { size: 14, align: 'top', background: 'rgb(255,255,255)', strokeWidth: 0 },
  labelHighlightBold: false,
  hoverWidth: 1,
  selectionWidth: 0,
  width: 1,
}

/** Interruptible sleep: returns early when shouldStop() is true. */
async function sleep(ms, shouldStop = () => false) {
  const step = 50
  let waited = 0
  while (waited < ms) {
    if (shouldStop()) return
    const chunk = Math.min(step, ms - waited)
    await new Promise((resolve) => setTimeout(resolve, chunk))
    waited += chunk
  }
}

function makeUser(name) {
  const colors = ['#ff7f50', '#87ceeb', '#98fb98', '#dda0dd', '#f0e68c', '#ffa07a']
  const color = colors[Math.floor(Math.random() * colors.length)]
  return {
    name,
    color,
    isLight: true,
    anon: false,
    asleep: false,
  }
}

function makeFactor({ id, label, x, y, userName }) {
  return {
    id,
    label,
    x,
    y,
    grp: 'group0',
    created: { time: Date.now(), user: userName },
    ...structuredClone(NODE_STYLE),
  }
}

function makeLink({ id, from, to, userName }) {
  return {
    id,
    from,
    to,
    grp: 'edge0',
    created: { time: Date.now(), user: userName },
    ...structuredClone(EDGE_STYLE),
  }
}

/**
 * Delete every factor whose label starts with prefix, plus edges that touch them
 * or were created by a Stress-* user. Returns counts.
 */
function deleteByLabelPrefix(doc, yNodes, yEdges, prefix) {
  const toDeleteNodes = []
  const nodeIdSet = new Set()
  yNodes.forEach((node, id) => {
    if (node && typeof node.label === 'string' && node.label.startsWith(prefix)) {
      toDeleteNodes.push(id)
      nodeIdSet.add(id)
    }
  })
  const toDeleteEdges = []
  yEdges.forEach((edge, id) => {
    if (!edge) return
    const byEndpoints = nodeIdSet.has(edge.from) || nodeIdSet.has(edge.to)
    const byUser =
      edge.created &&
      typeof edge.created.user === 'string' &&
      edge.created.user.startsWith(prefix)
    if (byEndpoints || byUser) toDeleteEdges.push(id)
  })
  if (toDeleteNodes.length === 0 && toDeleteEdges.length === 0) {
    return { nodes: 0, edges: 0 }
  }
  doc.transact(() => {
    for (const id of toDeleteEdges) yEdges.delete(id)
    for (const id of toDeleteNodes) yNodes.delete(id)
  })
  return { nodes: toDeleteNodes.length, edges: toDeleteEdges.length }
}

// ---------------------------------------------------------------------------
// Single simulated client
// ---------------------------------------------------------------------------

class StressClient {
  /**
   * @param {object} cfg
   */
  constructor(cfg) {
    this.cfg = cfg
    this.name = `Stress-${cfg.machine}-${String(cfg.index).padStart(2, '0')}`
    this.doc = new Y.Doc()
    this.yNodes = this.doc.getMap('nodes')
    this.yEdges = this.doc.getMap('edges')
    this.provider = null
    this.stopping = false
    /** @type {{ nodeId: string, edgeId?: string }[]} ordered ownership for pair deletes */
    this.ownedPairs = []
  }

  get stopFn() {
    return () => this.stopping
  }

  async connect() {
    const docName = `prsm${this.cfg.room}`
    this.provider = new WebsocketProvider(this.cfg.ws, docName, this.doc, {
      connect: true,
      // Multiple clients in one process must not share BroadcastChannel state.
      disableBc: true,
    })

    const user = makeUser(this.name)
    user.id = this.doc.clientID
    this.user = user
    this.provider.awareness.setLocalState({ user })

    this._heartbeat = setInterval(() => {
      try {
        this.provider.awareness.setLocalStateField('pkt', { time: Date.now() })
      } catch {
        /* ignore */
      }
    }, 20000)

    await this.waitForSync(this.cfg.connectTimeoutMs)
    console.log(
      `[${this.name}] synced to ${docName} via ${this.cfg.ws} ` +
        `(nodes=${this.yNodes.size}, edges=${this.yEdges.size}, clientID=${this.doc.clientID})`
    )
  }

  waitForSync(timeoutMs) {
    return new Promise((resolve, reject) => {
      if (this.provider.synced) {
        resolve()
        return
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`[${this.name}] timed out waiting for websocket sync after ${timeoutMs}ms`))
      }, timeoutMs)
      const onSync = (isSynced) => {
        if (isSynced) {
          cleanup()
          resolve()
        }
      }
      const cleanup = () => {
        clearTimeout(timer)
        this.provider.off('sync', onSync)
      }
      this.provider.on('sync', onSync)
    })
  }

  tag(cycle, pair, role) {
    return `${this.name} c${cycle} p${pair} ${role}`
  }

  createPair(cycle, pairIndex) {
    // Guard: shutdown may flip stopping between the run-loop check and this call.
    if (this.stopping) return

    const baseX = ((this.cfg.index * 17 + pairIndex * 13) % 40) * 40 - 400
    const baseY = ((this.cfg.index * 11 + cycle * 7 + pairIndex * 19) % 30) * 40 - 300
    const jitter = () => (Math.random() - 0.5) * 30

    const idA = randomUUID()
    const idB = randomUUID()
    const idE = randomUUID()

    const nodeA = makeFactor({
      id: idA,
      label: this.tag(cycle, pairIndex, 'A'),
      x: baseX + jitter(),
      y: baseY + jitter(),
      userName: this.name,
    })
    const nodeB = makeFactor({
      id: idB,
      label: this.tag(cycle, pairIndex, 'B'),
      x: baseX + 180 + jitter(),
      y: baseY + 40 + jitter(),
      userName: this.name,
    })
    const edge = makeLink({ id: idE, from: idA, to: idB, userName: this.name })

    // If stop landed during construction, do not publish.
    if (this.stopping) return

    this.doc.transact(() => {
      this.yNodes.set(idA, nodeA)
      this.yNodes.set(idB, nodeB)
      this.yEdges.set(idE, edge)
    })

    this.ownedPairs.push({ nodeA: idA, nodeB: idB, edgeId: idE })
    this.cfg.stats.created += 2
    this.cfg.stats.linked += 1
  }

  deleteOwned() {
    if (this.ownedPairs.length === 0) return
    const pairs = this.ownedPairs
    this.ownedPairs = []
    this.doc.transact(() => {
      for (const p of pairs) {
        if (p.edgeId && this.yEdges.has(p.edgeId)) this.yEdges.delete(p.edgeId)
        if (p.nodeA && this.yNodes.has(p.nodeA)) this.yNodes.delete(p.nodeA)
        if (p.nodeB && this.yNodes.has(p.nodeB)) this.yNodes.delete(p.nodeB)
      }
    })
    this.cfg.stats.deleted += pairs.length * 2
  }

  /** Remove leftover factors from prior runs of this client name. */
  cleanupOrphansByLabel() {
    const result = deleteByLabelPrefix(this.doc, this.yNodes, this.yEdges, `${this.name} `)
    return result.nodes
  }

  async run() {
    const pairs = this.cfg.factors / 2
    let cycle = 0
    while (!this.stopping && (this.cfg.cycles === 0 || cycle < this.cfg.cycles)) {
      cycle += 1
      const cycleStart = Date.now()
      try {
        for (let p = 1; p <= pairs && !this.stopping; p++) {
          this.createPair(cycle, p)
          if (this.cfg.delayMs) await sleep(this.cfg.delayMs, this.stopFn)
        }
        if (this.stopping) break

        await sleep(Math.max(this.cfg.delayMs, 50), this.stopFn)
        if (this.stopping) break

        // Delete one pair at a time so the observer sees progressive removal
        while (this.ownedPairs.length > 0 && !this.stopping) {
          const p = this.ownedPairs.shift()
          this.doc.transact(() => {
            if (p.edgeId && this.yEdges.has(p.edgeId)) this.yEdges.delete(p.edgeId)
            if (p.nodeA && this.yNodes.has(p.nodeA)) this.yNodes.delete(p.nodeA)
            if (p.nodeB && this.yNodes.has(p.nodeB)) this.yNodes.delete(p.nodeB)
          })
          this.cfg.stats.deleted += 2
          if (this.cfg.delayMs) await sleep(this.cfg.delayMs, this.stopFn)
        }

        if (this.ownedPairs.length) this.deleteOwned()

        this.cfg.stats.cycles += 1
        const elapsed = Date.now() - cycleStart
        if (cycle === 1 || cycle % 5 === 0) {
          console.log(
            `[${this.name}] cycle ${cycle} done in ${elapsed}ms ` +
              `(map nodes=${this.yNodes.size}, edges=${this.yEdges.size})`
          )
        }
      } catch (err) {
        this.cfg.stats.errors += 1
        console.error(`[${this.name}] cycle ${cycle} error:`, err.message || err)
        try {
          this.deleteOwned()
        } catch {
          /* ignore */
        }
      }
      if (this.cfg.cyclePauseMs && !this.stopping) await sleep(this.cfg.cyclePauseMs, this.stopFn)
    }
  }

  /**
   * Drop the websocket quickly. Map cleanup is done by a dedicated connection
   * after all clients have stopped creating — avoids races where createPair
   * runs after a per-client deleteOwned/sweep.
   */
  async disconnectOnly() {
    this.stopping = true
    clearInterval(this._heartbeat)
    this.ownedPairs = []
    try {
      this.provider?.awareness?.setLocalState(null)
      this.provider?.destroy()
    } catch {
      /* ignore */
    }
    try {
      this.doc.destroy()
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup-only mode
// ---------------------------------------------------------------------------

/**
 * Wait until provider reports synced (or timeout).
 * @param {import('y-websocket').WebsocketProvider} provider
 * @param {number} timeoutMs
 */
function waitProviderSync(provider, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (provider.synced) {
      resolve()
      return
    }
    const timer = setTimeout(() => reject(new Error('sync timeout')), timeoutMs)
    const onSync = (s) => {
      if (s) {
        clearTimeout(timer)
        provider.off('sync', onSync)
        resolve()
      }
    }
    provider.on('sync', onSync)
  })
}

function countByLabelPrefix(yNodes, prefix) {
  let n = 0
  yNodes.forEach((node) => {
    if (node && typeof node.label === 'string' && node.label.startsWith(prefix)) n++
  })
  return n
}

/**
 * Dedicated cleanup connection: sync room, delete all Stress-* factors, wait until
 * local view is clean, give the socket time to flush, optionally verify once more.
 * Used both by --cleanup-only and by normal/SIGINT shutdown after workers stop.
 */
async function cleanupRoom(opts, { quiet = false } = {}) {
  if (!quiet) {
    console.log(`PRSM stress cleanup
  room:   ${opts.room}
  ws:     ${opts.ws}
  prefix: ${opts.cleanupPrefix}
`)
  }

  const doc = new Y.Doc()
  const yNodes = doc.getMap('nodes')
  const yEdges = doc.getMap('edges')
  const provider = new WebsocketProvider(opts.ws, `prsm${opts.room}`, doc, {
    connect: true,
    disableBc: true,
  })

  try {
    await waitProviderSync(provider, opts.connectTimeoutMs)
  } catch (err) {
    provider.destroy()
    doc.destroy()
    throw err
  }

  const before = { nodes: yNodes.size, edges: yEdges.size }
  if (!quiet) {
    console.log(
      `Synced. Map has ${before.nodes} factors, ${before.edges} links ` +
        `(${countByLabelPrefix(yNodes, opts.cleanupPrefix)} with prefix "${opts.cleanupPrefix}").`
    )
  }

  let totalDeleted = { nodes: 0, edges: 0 }
  // Retry a few times: concurrent clients or slow server merge can leave stragglers.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const remaining = countByLabelPrefix(yNodes, opts.cleanupPrefix)
    if (remaining === 0) break
    const result = deleteByLabelPrefix(doc, yNodes, yEdges, opts.cleanupPrefix)
    totalDeleted.nodes += result.nodes
    totalDeleted.edges += result.edges
    if (!quiet) {
      console.log(
        `Cleanup attempt ${attempt}: deleted ${result.nodes} factors, ${result.edges} links ` +
          `(${countByLabelPrefix(yNodes, opts.cleanupPrefix)} still local).`
      )
    }
    // Let deletes propagate; then re-check.
    await sleep(Math.max(opts.flushMs, 1500))
  }

  const afterLocal = countByLabelPrefix(yNodes, opts.cleanupPrefix)
  if (!quiet) {
    console.log(
      `Cleanup done. Deleted ${totalDeleted.nodes} factors / ${totalDeleted.edges} links total. ` +
        `Map now ${yNodes.size} factors, ${yEdges.size} links ` +
        `(${afterLocal} still matching "${opts.cleanupPrefix}").`
    )
  }
  if (afterLocal > 0) {
    console.warn(
      `Warning: ${afterLocal} factor(s) with prefix "${opts.cleanupPrefix}" remain. ` +
        `Re-run: node utils/stress-test-prsm.mjs --cleanup-only`
    )
  }

  try {
    provider.awareness.setLocalState(null)
    provider.destroy()
  } catch {
    /* ignore */
  }
  try {
    doc.destroy()
  } catch {
    /* ignore */
  }

  return { ...totalDeleted, remaining: afterLocal, before, after: { nodes: yNodes.size, edges: yEdges.size } }
}

async function runCleanupOnly(opts) {
  await cleanupRoom(opts, { quiet: false })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    printHelp()
    process.exit(1)
  }
  if (opts.help) {
    printHelp()
    process.exit(0)
  }

  if (opts.cleanupOnly) {
    try {
      await runCleanupOnly(opts)
      process.exit(0)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  const stats = {
    created: 0,
    linked: 0,
    deleted: 0,
    cycles: 0,
    errors: 0,
  }

  console.log(`PRSM stress test
  room:     ${opts.room}
  ws:       ${opts.ws}
  clients:  ${opts.clients}
  factors:  ${opts.factors} per client per cycle (in pairs + link)
  cycles:   ${opts.cycles === 0 ? '∞ until Ctrl+C' : opts.cycles}
  machine:  ${opts.machine}
  delay:    ${opts.delayMs}ms between ops
  flush:    ${opts.flushMs}ms after deletes before disconnect

Open an observer browser on:
  https://prsm.uk/prsm.html?room=${opts.room}
`)

  const clients = []
  for (let i = 1; i <= opts.clients; i++) {
    clients.push(
      new StressClient({
        index: i,
        room: opts.room,
        ws: opts.ws,
        machine: opts.machine,
        factors: opts.factors,
        delayMs: opts.delayMs,
        cyclePauseMs: opts.cyclePauseMs,
        cycles: opts.cycles,
        connectTimeoutMs: opts.connectTimeoutMs,
        flushMs: opts.flushMs,
        stats,
      })
    )
  }

  let shuttingDown = false
  /** @type {Promise<void> | null} */
  let shutdownPromise = null
  /** @type {Promise<void>[]} */
  let runPromises = []
  const startedAt = Date.now()

  const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise
    shuttingDown = true
    shutdownPromise = (async () => {
      console.log(`
${signal}: stopping creators, then dedicated cleanup…`)

      // 1. Stop all creation immediately (createPair also checks this flag).
      for (const c of clients) c.stopping = true

      // 2. Wait for run loops to finish so nothing creates after cleanup starts.
      if (runPromises.length > 0) {
        await Promise.race([
          Promise.allSettled(runPromises),
          sleep(8000), // don't hang forever if a client is wedged
        ])
      } else {
        // Brief settle if runs never started
        await sleep(200)
      }

      // 3. Drop worker sockets so they cannot race the cleanup connection.
      await Promise.all(clients.map((c) => c.disconnectOnly()))

      // 4. Fresh connection owns cleanup (no concurrent creators).
      try {
        await cleanupRoom(opts, { quiet: false })
      } catch (err) {
        console.error('Cleanup failed:', err.message || err)
        stats.errors += 1
      }

      printStats(stats, startedAt)
    })()
    return shutdownPromise
  }
  process.on('SIGINT', () => {
    void shutdown('SIGINT').then(() => process.exit(stats.errors > 0 ? 1 : 0))
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').then(() => process.exit(stats.errors > 0 ? 1 : 0))
  })
  // Connect with ramp
  for (const c of clients) {
    try {
      await c.connect()
      const cleaned = c.cleanupOrphansByLabel()
      if (cleaned) console.log(`[${c.name}] removed ${cleaned} leftover factor(s) from prior run`)
    } catch (err) {
      console.error(err.message || err)
      stats.errors += 1
      await shutdown('connect-failure')
      process.exit(1)
    }
    if (opts.rampMs) await sleep(opts.rampMs)
  }

  const ticker = setInterval(() => {
    if (shuttingDown) return
    const secs = Math.max(1, (Date.now() - startedAt) / 1000)
    console.log(
      `[stats] t=${secs.toFixed(0)}s created=${stats.created} linked=${stats.linked} ` +
        `deleted=${stats.deleted} cycles=${stats.cycles} errors=${stats.errors} ` +
        `rate=${(stats.created / secs).toFixed(1)} factors/s`
    )
  }, 10000)

  runPromises = clients.map(async (c) => {
    try {
      await c.run()
    } catch (err) {
      stats.errors += 1
      console.error(`[${c.name}] fatal:`, err.message || err)
    }
  })
  await Promise.all(runPromises)

  clearInterval(ticker)
  // Always go through the shared shutdown path so Ctrl+C and normal completion
  // cannot race (previously main called process.exit while SIGINT flush was in flight).
  await shutdown(shuttingDown ? 'already-stopping' : 'complete')
  process.exit(stats.errors > 0 ? 1 : 0)
}

function printStats(stats, startedAt) {
  const secs = Math.max(0.001, (Date.now() - startedAt) / 1000)
  console.log(`
=== Stress test summary ===
  duration:  ${secs.toFixed(1)}s
  created:   ${stats.created} factors
  linked:    ${stats.linked} links
  deleted:   ${stats.deleted} factors
  cycles:    ${stats.cycles} (sum across clients)
  errors:    ${stats.errors}
  avg rate:  ${(stats.created / secs).toFixed(2)} factors/s created
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
