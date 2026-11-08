import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { docName, roomFromUrl, serverUrl } from './room.js'

const TIMEOUT_MS = 10000
const labelKey = (label) => String(label ?? '').replace(/\s/g, '')
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Read a PRSM 4 room without modifying it.
 * @param {URL} url source map URL
 * @returns {Promise<object>} source map snapshot
 */
export async function readMergeRoom(url) {
  const room = roomFromUrl(url)
  if (!room || !/\/prsm4\.html$/i.test(url.pathname)) {
    throw new Error('Enter a link to a PRSM 4 map with a room ID')
  }
  const server = serverUrl(url)
  const protocol = new URL(server).protocol
  if (!['ws:', 'wss:'].includes(protocol)) throw new Error('Invalid websocket server address')
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(server, docName(room), doc)
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out connecting to the source map')),
        TIMEOUT_MS
      )
      provider.once('sync', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    const meta = doc.getMap('meta')
    if (meta.get('schemaVersion') !== 2) {
      throw new Error('The source room does not contain a PRSM 4 map')
    }
    return {
      meta: meta.toJSON(),
      styles: doc.getMap('styles').toJSON(),
      nodes: [...doc.getMap('nodes').entries()].map(([id, rec]) => ({ id, ...rec })),
      edges: [...doc.getMap('edges').entries()].map(([id, rec]) => ({ id, ...rec })),
    }
  } finally {
    provider.destroy()
    doc.destroy()
  }
}

/**
 * Merge a snapshot using factor IDs, then unique matching labels, as in the legacy app.
 * @param {import('../../cy/store.js').MapStore} store destination
 * @param {object} file source snapshot
 * @returns {{addedNodes:number, addedEdges:number, conflicts:number, warnings:string[]}} merge result
 */
export function mergeMap(store, file) {
  const warnings = []
  for (const [field, title] of Object.entries(file.meta.attributeTitles ?? {})) {
    if (store.attributeTitles()[field] !== title) {
      throw new Error(
        `Attribute ${field} differs between maps; reconcile the attribute titles before merging`
      )
    }
  }
  const ids = new Set([...store.nodes.keys(), ...store.edges.keys()])
  const freshId = () => {
    let id
    do id = crypto.randomUUID()
    while (ids.has(id))
    ids.add(id)
    return id
  }
  const styles = new Map()
  const usedStyles = new Set(store.styles.keys())
  for (const [id, style] of Object.entries(file.styles)) {
    if (!usedStyles.has(id) || equal(store.styles.get(id), style)) {
      styles.set(id, id)
      usedStyles.add(id)
    } else {
      const equivalent = [...store.styles.entries()].find(([, candidate]) =>
        equal(candidate, style)
      )
      if (equivalent) {
        styles.set(id, equivalent[0])
        continue
      }
      let replacement
      do {
        replacement = `${style.kind === 'node' ? 'group' : 'edge'}${crypto.randomUUID().replace(/-/g, '')}`
      } while (usedStyles.has(replacement))
      usedStyles.add(replacement)
      styles.set(id, replacement)
    }
  }
  const map = new Map()
  const nodes = []
  const edges = []
  const updates = []
  const conflictIds = new Set()
  const edgePairs = new Map()
  for (const [id, edge] of store.edges) {
    edgePairs.set(JSON.stringify([edge.source, edge.target]), [id, edge])
  }
  let noteChanges = 0
  let styleDifferences = 0
  let labelDifferences = 0
  let skippedEdges = 0
  let conflicts = 0
  const existing = [...store.nodes.entries()].filter(([, node]) => !node.cluster)
  for (const { id, cluster, inCluster, ...node } of file.nodes) {
    if (cluster) continue
    let match =
      store.nodes.has(id) && !store.nodes.get(id).cluster ? [id, store.nodes.get(id)] : null
    if (!match && labelKey(node.label)) {
      const matches = existing.filter(([, rec]) => labelKey(rec.label) === labelKey(node.label))
      if (matches.length > 1) {
        throw new Error(
          'A factor label matches multiple factors in this map; rename them before merging'
        )
      }
      match = matches[0]
    }
    if (match && labelKey(match[1].label) === labelKey(node.label)) {
      map.set(id, match[0])
      if (match[1].style !== styles.get(node.style)) styleDifferences++
      if (!equal(match[1].note, node.note)) {
        updates.push([match[0], { ...match[1], note: node.note }])
        noteChanges++
      }
      continue
    }
    const conflict = Boolean(match)
    const newId = ids.has(id) || conflict ? freshId() : id
    ids.add(newId)
    map.set(id, newId)
    const rec = { ...node, style: styles.get(node.style) ?? node.style }
    if (conflict) {
      conflicts++
      conflictIds.add(newId)
      rec.x = (match[1].x ?? 0) + 30
      rec.y = (match[1].y ?? 0) + 30
      rec.overrides = {
        ...rec.overrides,
        'border-color': '#ff0000',
        'border-width': 4,
        'border-style': 'dashed',
      }
    }
    nodes.push([newId, rec])
  }
  for (const { id, ...edge } of file.edges) {
    const source = map.get(edge.source)
    const target = map.get(edge.target)
    if (!source || !target) {
      skippedEdges++
      continue
    }
    const pair = JSON.stringify([source, target])
    const existingEdge = edgePairs.get(pair)
    if (existingEdge) {
      if (labelKey(existingEdge[1].label) !== labelKey(edge.label)) labelDifferences++
      if (existingEdge[1].style !== styles.get(edge.style)) styleDifferences++
      if (!equal(existingEdge[1].note, edge.note)) {
        if (store.edges.has(existingEdge[0])) {
          updates.push([existingEdge[0], { ...existingEdge[1], note: edge.note }, 'edges'])
          noteChanges++
        }
      }
      continue
    }
    const newId = ids.has(id) ? freshId() : id
    ids.add(newId)
    const rec = { ...edge, source, target, style: styles.get(edge.style) ?? edge.style }
    if (conflictIds.has(source) || conflictIds.has(target)) {
      rec.overrides = {
        ...rec.overrides,
        'line-color': '#ff0000',
        width: 4,
        'line-style': 'dashed',
      }
    }
    edges.push([newId, rec])
    edgePairs.set(pair, [newId, rec])
  }
  if (noteChanges) warnings.push(`${noteChanges} existing notes were replaced by source notes`)
  if (styleDifferences) warnings.push(`${styleDifferences} existing styles were retained`)
  if (labelDifferences) warnings.push(`${labelDifferences} existing link labels were retained`)
  if (skippedEdges) warnings.push(`${skippedEdges} links with unavailable endpoints were omitted`)
  if (file.meta.legacyBackground || file.meta.legacyUnderlay) {
    warnings.push('The source background was not merged')
  }
  store.undoManager.stopCapturing()
  store.transact((transaction) => {
    const requiredStyles = new Set([...nodes, ...edges].map(([, rec]) => rec.style))
    for (const [id, mapped] of styles) {
      if (requiredStyles.has(mapped) && !store.styles.has(mapped)) {
        store.styles.set(mapped, file.styles[id])
      }
    }
    for (const [id, rec] of nodes) store.nodes.set(id, rec)
    for (const [id, rec] of edges) store.edges.set(id, rec)
    for (const [id, rec, kind = 'nodes'] of updates) store[kind].set(id, rec)
    transaction.meta.set('mergeAction', { nodes: nodes.length, edges: edges.length, conflicts })
  })
  store.undoManager.stopCapturing()
  return { addedNodes: nodes.length, addedEdges: edges.length, conflicts, warnings }
}
