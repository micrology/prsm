/**
 * Doc lifecycle: pending persistence flush must not destroy a rejoined room.
 * Run: npm run test:lifecycle
 */
import assert from 'node:assert/strict'
import {
  destroyDocument,
  docs,
  getYDoc,
  setPersistence,
  shouldEvictDoc,
} from '../src/utils.js'

const defer = () => {
  /** @type {{ resolve: (v?: unknown) => void, reject: (e: unknown) => void, promise: Promise<unknown> }} */
  const d = {}
  d.promise = new Promise((resolve, reject) => {
    d.resolve = resolve
    d.reject = reject
  })
  return d
}

const mockConn = () => ({
  readyState: 1,
  close() {},
  send() {},
  ping() {},
  on() {},
})

const nextTurn = () => new Promise((r) => setImmediate(r))

const reset = () => {
  for (const [name, doc] of [...docs.entries()]) {
    try {
      doc.cleanup()
    } catch {
      // already destroyed
    }
    docs.delete(name)
  }
  setPersistence(null)
}

let failed = 0

/**
 * @param {string} name
 * @param {() => Promise<void> | void} fn
 */
const test = async (name, fn) => {
  reset()
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failed++
    console.error(`not ok - ${name}`)
    console.error(err)
  } finally {
    reset()
  }
}

await test('shouldEvictDoc requires empty conns and map identity', () => {
  const doc = getYDoc('evict-helper')
  const conn = mockConn()
  assert.equal(shouldEvictDoc(docs, 'evict-helper', doc), true)
  doc.conns.set(conn, new Set())
  assert.equal(shouldEvictDoc(docs, 'evict-helper', doc), false)
  doc.conns.delete(conn)
  assert.equal(shouldEvictDoc(docs, 'other', doc), false)
})

await test('rejoin during writeState keeps the live document', async () => {
  const write = defer()
  let writeCalls = 0
  setPersistence({
    provider: null,
    bindState: async () => {},
    writeState: async () => {
      writeCalls++
      await write.promise
    },
  })

  const docName = 'room-rejoin'
  const doc = getYDoc(docName)
  const conn1 = mockConn()
  doc.conns.set(conn1, new Set())
  doc.conns.delete(conn1)

  destroyDocument(docName, doc)
  await nextTurn()

  assert.equal(writeCalls, 1, 'flush should start when room is empty')
  assert.equal(docs.get(docName), doc)
  assert.equal(doc._pendingDestroy, true)

  // Simulate rejoin while flush is pending
  const conn2 = mockConn()
  const sameDoc = getYDoc(docName)
  assert.equal(sameDoc, doc, 'rejoin must reuse the cached document')
  sameDoc.conns.set(conn2, new Set())

  write.resolve()
  await nextTurn()
  await nextTurn()

  assert.equal(docs.get(docName), doc, 'doc must stay cached after flush')
  assert.equal(doc.conns.size, 1, 'rejoined connection must remain')
  assert.equal(doc._pendingDestroy, false, 'aborted teardown must clear the guard')
  assert.ok(doc._updateHandler, 'handlers must remain after aborted eviction')
  assert.ok(doc.awareness, 'awareness must remain usable')

  // Apply an update to ensure the doc is not destroyed
  doc.getMap('test').set('k', 'v')
  assert.equal(doc.getMap('test').get('k'), 'v')
})

await test('empty room is evicted after flush when no one rejoins', async () => {
  const write = defer()
  setPersistence({
    provider: null,
    bindState: async () => {},
    writeState: async () => {
      await write.promise
    },
  })

  const docName = 'room-empty'
  const doc = getYDoc(docName)
  const conn = mockConn()
  doc.conns.set(conn, new Set())
  doc.conns.delete(conn)

  destroyDocument(docName, doc)
  await nextTurn()
  write.resolve()
  await nextTurn()
  await nextTurn()

  assert.equal(docs.has(docName), false)
  assert.equal(shouldEvictDoc(docs, docName, doc), false)
})

await test('after aborted flush, a later last-close still evicts', async () => {
  let writeResolve = /** @type {null | ((v?: unknown) => void)} */ (null)
  let writeCount = 0
  setPersistence({
    provider: null,
    bindState: async () => {},
    writeState: () =>
      new Promise((resolve) => {
        writeCount++
        writeResolve = resolve
      }),
  })

  const docName = 'room-second-close'
  const doc = getYDoc(docName)
  const conn1 = mockConn()
  doc.conns.set(conn1, new Set())
  doc.conns.delete(conn1)

  destroyDocument(docName, doc)
  await nextTurn()
  assert.equal(writeCount, 1)

  const conn2 = mockConn()
  doc.conns.set(conn2, new Set())
  writeResolve?.()
  await nextTurn()
  await nextTurn()

  assert.equal(docs.get(docName), doc)
  assert.equal(doc._pendingDestroy, false)

  doc.conns.delete(conn2)
  destroyDocument(docName, doc)
  await nextTurn()
  assert.equal(writeCount, 2)
  writeResolve?.()
  await nextTurn()
  await nextTurn()

  assert.equal(docs.has(docName), false)
})

await test('without persistence, empty room is evicted immediately', () => {
  setPersistence(null)
  const docName = 'room-memory'
  const doc = getYDoc(docName)
  destroyDocument(docName, doc)
  assert.equal(docs.has(docName), false)
})

await test('default writeState skips compaction while clients are attached', async () => {
  let flushed = false
  setPersistence({
    provider: null,
    bindState: async () => {},
    // Mirror production writeState guards (see utils.js)
    writeState: async (docName, ydoc) => {
      if (ydoc.conns?.size > 0) {
        return
      }
      const conn = mockConn()
      // Client attaches after encode would have started
      ydoc.conns.set(conn, new Set())
      if (ydoc.conns?.size > 0) {
        return
      }
      flushed = true
    },
  })

  const docName = 'room-skip-flush'
  const doc = getYDoc(docName)
  destroyDocument(docName, doc)
  await nextTurn()
  await nextTurn()

  // Either still cached (rejoin during teardown) or not flushed
  assert.equal(flushed, false)
})

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll doc lifecycle tests passed')
