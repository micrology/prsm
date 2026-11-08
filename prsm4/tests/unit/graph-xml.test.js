import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { XMLValidator } from 'fast-xml-parser'
import { MapStore } from '../../src/graph/store.js'
import { readGraphXml, writeGraphXml } from '../../src/app/graph-xml.js'

for (const [file, format, nodes, edges] of [
  ['data/karate.graphml', 'graphml', 34, 78],
  ['data/random10a.gexf', 'gexf', 10, 39],
  ['data/eurosis.graphml', 'graphml', 1285, 7524],
  ['data/airports.gexf', 'gexf', 235, 1297],
]) {
  test(
    `imports ${file}`,
    { skip: !existsSync(file) && 'Optional local sample corpus is not installed' },
    () => {
      const parsed = readGraphXml(readFileSync(file, 'utf8'), format)
      assert.equal(parsed.file.nodes.length, nodes)
      assert.equal(parsed.file.edges.length, edges)
      assert.ok(
        parsed.file.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
      )
    }
  )
}

for (const format of ['graphml', 'gexf']) {
  test(`${format} round trips labels, links, notes, attributes and coordinates`, () => {
    const store = new MapStore()
    store.meta.set('attributeTitles', { att1: 'Priority', att2: 'label', att3: 'Priority' })
    store.nodes.set('a&1', {
      label: 'First <one>',
      x: 0,
      y: -2,
      style: 'group0',
      att1: 'A & B',
      att2: 'custom label',
      att3: 'other value',
      note: { ops: [{ insert: 'Node note\nsecond line 🗺️\n' }] },
    })
    store.nodes.set('b', { label: 'Second "two"', x: 4, y: 5, style: 'group0' })
    store.edges.set('ab', {
      source: 'a&1',
      target: 'b',
      label: 'A > B',
      style: 'edge0',
      note: { ops: [{ insert: 'Link note\n' }] },
    })
    const xml = writeGraphXml(store, format)
    assert.equal(XMLValidator.validate(xml), true)
    const { file } = readGraphXml(xml, format)
    assert.equal(file.nodes[0].label, 'First <one>')
    assert.equal(file.nodes[0].x, 0)
    assert.equal(file.nodes[0].y, -2)
    assert.equal(file.nodes[0].att1, 'A & B')
    assert.deepEqual(Object.values(file.meta.attributeTitles), ['Priority', 'label', 'Priority'])
    assert.equal(file.nodes[0].att2, 'custom label')
    assert.equal(file.nodes[0].att3, 'other value')
    assert.equal(file.nodes[0].note.ops[0].insert, 'Node note\nsecond line 🗺️\n')
    assert.equal(file.edges[0].source, 'a&1')
    assert.equal(file.edges[0].label, 'A > B')
    assert.equal(file.edges[0].note.ops[0].insert, 'Link note\n')
    store.doc.destroy()
  })
}

test('handles empty values and rejects references to an edge as a node', () => {
  const { file, warnings } = readGraphXml(
    `<graphml><key id="k" for="node" attr.name="Empty"/>
      <graph edgedefault="directed"><node id="a"><data key="k"/></node><node id="b"/>
      <edge id="e" source="a" target="b"/><edge source="e" target="a"/></graph></graphml>`,
    'graphml'
  )
  assert.equal(file.edges.length, 1)
  assert.equal(Object.values(file.nodes[0]).includes('[object Object]'), false)
  assert.match(warnings.join(' '), /1 links with missing endpoints/)
})

test('imports numeric character references, case-sensitive attributes and mixed edge direction', () => {
  const { file, warnings } = readGraphXml(
    `<graphml><key id="k" attr.name="My Title"/><graph edgedefault="directed">
      <node id="a"><data key="k">A&#10;B&#x26;C</data></node>
      <node id="b"/><edge id="ab" source="a" target="b" directed="false"/></graph></graphml>`,
    'graphml'
  )
  assert.equal(file.meta.attributeTitles.att1, 'My Title')
  assert.equal(file.nodes[0].att1, 'A\nB&C')
  assert.match(warnings.join(' '), /Undirected links/)
})

test('rejects nested graphs, invalid XML characters and unknown formats', () => {
  assert.throws(
    () => readGraphXml('<graphml><graph><node id="a"><graph/></node></graph></graphml>', 'graphml'),
    /Nested/
  )
  assert.throws(() => readGraphXml('<graphml/>', 'unknown'), /Unsupported/)
  const store = new MapStore()
  store.nodes.set('a', { label: 'invalid\u0001', style: 'group0' })
  assert.throws(() => writeGraphXml(store, 'graphml'), /cannot be represented/)
  store.doc.destroy()
})

test('rejects ambiguous repeated values rather than overwriting them', () => {
  assert.throws(
    () =>
      readGraphXml(
        '<graphml><key id="k1" attr.name="Title"/><key id="k2" attr.name="Title"/><graph><node id="a"><data key="k1">one</data><data key="k2">two</data></node></graph></graphml>',
        'graphml'
      ),
    /Ambiguous repeated attribute/
  )
})

test('rejects malformed or wrong XML, warns when dropping dangling links', () => {
  assert.equal(readGraphXml('<graphml><graph/></graphml>', 'graphml').file.nodes.length, 0)
  assert.equal(readGraphXml('<gexf><graph/></gexf>', 'gexf').file.nodes.length, 0)
  assert.throws(() => readGraphXml('<graphml><graph></graphml>', 'graphml'), /Invalid XML/)
  assert.throws(() => readGraphXml('<gexf/>', 'graphml'), /Not a GRAPHML/)
  assert.throws(() => readGraphXml('<!DOCTYPE graphml><graphml/>', 'graphml'), /document types/)
  const { warnings } = readGraphXml(
    '<graphml><graph><node id="a"/><edge source="a" target="b"/></graph></graphml>',
    'graphml'
  )
  assert.match(warnings.join(' '), /1 links with missing endpoints/)
})
