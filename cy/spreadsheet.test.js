import { test } from 'node:test'
import assert from 'node:assert/strict'
import { utils, write } from 'xlsx'
import { MapStore } from './store.js'
import { readCSV, readSpreadsheet, writeSpreadsheet } from '../js/app/spreadsheet.js'

function workbook(factors, links) {
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.json_to_sheet(factors), 'Factors')
  utils.book_append_sheet(book, utils.json_to_sheet(links), 'Links')
  return write(book, { type: 'array', bookType: 'xlsx' })
}

test('imports labels, styles, coordinates, notes and attributes from Excel', () => {
  const data = workbook(
    [{ Label: 'One', Style: 2, X: 0, Y: 42, Note: 'Hello', Priority: 'High' }, { Label: 'Two' }],
    [{ From: 'One', To: 'Two', Style: 3, Note: 'Link' }]
  )
  const { file } = readSpreadsheet(data)
  assert.equal(file.nodes[0].x, 0)
  assert.equal(file.nodes[0].style, 'group1')
  assert.equal(file.nodes[0].att1, 'High')
  assert.equal(file.meta.attributeTitles.att1, 'Priority')
  assert.equal(file.edges[0].source, file.nodes[0].id)
  assert.equal(file.edges[0].style, 'edge2')
  assert.equal(file.nodes[0].note.ops[0].insert, 'Hello\n')
})

test('export and reimport preserves duplicate labels and link endpoints', () => {
  const store = new MapStore()
  store.nodes.set('a', { label: 'Same', style: 'group0', x: 0, y: 1 })
  store.nodes.set('b', { label: 'Same', style: 'group1', x: 2, y: 3 })
  store.edges.set('link', { source: 'a', target: 'b', style: 'edge0' })
  const { file } = readSpreadsheet(writeSpreadsheet(store))
  assert.equal(file.nodes.length, 2)
  assert.equal(file.edges[0].source, 'a')
  assert.equal(file.edges[0].target, 'b')
  store.doc.destroy()
})

test('rejects missing and ambiguous endpoints before importing', () => {
  assert.throws(
    () => readSpreadsheet(workbook([{ Label: 'A' }], [{ From: 'A', To: 'B' }])),
    /not found|missing or ambiguous/
  )
  assert.throws(
    () => readSpreadsheet(workbook([{ Label: 'A' }, { Label: 'A' }], [{ From: 'A', To: 'A' }])),
    /ambiguous/
  )
})

test('CSV imports quoted commas and style numbers', () => {
  const { file } = readCSV('From,To,From style,To style,Link style\n"A, B",C,2,3,4\nC,D,,1,1')
  assert.equal(file.nodes.length, 3)
  assert.equal(file.nodes[0].label, 'A, B')
  assert.equal(file.nodes[0].style, 'group1')
  assert.equal(file.edges[0].style, 'edge3')
  assert.equal(file.edges[1].source, file.nodes[1].id)
  assert.throws(() => readCSV('From,To\nA,'), /endpoints/)
})
