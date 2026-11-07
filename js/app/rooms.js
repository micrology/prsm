import { alertMsg, elem, listen } from '../utils.js'
import { generateRoom } from './room.js'

const STORAGE_KEY = 'prsm4MapList'
const LIST_TYPE = 'PRSM 4 map list'
const MAX_RECENTS = 50

function validList(value) {
  const record = (v) => v && typeof v === 'object' && !Array.isArray(v)
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

function identity(map) {
  return JSON.stringify([map.server, map.room])
}

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

  start() {
    this.ready = true
    this.remember()
  }

  read() {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return { type: LIST_TYPE, maps: [], projects: [] }
    const list = JSON.parse(text)
    if (!validList(list)) throw new Error('Invalid PRSM 4 map list')
    return list
  }

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

  current() {
    return {
      room: this.room,
      server: this.server,
      title: this.store.meta.get('title')?.trim() || 'Untitled map',
    }
  }

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

  close() {
    this.menu.classList.remove('show')
    this.button.setAttribute('aria-expanded', 'false')
  }

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

  action(text, callback, heading = false) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'rm-item room-action'
    button.classList.toggle('room-command', heading)
    button.textContent = text
    button.addEventListener('click', callback)
    return button
  }

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

  newProject() {
    const name = prompt('Enter name of new project')?.trim()
    if (!name) return
    if (this.change((list) => list.projects.push({ id: crypto.randomUUID(), name, maps: [] }))) {
      this.render(this.read())
      alertMsg(`New project created: ${name}`, 'info')
    }
  }

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
