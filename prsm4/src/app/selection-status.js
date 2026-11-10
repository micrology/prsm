/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Describes selected factors and links in the status bar.
********************************************************************************************/

/**
 * Shorten a label for the status bar.
 * @param {string} label Full label.
 * @returns {string} Single-line abbreviated label.
 */
export function shortLabel(label) {
  const text = (label || '').replace(/\s+/g, ' ').trim()
  return text.length > 25 ? `${text.slice(0, 25)}…` : text
}

/**
 * Join names with commas and a final conjunction.
 * @param {string[]} names Names to join.
 * @returns {string} Readable list.
 */
function joinNames(names) {
  if (names.length < 2) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/**
 * Describe a graph selection.
 * @param {cytoscape.CollectionReturnValue} selected Selected elements.
 * @returns {string} Selection message.
 */
export function selectionMessage(selected) {
  const nodes = selected.nodes().filter((node) => !node.hasClass('meta'))
  const edges = selected.edges().filter((edge) => !edge.hasClass('meta'))
  const parts = []
  if (nodes.length) {
    parts.push(
      `Factor${nodes.length === 1 ? '' : 's'}: ${joinNames(nodes.map((n) => `'${shortLabel(n.data('label'))}'`))}`
    )
  }
  if (edges.length) {
    parts.push(
      joinNames(
        edges.map((edge) => {
          const label = shortLabel(edge.data('label'))
          return label
            ? `Link '${label}'`
            : `Link from '${shortLabel(edge.source().data('label'))}' to '${shortLabel(edge.target().data('label'))}'`
        })
      )
    )
  }
  return parts.length ? `${parts.join(' and ')} selected` : ''
}

/**
 * Keep the status bar in sync with selections and renamed elements.
 * @param {cytoscape.Core} cy Graph.
 * @param {function(string):void} statusMsg Displays the selection message.
 * @returns {void}
 */
export function bindSelectionStatus(cy, statusMsg) {
  let pending = false
  const refresh = () => {
    if (pending) return
    pending = true
    queueMicrotask(() => {
      pending = false
      statusMsg(selectionMessage(cy.elements(':selected')))
    })
  }
  cy.on('select unselect remove data', 'node, edge', refresh)
}
