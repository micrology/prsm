#!/usr/bin/env node
/**
 * List all help cache entries from the SQLite helpCache database.
 *
 * Usage: node listKeys.mjs [db-path]
 * Default: HELP_CACHE_LOCATION or ../../helpCache.db from repo root.
 */
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {existsSync} from 'node:fs'
import {homedir} from 'node:os'
import {
	initHelpCache,
	listHelpCache,
	closeHelpCache,
	getHelpCacheLocation,
	resolveHelpCachePath,
} from '../../../api-server/src/help-cache.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

let [helpCacheLocation] = process.argv.slice(2)

if (helpCacheLocation?.startsWith('~')) {
	helpCacheLocation = helpCacheLocation.replace('~', homedir())
}

const dbPath = resolveHelpCachePath(
	helpCacheLocation || process.env.HELP_CACHE_LOCATION || path.join(REPO_ROOT, 'helpCache.db'),
)

if (!existsSync(dbPath)) {
	console.error(`Database path does not exist: ${dbPath}`)
	process.exit(1)
}

process.env.HELP_CACHE_LOCATION = dbPath

try {
	const database = await initHelpCache({path: dbPath})
	if (!database) {
		console.error(`Failed to open help cache at ${dbPath}`)
		process.exit(1)
	}

	const entries = await listHelpCache()
	if (entries.length === 0) {
		console.log('Database is empty.')
	} else {
		let count = 0
		for (const entry of entries) {
			count += 1
			console.log(`\n--- Entry ${count} ---`)
			console.log(`STANDALONE: ${entry.standaloneQuery || entry.question}`)
			if (entry.rawQuestion) console.log(`RAW:       ${entry.rawQuestion}`)
			console.log(`ASKED_AT:  ${entry.askedAt}`)
			console.log(`ROOM:     ${entry.room || '—'}`)
			console.log(`OUTCOME:  ${entry.outcome}`)
			console.log(`SOURCES:  ${JSON.stringify(entry.sources)}`)
			console.log(`RESPONSE: ${entry.response}`)
		}
		console.log(`\nTotal entries: ${count}`)
	}
	console.log(`Database: ${getHelpCacheLocation()}`)
} catch (err) {
	console.error(`Error: ${err.message}`)
	process.exitCode = 1
} finally {
	await closeHelpCache().catch(() => {})
}
