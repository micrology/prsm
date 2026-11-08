/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Imports and exports maps in GraphML and GEXF formats.
********************************************************************************************/

import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { legacyToV2, normaliseLegacy } from '../graph/legacy.js'
import { noteText, resolve } from '../graph/columns.js'

/**
 * Normalize an optional XML element or array of elements to an array.
 * @param {*} value Parsed XML value.
 * @returns {Array} Element array.
 */
const list = (value) => (value == null ? [] : Array.isArray(value) ? value : [value])
/**
 * Extract text from a parsed XML value.
 * @param {*} value Parsed XML value.
 * @returns {string} Text content.
 */
const text = (value) =>
  typeof value === 'object' && value !== null ? String(value['#text'] ?? '') : String(value ?? '')
/**
 * Escape a value for XML, rejecting invalid XML characters.
 * @param {*} value Value to encode.
 * @returns {string} Escaped text.
 */
const esc = (value) => {
  const string = String(value ?? '')
  for (const char of string) {
    const code = char.codePointAt(0)
    if (
      (code < 32 && ![9, 10, 13].includes(code)) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfffe ||
      code === 0xffff
    ) {
      throw new Error('Map contains characters that cannot be represented in XML')
    }
  }
  return string
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;')
    .replace(/\t/g, '&#9;')
}
const CUSTOM_KEY_PREFIX = 'prsm-attribute-'

/**
 * Validate and parse graph XML without allowing document type declarations.
 * @param {string} input XML document.
 * @returns {object} Parsed XML tree.
 */
function parseXml(input) {
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) throw new Error('XML document types are not supported')
  const valid = XMLValidator.validate(input)
  if (valid !== true) throw new Error(`Invalid XML: ${valid.err.msg}`)
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    htmlEntities: true,
  }).parse(input)
}

/**
 * Convert a value to a finite number, using a fallback if unavailable.
 * @param {*} value Input value.
 * @param {*} fallback Fallback value.
 * @returns {*} Parsed number or fallback.
 */
