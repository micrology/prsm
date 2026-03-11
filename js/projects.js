/********************************************************************************************* 

PRSM Participatory System Mapper 

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.

This code handles the dropdown menu of recent maps and projects.  
********************************************************************************************/

import { elem, clean, uuidv4, getCSSVariable, alertMsg, statusMsg } from './utils.js'
import { data, room } from './prsm.js'
import { saveAs } from 'file-saver'

/** @type {HTMLElement} The top-level rooms/maps/projects dropdown panel. */
const mainMenu = elem('rooms-menu')
/** @type {HTMLElement} The flyout panel listing saved projects. */
const projectsMenu = elem('projects-menu')
/** @type {HTMLElement} The flyout panel listing maps within a project. */
const projectMapsMenu = elem('project-maps-menu')
/** @type {HTMLElement} The scrollable container inside the main menu. */
const scrollBox = elem('rm-scroll-box')
/** @type {HTMLElement} The modal overlay used when creating a new project. */
const modalOverlay = elem('rm-modal-overlay')
/** @type {HTMLInputElement} The text input element for the new-project name. */
const projectNameInput = elem('projectNameInput')

/** @type {Object.<string, Object>} Map of project UIDs to project data objects. */
let projects = {}
/** @type {Object.<string, string>} Map of room identifiers to map display titles. */
let maps = {}
/** @type {string|null} UID of the currently highlighted/active project, or null. */
let activeProject = null
/** @type {ReturnType<typeof setTimeout>} Timer used to delay closing the menus on mouse-leave. */
let closeTimer

/** Maximum number of recent map entries retained in localStorage. */
const TITLELISTLEN = 50

/**
 * Initialises the recent maps and projects menus from localStorage,
 * stores the current room if the map has a title, trims the list to the
 * most recent {@link TITLELISTLEN} entries, and re-renders both menus.
 * @param {string} title - The title of the currently open map.
 */
export function createRoomMenus(title) {
    const recents = JSON.parse(localStorage.getItem('recents')) || {}
    projects = recents.projects || {}
    maps = clean(recents, { projects: true })
    maps.new = '<b>New Map</b>'
    projects.new = '<b>New Project</b>'
    // only store the map room if the map has a title
    if (title !== 'Untitled map') {
        storeMapRoom(room, title)
    }
    // save only the most recent entries
    maps = Object.fromEntries(Object.entries(maps).slice(-TITLELISTLEN))
    storeList()
    renderProjects()
    renderMaps()
}

/**
 * Renders the flat list of recent maps into the #map-list-items container.
 * Each entry is a clickable div that navigates to that map's room.
 */
function renderMaps() {
    const container = elem('map-list-items')
    container.innerHTML = ''
    Object.entries(maps).reverse().forEach(([url, title]) => {
        if (url !== 'new') {
            const div = document.createElement('div')
            div.className = 'rm-item'
            div.dataset.room = url
            div.innerHTML = `<span>${title}</span>`
            div.onclick = () => {
                changeRoom(div)
            }
            div.onmouseenter = () => {
                projectsMenu.classList.remove('show')
                projectMapsMenu.classList.remove('show')
                activeProject = null
            }
            container.appendChild(div)
        }
    })
}

/**
 * Renders the list of projects into the #project-list-items container.
 * Each project entry shows a flyout of maps belonging to it on hover,
 * and a "New Project" entry that opens the creation modal.
 */
function renderProjects() {
    const container = elem('project-list-items')
    container.innerHTML = ''
    Object.entries(projects).reverse().forEach(([projectUID, projectData]) => {
        const div = document.createElement('div')
        div.className = 'rm-item'
        div.dataset.project = projectData
        if (projectUID === 'new') {
            div.innerHTML = `<b>New Project</b>`
            div.onclick = () => {
                closeAll()
                modalOverlay.style.display = 'flex'
                projectNameInput.value = ''
                projectNameInput.focus()
            }
            div.onmouseenter = (e) => {
                clearTimeout(closeTimer)
                projectMapsMenu.classList.remove('show')
                activeProject = null
            }
            container.appendChild(div)
            return
        }
        div.innerHTML = `<span>${projectData.name}</span><span class="arrow">▶</span>`

        div.onmouseenter = (e) => {
            clearTimeout(closeTimer)
            activeProject = projectUID
            const rect = div.getBoundingClientRect()
            renderProjectMaps(projectData)
            projectMapsMenu.style.top = rect.top + 'px'
            projectMapsMenu.style.left = rect.right - 4 + 'px'
            projectMapsMenu.classList.add('show')
        }
        container.appendChild(div)
    })
}

