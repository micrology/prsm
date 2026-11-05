import { CP, dragElement, elem, listen } from '../utils.js'

const TABS = {
  nodesButton: 'nodesTab',
  linksButton: 'linksTab',
  networkButton: 'networkTab',
  analysisButton: 'analysisTab',
}

/**
 * The floating side panel: show/hide, drag, and the choice of tab.
 */
export class SidePanel {
  constructor() {
    this.panel = elem('panel')
    dragElement(this.panel, elem('panelHeader'))
    listen('panelToggle', 'click', () => this.toggle())
    for (const [button, tab] of Object.entries(TABS)) {
      listen(button, 'click', () => this.openTab(button, tab))
    }
    this.openTab('nodesButton', 'nodesTab')
  }

  /** Show the panel if it is hidden, and hide it if it is showing */
  toggle() {
    this.panel.classList.toggle('hide')
  }

  /**
   * @param {string} buttonId
   * @param {string} tabId
   */
  openTab(buttonId, tabId) {
    for (const tab of Object.values(TABS)) elem(tab).classList.toggle('hide', tab !== tabId)
    for (const button of Object.keys(TABS)) {
      elem(button).classList.toggle('active', button === buttonId)
    }
  }

  /** Show a particular tab, opening the panel if need be */
  show(buttonId) {
    this.panel.classList.remove('hide')
    this.openTab(buttonId, TABS[buttonId])
  }
}

/**
 * Create the colour picker that the side panel and the dialogs share
 * @returns {CP}
 */
export function createColorPicker() {
  return new CP()
}
