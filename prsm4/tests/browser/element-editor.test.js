// Run in the browser test bed with ?element-editor-tests.

/**
 * Check factor and link font choices and the link arrow control.
 * @param {object} view Test-bed graph, store and editor.
 * @returns {void}
 */
export function runElementEditorTests({ cy, store, editor }) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const first = store.addNode({ label: 'A', x: 50, y: 50, style: 'group0' })
  const second = store.addNode({ label: 'B', x: 180, y: 50, style: 'group0' })
  const link = store.addEdge({ source: first, target: second, style: 'edge0' })
  const fontOptions = () =>
    [...document.querySelector('[aria-label="Font size"]').options]
      .slice(1)
      .map((o) => o.textContent)

  editor.elementEditor.open(cy.getElementById(first))
  assert(fontOptions().join(',') === 'Large,Medium,Small', 'Incorrect factor font choices')
  editor.elementEditor.open(cy.getElementById(link))
  assert(fontOptions().join(',') === 'Large,Medium,Small', 'Incorrect link font choices')
  const font = document.querySelector('[aria-label="Font size"]')
  const arrow = document.querySelector('[aria-label="Arrow"]')
  const fontRect = font.getBoundingClientRect()
  const arrowRect = arrow.getBoundingClientRect()
  assert(
    arrowRect.left > fontRect.right && arrowRect.top === fontRect.top,
    'Arrow must be right of font size'
  )
  const caption = [...document.querySelectorAll('.element-field-title')].find(
    (e) => e.textContent === 'Arrow'
  )
  assert(
    caption && caption.getBoundingClientRect().top < arrowRect.top,
    'Arrow caption must be in the preceding row'
  )
  arrow.value = 'diamond'
  arrow.dispatchEvent(new Event('change'))
  font.value = '24'
  font.dispatchEvent(new Event('change'))
  editor.elementEditor.save()
  const overrides = store.edges.get(link).overrides
  assert(
    overrides['target-arrow-shape'] === 'diamond' && overrides['font-size'] === 24,
    'Link selections must save'
  )
  document.getElementById('info').textContent = 'Element editor tests passed'
}
