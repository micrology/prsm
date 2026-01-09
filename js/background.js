/********************************************************************************************* 

PRSM Participatory System Mapper 

MIT License

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.

This module provides the background object-oriented drawing for PRSM
********************************************************************************************/

import { doc, debug, yDrawingMap, network, cp, drawingSwitch, yPointsArray, fit } from './prsm.js'
import {
  Canvas,
  FabricObject,
  InteractiveFabricObject,
  Rect,
  Circle,
  Line,
  IText,
  Path,
  FabricImage,
  ActiveSelection,
  Group,
  Point,
  PencilBrush,
} from 'fabric'
import {
  elem,
  uuidv4,
  clean,
  deepCopy,
  dragElement,
  alertMsg,
  addContextMenu,
} from '../js/utils.js'

// create a wrapper around native canvas element
export const canvas = new Canvas('drawing-canvas', {
  enablePointerEvents: true,
  stopContextMenu: true,
  fireRightClick: true,
  uniformScaling: true,
  preserveObjectStacking: true,
})
window.canvas = canvas

let selectedTool = null //the id of the currently selected tool
let currentObject = null // the object implementing the tool currently selected, if any

let undos = [] // stack of user changes to objects for undo
let redos = [] // stack of undos for redoing

export let nChanges = 0 // incremented when the background is amended

/**
 * Initialise the canvas and toolbox
 */
export function setUpBackground() {
  resizeCanvas()
  initDraw()
}
//listen('drawing-canvas', 'keydown', checkKey)

/**
 * resize the drawing canvas when the window changes size
 */
export function resizeCanvas() {
  const underlay = elem('underlay')
  const oldWidth = canvas.getWidth()
  const oldHeight = canvas.getHeight()
  zoomCanvas(1.0)
  canvas.setDimensions({ width: underlay.offsetWidth, height: underlay.offsetHeight })
  canvas.calcOffset()
  panCanvas((canvas.getWidth() - oldWidth) / 2, (canvas.getHeight() - oldHeight) / 2, 1.0)
  zoomCanvas(network ? network.getScale() : 1)
  canvas.requestRenderAll()
}

/**
 * zoom the canvas, zooming from the canvas centre
 * @param {float} zoom
 */
export function zoomCanvas(zoom) {
  canvas.zoomToPoint({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }, zoom)
}

/**
 * pan the canvas by the given amount
 * @param {float} x - the x distance to pan
 * @param {float} y - the y distance to pan
 * @param {float} zoom - the zoom level
 */
export function panCanvas(x, y, zoom) {
  zoom = zoom || network.getScale()
  canvas.relativePan(new Point(x * zoom, y * zoom))
}

/**
 * set up the fabric context, the grid drawn on it and the tools
 */
function initDraw() {
  InteractiveFabricObject.ownDefaults = {
    ...InteractiveFabricObject.ownDefaults,
    transparentCorners: false,
    cornerColor: 'blue',
    cornerSize: 5,
    cornerStyle: 'circle',
  }
  if (drawingSwitch) drawGrid()
  setUpToolbox()
  canvas.setViewportTransform([1, 0, 0, 1, canvas.getWidth() / 2, canvas.getHeight() / 2])
  initAligningGuidelines()
}
/**
 * redraw the objects on the canvas and the grid
 */
export function redraw() {
  canvas.requestRenderAll()
  if (drawingSwitch) drawGrid()
}

/**
 * observe remote changes, sent as a set of parameters that are used to update
 * the existing or new basic Fabric objects
 * Also import the remote undo and redo stacks
 *
 * @param {object} event
 */
export function updateFromRemote(event) {
  if (event.transaction.local === false && event.keysChanged.size > 0) {
    //oddly, keys changed includes old, cleared keys, so use this instead.
    refreshFromMap([...event.changes.keys.keys()])
  }
}
/**
 * redisplay the objects on the canvas, using the data in yDrawingMap
 */
export function updateFromDrawingMap() {
  canvas.clear()
  refreshFromMap([...yDrawingMap.keys()])
}
/**
 * add or refresh objects that have the given list of id, using data in yDrawingMap
 * @param {array} keys
 */
export async function refreshFromMap(keys) {
  if (/back/.test(debug)) {
    keys.forEach((key) => console.log('Key:', key, 'value:', yDrawingMap.get(key)))
  }

  for (const key of keys) {
    /* active Selection and group have to be dealt with last, because they reference objects that may
     * not have been put on the canvas yet */
    const remoteParams = yDrawingMap.get(key)
    if (!remoteParams) {
      console.error('Empty remoteParams in refreshFromMap()', key)
      continue
    }
    const { type, ...otherParams } = remoteParams
    switch (key) {
      case 'undos': {
        undos = deepCopy(remoteParams)
        updateActiveButtons()
        continue
      }
      case 'redos': {
        redos = deepCopy(remoteParams)
        updateActiveButtons()
        continue
      }
      case 'sequence':
        continue
      case 'activeSelection':
      case 'ActiveSelection':
        continue
      default: {
        let localObj = canvas.getObjects().find((o) => o.id === key)
        // if object already exists, update it
        if (localObj) {
          switch (type) {
            case 'group':
            case 'Group':
              break
            case 'ungroup': {
              const items = localObj.removeAll() // returns the constituent objects
              canvas.remove(localObj) // remove the group
              items.forEach((obj) => canvas.add(obj)) // add the constituent objects back to the canvas
              break
            }
            case 'activeSelection':
            case 'ActiveSelection':
              break
            default:
              localObj.set(otherParams)
              break
          }
        } else {
          // create a new object
          switch (type) {
            case 'rect':
            case 'Rect':
              localObj = new RectHandler()
              break
            case 'circle':
            case 'Circle':
              localObj = new CircleHandler()
              break
            case 'line':
            case 'Line':
              localObj = new LineHandler()
              break
            case 'text':
            case 'IText':
              localObj = new TextHandler()
              break
            case 'path':
            case 'Path':
              localObj = new Path()
              break
            case 'image':
            case 'Image': {
              FabricImage.fromObject(remoteParams.imageObj).then((image) => {
                image.setCoords()
                image.id = key
                canvas.add(image)
              })
              continue
            }
            case 'group':
            case 'Group':
              continue
            case 'ungroup':
              continue
            case 'activeSelection':
            case 'ActiveSelection':
              continue
            default:
              throw new Error(`bad fabric object type in yDrawingMap.observe: ${type}`)
          }
          localObj.set(otherParams)
          localObj.id = key
          canvas.add(localObj)
        }
        localObj.setCoords()
      }
    }
  }

  // now that ordinary objects are done, deal with groups and active selections
  for (const key of keys) {
    const remoteParams = yDrawingMap.get(key)
    if (remoteParams) {
      switch (remoteParams.type) {
        case 'group':
        case 'Group': {
          const existingGroup = canvas.getObjects().find((o) => o.id === remoteParams.id)
          canvas.discardActiveObject()
          if (existingGroup) {
            const items = canvas.getObjects()[0].removeAll()
            // translate the object coordinates from local to the group to canvas coordinates
            const asLeft = remoteParams.left
            const asTop = remoteParams.top
            const asHalfWidth = remoteParams.width / 2
            const asHalfHeight = remoteParams.height / 2
            // Update each object's coordinates
            for (const i in remoteParams.members) {
              // its current location as a position relative to the group
              const obj = remoteParams.objects[i]
              // and the object on the canvas
              const item = items[i]
              item.set({
                left: obj.left + asLeft + asHalfWidth,
                top: obj.top + asTop + asHalfHeight,
              })
              item.setCoords()
              canvas.add(item)
            }
            canvas.remove(existingGroup)
          }
          const objectsInGroup = canvas
            .getObjects()
            .filter((obj) => remoteParams.members.includes(obj.id))
          objectsInGroup.forEach((obj) => canvas.remove(obj))
          const group = new Group(objectsInGroup)
          group.id = key
          // give the new group the required position etc., but don't overwrite the layoutManager or the type
          group.set(clean(remoteParams, { layoutManager: true, type: true }))
          group.members = remoteParams.members
          setGroupBorderColor(group)
          canvas.add(group)
          if (group.get('visible')) canvas.setActiveObject(group)
          break
        }
        case 'ActiveSelection':
        case 'activeSelection': {
          /* An active selection has canvas coordinates for its location and size, and
          the objects it includes have their positions set relative to the active selection.
          Thus to locate the objects relative to the canvas, we have to transform their coordinates.
          remoteParams provides the location and dimensions of the ActiveSelection, the ids of
          the selected objects, and copies of the selected objects (but these are missing their ids) */
          if (canvas.getActiveObject()) canvas.discardActiveObject()
          const asLeft = remoteParams.left
          const asTop = remoteParams.top
          const asHalfWidth = remoteParams.width / 2
          const asHalfHeight = remoteParams.height / 2

          // Update each object's coordinates
          for (const i in remoteParams.members) {
            // for each selected object, its id
            const id = remoteParams.members[i]
            // its current location as a relative position
            const obj = remoteParams.objects[i]
            // and the fabric object on the canvas
            const fabricObj = canvas.getObjects().find((o) => o.id === id)
            fabricObj.set({
              left: obj.left + asLeft + asHalfWidth,
              top: obj.top + asTop + asHalfHeight,
            })
            fabricObj.setCoords()
          }
          break
        }
        default:
          break
      }
    }
  }
  // and lastly reorder the objects if necessary
  if (keys.includes('sequence')) {
    const remoteParams = yDrawingMap.get('sequence')
    remoteParams.forEach((id) => {
      const obj = canvas.getObjects().find((o) => o.id === id)
      if (obj) canvas.bringObjectToFront(obj)
    })
  }

  // if at start up, so not in drawing mode, don't show active selection borders
  if (!drawingSwitch) canvas.discardActiveObject()
  canvas.requestRenderAll()
}

