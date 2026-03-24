#!/usr/bin/env node

/**
 * Clears a single document from the LevelDB database.
 *
 * IMPORTANT: the websocket-server must be stopped first.
 *
 * Usage:
 *   node clear-doc.mjs <path-to-leveldb> <docName>
 *
 * Example:
 *   node clear-doc.mjs /data/prsm/dbDir prsmVXS-NLT-TAT-WNO
 */

import { LeveldbPersistence } from './src/y-leveldb.js'

const dbPath = process.argv[2]
const docName = process.argv[3]

if (!dbPath || !docName) {
  console.error('Usage: node clear-doc.mjs <path-to-leveldb> <docName>')
  process.exit(1)
}

const ldb = new LeveldbPersistence(dbPath)

const count = await ldb.getUpdateCount(docName)
if (count === 0) {
  console.log(`Document "${docName}" not found in database.`)
} else {
  console.log(`Document "${docName}" has ${count} updates. Clearing...`)
  await ldb.clearDocument(docName)
  console.log('Cleared.')
}

await ldb.destroy()
