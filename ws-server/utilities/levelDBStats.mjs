/**
 * Reads all roomds in the LevelDB and prints their sizes and number of nodes/edges.
 * Designed to be resilient to OOM errors by processing rooms sequentially and cleaning up memory after each room.
 * 
 * Usage: node levelDBStats.mjs -s dbDir -v
 * Options:
 *   -s, --source <path>  Path to the LevelDB directory (default: ./dbDir)
 *   -v, --verbose        Display details of every room (default: false - just display summary statistics)
 * 
 * The script will print a summary of all rooms at the end, including any failures.
 */

import * as Y from 'yjs'
import { LeveldbPersistence } from '../src/y-leveldb.js'
import { Command } from 'commander'


const program = new Command()
let source = './dbDir'
let verbose = false

// statistics to count
let all = 0
let current = 0
let nUntitled = 0
let nNotAccessedFor6Months = 0
let nNotAccessedFor1Year = 0
let noAccessDate = 0
let nNoNodes = 0
let nOneNode = 0
let nNoEdges = 0
let nReadOnly = 0
let nCorrupt = 0

async function getAllRooms(source) {
    const persistence = new LeveldbPersistence(source)
    try {
        const rooms = await persistence.getAllDocNames()
        all = rooms.length
        console.log(`Found ${all} rooms in ${source}\n`)
        return rooms
    } finally {
        await persistence.destroy()
    }
}

function humanSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Byte'
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i]
}

async function processRoom(source, room) {
    current++
    const roomCode = room.slice(4)
    process.stdout.write(`${current}/${all} ${roomCode}\r`)

    const persistence = new LeveldbPersistence(source)
    let doc = null
    let update = null
    
    try {
        // Get document
        doc = await persistence.getYDoc(room)
        if (!doc) {
            nCorrupt++
            throw new Error('Document is null or undefined')
        }
        // Extract data immediately
        const nodesSize = doc.getMap('nodes').size
        const edgesSize = doc.getMap('edges').size
        const mapTitle = doc.getMap('network').get('mapTitle') || 'Untitled'
        const lastAccessed = doc.getMap('network').get('lastLoaded')
        const readOnly = doc.getMap('network').get('viewOnly') || false
        update = Y.encodeStateAsUpdate(doc)
        const updateSize = update.length
        
        if (verbose  || updateSize > 5 * 1024 * 1024) {
            console.log(`${current}/${all} ${roomCode} ${mapTitle} (size: ${humanSize(updateSize)}): ${nodesSize} nodes, ${edgesSize} edges,
            last accessed: ${lastAccessed ? new Date(lastAccessed).toLocaleString() : 'unknown'}`)
        }
        // Update statistics
        if (mapTitle === 'Untitled') nUntitled++
        if (!lastAccessed) noAccessDate++
        else {
            const lastAccessedDate = new Date(lastAccessed)
            const now = new Date()
            const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
            if (lastAccessedDate < sixMonthsAgo) nNotAccessedFor6Months++
            if (lastAccessedDate < oneYearAgo) nNotAccessedFor1Year++
        }
        if (nodesSize === 0) nNoNodes++
        if (nodesSize === 1) nOneNode++
        if (edgesSize === 0) nNoEdges++
        if (readOnly) nReadOnly++
    } finally {
        // Clear update buffer immediately
        update = null
        
        // Clean up document
        if (doc)  {
            doc.destroy() 
            doc = null
         }
        
        // Close persistence connection
        await persistence.destroy()
        
        // Clear all references
        doc = null
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc()
        }
    }
}

async function processAllRooms(source) {
    const rooms = await getAllRooms(source)

    const failedRooms = []
    
    for (let i = 0; i < rooms.length; i++) {
        try {
            await processRoom(source, rooms[i])
         } catch (error) {
            nCorrupt++
            failedRooms.push({ room: rooms[i], error: error.message, code: 'unknown' })
        }
    }

    console.log(`\n=== SUMMARY ===`)
    console.log(`Total rooms: ${all}`)
    console.log(`Successful: ${current}`)
    console.log(`Failed: ${nCorrupt}`)
    console.log(`Untitled: ${nUntitled}`)
    console.log(`Not accessed for 6 months: ${nNotAccessedFor6Months}`)
    console.log(`Not accessed for 1 year: ${nNotAccessedFor1Year}`)
    console.log(`No access date: ${noAccessDate}`)
    console.log(`No nodes: ${nNoNodes}`)
    console.log(`One node: ${nOneNode}`)
    console.log(`No edges: ${nNoEdges}`)
    console.log(`Read-only: ${nReadOnly}`)

    if (failedRooms.length > 0) {
        console.log(`\nFailed rooms:`)
        failedRooms.forEach(f => {
            console.log(`  ${f.room} (error: ${f.error}, code: ${f.code})`)
        })
    }
}

async function main() {
    try {
        const options = program.opts()
        if (options.source) {
            source = options.source.toString()
        }
        if (options.verbose) {
            verbose = true
        }

        console.log(`Using source DB: ${source}`)
        
        
        await processAllRooms(source)
        console.log('Processing completed.')

    } catch (error) {
        console.error('Error processing rooms:', error)
        process.exit(1)
    }
}

program
    .option('-s, --source <room>', 'path of source DB (default: ./dbDir)')
    .option('-v, --verbose', 'display details of every room')
    .description('Lists all the Yjs documents in dbDir with OOM resilience')

program.parse()
main().catch(console.error)