/**
 * Populates the project-maps flyout panel with the maps belonging to a project,
 * plus "Add this map" and "Delete this project" action items.
 * @param {Object.<string, string>} proj - Project data object where each key is a
 *   room URL (or 'name') and each value is the map title (or the project name).
 */
function renderProjectMaps(proj) {
    const list = elem('project-maps-list')
    list.innerHTML = ''
    Object.entries(proj).forEach(([url, title]) => {
        if (url !== 'name') {
            const div = document.createElement('div')
            div.className = 'rm-item'
            div.dataset.room = url
            div.innerHTML = `<span>${title}</span>`
            div.onclick = () => {
                changeRoom(div)
            }
            list.appendChild(div)
        }
    })
    const addBtn = document.createElement('div')
    addBtn.className = 'rm-item'
    addBtn.style.color = getCSSVariable('--tertiary-color')
    addBtn.textContent = 'Add this map to the project'
    addBtn.onclick = () => {
        addMapToProject()
        closeAll()
    }
    list.appendChild(addBtn)

    const delBtn = document.createElement('div')
    delBtn.className = 'rm-item'
    delBtn.style.color = getCSSVariable('--alert-color')
    delBtn.textContent = 'Delete this project'
    delBtn.onclick = deleteActiveProject
    list.appendChild(delBtn)
}

/**
 * Stores a room/title pair in the maps object. If a map with the same title
 * already exists, the current date/time is appended to make it unique.
 * @param {string} room - The room identifier used as the URL search parameter.
 * @param {string} title - The display title for the map.
 */
function storeMapRoom(room, title) {
    if (Object.values(maps).includes(title.replace(/\w*(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2})/g, ''))) title += ` (${new Date().toLocaleString()})`
    maps[room] = title
}
/**
 * Adds the currently open map to the active project.
 * Displays a warning if no project is active, the map is already in the
 * project, or the map still has the default 'Untitled map' title.
 */
function addMapToProject() {
    if (!activeProject) return alertMsg('No project selected', 'error')
    const projectData = projects[activeProject]
    if (projects[activeProject][room]) return alertMsg('This map is already in the project', 'warn')
    const title = elem('maptitle').innerHTML.trim()
    if (title === 'Untitled map') {
        alertMsg('Please give your map a title before adding it to a project', 'warn')
        return
    }
    projectData[room] = title
    storeList()
    alertMsg(`Added ${title} to ${projectData.name}`, 'info')
}

/**
 * Prompts the user to confirm deletion of the active project, then removes
 * it from storage, re-renders the projects menu, and closes all panels.
 */
function deleteActiveProject() {
    if (!activeProject) return
    const projectName = projects[activeProject].name
    if (!confirm(`Are you sure you want to delete the project "${projectName}"?`)) return
    delete projects[activeProject]
    storeList()
    alertMsg(`Project ${projectName} deleted`, 'info')
    activeProject = null
    renderProjects()
    closeAll()
}

/**
 * Toggles the visibility of the main rooms/projects menu panel.
 * Adjusts the scroll-box max-height to fit within the network pane.
 * @param {MouseEvent} e - The triggering mouse event (propagation is stopped).
 */
export function showProjectsMenu(e) {
    e.stopPropagation()
    scrollBox.style.maxHeight = elem('net-pane').clientHeight - 20 + 'px'
    mainMenu.classList.toggle('show')
}

/**
 * Persists the current projects and maps objects to localStorage
 * under the 'recents' key as a single serialised JSON object.
 */
