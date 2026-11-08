import { read, utils, write } from 'xlsx'
import { legacyToV2, normaliseLegacy } from '../../cy/legacy.js'
import { noteText } from '../../cy/columns.js'

const FACTOR_FIELDS = new Set(['id', 'label', 'note', 'description', 'style', 'x', 'y'])
const LINK_FIELDS = new Set([
  'id',
  'from',
  'to',
  'sourceid',
  'targetid',
  'label',
  'note',
  'description',
  'style',
])

function rows(sheet, headings) {
  const headers = utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })[0] ?? []
  const seen = new Set()
  for (const header of headers) {
    const name = String(header).trim().toLowerCase()
    if (!name) continue
    if (seen.has(name)) throw new Error(`Duplicate spreadsheet column: ${header}`)
    seen.add(name)
  }
  return utils.sheet_to_json(sheet, { defval: '' }).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const name = key.trim()
        const normalized = name.toLowerCase()
        headings[normalized] ??= name
        return [normalized, value]
      })
    )
  )
}

function styleId(value, kind) {
  if (value === '' || value == null) return kind === 'node' ? 'group0' : 'edge0'
  const number = Number(value)
  const max = 15
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`Style must be a number from 1 to ${max}`)
  }
  return `${kind === 'node' ? 'group' : 'edge'}${number - 1}`
}

function coordinate(value, fallback) {
  if (value === '' || value == null) return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`Invalid coordinate: ${value}`)
  return number
}

function attributes(row, excluded, titles, headings) {
  const result = {}
  for (const [name, value] of Object.entries(row)) {
    if (excluded.has(name)) continue
    let field = Object.keys(titles).find((key) => titles[key].toLowerCase() === name)
    if (!field) {
      field = `att${Object.keys(titles).length + 1}`
      titles[field] = headings[name]
    }
    if (value !== '') result[field] = value
  }
  return result
}

function note(value) {
  return value === '' || value == null ? undefined : { ops: [{ insert: `${value}\n` }] }
}

/**
 * Import a CSV edge list with From, To and optional factor and link style numbers.
 * @param {string} text CSV contents, including a header row
 * @returns {{file: object, warnings: string[]}} native map
 */
export function readCSV(text) {
  const book = read(text, { type: 'string', raw: true })
  const records = utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  })
  if (!records.length || records[0].length < 2) {
    throw new Error('CSV must have at least two columns')
  }
  const file = legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file
  const nodes = new Map()
  function getNode(value, style) {
    const label = String(value).trim()
    if (!label) throw new Error('CSV link endpoints must not be empty')
    if (nodes.has(label)) {
      if (style !== '' && nodes.get(label).style !== styleId(style, 'node')) {
        throw new Error(`Factor "${label}" has conflicting styles in the CSV`)
      }
      return nodes.get(label)
    }
    const index = nodes.size
    const rec = {
      id: crypto.randomUUID(),
      label,
      style: styleId(style, 'node'),
      x: (index % 10) * 100,
      y: Math.floor(index / 10) * 100,
    }
    nodes.set(label, rec)
    file.nodes.push(rec)
    return rec
  }
  for (const [source, target, fromStyle = '', toStyle = '', edgeStyle = ''] of records.slice(1)) {
    if ([source, target].every((value) => value === '' || value == null)) continue
    const from = getNode(source ?? '', fromStyle)
    const to = getNode(target ?? '', toStyle)
    file.edges.push({
      id: crypto.randomUUID(),
      source: from.id,
      target: to.id,
      style: styleId(edgeStyle, 'edge'),
    })
  }
  return { file, warnings: [] }
}

/**
 * Import an Excel workbook with Factors and Links sheets.
 * @param {ArrayBuffer|Uint8Array} data workbook bytes
 * @returns {{file: object, warnings: string[]}} native map
 */
