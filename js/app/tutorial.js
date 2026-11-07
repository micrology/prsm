import { elem, listen } from '../utils.js'

const DONE_KEY = 'doneIntro'

/** A non-modal tour of the controls that are available in PRSM 4. */
export class Tutorial {
  constructor({ user, collaboration }) {
    this.user = user
    this.collaboration = collaboration
    this.dialog = elem('tour-dialog')
    this.steps = [...document.querySelectorAll('[data-step]')]
      .filter((element) => element.dataset.step !== '10')
      .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step))
    listen('tour-start', 'click', () => this.start())
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

  startIfNeeded() {
    if (
      new URL(location.href).searchParams.has('start') ||
      localStorage.getItem(DONE_KEY) !== 'done'
    ) {
      this.start()
    }
  }

  start() {
    if (this.dialog.open) return
    this.index = 0
    this.dialog.show()
    this.show()
  }

  show() {
    document.querySelector('.tour-target')?.classList.remove('tour-target')
    const target = this.steps[this.index]
    if (target.dataset.position !== 'splash') target.classList.add('tour-target')
    elem('tour-title').textContent = `PRSM tour (${this.index + 1} of ${this.steps.length})`
    elem('tour-text').innerHTML = target.dataset.tutorial
    elem('tour-back').textContent = this.index ? 'Back' : 'Skip'
    elem('tour-next').textContent = this.index === this.steps.length - 1 ? 'Done' : 'Next'
    const name = document.getElementById('splashNameBox')
    if (name) {
      name.placeholder = this.user.name
      name.addEventListener('change', () => {
        if (name.value.trim()) this.collaboration.setName(name.value.trim())
      })
    }
    elem('tour-title').focus()
  }

  move(delta) {
    this.index += delta
    if (this.index < 0 || this.index >= this.steps.length) return this.finish()
    this.show()
  }

  finish() {
    document.querySelector('.tour-target')?.classList.remove('tour-target')
    this.dialog.close()
    localStorage.setItem(DONE_KEY, 'done')
  }
}
