import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'

import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as map from 'lib0/map'

import * as eventloop from 'lib0/eventloop'
import { LeveldbPersistence } from 'y-leveldb'

import { memoryUsage } from 'node:process';

import { callbackHandler, isCallbackSet } from './callback.js'

const verbose = process.env.VERBOSE === 'true' || process.env.VERBOSE === '1'
const CALLBACK_DEBOUNCE_WAIT = parseInt(process.env.CALLBACK_DEBOUNCE_WAIT || '2000')
const CALLBACK_DEBOUNCE_MAXWAIT = parseInt(process.env.CALLBACK_DEBOUNCE_MAXWAIT || '10000')

const debouncer = eventloop.createDebouncer(CALLBACK_DEBOUNCE_WAIT, CALLBACK_DEBOUNCE_MAXWAIT)

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1
const wsReadyStateClosing = 2 // eslint-disable-line
const wsReadyStateClosed = 3 // eslint-disable-line

/**
* Log message to console with timestamp when verbose mode is enabled
 * @param {string} msg
 */
const log = (msg) => {
  if (verbose) {
    console.log(`${new Date().toLocaleTimeString()} ${msg}`)
  }
}

const reportMemory = () => {
  const mem = memoryUsage()
  return `Total Memory: ${Math.round(mem.rss / 1024 / 1024)} MB; ` + 
    `Heap: ${Math.round(mem.heapUsed / 1024 / 1024)} MB of ${Math.round(mem.heapTotal / 1024 / 1024)} MB; ` +
    `External: ${Math.round(mem.external / 1024 / 1024)} MB. `      // C++ objects
}

log(`Initial memory use: ${reportMemory()}`)

// disable gc when using snapshots!
const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0'
const persistenceDir = process.env.YPERSISTENCE
/**
 * @type {{bindState: function(string,WSSharedDoc):void, writeState:function(string,WSSharedDoc):Promise<any>, provider: any}|null}
 */
let persistence = null
if (typeof persistenceDir === 'string') {
  console.info('Persisting documents to "' + persistenceDir + '"')
  // @ts-ignore
  const ldb = new LeveldbPersistence(persistenceDir)
  persistence = {
    provider: ldb,
    bindState: async (docName, ydoc) => {
      const persistedYdoc = await ldb.getYDoc(docName)
      const newUpdates = Y.encodeStateAsUpdate(ydoc)
      ldb.storeUpdate(docName, newUpdates)

      // Apply persisted state to our doc
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc))

      // Destroy the temporary Y.Doc to prevent memory leak
      persistedYdoc.destroy()

      // Store the update handler so we can remove it later
      const persistenceUpdateHandler = update => {
        ldb.storeUpdate(docName, update)
      }
      ydoc._persistenceUpdateHandler = persistenceUpdateHandler
      ydoc.on('update', persistenceUpdateHandler)
    },
    writeState: async (_docName, _ydoc) => { }
  }
} else {
  console.info('No persistence database configured.')
}

/**
 * @param {{bindState: function(string,WSSharedDoc):void,
 * writeState:function(string,WSSharedDoc):Promise<any>,provider:any}|null} persistence_
 */
export const setPersistence = persistence_ => {
  persistence = persistence_
}

/**
 * @return {null|{bindState: function(string,WSSharedDoc):void,
  * writeState:function(string,WSSharedDoc):Promise<any>}|null} used persistence layer
  */
export const getPersistence = () => persistence

/**
 * @type {Map<string,WSSharedDoc>}
 */
export const docs = new Map()

const messageSync = 0
const messageAwareness = 1
// const messageAuth = 2

/**
 * @param {Uint8Array} update
 * @param {any} _origin
 * @param {WSSharedDoc} doc
 * @param {any} _tr
 */
const updateHandler = (update, _origin, doc, _tr) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => send(doc, conn, message))
}

/**
 * @type {(ydoc: Y.Doc) => Promise<void>}
 */
let contentInitializor = _ydoc => Promise.resolve()

/**
 * This function is called once every time a Yjs document is created. You can
 * use it to pull data from an external source or initialize content.
 *
 * @param {(ydoc: Y.Doc) => Promise<void>} f
 */
export const setContentInitializor = (f) => {
  contentInitializor = f
}

