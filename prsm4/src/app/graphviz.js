/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Imports and exports maps in Graphviz DOT format.
********************************************************************************************/

import parseDot from 'dotparser'
import { legacyToV2, normaliseLegacy } from '../graph/legacy.js'
import { noteText, resolve } from '../graph/columns.js'

/**
 * Normalize legacy DOT strings and collect the edge operators used.
 * @param {string} input DOT document.
 * @returns {{input: string, changed: boolean, operators: Set<string>}} Normalized text and findings.
 */
function normaliseLegacyStrings(input) {
  let result = ''
  let quoted = false
  let comment = ''
  let htmlDepth = 0
  let changed = false
  const operators = new Set()
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    const next = input[i + 1]
    if (comment) {
      result += c
      if (comment === 'line' && (c === '\n' || c === '\r')) comment = ''
      if (comment === 'block' && c === '*' && next === '/') {
        result += input[++i]
        comment = ''
      }
    } else if (htmlDepth) {
      result += c
      if (c === '<') htmlDepth++
      if (c === '>') htmlDepth--
    } else if (quoted && c === '\\' && next !== undefined) {
      result += c + input[++i]
    } else if (!quoted && c === '/' && (next === '/' || next === '*')) {
      comment = next === '/' ? 'line' : 'block'
      result += c + input[++i]
    } else if (!quoted && c === '<') {
      htmlDepth = 1
      result += c
    } else if (c === '"') {
      quoted = !quoted
      result += c
    } else if (!quoted && c === '#' && /=\s*$/.test(result)) {
      const hex = /^#[\da-fA-F]{6,8}(?=[\s,\]])/.exec(input.slice(i))
      if (hex) {
        result += `"${hex[0]}"`
        i += hex[0].length - 1
        changed = true
      } else {
        comment = 'line'
        result += c
      }
    } else if (!quoted && c === '#') {
      comment = 'line'
      result += c
    } else if (quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && next === '\n') i++
      result += '\\n'
      changed = true
    } else if (!quoted && c === '-' && (next === '>' || next === '-')) {
      operators.add(c + next)
      result += c + input[++i]
    } else if (!quoted && /[\d.-]/.test(c) && !/[\w.\u0080-\uffff]/.test(input[i - 1] ?? '')) {
      const number = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?![\w.\u0080-\uffff])/.exec(input.slice(i))
      if (number) {
        result += `"${number[0]}"`
        i += number[0].length - 1
      } else result += c
    } else result += c
  }
  return { input: result, changed, operators }
}

/**
 * Convert a DOT scalar to text, rejecting unsupported HTML values.
 * @param {*} value Parsed DOT value.
 * @returns {string} Scalar text.
 */
function string(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('HTML labels and identifiers are not supported in Graphviz files')
  }
  return String(value)
}

/**
 * Decode supported DOT label escapes.
 * @param {*} value Parsed label.
 * @param {string} id Node ID used for the name escape.
 * @returns {string} Decoded label.
 */
function decodeLabel(value, id) {
  return string(value).replace(/\\([\\nNlLr])/g, (match, escape) => {
    if (escape === '\\') return '\\'
    if (escape === 'N') return id
    return '\n'
  })
}

/**
 * Convert parsed DOT attributes into a lowercase-keyed record.
 * @param {Array<object>} list Parsed attributes.
 * @returns {object} Attribute values.
 */
function attributes(list) {
  const result = Object.create(null)
  for (const attr of list ?? []) result[string(attr.id).toLowerCase()] = string(attr.eq ?? '')
  return result
}

/**
 * Translate supported DOT node attributes into factor style overrides.
 * @param {object} attrs DOT node attributes.
 * @returns {object} Cytoscape style overrides.
 */
function nodeStyle(attrs) {
  const css = {}
  if (attrs.fillcolor) css['background-color'] = attrs.fillcolor
  if (attrs.color) css['border-color'] = attrs.color
  if (attrs.fontcolor) css.color = attrs.fontcolor
  const shapes = { box: 'rectangle', rect: 'rectangle', ellipse: 'ellipse', circle: 'ellipse' }
  if (shapes[attrs.shape]) css.shape = shapes[attrs.shape]
  if (attrs.shape === 'plaintext' || attrs.shape === 'plain') {
    css['background-opacity'] = 0
    css['border-width'] = 0
  }
  if (attrs.penwidth && Number.isFinite(Number(attrs.penwidth))) {
    css['border-width'] = Number(attrs.penwidth)
  }
  if (attrs.fontsize && Number.isFinite(Number(attrs.fontsize))) {
    css['font-size'] = Number(attrs.fontsize)
  }
  const style = attrs.style?.split(',').map((part) => part.trim())
  if (style?.includes('dashed')) css['border-style'] = 'dashed'
  else if (style?.includes('dotted')) css['border-style'] = 'dotted'
  return css
}

