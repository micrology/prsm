#!/usr/bin/env node
/**
 * PRSM usage dashboard server.
 * Binds exclusively to 127.0.0.1:8881 and rejects non-local clients.
 *
 * Start: node utils/dashboard-server.mjs
 * Open:  http://127.0.0.1:8881/
 */

import http from 'node:http'
import fs, {createReadStream} from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createRequire} from 'node:module'

process.title = 'prsm-dashboard'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, 'public')
const REPO_ROOT = path.resolve(__dirname, '..')
const ACCESS_LOG = '/data/logs/apache/access_log'
const HELP_CACHE_DB = process.env.HELP_CACHE_LOCATION
	? path.resolve(process.env.HELP_CACHE_LOCATION.endsWith('.db') ||
			process.env.HELP_CACHE_LOCATION.endsWith('.sqlite') ||
			process.env.HELP_CACHE_LOCATION.endsWith('.sqlite3')
			? process.env.HELP_CACHE_LOCATION
			: `${process.env.HELP_CACHE_LOCATION}.db`)
	: path.join(REPO_ROOT, 'helpCache.db')
const HOST = '127.0.0.1'
const PORT = 8881

const require = createRequire(path.join(REPO_ROOT, 'api-server', 'package.json'))
const sqlite3 = require('sqlite3')

const ROOM_RE = /[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3}/
const API_ROOM_PATH_RE =
	/^\/api\/(?:chat|map)\/([A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3})(?:\/(allFactorsAndLinks|factor|link|styles)(?:\/[^/?#]+)?)?\/?$/
const HELP_PATH_RE = /^\/api\/helpAssistant\/?$/
const WSS_PATH_RE = /^\/wss\/prsm([A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3})\b/
const LOG_LINE_RE =
	/^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)]\s+\S+\s+"([A-Z]+)\s+([^"]*?)\s+HTTP\/[^"]+"\s+(\d{3})/

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
}

/**
 * @param {string|undefined} address
 * @returns {boolean}
 */
function isLocalAddress(address) {
	if (!address) return false
	return (
		address === '127.0.0.1' ||
		address === '::1' ||
		address === '::ffff:127.0.0.1' ||
		address === 'localhost'
	)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
function isLocalRequest(req) {
	const remote = req.socket.remoteAddress
	if (!isLocalAddress(remote)) return false

	const host = String(req.headers.host || '')
		.split(':')[0]
		.toLowerCase()
	if (host && host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]') {
		return false
	}
	return true
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{timeout?: number}} [opts]
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function run(command, args, opts = {}) {
	try {
		const {stdout, stderr} = await execFileAsync(command, args, {
			timeout: opts.timeout ?? 15000,
			maxBuffer: 20 * 1024 * 1024,
			encoding: 'utf8',
		})
		return {stdout: stdout || '', stderr: stderr || ''}
	} catch (error) {
		const err = /** @type {Error & {stdout?: string, stderr?: string}} */ (error)
		return {
			stdout: err.stdout || '',
			stderr: err.stderr || err.message || String(error),
		}
	}
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return 'n/a'
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
	let value = bytes
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}
	const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2
	return `${value.toFixed(digits)} ${units[unit]}`
}

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
	const s = Math.max(0, Math.floor(seconds))
	const days = Math.floor(s / 86400)
	const hours = Math.floor((s % 86400) / 3600)
	const mins = Math.floor((s % 3600) / 60)
	const secs = s % 60
	const parts = []
	if (days) parts.push(`${days}d`)
	if (hours || days) parts.push(`${hours}h`)
	parts.push(`${mins}m`, `${secs}s`)
	return parts.join(' ')
}

/**
 * Apache log date like 06/Sep/2026:15:09:09 +0100 → Date
 * @param {string} stamp
 * @returns {Date|null}
 */
