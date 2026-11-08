/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Displays the map settings side panel.
********************************************************************************************/

import { CP, dragElement, elem, listen } from '../../../js/utils.js'

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
  /** Connect the settings panel and its tabs to their controls. */
  constructor() {
    this.panel = elem('panel')
    dragElement(this.panel, elem('panelHeader'))
    listen('panelToggle', 'click', () => this.toggle())
    for (const [button, tab] of Object.entries(TABS)) {
      listen(button, 'click', () => this.openTab(button, tab))
    }
    this.openTab('nodesButton', 'nodesTab')
  }

  /**
   * Show the panel if it is hidden, and hide it if it is showing.
   * @returns {void}
   */
  toggle() {
    this.panel.classList.toggle('hide')
  }

  /**
   * Select a settings tab.
   * @param {string} buttonId ID of the tab button.
   * @param {string} tabId ID of the tab content.
   * @returns {void}
   */
  openTab(buttonId, tabId) {
    for (const tab of Object.values(TABS)) elem(tab).classList.toggle('hide', tab !== tabId)
    for (const button of Object.keys(TABS)) {
      elem(button).classList.toggle('active', button === buttonId)
    }
  }

  /**
   * Show a particular tab, opening the panel if needed.
   * @param {string} buttonId ID of the tab button.
   * @returns {void}
   */
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
