import { elem, listen } from '../utils.js'

const ZOOM_ON_FOUND = 1
const MOVE_MS = 500

/**
 * The search box: type part of a factor's label, pick one of the suggestions, and the map
 * moves to show that factor.
 */
export class Search {
  /**
   * @param {object} app
   * @param {cytoscape.Core} app.cy
   */
  constructor({ cy }) {
    this.cy = cy
    this.bar = elem('search-bar')
    listen('search', 'click', () => this.toggle())
    listen('search-bar', 'input', () => this.showSuggestions())
    listen('search-bar', 'keydown', (e) => this.onKey(e))
  }

  toggle() {
    if (this.bar.classList.contains('show')) return this.close()
    this.bar.classList.add('show')
    elem('search-icon').classList.add('show')
    this.bar.focus()
  }

  close() {
    this.bar.value = ''
    this.bar.classList.remove('show')
    elem('search-icon').classList.remove('show')
    this.clearSuggestions()
  }

  clearSuggestions() {
    elem('suggestion-list').replaceChildren()
  }

  /**
   * @param {KeyboardEvent} e
   */
  onKey(e) {
    if (e.key === 'Escape') this.close()
    if (e.key === 'Enter') elem('suggestion-list').querySelector('.search-suggestion-text')?.click()
  }

  /** List the factors whose labels contain what has been typed */
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
   * @param {cytoscape.NodeSingular} node
   * @returns {HTMLLIElement}
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
   * @param {cytoscape.NodeSingular} node
   */
  goTo(node) {
    this.cy.animate({ center: { eles: node }, zoom: ZOOM_ON_FOUND }, { duration: MOVE_MS })
    this.close()
  }
}