function parseApacheDate(stamp) {
	const match = stamp.match(
		/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})$/,
	)
	if (!match) return null
	const months = {
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11,
	}
	const [, dd, mon, yyyy, hh, mm, ss, tz] = match
	const month = months[mon]
	if (month === undefined) return null
	const iso = `${yyyy}-${String(month + 1).padStart(2, '0')}-${dd}T${hh}:${mm}:${ss}${tz.slice(0, 3)}:${tz.slice(3)}`
	const date = new Date(iso)
	return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Local calendar day bounds for "today" filtering.
 * @returns {{startMs: number, endMs: number, label: string}}
 */
function todayBounds() {
	const now = new Date()
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const end = new Date(start)
	end.setDate(end.getDate() + 1)
	return {
		startMs: start.getTime(),
		endMs: end.getTime(),
		label: start.toLocaleDateString('en-GB', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		}),
	}
}

/**
 * Stream-parse today's access log lines.
 * @returns {Promise<Array<{ip: string, date: Date, method: string, path: string, status: number}>>}
 */
async function readTodayAccessEntries() {
	const {startMs, endMs} = todayBounds()
	const entries = []

	if (!fs.existsSync(ACCESS_LOG)) return entries

	const stream = createReadStream(ACCESS_LOG, {encoding: 'utf8'})
	let buffer = ''

	for await (const chunk of stream) {
		buffer += chunk
		let newline = buffer.indexOf('\n')
		while (newline !== -1) {
			const line = buffer.slice(0, newline)
			buffer = buffer.slice(newline + 1)
			newline = buffer.indexOf('\n')

			const match = line.match(LOG_LINE_RE)
			if (!match) continue
			const date = parseApacheDate(match[2])
			if (!date) continue
			const ts = date.getTime()
			if (ts < startMs || ts >= endMs) continue

			const rawPath = match[4].split('?')[0]
			entries.push({
				ip: match[1],
				date,
				method: match[3],
				path: rawPath,
				status: Number(match[5]),
			})
		}
	}

	return entries
}

/**
 * Normalise a PRSM API path into a route template.
 * @param {string} method
 * @param {string} urlPath
 * @returns {string|null}
 */
function normaliseApiRoute(method, urlPath) {
	if (HELP_PATH_RE.test(urlPath)) return `${method} /api/helpAssistant`

	const match = urlPath.match(API_ROOM_PATH_RE)
	if (!match) return null

	const [, , sub] = match
	if (!sub) {
		if (urlPath.startsWith('/api/chat/')) return `${method} /api/chat/:room`
		return `${method} /api/map/:room`
	}
	if (sub === 'allFactorsAndLinks') return `${method} /api/map/:room/allFactorsAndLinks`
	if (sub === 'factor') return `${method} /api/map/:room/factor/:id`
	if (sub === 'link') return `${method} /api/map/:room/link/:id`
	if (sub === 'styles') {
		if (/\/styles\/[^/]+$/.test(urlPath)) return `${method} /api/map/:room/styles/:id`
		return `${method} /api/map/:room/styles`
	}
	return null
}

/**
 * Collect host/OS statistics.
 */