/**
 * Draw the background grid before rendering the fabric objects
 */
canvas.on('before:render', () => {
  if (drawingSwitch) drawGrid()
  canvas.clearContext(canvas.contextTop)
})
canvas.on('selection:created', (e) => updateSelection(e))
canvas.on('selection:updated', (e) => updateSelection(e))

/**
 * update toolbox when user has selected more than 1 object
 * @param {canvasEvent} evt
 */
function updateSelection(evt) {
  // only process updates caused by user (if evt.e is undefined, the update has been generated by remote activity)
  if (evt.e) {
    // ignore updates if user is in the middle of creating an object and happens to click on this one
    if (selectedTool) return
    const activeObject = canvas.getActiveObject()
    const activeMembers = canvas.getActiveObjects()
    // only record selections with more than 1 member object
    if (activeObject.type === 'activeselection' && activeMembers.length > 1) {
      if (!activeObject.id) activeObject.id = uuidv4()
      activeObject.members = activeMembers.map((o) => o.id)
    }
    if (activeMembers.length > 1) {
      closeOptionsDialogs()
    } else {
      if (evt.selected && evt.selected.length > 0 && evt.selected[0].type) {
        if (evt.selected[0].type !== selectedTool) closeOptionsDialogs()
        // no option possible when selecting path, group or image
        if (!['path', 'group', 'image'].includes(evt.selected[0].type)) {
          evt.selected[0].optionsDialog()
        }
      }
    }
    updateActiveButtons()
  }
}

// save changes and update state when user has unselected all objects
canvas.on('selection:cleared', (evt) => {
  if (!evt.e) return // ignore updates generated by remote activity
  deselectTool()
  // only allow deletion of selected objects
  elem('bin').classList.add('disabled')
  elem('group').classList.add('disabled')
})

// user has just finished creating a path (with pencil or marker) - save it
canvas.on('path:created', () => {
  const obj = getLastPath()
  obj.id = uuidv4()
  saveChange(
    obj,
    {
      path: obj.path,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      pathOffset: obj.pathOffset,
      fill: null,
    },
    'insert'
  )
})

// record object moves on undo stack and broadcast them
canvas.on('object:modified', (rec) => {
  const obj = rec.target
  if (!obj.id) obj.id = uuidv4()
  saveChange(obj, { id: obj.id }, 'update')
})

/**
 * draw a grid on the drawing canvas
 * @param {Integer} gridSize - pixels between grid lines
 */
/* eslint-disable camelcase */
function drawGrid(grid_size = 25) {
  const grid_context = elem('drawing-canvas').getContext('2d')
  const currentCanvasWidth = canvas.getWidth()
  const currentCanvasHeight = canvas.getHeight()

  grid_context.save()
  grid_context.clearRect(0, 0, currentCanvasWidth, currentCanvasHeight)
  grid_context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  // Drawing vertical lines
  for (let x = 0; x <= currentCanvasWidth; x += grid_size) {
    grid_context.beginPath()
    grid_context.moveTo(x + 0.5, 0)
    grid_context.lineTo(x + 0.5, currentCanvasHeight)
    grid_context.stroke()
  }

  // Drawing horizontal lines
  for (let y = 0; y <= currentCanvasHeight; y += grid_size) {
    grid_context.beginPath()
    grid_context.moveTo(0, y + 0.5)
    grid_context.lineTo(currentCanvasWidth, y + 0.5)
    grid_context.stroke()
  }
  grid_context.restore()
}
/* eslint-enable camelcase */
/**
 * add event listeners to the tools to receive user clicks to select a tool
 */
function setUpToolbox() {
  const tools = document.querySelectorAll('.tool')
  Array.from(tools).forEach((tool) => {
    tool.addEventListener('click', selectTool)
  })
  dragElement(elem('toolbox'), elem('toolbox-header'))
}
/**
 *
 * Toolbox
 *
 */

/**
 * When the user clicks a tool icon
 * unselect previous tool, select this one
 * and remember which tool is now selected
 * The undo, redo, delete and image tools are special, because they act
 * immediately when the icon is clicked
 * @param {object} event - the click event
 */
function selectTool(event) {
  const tool = event.currentTarget
  if (tool.id === 'undotool') {
    currentObject = null
    toolHandler('undo').undo()
    return
  }
  if (tool.id === 'redotool') {
    currentObject = null
    toolHandler('undo').redo()
    return
  }
  if (tool.id === 'group') {
    currentObject = null
    const activeObj = canvas.getActiveObject()
    if (!activeObj) return
    if (activeObj.type === 'group') unGroup()
    else makeGroup()
    return
  }
  if (tool.id === 'bin') {
    currentObject = null
    toolHandler('bin').delete()
    return
  }
  //second click on selected tool - unselect it
  if (selectedTool === tool.id) {
    deselectTool()
    return
  }
  // changing tool; unselect previous one
  deselectTool()
  selectedTool = tool.id
  tool.classList.add('selected')
  // display options dialog
  // first hide the tool tip, which gets in the way of the options dialog
  tool.childNodes[3].style.visibility = 'hidden'
  const handler = toolHandler(selectedTool)
  handler.optionsDialog()
  canvas.isDrawingMode = tool.id === 'pencil' || tool.id === 'marker'
  // initialize brush for pencil and marker tools
  if (canvas.isDrawingMode) {
    canvas.freeDrawingBrush = new PencilBrush(canvas)
    canvas.freeDrawingBrush.width = handler.width
    canvas.freeDrawingBrush.color = handler.color
  }
  // if tool is 'image', get image file from user
  if (tool.id === 'image') {
    const fileInput = document.createElement('input')
    fileInput.id = 'fileInput'
    fileInput.setAttribute('type', 'file')
    fileInput.setAttribute('accept', 'image/*')
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        toolHandler(selectedTool).loadImage(e)
      } else {
        // User didn't select a file - deselect the tool
        deselectTool()
      }
    })
    fileInput.addEventListener('cancel', () => {
      deselectTool()
    })
    fileInput.click()
  }
}

/**
 * unmark the selected tool, unselect the active object,
 * close the option dialog and set tool to null
 */
export function deselectTool() {
  unselectTool()
  canvas.isDrawingMode = false
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  closeOptionsDialogs()
  updateActiveButtons()
}
/**
 * unselect the current tool and close any option dialogs
 */
function unselectTool() {
  if (selectedTool) {
    const el = elem(selectedTool)
    el.classList.remove('selected')
    el.childNodes[3].style.visibility = 'hidden'
  }
  closeOptionsDialogs()
  selectedTool = null
  currentObject = null
}
/**
 * remove any option dialog that is open and currently displayed
 */
function closeOptionsDialogs() {
  const box = elem('optionsBox')
  if (box) box.remove()
}
/**
 * show whether some buttons are active or disabled, depending
 * on whether anything is selected and whether undo or redo is possible
 */
function updateActiveButtons() {
  if (undos.length > 0) elem('undotool').classList.remove('disabled')
  else elem('undotool').classList.add('disabled')
  if (redos.length > 0) elem('redotool').classList.remove('disabled')
  else elem('redotool').classList.add('disabled')
  const nActiveObjects = canvas.getActiveObjects().length
  if (nActiveObjects > 0) elem('bin').classList.remove('disabled')
  else elem('bin').classList.add('disabled')
  if (nActiveObjects > 1) elem('group').classList.remove('disabled')
  else {
    if (canvas.getActiveObject()?.type === 'group') elem('group').classList.remove('disabled')
    else elem('group').classList.add('disabled')
  }
}
/**
 * return the correct instance of toolHandler for the given tool
 * @param {string} tool - the tool id
 * @returns {object} the tool handler instance
 */
