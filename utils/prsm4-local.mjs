#!/usr/bin/env node

/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Starts and stops an independent local PRSM 4 development stack.
********************************************************************************************/

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = path.resolve(process.env.PRSM4_LOCAL_DIR || path.join(os.tmpdir(), 'prsm4-local'))
const STATE_FILE = path.join(STATE_DIR, 'state.json')
const LOG_FILE = path.join(STATE_DIR, 'stack.log')
const HTTP_PORT = port('PRSM4_HTTP_PORT', 4174)
const WS_PORT = port('PRSM4_WS_PORT', 1235)
const DB_DIR = path.resolve(process.env.PRSM4_DB_DIR || path.join(ROOT, 'dbDir4'))
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

/** Read and validate a configured port.
 * @param {string} name Environment variable name.
 * @param {number} fallback Default port.
 * @returns {number} TCP port.
 */
function port(name, fallback) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`Invalid ${name}`)
  return value
}

/** Send a request to the authenticated local control endpoint.
 * @param {object} state Saved server identity.
 * @param {string} method HTTP method.
 * @returns {Promise<number>} Response status.
 */
async function control(state, method) {
  const response = await fetch(`http://127.0.0.1:${state.httpPort}/__prsm4_local`, {
    method,
    headers: { authorization: `Bearer ${state.token}` },
    signal: AbortSignal.timeout(3000),
  })
  return response.status
}

/** Start a detached supervisor, waiting for its initial build and services.
 * @returns {Promise<void>}
 */
async function start() {
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  const token = randomBytes(32).toString('hex')
  let stateFd
  try {
    stateFd = openSync(STATE_FILE, 'wx', 0o600)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    throw new Error(
      `PRSM 4 state already exists at ${STATE_FILE}. Stop it first; if it crashed, verify it is no longer running before removing this file.`
    )
  }
  let child
  let logFd
  try {
    logFd = openSync(LOG_FILE, 'a', 0o600)
    child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'supervise'], {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', logFd, logFd, 'ipc'],
      env: { ...process.env, PRSM4_LOCAL_TOKEN: token },
    })
    writeFileSync(stateFd, JSON.stringify({ token, httpPort: HTTP_PORT, pid: child.pid }))
  } catch (error) {
    if (child?.pid) child.kill('SIGTERM')
    unlinkSync(STATE_FILE)
    throw error
  } finally {
    closeSync(stateFd)
    if (logFd !== undefined) closeSync(logFd)
  }
  const timer = setTimeout(() => child.kill('SIGTERM'), 120000)
  const result = await new Promise((resolve, reject) => {
    child.once('error', (error) => {
      unlinkSync(STATE_FILE)
      reject(error)
    })
    child.once('message', resolve)
    child.once('exit', (code) =>
      reject(new Error(`PRSM 4 stopped during startup (exit ${code}). See ${LOG_FILE}`))
    )
  }).finally(() => clearTimeout(timer))
  if (result !== 'ready') throw new Error(`PRSM 4 startup failed: ${result}. See ${LOG_FILE}`)
  child.disconnect()
  child.unref()
  console.log(`PRSM 4: http://localhost:${HTTP_PORT}/prsm4.html`)
  console.log(`WebSocket: ws://localhost:${WS_PORT}; persistent rooms: ${DB_DIR}`)
  console.log(`Logs: ${LOG_FILE}`)
  if (!existsSync(path.join(ROOT, 'doc/help4/doc_build/manual/Introduction.html'))) {
    console.log('The manual has not been built. Run npm run build:help4:local to enable Help.')
  }
}

/** Stop only the supervisor identified by the saved control token.
 * @returns {Promise<void>}
 */
