/* ****************************************************************************************
tablemodel.js: the pure part of the table view: how a cell is shown as text, and how rows are
sorted, filtered and totalled. Rows are {id, rec, stats}; columns come from columns.js.
**************************************************************************************** */
import { hueOf } from './columns.js'

const EM_DASH = '—'

/**
 * @param {object} col column
 * @param {object} row
 * @returns {*} the value of the cell, as used for sorting and totals
 */
export function cellValue(col, row) {
  return col.get ? col.get(row) : null
}

/**
 * @param {object} col
 * @param {object} row
 * @returns {string} the text shown in the cell (also used for filtering and copying)
 */
export function displayValue(col, row) {
  const v = cellValue(col, row)
  if (v === null || v === undefined || v === '') {
    return col.type === 'text' || col.type === 'note' ? '' : EM_DASH
  }
  if (col.type === 'bool') return v ? 'Yes' : 'No'
  if (col.type === 'date') {
    return new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
  }
  if (col.type === 'number') return Number.isInteger(v) ? String(v) : Number(v).toPrecision(3)
  return String(v)
}

/**
 * @param {object} col
 * @param {object} row
 * @returns {number|string|null} a value to sort on; null for empty cells
 */
function sortKey(col, row, selected) {
  if (col.type === 'select-row') return selected.has(row.id) ? 1 : 0
  const v = cellValue(col, row)
  if (v === null || v === undefined || v === '') return null
  if (col.type === 'color') return hueOf(v)
  if (col.type === 'bool') return v ? 1 : 0
  return v
}

/**
 * @param {Array<object>} rows
 * @param {object} col column to sort on
 * @param {1|-1} dir 1 for ascending
 * @param {Set<string>} selected ids of selected rows
 * @returns {Array<object>} a sorted copy; empty cells come last in either direction
 */
export function sortRows(rows, col, dir, selected = new Set()) {
  const keyed = rows.map((row) => ({ row, key: sortKey(col, row, selected) }))
  keyed.sort((a, b) => {
    if (a.key === null || b.key === null) return (a.key === null) - (b.key === null)
    const c =
      typeof a.key === 'number' && typeof b.key === 'number'
        ? a.key - b.key
        : String(a.key).localeCompare(String(b.key), undefined, {
            numeric: true,
            sensitivity: 'base',
          })
    return c * dir
  })
  return keyed.map((k) => k.row)
}

export const FILTER_OPS = [
  ['like', 'contains'],
  ['=', 'matches'],
  ['starts', 'starts with'],
  ['ends', 'ends with'],
  ['<', '<'],
  ['<=', '<='],
  ['>', '>'],
  ['>=', '>='],
  ['!=', '!='],
]

/**
 * @param {string} text cell text
 * @param {string} op one of FILTER_OPS
 * @param {string} value what the user typed
 * @returns {boolean}
 */
export function passes(text, op, value) {
  const a = text.toLowerCase()
  const b = value.toLowerCase()
  const na = parseFloat(text)
  const nb = parseFloat(value)
  const numeric = !isNaN(na) && !isNaN(nb)
  switch (op) {
    case 'like':
      return a.includes(b)
    case '=':
      return numeric ? na === nb : a === b
    case '!=':
      return numeric ? na !== nb : a !== b
    case 'starts':
      return a.startsWith(b)
    case 'ends':
      return a.endsWith(b)
    default:
      return compare(op, numeric ? na - nb : a.localeCompare(b))
  }
}

/**
 * @param {string} op <, <=, > or >=
 * @param {number} diff negative, zero or positive
 * @returns {boolean}
 */
function compare(op, diff) {
  if (op === '<') return diff < 0
  if (op === '<=') return diff <= 0
  if (op === '>') return diff > 0
  return diff >= 0
}

/**
 * @param {Array<object>} rows
 * @param {object} col column to test
 * @param {string} op
 * @param {string} value
 * @returns {Array<object>} the rows that pass the filter (all of them if value is empty)
 */
export function filterRows(rows, col, op, value) {
  if (!col || value === '') return rows
  return rows.filter((row) => passes(displayValue(col, row), op, value))
}

/**
 * @param {object} col column with an `aggregate` property
 * @param {Array<object>} rows
 * @returns {string} the footer text for the column, or '' if it has no total
 */
export function footerValue(col, rows) {
  const values = rows.map((r) => cellValue(col, r))
  const nums = values.filter((v) => typeof v === 'number')
  switch (col.aggregate) {
    case 'count':
      return `Count: ${rows.length}`
    case 'countTrue':
      return `Count: ${values.filter(Boolean).length}`
    case 'mean':
      return nums.length
        ? `Mean: ${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}`
        : ''
    case 'max':
      return nums.length ? `Max: ${Math.max(...nums).toPrecision(3)}` : ''
    default:
      return ''
  }
}
