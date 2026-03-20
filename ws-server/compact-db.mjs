#!/usr/bin/env node

/**
 * One-off maintenance script to compact the LevelDB database.
 *
 * Phase 1: Scans all documents and counts their updates (keys only, cheap).
 * Phase 2: Flushes documents below the update threshold in batches.
 * Phase 3: Runs LevelDB compaction to reclaim disk space.
 *
 * Documents exceeding the threshold are skipped and reported, so they can
 * be dealt with separately (e.g. deleted if no longer needed).
 *
 * IMPORTANT: the websocket-server must be stopped before running this script,
 * because LevelDB only allows a single process to hold the lock.
 *
 * Usage:
 *   sudo systemctl stop websocket-server
 *   node compact-db.mjs <path-to-leveldb> [max-updates]
 *   sudo systemctl start websocket-server
 *
 * max-updates defaults to 10000. Documents with more updates than this
 * are skipped to avoid running out of memory.
 */

import { LeveldbPersistence } from './src/y-leveldb.js'

const BATCH_SIZE = 200
const MAX_UPDATES = parseInt(process.argv[3] || '10000')

const dbPath = process.argv[2]
if (!dbPath) {
  console.error('Usage: node compact-db.mjs <path-to-leveldb> [max-updates]')
  process.exit(1)
}

// --- Phase 1: Scan ---
console.log(`Scanning database at "${dbPath}"...`)
let ldb = new LeveldbPersistence(dbPath)
const docNames = await ldb.getAllDocNames()
console.log(`Found ${docNames.length} documents. Counting updates...`)

const docInfo = []
for (let i = 0; i < docNames.length; i++) {
  const count = await ldb.getUpdateCount(docNames[i])
  docInfo.push({ name: docNames[i], updates: count })
  if ((i + 1) % 1000 === 0) {
    console.log(`  Scanned ${i + 1}/${docNames.length}...`)
  }
}
await ldb.destroy()

// Report largest documents
const sorted = [...docInfo].sort((a, b) => b.updates - a.updates)
console.log('\nTop 10 documents by update count:')
sorted.slice(0, 10).forEach((d) => console.log(`  ${d.name}: ${d.updates} updates`))

const toFlush = docInfo.filter((d) => d.updates > 1 && d.updates <= MAX_UPDATES)
const skipped = docInfo.filter((d) => d.updates > MAX_UPDATES)
const alreadyFlushed = docInfo.filter((d) => d.updates <= 1)

console.log(
  `\n${alreadyFlushed.length} already flushed, ` +
    `${toFlush.length} to flush, ` +
    `${skipped.length} skipped (>${MAX_UPDATES} updates).`
)

if (skipped.length > 0) {
  console.log('\nSkipped documents (too large):')
  skipped.forEach((d) => console.log(`  ${d.name}: ${d.updates} updates`))
}

// --- Phase 2: Flush ---
const flushNames = toFlush.map((d) => d.name)
let flushed = 0
let errors = 0
for (let i = 0; i < flushNames.length; i += BATCH_SIZE) {
  const batch = flushNames.slice(i, i + BATCH_SIZE)
  ldb = new LeveldbPersistence(dbPath)

  for (const docName of batch) {
    try {
      await ldb.flushDocumentStreaming(docName)
      flushed++
    } catch (err) {
      errors++
      console.error(`  Error flushing "${docName}":`, err.message)
    }
  }

  await ldb.destroy()
  console.log(`  Flushed ${flushed}/${flushNames.length}...`)
}
console.log(`Flushed ${flushed} documents (${errors} errors).`)

// --- Phase 3: Compact ---
console.log('Running LevelDB compaction (this may take a while)...')
ldb = new LeveldbPersistence(dbPath)
await ldb.compact()
await ldb.destroy()

console.log('Done.')