async function collectServerStats() {
	const [uptimeContent, meminfo, loadavg, disk, topMem, httpdCount, phpCount, uname] =
		await Promise.all([
			fsp.readFile('/proc/uptime', 'utf8').catch(() => '0 0'),
			fsp.readFile('/proc/meminfo', 'utf8').catch(() => ''),
			fsp.readFile('/proc/loadavg', 'utf8').catch(() => '0 0 0 0/0 0'),
			run('df', ['-B1', '/', '/data']),
			run('ps', ['-eo', 'pid,user,rss,pmem,comm,args', '--sort=-rss']),
			run('pgrep', ['-c', 'httpd']),
			run('bash', ['-lc', 'pgrep -c php-fpm || pgrep -c php-fpm: || echo 0']),
			run('uname', ['-sr']),
		])

	const uptimeSeconds = Number(uptimeContent.trim().split(/\s+/)[0]) || 0
	const mem = {}
	for (const line of meminfo.split('\n')) {
		const m = line.match(/^(\w+):\s+(\d+)\s+kB/)
		if (m) mem[m[1]] = Number(m[2]) * 1024
	}

	const loadParts = loadavg.trim().split(/\s+/)
	const loadAverage = {
		one: Number(loadParts[0]) || 0,
		five: Number(loadParts[1]) || 0,
		fifteen: Number(loadParts[2]) || 0,
		raw: loadavg.trim(),
	}

	const disks = disk.stdout
		.trim()
		.split('\n')
		.slice(1)
		.map((line) => {
			const parts = line.split(/\s+/)
			if (parts.length < 6) return null
			return {
				filesystem: parts[0],
				size: Number(parts[1]) || 0,
				used: Number(parts[2]) || 0,
				available: Number(parts[3]) || 0,
				usePercent: parts[4],
				mount: parts[5],
				sizeHuman: formatBytes(Number(parts[1]) || 0),
				usedHuman: formatBytes(Number(parts[2]) || 0),
				availableHuman: formatBytes(Number(parts[3]) || 0),
			}
		})
		.filter(Boolean)

	const topLines = topMem.stdout.trim().split('\n').slice(1)
	const largest = topLines[0] ? topLines[0].trim().split(/\s+/) : []
	const largestProcess = largest.length
		? {
				pid: Number(largest[0]) || null,
				user: largest[1] || '',
				rssBytes: (Number(largest[2]) || 0) * 1024,
				rssHuman: formatBytes((Number(largest[2]) || 0) * 1024),
				pmem: largest[3] || '',
				command: largest[4] || '',
				args: largest.slice(5).join(' ').slice(0, 120),
			}
		: null

	const cpuCount = os.cpus()?.length || 0
	const apacheProcesses = Number(httpdCount.stdout.trim()) || 0
	const phpFpmProcesses = Number(String(phpCount.stdout).trim().split('\n').pop()) || 0

	return {
		hostname: os.hostname(),
		platform: uname.stdout.trim() || `${os.type()} ${os.release()}`,
		uptimeSeconds,
		uptimeHuman: formatUptime(uptimeSeconds),
		loadAverage,
		cpuCount,
		memory: {
			totalBytes: mem.MemTotal || 0,
			freeBytes: mem.MemFree || 0,
			availableBytes: mem.MemAvailable || 0,
			buffersBytes: mem.Buffers || 0,
			cachedBytes: mem.Cached || 0,
			totalHuman: formatBytes(mem.MemTotal || 0),
			freeHuman: formatBytes(mem.MemFree || 0),
			availableHuman: formatBytes(mem.MemAvailable || 0),
			usedHuman: formatBytes(Math.max(0, (mem.MemTotal || 0) - (mem.MemAvailable || 0))),
			usedPercent:
				mem.MemTotal > 0
					? Math.round((100 * (mem.MemTotal - (mem.MemAvailable || 0))) / mem.MemTotal)
					: null,
		},
		swap: {
			totalBytes: mem.SwapTotal || 0,
			freeBytes: mem.SwapFree || 0,
			totalHuman: formatBytes(mem.SwapTotal || 0),
			freeHuman: formatBytes(mem.SwapFree || 0),
			usedHuman: formatBytes(Math.max(0, (mem.SwapTotal || 0) - (mem.SwapFree || 0))),
			usedPercent:
				mem.SwapTotal > 0
					? Math.round((100 * (mem.SwapTotal - (mem.SwapFree || 0))) / mem.SwapTotal)
					: 0,
		},
		largestProcess,
		apacheProcesses,
		phpFpmProcesses,
		disks,
	}
}

/**
 * Parse active websocket client IPs via httpd proxy connections
 * (same approach as ~/list-websocket-clients.sh).
 * @returns {Promise<{clients: Array<{ip: string, connections: number}>, usersOnline: number, error?: string}>}
 */
