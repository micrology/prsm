import test from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { MapStore } from './store.js'
import { generateRoom, roomFromUrl } from '../js/app/room.js'

test('generated rooms use the conventional format without rejecting supplied room names', () => {
  for (let i = 0; i < 1000; i++) {
    assert.match(generateRoom(), /^[A-Z]{3}(?:-[A-Z]{3}){3}$/)
  }
  assert.equal(roomFromUrl(new URL('https://example.test/?room=custom-123')), 'CUSTOM-123')
})

test('view-only stores reject local edits while accepting remote updates', () => {
  const source = new MapStore()
  source.loadFile({
    meta: { viewOnly: true },
    nodes: [{ id: 'a', label: 'Original' }],
    edges: [],
    styles: { group0: { kind: 'node', css: {} } },
  })
  assert.throws(() => source.update('nodes', 'a', { label: 'Changed' }), /read-only/)
  assert.throws(() => source.loadFile(source.toFile()), /read-only/)
  assert.throws(() => source.undo(), /read-only/)
  assert.throws(() => source.redo(), /read-only/)
  const remote = new Y.Doc()
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(source.doc))
  remote.getMap('nodes').set('a', { label: 'Remote change' })
  Y.applyUpdate(source.doc, Y.encodeStateAsUpdate(remote))
  assert.equal(source.nodes.get('a').label, 'Remote change')
  source.doc.destroy()
  remote.destroy()
})