function toolHandler(tool) {
  if (currentObject) return currentObject
  switch (tool) {
    case 'rect':
      currentObject = new RectHandler()
      break
    case 'circle':
      currentObject = new CircleHandler()
      break
    case 'line':
      currentObject = new LineHandler()
      break
    case 'text':
      currentObject = new TextHandler()
      break
    case 'pencil':
      currentObject = new PencilHandler()
      break
    case 'marker':
      currentObject = new MarkerHandler()
      break
    case 'image':
      currentObject = new ImageHandler()
      break
    case 'bin':
      currentObject = new DeleteHandler()
      break
    case 'undo':
      currentObject = new UndoHandler()
      break
  }
  return currentObject
}

/**
 * react to key presses and mouse movements
 */

// backspace = delete selected object
window.addEventListener('keydown', (e) => {
  if ((drawingSwitch && e.key === 'Backspace') || e.key === 'Delete') {
    const obj = canvas.getActiveObject()
    if (obj && !obj.isEditing) {
      e.preventDefault()
      currentObject = null
      toolHandler('bin').delete()
    }
  }
})
// ctrl+z = undo
window.addEventListener('keydown', (e) => {
  if (drawingSwitch && (e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    currentObject = null
    toolHandler('undo').undo()
  }
})
// ctrl+y = redo
window.addEventListener('keydown', (e) => {
  if (drawingSwitch && (e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    currentObject = null
    toolHandler('undo').redo()
  }
})
// arrow keys move selected object
window.addEventListener('keydown', (e) => {
  if (drawingSwitch && e.key === 'ArrowUp') {
    e.preventDefault()
    arrowMove('ArrowUp')
  }
})
window.addEventListener('keydown', (e) => {
  if (drawingSwitch && e.key === 'ArrowDown') {
    e.preventDefault()
    arrowMove('ArrowDown')
  }
})
window.addEventListener('keydown', (e) => {
  if (drawingSwitch && e.key === 'ArrowLeft') {
    e.preventDefault()
    arrowMove('ArrowLeft')
  }
})
window.addEventListener('keydown', (e) => {
  if (drawingSwitch && e.key === 'ArrowRight') {
    e.preventDefault()
    arrowMove('ArrowRight')
  }
})
/**
 *  handle mouse moves, despatching to tools or panning the canvas
 */

canvas.on('mouse:down', function (options) {
  const event = options.e
  // if right click on an object, display 'Send to back/front' popup menu
  if (event.button === 2) {
    if (options.target) {
      addContextMenu(event.target, [
        { label: 'Send to back', action: () => sendToBack(options.target) },
        { label: 'Bring to front', action: () => bringToFront(options.target) },
      ])
    }
    return
  }
  if (selectedTool) {
    toolHandler(selectedTool)[event.type](event)
  } else {
    if (!canvas.getActiveObject()) {
      this.isDragging = true
      this.selection = false
      this.lastPosX = event.clientX
      this.lastPosY = event.clientY
      this.defaultCursor = 'grabbing'
      this.setCursor(this.defaultCursor)
    }
  }
})

/**
 * send the given object to the back of the canvas
 * @param {fabric.Object} obj - the fabric object to send to back
 */
function sendToBack(obj) {
  canvas.sendObjectToBack(obj)
  saveChange(obj, {}, 'insert)')
}

/**
 * bring the given object to the front of the canvas
 * @param {fabric.Object} obj - the fabric object to bring to front
 */
function bringToFront(obj) {
  canvas.bringObjectToFront(obj)
  saveChange(obj, {}, 'insert)')
}

canvas.on('mouse:move', function (options) {
  const event = options.e
  if (selectedTool) {
    toolHandler(selectedTool)[event.type](event)
  } else {
    if (this.isDragging) {
      event.stopImmediatePropagation()
      const vpt = this.viewportTransform
      const moveX = event.clientX - this.lastPosX
      const moveY = event.clientY - this.lastPosY
      vpt[4] += moveX
      vpt[5] += moveY
      const networkVP = network.getViewPosition()
      network.moveTo({
        position: {
          x: networkVP.x - moveX / vpt[0],
          y: networkVP.y - moveY / vpt[0],
        },
      })
      this.requestRenderAll()
      this.lastPosX = event.clientX
      this.lastPosY = event.clientY
    }
  }
})
canvas.on('mouse:up', function (options) {
  const event = options.e
  if (selectedTool) {
    toolHandler(selectedTool)[event.type](event)
    closeOptionsDialogs()
    updateActiveButtons()
  } else {
    this.setViewportTransform(this.viewportTransform)
    this.isDragging = false
    this.selection = true
    this.defaultCursor = 'default'
    this.setCursor(this.defaultCursor)
  }
})
canvas.on('mouse:dblclick', () => fit())

const ARROWINCR = 1

/**
 * cSpell: ignore ARROWINCR
 * move the selected object by ARROWINCR in the given direction
 * @param {string} direction - 'ArrowUp', 'ArrowDown', 'ArrowLeft', or 'ArrowRight'
 */
function arrowMove(direction) {
  const activeObj = canvas.getActiveObject()
  if (!activeObj) return
  let top = activeObj.top
  let left = activeObj.left
  switch (direction) {
    case 'ArrowUp':
      top -= ARROWINCR
      break
    case 'ArrowDown':
      top += ARROWINCR
      break
    case 'ArrowLeft':
      left -= ARROWINCR
      break
    case 'ArrowRight':
      left += ARROWINCR
      break
  }
  activeObj.set({ left, top })
  activeObj.setCoords()
  saveChange(activeObj, {}, 'update')
  canvas.requestRenderAll()
}

/**
 * Create an HTMLElement that will hold the options dialog
 * @param {String} tool
 * @returns HTMLElement
 */
function makeOptionsDialog(tool) {
  if (!tool) return
  const underlay = elem('underlay')
  const box = document.createElement('div')
  box.className = 'options'
  box.id = 'optionsBox'
  box.style.top = `${elem(tool).getBoundingClientRect().top - underlay.getBoundingClientRect().top}px`
  box.style.left = `${elem(tool).getBoundingClientRect().right + 10}px`
  underlay.appendChild(box)
  return box
}

/***************************************** Rect ********************************************/
const cornerRadius = 10 // radius of rounded corners for rounded rectangle

class RectHandler extends Rect {
  constructor() {
    super({
      fill: '#ffffff',
      strokeWidth: 1,
      stroke: '#000000',
      strokeUniform: true,
    })
    this.dragging = false
    this.roundCorners = cornerRadius
    this.id = uuidv4()
    this.strokeUniform = true
  }

  pointerdown(e) {
    this.setParams()
    this.dragging = true
    this.start = canvas.getScenePoint(e)
    this.left = this.start.x
    this.top = this.start.y
    this.width = 0
    this.height = 0
    this.rx = this.roundCorners
    this.ry = this.roundCorners
    canvas.add(this)
    canvas.selection = false
  }

  pointermove(e) {
    if (!this.dragging) return
    const pointer = canvas.getScenePoint(e)
    // allow rect to be drawn from bottom right corner as well as from top left corner
    const left = Math.min(this.start.x, pointer.x)
    const top = Math.min(this.start.y, pointer.y)
    this.set({
      left,
      top,
      width: Math.abs(this.start.x - pointer.x),
      height: Math.abs(this.start.y - pointer.y),
    })
    canvas.requestRenderAll()
  }

  pointerup() {
    this.dragging = false
    currentObject = null
    if (this.width && this.height) {
      saveChange(
        this,
        {
          rx: this.rx,
          ry: this.ry,
          fill: this.fill,
          strokeWidth: this.strokeWidth,
          stroke: this.stroke,
        },
        'insert'
      )
      canvas.selection = true
      canvas.setActiveObject(this)
    }
    canvas.requestRenderAll()
    unselectTool()
  }

  update() {
    this.setParams()
    saveChange(
      this,
      {
        rx: this.rx,
        ry: this.ry,
        fill: this.fill,
        strokeWidth: this.strokeWidth,
        stroke: this.stroke,
      },
      'update'
    )
  }

  setParams() {
    if (!elem('optionsBox')) return
    this.roundCorners = elem('rounded').checked ? cornerRadius : 0
    let fill = elem('fillColor').style.backgroundColor
    // make white transparent
    if (fill === 'rgb(255, 255, 255)') fill = 'rgba(0, 0, 0, 0)'
    this.set({
      rx: this.roundCorners,
      ry: this.roundCorners,
      fill,
      strokeWidth: parseInt(elem('borderWidth').value),
      stroke: elem('borderColor').style.backgroundColor,
    })
    canvas.requestRenderAll()
  }

  optionsDialog() {
    if (elem('optionsBox')) return
    this.box = makeOptionsDialog('rect')
    this.box.innerHTML = `
	<div>Border width</div><div><input id="borderWidth"  type="number" min="0" max="99" size="2"></div>
	<div>Border Colour</div><div class="input-color-container">
		<div class="color-well" id="borderColor"></div>
	</div>	
  	<div>Fill Colour</div><div class="input-color-container">
  		<div class="color-well" id="fillColor"></div>
	</div>
	<div>Rounded</div><input type="checkbox" id="rounded"></div>`
    cp.createColorPicker(
      'fillColor',
      () => this.update(),
      () => this.setParams()
    )
    cp.createColorPicker(
      'borderColor',
      () => this.update(),
      () => this.setParams()
    )
    const widthInput = elem('borderWidth')
    widthInput.value = this.strokeWidth
    widthInput.addEventListener('change', () => {
      this.update()
    })
    const borderColor = elem('borderColor')
    borderColor.style.backgroundColor = this.stroke
    const fillColor = elem('fillColor')
    fillColor.style.backgroundColor = this.fill
    const rounded = elem('rounded')
    rounded.checked = this.roundCorners !== 0
    rounded.addEventListener('change', () => {
      this.update()
    })
  }
}
/******************************************* Circle ********************************************/

class CircleHandler extends Circle {
  constructor() {
    super({
      fill: '#ffffff',
      strokeWidth: 1,
      stroke: '#000000',
      strokeUniform: true,
    })
    this.dragging = false
    this.id = uuidv4()
    this.originX = 'left'
    this.originY = 'top'
  }

  pointerdown(e) {
    this.setParams()
    this.dragging = true
    this.start = canvas.getScenePoint(e)
    this.left = this.start.x
    this.top = this.start.y
    this.radius = 0
    canvas.add(this)
    canvas.selection = false
  }

  pointermove(e) {
    if (!this.dragging) return
    const pointer = canvas.getScenePoint(e)
    // allow drawing from bottom right corner as well as from top left corner
    const left = Math.min(this.start.x, pointer.x)
    const top = Math.min(this.start.y, pointer.y)
    this.set({
      left,
      top,
      radius: Math.sqrt((this.start.x - pointer.x) ** 2 + (this.start.y - pointer.y) ** 2) / 2,
    })
    canvas.requestRenderAll()
  }

  pointerup() {
    this.dragging = false
    currentObject = null
    if (this.radius > 0) {
      saveChange(
        this,
        {
          fill: this.fill,
          strokeWidth: this.strokeWidth,
          stroke: this.stroke,
          radius: this.radius,
        },
        'insert'
      )
      canvas.selection = true
      canvas.setActiveObject(this)
    }
    canvas.requestRenderAll()
    unselectTool()
  }

  update() {
    this.setParams()
    saveChange(
      this,
      { fill: this.fill, strokeWidth: this.strokeWidth, stroke: this.stroke },
      'update'
    )
  }

  setParams() {
    if (!elem('optionsBox')) return
    let fill = elem('fillColor').style.backgroundColor
    // make white transparent
    if (fill === 'rgb(255, 255, 255)') fill = 'rgba(0, 0, 0, 0)'
    this.set({
      fill,
      strokeWidth: parseInt(elem('borderWidth').value),
      stroke: elem('borderColor').style.backgroundColor,
    })
    canvas.requestRenderAll()
  }

  optionsDialog() {
    if (elem('optionsBox')) return
    this.box = makeOptionsDialog('circle')
    this.box.innerHTML = `
	<div>Border width</div><div><input id="borderWidth"  type="number" min="0" max="99" size="2"></div>
	<div>Border Colour</div><div class="input-color-container">
		<div class="color-well" id="borderColor"></div>
	</div>	
  	<div>Fill Colour</div><div class="input-color-container">
  		<div class="color-well" id="fillColor"></div>
	</div>`
    cp.createColorPicker(
      'fillColor',
      () => this.update(),
      () => this.setParams()
    )
    cp.createColorPicker(
      'borderColor',
      () => this.update(),
      () => this.setParams()
    )
    const widthInput = elem('borderWidth')
    widthInput.value = this.strokeWidth
    widthInput.addEventListener('change', () => {
      this.update()
    })
    const borderColor = elem('borderColor')
    borderColor.style.backgroundColor = this.stroke
    const fillColor = elem('fillColor')
    fillColor.style.backgroundColor = this.fill
  }
}
/******************************************* Line ********************************************/
class LineHandler extends Line {
  constructor() {
    super([0, 0, 0, 0], {
      strokeWidth: 1,
      stroke: '#000000',
      strokeUniform: true,
    })
    this.dragging = false
    this.axes = false
    this.dashed = false
    this.id = uuidv4()
    this.stroke = '#000000'
    this.strokeWidth = 2
    this.strokeUniform = true
  }

  pointerdown(e) {
    this.setParams()
    this.dragging = true
    canvas.selection = false
    this.start = canvas.getScenePoint(e)
    this.set({
      x1: this.start.x,
      y1: this.start.y,
      x2: this.start.x,
      y2: this.start.y,
    })
    canvas.add(this)
  }

  pointermove(e) {
    if (!this.dragging) return
    const endPoint = canvas.getScenePoint(e)
    let x2 = endPoint.x
    let y2 = endPoint.y
    const x1 = this.start.x
    const y1 = this.start.y
    if (this.axes) {
      if (x2 - x1 > y2 - y1) y2 = y1
      else x2 = x1
    }
    this.set({ x1, y1, x2, y2 })
    canvas.requestRenderAll()
  }

  pointerup() {
    this.dragging = false
    currentObject = null
    if (this.x1 === this.x2 && this.y1 === this.y2) {
      unselectTool()
      return
    }
    saveChange(
      this,
      {
        axes: this.axes,
        strokeWidth: this.strokeWidth,
        stroke: this.stroke,
        strokeDashArray: this.strokeDashArray,
      },
      'insert'
    )
    canvas.selection = true
    canvas.setActiveObject(this)
    canvas.requestRenderAll()
    unselectTool()
  }

  update() {
    this.setParams()
    saveChange(
      this,
      {
        axes: this.axes,
        strokeWidth: this.strokeWidth,
        stroke: this.stroke,
        strokeDashArray: this.strokeDashArray,
      },
      'update'
    )
  }

  setParams() {
    if (!elem('optionsBox')) return
    this.axes = elem('axes').checked
    if (this.axes) {
      if (this.x2 - this.x1 > this.y2 - this.y1) this.y2 = this.y1
      else this.x2 = this.x1
      this.set({ x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 })
    }
    // if line is constrained to horizontal/vertical (axes is true),
    // don't display a rotate control point
    this.setControlsVisibility({
      mtr: !this.axes,
      bl: false,
      br: true,
      mb: false,
      ml: false,
      mr: false,
      mt: false,
      tl: true,
      tr: false,
    })
    this.set({
      strokeWidth: parseInt(elem('lineWidth').value),
      stroke: elem('lineColor').style.backgroundColor,
      strokeDashArray: elem('dashed').checked ? [10, 10] : null,
    })
    canvas.requestRenderAll()
  }

  optionsDialog() {
    if (elem('optionsBox')) return
    this.box = makeOptionsDialog('line')
    this.box.innerHTML = `
	<div>Line width</div><div><input id="lineWidth" type="number" min="0" max="99" size="1"></div>
	<div>Colour</div><div class="input-color-container">
		<div class="color-well" id="lineColor"></div>
	</div>
	<div>Dashed</div><div><input type="checkbox" id="dashed"></div>
	<div>Vert/Horiz</div><div><input type="checkbox" id="axes"></div>`
    cp.createColorPicker(
      'lineColor',
      () => this.update(),
      () => this.setParams()
    )
    const widthInput = elem('lineWidth')
    widthInput.value = this.strokeWidth
    widthInput.addEventListener('change', () => {
      this.update()
    })
    const lineColor = elem('lineColor')
    lineColor.style.backgroundColor = this.stroke
    const dashed = elem('dashed')
    dashed.checked = this.strokeDashArray
    dashed.addEventListener('change', () => {
      this.update()
    })
    const axes = elem('axes')
    axes.checked = this.axes
    this.setControlsVisibility(this.axes)
    axes.addEventListener('change', () => {
      this.update()
    })
  }
}

/**************************************** Text ********************************************/

class TextHandler extends IText {
  constructor() {
    super('Text', {
      fontSize: 32,
      fill: '#000000',
      fontFamily: 'Oxygen',
    })
    this.id = uuidv4()
  }

  pointerdown(e) {
    this.setParams()
    this.start = canvas.getScenePoint(e)
    this.left = this.start.x
    this.top = this.start.y
    this.fontFamily = 'Oxygen'
    canvas.add(this)
    canvas.setActiveObject(this)
    canvas.requestRenderAll()
    unselectTool()
    this.enterEditing()
    this.selectAll()
    this.on('editing:exited', () => {
      saveChange(
        this,
        {
          fontSize: this.fontSize,
          fill: this.fill,
          fontFamily: 'Oxygen',
          text: this.text,
        },
        'insert'
      )
    })
  }

  pointermove() { }

  pointerup() { }

  update() {
    this.setParams()
    saveChange(this, { fontSize: this.fontSize, fill: this.fill, text: this.text }, 'update')
  }

  setParams() {
    if (!elem('optionsBox')) return
    this.set({
      fontSize: parseInt(elem('fontSize').value),
      fill: elem('fontColor').style.backgroundColor,
    })
    canvas.requestRenderAll()
  }

  optionsDialog() {
    if (!elem('optionsBox')) {
      this.box = makeOptionsDialog('text')
      this.box.innerHTML = `
	<div>Size</div><div><input id="fontSize"  type="number" min="0" max="99" size="2"></div>
	<div>Colour</div><div class="input-color-container">
		<div class="color-well" id="fontColor"></div>
	</div>`
      cp.createColorPicker(
        'fontColor',
        () => this.update(),
        () => this.setParams()
      )
    }
    const fontSizeInput = elem('fontSize')
    fontSizeInput.value = parseInt(this.fontSize)
    fontSizeInput.addEventListener('change', () => {
      this.update()
    })
    const fontColor = elem('fontColor')
    fontColor.style.backgroundColor = this.fill
  }
}

/***************************************** Pencil ********************************************/

class PencilHandler extends FabricObject {
  constructor() {
    super({ width: 1, color: '#000000' })
    this.width = 1
    this.color = '#000000'
  }

  pointerdown() {
    this.setParams()
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = this.width
      canvas.freeDrawingBrush.color = this.color
    }
  }

  pointermove() { }

  pointerup() { }

  update() {
    this.setParams()
    const pathObj = getLastPath()
    saveChange(pathObj, { path: pathObj.path }, 'update')
  }

  setParams() {
    if (!elem('optionsBox')) return
    this.width = parseInt(elem('pencilWidth').value)
    this.color = elem('pencilColor').style.backgroundColor
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = this.width
      canvas.freeDrawingBrush.color = this.color
    }
    canvas.requestRenderAll()
  }

  optionsDialog() {
    if (!elem('optionsBox')) {
      this.box = makeOptionsDialog('pencil')
      this.box.innerHTML = `
		<div>Width</div><div><input id="pencilWidth"  type="number" min="0" max="99" size="2"></div>
		<div>Colour</div><div class="input-color-container">
			<div class="color-well" id="pencilColor"></div>
		</div>`
      cp.createColorPicker(
        'pencilColor',
        () => this.update(),
        () => this.setParams()
      )
    }
    const widthInput = document.getElementById('pencilWidth')
    widthInput.value = this.width
    widthInput.addEventListener('change', () => {
      this.update()
    })
    const pencilColor = document.getElementById('pencilColor')
    pencilColor.style.backgroundColor = this.color
  }
}

