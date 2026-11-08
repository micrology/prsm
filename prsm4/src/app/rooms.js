/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Manages recently visited maps and project lists.
********************************************************************************************/

import { alertMsg, elem, listen } from '../../../js/utils.js'
import { generateRoom } from './room.js'

const STORAGE_KEY = 'prsm4MapList'
const LIST_TYPE = 'PRSM 4 map list'
const MAX_RECENTS = 50

/**
 * Check whether data is a valid PRSM 4 map and project list.
 * @param {*} value Data to check.
 * @returns {*} A truthy value if the list has the expected structure.
 */
function validList(value) {
  /**
   * Check whether a value is a non-array object.
   * @param {*} v Value to check.
   * @returns {*} Truthy when the value is a record.
   */
  const record = (v) => v && typeof v === 'object' && !Array.isArray(v)
  /**
   * Check whether a map list entry has the required fields.
   * @param {*} m Candidate entry.
   * @returns {*} Truthy when the entry is valid.
   */
  const map = (m) =>
    record(m) &&
    typeof m.room === 'string' &&
    m.room &&
    typeof m.server === 'string' &&
    /^wss?:\/\//i.test(m.server) &&
    typeof m.title === 'string' &&
    (m.disambiguatedAt === undefined ||
      (typeof m.disambiguatedAt === 'string' && !Number.isNaN(Date.parse(m.disambiguatedAt))))
  return (
    record(value) &&
    value.type === LIST_TYPE &&
    Array.isArray(value.maps) &&
    value.maps.every(map) &&
    Array.isArray(value.projects) &&
    value.projects.every(
      (p) =>
        record(p) &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Array.isArray(p.maps) &&
        p.maps.every(map)
    )
  )
}

/**
 * Identify a map by its collaboration server and room.
 * @param {object} map Map reference.
 * @returns {string} Stable identity for comparison.
 */
function identity(map) {
  return JSON.stringify([map.server, map.room])
}

/**
 * Format a map title, including its disambiguating date if present.
 * @param {object} map Map reference.
 * @returns {string} Display title.
 */
function displayTitle(map) {
  if (!map.disambiguatedAt) return map.title
  const date = new Date(map.disambiguatedAt)
  return `${map.title} (${date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })})`
}

