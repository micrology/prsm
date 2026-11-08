function heading(ops, text, level) {
  ops.push({ insert: text }, { insert: '\n', attributes: { header: level } })
}

function appendText(ops, operation) {
  const parts = operation.insert.split(/(\n)/)
  for (const part of parts) {
    if (!part) continue
    ops.push(
      operation.attributes ? { insert: part, attributes: operation.attributes } : { insert: part }
    )
  }
}

function appendNote(ops, note, warnings) {
  if (note?.text !== undefined) note = note.text
  if (typeof note === 'string') note = { ops: [{ insert: note }] }
  if (!note) {
    ops.push({ insert: '[No note]\n' })
    return
  }
  if (!Array.isArray(note.ops)) throw new Error('A note has an invalid format')
  const start = ops.length
  for (const operation of note.ops) {
    if (typeof operation.insert === 'string') appendText(ops, operation)
    else if (operation.insert?.image && typeof operation.insert.image === 'string') {
      if (/^data:image\/png;base64,/i.test(operation.insert.image)) ops.push(operation)
      else {
        ops.push({ insert: '[Image omitted]\n' })
        warnings.add('Images other than embedded PNGs were omitted')
      }
    } else throw new Error('A note contains an unsupported embedded item')
  }
  if (ops.length === start) {
    ops.push({ insert: '[No note]\n' })
    return
  }
  const last = ops.at(-1).insert
  if (typeof last !== 'string' || !last.endsWith('\n')) ops.push({ insert: '\n' })
}

const label = (value) => String(value ?? '').replace(/\s*\n\s*/g, ' ')

/**
 * Assemble the map and its factor and link notes into a Quill document.
 * @param {import('../../cy/store.js').MapStore} store map to export
 * @returns {{delta: {ops: object[]}, warnings: string[]}} document and export warnings
 */
export function notesDelta(store) {
  const ops = []
  const warnings = new Set()
  const title = store.meta.get('title')?.trim() || 'Untitled map'
  heading(ops, label(title), 1)
  const description = store.meta.get('description')
  if (description && description.text !== null) {
    heading(ops, 'Description of the map', 2)
    appendNote(ops, description, warnings)
  }
  const nodes = [...store.nodes.entries()].filter(([, node]) => !node.cluster)
  nodes.sort((a, b) => label(a[1].label).localeCompare(label(b[1].label)))
  for (const [id, node] of nodes) {
    heading(ops, `Factor: ${label(node.label || id)}`, 2)
    appendNote(ops, node.note, warnings)
  }
  for (const [, edge] of store.edges.entries()) {
    const source = store.nodes.get(edge.source)
    const target = store.nodes.get(edge.target)
    if (!source || !target || source.cluster || target.cluster) {
      warnings.add('Links without two ordinary factors were omitted')
      continue
    }
    heading(
      ops,
      `Link from '${label(source.label || edge.source)}' to '${label(target.label || edge.target)}'`,
      2
    )
    appendNote(ops, edge.note, warnings)
  }
  return { delta: { ops }, warnings: [...warnings] }
}

/**
 * Generate a Word document containing the map's notes.
 * @param {import('../../cy/store.js').MapStore} store map to export
 * @returns {Promise<{blob: Blob, warnings: string[]}>} document and warnings
 */
export async function exportNotes(store) {
  const { delta, warnings } = notesDelta(store)
  const converter = await import('quill-to-word')
  const { generateWord } = converter.default ?? converter
  const blob = await generateWord(delta, {
    exportAs: 'blob',
    paragraphStyles: { normal: { paragraph: { spacing: { line: 240 } } } },
  })
  if (!(blob instanceof Blob) || !blob.size) throw new Error('Could not generate the Word document')
  return { blob, warnings }
}