/***************************************** Marker ********************************************/

class MarkerHandler extends FabricObject {
  constructor() {
    super({
      width: 30,
      color: 'rgba(249, 255, 71, 0.5)',
      strokeLineCap: 'square',
      strokeLineJoin: 'bevel',
    })
    this.width = 30
    this.color = 'rgba(249, 255, 71, 0.5)'
  }

  pointerdown() {
    this.setParams()
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = this.width
      canvas.freeDrawingBrush.color = this.color
    }
  }

  pointermove() { }

  pointerup() { }

  update() {
    this.setParams()
    const pathObj = getLastPath()
    saveChange(pathObj, { path: pathObj.path }, 'update')
  }

  setParams() {
    if (!elem('optionsBox')) return
    this.width = parseInt(elem('pencilWidth').value)
    this.color = elem('pencilColor').style.backgroundColor
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = this.width
      canvas.freeDrawingBrush.color = this.color
    }
    canvas.requestRenderAll()
  }

  optionsDialog() {
    if (!elem('optionsBox')) {
      this.box = makeOptionsDialog('marker')
      this.box.innerHTML = `		
			<div>Width</div><div><input id="pencilWidth"  type="number" min="0" max="99" size="2"></div>
			<div>Colour</div><div class="input-color-container">
			<div class="color-well" id="pencilColor"></div>
		</div>`
      cp.createColorPicker(
        'pencilColor',
        () => this.update(),
        () => this.setParams()
      )
    }
    const widthInput = document.getElementById('pencilWidth')
    widthInput.value = this.width
    widthInput.addEventListener('change', () => {
      this.update()
    })
    const pencilColor = document.getElementById('pencilColor')
    pencilColor.style.backgroundColor = this.color
  }
}

