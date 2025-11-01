/**
 * Resilient room copier that handles OOM errors by processing each room in a separate process
 * Usage: node copyLevelDB.mjs -s dbDir -d dbDir-copy
 */

import { spawn } from 'child_process'
import { LeveldbPersistence } from 'y-leveldb'
import { Command } from 'commander'

const program = new Command()
let source = './dbDir'
let dest = './dbDir-copy'

async function getAllRooms(source) {
    const persistence = new LeveldbPersistence(source)
    try {
        const rooms = await persistence.getAllDocNames()
        console.log(`\nFound ${rooms.length} rooms in ${source}\n`)
        return rooms
    } finally {
        await persistence.destroy()
    }
}

function processRoomInChildProcess(source, dest, room, roomIndex, totalRooms) {
    
    if (!/^prsm[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3}$/.test(room)) {
        return Promise.resolve({ success: false, room, error: 'Invalid room format', code: -1 })
    }

    return new Promise((resolve) => {
        
        const child = spawn('node', [
            '--max-old-space-size=2048',
            '--expose-gc',
            'copy-single-room.mjs',
            source,
            dest,
            room
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000 // 30 second timeout per room
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => {
            stdout += data.toString()
        })

        child.stderr.on('data', (data) => {
            stderr += data.toString()
        })

        child.on('close', (code) => {
            if (code === 0) {
                // Success - print the room info
                 console.log(`[${roomIndex + 1}/${totalRooms}] ${stdout.trim()}`)
               resolve({ success: true, room, output: stdout.trim() })
            } else {
                // Failed - likely OOM or other error
                console.log(`❌ Failed to process ${room} (exit code: ${code})`)
                if (stderr.includes('heap out of memory') || stderr.includes('FATAL ERROR')) {
                    console.log(`   Reason: Out of memory`)
                } else if (stderr) {
                    console.log(`   Error: ${stderr.trim()}`)
                }
                resolve({ success: false, room, error: stderr.trim(), code })
            }
        })

        child.on('error', (error) => {
            console.log(`❌ Failed to spawn process for ${room}: ${error.message}`)
            resolve({ success: false, room, error: error.message, code: -1 })
        })
    })
}

async function processAllRooms(source, dest) {
    const rooms = await getAllRooms(source)
    let successful = 0
    let failed = 0
    let skipped = 0
    let withData = 0

    const failedRooms = []
    
    for (let i = 0; i < rooms.length; i++) {
        const result = await processRoomInChildProcess(source, dest, rooms[i], i, rooms.length)
        
        if (result.success) {
            successful++
            // Parse the output to count rooms with data
            if (result.output.includes(' nodes, ') && !result.output.includes('0 nodes, 0 edges')) {
                withData++
            } else {
                skipped++
            }
        } else {
            failed++
            failedRooms.push({ room: result.room, error: result.error, code: result.code })
        }
    }
    
    console.log(`\n=== SUMMARY ===`)
    console.log(`Total rooms: ${rooms.length}`)
    console.log(`Successful: ${successful}`)
    console.log(`With data: ${withData}`)
    console.log(`Empty: ${skipped}`)
    console.log(`Failed: ${failed}`)
    
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
        console.log(`Using source DB: ${source}`)
        if (options.destination) {
            dest = options.destination.toString()
        }
        console.log(`Copying to destination DB: ${dest}`)
       
        await processAllRooms(source, dest)
        console.log('Processing completed.')

    } catch (error) {
        console.error('Error processing rooms:', error)
        process.exit(1)
    }
}

program
    .option('-s, --source <room>', 'path of source DB (default: ./dbDir)')
    .option('-d, --destination <room>', 'path of destination DB (default: ./dbDir-copy)')
    .description('Lists all the Yjs documents in dbDir with OOM resilience')

program.parse()
main().catch(console.error)