#!/usr/bin/env node

import { WebSocketServer } from 'ws'
import http from 'http'
import * as number from 'lib0/number'
import { setupWSConnection } from './utils.js'

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 256 * 1024 * 1024  // 256 MB (adjust as needed)
})
const host = process.env.HOST || 'localhost'
const port = number.parseInt(process.env.PORT || '1234')

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

wss.on('connection', (ws, request) => {
  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    // Gracefully close the connection on error
    ws.close(1011, 'Internal server error') // 1011 is the status code for internal errors
  })
  setupWSConnection(ws, request)
})
server.on('upgrade', (request, socket, head) => {
  // You may check auth of request here..
  // Call `wss.HandleUpgrade` *after* you checked whether the client has access
  // (e.g. by checking cookies, or url parameters).
  // See https://github.com/websockets/ws#client-authentication
  wss.handleUpgrade(request, socket, head, /** @param {any} ws */ ws => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`running at '${host}' on port ${port}`)
})