/**
 * called after a pencil or marker has been used to retrieve the path object that it created
 * @returns {fabric.Path} the last path object created
 */
function getLastPath() {
  const objs = canvas.getObjects()
  const path = objs[objs.length - 1]
  if (!path || path.type !== 'path') throw new Error('Last path is not a path')
  return path
}
/**************************************** Image ********************************************/

class ImageHandler extends FabricObject {
  constructor() {
    super({})
  }

  loadImage(e) {
    if (e.target.files) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onloadend = (e) => {
        const image = new Image()
        image.onload = (e) => {
          const imageElement = e.target
          // display image centred on viewport with max dimensions 300 x 300
          if (imageElement.width > imageElement.height) {
            if (imageElement.width > 300) imageElement.width = 300
          } else {
            if (imageElement.height > 300) imageElement.height = 300
          }
          this.imageInstance = new FabricImage(imageElement)
          this.imageInstance.set({
            originX: 'center',
            originY: 'center',
            left: canvas.getWidth() / 2,
            top: canvas.getHeight() / 2,
          })
          this.imageInstance.setCoords()
          this.imageInstance.id = uuidv4()
          canvas.add(this.imageInstance)
          saveChange(this.imageInstance, {}, 'insert')
          unselectTool()
          canvas.setActiveObject(this.imageInstance)
          canvas.requestRenderAll()
        }
        image.src = e.target.result
      }
    }
  }

  pointerdown() { }

  pointermove() { }

  pointerup() { }

  update() { }

  optionsDialog() { }
}
/****************************************** Group ********************************************/

/**
 * create a group from the currently selected objects
 */
function makeGroup() {
  const activeObj = canvas.getActiveObject()
  if (
    !activeObj ||
    canvas.getActiveObjects().length < 2 ||
    !(activeObj instanceof ActiveSelection)
  ) {
    alertMsg('Select multiple objects before grouping', 'warning')
    return
  }

  // Get the objects from the active selection
  const objectsInGroup = activeObj.getObjects()

  // Remove the active selection
  canvas.discardActiveObject()

  // Remove objects from canvas (they'll be added back as part of the group)
  objectsInGroup.forEach((obj) => canvas.remove(obj))

  // Create a new Group
  const group = new Group(objectsInGroup)
  group.id = uuidv4()
  group.members = objectsInGroup.map((ob) => ob.id)
  setGroupBorderColor(group)

  // Add the group to canvas
  canvas.add(group)
  canvas.setActiveObject(group)
  saveChange(group, {}, 'insert')
  canvas.requestRenderAll()
  elem('group').classList.remove('disabled')
  alertMsg('Grouped', 'info')
}

/**
 * ungroup the currently selected group
 */
function unGroup() {
  const activeObj = canvas.getActiveObject()
  if (!activeObj || !(activeObj instanceof Group)) return

  const members = activeObj.getObjects()
  const items = activeObj.removeAll() // returns the objects
  canvas.remove(activeObj)

  items.forEach((obj) => canvas.add(obj))

  saveChange(activeObj, { type: 'ungroup', members: members.map((ob) => ob.id) }, 'delete')
  canvas.requestRenderAll()
  elem('group').classList.add('disabled')
  alertMsg('Ungrouped', 'info')
}

/**
 * set the border color of the given group to green
 * @param {fabric.Group} group - the group object
 */
function setGroupBorderColor(group) {
  group.set({
    borderColor: 'green',
    cornerColor: 'green',
    cornerStrokeColor: 'green',
  })
}
/************************************* Bin (delete) ********************************************/

class DeleteHandler extends FabricObject {
  constructor() {
    super({})
  }

  delete() {
    deleteActiveObjects()
    unselectTool()
  }

  pointerdown() { }

  pointermove() { }

  pointerup() { }

  optionsDialog() { }
}

/**
 * makes the active objects invisible
 * this allows 'undo' to re-instate the objects, by making them visible
 */
function deleteActiveObjects() {
  canvas.getActiveObjects().forEach((obj) => {
    if (obj.isEditing) return
    obj.set('visible', false)
    saveChange(obj, { visible: false }, 'delete')
    if (obj.type === 'group') {
      obj.forEachObject((member) => {
        member.set('visible', false)
        canvas.add(member)
        saveChange(member, { visible: false }, 'delete')
      })
    }
  })
  canvas.discardActiveObject()
  canvas.requestRenderAll()
}

/******************************************** Undo ********************************************/

class UndoHandler extends FabricObject {
  constructor() {
    super({})
  }

