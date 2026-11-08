/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Finds factors by their labels.
********************************************************************************************/

import { elem, listen } from '../../../js/utils.js'

const ZOOM_ON_FOUND = 1
const MOVE_MS = 500

/**
 * The search box: type part of a factor's label, pick one of the suggestions, and the map
 * moves to show that factor.
 */
export class Search {
  /**
   * Connect the search box to the graph.
   * @param {object} app Search dependencies.
   * @param {cytoscape.Core} app.cy Displayed graph.
   */
  constructor({ cy }) {
    this.cy = cy
    this.bar = elem('search-bar')
    listen('search', 'click', () => this.toggle())
    listen('search-bar', 'input', () => this.showSuggestions())
    listen('search-bar', 'keydown', (e) => this.onKey(e))
  }

  /**
   * Open or close the search box.
   * @returns {void}
   */
  toggle() {
    if (this.bar.classList.contains('show')) return this.close()
    this.bar.classList.add('show')
    elem('search-icon').classList.add('show')
    this.bar.focus()
  }

  /**
   * Close search and clear its query and suggestions.
   * @returns {void}
   */
  close() {
    this.bar.value = ''
    this.bar.classList.remove('show')
    elem('search-icon').classList.remove('show')
    this.clearSuggestions()
  }

  /**
   * Remove the current search suggestions.
   * @returns {void}
   */
  clearSuggestions() {
    elem('suggestion-list').replaceChildren()
  }

  /**
   * Close search on Escape or choose the first suggestion on Enter.
   * @param {KeyboardEvent} e Key event.
   * @returns {void}
   */
  onKey(e) {
    if (e.key === 'Escape') this.close()
    if (e.key === 'Enter') elem('suggestion-list').querySelector('.search-suggestion-text')?.click()
  }

  /**
   * List factors whose labels contain the search text.
   * @returns {void}
   */
  showSuggestions() {
    const text = this.bar.value.trim().toLowerCase()
    this.clearSuggestions()
    if (!text) return
    const matches = this.cy
      .nodes()
      .filter((n) => !n.isParent() && (n.data('label') ?? '').toLowerCase().includes(text))
    if (matches.empty()) return
    const list = document.createElement('ul')
    list.className = 'search-ul'
    matches.forEach((n) => list.append(this.suggestion(n)))
    elem('suggestion-list').append(list)
  }

  /**
   * Create a suggestion that navigates to a matching factor.
   * @param {cytoscape.NodeSingular} node Matching factor.
   * @returns {HTMLLIElement} Suggestion item.
   */
  suggestion(node) {
    const li = document.createElement('li')
    li.className = 'search-suggestion'
    const div = document.createElement('div')
    div.className = 'search-suggestion-text'
    div.textContent = (node.data('label') ?? '').replace(/\n/g, ' ')
    div.addEventListener('click', () => this.goTo(node))
    li.append(div)
    return li
  }

  /**
   * Animate the map to a factor and close search.
   * @param {cytoscape.NodeSingular} node Factor to show.
   * @returns {void}
   */
  goTo(node) {
    this.cy.animate({ center: { eles: node }, zoom: ZOOM_ON_FOUND }, { duration: MOVE_MS })
    this.close()
  }
}
