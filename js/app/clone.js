import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { MapStore } from '../../cy/store.js'
import { docName } from './room.js'

const TIMEOUT_MS = 10000

function waitForSync(provider) {
  if (provider.synced) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      provider.off('sync', onSync)
      reject(new Error('Timed out connecting to the new room'))
    }, TIMEOUT_MS)
    const onSync = (synced) => {
      if (!synced) return
      clearTimeout(timer)
      provider.off('sync', onSync)
      resolve()
    }
    provider.on('sync', onSync)
  })
}

/**
 * Create a separate room, confirming another client received the complete snapshot before returning.
 * @param {object} file map snapshot
 * @param {string} server websocket server URL
 * @param {string} room new room identifier
 * @param {object} [providerOptions] websocket provider options
 * @returns {Promise<function>} releases the connection after the new page has joined
 */
export async function initialiseClone(file, server, room, providerOptions = {}) {
  const store = new MapStore()
  const verifier = new Y.Doc()
  const writer = new WebsocketProvider(server, docName(room), store.doc, providerOptions)
  let reader
  let completed = false
  try {
    await waitForSync(writer)
    if (Y.decodeStateVector(Y.encodeStateVector(store.doc)).size) {
      throw new Error('The new room is already in use')
    }
    reader = new WebsocketProvider(server, docName(room), verifier, providerOptions)
    await waitForSync(reader)
    const token = crypto.randomUUID()
    const marker = verifier.getMap('cloneConfirmation')
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        marker.unobserve(check)
        reject(new Error('Timed out saving the copy to the server'))
      }, TIMEOUT_MS)
      const check = () => {
        if (marker.get('token') !== token) return
        clearTimeout(timer)
        marker.unobserve(check)
        resolve()
      }
      marker.observe(check)
      try {
        store.doc.transact(() => {
          store.loadFile(file)
          store.doc.getMap('cloneConfirmation').set('token', token)
        })
      } catch (error) {
        clearTimeout(timer)
        marker.unobserve(check)
        reject(error)
      }
    })
    completed = true
    return () => {
      writer.destroy()
      store.doc.destroy()
    }
  } finally {
    reader?.destroy()
    verifier.destroy()
    if (!completed) {
      writer.destroy()
      store.doc.destroy()
    }
  }
}
