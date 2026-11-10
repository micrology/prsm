/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Copies and pastes selected factors and links between PRSM 4 maps.
********************************************************************************************/

import { normalizeShape } from './shapes.js'

const FORMAT = 'prsm4-selection'
const OFFSET = 40

/**
 * Collect selected factors, links and the styles they need.
 * @param {import('./store.js').MapStore} store Shared map.
 * @param {cytoscape.CollectionReturnValue} selected Selected elements.
 * @returns {object} Portable selection.
 */
export function copySelection(store, selected) {
  const nodes = new Set(
    selected
      .nodes()
      .filter((node) => store.nodes.has(node.id()))
      .map((node) => node.id())
  )
  const edges = new Set(
    selected
      .edges()
      .filter((edge) => !edge.hasClass('meta') && store.edges.has(edge.id()))
      .map((edge) => edge.id())
  )
  for (const id of edges) {
    const edge = store.edges.get(id)
    if (!edge) continue
    nodes.add(edge.source)
    nodes.add(edge.target)
  }
  for (const [id, edge] of store.edges) {
    if (nodes.has(edge.source) && nodes.has(edge.target)) edges.add(id)
  }
  if (!nodes.size) throw new Error('No factors or links can be copied from this selection')
  const records = [...nodes].map((id) => ({ id, ...store.nodes.get(id) }))
  if (records.some((node) => node.cluster)) {
    throw new Error('Dissolve selected clusters before copying their factors')
  }
  const links = [...edges].map((id) => ({ id, ...store.edges.get(id) }))
  const styles = {}
  for (const rec of [...records, ...links]) {
    if (store.styles.has(rec.style)) styles[rec.style] = store.styles.get(rec.style)
  }
  return {
    format: FORMAT,
    version: 1,
    nodes: records,
    edges: links,
    styles,
    attributeTitles: store.attributeTitles(),
  }
}

/**
 * Validate and paste a portable selection as one undoable transaction.
 * @param {import('./store.js').MapStore} store Destination map.
 * @param {object} data Clipboard contents.
 * @returns {{nodes:string[],edges:string[]}} New element IDs.
 */
