import * as Y from 'yjs'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as binary from 'lib0/binary.js'
import * as promise from 'lib0/promise.js'
import * as buffer from 'lib0/buffer.js'
import { Level as DefaultLevel } from 'level'
import { Buffer } from 'buffer'

export const PREFERRED_TRIM_SIZE = 500

const YEncodingString = 0
const YEncodingUint32 = 1

/**
 * @typedef {import('abstract-level').AbstractLevel<any, Array<String|number>, Uint8Array>} AbstractLevel
 */
/**
 * @typedef {['v1', string, 'update', number] | ['v1', string, 'meta', string] | ['v1_sv', number]} DocKey
 */

const valueEncoding = {
  buffer: true,
  type: 'y-value',
  encode: /** @param {any} data */ data => data,
  decode: /** @param {any} data */ data => data
}

/**
 * Write two bytes as an unsigned integer in big endian order.
 * @function
 * @param {encoding.Encoder} encoder
 * @param {number} num
 */
export const writeUint32BigEndian = (encoder, num) => {
  for (let i = 3; i >= 0; i--) {
    encoding.write(encoder, (num >>> (8 * i)) & binary.BITS8)
  }
}

/**
 * Read 4 bytes as unsigned integer in big endian order.
 * @function
 * @param {decoding.Decoder} decoder
 * @return {number}
 */
export const readUint32BigEndian = decoder => {
  const uint =
    (decoder.arr[decoder.pos + 3] +
    (decoder.arr[decoder.pos + 2] << 8) +
    (decoder.arr[decoder.pos + 1] << 16) +
    (decoder.arr[decoder.pos] << 24)) >>> 0
  decoder.pos += 4
  return uint
}

export const keyEncoding = {
  buffer: true,
  type: 'y-keys',
  encode: /** @param {Array<string|number>} arr */  arr => {
    const encoder = encoding.createEncoder()
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]
      if (typeof v === 'string') {
        encoding.writeUint8(encoder, YEncodingString)
        encoding.writeVarString(encoder, v)
      } else if (typeof v === 'number') {
        encoding.writeUint8(encoder, YEncodingUint32)
        writeUint32BigEndian(encoder, v)
      } else {
        throw new Error('Unexpected key value')
      }
    }
    return Buffer.from(encoding.toUint8Array(encoder))
  },
  decode: /** @param {Uint8Array} buf */ buf => {
    const decoder = decoding.createDecoder(buf)
    const key = []
    while (decoding.hasContent(decoder)) {
      switch (decoding.readUint8(decoder)) {
        case YEncodingString:
          key.push(decoding.readVarString(decoder))
          break
        case YEncodingUint32:
          key.push(readUint32BigEndian(decoder))
          break
      }
    }
    return key
  }
}

const levelGet = async (db, key) => {
  let res
  try {
    res = await db.get(key)
  } catch (err) {
    if (/** @type {any} */ (err).notFound) {
      return
    } else {
      throw err
    }
  }
  return res
}

const levelPut = async (db, key, val) => db.put(key, Buffer.from(val))

/**
 * Modern memory-safe bulk entry getter using Async Iterators.
 * @param {AbstractLevel} db
 * @param {import('abstract-level').AbstractIteratorOptions<any, Uint8Array>} opts
 */
export const getLevelBulkEntries = async (db, opts) => {
  const result = []
  for await (const [key, value] of db.iterator(opts)) {
    result.push({ key, value })
  }
  return result
}

/**
 * Modern memory-safe bulk key getter.
 * @param {AbstractLevel} db
 * @param {import('abstract-level').AbstractIteratorOptions<any, Uint8Array>} opts
 */
export const getLevelBulkKeys = async (db, opts) => {
  const result = []
  for await (const key of db.keys(opts)) {
    result.push(key)
  }
  return result
}

/**
 * Modern memory-safe bulk value getter.
 * @param {AbstractLevel} db
 * @param {import('abstract-level').AbstractIteratorOptions<DocKey, Uint8Array>} opts
 */
export const getLevelBulkValues = async (db, opts) => {
  const result = []
  for await (const value of db.values(opts)) {
    result.push(value)
  }
  return result
}

export const getLevelUpdates = (db, docName, opts = {}) => getLevelBulkValues(db, {
  gte: createDocumentUpdateKey(docName, 0),
  lt: createDocumentUpdateKey(docName, binary.BITS32),
  ...opts
})

