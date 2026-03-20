#!/usr/bin/env node

/**
 * One-off maintenance script to compact the LevelDB database.
 *
 * For each document stored in the database, all accumulated updates are merged
 * into a single entry (flush), then LevelDB compaction is triggered to reclaim
 * disk space.
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

const dbPath = process.argv[2]
if (!dbPath) {
  console.error('Usage: node compact-db.mjs <path-to-leveldb>')
  process.exit(1)
}

console.log(`Opening database at "${dbPath}"...`)
const ldb = new LeveldbPersistence(dbPath)

const docNames = await ldb.getAllDocNames()
console.log(`Found ${docNames.length} documents.`)

let flushed = 0
for (const docName of docNames) {
  try {
    await ldb.flushDocument(docName)
    flushed++
    if (flushed % 10 === 0) {
      console.log(`  Flushed ${flushed}/${docNames.length}...`)
    }
  } catch (err) {
    console.error(`  Error flushing "${docName}":`, err.message)
  }
}
console.log(`Flushed ${flushed}/${docNames.length} documents.`)

console.log('Running LevelDB compaction (this may take a while)...')
await ldb.compact()

console.log('Closing database...')
await ldb.destroy()

console.log('Done.')