export function pasteSelection(store, data) {
  if (
    !data ||
    data.format !== FORMAT ||
    data.version !== 1 ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges) ||
    !data.styles ||
    typeof data.styles !== 'object' ||
    Array.isArray(data.styles) ||
    !data.attributeTitles ||
    typeof data.attributeTitles !== 'object' ||
    Array.isArray(data.attributeTitles)
  ) {
    throw new Error('Invalid PRSM 4 clipboard contents')
  }
  const sourceIds = new Set()
  for (const node of data.nodes) {
    if (
      !node ||
      typeof node.id !== 'string' ||
      sourceIds.has(node.id) ||
      node.cluster ||
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y)
    ) {
      throw new Error('Invalid factor in clipboard')
    }
    sourceIds.add(node.id)
  }
  const nodeIds = new Set(sourceIds)
  const pairs = new Set()
  for (const edge of data.edges) {
    if (
      !edge ||
      typeof edge.id !== 'string' ||
      sourceIds.has(edge.id) ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target) ||
      edge.source === edge.target
    ) {
      throw new Error('Invalid link in clipboard')
    }
    const pair = JSON.stringify([edge.source, edge.target])
    if (pairs.has(pair)) throw new Error('Duplicate link in clipboard')
    pairs.add(pair)
    sourceIds.add(edge.id)
  }
  for (const [field, title] of Object.entries(data.attributeTitles)) {
    if (
      data.nodes.some((node) => node[field] !== undefined) ||
      data.edges.some((edge) => edge[field] !== undefined)
    ) {
      if (store.attributeTitles()[field] !== title) {
        throw new Error(
          `Attribute ${field} differs between maps; reconcile the attribute titles before pasting`
        )
      }
    }
  }
  const styleMap = new Map()
  const additions = new Map()
  for (const [id, rawStyle] of Object.entries(data.styles)) {
    const style =
      rawStyle?.kind === 'node' ? { ...rawStyle, css: normalizeShape(rawStyle.css) } : rawStyle
    if (
      !style ||
      !['node', 'edge'].includes(style.kind) ||
      !style.css ||
      typeof style.css !== 'object'
    ) {
      throw new Error('Invalid style in clipboard')
    }
    let dest = id
    if (
      store.styles.has(dest) &&
      JSON.stringify(store.styles.get(dest)) !== JSON.stringify(style)
    ) {
      const equivalent = [...store.styles].find(
        ([, candidate]) => JSON.stringify(candidate) === JSON.stringify(style)
      )
      dest =
        equivalent?.[0] ??
        `${style.kind === 'node' ? 'group' : 'edge'}${crypto.randomUUID().replace(/-/g, '')}`
    }
    styleMap.set(id, dest)
    if (!store.styles.has(dest)) additions.set(dest, style)
  }
  const ids = new Map(data.nodes.map(({ id }) => [id, crypto.randomUUID()]))
  const nodeRecords = data.nodes.map(({ id, inCluster, ...node }) => [
    ids.get(id),
    {
      ...node,
      ...(node.overrides && { overrides: normalizeShape(node.overrides) }),
      style: styleMap.get(node.style) ?? node.style,
      x: node.x + OFFSET,
      y: node.y + OFFSET,
    },
  ])
  const edgeRecords = data.edges.map(({ id, ...edge }) => [
    crypto.randomUUID(),
    {
      ...edge,
      style: styleMap.get(edge.style) ?? edge.style,
      source: ids.get(edge.source),
      target: ids.get(edge.target),
    },
  ])
  store.undoManager.stopCapturing()
  store.transact(() => {
    for (const [id, style] of additions) store.styles.set(id, style)
    for (const [id, rec] of nodeRecords) store.nodes.set(id, rec)
    for (const [id, rec] of edgeRecords) store.edges.set(id, rec)
  })
  store.undoManager.stopCapturing()
  return { nodes: nodeRecords.map(([id]) => id), edges: edgeRecords.map(([id]) => id) }
}

/**
 * Check whether a clipboard event belongs to a text-editing control.
 * @param {ClipboardEvent} event Clipboard event.
 * @returns {boolean} Whether native text editing should handle it.
 */
function editingText(event) {
  const target = event.target
  return Boolean(
    target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])') ||
    window.getSelection()?.toString()
  )
}

/**
 * Attach native copy and paste gestures to a map.
 * @param {cytoscape.Core} cy Graph.
 * @param {import('./store.js').MapStore} store Shared map.
 * @param {function(string,string):void} notify User-facing messages.
 * @param {function():boolean} readOnly Whether editing is disabled.
 * @returns {void}
 */
export function bindClipboard(cy, store, notify, readOnly) {
  document.addEventListener('copy', (event) => {
    if (editingText(event) || !event.clipboardData) return
    const selected = cy.elements(':selected')
    if (selected.empty()) return
    try {
      const data = copySelection(store, selected)
      event.clipboardData.setData('text/plain', JSON.stringify(data))
      event.preventDefault()
      notify('Copied to clipboard', 'info')
    } catch (error) {
      event.preventDefault()
      notify(`Could not copy selection: ${error.message}`, 'error')
    }
  })
  document.addEventListener('paste', (event) => {
    if (editingText(event) || !event.clipboardData) return
    const text = event.clipboardData.getData('text/plain')
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return
    }
    if (data?.format !== FORMAT) return
    event.preventDefault()
    if (readOnly()) return notify('This map is read-only', 'warn')
    try {
      const pasted = pasteSelection(store, data)
      cy.elements(':selected').unselect()
      for (const id of [...pasted.nodes, ...pasted.edges]) cy.getElementById(id).select()
      notify('Pasted', 'info')
    } catch (error) {
      notify(`Could not paste selection: ${error.message}`, 'error')
    }
  })
}