export class WSSharedDoc extends Y.Doc {
  /**
   * @param {string} name
   */
  constructor(name) {
    super({ gc: gcEnabled })
    this.name = name
    /**
     * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
     * @type {Map<Object, Set<number>>}
     */
    this.conns = new Map()
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    /**
     * @param {{ added: Array<number>, updated: Array<number>, removed: Array<number> }} changes
     * @param {Object | null} conn Origin is the connection that made the change
     */
    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = /** @type {Set<number>} */ (this.conns.get(conn))
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => { connControlledIDs.add(clientID) })
          removed.forEach(clientID => { connControlledIDs.delete(clientID) })
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
      const buff = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => {
        send(this, c, buff)
      })
    }
    // Store handler references for cleanup
    this._awarenessChangeHandler = awarenessChangeHandler
    this._updateHandler = /** @type {any} */(updateHandler)

    this.awareness.on('update', this._awarenessChangeHandler)
    this.on('update', this._updateHandler)
    if (isCallbackSet) {
      this._callbackUpdateHandler = (_update, _origin, doc) => {
        // Use weak reference to avoid holding document in closure
        const docName = doc.name
        debouncer(() => {
          const currentDoc = docs.get(docName)
          if (currentDoc) {
            callbackHandler(currentDoc)
          }
        })
      }
      this.on('update', this._callbackUpdateHandler)
    }
    this.whenInitialized = contentInitializor(this)
  }

  /**
   * Cleanup all event handlers and destroy document
   */
  cleanup() {
    // Remove event handlers
    if (this._awarenessChangeHandler) {
      this.awareness.off('update', this._awarenessChangeHandler)
      this._awarenessChangeHandler = null
    }
    if (this._updateHandler) {
      this.off('update', this._updateHandler)
      this._updateHandler = null
    }
    if (this._callbackUpdateHandler) {
      this.off('update', this._callbackUpdateHandler)
      this._callbackUpdateHandler = null
    }
    if (this._persistenceUpdateHandler) {
      this.off('update', this._persistenceUpdateHandler)
      this._persistenceUpdateHandler = null
    }

    // Clear awareness states
    this.awareness.destroy()

    // Clear connections map
    this.conns.clear()

    // Destroy the document
    this.destroy()
  }
}

/**
 * Gets a Y.Doc by name, whether in memory or on disk
 *
 * @param {string} docname - the name of the Y.Doc to find or create
 * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
 * @return {WSSharedDoc}
 */
export const getYDoc = (docname, gc = true) => {
  return map.setIfUndefined(docs, docname, () => {
    const doc = new WSSharedDoc(docname)
    doc.gc = gc
    if (persistence !== null) {
      // Store the persistence promise so clients can wait for initialization
      doc.whenInitialized = persistence.bindState(docname, doc)
    }
    docs.set(docname, doc)
    return doc
  })
}

/**
 * @param {any} conn
 * @param {WSSharedDoc} doc
 * @param {Uint8Array} message
 */
const messageListener = async (conn, doc, message) => {
  try {
    // Ensure persistence has loaded before processing sync messages
    if (doc.whenInitialized) {
      await doc.whenInitialized
    }

    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn)

        // If the `encoder` only contains the type of reply message and no
        // message, there is no need to send the message. When `encoder` only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder))
        }
        break
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
        break
      }
    }
  } catch (err) {
    console.error(err)
    // @ts-ignore
    doc.emit('error', [err])
  }
}

/**
 * Destroy a document and clean up all references
 * @param {string} docname
 * @param {WSSharedDoc} doc
 */
const destroyDocument = (docname, doc) => {
  if (persistence !== null) {
    persistence.writeState(docname, doc)
      .then(() => {
        log(`Document state saved for ${docname}`)
      })
      .catch(err => {
        console.error('Error writing state for', docname, err)
      })
      .finally(() => {
        doc.cleanup()
        docs.delete(docname)
        if (docs.size === 0) {
          log('No remaining documents in memory.')
          log(`${reportMemory()}`)
        }
      })
  } else {
    doc.cleanup()
    docs.delete(docname)
    if (docs.size === 0) {
      log('No remaining documents in memory.')
      log(`${reportMemory()}`)
    }
  }
}

/**
 * @param {WSSharedDoc} doc
 * @param {any} conn
 */
const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    /**
     * @type {Set<number>}
     */
    // @ts-ignore
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    if (doc.conns.size === 0) {
      log(`All connections closed for document "${doc.name}". Destroying document.`)
      log(`${docs.size} documents remaining. ${reportMemory()}`)
      destroyDocument(doc.name, doc)
    }
  }
  conn.close()
}

/**
 * @param {WSSharedDoc} doc
 * @param {import('ws').WebSocket} conn
 * @param {Uint8Array} m
 */
const send = (doc, conn, m) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn)
  }
  try {
    conn.send(m, {}, err => { err != null && closeConn(doc, conn) })
  } catch (e) {
    closeConn(doc, conn)
  }
}

const pingTimeout = 30000

/**
 * @param {import('ws').WebSocket} conn
 * @param {import('http').IncomingMessage} req
 * @param {any} opts
 */
export const setupWSConnection = (conn, req, { docName = (req.url || '').slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'
  // get doc, initialize if it does not exist yet
  const doc = getYDoc(docName, gc)
  doc.conns.set(conn, new Set())
  log(`Connection opened. There are ${doc.conns.size} connections for document "${doc.name}". ${reportMemory()}`)
  // Message handler - store reference for cleanup
  const messageHandler = /** @param {ArrayBuffer} message */ (message) => {
    messageListener(conn, doc, new Uint8Array(message))
  }
  conn.on('message', messageHandler)

  // Check if connection is still alive
  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn)
      }
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        closeConn(doc, conn)
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)

  // Close handler
  const closeHandler = () => {
    closeConn(doc, conn)
    clearInterval(pingInterval)
  }
  conn.on('close', closeHandler)

  // Pong handler
  const pongHandler = () => {
    pongReceived = true
  }
  conn.on('pong', pongHandler)

  // put the following in a variables in a block so the interval handlers don't keep in in
  // scope
  {
    // send sync step 1
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))
    const awarenessStates = doc.awareness.getStates()
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
      send(doc, conn, encoding.toUint8Array(encoder))
    }
  }
}