/**
 * Translate supported DOT edge attributes into link style overrides.
 * @param {object} attrs DOT edge attributes.
 * @returns {object} Cytoscape style overrides.
 */
function edgeStyle(attrs) {
  const css = {}
  if (attrs.color) {
    css['line-color'] = attrs.color
    css['target-arrow-color'] = attrs.color
  }
  if (attrs.penwidth && Number.isFinite(Number(attrs.penwidth))) css.width = Number(attrs.penwidth)
  if (attrs.style === 'dashed' || attrs.style === 'dotted') css['line-style'] = attrs.style
  return css
}

/**
 * Create a factor from a DOT node and its attributes.
 * @param {string} id Node ID.
 * @param {object} attrs DOT node attributes.
 * @param {number} index Position used when coordinates are absent.
 * @returns {object} Factor record.
 */
function makeNode(id, attrs, index) {
  const position = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:!)?$/.exec(attrs.pos ?? '')
  const node = {
    id,
    label: decodeLabel(attrs.label ?? id, id),
    x: position ? Number(position[1]) : (index % 10) * 100,
    y: position ? Number(position[2]) : Math.floor(index / 10) * 100,
    style: 'group0',
    overrides: nodeStyle(attrs),
  }
  if (attrs.prsm_note) node.note = { ops: [{ insert: `${decodeLabel(attrs.prsm_note, id)}\n` }] }
  return node
}

/**
 * Encode a value as a quoted DOT string.
 * @param {*} value Value to encode.
 * @returns {string} Quoted string.
 */
function quote(value) {
  const text = String(value ?? '')
  for (const char of text) {
    const code = char.codePointAt(0)
    if ((code < 32 && ![9, 10, 13].includes(code)) || (code >= 0xd800 && code <= 0xdfff)) {
      throw new Error('Text contains characters that cannot be exported to Graphviz')
    }
  }
  return `"${text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, '\\n')}"`
}

/**
 * Import Graphviz DOT data.
 * @param {string} input DOT document
 * @returns {{file: object, warnings: string[]}} parsed map and warnings
 */
