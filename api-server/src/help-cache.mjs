/**
 * SQLite-backed cache for PRSM Help Assistant Q&A.
 *
 * Cache key is the standalone / reformulated search query (UNIQUE), not the
 * raw chat utterance. Follow-ups are rephrased before lookup/store so keys
 * stay meaningful. raw_question keeps what the user typed for the dashboard.
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
	return path.resolve(`${location}.db`)
}

/**
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
 * @returns {{
 *   question: string,
 *   standaloneQuery: string,
 *   rawQuestion: string|null,
 *   response: string,
 *   sources: Array<{name?: string, url?: string|null}>,
 *   room: string|null,
 *   askedAt: string|null,
 *   outcome: string,
 * }}
 */
function mapRow(row) {
	const standalone = String(row.standalone_query ?? row.question ?? '')
	const raw = row.raw_question != null && String(row.raw_question) !== '' ? String(row.raw_question) : null
	return {
		// Primary display / cache key (standalone reformulated query)
		question: standalone,
		standaloneQuery: standalone,
		rawQuestion: raw && raw !== standalone ? raw : null,
		response: String(row.response ?? ''),
		sources: parseSources(row.sources_json),
		room: row.room ? String(row.room) : null,
		askedAt: row.asked_at ? String(row.asked_at) : null,
		outcome: String(row.outcome || 'unknown'),
	}
}

/**
 * Ensure schema supports standalone_query + raw_question (migrate older DBs).
 * @param {sqlite3.Database} database
 */
async function ensureSchema(database) {
	await run(
		database,
		`CREATE TABLE IF NOT EXISTS help_cache (
			id               INTEGER PRIMARY KEY,
			question         TEXT    NOT NULL,
			standalone_query TEXT,
			raw_question     TEXT,
			response         TEXT    NOT NULL,
			sources_json     TEXT    NOT NULL DEFAULT '[]',
			room             TEXT,
			asked_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
			outcome          TEXT    NOT NULL DEFAULT 'unknown'
		)`,
	)

	const columns = await all(database, 'PRAGMA table_info(help_cache)')
	const names = new Set(columns.map((c) => c.name))

	if (!names.has('standalone_query')) {
		await run(database, 'ALTER TABLE help_cache ADD COLUMN standalone_query TEXT')
	}
	if (!names.has('raw_question')) {
		await run(database, 'ALTER TABLE help_cache ADD COLUMN raw_question TEXT')
	}

	// Backfill from legacy `question` column (was the cache key).
	await run(
		database,
		`UPDATE help_cache
		    SET standalone_query = COALESCE(NULLIF(standalone_query, ''), question),
		        raw_question = COALESCE(NULLIF(raw_question, ''), question)
		  WHERE standalone_query IS NULL
		     OR standalone_query = ''
		     OR raw_question IS NULL
		     OR raw_question = ''`,
	)

	await run(database, 'CREATE INDEX IF NOT EXISTS idx_help_cache_asked_at ON help_cache(asked_at)')
	// Unique cache key: reformulated / standalone query
	await run(
		database,
		'CREATE UNIQUE INDEX IF NOT EXISTS idx_help_cache_standalone ON help_cache(standalone_query)',
	)
}

/**
 * Open helpCache.db (creating it if absent) and ensure the schema exists.
 * @param {{path?: string}} [options]
 * @returns {Promise<sqlite3.Database | null>}
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
		await ensureSchema(database)

		db = database
		dbPath = targetPath
		return db
	} catch (error) {
		console.error(`Help cache unavailable at ${targetPath}:`, error?.message || error)
		return null
	}
}

/**
 * @returns {string}
 */
export function getHelpCacheLocation() {
	return dbPath || resolveHelpCachePath()
}

/**
 * Look up a cached answer by standalone / reformulated query text.
 * @param {string} standaloneQuery
 * @returns {Promise<object | null>}
 */
export async function getCachedHelp(standaloneQuery) {
	try {
		const database = await initHelpCache()
		if (!database || !standaloneQuery) return null
		const row = await get(
			database,
			`SELECT * FROM help_cache
			  WHERE standalone_query = ?
			     OR (standalone_query IS NULL AND question = ?)
			  LIMIT 1`,
			[standaloneQuery, standaloneQuery],
		)
		return row ? mapRow(row) : null
	} catch (error) {
		console.error('Failed to read help cache:', error?.message || error)
		return null
	}
}

/**
 * Insert or replace a cached help answer keyed by standalone query.
 * @param {{
 *   standaloneQuery?: string,
 *   rawQuestion?: string | null,
 *   question?: string,
 *   response: string,
 *   sources?: Array<{name?: string, url?: string|null}>,
 *   room?: string | null,
 *   outcome?: string,
 *   askedAt?: string | null,
 * }} entry
 * @returns {Promise<boolean>}
 */
export async function putCachedHelp(entry) {
	try {
		const database = await initHelpCache()
		if (!database) return false

		const standaloneQuery = String(entry.standaloneQuery ?? entry.question ?? '')
		const rawQuestion = String(entry.rawQuestion ?? entry.question ?? standaloneQuery)
		const response = String(entry.response ?? '')
		if (!standaloneQuery || !response) return false

		const sourcesJson = JSON.stringify(Array.isArray(entry.sources) ? entry.sources : [])
		const room = entry.room || null
		const outcome = entry.outcome || 'unknown'
		const askedAt = entry.askedAt || new Date().toISOString()

		// Keep legacy `question` column in sync with the cache key for older tools.
		await run(
			database,
			`INSERT INTO help_cache
			   (question, standalone_query, raw_question, response, sources_json, room, asked_at, outcome)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(standalone_query) DO UPDATE SET
			   question = excluded.question,
			   raw_question = excluded.raw_question,
			   response = excluded.response,
			   sources_json = excluded.sources_json,
			   room = excluded.room,
			   asked_at = excluded.asked_at,
			   outcome = excluded.outcome`,
			[standaloneQuery, standaloneQuery, rawQuestion, response, sourcesJson, room, askedAt, outcome],
		)
		await run(database, 'PRAGMA wal_checkpoint(PASSIVE)').catch(() => {})
		return true
	} catch (error) {
		console.error('Failed to write help cache:', error?.message || error)
		return false
	}
}

/**
 * List all cached entries, newest first.
 * @returns {Promise<object[]>}
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
 * Delete one cached entry by standalone query (or legacy question text).
 * @param {string} standaloneQuery
 * @returns {Promise<boolean>}
 */
export async function deleteHelpCacheKey(standaloneQuery) {
	try {
		const database = await initHelpCache()
		if (!database || !standaloneQuery) return false
		const result = await run(
			database,
			`DELETE FROM help_cache
			  WHERE standalone_query = ?
			     OR question = ?`,
			[standaloneQuery, standaloneQuery],
		)
		return (result?.changes ?? 0) > 0
	} catch (error) {
		console.error('Failed to delete help cache key:', error?.message || error)
		return false
	}
}

/**
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
