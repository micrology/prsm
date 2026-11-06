import { alertMsg, clearStatusBar, elem, initials, listen, statusMsg } from '../utils.js'
import { renameUser } from './user.js'

const SLEEP_AFTER_MS = 15 * 60 * 1000
const THROTTLE_MS = 200
const GHOST_WIDTH = 190
const GHOST_HEIGHT = 75

/**
 * Sets the custom properties that the stylesheet uses to colour something for a user
 * @param {HTMLElement} div
 * @param {object} user
 */
function colourFor(div, user) {
  div.style.setProperty('--user-color', user.color)
  div.style.setProperty('--user-text', user.isLight ? 'black' : 'white')
  div.style.setProperty('--user-border', user.anon ? 'white' : 'black')
}

/**
 * Who else is in the room: avatars in the header, their mouse pointers on the map, the box showing
 * where someone is adding a factor, and following another user's pointer. All of this is Yjs
 * awareness, so nothing is saved in the map.
 */
export class Collaboration {
  /**
   * @param {object} app
   * @param {import('../../cy/store.js').MapStore} app.store
   * @param {cytoscape.Core} app.cy
   * @param {import('y-websocket').WebsocketProvider} app.provider
   * @param {object} app.user the record of this user; it is updated when they rename themselves
   */
  constructor({ store, cy, provider, user }) {
    this.store = store
    this.cy = cy
    this.provider = provider
    this.awareness = provider.awareness
    this.user = user
    this.container = cy.container()
    this.followed = null
    this.cursors = new Map()
    this.ghosts = new Map()
    this.sleepTimer = null
    this.throttled = false
    this.known = new Map()
    this.placePending = false
    this.following = false
    this.awareness.on('change', (change) => this.onAwareness(change))
    cy.on('viewport resize', () => this.schedulePlace())
    cy.on(
      'viewport',
      () => !this.following && this.followed && this.toggleFollow({ id: this.followed })
    )
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    listen('showUsersSwitch', 'change', () => this.refresh())
    this.wake()
    this.refresh()
  }

  /** @returns {boolean} whether the user wants to see the others */
  get visible() {
    return elem('showUsersSwitch').checked
  }

  /** @returns {Array<[number, object]>} the other users, as [client id, awareness state] */
  others() {
    return [...this.awareness.getStates()].filter(
      ([id, state]) => id !== this.user.id && state.user && state.user.name !== 'debug'
    )
  }

  /**
   * Share where a new factor is being added, so that others can see the space is taken
   * @param {{x:number,y:number}|null} pos model position, or null when finished
   */
  setAddingFactor(pos) {
    this.awareness.setLocalStateField(
      'addingFactor',
      pos ? { state: 'adding', pos, name: this.user.name } : { state: 'done' }
    )
  }

  /** Redraw everything: used when users come or go, or change, which is rare */
  refresh() {
    elem('avatars').classList.toggle('off', !this.visible)
    this.remember()
    this.showAvatars()
    this.showPointers()
    this.showGhosts()
  }

  /** Note what each user looks like, so that a later change can be classified */
  remember() {
    this.known.clear()
    for (const [id, state] of this.awareness.getStates()) this.known.set(id, this.signature(state))
  }

  signature(state) {
    return { user: JSON.stringify(state.user), adding: JSON.stringify(state.addingFactor) }
  }

  /**
   * Most awareness changes are just pointers moving, which must cost almost nothing: only the pointer
   * that moved is touched. Anything else redraws.
   * @param {{added:number[], updated:number[], removed:number[]}} change
   */
  onAwareness({ added, updated, removed }) {
    if (added.length || removed.length) return this.refresh()
    const states = this.awareness.getStates()
    let ghosts = false
    for (const id of updated) {
      const state = states.get(id)
      const old = this.known.get(id)
      const now = this.signature(state)
      if (!old || old.user !== now.user) return this.refresh()
      if (old.adding !== now.adding) ghosts = true
      this.known.set(id, now)
      if (id !== this.user.id) this.movePointer(id, state)
    }
    if (ghosts) this.showGhosts()
  }

