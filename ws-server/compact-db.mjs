#!/usr/bin/env node

/**
 * One-off maintenance script to compact the LevelDB database.
 *
 * For each document stored in the database, all accumulated updates are merged
 * into a single entry (flush), then LevelDB compaction is triggered to reclaim
 * disk space.
 *
 * Documents are processed in batches, with the database closed and reopened
 * between batches to ensure memory is fully released.
 *
 * IMPORTANT: the websocket-server must be stopped before running this script,
 * because LevelDB only allows a single process to hold the lock.
 *
 * Usage:
 *   sudo systemctl stop websocket-server
 *   node compact-db.mjs /data/prsm/dbDir
 *   sudo systemctl start websocket-server
 */

import { LeveldbPersistence } from './src/y-leveldb.js'

const BATCH_SIZE = 200

const dbPath = process.argv[2]
if (!dbPath) {
  console.error('Usage: node compact-db.mjs <path-to-leveldb>')
  process.exit(1)
}

// First pass: get all document names, then close
console.log(`Opening database at "${dbPath}"...`)
let ldb = new LeveldbPersistence(dbPath)
const docNames = await ldb.getAllDocNames()
await ldb.destroy()
console.log(`Found ${docNames.length} documents. Processing in batches of ${BATCH_SIZE}.`)

// Process in batches, reopening the database each time to release memory
let flushed = 0
let errors = 0
for (let i = 0; i < docNames.length; i += BATCH_SIZE) {
  const batch = docNames.slice(i, i + BATCH_SIZE)
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
  console.log(`  Flushed ${flushed}/${docNames.length}...`)
}
console.log(`Flushed ${flushed} documents (${errors} errors).`)

// Final compaction pass
console.log('Running LevelDB compaction (this may take a while)...')
ldb = new LeveldbPersistence(dbPath)
await ldb.compact()
await ldb.destroy()

console.log('Done.')