export const getLevelUpdatesEntries = (db, docName, opts = {}) => getLevelBulkEntries(db, {
  gte: createDocumentUpdateKey(docName, 0),
  lt: createDocumentUpdateKey(docName, binary.BITS32),
  ...opts
})

export const getLevelUpdatesKeys = (db, docName, opts = {}) => getLevelBulkKeys(db, {
  gte: createDocumentUpdateKey(docName, 0),
  lt: createDocumentUpdateKey(docName, binary.BITS32),
  ...opts
})

export const getAllDocsKeys = (db) => getLevelBulkKeys(db, {
  gte: ['v1_sv'],
  lt: ['v1_sw']
})

export const getAllDocs = (db) => getLevelBulkEntries(db, {
  gte: ['v1_sv'],
  lt: ['v1_sw']
})

export const getCurrentUpdateClock = (db, docName) => getLevelUpdatesKeys(db, docName, { reverse: true, limit: 1 }).then(entries => {
  if (entries.length === 0) {
    return -1
  } else {
    return /** @type {number} */ (entries[0][3])
  }
})

const clearRange = async (db, gte, lt) => {
  if (db.supports.clear) {
    await db.clear({ gte, lt })
  } else {
    const keys = await getLevelBulkKeys(db, { gte, lt })
    const ops = keys.map(key => ({ type: 'del', key }))
    await db.batch(ops)
  }
}

const clearUpdatesRange = async (db, docName, from, to) => clearRange(db, createDocumentUpdateKey(docName, from), createDocumentUpdateKey(docName, to))

const createDocumentUpdateKey = (docName, clock) => ['v1', docName, 'update', clock]
const createDocumentMetaKey = (docName, metaKey) => ['v1', docName, 'meta', metaKey]
const createDocumentMetaEndKey = (docName) => ['v1', docName, 'metb']
const createDocumentStateVectorKey = (docName) => ['v1_sv', docName]
const createDocumentFirstKey = (docName) => ['v1', docName]
const createDocumentLastKey = (docName) => ['v1', docName, 'zzzzzzz']

const mergeUpdates = (updates) => {
  const ydoc = new Y.Doc()
  ydoc.transact(() => {
    for (let i = 0; i < updates.length; i++) {
      Y.applyUpdate(ydoc, updates[i])
    }
  })
  return { update: Y.encodeStateAsUpdate(ydoc), sv: Y.encodeStateVector(ydoc) }
}

const writeStateVector = async (db, docName, sv, clock) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, clock)
  encoding.writeVarUint8Array(encoder, sv)
  await levelPut(db, createDocumentStateVectorKey(docName), encoding.toUint8Array(encoder))
}

const decodeLeveldbStateVector = buf => {
  const decoder = decoding.createDecoder(buf)
  const clock = decoding.readVarUint(decoder)
  const sv = decoding.readVarUint8Array(decoder)
  return { sv, clock }
}

const readStateVector = async (db, docName) => {
  const buf = await levelGet(db, createDocumentStateVectorKey(docName))
  if (buf == null) return { sv: null, clock: -1 }
  return decodeLeveldbStateVector(buf)
}

const flushDocument = async (db, docName, stateAsUpdate, stateVector) => {
  const clock = await storeUpdate(db, docName, stateAsUpdate)
  await writeStateVector(db, docName, stateVector, clock)
  await clearUpdatesRange(db, docName, 0, clock)
  return clock
}

const storeUpdate = async (db, docName, update) => {
  const clock = await getCurrentUpdateClock(db, docName)
  if (clock === -1) {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, update)
    const sv = Y.encodeStateVector(ydoc)
    await writeStateVector(db, docName, sv, 0)
  }
  await levelPut(db, createDocumentUpdateKey(docName, clock + 1), update)
  return clock + 1
}

export class LeveldbPersistence {
  /**
   * @param {string} location
   * @param {object} opts
   */
  constructor (location, { Level = DefaultLevel, levelOptions = {} } = {}) {
    // Merged memory guards to prevent "External" memory growth
    const finalOptions = {
      cacheSize: 128 * 1024 * 1024, // 128MB limit for block cache
      writeBufferSize: 16 * 1024 * 1024, // 16MB for 1MB value handling
      maxOpenFiles: 1000,
      ...levelOptions,
      valueEncoding,
      keyEncoding
    }

    const db = new Level(location, finalOptions)
    this.tr = promise.resolve()

    this._transact = f => {
      const currTr = this.tr
      this.tr = (async () => {
        await currTr
        let res = null
        try {
          res = await f(db)
        } catch (err) {
          console.warn('Error during y-leveldb transaction', err)
        }
        return res
      })()
      return this.tr
    }
  }

