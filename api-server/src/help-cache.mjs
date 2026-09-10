/**
 * SQLite-backed cache for PRSM Help Assistant Q&A.
 *
 * One row per first-turn question (UNIQUE). Metadata (room, asked_at, outcome)
 * is for ops/dashboard; the public HTTP response still only returns
 * { response, sources }.
 *
 * Store failures are logged and must never break the user-facing request.
 */
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sqlite3 from 'sqlite3'

const DEFAULT_DB_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../helpCache.db')

/** @type {sqlite3.Database | null} */
let db = null
/** @type {string | null} */
let dbPath = null

/**
 * Resolve HELP_CACHE_LOCATION to a SQLite file path.
 * Accepts a `.db` file path, or a legacy LevelDB directory path (appends `.db`).
 * @param {string | undefined} location
 * @returns {string}
 */
export function resolveHelpCachePath(location = process.env.HELP_CACHE_LOCATION) {
	if (!location) return DEFAULT_DB_PATH
	if (location.endsWith('.db') || location.endsWith('.sqlite') || location.endsWith('.sqlite3')) {
		return path.resolve(location)
	}
	// Legacy LevelDB directory env → sibling/adjacent file name
	return path.resolve(`${location}.db`)
}

/**
 * Promise-based wrapper around sqlite3 `db.run`.
 * @param {sqlite3.Database} database
 * @param {string} sql
 * @param {unknown[]} [params=[]]
 * @returns {Promise<sqlite3.RunResult>}
 */
function run(database, sql, params = []) {
	return new Promise((resolve, reject) => {
		database.run(sql, params, function runCallback(err) {
			if (err) {
				reject(err)
				return
			}
			resolve(this)
		})
	})
}

/**
 * Promise-based wrapper around sqlite3 `db.get`.
 * @param {sqlite3.Database} database
 * @param {string} sql
 * @param {unknown[]} [params=[]]
 * @returns {Promise<any>}
 */
function get(database, sql, params = []) {
	return new Promise((resolve, reject) => {
		database.get(sql, params, (err, row) => {
			if (err) {
				reject(err)
				return
			}
			resolve(row)
		})
	})
}

/**
 * Promise-based wrapper around sqlite3 `db.all`.
 * @param {sqlite3.Database} database
 * @param {string} sql
 * @param {unknown[]} [params=[]]
 * @returns {Promise<any[]>}
 */
function all(database, sql, params = []) {
	return new Promise((resolve, reject) => {
		database.all(sql, params, (err, rows) => {
			if (err) {
				reject(err)
				return
			}
			resolve(rows)
		})
	})
}

/**
 * @param {unknown} value
 * @returns {Array<{name?: string, url?: string|null}>}
 */