  undo() {
    if (undos.length === 0) return // nothing on the undo stack
    const undo = undos.pop()
    yDrawingMap.set('undos', undos)
    if (undos.length === 0) {
      elem('undotool').classList.add('disabled')
    }
    if (undo.id === 'selection') {
      redos.push(deepCopy(undo))
      yDrawingMap.set('redos', redos)
      elem('redotool').classList.remove('disabled')
      switch (undo.op) {
        case 'add':
          // reverse of add selection is dispose of it
          canvas.discardActiveObject()
          updateActiveButtons()
          break
        case 'update':
          {
            const prevSelParams = undos.findLast((d) => d.id === 'selection').params
            canvas.getActiveObject().set({
              angle: prevSelParams.angle,
              left: prevSelParams.left,
              scaleX: prevSelParams.scaleX,
              scaleY: prevSelParams.scaleY,
              top: prevSelParams.top,
            })
          }
          break
        case 'discard':
          {
            // reverse of discard selection is add it
            const selectedObjects = undo.params.oldMembers.map((id) =>
              canvas.getObjects().find((o) => o.id === id)
            )
            const sel = new ActiveSelection(selectedObjects, {
              canvas,
            })
            canvas.setActiveObject(sel)
            updateActiveButtons()
          }
          break
      }
      canvas.requestRenderAll()
      return
    }
    if (undo.params.type === 'group' || undo.params.type === 'ungroup') {
      redos.push(deepCopy(undo))
      yDrawingMap.set('redos', redos)
      elem('redotool').classList.remove('disabled')
      const obj = canvas.getObjects().filter((o) => o.id === undo.id)[0]
      switch (undo.op) {
        case 'insert':
          // reverse of add group is dispose of it
          obj.set('visible', false)
          saveChange(obj, { members: undo.params.members, type: 'group' }, null)
          canvas.discardActiveObject()
          updateActiveButtons()
          break
        case 'update': {
          // find the previous param set for this group, and set the object to those params
          const prevDelta = undos.findLast((d) => d.id === undo.id)
          const newParams = clean(prevDelta.params, { type: true, layoutManager: true })
          obj.set(newParams)
          obj.setCoords()
          saveChange(obj, prevDelta.params, null)
          break
        }
        case 'delete':
          // reverse of delete group is add it
          canvas.discardActiveObject()
          obj.set('visible', true)
          saveChange(obj, { members: undo.params.members, type: 'group' }, null)
          canvas.setActiveObject(obj)
          updateActiveButtons()
          break
      }
      canvas.requestRenderAll()
      return
    }
    // find the object to be undone from its id
    const obj = canvas.getObjects().find((o) => o.id === undo.id)
    // get the current state of the object, so that redo can return it to this state
    let newParams = undo.params
    if (obj) {
      newParams = obj.toObject()
      // remove unneeded properties
      newParams = clean(newParams, { type: true, layoutManager: true })
      // push the current state onto the redo stack
      redos.push({ id: undo.id, params: newParams, op: undo.op })
      yDrawingMap.set('redos', redos)
      elem('redotool').classList.remove('disabled')
      switch (undo.op) {
        case 'insert':
          obj.set('visible', false)
          saveChange(obj, { visible: false }, null)
          break
        case 'delete':
          obj.set('visible', true)
          saveChange(obj, { visible: true }, null)
          break
        case 'update': {
          // find the previous param set for this object, and set the object to those params
          const prevDelta = undos.findLast((d) => d.id === obj.id)
          obj.set('visible', true)
          const newParams = clean(prevDelta.params, { type: true, layoutManager: true })
          obj.set(newParams)
          obj.setCoords()
          saveChange(obj, Object.assign(prevDelta.params, { visible: true }), null)
          break
        }
      }
      canvas.discardActiveObject()
    }
    canvas.requestRenderAll()
  }

  redo() {
    if (redos.length === 0) return
    const redo = redos.pop()
    yDrawingMap.set('redos', redos)
    if (redos.length === 0) {
      elem('redotool').classList.add('disabled')
    }
    if (redo.id === 'selection') {
      undos.push(deepCopy(redo))
      yDrawingMap.set('undos', undos)
      elem('undotool').classList.remove('disabled')
      switch (redo.op) {
        case 'add': {
          const selectedObjects = redo.params.members.map((id) =>
            canvas.getObjects().find((o) => o.id === id)
          )
          const sel = new ActiveSelection(selectedObjects, {
            canvas,
          })
          canvas.setActiveObject(sel)
          updateActiveButtons()
          break
        }
        case 'update':
          canvas.getActiveObject().set({
            angle: redo.params.angle,
            left: redo.params.left,
            scaleX: redo.params.scaleX,
            scaleY: redo.params.scaleY,
            top: redo.params.top,
          })
          break
        case 'discard':
          canvas.discardActiveObject()
          updateActiveButtons()
          break
      }
      canvas.requestRenderAll()
      return
    }
    if (redo.params.type === 'group' || redo.params.type === 'ungroup') {
      undos.push(deepCopy(redo))
      yDrawingMap.set('undos', undos)
      elem('undotool').classList.remove('disabled')
      const obj = canvas.getObjects().filter((o) => o.id === redo.id)[0]
      if (obj) {
        switch (redo.op) {
          case 'delete':
            // reverse of add group is dispose of it
            obj.set('visible', false)
            saveChange(obj, { members: redo.params.members, type: 'group' }, null)
            canvas.discardActiveObject()
            updateActiveButtons()
            break
          case 'update': {
            // find the previous param set for this group, and set the object to those params
            const prevDelta = undos.findLast((d) => d.id === redo.id)
            const newParams = clean(prevDelta.params, { type: true, layoutManager: true })
            obj.set(newParams)
            obj.setCoords()
            saveChange(obj, prevDelta.params, null)
            break
          }
          case 'insert':
            // reverse of delete group is add it
            canvas.discardActiveObject()
            obj.set('visible', true)
            saveChange(obj, { members: redo.params.members, type: 'group' }, null)
            canvas.setActiveObject(obj)
            updateActiveButtons()
            break
        }
      }
      canvas.requestRenderAll()
      return
    }
    const obj = canvas.getObjects().find((o) => o.id === redo.id)
    if (obj) {
      const newParams = {}
      for (const prop in redo.params) {
        newParams[prop] = obj[prop]
      }
      undos.push({ id: redo.id, params: newParams, op: redo.op })
      yDrawingMap.set('undos', undos)
      elem('undotool').classList.remove('disabled')
      switch (redo.op) {
        case 'insert':
          obj.set('visible', true)
          saveChange(obj, { visible: true }, null)
          break
        case 'delete':
          obj.set('visible', false)
          saveChange(obj, { visible: false }, null)
          break
        case 'update': {
          const newParams = clean(redo.params, { type: true, layoutManager: true })
          obj.set(newParams)
          obj.setCoords()
          saveChange(obj, Object.assign(redo.params, { visible: true }), null)
          break
        }
      }
      canvas.discardActiveObject()
      canvas.requestRenderAll()
    }
  }
}
/******************************************** Broadcast ********************************************/

/**
 * Broadcast the changes to other clients and
 * save the current state of the object on the undo stack
 * @param {String} obj the object
 * @param {Object} params the current state
 * @param {String} op insert|delete|update|null (if null, don't save on the undo stack)
 */
function saveChange(obj, params = {}, op) {
  if (/back/.test(debug)) {
    console.trace('Saving change for object', obj, 'op:', op, 'params:', params)
  }
  // get current object position as well as any format changes
  params = getObjectData(obj, params)
  // send the object to other clients
  yDrawingMap.set(obj.id, params)
  //check whether the order of objects has changed; if so, save the new order
  const oldSequence = yDrawingMap.get('sequence')
  const newSequence = canvas.getObjects().map((obj) => obj.id)
  let different = true
  if (oldSequence) {
    different = newSequence.length !== oldSequence.length
    if (!different) {
      for (let i = 0; i < oldSequence.length; i++) {
        if (newSequence[i] !== oldSequence[i]) {
          different = true
          break
        }
      }
    }
  }
  if (different) {
    yDrawingMap.set('sequence', newSequence)
  }
  // save the change on the undo stack
  if (op) {
    undos.push({ op, id: obj.id, params })
    yDrawingMap.set('undos', undos)
    elem('undotool').classList.remove('disabled')
  }
  // count the number of changes, so we can log that the background has changed
  nChanges++
}
/**
 * Collect the parameters that would allow the reproduction of the object
 * @param {object} obj - fabric object
 * @param {object} params - initial parameters
 * @returns {object} the object data with all parameters needed for reproduction
 */
function getObjectData(obj, params) {
  params = { ...obj.toObject(), ...params }
  params.id = obj.id
  params.type = params.type || obj.type
  if (obj.type === 'path' || obj.type === 'Path') params.pathOffset = obj.pathOffset
  if (obj.type === 'image' || obj.type === 'Image') params.imageObj = obj.toObject()
  if (params.type === 'ActiveSelection' || params.type === 'Group') {
    params.members = obj.getObjects().map((o) => o.id)
  }
  return params
}
/************************************************** Smart Guides ********************************************/