export function readGraphviz(input) {
  const normalized = normaliseLegacyStrings(input)
  const graphs = parseDot(normalized.input)
  if (graphs.length !== 1) throw new Error('Graphviz file must contain one graph')
  const graph = graphs[0]
  if (normalized.operators.has(graph.type === 'graph' ? '->' : '--')) {
    throw new Error('Graphviz edge operator does not match the graph type')
  }
  const nodes = new Map()
  const edges = []
  const strictEdges = new Map()
  const allIds = new Set()
  /**
   * Register a DOT node, applying defaults on first encounter.
   * @param {object} node Parsed node identifier.
   * @param {object} defaults Default node attributes.
   * @param {Set<string>} members IDs in the current graph or subgraph.
   * @returns {string} Node ID.
   */
  function ensureNode(node, defaults, members) {
    if (node.type !== 'node_id') throw new Error('Invalid Graphviz node')
    const id = string(node.id).replace(/\\\\/g, '\\')
    if (!id) throw new Error('Empty Graphviz node ID')
    if (!nodes.has(id)) nodes.set(id, { ...defaults })
    members.add(id)
    allIds.add(id)
    return id
  }
  /**
   * Process graph statements, including nested subgraphs and edge groups.
   * @param {Array<object>} statements Parsed DOT statements.
   * @param {object} inherited Inherited node and edge defaults.
   * @param {Set<string>} members IDs in the current graph or subgraph.
   * @returns {void}
   */
  function visit(statements, inherited, members) {
    const defaults = { node: { ...inherited.node }, edge: { ...inherited.edge } }
    for (const stmt of statements) {
      if (stmt.type === 'attr_stmt') {
        const target = stmt.target.toLowerCase()
        if (target === 'node' || target === 'edge') {
          Object.assign(defaults[target], attributes(stmt.attr_list))
        }
      } else if (stmt.type === 'node_stmt') {
        const id = ensureNode(stmt.node_id, defaults.node, members)
        Object.assign(nodes.get(id), attributes(stmt.attr_list))
      } else if (stmt.type === 'subgraph') {
        visit(stmt.children, defaults, members)
      } else if (stmt.type === 'edge_stmt') {
        const groups = stmt.edge_list.map((item) => {
          if (item.type === 'node_id') return [ensureNode(item, defaults.node, members)]
          if (item.type !== 'subgraph') throw new Error('Unsupported Graphviz edge endpoint')
          const subset = new Set()
          visit(item.children, defaults, subset)
          for (const id of subset) members.add(id)
          return [...subset]
        })
        const explicit = attributes(stmt.attr_list)
        const attrs = { ...defaults.edge, ...explicit }
        for (let i = 1; i < groups.length; i++) {
          for (const source of groups[i - 1]) {
            for (const target of groups[i]) {
              const pair = graph.type === 'graph' ? [source, target].sort() : [source, target]
              const key = JSON.stringify(pair)
              if (graph.strict && strictEdges.has(key)) {
                Object.assign(strictEdges.get(key).attrs, explicit)
              } else {
                const edge = { source, target, attrs: { ...attrs } }
                edges.push(edge)
                if (graph.strict) strictEdges.set(key, edge)
              }
            }
          }
        }
      } else throw new Error(`Unsupported Graphviz statement: ${stmt.type}`)
    }
  }
  visit(graph.children, { node: {}, edge: {} }, new Set())
  const file = legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file
  for (const [id, attrs] of nodes) file.nodes.push(makeNode(id, attrs, file.nodes.length))
  for (const item of edges) {
    let id = item.attrs.prsm_id
    if (!id || allIds.has(id)) id = crypto.randomUUID()
    allIds.add(id)
    const edge = {
      id,
      source: item.source,
      target: item.target,
      label: decodeLabel(item.attrs.label ?? '', ''),
      style: 'edge0',
      overrides: edgeStyle(item.attrs),
    }
    if (item.attrs.prsm_note) {
      edge.note = { ops: [{ insert: `${decodeLabel(item.attrs.prsm_note, '')}\n` }] }
    }
    file.edges.push(edge)
  }
  const warnings = [
    'Only basic Graphviz data and styling are imported; other properties may be omitted',
  ]
  if (graph.type === 'graph') warnings.push('Undirected links were imported as directed')
  if (normalized.changed) {
    warnings.push('Legacy multiline strings or unquoted colours were converted')
  }
  return { file, warnings }
}

/**
 * Export a map in Graphviz DOT format.
 * @param {import('../graph/store.js').MapStore} store map to export
 * @returns {string} DOT document
 */
export function writeGraphviz(store) {
  const nodes = [...store.nodes.entries()].filter(([, node]) => !node.cluster)
  const ids = new Set(nodes.map(([id]) => id))
  const output = ['digraph {']
  for (const [id, node] of nodes) {
    if ([...id].some((char) => char.codePointAt(0) < 32)) {
      throw new Error('Factor IDs containing control characters cannot be exported to Graphviz')
    }
    const fill = resolve(store, 'node', node, 'background-color')
    const border = resolve(store, 'node', node, 'border-color')
    const pos = `${Number.isFinite(node.x) ? node.x : 0},${Number.isFinite(node.y) ? node.y : 0}!`
    output.push(
      `  ${quote(id)} [label=${quote(node.label)}, pos=${quote(pos)}, prsm_note=${quote(noteText(node.note))}${fill ? `, fillcolor=${quote(fill)}, style="filled"` : ''}${border ? `, color=${quote(border)}` : ''}];`
    )
  }
  for (const [id, edge] of store.edges.entries()) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    const color = resolve(store, 'edge', edge, 'line-color')
    output.push(
      `  ${quote(edge.source)} -> ${quote(edge.target)} [label=${quote(edge.label)}, prsm_id=${quote(id)}, prsm_note=${quote(noteText(edge.note))}${color ? `, color=${quote(color)}` : ''}];`
    )
  }
  output.push('}')
  return output.join('\n')
}
