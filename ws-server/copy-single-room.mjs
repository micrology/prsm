/**
 * Process a single room - designed to run in a child process
 * Usage: node process-single-room.mjs <source> <room>
 */

import { LeveldbPersistence } from 'y-leveldb'
import * as Y from 'yjs'

function humanSize(bytes, isDecimal = true) {
    if (bytes === 0) return '0B'

    const decimalUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const binaryUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

    const base = isDecimal ? 1000 : 1024
    const units = isDecimal ? decimalUnits : binaryUnits

    const i = Math.floor(Math.log(bytes) / Math.log(base))
    const size = bytes / Math.pow(base, i)

    const formatted = size % 1 === 0 ? size.toString() : size.toFixed(1)
    return `${formatted}${units[i]}`
}

async function processRoom(source, dest, room) {

    const persistence = new LeveldbPersistence(source)
    const persistenceTarget = new LeveldbPersistence(dest)
    let doc = null
    let update = null

    try {
        // Get document
        doc = await persistence.getYDoc(room)

        // Extract data immediately
        const nodesSize = doc.getMap('nodes').size
        const edgesSize = doc.getMap('edges').size

        if (nodesSize === 0 ) {
            console.log(`Skipping empty room ${room}`)
            return
        }
        update = Y.encodeStateAsUpdate(doc)
        const updateSize = update.length

        const roomCode = room.slice(4)
        console.log(`Room ${roomCode} (size: ${humanSize(updateSize)}): ${nodesSize} nodes, ${edgesSize} edges`)
        await persistenceTarget.storeUpdate(room, update)
    } finally {
        // Clear update buffer immediately
        update = null

        // Clean up document
        doc.destroy()
        doc = null
        // Close persistence connection
        await persistence.destroy()
        await persistenceTarget.destroy()


        // Force garbage collection if available
        if (global.gc) {
            global.gc()
        }
    }
}

async function main() {
    const args = process.argv.slice(2)
    if (args.length !== 3) {
        console.error('Usage: node process-single-room.mjs <source> <dest> <room>')
        process.exit(1)
    }

    const [source, dest, room] = args

    try {
        await processRoom(source, dest, room)
        process.exit(0)
    } catch (error) {
        console.error(`Error processing ${room}:`, error.message)
        process.exit(1)
    }
}

main()