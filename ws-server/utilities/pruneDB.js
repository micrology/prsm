#!/usr/bin/env node

/**
 * Prunes unused rooms from a Yjs LevelDB database, then compacts it.
 *
 * A room is deleted when it is not read-only (viewOnly) and either has no
 * lastLoaded access date, or that date is more than 6 months before now.
 *
 * IMPORTANT: the websocket-server must be stopped before running this script,
 * because LevelDB only allows a single process to hold the lock.
 *
 * Usage:
 *   node pruneDB.js -s <path-to-leveldb>
 *   node pruneDB.js -s ../../dbDir-local-copy -v
 *
 * Options:
 *   -s, --source <path>  Path to the LevelDB directory (default: ./dbDir)
 *   -v, --verbose        Log each deleted room
 *   -n, --dry-run        Report matches without deleting or compacting
 */

import { LeveldbPersistence } from '../src/y-leveldb.js'
import { Command } from 'commander'

const program = new Command()

/**
 * @param {string} source
 * @returns {Promise<string[]>}
 */
async function getAllRooms(source) {
  const persistence = new LeveldbPersistence(source)
  try {
    return await persistence.getAllDocNames()
  } finally {
    await persistence.destroy()
  }
}

/**
 * @param {unknown} lastAccessed
 * @param {Date} sixMonthsAgo
 * @returns {boolean}
 */
function isStale(lastAccessed, sixMonthsAgo) {
  if (!lastAccessed) return true
  const lastAccessedDate = new Date(/** @type {string|number|Date} */ (lastAccessed))
  if (Number.isNaN(lastAccessedDate.getTime())) return true
  return lastAccessedDate < sixMonthsAgo
}

/**
 * @param {string} source
 * @param {string} room
 * @param {Date} sixMonthsAgo
 * @returns {Promise<{ shouldDelete: boolean, reason?: string, mapTitle?: string, lastAccessed?: unknown, readOnly?: boolean }>}
 */
async function evaluateRoom(source, room, sixMonthsAgo) {
  const persistence = new LeveldbPersistence(source)
  let doc = null

  try {
    doc = await persistence.getYDoc(room)
    if (!doc) {
      throw new Error('Document is null or undefined')
    }

    const network = doc.getMap('network')
    const mapTitle = network.get('mapTitle') || 'Untitled'
    const lastAccessed = network.get('lastLoaded')
    const readOnly = network.get('viewOnly') || false

    if (readOnly) {
      return { shouldDelete: false, mapTitle, lastAccessed, readOnly: true }
    }

    if (!lastAccessed) {
      return {
        shouldDelete: true,
        reason: 'no access date',
        mapTitle,
        lastAccessed,
        readOnly: false,
      }
    }

    if (isStale(lastAccessed, sixMonthsAgo)) {
      return {
        shouldDelete: true,
        reason: 'not accessed for more than 6 months',
        mapTitle,
        lastAccessed,
        readOnly: false,
      }
    }

    return { shouldDelete: false, mapTitle, lastAccessed, readOnly: false }
  } finally {
    if (doc) {
      doc.destroy()
      doc = null
    }
    await persistence.destroy()
    if (global.gc) global.gc()
  }
}

/**
 * @param {string} source
 * @param {string} room
 * @returns {Promise<void>}
 */
async function deleteRoom(source, room) {
  const persistence = new LeveldbPersistence(source)
  try {
    await persistence.clearDocument(room)
  } finally {
    await persistence.destroy()
  }
}

/**
 * @param {string} source
 * @returns {Promise<void>}
 */
async function compactDatabase(source) {
  const persistence = new LeveldbPersistence(source)
  try {
    await persistence.compact()
  } finally {
    await persistence.destroy()
  }
}

async function main() {
  program
    .option('-s, --source <path>', 'path of source DB (default: ./dbDir)', './dbDir')
    .option('-v, --verbose', 'log each deleted room')
    .option('-n, --dry-run', 'report matches without deleting or compacting')
    .description('Delete unused non-read-only rooms from a LevelDB Yjs store and compact')

  program.parse()
  const options = program.opts()
  const source = options.source.toString()
  const verbose = Boolean(options.verbose)
  const dryRun = Boolean(options.dryRun)

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())

  console.log(`Using source DB: ${source}`)
  console.log(`Cutoff (6 months ago): ${sixMonthsAgo.toISOString()}`)
  if (dryRun) console.log('Dry run: no rooms will be deleted')

  const rooms = await getAllRooms(source)
  const total = rooms.length
  console.log(`Found ${total} rooms\n`)

  let deleted = 0
  let kept = 0
  let failed = 0
  /** @type {Array<{ room: string, error: string }>} */
  const failedRooms = []

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i]
    const roomCode = room.slice(4)
    process.stdout.write(`${i + 1}/${total} ${roomCode}\r`)

    try {
      const result = await evaluateRoom(source, room, sixMonthsAgo)
      if (!result.shouldDelete) {
        kept++
        continue
      }

      if (!dryRun) {
        await deleteRoom(source, room)
      }
      deleted++

      if (verbose) {
        const accessed =
          result.lastAccessed != null
            ? new Date(/** @type {string|number|Date} */ (result.lastAccessed)).toISOString()
            : 'unknown'
        console.log(
          `${dryRun ? 'Would delete' : 'Deleted'} ${roomCode} "${result.mapTitle}" (${result.reason}; last accessed: ${accessed})`
        )
      }
    } catch (error) {
      failed++
      failedRooms.push({
        room,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Total rooms: ${total}`)
  console.log(`${dryRun ? 'Would delete' : 'Deleted'}: ${deleted}`)
  console.log(`Kept: ${kept}`)
  console.log(`Failed: ${failed}`)

  if (failedRooms.length > 0) {
    console.log('\nFailed rooms:')
    for (const f of failedRooms) {
      console.log(`  ${f.room}: ${f.error}`)
    }
  }

  if (!dryRun && deleted > 0) {
    console.log('\nCompacting database (this may take a while)...')
    await compactDatabase(source)
    console.log('Compaction complete.')
  } else if (!dryRun) {
    console.log('\nNo rooms deleted; skipping compaction.')
  }

  console.log(`\nRooms deleted: ${deleted}`)
}

main().catch((error) => {
  console.error('Error pruning database:', error)
  process.exit(1)
})