async function collectOnlineWebsocketUsers() {
	const {stdout, stderr} = await run('sudo', ['-n', 'ss', '-tnp', 'state', 'established'], {
		timeout: 10000,
	})
	if (!stdout && stderr) {
		return {clients: [], usersOnline: 0, error: stderr.trim()}
	}

	const lines = stdout.split('\n')
	const wsPids = new Set()

	for (const line of lines) {
		if (!line.includes('httpd')) continue
		if (!line.includes(':1234')) continue
		const pidMatch = line.match(/pid=(\d+)/)
		if (pidMatch) wsPids.add(pidMatch[1])
	}

	/** @type {Map<string, number>} */
	const ipCounts = new Map()

	for (const line of lines) {
		if (!line.includes('httpd')) continue
		const pidMatch = line.match(/pid=(\d+)/)
		if (!pidMatch || !wsPids.has(pidMatch[1])) continue

		const addrs = [...line.matchAll(/(?:\[::ffff:)?(\d+\.\d+\.\d+\.\d+)\]?:(\d+)/g)]
		if (addrs.length < 2) continue
		const peerIp = addrs[1][1]
		if (!peerIp || peerIp === '127.0.0.1') continue
		ipCounts.set(peerIp, (ipCounts.get(peerIp) || 0) + 1)
	}

	const clients = [...ipCounts.entries()]
		.map(([ip, connections]) => ({ip, connections}))
		.sort((a, b) => b.connections - a.connections)

	return {clients, usersOnline: clients.length}
}

/**
 * Service memory from systemd.
 * @param {string} unit
 */
async function serviceMemory(unit) {
	const {stdout} = await run('systemctl', [
		'show',
		unit,
		'-p',
		'MemoryCurrent',
		'-p',
		'MainPID',
		'-p',
		'ActiveState',
		'-p',
		'SubState',
		'--no-pager',
	])
	/** @type {Record<string, string>} */
	const props = {}
	for (const line of stdout.split('\n')) {
		const idx = line.indexOf('=')
		if (idx > 0) props[line.slice(0, idx)] = line.slice(idx + 1).trim()
	}
	const memoryCurrent = Number(props.MemoryCurrent)
	return {
		activeState: props.ActiveState || 'unknown',
		subState: props.SubState || 'unknown',
		mainPid: Number(props.MainPID) || null,
		memoryBytes: Number.isFinite(memoryCurrent) && memoryCurrent >= 0 ? memoryCurrent : null,
		memoryHuman:
			Number.isFinite(memoryCurrent) && memoryCurrent >= 0
				? formatBytes(memoryCurrent)
				: 'n/a',
	}
}

/**
 * Websocket section metrics.
 * @param {Array<{ip: string, path: string}>} accessEntries
 */
async function collectWebsocketStats(accessEntries) {
	const [service, online, journalTail] = await Promise.all([
		serviceMemory('websocket-server.service'),
		collectOnlineWebsocketUsers(),
		run('journalctl', [
			'-u',
			'websocket-server.service',
			'-n',
			'80',
			'--no-pager',
			'-o',
			'cat',
		]),
	])

	/** @type {Map<string, number>} */
	const roomCounts = new Map()
	const users = new Set()
	let wssHits = 0

	for (const entry of accessEntries) {
		const roomMatch = entry.path.match(WSS_PATH_RE)
		if (!roomMatch) continue
		wssHits += 1
		const room = roomMatch[1]
		roomCounts.set(room, (roomCounts.get(room) || 0) + 1)
		users.add(entry.ip)
	}

	const activeDocs = new Map()
	for (const line of journalTail.stdout.split('\n')) {
		const open = line.match(
			/There are (\d+) connections for document "prsm([A-Z0-9-]+)"/,
		)
		if (open) {
			activeDocs.set(open[2], Number(open[1]))
			continue
		}
		const closed = line.match(
			/All connections closed for document "prsm([A-Z0-9-]+)"/,
		)
		if (closed) activeDocs.delete(closed[1])
	}

	const activeConnections = [...activeDocs.values()].reduce((a, b) => a + b, 0)

	const roomsToday = [...roomCounts.entries()]
		.map(([room, count]) => ({room, count}))
		.sort((a, b) => b.count - a.count || a.room.localeCompare(b.room))

	return {
		service,
		usersToday: users.size,
		roomsAccessedToday: roomCounts.size,
		roomsToday,
		wssHitsToday: wssHits,
		usersOnlineNow: online.usersOnline,
		onlineClients: online.clients,
		onlineError: online.error || null,
		activeDocuments: [...activeDocs.entries()].map(([room, connections]) => ({
			room,
			connections,
		})),
		activeConnections,
	}
}