async function stop() {
  if (!existsSync(STATE_FILE)) {
    console.log('PRSM 4 local stack is not running.')
    return
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  const status = await control(state, 'POST')
  if (status !== 200)
    throw new Error(`PRSM 4 control endpoint rejected the stop request (${status})`)
  for (let i = 0; i < 100; i++) {
    if (!existsSync(STATE_FILE)) {
      console.log('PRSM 4 local stack stopped.')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PRSM 4 did not stop in time. See ${LOG_FILE}`)
}

/** Serve the PRSM 4 build and manual on the same origin.
 * @param {http.IncomingMessage} request Incoming request.
 * @param {http.ServerResponse} response HTTP response.
 * @param {string} token Supervisor control token.
 * @param {function():void} shutdown Stops the stack.
 * @returns {Promise<void>}
 */
async function serve(request, response, token, shutdown) {
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/__prsm4_local') {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(403).end('Forbidden')
    } else if (request.method === 'POST') {
      response.writeHead(200).end('Stopping')
      setImmediate(shutdown)
    } else {
      response.writeHead(200).end('Running')
    }
    return
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end()
    return
  }
  if (url.pathname === '/') url.pathname = '/prsm4.html'
  if (['/prsm4.html', '/table4.html'].includes(url.pathname) && !url.searchParams.has('ws')) {
    url.searchParams.set('ws', `ws://localhost:${WS_PORT}`)
    response.writeHead(302, { location: `${url.pathname}${url.search}` }).end()
    return
  }
  const manualPrefix = '/doc/help4/doc_build/'
  const manual = url.pathname.startsWith(manualPrefix)
  const base = path.join(ROOT, manual ? 'doc/help4/doc_build' : 'dist4')
  let name
  try {
    name = decodeURIComponent(
      manual ? url.pathname.slice(manualPrefix.length) : url.pathname.slice(1)
    )
  } catch {
    response.writeHead(400).end('Invalid URL')
    return
  }
  const file = path.resolve(base, name || 'index.html')
  if (!file.startsWith(`${base}${path.sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const info = await stat(file)
    if (!info.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' })
    response.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    })
    if (request.method === 'HEAD') response.end()
    else
      createReadStream(file)
        .on('error', (error) => response.destroy(error))
        .pipe(response)
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') console.error(error)
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500).end()
  }
}

/** Supervise the watcher and websocket server until stopped or a child fails.
 * @returns {Promise<void>}
 */
async function supervise() {
  const token = process.env.PRSM4_LOCAL_TOKEN
  const children = []
  let stopping = false
  let ready = false
  const shutdown = async (failure) => {
    if (stopping) return
    stopping = true
    if (failure) console.error(failure)
    server.close()
    await Promise.all(
      children.map(
        (child) =>
          new Promise((resolve) => {
            if (!child.pid || child.exitCode !== null || child.signalCode !== null) return resolve()
            const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
            child.once('exit', () => {
              clearTimeout(timer)
              resolve()
            })
            child.kill('SIGTERM')
          })
      )
    )
    unlinkSync(STATE_FILE)
    if (!ready && process.connected) process.send(failure || 'Stopped during startup')
    process.exit(failure ? 1 : 0)
  }
  const server = http.createServer((request, response) => {
    serve(request, response, token, () => shutdown()).catch((error) => {
      console.error(error)
      response.destroy(error)
    })
  })
  process.on('SIGTERM', () => shutdown())
  process.on('SIGINT', () => shutdown())
  process.on('disconnect', () => {
    if (!ready) shutdown('Launcher disconnected during startup')
  })
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(HTTP_PORT, '127.0.0.1', resolve)
    })
    server.on('error', (error) => shutdown(error.message))
    const launch = (label, args, env, pattern) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
          cwd: ROOT,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        children.push(child)
        let output = ''
        for (const stream of [child.stdout, child.stderr]) {
          stream.on('data', (data) => {
            process.stdout.write(`[${label}] ${data}`)
            output += data.toString()
            if (pattern.test(output)) resolve()
            if (label === 'parcel' && /Build failed/i.test(output))
              reject(new Error('Parcel build failed'))
            output = output.slice(-4096)
          })
        }
        child.once('error', reject)
        child.once('exit', (code, signal) => {
          const message = `${label} exited (${signal || code})`
          reject(new Error(message))
          if (!stopping) shutdown(message)
        })
      })
    await Promise.all([
      launch(
        'websocket',
        ['ws-server/src/server.js'],
        {
          ...process.env,
          HOST: 'localhost',
          PORT: String(WS_PORT),
          YPERSISTENCE: DB_DIR,
          VERBOSE: '1',
        },
        /running at/
      ),
      launch(
        'parcel',
        [
          'node_modules/parcel/lib/bin.js',
          'watch',
          'prsm4/html/*.html',
          '--target',
          'prsm4',
          '--no-hmr',
        ],
        process.env,
        /Built in/i
      ),
    ])
    ready = true
    if (process.connected) process.send('ready')
  } catch (error) {
    await shutdown(error.message)
  }
}

try {
  if (process.argv[2] === 'start') await start()
  else if (process.argv[2] === 'stop') await stop()
  else if (process.argv[2] === 'supervise' && process.send && process.env.PRSM4_LOCAL_TOKEN)
    await supervise()
  else throw new Error('Usage: node utils/prsm4-local.mjs <start|stop>')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
