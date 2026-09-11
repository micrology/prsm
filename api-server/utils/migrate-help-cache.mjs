#!/usr/bin/env node
/**
 * Migrate PRSM Help Assistant cache from Classic LevelDB to SQLite.
 *
 * Dev and production each have their own helpCache instance — run this once
 * on each machine after deploying the SQLite-backed code.
 *
 * Usage:
 *   node api-server/utils/migrate-help-cache.mjs [leveldb-dir] [sqlite-db-path]
 *   node api-server/utils/migrate-help-cache.mjs --force [leveldb-dir] [sqlite-db-path]
 *
 * Defaults (from repo root):
 *   leveldb-dir:  ./helpCache   (or HELP_CACHE_LEVELDB / legacy HELP_CACHE_LOCATION dir)
 *   sqlite path:  ./helpCache.db (or HELP_CACHE_LOCATION if it ends with .db)
 *
 * Options:
 *   --force   Replace existing SQLite rows for the same question
 *
 * The old LevelDB directory is left untouched (keep as backup until verified).
 */
import path from 'node:path'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {createReadStream, createWriteStream} from 'node:fs'
import {pipeline} from 'node:stream/promises'
import {createRequire} from 'node:module'
import {
	initHelpCache,
	getCachedHelp,
	putCachedHelp,
	closeHelpCache,
	resolveHelpCachePath,
	getHelpCacheLocation,
} from '../src/help-cache.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

const require = createRequire(path.join(REPO_ROOT, 'api-server', 'package.json'))
const {ClassicLevel} = require('classic-level')

/**
 * @param {string} src
 * @param {string} dest
 */
async function copyDir(src, dest) {
	await fsp.mkdir(dest, {recursive: true})
	const entries = await fsp.readdir(src, {withFileTypes: true})
	for (const entry of entries) {
		const from = path.join(src, entry.name)
		const to = path.join(dest, entry.name)
		if (entry.isDirectory()) {
			await copyDir(from, to)
		} else if (entry.isFile()) {
			await pipeline(createReadStream(from), createWriteStream(to))
		}
	}
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	const args = argv.slice(2)
	const force = args.includes('--force')
	const positional = args.filter((a) => a !== '--force')
	return {force, positional}
}

/**
 * @param {string | undefined} candidate
 * @returns {string}
 */
function resolveLevelDbDir(candidate) {
	if (candidate) return path.resolve(candidate)
	if (process.env.HELP_CACHE_LEVELDB) return path.resolve(process.env.HELP_CACHE_LEVELDB)
	const env = process.env.HELP_CACHE_LOCATION
	if (env && !env.endsWith('.db') && !env.endsWith('.sqlite') && !env.endsWith('.sqlite3')) {
		return path.resolve(env)
	}
	return path.join(REPO_ROOT, 'helpCache')
}

/**
 * @param {string | undefined} candidate
 * @returns {string}
 */
function resolveSqlitePath(candidate) {
	if (candidate) return path.resolve(candidate)
	return resolveHelpCachePath(process.env.HELP_CACHE_LOCATION || path.join(REPO_ROOT, 'helpCache.db'))
}

async function main() {
	const {force, positional} = parseArgs(process.argv)
	const levelDbDir = resolveLevelDbDir(positional[0])
	const sqlitePath = resolveSqlitePath(positional[1])

	if (!fs.existsSync(levelDbDir)) {
		console.error(`LevelDB directory not found: ${levelDbDir}`)
		process.exit(1)
	}

	console.log(`Source LevelDB: ${levelDbDir}`)
	console.log(`Target SQLite:  ${sqlitePath}`)
	console.log(`Mode:           ${force ? 'force (overwrite)' : 'insert-or-ignore existing'}`)

	const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'prsm-helpCache-migrate-'))
	let migrated = 0
	let skipped = 0
	let errors = 0

	try {
		await copyDir(levelDbDir, tmpDir)
		try {
			await fsp.unlink(path.join(tmpDir, 'LOCK'))
		} catch {
			// ignore
		}

		const level = new ClassicLevel(tmpDir, {
			valueEncoding: 'json',
			createIfMissing: false,
		})
		await level.open()

		process.env.HELP_CACHE_LOCATION = sqlitePath
		const database = await initHelpCache({path: sqlitePath})
		if (!database) {
			throw new Error(`Could not open SQLite database at ${sqlitePath}`)
		}

		const askedAt = new Date().toISOString()

		for await (const [key, value] of level.iterator()) {
			const question = String(key)
			let response = ''
			/** @type {Array<{name?: string, url?: string|null}>} */
			let sources = []

			if (value && typeof value === 'object') {
				response = String(value.response ?? value.answer ?? '')
				if (Array.isArray(value.sources)) sources = value.sources
			} else if (typeof value === 'string') {
				response = value
			} else if (value != null) {
				response = JSON.stringify(value)
			}

			if (!question || !response) {
				skipped += 1
				continue
			}

			try {
				if (!force) {
					const existing = await getCachedHelp(question)
					if (existing) {
						skipped += 1
						continue
					}
				}

				const ok = await putCachedHelp({
					standaloneQuery: question,
					rawQuestion: question,
					response,
					sources,
					room: null,
					outcome: 'unknown',
					askedAt,
				})
				if (ok) migrated += 1
				else {
					errors += 1
					console.error(`Failed to write: ${question.slice(0, 80)}`)
				}
			} catch (err) {
				errors += 1
				console.error(`Error on "${question.slice(0, 80)}":`, err?.message || err)
			}
		}

		await level.close()
	} finally {
		await closeHelpCache().catch(() => {})
		await fsp.rm(tmpDir, {recursive: true, force: true}).catch(() => {})
	}

	console.log('')
	console.log(`Done. Migrated: ${migrated}, skipped: ${skipped}, errors: ${errors}`)
	console.log(`SQLite database: ${getHelpCacheLocation()}`)
	console.log('Old LevelDB directory left in place as backup — remove only after verification.')
	console.log('')
	console.log('Remember: run this migration separately on each machine (dev and production)')
	console.log('that has its own helpCache data.')

	if (errors > 0) process.exitCode = 1
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