function parseSources(value) {
	if (!value) return []
	try {
		const parsed = typeof value === 'string' ? JSON.parse(value) : value
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

/**
 * @param {any} row
 * @returns {{question: string, response: string, sources: Array<{name?: string, url?: string|null}>, room: string|null, askedAt: string|null, outcome: string}}
 */
function mapRow(row) {
	return {
		question: String(row.question ?? ''),
		response: String(row.response ?? ''),
		sources: parseSources(row.sources_json),
		room: row.room ? String(row.room) : null,
		askedAt: row.asked_at ? String(row.asked_at) : null,
		outcome: String(row.outcome || 'unknown'),
	}
}

/**
 * Open helpCache.db (creating it if absent) and ensure the schema exists.
 * Safe to call once at startup; subsequent calls reuse the open handle.
 * @param {{path?: string}} [options]
 * @returns {Promise<sqlite3.Database | null>} null if the store is unavailable
 */
export async function initHelpCache(options = {}) {
	if (db) return db

	const targetPath = resolveHelpCachePath(options.path ?? process.env.HELP_CACHE_LOCATION)

	try {
		const database = await new Promise((resolve, reject) => {
			const handle = new sqlite3.Database(
				targetPath,
				sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
				(err) => (err ? reject(err) : resolve(handle)),
			)
		})

		await run(database, 'PRAGMA journal_mode = WAL')
		await run(database, 'PRAGMA busy_timeout = 5000')

		await run(
			database,
			`CREATE TABLE IF NOT EXISTS help_cache (
				id            INTEGER PRIMARY KEY,
				question      TEXT    NOT NULL UNIQUE,
				response      TEXT    NOT NULL,
				sources_json  TEXT    NOT NULL DEFAULT '[]',
				room          TEXT,
				asked_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
				outcome       TEXT    NOT NULL DEFAULT 'unknown'
			)`,
		)
		await run(database, 'CREATE INDEX IF NOT EXISTS idx_help_cache_asked_at ON help_cache(asked_at)')

		db = database
		dbPath = targetPath
		return db
	} catch (error) {
		console.error(`Help cache unavailable at ${targetPath}:`, error?.message || error)
		return null
	}
}

/**
 * Path of the open DB, or the resolved default if not yet open.
 * @returns {string}
 */
export function getHelpCacheLocation() {
	return dbPath || resolveHelpCachePath()
}

/**
 * Look up a cached answer by exact first-turn question text.
 * @param {string} question
 * @returns {Promise<{response: string, sources: Array<{name?: string, url?: string|null}>, room: string|null, askedAt: string|null, outcome: string} | null>}
 */
export async function getCachedHelp(question) {
	try {
		const database = await initHelpCache()
		if (!database || !question) return null
		const row = await get(database, 'SELECT * FROM help_cache WHERE question = ?', [question])
		return row ? mapRow(row) : null
	} catch (error) {
		console.error('Failed to read help cache:', error?.message || error)
		return null
	}
}

/**
 * Insert or replace a cached help answer.
 * @param {{
 *   question: string,
 *   response: string,
 *   sources?: Array<{name?: string, url?: string|null}>,
 *   room?: string | null,
 *   outcome?: string,
 *   askedAt?: string | null,
 * }} entry
 * @returns {Promise<boolean>} true if written
 */
export async function putCachedHelp(entry) {
	try {
		const database = await initHelpCache()
		if (!database) return false

		const question = String(entry.question ?? '')
		const response = String(entry.response ?? '')
		if (!question || !response) return false

		const sourcesJson = JSON.stringify(Array.isArray(entry.sources) ? entry.sources : [])
		const room = entry.room || null
		const outcome = entry.outcome || 'unknown'
		const askedAt = entry.askedAt || new Date().toISOString()

		await run(
			database,
			`INSERT INTO help_cache (question, response, sources_json, room, asked_at, outcome)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(question) DO UPDATE SET
			   response = excluded.response,
			   sources_json = excluded.sources_json,
			   room = excluded.room,
			   asked_at = excluded.asked_at,
			   outcome = excluded.outcome`,
			[question, response, sourcesJson, room, askedAt, outcome],
		)
		return true
	} catch (error) {
		console.error('Failed to write help cache:', error?.message || error)
		return false
	}
}

/**
 * List all cached entries, newest first.
 * @returns {Promise<Array<{question: string, response: string, sources: Array<{name?: string, url?: string|null}>, room: string|null, askedAt: string|null, outcome: string}>>}
 */
export async function listHelpCache() {
	try {
		const database = await initHelpCache()
		if (!database) return []
		const rows = await all(database, 'SELECT * FROM help_cache ORDER BY asked_at DESC, id DESC')
		return rows.map(mapRow)
	} catch (error) {
		console.error('Failed to list help cache:', error?.message || error)
		return []
	}
}

/**
 * Delete one cached question.
 * @param {string} question
 * @returns {Promise<boolean>} true if a row was deleted
 */
export async function deleteHelpCacheKey(question) {
	try {
		const database = await initHelpCache()
		if (!database || !question) return false
		const result = await run(database, 'DELETE FROM help_cache WHERE question = ?', [question])
		return (result?.changes ?? 0) > 0
	} catch (error) {
		console.error('Failed to delete help cache key:', error?.message || error)
		return false
	}
}

/**
 * Close the open database handle.
 * @returns {Promise<void>}
 */
export async function closeHelpCache() {
	if (!db) return
	const handle = db
	db = null
	dbPath = null
	await new Promise((resolve, reject) => {
		handle.close((err) => (err ? reject(err) : resolve()))
	})
}