const aligningLineOffset = 5
const aligningLineMargin = 4
const aligningLineWidth = 1
const aligningLineColor = 'rgb(255,0,0)'
const aligningDash = [5, 5]

/**
 * initialize the smart guides that help align objects when moving them
 */
function initAligningGuidelines() {
  const ctx = canvas.getSelectionContext()
  let viewportTransform
  let zoom = 1
  let verticalLines = []
  let horizontalLines = []

  canvas.on('mouse:down', function () {
    viewportTransform = canvas.viewportTransform
    zoom = canvas.getZoom()
  })

  canvas.on('object:moving', function (e) {
    if (!canvas._currentTransform) return
    const activeObject = e.target
    const activeObjectCenter = activeObject.getCenterPoint()
    const activeObjectBoundingRect = activeObject.getBoundingRect()
    const activeObjectHalfHeight = activeObjectBoundingRect.height / (2 * viewportTransform[3])
    const activeObjectHalfWidth = activeObjectBoundingRect.width / (2 * viewportTransform[0])

    canvas
      .getObjects()
      .filter((object) => object !== activeObject && object.visible)
      .forEach((object) => {
        const objectCenter = object.getCenterPoint()
        const objectBoundingRect = object.getBoundingRect()
        const objectHalfHeight = objectBoundingRect.height / (2 * viewportTransform[3])
        const objectHalfWidth = objectBoundingRect.width / (2 * viewportTransform[0])

        // snap by the horizontal center line
        snapVertical(objectCenter.x, activeObjectCenter.x, objectCenter.x)
        // snap by the left object edge matching left active edge
        snapVertical(
          objectCenter.x - objectHalfWidth,
          activeObjectCenter.x - activeObjectHalfWidth,
          objectCenter.x - objectHalfWidth + activeObjectHalfWidth
        )
        // snap by the left object edge matching right active edge
        snapVertical(
          objectCenter.x - objectHalfWidth,
          activeObjectCenter.x + activeObjectHalfWidth,
          objectCenter.x - objectHalfWidth - activeObjectHalfWidth
        )
        // snap by the right object edge matching right active edge
        snapVertical(
          objectCenter.x + objectHalfWidth,
          activeObjectCenter.x + activeObjectHalfWidth,
          objectCenter.x + objectHalfWidth - activeObjectHalfWidth
        )
        // snap by the right object edge matching left active edge
        snapVertical(
          objectCenter.x + objectHalfWidth,
          activeObjectCenter.x - activeObjectHalfWidth,
          objectCenter.x + objectHalfWidth + activeObjectHalfWidth
        )

        function snapVertical(objEdge, activeEdge, snapCenter) {
          if (isInRange(objEdge, activeEdge)) {
            verticalLines.push({
              x: objEdge,
              y1:
                objectCenter.y < activeObjectCenter.y
                  ? objectCenter.y - objectHalfHeight - aligningLineOffset
                  : objectCenter.y + objectHalfHeight + aligningLineOffset,
              y2:
                activeObjectCenter.y > objectCenter.y
                  ? activeObjectCenter.y + activeObjectHalfHeight + aligningLineOffset
                  : activeObjectCenter.y - activeObjectHalfHeight - aligningLineOffset,
            })
            activeObject.setPositionByOrigin(
              new Point(snapCenter, activeObjectCenter.y),
              'center',
              'center'
            )
          }
        }

        // snap by the vertical center line
        snapHorizontal(objectCenter.y, activeObjectCenter.y, objectCenter.y)
        // snap by the top object edge matching the top active edge
        snapHorizontal(
          objectCenter.y - objectHalfHeight,
          activeObjectCenter.y - activeObjectHalfHeight,
          objectCenter.y - objectHalfHeight + activeObjectHalfHeight
        )
        // snap by the top object edge matching the bottom active edge
        snapHorizontal(
          objectCenter.y - objectHalfHeight,
          activeObjectCenter.y + activeObjectHalfHeight,
          objectCenter.y - objectHalfHeight - activeObjectHalfHeight
        )
        // snap by the bottom object edge matching the bottom active edge
        snapHorizontal(
          objectCenter.y + objectHalfHeight,
          activeObjectCenter.y + activeObjectHalfHeight,
          objectCenter.y + objectHalfHeight - activeObjectHalfHeight
        )
        // snap by the bottom object edge matching the top active edge
        snapHorizontal(
          objectCenter.y + objectHalfHeight,
          activeObjectCenter.y - activeObjectHalfHeight,
          objectCenter.y + objectHalfHeight + activeObjectHalfHeight
        )
        function snapHorizontal(objEdge, activeObjEdge, snapCenter) {
          if (isInRange(objEdge, activeObjEdge)) {
            horizontalLines.push({
              y: objEdge,
              x1:
                objectCenter.x < activeObjectCenter.x
                  ? objectCenter.x - objectHalfWidth - aligningLineOffset
                  : objectCenter.x + objectHalfWidth + aligningLineOffset,
              x2:
                activeObjectCenter.x > objectCenter.x
                  ? activeObjectCenter.x + activeObjectHalfWidth + aligningLineOffset
                  : activeObjectCenter.x - activeObjectHalfWidth - aligningLineOffset,
            })
            activeObject.setPositionByOrigin(
              new Point(activeObjectCenter.x, snapCenter),
              'center',
              'center'
            )
          }
        }
      })
  })

  canvas.on('after:render', function () {
    verticalLines.forEach((line) => drawVerticalLine(line))
    horizontalLines.forEach((line) => drawHorizontalLine(line))

    verticalLines = []
    horizontalLines = []
  })

  canvas.on('mouse:up', function () {
    canvas.requestRenderAll()
  })

  /**
   * draw a vertical alignment guide line
   * @param {object} coords - object with x, y1, y2 coordinates
   */
  function drawVerticalLine(coords) {
    drawLine(
      coords.x + 0.5,
      coords.y1 > coords.y2 ? coords.y2 : coords.y1,
      coords.x + 0.5,
      coords.y2 > coords.y1 ? coords.y2 : coords.y1
    )
  }
  /**
   * draw a horizontal alignment guide line
   * @param {object} coords - object with x1, x2, y coordinates
   */
  function drawHorizontalLine(coords) {
    drawLine(
      coords.x1 > coords.x2 ? coords.x2 : coords.x1,
      coords.y + 0.5,
      coords.x2 > coords.x1 ? coords.x2 : coords.x1,
      coords.y + 0.5
    )
  }
  /**
   * draw an alignment guide line between two points
   * @param {number} x1 - start x coordinate
   * @param {number} y1 - start y coordinate
   * @param {number} x2 - end x coordinate
   * @param {number} y2 - end y coordinate
   */
  function drawLine(x1, y1, x2, y2) {
    ctx.save()
    ctx.lineWidth = aligningLineWidth
    ctx.strokeStyle = aligningLineColor
    ctx.setLineDash(aligningDash)
    ctx.beginPath()
    ctx.moveTo(x1 * zoom + viewportTransform[4], y1 * zoom + viewportTransform[5])
    ctx.lineTo(x2 * zoom + viewportTransform[4], y2 * zoom + viewportTransform[5])
    ctx.stroke()
    ctx.restore()
  }
  /**
   * return true if value2 is within value1 +/- aligningLineMargin
   * @param {number} value1
   * @param {number} value2
   * @returns Boolean
   */
  function isInRange(value1, value2) {
    return value2 > value1 - aligningLineMargin && value2 < value1 + aligningLineMargin
  }
}

/*************************************copy & paste ********************************************/
let displacement = 0
/**
 * Copy the selected objects to the clipboard
 * NB this doesn't yet work in Firefox, as they haven't implemented the Clipboard API and Permissions yet.
 * @param {Event} event
 */
export function copyBackgroundToClipboard(event) {
  if (document.getSelection().toString()) return // only copy if there is no text selected (e.g. in Notes)
  const activeObjs = canvas.getActiveObjects()
  if (activeObjs.length === 0) return
  event.preventDefault()
  const group = canvas.getActiveObject()
  let groupLeft = 0
  let groupTop = 0
  // if the active Object is a group, then the component object positions are relative to the
  // group top, left, not to the canvas.  Compensate for this
  if (group.type === 'ActiveSelection' || group.type === 'group') {
    groupTop = group.top + group.height / 2
    groupLeft = group.left + group.width / 2
  }
  copyAsText(
    JSON.stringify(
      activeObjs.map((obj) =>
        getObjectData(obj, { left: obj.left + groupLeft, top: obj.top + groupTop })
      )
    )
  )
  displacement = 0
}

/**
 * copy the given text to the clipboard
 * @param {string} text - the text to copy
 * @returns {Promise<boolean>} true if copy was successful, false otherwise
 */
async function copyAsText(text) {
  try {
    if (typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('navigator.clipboard.writeText not a function')
    }
  } catch {
    alertMsg('Copying not implemented in this browser', 'error')
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    alertMsg('Copied', 'info')
    return true
  } catch (err) {
    console.error('Failed to copy: ', err)
    alertMsg('Copy failed', 'error')
    return false
  }
}