function storeList() {
    localStorage.setItem('recents', JSON.stringify({ projects: { ...projects }, ...maps }))
}

/**
 * User has clicked one of the previous map titles - confirm and change to the web page for that room
 * @param {HTMLDivElement} div The div element that was clicked, containing the room data attribute
 */
function changeRoom(div) {
    if (data.nodes.length > 0) {
        if (!confirm('Are you sure you want to move to a different map?')) return
    }
    closeAll()
    const url = new URL(document.location)
    url.search = div.dataset.room !== 'new' ? `?room=${div.dataset.room}` : ''
    window.location.replace(url)
}

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
    if (document.activeElement === projectNameInput) {
        if (e.key === 'Enter') elem('rm-modal-ok').click()
        if (e.key === 'Escape') elem('rm-modal-cancel').click()
        return
    }
    if (e.key === 'Delete' && projectMapsMenu.classList.contains('show')) deleteActiveProject()
})

const observer = new MutationObserver(() => {
    if (mainMenu.classList.contains('show')) scrollBox.scrollTop = 0
})
observer.observe(mainMenu, { attributes: true, attributeFilter: ['class'] })

elem('rm-modal-cancel').onclick = () => (modalOverlay.style.display = 'none')
modalOverlay.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
        modalOverlay.style.display = 'none'
    }
})
elem('rm-modal-ok').onclick = () => {
    const name = projectNameInput.value.trim()
    if (name) {
        projects[uuidv4()] = { name }
        renderProjects()
        alertMsg(`New project created: ${name}`, 'info')
        storeList()
    }
    modalOverlay.style.display = 'none'
}

elem('projectsTrigger').onmouseenter = (e) => {
    clearTimeout(closeTimer)
    const rect = e.currentTarget.getBoundingClientRect()
    projectsMenu.style.top = rect.top + 'px'
    projectsMenu.style.left = rect.right - 4 + 'px'
    projectsMenu.classList.add('show')
    projectMapsMenu.classList.remove('show')
}

elem('newMapTrigger').onclick = (e) => {
    e.stopPropagation()
    changeRoom(e.currentTarget)
}

elem('saveListToFileTrigger').onclick = (e) => {
    e.stopPropagation()
    const str = JSON.stringify({ projects: { ...projects }, ...maps })
    const blob = new Blob([str], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, 'PRSMMapList.prsml', { autoBom: true })
    statusMsg('Map list saved to file.  To read it back in, drag and drop it over the map', 'info')
}
/**
 * Loads a map list from a JSON string (e.g. from a dragged-and-dropped
 * `.prsml` file), replaces the in-memory projects and maps, persists
 * to localStorage, and re-renders both menus.
 * @param {string} str - A JSON string previously exported via the save trigger.
 */
export function loadMapList(str) {
    try {
        const obj = JSON.parse(str)
        if (obj.projects && Object.keys(obj).length > 1) {
            projects = obj.projects
            maps = clean(obj, { projects: true })
            storeList()
            renderProjects()
            renderMaps()
            alertMsg('Map list loaded successfully', 'info')
        } else {
            alertMsg('Invalid map list file', 'error')
        }
    } catch (e) {
        alertMsg('Error loading map list: ' + e.message, 'error')
    }
}

[mainMenu, projectsMenu, projectMapsMenu].forEach((panel) => {
    panel.onmouseenter = () => clearTimeout(closeTimer)
    panel.onmouseleave = (e) => {
        closeTimer = setTimeout(() => {
            const dest = e.relatedTarget
            if (![mainMenu, projectsMenu, projectMapsMenu].some((p) => p.contains(dest))) closeAll()
        }, 150)
    }
})

/**
 * Hides all three menu panels (main menu, projects flyout, project-maps flyout)
 * by removing the 'show' CSS class from each.
 */
function closeAll() {
    [mainMenu, projectsMenu, projectMapsMenu].forEach((m) => m.classList.remove('show'))
}
window.onclick = (e) => {
    if (e.target.id !== 'mapsTrigger') closeAll()
}