function number(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Create an empty native map with default styles.
 * @returns {object} Native map snapshot.
 */
function makeFile() {
  return legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file
}

/**
 * Add an imported XML node to the map.
 * @param {object} file Destination snapshot.
 * @param {Set<string>} ids IDs already used.
 * @param {string} id Node ID.
 * @param {string} label Node label.
 * @param {object} values Parsed node properties.
 * @param {number} index Position used when coordinates are absent.
 * @returns {object} Added factor record.
 */
function addNode(file, ids, id, label, values, index) {
  if (!id || ids.has(id)) {
    throw new Error('Missing or duplicate factor ID')
  }
  ids.add(id)
  const node = {
    id,
    label: label || id,
    style: 'group0',
    x: number(values.x, (index % 10) * 100),
    y: number(values.y, Math.floor(index / 10) * 100),
  }
  const note = values.note || values.description
  if (note) node.note = { ops: [{ insert: `${note}\n` }] }
  const rgb = [values.r, values.g, values.b].map((v) => number(v, NaN))
  const color = rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
    ? `rgb(${rgb.join(',')})`
    : values.color
  if (color) node.overrides = { 'background-color': color }
  file.nodes.push(node)
  return node
}

/**
 * Add an imported XML edge, recording omissions and remapped IDs.
 * @param {object} file Destination snapshot.
 * @param {Set<string>} nodeIds Available factor IDs.
 * @param {Set<string>} ids IDs already used.
 * @param {string} id Edge ID.
 * @param {string} source Source factor ID.
 * @param {string} target Target factor ID.
 * @param {object} values Parsed edge properties.
 * @param {object} warnings Mutable import counters.
 * @returns {object|null} Added link, or null if an endpoint is missing.
 */
function addEdge(file, nodeIds, ids, id, source, target, values, warnings) {
  if (!nodeIds.has(source) || !nodeIds.has(target)) {
    warnings.dropped++
    return null
  }
  if (!id || ids.has(id)) {
    id = crypto.randomUUID()
    warnings.remapped++
  }
  ids.add(id)
  const edge = { id, source, target, style: 'edge0', label: values.label || '' }
  const note = values.note || values.description
  if (note) edge.note = { ops: [{ insert: `${note}\n` }] }
  const width = number(values.weight, null)
  if (width !== null && width > 0) edge.overrides = { width: Math.min(20, Math.max(1, width)) }
  if (values.color) {
    edge.overrides = {
      ...edge.overrides,
      'line-color': values.color,
      'target-arrow-color': values.color,
    }
  }
  file.edges.push(edge)
  return edge
}

/**
 * Add non-reserved imported properties as map attributes.
 * @param {object} file Destination snapshot.
 * @param {object} record Factor or link record to update.
 * @param {object} values Imported properties.
 * @param {Set<string>} reserved Property names used by the importer.
 * @param {Map<string, string>} fields Mapping from imported names to attribute IDs.
 * @returns {void}
 */
function addAttributes(file, record, values, reserved, fields) {
  for (const [name, value] of Object.entries(values)) {
    if (reserved.has(name.toLowerCase()) || value == null || value === '') continue
    let field = fields.get(name)
    if (!field) {
      field = `att${fields.size + 1}`
      fields.set(name, field)
      file.meta.attributeTitles[field] = name
    }
    record[field] = value
  }
}

/**
 * Restore PRSM attribute fields previously exported in graph XML.
 * @param {object} file Destination snapshot.
 * @param {object} record Factor or link record to update.
 * @param {Array<object>} entries Parsed attribute entries.
 * @param {Map<string, string>} definitions Attribute IDs and titles.
 * @param {Map<string, string>} fields Mapping to destination attribute IDs.
 * @param {string} valueKey XML property containing the attribute ID.
 * @returns {void}
 */
function addExportedAttributes(file, record, entries, definitions, fields, valueKey) {
  for (const entry of entries) {
    const key = entry[valueKey]
    if (!key?.startsWith(CUSTOM_KEY_PREFIX) || !definitions.has(key)) continue
    const fieldKey = `${CUSTOM_KEY_PREFIX}${key}`
    if (!fields.has(fieldKey)) {
      const field = `att${fields.size + 1}`
      fields.set(fieldKey, field)
      file.meta.attributeTitles[field] = definitions.get(key)
    }
    const value = valueKey === '@_key' ? text(entry) : (entry['@_value'] ?? '')
    if (value !== '') record[fields.get(fieldKey)] = value
  }
}

const NODE_RESERVED = new Set([
  'label',
  'note',
  'description',
  'x',
  'y',
  'r',
  'g',
  'b',
  'color',
  'size',
  'shape',
  'style',
])
const EDGE_RESERVED = new Set([
  'label',
  'edge label',
  'note',
  'description',
  'weight',
  'color',
  'style',
  'r',
  'g',
  'b',
])

/**
 * Extract declared GraphML data values from an element.
 * @param {object} element Parsed node or edge.
 * @param {Map<string, string>} keys GraphML key names.
 * @returns {object} Named values.
 */
function graphmlValues(element, keys) {
  const values = Object.create(null)
  for (const entry of list(element.data)) {
    const key = entry['@_key']
    if (key?.startsWith(CUSTOM_KEY_PREFIX)) continue
    const name = keys.get(key)
    if (name) {
      const lower = name.toLowerCase()
      const field = NODE_RESERVED.has(lower) || EDGE_RESERVED.has(lower) ? lower : name
      const value = text(entry)
      if (Object.hasOwn(values, field) && values[field] !== value) {
        throw new Error(`Ambiguous repeated attribute: ${name}`)
      }
      values[field] = value
    }
  }
  return values
}

/**
 * Import nodes, links and attributes from a GraphML graph.
 * @param {object} root Parsed GraphML root.
 * @param {object} file Destination snapshot.
 * @param {object} warnings Mutable import counters and flags.
 * @returns {void}
 */
function readGraphml(root, file, warnings) {
  if (root.graph === undefined || Array.isArray(root.graph)) {
    throw new Error('GraphML must contain one graph')
  }
  const graph = root.graph || {}
  if (graph.hyperedge !== undefined || list(graph.node).some((node) => node.graph !== undefined)) {
    throw new Error('Nested graphs and hyperedges are not supported')
  }
  const keys = new Map(
    list(root.key).map((key) => [key['@_id'], key['@_attr.name'] ?? key['@_id']])
  )
  const fields = new Map()
  const ids = new Set()
  for (const [index, node] of list(graph.node).entries()) {
    const values = graphmlValues(node, keys)
    const rec = addNode(file, ids, node['@_id'], values.label, values, index)
    addAttributes(file, rec, values, NODE_RESERVED, fields)
    addExportedAttributes(file, rec, list(node.data), keys, fields, '@_key')
  }
  const nodeIds = new Set(ids)
  for (const edge of list(graph.edge)) {
    const values = graphmlValues(edge, keys)
    values.label ??= values['edge label']
    const rec = addEdge(
      file,
      nodeIds,
      ids,
      edge['@_id'],
      edge['@_source'],
      edge['@_target'],
      values,
      warnings
    )
    if (rec) {
      addAttributes(file, rec, values, EDGE_RESERVED, fields)
      addExportedAttributes(file, rec, list(edge.data), keys, fields, '@_key')
    }
    if (edge['@_directed'] === 'false') warnings.undirected = true
  }
  if (graph['@_edgedefault'] === 'undirected') warnings.undirected = true
}

/**
 * Collect GEXF node and edge attribute definitions.
 * @param {object} graph Parsed GEXF graph.
 * @returns {object} Maps of node and edge attribute IDs to titles.
 */
function gexfDefinitions(graph) {
  const result = { node: new Map(), edge: new Map() }
  for (const group of list(graph.attributes)) {
    const table = result[group['@_class']]
    if (!table) continue
    for (const attr of list(group.attribute)) {
      table.set(attr['@_id'], attr['@_title'] ?? attr['@_id'])
    }
  }
  return result
}

/**
 * Extract declared GEXF attribute values from an element.
 * @param {object} element Parsed node or edge.
 * @param {Map<string, string>} definitions Attribute IDs and titles.
 * @returns {object} Named values.
 */
function gexfValues(element, definitions) {
  const values = Object.create(null)
  for (const entry of list(element.attvalues?.attvalue)) {
    const key = entry['@_for']
    if (key?.startsWith(CUSTOM_KEY_PREFIX)) continue
    const name = definitions.get(key)
    if (name) {
      const lower = name.toLowerCase()
      const field = NODE_RESERVED.has(lower) || EDGE_RESERVED.has(lower) ? lower : name
      const value = entry['@_value'] ?? ''
      if (Object.hasOwn(values, field) && values[field] !== value) {
        throw new Error(`Ambiguous repeated attribute: ${name}`)
      }
      values[field] = value
    }
  }
  return values
}

/**
 * Import nodes, links and attributes from a GEXF graph.
 * @param {object} root Parsed GEXF root.
 * @param {object} file Destination snapshot.
 * @param {object} warnings Mutable import counters and flags.
 * @returns {void}
 */
function readGexf(root, file, warnings) {
  if (root.graph === undefined || Array.isArray(root.graph)) {
    throw new Error('GEXF must contain one graph')
  }
  const graph = root.graph || {}
  const defs = gexfDefinitions(graph)
  const fields = new Map()
  const ids = new Set()
  for (const [index, node] of list(graph.nodes?.node).entries()) {
    const values = gexfValues(node, defs.node)
    values.x = node.position?.['@_x'] ?? values.x
    values.y = node.position?.['@_y'] ?? values.y
    for (const color of ['r', 'g', 'b']) values[color] = node.color?.[`@_${color}`] ?? values[color]
    if (node.nodes !== undefined) throw new Error('Nested graphs are not supported')
    const rec = addNode(file, ids, node['@_id'], node['@_label'], values, index)
    addAttributes(file, rec, values, NODE_RESERVED, fields)
    addExportedAttributes(file, rec, list(node.attvalues?.attvalue), defs.node, fields, '@_for')
  }
  const nodeIds = new Set(ids)
  for (const edge of list(graph.edges?.edge)) {
    const values = gexfValues(edge, defs.edge)
    values.label = edge['@_label'] ?? values.label
    values.weight = edge['@_weight'] ?? edge.thickness?.['@_value'] ?? values.weight
    if (edge.color) {
      const rgb = ['r', 'g', 'b'].map((key) => number(edge.color[`@_${key}`], NaN))
      if (rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
        values.color = `rgb(${rgb.join(',')})`
      }
    }
    const rec = addEdge(
      file,
      nodeIds,
      ids,
      edge['@_id'],
      edge['@_source'],
      edge['@_target'],
      values,
      warnings
    )
    if (rec) {
      addAttributes(file, rec, values, EDGE_RESERVED, fields)
      addExportedAttributes(file, rec, list(edge.attvalues?.attvalue), defs.edge, fields, '@_for')
    }
    if (edge['@_type'] === 'undirected') warnings.undirected = true
  }
  if (graph['@_defaultedgetype'] === 'undirected') warnings.undirected = true
}

/**
 * Import GraphML or GEXF into a native map.
 * @param {string} input XML file contents
 * @param {'graphml'|'gexf'} format file format
 * @returns {{file: object, warnings: string[]}} parsed map and import warnings
 */
export function readGraphXml(input, format) {
  if (format !== 'graphml' && format !== 'gexf') throw new Error('Unsupported graph XML format')
  const xml = parseXml(input)
  const root = xml[format]
  if (!root || typeof root !== 'object') throw new Error(`Not a ${format.toUpperCase()} file`)
  const file = makeFile()
  const result = { dropped: 0, remapped: 0, undirected: false }
  if (format === 'graphml') readGraphml(root, file, result)
  else readGexf(root, file, result)
  const warnings = []
  if (result.dropped) warnings.push(`${result.dropped} links with missing endpoints were omitted`)
  if (result.remapped) warnings.push(`${result.remapped} link IDs were generated or remapped`)
  if (result.undirected) warnings.push('Undirected links were imported as directed links')
  warnings.push(
    'Only basic graph data is imported; advanced formatting, undeclared attributes, defaults and dynamic graph features may be omitted'
  )
  return { file, warnings }
}

/**
 * Collect exportable map records and active attribute titles.
 * @param {import('../graph/store.js').MapStore} store Source map.
 * @returns {object} Factor entries, link entries and attribute titles.
 */
function mapData(store) {
  const nodes = [...store.nodes.entries()].filter(([, node]) => !node.cluster)
  const ids = new Set(nodes.map(([id]) => id))
  const edges = [...store.edges.entries()].filter(
    ([, edge]) => ids.has(edge.source) && ids.has(edge.target)
  )
  const attributes = Object.entries(store.attributeTitles()).filter(
    ([, name]) => name !== '*deleted*'
  )
  return { nodes, edges, attributes }
}

/**
 * Collect values to export for one factor or link.
 * @param {import('../graph/store.js').MapStore} store Source map.
 * @param {'node'|'edge'} kind Record kind.
 * @param {object} rec Factor or link record.
 * @param {Array<Array<string>>} attributes Active attribute IDs and titles.
 * @returns {object} Values keyed by XML attribute ID.
 */
function exportedValues(store, kind, rec, attributes) {
  const result = {
    label: rec.label ?? '',
    note: noteText(rec.note),
    ...(kind === 'node'
      ? { x: rec.x ?? 0, y: rec.y ?? 0 }
      : { weight: resolve(store, kind, rec, 'width') ?? 1 }),
  }
  for (const [id] of attributes) {
    if (rec[id] !== undefined) result[`${CUSTOM_KEY_PREFIX}${id}`] = String(rec[id])
  }
  return result
}

/**
 * Export GraphML or GEXF, retaining labels, positions, plain notes and attributes.
 * @param {import('../graph/store.js').MapStore} store map to export
 * @param {'graphml'|'gexf'} format output format
 * @returns {string} XML
 */
export function writeGraphXml(store, format) {
  const { nodes, edges, attributes } = mapData(store)
  const names = [
    ['label', 'label'],
    ['note', 'note'],
    ['x', 'x'],
    ['y', 'y'],
    ['weight', 'weight'],
    ...attributes.map(([id, name]) => [`${CUSTOM_KEY_PREFIX}${id}`, name]),
  ]
  if (format === 'graphml') {
    const keys = names
      .map(
        ([id, name]) =>
          `<key id="${esc(id)}" for="all" attr.name="${esc(name)}" attr.type="string"/>`
      )
      .join('')
    /**
     * Serialize the GraphML data values for a record.
     * @param {'node'|'edge'} kind Record kind.
     * @param {object} rec Factor or link record.
     * @returns {string} GraphML data elements.
     */
    const data = (kind, rec) =>
      Object.entries(exportedValues(store, kind, rec, attributes))
        .map(([key, value]) => `<data key="${esc(key)}">${esc(value)}</data>`)
        .join('')
    return `<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns">${keys}<graph edgedefault="directed">${nodes.map(([id, rec]) => `<node id="${esc(id)}">${data('node', rec)}</node>`).join('')}${edges.map(([id, rec]) => `<edge id="${esc(id)}" source="${esc(rec.source)}" target="${esc(rec.target)}">${data('edge', rec)}</edge>`).join('')}</graph></graphml>`
  }
  if (format !== 'gexf') throw new Error('Unsupported graph XML format')
  /**
   * Serialize GEXF attribute definitions for a record kind.
   * @param {'node'|'edge'} kind Record kind.
   * @returns {string} GEXF attributes element.
   */
  const defs = (kind) =>
    `<attributes class="${kind}">${names
      .filter(([id]) => !['label', 'x', 'y', 'weight'].includes(id))
      .map(([id, name]) => `<attribute id="${esc(id)}" title="${esc(name)}" type="string"/>`)
      .join('')}</attributes>`
  /**
   * Serialize GEXF attribute values for a record.
   * @param {'node'|'edge'} kind Record kind.
   * @param {object} rec Factor or link record.
   * @returns {string} GEXF attribute values element.
   */
  const att = (kind, rec) =>
    `<attvalues>${Object.entries(exportedValues(store, kind, rec, attributes))
      .filter(([id]) => !['label', 'x', 'y', 'weight'].includes(id))
      .map(([id, value]) => `<attvalue for="${esc(id)}" value="${esc(value)}"/>`)
      .join('')}</attvalues>`
  return `<?xml version="1.0" encoding="UTF-8"?><gexf xmlns="http://gexf.net/1.3" xmlns:viz="http://gexf.net/1.3/viz" version="1.3"><graph mode="static" defaultedgetype="directed">${defs('node')}${defs('edge')}<nodes>${nodes.map(([id, rec]) => `<node id="${esc(id)}" label="${esc(rec.label)}">${att('node', rec)}<viz:position x="${esc(rec.x ?? 0)}" y="${esc(rec.y ?? 0)}"/></node>`).join('')}</nodes><edges>${edges.map(([id, rec]) => `<edge id="${esc(id)}" source="${esc(rec.source)}" target="${esc(rec.target)}" label="${esc(rec.label)}" weight="${esc(resolve(store, 'edge', rec, 'width') ?? 1)}">${att('edge', rec)}</edge>`).join('')}</edges></graph></gexf>`
}
