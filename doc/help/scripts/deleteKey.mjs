#!/usr/bin/env node
/**
 * Delete one help cache entry by exact question text.
 *
 * Usage: node deleteKey.mjs <db-path> <question>
 *    or: node deleteKey.mjs <question>   (uses HELP_CACHE_LOCATION / default helpCache.db)
 */
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {existsSync} from 'node:fs'
import {homedir} from 'node:os'
import {
	initHelpCache,
	getCachedHelp,
	deleteHelpCacheKey,
	closeHelpCache,
	resolveHelpCachePath,
} from '../../../api-server/src/help-cache.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

let args = process.argv.slice(2)
if (args[0]?.startsWith('~')) {
	args[0] = args[0].replace('~', homedir())
}

let dbPath
let key

if (args.length >= 2) {
	dbPath = resolveHelpCachePath(args[0])
	key = args.slice(1).join(' ')
} else if (args.length === 1) {
	dbPath = resolveHelpCachePath(
		process.env.HELP_CACHE_LOCATION || path.join(REPO_ROOT, 'helpCache.db'),
	)
	key = args[0]
} else {
	console.error('Usage: node deleteKey.mjs [<db-path>] <question>')
	process.exit(1)
}

if (!existsSync(dbPath)) {
	console.error(`Database path does not exist: ${dbPath}`)
	process.exit(1)
}

if (!key || key.trim().length === 0) {
	console.error('Key must be a non-empty string')
	process.exit(1)
}

process.env.HELP_CACHE_LOCATION = dbPath

try {
	const database = await initHelpCache({path: dbPath})
	if (!database) {
		console.error(`Failed to open help cache at ${dbPath}`)
		process.exit(1)
	}

	const existing = await getCachedHelp(key)
	if (!existing) {
		console.error(`Key "${key}" not found in database`)
		process.exitCode = 1
	} else {
		const deleted = await deleteHelpCacheKey(key)
		if (deleted) {
			console.log(`Deleted key: "${key}"`)
		} else {
			console.error(`Key "${key}" still present after deletion`)
			process.exitCode = 1
		}
	}
} catch (err) {
	console.error(`Error: ${err.message}`)
	process.exitCode = 1
} finally {
	await closeHelpCache().catch(() => {})
}