/**
 * API server section metrics.
 * @param {Array<{ip: string, method: string, path: string}>} accessEntries
 */
async function collectApiStats(accessEntries) {
	const service = await serviceMemory('prsm-api-server.service')

	/** @type {Map<string, number>} */
	const routeCounts = new Map()
	/** @type {Map<string, number>} */
	const ipCounts = new Map()
	/** @type {Map<string, number>} */
	const roomCounts = new Map()
	const users = new Set()
	let apiHits = 0
	let otherApiHits = 0

	for (const entry of accessEntries) {
		if (!entry.path.startsWith('/api/')) continue
		const route = normaliseApiRoute(entry.method, entry.path)
		if (!route) {
			otherApiHits += 1
			continue
		}
		apiHits += 1
		users.add(entry.ip)
		routeCounts.set(route, (routeCounts.get(route) || 0) + 1)
		ipCounts.set(entry.ip, (ipCounts.get(entry.ip) || 0) + 1)

		const roomMatch = entry.path.match(ROOM_RE)
		if (roomMatch) {
			roomCounts.set(roomMatch[0], (roomCounts.get(roomMatch[0]) || 0) + 1)
		}
	}

	const routes = [...routeCounts.entries()]
		.map(([route, count]) => ({route, count}))
		.sort((a, b) => b.count - a.count)

	const topIp = [...ipCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null
	const topRoom = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null

	return {
		service,
		usersToday: users.size,
		apiHitsToday: apiHits,
		scannerOrOtherHitsToday: otherApiHits,
		routes,
		topIp: topIp ? {ip: topIp[0], count: topIp[1]} : null,
		topRoom: topRoom ? {room: topRoom[0], count: topRoom[1]} : null,
		roomsToday: [...roomCounts.entries()]
			.map(([room, count]) => ({room, count}))
			.sort((a, b) => b.count - a.count),
	}
}

/**
 * @param {sqlite3.Database} database
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {Promise<any[]>}
 */
function sqliteAll(database, sql, params = []) {
	return new Promise((resolve, reject) => {
		database.all(sql, params, (err, rows) => {
			if (err) reject(err)
			else resolve(rows || [])
		})
	})
}

/**
 * Read help cache Q&A pairs from SQLite (WAL-friendly concurrent read).
 */
async function collectHelpCache() {
	/** @type {Array<{question: string, answer: string, sources: Array<{name?: string, url?: string|null}>, room: string|null, askedAt: string|null, outcome: string}>} */
	const entries = []

	try {
		await fsp.access(HELP_CACHE_DB)
	} catch {
		return {
			count: 0,
			entries: [],
			path: HELP_CACHE_DB,
			error: `Help cache database not found at ${HELP_CACHE_DB}`,
		}
	}

	/** @type {sqlite3.Database | null} */
	let database = null
	try {
		database = await new Promise((resolve, reject) => {
			const handle = new sqlite3.Database(HELP_CACHE_DB, sqlite3.OPEN_READONLY, (err) =>
				err ? reject(err) : resolve(handle),
			)
		})

		const rows = await sqliteAll(
			database,
			`SELECT question, response, sources_json, room, asked_at, outcome
			   FROM help_cache
			  ORDER BY asked_at DESC, id DESC`,
		)

		for (const row of rows) {
			let sources = []
			try {
				const parsed = JSON.parse(row.sources_json || '[]')
				sources = Array.isArray(parsed) ? parsed : []
			} catch {
				sources = []
			}
			entries.push({
				question: String(row.question ?? ''),
				answer: String(row.response ?? ''),
				sources,
				room: row.room ? String(row.room) : null,
				askedAt: row.asked_at ? String(row.asked_at) : null,
				outcome: String(row.outcome || 'unknown'),
			})
		}

		const byOutcome = {}
		for (const entry of entries) {
			byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1
		}

		return {count: entries.length, entries, byOutcome, path: HELP_CACHE_DB, error: null}
	} catch (error) {
		return {
			count: 0,
			entries: [],
			byOutcome: {},
			path: HELP_CACHE_DB,
			error: error instanceof Error ? error.message : String(error),
		}
	} finally {
		if (database) {
			await new Promise((resolve) => database.close(() => resolve()))
		}
	}
}

/**
 * Aggregate payload for the dashboard.
 */
async function collectAllStats() {
	const collectedAt = new Date().toISOString()
	const day = todayBounds()
	const accessEntries = await readTodayAccessEntries()

	const [server, websocket, api, helpCache] = await Promise.all([
		collectServerStats(),
		collectWebsocketStats(accessEntries),
		collectApiStats(accessEntries),
		collectHelpCache(),
	])

	return {
		collectedAt,
		dayLabel: day.label,
		server,
		websocket,
		api,
		helpCache,
	}
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
	const payload = JSON.stringify(body, null, 2)
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': Buffer.byteLength(payload),
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
	})
	res.end(payload)
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} message
 */
