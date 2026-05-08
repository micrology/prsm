/**
 * Extract a single room from a LevelDB backup and save it as a .prsm file.
 *
 * Usage: node extractRoom.mjs -s <dbPath> -r <roomCode> [-o <outputFile>] [--no-compress]
 *
 * Options:
 *   -s, --source <path>    Path to the LevelDB directory (default: /data/backups/prsm/latest)
 *   -r, --room <code>      Room code, e.g. EXD-CDC-WFR-KXD
 *   -o, --output <file>    Output file path (default: <roomCode>.prsm)
 *   --no-compress          Save as plain JSON instead of lz-string compressed
 */

import {LeveldbPersistence} from './y-leveldb.js'
import lzString from 'lz-string'
import {Command} from 'commander'
import {writeFileSync} from 'fs'
const {compressToUTF16} = lzString

const program = new Command()

program
	.option('-s, --source <path>', 'path to the LevelDB directory', '/data/backups/prsm/latest')
	.option('-r, --room <code>', 'room code (e.g. EXD-CDC-WFR-KXD)', 'EXD-CDC-WFR-KXD')
	.option('-o, --output <file>', 'output file path')
	.option('--no-compress', 'save as plain JSON (not lz-string compressed)')
	.description('Extract a room from a LevelDB backup and save it as a .prsm file')

program.parse()

const opts = program.opts()
const source = opts.source
const roomCode = opts.room
const dbKey = `prsm${roomCode}`
const outputFile = opts.output || `${roomCode}.prsm`
const compress = opts.compress !== false

async function main() {
	console.log(`Opening LevelDB at: ${source}`)
	console.log(`Looking for room: ${dbKey}`)

	const persistence = new LeveldbPersistence(source)

	try {
		// Verify the room exists
		const allRooms = await persistence.getAllDocNames()
		if (!allRooms.includes(dbKey)) {
			console.error(`Room "${dbKey}" not found in database.`)
			console.error(`Available rooms containing "${roomCode}":`,
				allRooms.filter((r) => r.includes(roomCode)))
			process.exit(1)
		}

		// Get the Y.doc
		const doc = await persistence.getYDoc(dbKey)
		if (!doc) {
			console.error('Failed to load Y.doc — document is null.')
			process.exit(1)
		}

		// Extract shared types (matching prsm.js structure)
		const yNodesMap = doc.getMap('nodes')
		const yEdgesMap = doc.getMap('edges')
		const ySamplesMap = doc.getMap('samples')
		const yNetMap = doc.getMap('network')
		const yDrawingMap = doc.getMap('drawing')
		const yHistory = doc.getArray('history')

		// Convert nodes: each value in the Y.Map is the node object
		const nodes = []
		yNodesMap.forEach((value, key) => {
			const node = typeof value === 'object' && value !== null ? {...value} : value
			if (typeof node === 'object') node.id = node.id || key
			nodes.push(node)
		})

		// Convert edges
		const edges = []
		yEdgesMap.forEach((value, key) => {
			const edge = typeof value === 'object' && value !== null ? {...value} : value
			if (typeof edge === 'object') edge.id = edge.id || key
			edges.push(edge)
		})

		// Convert styles from ySamplesMap
		const styles = {nodes: {}, edges: {}}
		ySamplesMap.forEach((value, key) => {
			if (value && value.node !== undefined) {
				styles.nodes[key] = value.node
			}
			if (value && value.edge !== undefined) {
				styles.edges[key] = value.edge
			}
		})

		// Convert network settings
		const mapTitle = yNetMap.get('mapTitle') || 'Untitled'
		const attributeTitles = yNetMap.get('attributeTitles') || {}
		const mapDescription = yNetMap.get('mapDescription') || ''
		const lastNodeSample = yNetMap.get('lastNodeSample') || 'group0'
		const lastLinkSample = yNetMap.get('lastLinkSample') || 'edge0'

		// Reconstruct button settings from yNetMap
		const buttons = {
			snapToGrid: yNetMap.get('snapToGrid') || false,
			curve: yNetMap.get('curve') || 'Curved',
			background: yNetMap.get('background') || '#ffffff',
			legend: yNetMap.get('legend') || false,
			sizing: yNetMap.get('sizing') || 'off',
		}

		// Convert drawing map
		let background = '{}'
		try {
			background = JSON.stringify(yDrawingMap.toJSON())
		} catch (e) {
			console.warn('Could not serialise drawing map:', e.message)
		}

		// Convert history
		const history = yHistory.toArray().map((s) => {
			if (s && typeof s === 'object') {
				return {...s, state: null}
			}
			return s
		})

		// Build PRSM file structure (matching savePRSMfile format)
		const prsmData = {
			saved: new Date().toLocaleString(),
			version: '3.1.2',
			room: roomCode,
			mapTitle,
			lastNodeSample,
			lastLinkSample,
			buttons,
			attributeTitles,
			styles,
			nodes,
			edges,
			background,
			history,
			description: mapDescription,
		}

		const json = JSON.stringify(prsmData, null, '\t')

		console.log(`Map title: ${mapTitle}`)
		console.log(`Nodes: ${nodes.length}, Edges: ${edges.length}`)
		console.log(`History entries: ${history.length}`)

		const output = compress ? compressToUTF16(json) : json
		writeFileSync(outputFile, output, 'utf-8')
		console.log(`Saved to: ${outputFile}${compress ? ' (compressed)' : ' (plain JSON)'}`)

		doc.destroy()
	} finally {
		await persistence.destroy()
	}
}

main().catch((err) => {
	console.error('Error:', err)
	process.exit(1)
})
