// Run in the browser test bed with ?placement-tests.

/**
 * Check the factor placement dialog against the real browser DOM.
 * @param {object} view Test-bed graph, store and editor.
 * @returns {Promise<void>}
 */
export async function runPlacementTests({ cy, store, editor }) {
  const presence = []
  const messages = []
  editor.options.onAddingFactor = (pos) => presence.push(pos)
  editor.options.onMessage = (message) => messages.push(message)
  const start = () => {
    editor.setMode('addNode')
    editor.onTap({
      target: cy,
      position: { x: 25, y: 35 },
      renderedPosition: { x: 25, y: 35 },
    })
    return document.querySelector('.factor-placement-editor')
  }
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const closed = (dialog) =>
    new Promise((resolve) => dialog.addEventListener('close', resolve, { once: true }))

  let dialog = start()
  const input = dialog.querySelector('textarea')
  input.value = '   '
  dialog.querySelector('[type=submit]').click()
  assert(dialog.open && store.nodes.size === 0, 'Empty label must not create a factor')
  assert(messages.at(-1) === 'Enter a label', 'Empty label must report the status message')
  input.value = 'Saved factor'
  input.dispatchEvent(new Event('input'))
  assert(messages.at(-1) === '', 'Correcting the label must clear the error')
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))
  assert(dialog.open && store.nodes.size === 0, 'IME confirmation must not save')
  let close = closed(dialog)
  dialog.querySelector('[type=submit]').click()
  await close
  const node = [...store.nodes.values()][0]
  assert(
    node.label === 'Saved factor' && node.x === 25 && node.y === 35,
    'Save must create the factor at the selected point'
  )
  assert(presence.length === 2 && presence[1] === null, 'Save must clear placement presence once')

  dialog = start()
  close = closed(dialog)
  dialog.querySelector('.factor-placement-cancel').click()
  await close
  assert(store.nodes.size === 1, 'Cancel must not create a factor')
  assert(presence.length === 4 && presence[3] === null, 'Cancel must clear placement presence once')

  dialog = start()
  close = closed(dialog)
  editor.destroy()
  await close
  assert(
    presence.length === 6 && presence[5] === null,
    'Destroy must clear placement presence once'
  )
  document.getElementById('info').textContent = 'Factor placement tests passed'
}