  /**
   * @param {number} id
   * @param {object} state awareness state of another user
   */
  movePointer(id, state) {
    const div = this.cursors.get(id)
    if (!div || !state.cursor) return
    div.classList.add('glide')
    this.place(div, state.cursor, div.asleep)
    if (id === this.followed) this.follow()
  }

  showAvatars() {
    const unique = new Map()
    for (const [, state] of this.others()) unique.set(state.user.name, state.user)
    const users = [...unique.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
    elem('avatars').replaceChildren(...[this.user, ...users].map((u) => this.makeAvatar(u)))
  }

  /**
   * @param {object} user
   * @returns {HTMLElement}
   */
  makeAvatar(user) {
    const mine = user.id === this.user.id
    const wrapper = document.createElement('div')
    wrapper.className = 'hoverme'
    wrapper.classList.toggle('followme', this.followed === user.id)
    wrapper.dataset.tooltip = user.name
    const circle = document.createElement('div')
    circle.className = 'round'
    circle.classList.toggle('asleep', Boolean(user.asleep))
    circle.textContent = initials(user.name)
    colourFor(circle, user)
    circle.addEventListener('click', () => (mine ? this.rename() : this.toggleFollow(user)))
    circle.addEventListener('contextmenu', (e) => this.selectEdits(e, user.name))
    circle.addEventListener('mouseover', () =>
      statusMsg(
        mine
          ? 'Click to change your name. Right click to select all your edits'
          : `Click to follow this person. Right click to select all this person's edits`
      )
    )
    circle.addEventListener('mouseout', () => clearStatusBar())
    wrapper.append(circle)
    return wrapper
  }

  rename() {
    const name = prompt('Enter your new name', this.user.name)
    clearStatusBar()
    if (name === null) return
    Object.assign(this.user, renameUser(this.user, name))
    this.store.userName = this.user.name
    this.awareness.setLocalStateField('user', this.user)
    this.refresh()
  }

  /**
   * Right click on an avatar: select everything that user created or changed
   * @param {MouseEvent} event
   * @param {string} name
   */
  selectEdits(event, name) {
    event.preventDefault()
    const theirs = (rec) => rec.created?.user === name || rec.modified?.user === name
    this.cy.elements().unselect()
    for (const ymap of [this.store.nodes, this.store.edges]) {
      for (const [id, rec] of ymap.entries()) if (theirs(rec)) this.cy.getElementById(id).select()
    }
  }

  /* --------------------------------- following -------------------------------- */

  /**
   * @param {object} user
   */
  toggleFollow(user) {
    const stop = this.followed === user.id
    this.followed = stop ? null : user.id
    this.showAvatars()
    if (stop) return clearStatusBar()
    alertMsg(`Following ${user.name}`, 'info')
    this.follow()
  }

  /** Keep the followed user's pointer in the centre of the map */
  follow() {
    if (!this.followed) return
    const state = this.awareness.getStates().get(this.followed)
    if (!state) return
    if (state.user?.asleep) return this.toggleFollow({ id: this.followed })
    const pos = state.cursor
    if (!pos) return
    const zoom = this.cy.zoom()
    this.following = true
    this.cy.pan({
      x: this.cy.width() / 2 - pos.x * zoom,
      y: this.cy.height() / 2 - pos.y * zoom,
    })
    this.following = false
  }

  /* --------------------------- pointers and ghost factors --------------------------- */

  /**
   * @param {{x:number,y:number}} pos model position
   * @returns {{x:number,y:number,inside:boolean}} position within the graph container
   */
  toScreen(pos) {
    const zoom = this.cy.zoom()
    const pan = this.cy.pan()
    const x = pos.x * zoom + pan.x
    const y = pos.y * zoom + pan.y
    return { x, y, inside: x >= 0 && y >= 0 && x <= this.cy.width() && y <= this.cy.height() }
  }

  /**
   * Create, update or remove one div per user
   * @param {Map<number, HTMLElement>} divs the divs now showing
   * @param {Map<number, object>} wanted what each user's div should be like
   * @param {function(object):HTMLElement} make creates a div
   * @param {function(HTMLElement, object):void} update brings a div up to date
   */
  syncDivs(divs, wanted, make, update) {
    for (const [id, div] of divs) {
      if (wanted.has(id)) continue
      div.remove()
      divs.delete(id)
    }
    for (const [id, info] of wanted) {
      if (!divs.has(id)) {
        const div = make(info)
        this.container.append(div)
        divs.set(id, div)
      }
      update(divs.get(id), info)
    }
  }

  showPointers() {
    const wanted = new Map()
    if (this.visible) {
      for (const [id, state] of this.others()) wanted.set(id, state)
    }
    this.syncDivs(
      this.cursors,
      wanted,
      () => Object.assign(document.createElement('div'), { className: 'shared-cursor' }),
      (div, state) => {
        div.textContent = initials(state.user.name)
        colourFor(div, state.user)
        div.asleep = Boolean(state.user.asleep)
        this.place(div, state.cursor, state.user.asleep)
      }
    )
  }

  showGhosts() {
    const wanted = new Map()
    if (this.visible) {
      for (const [id, state] of this.others()) {
        if (state.addingFactor?.state === 'adding') wanted.set(id, state.addingFactor)
      }
    }
    this.syncDivs(
      this.ghosts,
      wanted,
      (info) =>
        Object.assign(document.createElement('div'), {
          className: 'ghost-factor',
          innerText: `[New factor\nbeing added by\n${info.name}]`,
        }),
      (div, info) => {
        div.model = info.pos
        this.place(div, info.pos, false, { x: GHOST_WIDTH / 2, y: GHOST_HEIGHT / 2 })
      }
    )
  }

  /**
   * Put a div over a position in the map, hiding it if that is outside the map
   * @param {HTMLElement} div
   * @param {{x:number,y:number}|undefined} pos model position
   * @param {boolean} hidden
   * @param {{x:number,y:number}} [offset] pixels between the position and the div's top left
   */
  place(div, pos, hidden, offset = { x: 0, y: 0 }) {
    div.model = pos
    if (!pos) {
      div.classList.add('off')
      return
    }
    const p = this.toScreen(pos)
    div.style.setProperty('--x', `${Math.round(p.x - offset.x)}px`)
    div.style.setProperty('--y', `${Math.round(p.y - offset.y)}px`)
    div.classList.toggle('off', hidden || !p.inside)
  }

  /** The map has moved: put the pointers back over their positions, once per frame */
  schedulePlace() {
    if (this.placePending) return
    this.placePending = true
    requestAnimationFrame(() => {
      this.placePending = false
      this.placeAll()
    })
  }

  placeAll() {
    for (const div of this.cursors.values()) div.classList.remove('glide')
    for (const div of this.cursors.values()) this.place(div, div.model, div.asleep)
    for (const div of this.ghosts.values()) {
      this.place(div, div.model, false, { x: GHOST_WIDTH / 2, y: GHOST_HEIGHT / 2 })
    }
  }

  /* --------------------------------- my pointer --------------------------------- */

  /**
   * Tell the others where my pointer is, in map coordinates
   * @param {MouseEvent} e
   */
  onMouseMove(e) {
    this.wake()
    if (this.throttled) return
    this.throttled = true
    setTimeout(() => (this.throttled = false), THROTTLE_MS)
    const box = this.container.getBoundingClientRect()
    const pan = this.cy.pan()
    const zoom = this.cy.zoom()
    this.awareness.setLocalStateField('cursor', {
      x: Math.round((e.clientX - box.left - pan.x) / zoom),
      y: Math.round((e.clientY - box.top - pan.y) / zoom),
    })
  }

  /** Show the user as awake, and start the timer that will show them asleep after a long idle time */
  wake() {
    clearTimeout(this.sleepTimer)
    this.setAsleep(false)
    this.sleepTimer = setTimeout(() => this.setAsleep(true), SLEEP_AFTER_MS)
  }

  /**
   * An avatar fades when its user has not moved the mouse for a long time. Then the connection to the
   * server is dropped to save resources, and it is restored on the next mouse movement.
   * @param {boolean} asleep
   */
  setAsleep(asleep) {
    if (Boolean(this.user.asleep) === asleep) return
    this.user.asleep = asleep
    this.awareness.setLocalStateField('user', this.user)
    if (asleep) this.provider.disconnect()
    else this.provider.connect()
    this.refresh()
  }
}