export async function pasteBackgroundFromClipboard() {
  const clip = await getClipboardContents()
  const paramsArray = JSON.parse(clip)
  if (canvas.getActiveObject()) canvas.discardActiveObject()
  displacement += 10
  for (const params of paramsArray) {
    const { type, ...otherParams } = params
    let copiedObj
    switch (type) {
      case 'rect':
      case 'Rect':
        copiedObj = new RectHandler()
        break
      case 'circle':
      case 'Circle':
        copiedObj = new CircleHandler()
        break
      case 'line':
      case 'Line':
        copiedObj = new LineHandler()
        break
      case 'text':
      case 'Text':
      case 'i-text':
      case 'IText':
        copiedObj = new TextHandler()
        break
      case 'path':
      case 'Path':
        copiedObj = new Path()
        break
      case 'image':
      case 'Image':
        await FabricImage.fromObject(params.imageObj).then((image) => {
          image.set({
            left: params.left + displacement,
            top: params.top + displacement,
            id: uuidv4(),
          })
          canvas.add(image)
          canvas.setActiveObject(image)
          saveChange(image, { imageObj: image.toObject() }, 'insert')
        })
        continue
      default:
        throw new Error(`bad fabric object type in pasteFromClipboard: ${type}`)
    }
    copiedObj.set(otherParams)
    copiedObj.left += displacement
    copiedObj.top += displacement
    copiedObj.id = uuidv4()
    canvas.add(copiedObj)
    canvas.setActiveObject(copiedObj)
    saveChange(copiedObj, {}, 'insert')
  }
  alertMsg('Pasted', 'info')
}

/**
 * retrieve the contents of the clipboard
 * @returns {Promise<string|null>} the clipboard contents, or null if read failed
 */
async function getClipboardContents() {
  try {
    if (typeof navigator.clipboard.readText !== 'function') {
      throw new Error('navigator.clipboard.readText not a function')
    }
  } catch {
    alertMsg('Pasting not implemented in this browser', 'error')
    return null
  }
  try {
    return await navigator.clipboard.readText()
  } catch (err) {
    console.error('Failed to read clipboard contents: ', err)
    alertMsg('Failed to paste', 'error')
    return null
  }
}

/************************************************ Upgrade drawing form version 1 to version 2 format ************* */
/**
 * Convert v1 drawing instructions into equivalent v2 background objects
 * @param {array} pointsArray  version 1 background drawing instructions
 */
export function upgradeFromV1(pointsArray) {
  // do nothing if either yPointsArray is empty or yDrawingMap  already contains objects
  if (yPointsArray.length === 0 || yDrawingMap.size > 0) return
  yDrawingMap.clear()
  let options
  const ids = []
  canvas.setViewportTransform([1, 0, 0, 1, canvas.getWidth() / 2, canvas.getHeight() / 2])
  doc.transact(() => {
    pointsArray = eraser(pointsArray)
    pointsArray.forEach((item) => {
      const fabObj = { id: uuidv4() }
      switch (item[0]) {
        case 'options':
          options = item[1]
          break
        case 'dashedLine':
          fabObj.strokeDashArray = [10, 10]
        // falls through
        case 'line':
          fabObj.type = 'line'
          fabObj.x1 = item[1][0]
          fabObj.y1 = item[1][1]
          fabObj.x2 = item[1][2]
          fabObj.y2 = item[1][3]
          fabObj.axes = false
          fabObj.stroke = options.strokeStyle
          fabObj.strokeWidth = options.lineWidth
          ids.push(fabObj.id)
          yDrawingMap.set(fabObj.id, fabObj)
          break
        case 'rrect':
          fabObj.rx = 10
          fabObj.ry = 10
        // falls through
        case 'rect':
          fabObj.type = 'rect'
          fabObj.left = item[1][0]
          fabObj.top = item[1][1]
          fabObj.width = item[1][2]
          fabObj.height = item[1][3]
          fabObj.fill = options.fillStyle
          if (fabObj.fill === 'rgb(255, 255, 255)' || fabObj.fill === '#ffffff') {
            fabObj.fill = 'rgba(0, 0, 0, 0)'
          }
          fabObj.stroke = options.strokeStyle
          fabObj.strokeWidth = options.lineWidth
          ids.push(fabObj.id)
          yDrawingMap.set(fabObj.id, fabObj)
          break
        case 'text':
          fabObj.type = 'text'
          fabObj.fill = options.fillStyle
          fabObj.fontSize = Number.parseInt(options.font)
          fabObj.text = item[1][0]
          fabObj.left = item[1][1]
          fabObj.top = item[1][2]
          ids.push(fabObj.id)
          yDrawingMap.set(fabObj.id, fabObj)
          break
        case 'image':
          {
            // this is a bit complicated because we have to allow for the async onload of the image
            const image = new Image()
            image.src = item[1][0]
            const promise = new Promise((resolve) => {
              image.onload = function () {
                const imageObj = new FabricImage(image, {
                  left: item[1][1],
                  top: item[1][2],
                  width: item[1][3],
                  height: item[1][4],
                })
                fabObj.type = 'image'
                fabObj.imageObj = imageObj.toObject()
                resolve(fabObj)
              }
            })
            promise.then(() => {
              yDrawingMap.set(fabObj.id, fabObj)
              refreshFromMap([fabObj.id])
            })
          }
          break
        case 'pencil':
          // not implemented (yet)
          break
        case 'marker':
          fabObj.type = 'circle'
          fabObj.fill = options.fillStyle
          fabObj.strokeWidth = 0
          fabObj.stroke = options.fillStyle
          fabObj.originX = 'center'
          fabObj.originY = 'center'
          fabObj.left = item[1][0]
          fabObj.top = item[1][1]
          fabObj.radius = item[1][2] / 2
          ids.push(fabObj.id)
          yDrawingMap.set(fabObj.id, fabObj)
          break
        case 'endShape':
          break
      }
    })
  })
  console.log('Background converted from v1 to v2')
  refreshFromMap(ids)
}

/**
 * Simulate the effect of the v1 eraser by deleting all rects and textboxes that are overlapped by the
 * white circles produced by the v1 eraser
 * @returns {array} a filtered version of pointsArray, with 'erased' rects, texts and white marker circles omitted
 */
function eraser() {
  const points = deepCopy(yPointsArray.toArray())
  let options = {}
  // work along pointsArray.
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    // if not 'endShape' or 'options'
    if (point[0] === 'endShape') continue
    if (point[0] === 'options') {
      options = point[1]
      continue
    }
    //if circle and white
    if (point[0] === 'marker' && options.fillStyle === '#ffffff') {
      // starting at beginning test each array entry until reached current entry
      for (let j = 0; j < i; j++) {
        // test whether circle overlaps shape
        if (intersect(point, points[j])) {
          // if so, change shape to 'deleted'
          points[j][0] = 'deleted'
        }
      }
      // when reach current entry, change circle to 'deleted' and repeat until end of array.
      point[0] = 'deleted'
    }
  }
  return points.filter((p) => p[0] !== 'deleted')
}
/**
 * returns true iff the circle overlaps the shape (tests only rects and text boxes, not lines or pencil)
 * @param {array} circle - a marker item from yPointsArray
 * @param {array} shape - an item from yPointsArray
 * @returns {boolean} true if circle overlaps shape, false otherwise
 */
function intersect(circle, shape) {
  const circObj = { x: circle[1][0], y: circle[1][1], r: circle[1][2] }
  switch (shape[0]) {
    case 'rect':
    case 'rrect': {
      const rectObj = { x: shape[1][0], y: shape[1][1], w: shape[1][2], h: shape[1][3] }
      return circleIntersectsRect(circObj, rectObj)
    }
    case 'text': {
      // to simplify, just test whether the start point is covered by the circle
      return (circObj.x - shape[1][1]) ** 2 + (circObj.y - shape[1][2]) ** 2 < circObj.r ** 2
    }
    default:
      return false
  }
}
/**
 * tests whether any part of the circle overlaps the rectangle
 * @param {object} circle - object with x, y as the circle's centre and r, the circle's radius
 * @param {object} rect - object with x, y for its top left, and width and height
 * @returns {boolean} true if circle overlaps rectangle, false otherwise
 */
function circleIntersectsRect(circle, rect) {
  const distX = Math.abs(circle.x - rect.x - rect.w / 2)
  const distY = Math.abs(circle.y - rect.y - rect.h / 2)

  if (distX > rect.w / 2 + circle.r) {
    return false
  }
  if (distY > rect.h / 2 + circle.r) {
    return false
  }

  if (distX <= rect.w / 2) {
    return true
  }
  if (distY <= rect.h / 2) {
    return true
  }

  const dx = distX - rect.w / 2
  const dy = distY - rect.h / 2
  return dx * dx + dy * dy <= circle.r * circle.r
}