export function readSpreadsheet(data) {
  const book = read(data, { type: 'array' })
  if (!book.Sheets.Factors || !book.Sheets.Links) {
    throw new Error('The workbook must contain Factors and Links sheets')
  }
  for (const [sheet, required] of [
    ['Factors', ['label']],
    ['Links', ['from', 'to']],
  ]) {
    const header = utils.sheet_to_json(book.Sheets[sheet], { header: 1, defval: '' })[0] ?? []
    const names = header.map((name) => String(name).trim().toLowerCase())
    if (required.some((name) => !names.includes(name))) {
      throw new Error(`${sheet} sheet must have ${required.join(' and ')} columns`)
    }
  }
  const file = legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file
  const titles = {}
  const headings = {}
  const byLabel = new Map()
  const byId = new Map()
  for (const [index, row] of rows(book.Sheets.Factors, headings).entries()) {
    const label = String(row.label ?? '').trim()
    if (!label) throw new Error(`Factors row ${index + 2}: Label is required`)
    const id = String(row.id || crypto.randomUUID())
    if (byId.has(id)) throw new Error(`Factors row ${index + 2}: duplicate ID`)
    const rec = {
      id,
      label,
      style: styleId(row.style, 'node'),
      x: coordinate(row.x, (index % 10) * 100),
      y: coordinate(row.y, Math.floor(index / 10) * 100),
      ...attributes(row, FACTOR_FIELDS, titles, headings),
    }
    const text = note(row.description || row.note)
    if (text) rec.note = text
    file.nodes.push(rec)
    byId.set(id, rec)
    if (!byLabel.has(label)) byLabel.set(label, [])
    byLabel.get(label).push(id)
  }
  const resolve = (id, label, rowNumber) => {
    if (id) {
      if (!byId.has(String(id))) throw new Error(`Links row ${rowNumber}: factor ID not found`)
      return String(id)
    }
    const matches = byLabel.get(String(label ?? '').trim()) ?? []
    if (matches.length !== 1) {
      throw new Error(`Links row ${rowNumber}: factor label is missing or ambiguous`)
    }
    return matches[0]
  }
  const edgeIds = new Set()
  for (const [index, row] of rows(book.Sheets.Links, headings).entries()) {
    const id = String(row.id || crypto.randomUUID())
    if (edgeIds.has(id) || byId.has(id)) throw new Error(`Links row ${index + 2}: duplicate ID`)
    edgeIds.add(id)
    const rec = {
      id,
      source: resolve(row.sourceid, row.from, index + 2),
      target: resolve(row.targetid, row.to, index + 2),
      label: String(row.label || ''),
      style: styleId(row.style, 'edge'),
      ...attributes(row, LINK_FIELDS, titles, headings),
    }
    const text = note(row.description || row.note)
    if (text) rec.note = text
    file.edges.push(rec)
  }
  file.meta.attributeTitles = titles
  return { file, warnings: [] }
}

function styleNumber(id, prefix) {
  const match = new RegExp(`^${prefix}(\\d+)$`).exec(id ?? '')
  const number = match ? Number(match[1]) + 1 : 0
  return number >= 1 && number <= 15 ? number : ''
}

function exportedAttributes(record, titles) {
  return Object.fromEntries(
    Object.entries(titles)
      .filter(([id, title]) => title !== '*deleted*' && record[id] !== undefined)
      .map(([id, title]) => [title, record[id]])
  )
}

/**
 * Export a map to a workbook. Spreadsheet notes are plain text.
 * @param {import('../../cy/store.js').MapStore} store map to export
 * @returns {Uint8Array} XLSX bytes
 */
export function writeSpreadsheet(store) {
  const titles = store.attributeTitles()
  const reserved = new Set([...FACTOR_FIELDS, ...LINK_FIELDS])
  const names = new Set()
  for (const title of Object.values(titles)) {
    if (title === '*deleted*') continue
    const name = String(title).trim().toLowerCase()
    if (!name || reserved.has(name) || names.has(name)) {
      throw new Error(`Attribute title "${title}" conflicts with another spreadsheet column`)
    }
    names.add(name)
  }
  const nodes = [...store.nodes.entries()].filter(([, node]) => !node.cluster)
  if (nodes.some(([, node]) => !String(node.label ?? '').trim())) {
    throw new Error('All factors need labels before exporting to Excel')
  }
  const labels = new Map(nodes.map(([id, node]) => [id, node.label ?? '']))
  const factors = nodes.map(([id, node]) => ({
    ID: id,
    Label: node.label ?? '',
    Note: noteText(node.note),
    Style: styleNumber(node.style, 'group'),
    X: node.x ?? 0,
    Y: node.y ?? 0,
    ...exportedAttributes(node, titles),
  }))
  const links = [...store.edges.entries()]
    .filter(([, edge]) => labels.has(edge.source) && labels.has(edge.target))
    .map(([id, edge]) => ({
      ID: id,
      From: labels.get(edge.source),
      To: labels.get(edge.target),
      SourceID: edge.source,
      TargetID: edge.target,
      Label: edge.label ?? '',
      Note: noteText(edge.note),
      Style: styleNumber(edge.style, 'edge'),
      ...exportedAttributes(edge, titles),
    }))
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.json_to_sheet(factors, { header: ['ID', 'Label', 'Note', 'Style', 'X', 'Y'] }),
    'Factors'
  )
  utils.book_append_sheet(
    book,
    utils.json_to_sheet(links, {
      header: ['ID', 'From', 'To', 'SourceID', 'TargetID', 'Label', 'Note', 'Style'],
    }),
    'Links'
  )
  return write(book, { type: 'array', bookType: 'xlsx' })
}