/** Recent v4 rooms and projects stored locally, without mixing legacy room identities. */
export class Rooms {
  /**
   * Connect the recent-map menu to the current room.
   * @param {object} options Current map and connection details.
   * @param {import('../graph/store.js').MapStore} options.store Current map.
   * @param {string} options.room Room identifier.
   * @param {string} options.server Websocket server URL.
   */
  constructor({ store, room, server }) {
    this.store = store
    this.room = room
    this.server = server
    this.menu = elem('rooms-menu')
    this.button = elem('rooms-menu-caret')
    this.ready = false
    listen('rooms-menu-caret', 'click', () => this.toggle())
    listen('newMapTrigger', 'click', () => this.navigate({ room: generateRoom(), server }))
    listen('newProjectTrigger', 'click', () => this.newProject())
    listen('saveListToFileTrigger', 'click', () => this.saveList())
    listen('loadListFromFileTrigger', 'click', () => elem('mapListInput').click())
    listen('mapListInput', 'change', (event) => this.importList(event))
    document.addEventListener('click', (event) => {
      if (!this.menu.contains(event.target) && !this.button.contains(event.target)) this.close()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.menu.classList.contains('show')) {
        this.close()
        this.button.focus()
      }
    })
    store.meta.observe((event) => {
      if (this.ready && event.keysChanged.has('title')) this.remember()
    })
  }

  /**
   * Begin recording visits after the room has synchronized.
   * @returns {void}
   */
  start() {
    this.ready = true
    this.remember()
  }

  /**
   * Read the saved map and project list.
   * @returns {object} Saved list, or an empty list if none exists.
   * @throws {Error} If the saved list is invalid.
   */
  read() {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return { type: LIST_TYPE, maps: [], projects: [] }
    const list = JSON.parse(text)
    if (!validList(list)) throw new Error('Invalid PRSM 4 map list')
    return list
  }

  /**
   * Update the saved list and report any failure.
   * @param {function(object):void} fn Change to make to the list.
   * @returns {boolean} Whether the list was saved.
   */
  change(fn) {
    try {
      const list = this.read()
      fn(list)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      return true
    } catch (error) {
      alertMsg(`Could not update the map list: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * Describe the current room for the map list.
   * @returns {{room:string,server:string,title:string}} Current map reference.
   */
  current() {
    return {
      room: this.room,
      server: this.server,
      title: this.store.meta.get('title')?.trim() || 'Untitled map',
    }
  }

  /**
   * Add or update the titled current map in recent maps and projects.
   * @returns {void}
   */
  remember() {
    const current = this.current()
    if (current.title === 'Untitled map') return
    this.change((list) => {
      const existing =
        list.maps.find((map) => identity(map) === identity(current)) ??
        list.projects
          .flatMap((project) => project.maps)
          .find((map) => identity(map) === identity(current))
      if (existing?.title === current.title && existing.disambiguatedAt) {
        current.disambiguatedAt = existing.disambiguatedAt
      } else if (existing?.title !== current.title || !existing) {
        const allMaps = [...list.maps, ...list.projects.flatMap((project) => project.maps)]
        if (
          allMaps.some((map) => identity(map) !== identity(current) && map.title === current.title)
        ) {
          current.disambiguatedAt = new Date().toISOString()
        }
      }
      list.maps = [
        ...list.maps.filter((map) => identity(map) !== identity(current)),
        current,
      ].slice(-MAX_RECENTS)
      for (const project of list.projects) {
        project.maps = project.maps.map((map) =>
          identity(map) === identity(current) ? current : map
        )
      }
    })
  }

  /**
   * Open or close the recent-map menu.
   * @returns {void}
   */
  toggle() {
    if (this.menu.classList.contains('show')) return this.close()
    try {
      this.render(this.read())
      this.menu.classList.add('show')
      this.button.setAttribute('aria-expanded', 'true')
    } catch (error) {
      alertMsg(`Could not open the map list: ${error.message}`, 'error')
    }
  }

  /**
   * Close the recent-map menu.
   * @returns {void}
   */
  close() {
    this.menu.classList.remove('show')
    this.button.setAttribute('aria-expanded', 'false')
  }

  /**
   * Open a map reference after confirming navigation away from a nonempty map.
   * @param {object} map Map reference containing its room and server.
   * @returns {void}
   */
  navigate(map) {
    if (identity(map) === identity(this.current())) return this.close()
    if (this.store.nodes.size && !confirm('Are you sure you want to move to a different map?')) {
      return
    }
    const url = new URL(location.href)
    url.search = ''
    url.searchParams.set('room', map.room)
    url.searchParams.set('ws', map.server)
    location.assign(url)
  }

  /**
   * Create an action in the recent-map menu.
   * @param {string} text Button label.
   * @param {function} callback Action to invoke.
   * @param {boolean} [heading] Whether to style the action as a command.
   * @returns {HTMLButtonElement} Menu button.
   */
  action(text, callback, heading = false) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'rm-item room-action'
    button.classList.toggle('room-command', heading)
    button.textContent = text
    button.addEventListener('click', callback)
    return button
  }

  /**
   * Display recent maps and projects.
   * @param {object} list Saved map and project list.
   * @returns {void}
   */
  render(list) {
    elem('map-list-items').replaceChildren(
      ...list.maps
        .slice()
        .reverse()
        .map((map) => this.action(displayTitle(map), () => this.navigate(map)))
    )
    elem('project-list-items').replaceChildren(
      ...list.projects.map((project) => {
        const group = document.createElement('details')
        const summary = document.createElement('summary')
        summary.className = 'rm-item'
        summary.textContent = project.name
        group.append(
          summary,
          ...project.maps.map((map) => this.action(displayTitle(map), () => this.navigate(map)))
        )
        group.append(this.action('Add this map', () => this.addToProject(project.id), true))
        group.append(this.action('Delete project', () => this.deleteProject(project), true))
        return group
      })
    )
  }

  /**
   * Ask for a name and create an empty project.
   * @returns {void}
   */
  newProject() {
    const name = prompt('Enter name of new project')?.trim()
    if (!name) return
    if (this.change((list) => list.projects.push({ id: crypto.randomUUID(), name, maps: [] }))) {
      this.render(this.read())
      alertMsg(`New project created: ${name}`, 'info')
    }
  }

  /**
   * Add the current titled map to a project.
   * @param {string} id Project identifier.
   * @returns {void}
   */
  addToProject(id) {
    const map = this.current()
    if (map.title === 'Untitled map') return alertMsg('Please give your map a title first', 'warn')
    if (
      this.change((list) => {
        const project = list.projects.find((item) => item.id === id)
        if (!project) throw new Error('The project no longer exists')
        if (project.maps.some((item) => identity(item) === identity(map))) {
          throw new Error('This map is already in the project')
        }
        project.maps.push(list.maps.find((item) => identity(item) === identity(map)) ?? map)
      })
    ) {
      this.close()
      alertMsg(`Added ${map.title} to the project`, 'info')
    }
  }

  /**
   * Delete a project after confirmation, without deleting its maps.
   * @param {object} project Project to delete.
   * @returns {void}
   */
  deleteProject(project) {
    if (!confirm(`Delete the project "${project.name}"? Its maps will not be deleted.`)) return
    if (
      this.change((list) => {
        list.projects = list.projects.filter((item) => item.id !== project.id)
      })
    ) {
      this.render(this.read())
    }
  }

  /**
   * Download the map and project list.
   * @returns {void}
   */
  saveList() {
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(this.read(), null, 2)], { type: 'application/json' })
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'PRSM4MapList.prsml'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      this.close()
    } catch (error) {
      alertMsg(`Could not save the map list: ${error.message}`, 'error')
    }
  }

  /**
   * Merge a selected PRSM 4 list into the saved list.
   * @param {Event} event File input change event.
   * @returns {Promise<void>} Resolves after importing or reporting an error.
   */
  async importList(event) {
    const input = event.target
    const file = input.files[0]
    input.value = ''
    if (!file) return
    try {
      const incoming = JSON.parse(await file.text())
      if (!validList(incoming)) {
        throw new Error('Expected a PRSM 4 map list; older map lists use different rooms')
      }
      if (
        this.change((list) => {
          const maps = new Map(list.maps.map((map) => [identity(map), map]))
          for (const map of incoming.maps) maps.set(identity(map), map)
          const projects = new Map(list.projects.map((project) => [project.id, project]))
          for (const project of incoming.projects) {
            if (
              projects.has(project.id) &&
              JSON.stringify(projects.get(project.id)) !== JSON.stringify(project)
            ) {
              throw new Error(`Project "${project.name}" conflicts with an existing project`)
            }
            projects.set(project.id, project)
          }
          list.maps = [...maps.values()].slice(-MAX_RECENTS)
          list.projects = [...projects.values()]
        })
      ) {
        this.render(this.read())
        alertMsg('Map list loaded successfully', 'info')
      }
    } catch (error) {
      alertMsg(`Could not load the map list: ${error.message}`, 'error')
    }
  }
}