function sendText(res, status, message) {
	res.writeHead(status, {
		'Content-Type': 'text/plain; charset=utf-8',
		'Cache-Control': 'no-store',
	})
	res.end(message)
}

/**
 * Safely resolve a path under PUBLIC_DIR.
 * @param {string} urlPath
 * @returns {string|null}
 */
function resolvePublicPath(urlPath) {
	const clean = decodeURIComponent(urlPath.split('?')[0])
	const relative = clean === '/' ? '/index.html' : clean
	const resolved = path.normalize(path.join(PUBLIC_DIR, relative))
	if (!resolved.startsWith(PUBLIC_DIR)) return null
	return resolved
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function handleRequest(req, res) {
	if (!isLocalRequest(req)) {
		sendText(res, 403, 'Forbidden: dashboard is only available on localhost (127.0.0.1).')
		return
	}

	const method = req.method || 'GET'
	const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)

	if (method === 'GET' && url.pathname === '/api/stats') {
		try {
			const stats = await collectAllStats()
			sendJson(res, 200, stats)
		} catch (error) {
			sendJson(res, 500, {
				error: error instanceof Error ? error.message : String(error),
			})
		}
		return
	}

	if (method === 'GET' && url.pathname === '/api/health') {
		sendJson(res, 200, {ok: true, bind: `${HOST}:${PORT}`})
		return
	}

	if (method !== 'GET' && method !== 'HEAD') {
		sendText(res, 405, 'Method Not Allowed')
		return
	}

	const filePath = resolvePublicPath(url.pathname)
	if (!filePath) {
		sendText(res, 400, 'Bad Request')
		return
	}

	try {
		const data = await fsp.readFile(filePath)
		const ext = path.extname(filePath).toLowerCase()
		res.writeHead(200, {
			'Content-Type': MIME[ext] || 'application/octet-stream',
			'Content-Length': data.length,
			'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60',
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy':
				"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'",
		})
		if (method === 'HEAD') {
			res.end()
			return
		}
		res.end(data)
	} catch {
		sendText(res, 404, 'Not Found')
	}
}

const server = http.createServer((req, res) => {
	handleRequest(req, res).catch((error) => {
		console.error(error)
		if (!res.headersSent) sendText(res, 500, 'Internal Server Error')
	})
})

server.listen(PORT, HOST, () => {
	console.log(`PRSM dashboard listening on http://${HOST}:${PORT}/`)
	console.log('Access is restricted to localhost / 127.0.0.1 only.')
})

process.on('SIGINT', () => {
	server.close(() => process.exit(0))
})
process.on('SIGTERM', () => {
	server.close(() => process.exit(0))
})