  flushDocument (docName) {
    return this._transact(async db => {
      const updates = await getLevelUpdates(db, docName)
      const { update, sv } = mergeUpdates(updates)
      await flushDocument(db, docName, update, sv)
    })
  }

  getYDoc (docName) {
    return this._transact(async db => {
      const updates = await getLevelUpdates(db, docName)
      const ydoc = new Y.Doc()
      ydoc.transact(() => {
        for (let i = 0; i < updates.length; i++) {
          Y.applyUpdate(ydoc, updates[i])
        }
      })
      if (updates.length > PREFERRED_TRIM_SIZE) {
        await flushDocument(db, docName, Y.encodeStateAsUpdate(ydoc), Y.encodeStateVector(ydoc))
      }
      return ydoc
    })
  }

  getStateVector (docName) {
    return this._transact(async db => {
      const { clock, sv } = await readStateVector(db, docName)
      let curClock = -1
      if (sv !== null) {
        curClock = await getCurrentUpdateClock(db, docName)
      }
      if (sv !== null && clock === curClock) {
        return sv
      } else {
        const updates = await getLevelUpdates(db, docName)
        const { update, sv } = mergeUpdates(updates)
        await flushDocument(db, docName, update, sv)
        return sv
      }
    })
  }

  storeUpdate (docName, update) {
    return this._transact(db => storeUpdate(db, docName, update))
  }

  async getDiff (docName, stateVector) {
    const ydoc = await this.getYDoc(docName)
    return Y.encodeStateAsUpdate(ydoc, stateVector)
  }

  clearDocument (docName) {
    return this._transact(async db => {
      await db.del(createDocumentStateVectorKey(docName))
      await clearRange(db, createDocumentFirstKey(docName), createDocumentLastKey(docName))
    })
  }

  setMeta (docName, metaKey, value) {
    return this._transact(db => levelPut(db, createDocumentMetaKey(docName, metaKey), buffer.encodeAny(value)))
  }

  delMeta (docName, metaKey) {
    return this._transact(db => db.del(createDocumentMetaKey(docName, metaKey)))
  }

  getMeta (docName, metaKey) {
    return this._transact(async db => {
      const res = await levelGet(db, createDocumentMetaKey(docName, metaKey))
      if (res == null) return
      return buffer.decodeAny(res)
    })
  }

  getAllDocNames () {
    return this._transact(async db => {
      const docKeys = await getAllDocsKeys(db)
      return docKeys.map(key => /** @type {string} */ (key[1]))
    })
  }

  getAllDocStateVectors () {
    return this._transact(async db => {
      const docs = await getAllDocs(db)
      return docs.map(doc => {
        const { sv, clock } = decodeLeveldbStateVector(doc.value)
        return { name: /** @type {string} */ (doc.key[1]), sv, clock }
      })
    })
  }

  getMetas (docName) {
    return this._transact(async db => {
      const data = await getLevelBulkEntries(db, {
        gte: createDocumentMetaKey(docName, ''),
        lt: createDocumentMetaEndKey(docName),
        keys: true,
        values: true
      })
      const metas = new Map()
      data.forEach(v => { metas.set(v.key[3], buffer.decodeAny(v.value)) })
      return metas
    })
  }

  destroy () {
    return this._transact(db => db.close())
  }

  clearAll () {
    return this._transact(async db => db.clear())
  }
}
/**
 * Monitors memory usage and logs it to the console.
 * Specifically tracks 'external' memory where LevelDB lives.
 */
/* function startMemoryLogging() {
  console.log('--- Memory Monitor Started ---');
  
  setInterval(() => {
    const usage = process.memoryUsage();
    
    const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    console.log(`[${new Date().toLocaleTimeString()}] ` +
      `External: ${toMB(usage.external)} | ` +
      `RSS: ${toMB(usage.rss)} | ` +
      `Heap Used: ${toMB(usage.heapUsed)}`
    );

    // Alert if external memory crosses a specific threshold (e.g., 1GB)
    if (usage.external > 1024 * 1024 * 1024) {
      console.warn('⚠️ WARNING: External memory has exceeded 1GB!');
    }
  }, 60000); // Logs every 60 seconds
}

startMemoryLogging(); */