import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MapStore } from '../../src/graph/store.js'
import { notesDelta, exportNotes } from '../../src/app/notes-export.js'

function sample() {
  const store = new MapStore()
  store.meta.set('title', 'Example map')
  store.meta.set('description', { text: { ops: [{ insert: 'Description\n' }] } })
  store.nodes.set('b', { label: 'Beta', note: 'Second note', style: 'group0' })
  store.nodes.set('a', {
    label: 'Alpha\nfactor',
    note: {
      ops: [
        { insert: 'Bold\ntext', attributes: { bold: true } },
        { insert: '\n', attributes: { list: 'bullet' } },
      ],
    },
    style: 'group0',
  })
  store.nodes.set('c', { label: 'Cluster', cluster: true })
  store.edges.set('ab', { source: 'a', target: 'b', label: 'Link' })
  return store
}

test('assembles description, sorted factors and links with formatted and missing notes', () => {
  const store = sample()
  const { delta, warnings } = notesDelta(store)
  const text = delta.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('')
  assert.match(text, /^Example map\nDescription of the map\nDescription\n/)
  assert.ok(text.indexOf('Factor: Alpha factor') < text.indexOf('Factor: Beta'))
  assert.match(text, /Link from 'Alpha factor' to 'Beta'\n\[No note\]\n/)
  assert.doesNotMatch(text, /Factor: Cluster/)
  assert.deepEqual(delta.ops.find((op) => op.insert === 'text').attributes, { bold: true })
  assert.deepEqual(delta.ops.find((op) => op.attributes?.list).attributes, { list: 'bullet' })
  assert.deepEqual(warnings, [])
  store.doc.destroy()
})

test('warns about external and non-PNG images without fetching them', () => {
  const store = sample()
  store.nodes.set('img', {
    label: 'Image',
    note: { ops: [{ insert: { image: 'https://example.invalid/image.jpg' } }, { insert: '\n' }] },
  })
  const { delta, warnings } = notesDelta(store)
  assert.match(warnings.join(' '), /omitted/)
  assert.ok(delta.ops.some((op) => op.insert === '[Image omitted]\n'))
  store.doc.destroy()
})

test('generates a real DOCX archive with embedded PNGs', async () => {
  globalThis.self = globalThis
  const store = sample()
  store.nodes.set('img', {
    label: 'Picture',
    note: {
      ops: [
        {
          insert: {
            image:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Y9sAAAAASUVORK5CYII=',
          },
        },
        { insert: '\n' },
      ],
    },
  })
  const { blob, warnings } = await exportNotes(store)
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.ok(blob.size > 1000)
  assert.equal(new DataView(await blob.slice(0, 4).arrayBuffer()).getUint32(0), 0x504b0304)
  assert.deepEqual(warnings, [])
  store.doc.destroy()
})
