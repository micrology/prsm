/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Imports and exports maps in GML format.
********************************************************************************************/

import { legacyToV2, normaliseLegacy } from '../graph/legacy.js'
import { noteText, resolve } from '../graph/columns.js'

/**
 * Decode numeric character references in a GML string.
 * @param {string} value Encoded string.
 * @returns {string} Decoded string.
 */
function decode(value) {
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
    const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) {
      throw new Error('Invalid character reference in GML')
    }
    return String.fromCodePoint(n)
  })
}

/**
 * Split GML into quoted and unquoted tokens, ignoring whitespace and comments.
 * @param {string} input GML document.
 * @returns {Array<object>} Tokens with their values and quoted status.
 */
function tokenize(input) {
  const tokens = []
  const re = /\s+|#[^\r\n]*|\[|\]|"(?:[^"\\]|\\.)*"|[^\s[\]"#]+/gy
  let pos = 0
  while (pos < input.length) {
    re.lastIndex = pos
    const match = re.exec(input)
    if (!match) throw new Error(`Invalid GML at character ${pos + 1}`)
    pos = re.lastIndex
    const token = match[0]
    if (/^\s|^#/.test(token)) continue
    if (token.startsWith('"')) {
      tokens.push({ value: decode(token.slice(1, -1).replace(/\\(["\\])/g, '$1')), quoted: true })
    } else tokens.push({ value: token, quoted: false })
  }
  return tokens
}

/**
 * Parse a GML document into nested key-value entries.
 * @param {string} input GML document.
 * @returns {Array<Array>} Parsed entries.
 */
function parse(input) {
  const tokens = tokenize(input)
  let index = 0
  /**
   * Parse entries up to the end of the document or a closing bracket.
   * @param {boolean} [nested] Whether a closing bracket is required.
   * @returns {Array<Array>} Parsed entries.
   */
  function entries(nested = false) {
    const result = []
    while (index < tokens.length && (tokens[index].value !== ']' || tokens[index].quoted)) {
      const key = tokens[index++]
      if (key.quoted || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key.value)) {
        throw new Error('Invalid GML key')
      }
      const token = tokens[index++]
      if (!token || (!token.quoted && token.value === ']')) throw new Error('Missing GML value')
      const value = !token.quoted && token.value === '[' ? entries(true) : token.value
      result.push([key.value.toLowerCase(), value])
    }
    if (nested) {
      if (!tokens[index] || tokens[index].quoted || tokens[index++].value !== ']') {
        throw new Error('Unclosed GML list')
      }
    }
    return result
  }
  const result = entries()
  if (index !== tokens.length) throw new Error('Unexpected closing bracket in GML')
  return result
}

/**
 * Find a single value for a GML key, rejecting duplicates.
 * @param {Array<Array>} entries Parsed entries.
 * @param {string} key Lowercase key.
 * @returns {*} Value, or undefined if absent.
 */
function value(entries, key) {
  const matches = entries.filter(([name]) => name === key)
  if (matches.length > 1) throw new Error(`Repeated GML ${key}`)
  return matches[0]?.[1]
}

/**
 * Convert a GML coordinate to a finite number.
 * @param {*} value Coordinate value, if supplied.
 * @param {number} fallback Value to use when absent.
 * @returns {number} Parsed coordinate or fallback.
 */
function coordinate(value, fallback) {
  if (value === undefined) return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('Invalid GML coordinate')
  return n
}

/**
 * Convert a parsed GML node to a factor record.
 * @param {Array<Array>} item Node entries.
 * @param {number} index Position used to lay out nodes without coordinates.
 * @returns {object} Factor record.
 */
function readNode(item, index) {
  if (!Array.isArray(item)) throw new Error('Invalid GML node')
  const id = value(item, 'id')
  if (id === undefined || Array.isArray(id) || id === '') throw new Error('Missing GML node ID')
  const graphics = value(item, 'graphics') ?? []
  if (!Array.isArray(graphics)) throw new Error('Invalid GML graphics')
  const node = {
    id,
    label: value(item, 'label') ?? id,
    style: 'group0',
    x: coordinate(value(graphics, 'x'), (index % 10) * 100),
    y: coordinate(value(graphics, 'y'), Math.floor(index / 10) * 100),
  }
  const color = value(graphics, 'fill') ?? value(item, 'color') ?? value(item, 'colour')
  if (color && !Array.isArray(color)) node.overrides = { 'background-color': color }
  const note = value(item, 'note')
  if (note && !Array.isArray(note)) node.note = { ops: [{ insert: `${note}\n` }] }
  if (typeof node.label !== 'string') throw new Error('Invalid GML node label')
  return node
}

/**
 * Convert a parsed GML edge, recording missing endpoints and remapped IDs.
 * @param {Array<Array>} item Edge entries.
 * @param {Set<string>} nodes Available factor IDs.
 * @param {Set<string>} ids IDs already used in the map.
 * @param {object} warnings Mutable import counters.
 * @returns {object|null} Link record, or null if an endpoint is missing.
 */
function readEdge(item, nodes, ids, warnings) {
  if (!Array.isArray(item)) throw new Error('Invalid GML edge')
  const source = value(item, 'source')
  const target = value(item, 'target')
  if (!nodes.has(source) || !nodes.has(target)) {
    warnings.dropped++
    return null
  }
  let id = value(item, 'id')
  if (typeof id !== 'string' || !id || ids.has(id)) {
    id = crypto.randomUUID()
    warnings.remapped++
  }
  ids.add(id)
  const label = value(item, 'label') ?? ''
  if (typeof label !== 'string') throw new Error('Invalid GML edge label')
  const edge = { id, source, target, label, style: 'edge0' }
  const note = value(item, 'note')
  if (note && !Array.isArray(note)) edge.note = { ops: [{ insert: `${note}\n` }] }
  const color = value(item, 'color') ?? value(item, 'colour')
  if (color && !Array.isArray(color)) {
    edge.overrides = { 'line-color': color, 'target-arrow-color': color }
  }
  return edge
}

/**
 * Import a GML graph into a native map.
 * @param {string} input GML document
 * @returns {{file: object, warnings: string[]}} parsed map and warnings
 */
export function readGml(input) {
  const graph = value(parse(input), 'graph')
  if (!Array.isArray(graph)) throw new Error('GML must contain a graph list')
  const file = legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file
  const ids = new Set()
  for (const [, item] of graph.filter(([key]) => key === 'node')) {
    const node = readNode(item, file.nodes.length)
    if (ids.has(node.id)) throw new Error('Duplicate GML node ID')
    ids.add(node.id)
    file.nodes.push(node)
  }
  const nodeIds = new Set(ids)
  const result = { dropped: 0, remapped: 0 }
  for (const [, item] of graph.filter(([key]) => key === 'edge')) {
    const edge = readEdge(item, nodeIds, ids, result)
    if (edge) file.edges.push(edge)
  }
  const warnings = []
  if (result.dropped) warnings.push(`${result.dropped} links with missing endpoints were omitted`)
  if (result.remapped) warnings.push(`${result.remapped} link IDs were generated or remapped`)
  if (value(graph, 'directed') !== '1') warnings.push('Undirected links were imported as directed')
  warnings.push('Only basic GML graph data is imported; other properties may be omitted')
  return { file, warnings }
}

/**
 * Encode a value as a quoted GML string.
 * @param {*} value Value to encode.
 * @returns {string} Quoted GML string.
 */
function quote(value) {
  let result = ''
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0)
    if (code >= 0xd800 && code <= 0xdfff) throw new Error('Invalid character in GML')
    result +=
      code < 32 || code > 126 || char === '"' || char === '&' || char === '\\' ? `&#${code};` : char
  }
  return `"${result}"`
}

/**
 * Export a map as GML.
 * @param {import('../graph/store.js').MapStore} store map to export
 * @returns {string} GML document
 */
export function writeGml(store) {
  const nodes = [...store.nodes.entries()].filter(([, node]) => !node.cluster)
  const ids = new Map(nodes.map(([id], index) => [id, index]))
  const output = ['Creator "PRSM"', 'graph [', '  directed 1']
  for (const [id, node] of nodes) {
    const color = resolve(store, 'node', node, 'background-color')
    output.push(
      `  node [ id ${ids.get(id)} label ${quote(node.label)} note ${quote(noteText(node.note))}`,
      `    graphics [ x ${coordinate(node.x, 0)} y ${coordinate(node.y, 0)}${color ? ` fill ${quote(color)}` : ''} ] ]`
    )
  }
  for (const [, edge] of store.edges.entries()) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    const color = resolve(store, 'edge', edge, 'line-color')
    output.push(
      `  edge [ source ${ids.get(edge.source)} target ${ids.get(edge.target)} label ${quote(edge.label)} note ${quote(noteText(edge.note))}${color ? ` color ${quote(color)}` : ''} ]`
    )
  }
  output.push(']')
  return output.join('\n')
}
