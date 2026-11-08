/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Guides new users through the map editor.
********************************************************************************************/

import { createPopper } from '@popperjs/core'
import { elem, listen } from '../../../js/utils.js'

const DONE_KEY = 'doneIntro'

/** A non-modal tour of the controls that are available in PRSM 4. */
export class Tutorial {
  /**
   * Connect the tour controls to the current user.
   * @param {object} options Tour dependencies.
   * @param {object} options.user Current user record.
   * @param {object} options.collaboration Collaboration controls used to set the user's name.
   */
  constructor({ user, collaboration }) {
    this.user = user
    this.collaboration = collaboration
    this.dialog = elem('tour-dialog')
    this.steps = [...document.querySelectorAll('[data-step]')]
      .filter((element) => element.dataset.step !== '10')
      .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step))
    listen('tour-next', 'click', () => this.move(1))
    listen('tour-back', 'click', () => this.move(-1))
    listen('tour-close', 'click', () => this.finish())
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.finish()
      }
    })
  }

  /**
   * Start the tour when it has not been completed or the URL requests it.
   * @returns {void}
   */
  startIfNeeded() {
    if (
      new URL(location.href).searchParams.has('start') ||
      localStorage.getItem(DONE_KEY) !== 'done'
    ) {
      this.start()
    }
  }

  /**
   * Open the tour at its first step.
   * @returns {void}
   */
  start() {
    if (this.dialog.open) return
    this.index = 0
    this.dialog.show()
    this.show()
  }

  /**
   * Display the current step and highlight its target.
   * @returns {void}
   */
  show() {
    this.popper?.destroy()
    this.popper = null
    document.querySelector('.tour-target')?.classList.remove('tour-target')
    const target = this.steps[this.index]
    const splash = target.dataset.position === 'splash'
    this.dialog.classList.toggle('tour-splash', splash)
    if (!splash) target.classList.add('tour-target')
    elem('tour-title').textContent = `PRSM tour (${this.index + 1} of ${this.steps.length})`
    elem('tour-text').innerHTML = target.dataset.tutorial
    elem('tour-back').textContent = this.index ? 'Back' : 'Skip'
    elem('tour-next').textContent = this.index === this.steps.length - 1 ? 'Done' : 'Next'
    const name = document.getElementById('splashNameBox')
    if (name) {
      const logo = document.createElement('img')
      logo.src = new URL('../../../icons/PRSMlogo80.webp', import.meta.url)
      logo.alt = ''
      elem('intro-logo').append(logo)
      name.placeholder = this.user.name
      name.addEventListener('change', () => {
        if (name.value.trim()) this.collaboration.setName(name.value.trim())
      })
    }
    if (!splash) this.position(target)
    elem('tour-title').focus()
  }

  /**
   * Position a step next to its target, flipping when it would leave the viewport.
   * @param {HTMLElement} target Control described by the step.
   * @returns {void}
   */
  position(target) {
    const placement = {
      below: 'bottom-start',
      above: 'top-start',
      left: 'left',
      'left-bottom': 'left-end',
      right: 'right',
    }[target.dataset.position]
    this.popper = createPopper(target, this.dialog, {
      placement,
      strategy: 'fixed',
      modifiers: [
        { name: 'offset', options: { offset: [0, 12] } },
        { name: 'flip', options: { fallbackPlacements: ['bottom', 'top', 'right', 'left'] } },
        { name: 'preventOverflow', options: { padding: 8, altAxis: true } },
        { name: 'arrow', options: { element: elem('tour-arrow'), padding: 12 } },
      ],
    })
    this.popper.forceUpdate()
  }

  /**
   * Move through the tour, finishing if the next step is outside its bounds.
   * @param {number} delta Number of steps to move.
   * @returns {void}
   */
  move(delta) {
    this.index += delta
    if (this.index < 0 || this.index >= this.steps.length) return this.finish()
    this.show()
  }

  /**
   * Close the tour and record that it has been completed.
   * @returns {void}
   */
  finish() {
    this.popper?.destroy()
    this.popper = null
    document.querySelector('.tour-target')?.classList.remove('tour-target')
    this.dialog.close()
    localStorage.setItem(DONE_KEY, 'done')
  }
}
