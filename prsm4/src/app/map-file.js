/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Reads and writes native PRSM map files.
********************************************************************************************/

import lzString from 'lz-string'
import { legacyToV2, normaliseLegacy, parseMapText } from '../graph/legacy.js'

/**
 * Check whether a value is a non-array object.
 * @param {*} value Value to check.
 * @returns {boolean} Whether the value is an object.
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reject invalid map records before a file can replace the current map.
 * @param {object} file Parsed native map.
 * @returns {void}
 * @throws {Error} If required metadata, records, styles or history are invalid.
 */
function validateFile(file) {
  if (!isObject(file.meta) || !isObject(file.styles)) {
    throw new Error('Invalid map metadata or styles')
  }
  if (!Array.isArray(file.nodes) || !Array.isArray(file.edges)) {
    throw new Error('A map must contain factors and links')
  }
  if (file.meta.title != null && typeof file.meta.title !== 'string') {
    throw new Error('Invalid map title')
  }
  if (file.meta.settings != null && !isObject(file.meta.settings)) {
    throw new Error('Invalid map settings')
  }
  const ids = new Set()
  for (const node of file.nodes) {
    if (!isObject(node) || typeof node.id !== 'string' || !node.id || ids.has(node.id)) {
      throw new Error('Invalid or duplicate factor ID')
    }
    ids.add(node.id)
  }
  const edgeIds = new Set()
  for (const edge of file.edges) {
    if (
      !isObject(edge) ||
      typeof edge.id !== 'string' ||
      !edge.id ||
      edgeIds.has(edge.id) ||
      ids.has(edge.id) ||
      !ids.has(edge.source) ||
      !ids.has(edge.target)
    ) {
      throw new Error('Invalid link ID or missing endpoint')
    }
    edgeIds.add(edge.id)
  }
  for (const style of Object.values(file.styles)) {
    if (!isObject(style) || !['node', 'edge'].includes(style.kind) || !isObject(style.css)) {
      throw new Error('Invalid map style')
    }
  }
  if (
    file.history !== undefined &&
    (!Array.isArray(file.history) ||
      file.history.some(
        (entry) =>
          !isObject(entry) ||
          !Number.isFinite(entry.time) ||
          typeof entry.user !== 'string' ||
          typeof entry.action !== 'string'
      ))
  ) {
    throw new Error('Invalid map history')
  }
}

/**
 * Read a native or legacy PRSM file without modifying the current map.
 * @param {string} text file contents
 * @returns {{file: object, warnings: string[]}} validated map and conversion warnings
 */
export function readMapFile(text) {
  const parsed = parseMapText(text.trimStart().startsWith('{') ? text.trimStart() : text)
  if (!isObject(parsed)) throw new Error('Not a valid PRSM map')
  let file = parsed
  const warnings = []
  if (parsed.format === undefined) {
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      throw new Error('Not a valid PRSM map: factors or links are missing')
    }
    const originalBackground = parsed.background
    const converted = legacyToV2(normaliseLegacy(parsed))
    warnings.push(...converted.report.warnings)
    if (!converted.file) throw new Error(warnings.join('; ') || 'Cannot convert this map')
    file = converted.file
    if (converted.report.droppedEdges) {
      warnings.push(`${converted.report.droppedEdges} links with missing endpoints were omitted`)
    }
    if (originalBackground && !file.background) file.meta.legacyBackground = originalBackground
    if (parsed.underlay?.length) file.meta.legacyUnderlay = parsed.underlay
  } else if (!['prsm', 'prsm2'].includes(parsed.format) || parsed.schemaVersion !== 2) {
    throw new Error('Unsupported PRSM file format or schema version')
  }
  validateFile(file)
  if (isObject(file.background) && Object.keys(file.background).length) {
    file.meta.legacyBackground ??= file.background
  }
  if (file.meta.legacyBackground || file.meta.legacyUnderlay) {
    warnings.push('The legacy background is preserved but is not yet displayed')
  }
  return { file, warnings }
}

/**
 * Serialize a map and its shared history as a compressed PRSM file.
 * @param {import('../graph/store.js').MapStore} store Map to save.
 * @returns {string} compressed file contents
 */
export function writeMapFile(store) {
  const file = store.toFile()
  file.history = store.history.toArray().map(({ state, ...entry }) => entry)
  return lzString.compressToUTF16(JSON.stringify(file))
}
