#!/usr/bin/env node
/* 

y-websocket v 1.3.16, amended to remove host from server.listen

*/

/**
 * @type {any}
 */
 const WebSocket = require('ws')
 const http = require('http')
 const wss = new WebSocket.Server({ noServer: true })
 const setupWSConnection = require('./utils.js').setupWSConnection
 
 const host = process.env.HOST || 'localhost'
 const port = process.env.PORT || 1234
 
 const server = http.createServer((request, response) => {
   response.writeHead(200, { 'Content-Type': 'text/plain' })
   response.end('okay')
 })
 
 wss.on('connection', setupWSConnection)
 
 server.on('upgrade', (request, socket, head) => {
   // You may check auth of request here..
   /**
    * @param {any} ws
    */
   const handleAuth = ws => {
     wss.emit('connection', ws, request)
   }
   wss.handleUpgrade(request, socket, head, handleAuth)
 })
 
 //server.listen({ host, port })
 server.listen(port)
 
 console.log(`running at '${host}' on port ${port}`)
 