/*********************************************************************************************************************  

PRSM Participatory System Mapper 

	Copyright (C) 2022  Nigel Gilbert prsm@prsm.uk

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.


This module provides import and export functions, to read and save map files in a variety of formats.  
 ******************************************************************************************************************** */

import { Network, parseGephiNetwork, parseDOTNetwork } from 'vis-network/peer'
import {
  data,
  doc,
  room,
  network,
  container,
  logHistory,
  yUndoManager,
  yNetMap,
  ySamplesMap,
  yPointsArray,
  yHistory,
  lastNodeSample,
  lastLinkSample,
  clearMap,
  debug,
  drawMinimap,
  toggleDeleteButton,
  undoRedoButtonStatus,
  updateLastSamples,
  setMapTitle,
  setSideDrawer,
  disableSideDrawerEditing,
  doSnapToGrid,
  setCurve,
  setBackground,
  setLegend,
  setCluster,
  sizing,
  recreateClusteringMenu,
  markMapSaved,
  saveState,
  fit,
  yDrawingMap,
} from './prsm.js'
import {
  elem,
  uuidv4,
  deepMerge,
  deepCopy,
  splitText,
  setNodeHidden,
  setEdgeHidden,
  standardizeColor,
  rgbIsLight,
  rgbToArray,
  hexToRgba,
  strip,
  statusMsg,
  alertMsg,
  lowerFirstLetter,
  encodeHTMLEntities,
  stripNL,
} from './utils.js'
import { styles } from './samples.js'
import { canvas, refreshFromMap, setUpBackground, upgradeFromV1 } from './background.js'
import { refreshSampleNode, refreshSampleLink, updateLegend } from './styles.js'
import Quill from 'quill'
import markdownToDelta from 'markdown-to-quill-delta'
import { saveAs } from 'file-saver'
//import * as quillToWord from 'quill-to-word'  //dynamically loaded in exportNotes
import { read, writeFileXLSX, utils } from 'xlsx'
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'
import { XMLParser } from 'fast-xml-parser'
import { StaticCanvas } from 'fabric'
import { version } from '../package.json'

const NODEWIDTH = 10 // chars for label splitting

let lastFileName = '' // the name of the file last read in
let msg = ''
/**
 * Get the name of a map file to read and load it
 * @param {event} e
 */

export function readSingleFile(e) {
  const file = e.target.files[0]
  if (!file) {
    return
  }
  const fileName = file.name
  lastFileName = fileName
  document.body.style.cursor = 'wait'
  statusMsg("Reading '" + fileName + "'")
  msg = ''
  e.target.value = ''
  const reader = new FileReader()
  reader.onloadend = function (e) {
    try {
      document.body.style.cursor = 'wait'
      loadFile(e.target.result)
      if (!msg) alertMsg("Read '" + fileName + "'", 'info')
    } catch (err) {
      document.body.style.cursor = 'default'
      alertMsg("Error reading '" + fileName + "': " + err.message, 'error')
      console.log(err)
      clearMap()
    }
    document.body.style.cursor = 'default'
  }
  reader.readAsArrayBuffer(file)
}

export function openFile() {
  elem('fileInput').click()
}
/**
 * Allow user to open a file by dragging and dropping it over the PRSM window
 */
elem('container').addEventListener('drop', (e) => {
  e.preventDefault()
  const dt = e.dataTransfer
  const files = dt.files
  if (files.length > 0) {
    readSingleFile({ target: { files } })
  }
})
elem('container').addEventListener('dragover', (e) => {
  e.preventDefault()
})
/**
 * determine what kind of file it is, parse it and replace any current map with the one read from the file
 * @param {string} contents - what is in the file
 */
function loadFile(contents) {
  if (data.nodes.length > 0) {
    if (
      !confirm(
        'Loading a file will delete the current network.  Are you sure you want to replace it?'
      )
    ) {
      return
    }
  }
  saveState()
  // load the file as one single yjs transaction to reduce server traffic
  clearMap()
  doc.transact(() => {
    switch (lastFileName.split('.').pop().toLowerCase()) {
      case 'csv':
        loadCSV(arrayBufferToString(contents))
        break
      case 'graphml':
        loadGraphML(arrayBufferToString(contents))
        break
      case 'gml':
        loadGML(arrayBufferToString(contents))
        break
      case 'json':
        loadKumufile(arrayBufferToString(contents))
        break
      case 'prsm':
        loadPRSMfile(arrayBufferToString(contents))
        break
      case 'gv':
      case 'dot':
        loadDOTfile(arrayBufferToString(contents))
        break
      case 'xlsx':
      case 'xls':
        loadExcelfile(contents)
        break
      case 'gexf':
        loadGEXFfile(arrayBufferToString(contents))
        break
      case 'drawio':
      case 'xml':
        loadDrawIOfile(arrayBufferToString(contents))
        break
      default:
        throw new Error('Unrecognised file name suffix')
    }
    const nodesToUpdate = []
    data.nodes.get().forEach((n) => {
      // ensure that all nodes have a grp property (converting 'group' property for old format files)
      if (!n.grp) n.grp = n.group ? 'group' + (n.group % 9) : 'group0'
      // reassign the sample properties to the nodes
      n = deepMerge(styles.nodes[n.grp], n)
      // version 1.6 made changes to label scaling
      n.scaling = {
        label: { enabled: false, max: 40, min: 10 },
        max: 100,
        min: 10,
      }
      nodesToUpdate.push(n)
    })
    data.nodes.update(nodesToUpdate)

    // same for edges
    const edgesToUpdate = []
    data.edges.get().forEach((e) => {
      // ensure that all edges have a grp property (converting 'group' property for old format files)
      if (!e.grp) e.grp = e.group ? 'edge' + (e.group % 9) : 'edge0'
      // reassign the sample properties to the edges
      e = deepMerge(styles.edges[e.grp], e)
      edgesToUpdate.push(e)
    })
    data.edges.update(edgesToUpdate)

    fit()
    updateLegend()
    // Allow open file undo unless the loaded file is blank (no factors). This gives
    // users a way of zeroing a map.
    logHistory('loaded &lt;' + lastFileName + '&gt;', false, data.nodes.length === 0)
  })
  yUndoManager.clear()
  undoRedoButtonStatus()
  toggleDeleteButton()
  recreateClusteringMenu(yNetMap.get('attributeTitles') || {})
  drawMinimap()
}
/**
 * convert an ArrayBuffer to String
 * @param {arrayBuffer} contents
 * @returns string
 */
function arrayBufferToString(contents) {
  const decoder = new TextDecoder('utf-8')
  return decoder.decode(new DataView(contents))
}
/**
 * Parse and load a PRSM map file, or a JSON file exported from Gephi
 * @param {string} str
 */
function loadPRSMfile(str) {
  if (str[0] !== '{') str = decompressFromUTF16(str)
  const json = JSON.parse(str)
  if (json.version && version.substring(0, 3) > json.version.substring(0, 3)) {
    alertMsg('Warning: file was created in an earlier version', 'warn')
    msg = 'old version'
  }
  updateLastSamples(json.lastNodeSample, json.lastLinkSample)
  if (json.buttons) setButtonStatus(json.buttons)
  if (json.mapTitle) yNetMap.set('mapTitle', setMapTitle(json.mapTitle))
  if (json.attributeTitles) yNetMap.set('attributeTitles', json.attributeTitles)
  else yNetMap.set('attributeTitles', {})
  if (json.edges.length > 0 && 'source' in json.edges[0]) {
    // the file is from Gephi and needs to be translated
    const parsed = parseGephiNetwork(json, {
      edges: {
        inheritColors: false,
      },
      nodes: {
        fixed: false,
        parseColor: true,
      },
    })
    data.nodes.add(parsed.nodes)
    data.edges.add(parsed.edges)
  } else {
    json.nodes.forEach((n) => {
      // at version 1.5, the title: property was renamed to note:
      if (!n.note && n.title) n.note = n.title.replace(/<br>|<p>/g, '\n')
      delete n.title
      if (n.note && !(n.note instanceof Object)) n.note = { ops: [{ insert: n.note }] }
    })
    data.nodes.add(json.nodes)
    json.edges.forEach((e) => {
      if (!e.note && e.title) e.note = e.title.replace(/<br>|<p>/g, '\n')
      delete e.title
      if (e.note && !(e.note instanceof Object)) e.note = { ops: [{ insert: e.note }] }
    })
    data.edges.add(json.edges)
  }
  // before v1.4, the style array was called samples
  if (json.samples) json.styles = json.samples
  if (json.styles) {
    styles.nodes = deepMerge(styles.nodes, json.styles.nodes)
    for (const n in styles.nodes) {
      delete styles.nodes[n].chosen
    }
    styles.edges = deepMerge(styles.edges, json.styles.edges)
    for (const e in styles.edges) {
      delete styles.edges[e].chosen
    }
    for (const groupId in styles.nodes) {
      ySamplesMap.set(groupId, {
        node: styles.nodes[groupId],
      })
      if (groupId.match(/\d+/)?.[0]) refreshSampleNode(groupId)
    }
    for (const edgeId in styles.edges) {
      ySamplesMap.set(edgeId, {
        edge: styles.edges[edgeId],
      })
      if (edgeId.match(/\d+/)?.[0]) refreshSampleLink(edgeId)
    }
  }
  yDrawingMap.clear()
  canvas.clear()
  yPointsArray.delete(0, yPointsArray.length)
  if (json.underlay) {
    // background from v1; update it
    yPointsArray.insert(0, json.underlay)
    if (yPointsArray.length > 0) upgradeFromV1(yPointsArray.toArray())
  }
  if (json.background) {
    setUpBackground()
    const map = JSON.parse(json.background)
    for (const [key, value] of Object.entries(map)) {
      yDrawingMap.set(key, value)
    }
    refreshFromMap(Object.keys(map))
  }
  yHistory.delete(0, yHistory.length)
  if (json.history) yHistory.insert(0, json.history)
  if (json.description) {
    yNetMap.set('mapDescription', json.description)
    disableSideDrawerEditing()
    setSideDrawer(json.description)
  }
  // node sizing has to be done after nodes have been created
  sizing(yNetMap.get('sizing'))
}
/**
 * parse and load a GraphViz (.DOT or .GV) file
 *  uses the vis-network DOT parser, which is pretty hopeless -
 *  e.g. it does not manage dotted or dashed node borders and
 *  requires some massaging of the parameters it does recognise
 *
 * @param {string} graph contents of DOT file
 * @returns nodes and edges as an object
 */
function loadDOTfile(graph) {
  const parsedData = parseDOTNetwork(graph)
  data.nodes.add(
    parsedData.nodes.map((node) => {
      const n = strip(node, ['id', 'label', 'color', 'shape', 'font', 'width'])
      if (!n.id) n.id = uuidv4()
      if (!n.color) n.color = deepCopy(styles.nodes['group0'].color)
      if (!n.font) n.font = deepCopy(styles.nodes['group0'].font)
      if (!n.shape) n.shape = deepCopy(styles.nodes['group0'].shape)
      if (n.font?.size) n.font.size = parseInt(n.font.size)
      if (n.width) n.borderWidth = parseInt(n.width)
      if (n.shape === 'plaintext') {
        n.shape = 'text'
        n.borderWidth = 0
      }
      return n
    })
  )
  data.edges.add(
    parsedData.edges.map((edge) => {
      const e = strip(edge, ['id', 'from', 'to', 'label', 'color', 'dashes'])
      if (!e.id) e.id = uuidv4()
      if (!e.color) e.color = deepCopy(styles.edges['edge0'].color)
      if (!e.dashes) e.dashes = deepCopy(styles.edges['edge0'].dashes)
      if (!e.width) e.width = e.width ? parseInt(e.width) : styles.edges['edge0'].width
      return e
    })
  )
}
/**
 * parse and load a graphML file
 * @param {string} graphML
 */
function loadGraphML(graphML) {
  const options = {
    ignoreAttributes: false,
    attributeNamePrefix: '',
    alwaysCreateTextNode: false,
    isArray: (name, jpath) => {
      // Define which elements should always be arrays
      const arrayPaths = [
        'graphml.key',
        'graphml.graph.node',
        'graphml.graph.edge',
        'graphml.graph.node.data',
        'graphml.graph.edge.data',
      ]
      return arrayPaths.includes(jpath)
    },
    textNodeName: '#text',
    trimValues: true,
  }
  const parser = new XMLParser(options)
  const parsedData = parser.parse(graphML)
  if (parsedData.graphml && parsedData.graphml.graph) {
    const attributeNames = {}
    if (parsedData.graphml.key) {
      parsedData.graphml.key.forEach((key) => {
        attributeNames[key.id] = key['attr.name']
      })
    }
    const nodes = parsedData.graphml.graph.node.map((node) => {
      const nodeData = {}
      if (node.data) {
        node.data.forEach((data) => {
          nodeData[attributeNames[data['key']]] = data['#text']
        })
      }
      return {
        id: node['id'],
        ...nodeData,
      }
    })
    const edges = parsedData.graphml.graph.edge.map((edge) => {
      const edgeData = {}
      if (edge.data) {
        edge.data.forEach((data) => {
          edgeData[attributeNames[data['key']]] = data['#text']
        })
      }
      return {
        id: edge['id'],
        source: edge['source'],
        target: edge['target'],
        ...edgeData,
      }
    })
    const nodesToUpdate = []
    nodes.forEach((node) => {
      const n = deepCopy(styles.nodes.group0)
      if (!node.id) throw new Error(`No ID for node ${node.label}`)
      n.id = node.id
      n.label = node.label ? node.label : node.id
      if (node.size) n.size = node.size
      if (node.x) n.x = node.x
      if (node.y) n.y = node.y
      if (node.r !== undefined && node.g !== undefined && node.b !== undefined) {
        n.color.background = `rgb(${node.r},${node.g},${node.b})`
        n.font.color = rgbIsLight(node.r, node.g, node.b) ? 'rgb(0,0,0)' : 'rgb(255,255,255)'
      }
      nodesToUpdate.push(n)
    })
    data.nodes.update(nodesToUpdate)
    // and each edge
    const edgesToUpdate = []
    edges.forEach((edge) => {
      const e = deepCopy(styles.edges.edge0)
      if (!edge.id) throw new Error('Missing edge ID')
      e.id = edge.id
      if (!data.nodes.get(edge.source)) {
        throw new Error(`No node ${edge.source} for source of edge ID ${edge.id}`)
      }
      e.from = edge.source
      if (!data.nodes.get(edge.target)) {
        throw new Error(`No node ${edge.target} for source of edge ID ${edge.id}`)
      }
      e.to = edge.target
      e.width = edge.weight > 20 ? 20 : edge.weight < 1 ? 1 : edge.weight
      edgesToUpdate.push(e)
    })
    data.edges.update(edgesToUpdate)
  } else {
    alertMsg('Bad format in GraphML file', 'error')
    throw new Error('Bad format in GraphML file')
  }
}

/**
 * Parse and load a Gephi GEXF file into PRSM format
 * @param {string} gexf - XML string from file
 */
function loadGEXFfile(gexf) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: true,
    isArray: (name) => ['node', 'edge', 'attribute', 'attvalue'].includes(name),
    transformTagName: (tag) => (tag.startsWith('viz:') ? tag.replace('viz:', 'viz_') : tag),
  })

  const jsonObj = parser.parse(gexf)
  const graph = jsonObj.gexf?.graph || jsonObj.graph
  if (!graph) throw new Error('Invalid GEXF format: no graph found')

  const attributes = processAttributes(graph.attributes)

  const nodes = (graph.nodes?.node || []).map((node) => ({
    id: node.id,
    label: node.label || node.id,
    attributes: processAttributeValues(node.attvalues?.attvalue || []),
    ...processVizAttributes(node),
    ...processNodePosition(node),
  }))

  const edges = (graph.edges?.edge || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || graph.defaultedgetype || 'directed',
    weight: parseFloat(edge.weight) || 1,
    attributes: processAttributeValues(edge.attvalues?.attvalue || []),
    ...processEdgeVizAttributes(edge),
  }))

  const attributeNames = { ...(yNetMap.get('attributeTitles') || {}) }
  Object.entries(attributes.nodes).forEach(([id, { title }]) => (attributeNames[id] = title))
  yNetMap.set('attributeTitles', attributeNames)

  const nodesToUpdate = nodes.map((node) => {
    if (!node.id) throw new Error(`No ID for node ${node.label}`)
    const base = { ...deepCopy(styles.nodes.group0), ...node.attributes }
    const color = node.viz?.color ? rgba(node.viz.color) : base.color.background
    return {
      ...base,
      id: node.id,
      label: node.label,
      x: node.position?.x,
      y: node.position?.y,
      size: node.viz?.size,
      shape: node.viz?.shape,
      color: {
        border: color,
        background: color,
        highlight: {
          border: color,
          background: color,
        },
        hover: {
          border: color,
          background: color,
        },
      },
      font: color
        ? {
            ...base.font,
            color: rgbIsLight(color.r, color.g, color.b) ? 'rgb(0,0,0)' : 'rgb(255,255,255)',
          }
        : base.font,
    }
  })
  data.nodes.update(nodesToUpdate)

  const edgesToUpdate = edges.map((edge) => {
    if (!edge.id) throw new Error('Missing edge ID')
    if (!data.nodes.get(edge.source)) throw new Error(`No node ${edge.source} for edge ${edge.id}`)
    if (!data.nodes.get(edge.target)) throw new Error(`No node ${edge.target} for edge ${edge.id}`)

    const base = deepCopy(styles.edges.edge0)
    const color = edge.viz?.color ? rgba(edge.viz.color) : base.color.color
    const width = Math.min(20, Math.max(1, edge.weight))

    return {
      ...base,
      id: edge.id,
      from: edge.source,
      to: edge.target,
      width,
      color: {
        color,
        highlight: color,
        hover: color,
        opacity: 1,
      },
    }
  })
  data.edges.update(edgesToUpdate)

  // === Helpers ===
  function processAttributes(attributesNode) {
    const result = { nodes: {}, edges: {} }
    if (!attributesNode) return result
    const attributes = Array.isArray(attributesNode) ? attributesNode : [attributesNode]

    ;(attributes || []).forEach(({ class: cls, attribute = [] }) => {
      attribute.forEach(({ id, title, name, type }) => {
        result[cls === 'node' ? 'nodes' : 'edges'][id] = {
          title: title || name,
          type: type || 'string',
        }
      })
    })

    return result
  }

  function processAttributeValues(attvalues) {
    return (Array.isArray(attvalues) ? attvalues : []).reduce((acc, { for: key, value }) => {
      if (key !== undefined && value !== undefined) acc[key] = value
      return acc
    }, {})
  }

  /* eslint-disable camelcase */
  // GEXF format uses snake_case for viz_* properties (e.g. viz_size, viz_color, viz_shape, viz_position, viz_thickness)
  function processVizAttributes(el) {
    const { viz_size, viz_color, viz_shape } = el
    const viz = {}
    if (viz_size) viz.size = parseFloat(viz_size.value || viz_size.size)
    if (viz_color) {
      viz.color = {
        r: parseInt(viz_color.r || 0),
        g: parseInt(viz_color.g || 0),
        b: parseInt(viz_color.b || 0),
        a: parseFloat(viz_color.a ?? 1.0),
      }
    }
    if (viz_shape) viz.shape = viz_shape.value
    return Object.keys(viz).length ? { viz } : {}
  }

  function processNodePosition({ viz_position, x, y, z }) {
    const pos = viz_position
      ? {
          x: +viz_position.x || 0,
          y: +viz_position.y || 0,
          z: +viz_position.z || 0,
        }
      : x || y || z
        ? { x: +x, y: +y, z: +z }
        : null
    return pos ? { position: pos } : {}
  }

  function processEdgeVizAttributes({ viz_thickness, viz_color, viz_shape }) {
    const viz = {}
    if (viz_thickness) viz.thickness = parseFloat(viz_thickness.value)
    if (viz_color) {
      viz.color = {
        r: parseInt(viz_color.r || 0),
        g: parseInt(viz_color.g || 0),
        b: parseInt(viz_color.b || 0),
        a: parseFloat(viz_color.a ?? 1.0),
      }
    }
    if (viz_shape) viz.shape = viz_shape.value
    return Object.keys(viz).length ? { viz } : {}
  }
  /* eslint-enable camelcase */

  function rgba({ r, g, b, a = 1.0 }) {
    return `rgba(${r},${g},${b},${a})`
  }
}
/**
 * Parse and load a file exported from Draw.io
 * The file must be in XML format, as exported from Draw.io
 * The file should contain a single mxGraphModel element with mxCell elements for nodes and edges.
 * The nodes should have a label and an mxGeometry element with x, y, width and height attributes.
 * Other node cells are ignored, as are nodes holding images
 * The edges should have a source and target attribute.
 * @param {string} contents
 */
function loadDrawIOfile(contents) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  })

  const jsonObj = parser.parse(contents)
  const graph = jsonObj.mxfile?.diagram?.mxGraphModel.root.mxCell
  if (!graph) throw new Error('Invalid Draw.io format: no graph found')
  const nodes = []
  const edges = []
  graph.forEach((cell) => {
    // skip the root cell
    if (cell.mxGeometry) {
      if (cell.edge) {
        let edge = {
          ...deepCopy(styles.edges.base),
          id: cell.id,
          from: cell.source,
          to: cell.target,
          label: splitText((cell.value || '').replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')),
          grp: 'drawIOEdge',
        }
        if (!cell.source || !cell.target) {
          console.warn(`Edge ${cell.id} has no source or target, ignoring it`)
          edge = 'ignore'
        } else if (cell.style) {
          const style = cell.style.split(';')
          style.forEach((s) => {
            if (s.startsWith('strokeColor')) {
              edge.color.color = hexToRgba(s.split('=')[1])
            } else if (s.startsWith('strokeWidth')) {
              edge.width = parseInt(s.split('=')[1])
            } else if (s.startsWith('dashed')) {
              edge.dashes = s.split('=')[1] === '1'
            }
          })
        }
        if (edge !== 'ignore') edges.push(edge)
      } else {
        let node = {
          ...deepCopy(styles.nodes.base),
          id: cell.id,
          label: splitText((cell.value || ' ').replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')),
          x: parseFloat(cell.mxGeometry.x),
          y: parseFloat(cell.mxGeometry.y),
          widthConstraint: { minimum: parseFloat(cell.mxGeometry.width) },
          heightConstraint: { minimum: parseFloat(cell.mxGeometry.height) },
          grp: 'drawIOnode',
        }
        if (!node.id || node.label.trim() === '') {
          //ignore nodes with blank labels
          console.warn(`Ignoring node ${node.id} without an Id or with a blank label`)
          node = 'ignore'
        } else {
          if (cell.style) {
            const style = cell.style.split(';')
            // default node style is a white box with thin black border
            node.color.background = 'rgba(255, 255, 255, 1)'
            node.borderWidth = 1
            node.color.border = 'rgba(0, 0, 0, 1)'
            node.shape = 'box'
            style.forEach((s) => {
              if (s === 'ellipse') {
                node.shape = 'ellipse'
                node.heightConstraint = { minimum: 50 }
              } else if (s === 'text') {
                node.shape = 'text'
                node.borderWidth = 0
              }
              if (s.startsWith('fillColor')) {
                node.color.background = hexToRgba(s.split('=')[1])
              } else if (s.startsWith('strokeColor')) {
                node.color.border = hexToRgba(s.split('=')[1])
              } else if (s.startsWith('strokeWidth')) {
                node.borderWidth = parseInt(s.split('=')[1])
              } else if (s.startsWith('shape')) {
                node.shape = s.split('=')[1]
              } else if (s.startsWith('image')) {
                // ignore image nodes
                console.warn(`Ignoring image node ${node.label} (${node.id})`)
                node = 'ignore'
              } else if (s.startsWith('fontColor')) {
                node.font.color = hexToRgba(s.split('=')[1])
              } else if (s.startsWith('round')) {
                node.shapeProperties = {
                  borderRadius: parseInt(s.split('=')[1]) ? 6 : 0,
                }
              }
            })
          }
          if (node !== 'ignore') nodes.push(node)
        }
      }
    }
  })
  data.nodes.update(nodes)
  // check all edges are connected to nodes
  edges.forEach((edge) => {
    if (!edge.id) throw new Error('Missing edge ID')
    if (!data.nodes.get(edge.from)) {
      throw new Error(`Missing 'from' factor: ${edge.from} for edge: ${edge.id}`)
    }
    if (!data.nodes.get(edge.to)) {
      throw new Error(`Missing 'to' factor: ${edge.to} for edge: ${edge.id}`)
    }
  })
  data.edges.update(edges)
}
/**
 * Parse and load a Kumu file
 * The file must be in JSON format, as exported from Kumu.
 *
 * @param {string} str - JSON string from Kumu file
 * @returns {void}
 *
 */
function loadKumufile(str) {
  const kumuData = JSON.parse(str)
  const elements = kumuData.elements
  if (!elements) throw new Error('Invalid Kumu file: no elements found')
  const defaultMap = kumuData.defaultMap
  const connections = kumuData.connections || []
  const maps = kumuData.maps
  const defaultPerspective = maps.find((map) => map._id === defaultMap).defaultPerspective
  if (!defaultPerspective) {
    throw new Error('Invalid Kumu file: no default perspective found')
  }
  const perspectives = kumuData.perspectives
  const attributes = kumuData.attributes || {}
  const nodeMap = new Map()
  const edgeMap = new Map()

  // convert from Kumu element shapes to nearest PRSM factor shapes
  const shapeConversion = {
    circle: 'ellipse',
    rectangle: 'box',
    diamond: 'diamond',
    triangle: 'triangle',
    hexagon: 'hexagon',
    square: 'box',
    pill: 'box',
    pentagon: 'hexagon',
    octagon: 'hexagon',
  }
  // get names of attributes and save them
  let attributeToUseAsNodeStyle = 'Category' // the name of the attribute that will be used to style nodes
  let attributeToUseAsLinkStyle = 'Relationship impact' // the name of the attribute that will be used to style links
  if (kumuData.description) {
    attributeToUseAsNodeStyle =
      /PRSMFactorStyleAttribute\s*=\s['|"](.*)['|"]/i.exec(kumuData.description)?.[1] ||
      attributeToUseAsNodeStyle
    attributeToUseAsLinkStyle =
      /PRSMLinkStyleAttribute\s*=\s['|"](.*)['|"]/i.exec(kumuData.description)?.[1] ||
      attributeToUseAsLinkStyle
  }
  let attributeToUseAsNodeStyleId // the id of the attribute that will be used to style nodes
  const attributeNames = { ...(yNetMap.get('attributeTitles') || {}) }
  attributes.forEach((attr) => {
    if (!['Description', 'Label'].includes(attr.name)) attributeNames[attr._id] = attr.name
    if (attr.name === attributeToUseAsNodeStyle) {
      attributeToUseAsNodeStyleId = attr._id
      // use the values as the names of the node styles
      let group = 0
      for (const styleName of attr.values) {
        styles.nodes[`group${group}`].groupLabel = styleName
        refreshSampleNode(`group${group}`)
        if (group >= 15) break
        group++
      }
    }
    if (attr.name === attributeToUseAsLinkStyle) {
      // use the values as the names of the link styles
      let group = 0
      for (const styleName of attr.values) {
        styles.edges[`edge${group}`].groupLabel = styleName
        refreshSampleLink(`edge${group}`)
        if (group >= 9) break
        group++
      }
    }
  })
  yNetMap.set('attributeTitles', attributeNames)

  // get perspective, edit PRSM styles and apply styles to factors and links

  const perspective = perspectives.find((p) => p._id === defaultPerspective)
  // translate KUMU CSS style format to an object for easier access
  const pStyles = parseKumuPerspectiveStyle(perspective.style)
  // console.log("Styles:", pStyles)

  /* Use the Perspective element styles to set the PRSM styles
	e.g element["category"="Driver"]
{
	color: #d73027;
	border-colour: black;
	border-width: 10;
}
	will name a PRSM node style "Driver" with a background color of #d73027, 
	a black border and a border width of 10.
	*/
  const elementStyles = pStyles['element-styles']
  for (const eStyle of elementStyles) {
    if (eStyle.match?.category) {
      // find the style with the category name
      const style = Object.entries(styles.nodes).find(
        (a) => a[1].groupLabel === eStyle.match.category
      )[0]
      const styleNode = styles.nodes[style]
      styleNode.color.background = eStyle.styles.color
      styleNode.color.border = eStyle.styles['border-color'] || 'black'
      styleNode.borderWidth = eStyle.styles['border-width'] / 10 || 0
      styleNode.font.color = eStyle.styles['font-color'] || 'rgb(0,0,0)'
      styleNode.shape = shapeConversion[eStyle.styles['shape']] || 'dot'
      refreshSampleNode(style)
    }
  }

  // get all elements
  elements.forEach((element) => {
    const label = element?.attributes?.label
    const note = element?.attributes?.description || ''
    const attributes = {}
    for (const attr in attributeNames) {
      const value = element?.attributes[attributeNames[attr].toLowerCase()]
      // flatten attribute value from an array to a set of strings
      attributes[attr] = Array.isArray(value) ? value.join(' | ') : value
    }
    // skip elements with no label
    if (label) {
      nodeMap.set(element._id, {
        ...deepCopy(styles.nodes.base),
        id: element._id,
        label: splitText((label || ' ').replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')),
        note: note ? markdownToDelta(note) : '',
        shape: 'circle',
        shapeProperties: { borderRadius: 0 },
        grp: 'kumuGroup',
        ...attributes,
      })
    }
  })

  const ignoredCategories = pStyles['@settings'].ignore
  const defaultFontSize = pStyles['@settings']['font-size'] || 250
  const defaultElementSize = pStyles['@settings']['element-size'] || 100
  nodeMap.forEach((node, id) => {
    const category = node[attributeToUseAsNodeStyleId]
    let group
    for (const style in styles.nodes) {
      if (styles.nodes[style].groupLabel === category) group = style
    }
    if (group) {
      node = deepMerge(node, styles.nodes[group], { grp: group })

      // if the node is in an ignored category, hide it
      const hideNode = ignoredCategories && ignoredCategories.includes(category)
      if (hideNode) node = setNodeHidden(node, hideNode)
    }
    nodeMap.set(id, node)
  })

  // get all links

  // first, amend the styles for the links
  const edgeStyles = pStyles['connection-styles']
  for (const lStyle of edgeStyles) {
    if (lStyle.match[attributeToUseAsLinkStyle]) {
      // find the style with the category name
      const style = Object.entries(styles.edges).find(
        (a) => a[1].groupLabel === lStyle.match[attributeToUseAsLinkStyle]
      )[0]
      const styleEdge = styles.edges[style]
      styleEdge.color.color = lStyle.styles.color
      refreshSampleLink(style)
    }
  }
  connections.forEach((connection) => {
    const label = connection?.attributes?.label || ''
    const note = connection?.attributes?.description || ''
    edgeMap.set(connection._id, {
      ...deepCopy(styles.edges.base),
      id: connection._id,
      from: connection.from,
      to: connection.to,
      label: splitText((label || '').replace(/<[^>]*>/g, '').replace('&nbsp;', ' ')),
      note: note ? markdownToDelta(note) : '',
      groupLabel: connection?.attributes[attributeToUseAsLinkStyle.toLowerCase()],
      grp: 'kumuEdge',
    })
  })

  edgeMap.forEach((edge, id) => {
    let group
    for (const style in styles.edges) {
      if (styles.edges[style].groupLabel === edge.groupLabel) {
        group = style
        break
      }
    }
    if (group) {
      edge = deepMerge(edge, styles.edges[group], { grp: group })
      edgeMap.set(id, edge)
    }
  })

  const map = maps.find((m) => m._id === defaultMap)
  if (map.description) {
    const description = markdownToDelta(map.description)
    yNetMap.set('mapDescription', description)
    setSideDrawer({ text: description })
  }
  if (map.name) {
    yNetMap.set('mapTitle', setMapTitle(map.name))
  }
  if (map.elements) {
    map.elements.forEach((element) => {
      const node = nodeMap.get(element.element)
      if (node) {
        const color = element.style.color
        if (color) {
          node.color = {
            background: color,
            border: color,
            hover: { background: color, border: color },
            highlight: { background: color, border: color },
          }
          if (
            node.color.background === 'transparent' ||
            node.color.background === 'rgba(0,0,0,0)'
          ) {
            node.shape = 'text'
          }
        }
        node.font.size = defaultFontSize
        if (element.style.fontColor) node.font.color = element.style.fontColor
        if (element.style.fontSize) node.font.size = element.style.fontSize
        if (element.style.fontFace) node.font.face = element.style.fontFace
        if (element.style.shape) node.shape = shapeConversion[element.style.shape]
        if (element.style.shape === 'pill') {
          node.shapeProperties = { borderRadius: 20 }
        }
        const size = element.style.size || defaultElementSize
        node.size = size
        if (element.position) {
          node.x = element?.position?.x
          node.y = element?.position?.y
        }
      }
    })
  }
  data.nodes.update(Array.from(nodeMap.values()))

  if (map.connections) {
    map.connections.forEach((connection) => {
      const edge = edgeMap.get(connection.connection)
      if (connection.style.color) {
        const color = connection.style.color
        edge.color = { color, hover: color, highlight: color }
      }
      edge.font = {
        color: connection.style.fontColor || 'rgb(0, 0, 0)',
        size: connection.style.fontSize || defaultFontSize,
        face: connection.style.fontFace || 'Oxygen',
      }
      if (data.nodes.get(edge.from).nodeHidden || data.nodes.get(edge.to).nodeHidden) {
        setEdgeHidden(edge, true)
      }
      edgeMap.set(connection._id, edge)
    })

    data.edges.update(Array.from(edgeMap.values()))
  }
}

function parseKumuPerspectiveStyle(input) {
  const result = {
    '@view': {},
    '@controls': {},
    '@settings': {},
    '#background': {},
    'element-styles': [],
    'connection-styles': [],
  }

  // Clean up input
  const clean = input
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '')
    .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')
    .trim()

  // Utility to parse blocks like @view 'X' { @settings { ... } }
  function parseBlock(label, blockString) {
    const settingsMatch = blockString.match(/@settings\s*\{([^}]*)\}/s)
    if (!settingsMatch) return {}
    const settingsContent = settingsMatch[1].trim()
    return parseKeyValueBlock(settingsContent)
  }

  // Utility to parse key-value pairs (semicolon-separated)
  function parseKeyValueBlock(text) {
    const obj = {}
    const lines = text.split(/;\s*\n?/).filter(Boolean)
    for (const line of lines) {
      let [key, value] = line.split(/:\s+/)
      if (!key || value === undefined) continue
      key = key.trim()
      obj[key] = cleanValue(value)
    }
    return obj
  }

  // Utility to clean and convert values
  function cleanValue(val) {
    if (!val) return null
    val = val.trim().replace(/;/g, '').replace(/^"|"$/g, '')
    if (val === 'True') return true
    if (val === 'False') return false
    if (!isNaN(val)) return Number(val)
    if (val.includes(',')) {
      return val.split(',').map((v) => cleanValue(v.trim()))
    }
    return val
  }

  // Parse all @view blocks
  const viewRegex = /@view\s+'([^']+)'\s*\{([^}]*?\})/gs
  let match
  while ((match = viewRegex.exec(clean)) !== null) {
    const [, name, body] = match
    result['@view'][name] = {
      '@settings': parseBlock(name, body),
    }
  }

  // Parse @settings (global)
  const [, , globalSettingsMatch] = clean.match(/\}\s*(@settings\s*\{([^}]+)\})/s)
  if (globalSettingsMatch) {
    result['@settings'] = parseKeyValueBlock(globalSettingsMatch)
  }

  // Parse #background
  const bgMatch = clean.match(/#background\s*\{([^}]+)\}/s)
  if (bgMatch) {
    result['#background'] = parseKeyValueBlock(bgMatch[1])
  }

  // Parse element styles
  const elementRegex = /element\["([^"]+)"="?([^"\]]*)"?\]\s*\{([^}]+)\}/gs
  while ((match = elementRegex.exec(clean)) !== null) {
    const [, key, val, styleBody] = match
    const styleObj = parseKeyValueBlock(styleBody)
    result['element-styles'].push({
      match: { [key]: val },
      styles: styleObj,
    })
  }

  // Parse connection styles
  const connRegex = /connection\["([^"]+)"="?([^"\]]*)"?\]\s*\{([^}]+)\}/gs
  while ((match = connRegex.exec(clean)) !== null) {
    const [, key, val, styleBody] = match
    const styleObj = parseKeyValueBlock(styleBody)
    result['connection-styles'].push({
      match: { [key]: val },
      styles: styleObj,
    })
  }

  // Parse controls
  function parseToObject(input) {
    const match = input.match(/@controls\s*{([\s\S]*)}$/)
    if (!match) return null // Not a valid @controls block

    const content = `{${match[1]}` // restore root-level opening brace
    const tokens = content.match(/([{}])|("[^"]*"|\w[\w-]*)\s*:?\s*("[^"]*"|[^;{}]+)?;?/g)
    if (!tokens) return {}

    let index = 0

    function parseBlock() {
      const result = {}

      while (index < tokens.length) {
        const token = tokens[index++].trim()

        if (token === '}') {
          return result
        } else if (token === '{') {
          continue
        }

        const nextToken = tokens[index] ? tokens[index].trim() : null

        if (nextToken === '{') {
          index++
          const child = parseBlock()
          if (result[token]) {
            if (Array.isArray(result[token])) {
              result[token].push(child)
            } else {
              result[token] = [result[token], child]
            }
          } else {
            result[token] = child
          }
        } else if (token.includes(':')) {
          const [key, val] = token.split(/\s*:\s*/)
          result[key] = cleanValue(val)
        } else if (nextToken && nextToken.includes(':')) {
          const [, val] = nextToken.split(/\s*:\s*/)
          index++
          result[token] = cleanValue(val)
        }
      }

      return result
    }

    index++ // Skip initial {
    return parseBlock()
  }
  result['@controls'] = parseToObject(clean)

  return result
}

/**
 * Parse and load a GML file
 * @param {string} gml
 */
function loadGML(gml) {
  if (gml.search('graph') < 0) throw new Error('invalid GML format')
  const tokens = gml.match(/"[^"]+"|[\w]+|\[|\]/g)
  let node
  let edge
  let edgeId = 0
  let tok = tokens.shift()
  while (tok) {
    switch (tok) {
      case 'graph':
        break
      case 'node':
        tokens.shift() // [
        node = {}
        tok = tokens.shift()
        while (tok !== ']') {
          switch (tok) {
            case 'id':
              node.id = tokens.shift().toString()
              break
            case 'label':
              node.label = splitText(tokens.shift().replace(/"/g, ''), NODEWIDTH)
              break
            case 'color':
            case 'colour':
              node.color = {}
              node.color.background = tokens.shift().replace(/"/g, '')
              break
            case '[': // skip embedded groups
              while (tok !== ']') tok = tokens.shift()
              break
            default:
              break
          }
          tok = tokens.shift() // ]
        }
        if (node.label === undefined) node.label = node.id
        data.nodes.add(node)
        break
      case 'edge':
        tokens.shift() // [
        edge = {}
        tok = tokens.shift()
        while (tok !== ']') {
          switch (tok) {
            case 'id':
              edge.id = tokens.shift().toString()
              break
            case 'source':
              edge.from = tokens.shift().toString()
              break
            case 'target':
              edge.to = tokens.shift().toString()
              break
            case 'label':
              edge.label = tokens.shift().replace(/"/g, '')
              break
            case 'color':
            case 'colour':
              edge.color = tokens.shift().replace(/"/g, '')
              break
            case '[': // skip embedded groups
              while (tok !== ']') tok = tokens.shift()
              break
            default:
              break
          }
          tok = tokens.shift() // ]
        }
        if (edge.id === undefined) edge.id = (edgeId++).toString()
        data.edges.add(edge)
        break
      default:
        break
    }
    tok = tokens.shift()
  }
}
/**
 * Read a comma separated values file consisting of 'From' label and 'to' label, on each row,
	 with a header row (ignored) 
	optional, cols 3 and 4 can include the groups (styles) of the from and to nodes,
	column 5 can include the style of the edge.  All these must be integers between 1 and 9
 * @param {string} csv 
 */
function loadCSV(csv) {
  const lines = csv.split(/\r\n|\n/)
  const labels = new Map()
  const links = []

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].length <= 2) continue // empty line
    const line = splitCSVrow(lines[i])
    const from = node(line[0], line[2], i)
    const to = node(line[1], line[3], i)
    let grp = line[4]
    if (grp) grp = 'edge' + (parseInt(grp.trim()) - 1)
    links.push({
      id: uuidv4(),
      from: from.id,
      to: to.id,
      grp,
    })
  }
  data.nodes.add(Array.from(labels.values()))
  data.edges.add(links)
  /**
   * Parse a CSV row, accounting for commas inside quotes
   * @param {string} row
   * @returns array of fields
   */
  function splitCSVrow(row) {
    let insideQuote = false
    const entries = []
    let entry = []
    row.split('').forEach(function (character) {
      if (character === '"') {
        insideQuote = !insideQuote
      } else {
        if (character === ',' && !insideQuote) {
          entries.push(entry.join(''))
          entry = []
        } else {
          entry.push(character)
        }
      }
    })
    entries.push(entry.join(''))
    return entries
  }
  /**
   * retrieves or creates a (new) node object with given label and style,
   * @param {string} label
   * @param {number} grp
   * @param {number} lineNo the file line where this node was read from
   * @returns the node object
   */
  function node(label, grp, lineNo) {
    label = label.trim()
    if (grp) {
      const styleNo = parseInt(grp)
      if (isNaN(styleNo) || styleNo < 1 || styleNo > 9) {
        throw new Error(
          `Line ${lineNo}: Columns 3 and 4 must be values between 1 and 9 or blank (found ${grp})`
        )
      }
      grp = 'group' + (styleNo - 1)
    }
    if (labels.get(label) === undefined) {
      labels.set(label, { id: uuidv4(), label: label.toString(), grp })
    }
    return labels.get(label)
  }
}
/**
 * Reads map data from an Excel file.  The file must have two spreadsheets in the workbook, named Factors and Links
 * In the spreadsheet, there must be a header row, and columns for (minimally) Label (and for links, also From and To,
 * with entries with the exact same text as the Labels in the Factor sheet.  There may be a Style column, which is used
 * to specify the style for the Factor or Link (numbered from 1 to 9).  There may be a Description (or note or Note)
 * column, the contents of which are treated as a Factor or Link note.  Any other columns are treated as holding values
 * for additional Attributes.
 *
 * Uses https://sheetjs.com/
 *
 * @param {*} contents
 * @returns nodes and edges data
 */
function loadExcelfile(contents) {
  const workbook = read(contents)
  const factorsSS = workbook.Sheets['Factors']
  if (!factorsSS) throw new Error('Sheet named Factors not found in Workbook')
  const linksSS = workbook.Sheets['Links']
  if (!linksSS) throw new Error('Sheet named Links not found in Workbook')

  // attributeNames is an object with properties attributeField: attributeTitle
  const attributeNames = {}

  /* 
	 Transform data about factors into an array of objects, with properties named after the column headings
	 (with first letter lower cased if necessary) and values from that row's cells.
	 add a GUID to the object,  change 'Style' property to 'grp'
	 Style is a style number
	 Put value of Description or Notes property into notes
	 Check that any other property names are not in the list of known attribute names; if so add that property name to the attribute name list 
	 Place the factor either at the given x and y coordinates or at some random location
	 */

  // convert data from Factors sheet into an array of objects with properties starting with lower case letters
  const factors = utils.sheet_to_json(factorsSS).map((f) => lowerInitialLetterOfProps(f))
  const maxIndexOfFactorStyles = Object.keys(styles.nodes).length - 1
  factors.forEach((f) => {
    f.id = uuidv4()
    if (f.style) {
      const styleNo = parseInt(f.style)
      if (isNaN(styleNo) || styleNo < 1 || styleNo > maxIndexOfFactorStyles) {
        throw new Error(
          `Factors - Line ${f.__rowNum__}: Style must be a number between 1 and ${maxIndexOfFactorStyles} or blank (found ${f.style})`
        )
      }
      f.grp = 'group' + (styleNo - 1)
      if (f.groupLabel) {
        const styleDataSet = Array.from(document.getElementsByClassName('sampleNode'))[styleNo - 1]
          .dataSet
        const styleNode = styleDataSet.get('1')
        styleNode.label = f.groupLabel
        styleNode.groupLabel = f.groupLabel
        styleDataSet.update(styleNode)
        styles.nodes[f.grp].groupLabel = f.groupLabel
      }
      delete f.style
    }
    if (!f.label) throw new Error(`Factors - Line ${f.__rowNum__}: Factor does not have a Label`)
    const note = f.description || f.note
    if (note) {
      f.note = { ops: [{ insert: note + '\n' }] }
      delete f.description
    }
    if (f.creator) {
      f.created = {
        time: f.createdTime ? Date.parse(f.createdTime) : Date.now(),
        user: f.creator,
      }
      delete f.createdTime
    }
    if (f.modifier) {
      f.modified = {
        time: f.modifiedTime ? Date.parse(f.modifiedTime) : Date.now(),
        user: f.modifier,
      }
      delete f.modifiedTime
    }
    // filter out known properties, leaving the rest to become attributes
    Object.keys(f)
      .filter(
        (k) =>
          ![
            'id',
            'grp',
            'label',
            'groupLabel',
            'shape',
            'note',
            'created',
            'createdTime',
            'creator',
            'modified',
            'modifiedTime',
            'modifier',
            'x',
            'y',
            '__rowNum__',
          ].includes(k)
      )
      .forEach((k) => {
        let attributeField = Object.keys(attributeNames).find((prop) => attributeNames[prop] === k)
        if (!attributeField) {
          // not found, so add
          attributeField = 'att' + (Object.keys(attributeNames).length + 1)
          attributeNames[attributeField] = k
        }
        f[attributeField] = f[k]
        delete f[k]
      })
    f.x = parseInt(f.x)
    if (!f.x || isNaN(f.x)) f.x = Math.random() * 500
    f.y = parseInt(f.y)
    if (!f.y || isNaN(f.y)) f.y = Math.random() * 500
  })
  /* for each row of links
	add a GUID
	look up from and to in factor objects and replace with their ids
	add other attributes as for factors */

  const links = utils.sheet_to_json(linksSS).map((l) => lowerInitialLetterOfProps(l))
  links.forEach((l) => {
    l.id = uuidv4()
    if (l.style) {
      const styleNo = parseInt(l.style)
      if (isNaN(styleNo) || styleNo < 1 || styleNo > 9) {
        throw new Error(
          `Links - Line ${l.__rowNum__}: Style must be a number between 1 and 9, a style name, or blank (found ${l.style})`
        )
      }
      l.grp = 'edge' + (styleNo - 1)
      if (l.groupLabel) {
        const styleDataSet = Array.from(document.getElementsByClassName('sampleLink'))[styleNo - 1]
          .dataSet
        const styleEdge = styleDataSet.get('1')
        styleEdge.label = l.groupLabel
        styleEdge.groupLabel = l.groupLabel
        styleDataSet.update(styleEdge)
        styles.edges[l.grp].groupLabel = l.groupLabel
      }
      delete l.style
    }
    if (l.creator) {
      l.created = {
        time: l.createdTime ? Date.parse(l.createdTime) : Date.now(),
        user: l.creator,
      }
      delete l.createdTime
    }
    if (l.modifier) {
      l.modified = {
        time: l.modifiedTime ? Date.parse(l.modifiedTime) : Date.now(),
        user: l.modifier,
      }
      delete l.modifiedTime
    }
    const fromFactor = factors.find((factor) => factor.label === l.from)
    if (fromFactor) l.from = fromFactor.id
    else throw new Error(`Links - Line ${l.__rowNum__}: From factor (${l.from}) not found for link`)
    const toFactor = factors.find((factor) => factor.label === l.to)
    if (toFactor) l.to = toFactor.id
    else throw new Error(`Links - Line ${l.__rowNum__}: To factor (${l.to}) not found for link`)

    const note = l.description || l.note
    if (note) {
      l.note = { ops: [{ insert: note + '\n' }] }
      delete l.description
    }
    Object.keys(l)
      .filter(
        (k) =>
          ![
            'id',
            'from',
            'to',
            'grp',
            'groupLabel',
            'creator',
            'created',
            'label',
            'modified',
            'modifier',
            'note',
            '__rowNum__',
          ].includes(k)
      )
      .forEach((k) => {
        let attributeField = Object.keys(attributeNames).find((prop) => attributeNames[prop] === k)
        if (!attributeField) {
          // not found, so add
          attributeField = 'att' + (Object.keys(attributeNames).length + 1)
          attributeNames[attributeField] = k
        }
        l[attributeField] = l[k]
        delete l[k]
      })
  })
  factors.forEach((f) => {
    f.label = splitText(f.label, NODEWIDTH)
  })
  data.nodes.add(factors)
  data.edges.add(links)
  yNetMap.set('attributeTitles', attributeNames)

  /**
   * ensure the initial letter of each property of obj is lower case
   * @param {object} obj
   * @returns copy of object
   */
  function lowerInitialLetterOfProps(obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [lowerFirstLetter(k), v]))
  }
}

/**
 * save the current map as a PRSM file (in JSON format)
 */
export function savePRSMfile() {
  network.storePositions()
  const attributes = yNetMap.get('attributeTitles') || []
  const nodeFields = [
    'id',
    'label',
    'note',
    'grp',
    'x',
    'y',
    'color',
    'font',
    'borderWidth',
    'shape',
    'shapeProperties',
    'margin',
    'thumbUp',
    'thumbDown',
    'created',
    'modified',
  ]
  let json = JSON.stringify(
    {
      saved: new Date(Date.now()).toLocaleString(),
      version,
      room,
      mapTitle: elem('maptitle').innerText,
      // 			security risk to save recent maps to a file
      //			recentMaps: JSON.parse(localStorage.getItem('recents')),
      lastNodeSample,
      lastLinkSample,
      // clustering, and up/down, paths between and x links away settings are not saved (and hidden property is not saved)
      buttons: getButtonStatus(),
      attributeTitles: yNetMap.get('attributeTitles'),
      styles,
      nodes: data.nodes.get({
        fields: [...nodeFields, ...Object.keys(attributes)],
        filter: (n) => !n.isCluster,
      }),
      edges: data.edges.get({
        fields: [
          'id',
          'arrows',
          'color',
          'created',
          'dashes',
          'font',
          'from',
          'grp',
          'label',
          'modified',
          'note',
          'to',
          'width',
        ],
        filter: (e) => !e.isClusterEdge,
      }),
      background: JSON.stringify(yDrawingMap.toJSON()),
      history: yHistory.map((s) => {
        s.state = null
        return s
      }),
      description: yNetMap.get('mapDescription'),
    },
    null,
    '\t'
  )
  if (!/plain/.test(debug)) json = compressToUTF16(json)
  saveStr(json, 'prsm')
  markMapSaved()
}
/**
 * return an object with the current Network panel setting for saving
 * settings for link radius and up/down stream are not saved
 * @return an object with the Network panel settings
 */
function getButtonStatus() {
  return {
    snapToGrid: elem('snaptogridswitch').checked,
    curve: elem('curveSelect').value,
    background: elem('netBackColorWell').style.backgroundColor,
    legend: elem('showLegendSwitch').checked,
    sizing: elem('sizing').value,
  }
}
/**
 * Set the Network panel buttons to their values loaded from a file
 * @param {Object} settings
 */
function setButtonStatus(settings) {
  yNetMap.set('snapToGrid', settings.snapToGrid)
  doSnapToGrid(settings.snapToGrid)
  yNetMap.set('curve', settings.curve)
  setCurve(settings.curve)
  yNetMap.set('background', settings.background || '#ffffff')
  setBackground(yNetMap.get('background'))
  yNetMap.set('legend', settings.legend)
  setLegend(settings.legend)
  yNetMap.set('sizing', settings.sizing)
  // sizing done after the nodes have been created: sizing(settings.sizing)
  yNetMap.set('radius', { radiusSetting: 'All', selected: [] })
  yNetMap.set('stream', { streamSetting: 'All', selected: [] })
  yNetMap.set('paths', { pathsSetting: 'All', selected: [] })
  yNetMap.set('cluster', 'none')
  setCluster('none')
}

/**
 * Save the string to a local file
 * @param {string} str file contents
 * @param {string} extn file extension
 *
 * Browser will only ask for name and location of the file to be saved if
 * it has a user setting to do so.  Otherwise, it is saved at a default
 * download location with a default name.
 */
function saveStr(str, extn) {
  setFileName(extn)
  const blob = new Blob([str], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, lastFileName, { autoBom: true })
}
/**
 * save the map as a PNG image file
 */

const maxScale = 5 // max upscaling for image (avoids blowing up very small networks excessively)

export function exportPNGfile() {
  setFileName('png')

  // create a very large canvas, so we can download at high resolution
  network.storePositions()

  // first, create a large offscreen div to hold a copy of the network at the required width
  const bigWidth = 4096 / window.devicePixelRatio // half the number of pixels in the image file (also half the height, as the image is square)
  const bigMargin = 256 / window.devicePixelRatio // white space around network so not too close to printable edge

  const bigNetDiv = document.createElement('div')
  bigNetDiv.id = 'big-net-pane'
  bigNetDiv.style.position = 'absolute'
  bigNetDiv.style.top = '-9999px'
  bigNetDiv.style.left = '-9999px'
  bigNetDiv.style.width = `${bigWidth}px`
  bigNetDiv.style.height = `${bigWidth}px`
  elem('main').appendChild(bigNetDiv)

  // create an offscreen canvas of the same size to apply the background to
  const bigBackgroundCanvas = new OffscreenCanvas(bigWidth, bigWidth)
  bigBackgroundCanvas.id = 'big-background-canvas'
  const bigFabricCanvas = new StaticCanvas('big-background-canvas', {
    width: bigWidth,
    height: bigWidth,
  })

  // make a network with the same nodes and links as the original map
  const bigNetwork = new Network(bigNetDiv, data, {
    physics: { enabled: false },
    edges: {
      smooth: {
        enabled: elem('curveSelect').value === 'Curved',
        type: 'cubicBezier',
      },
    },
  })

  bigNetwork.on('afterDrawing', async (bigNetContext) => {
    // copy the background objects to the big fabric canvas
    await bigFabricCanvas.loadFromJSON(JSON.stringify(canvas))

    // adjust the fabric canvas scale and center to match the big network and match the background colour
    bigFabricCanvas.setZoom(bigNetwork.getScale())
    const fcCenter = bigFabricCanvas.getVpCenter()
    bigFabricCanvas.relativePan({
      x: bigNetwork.getScale() * (fcCenter.x - center.x),
      y: bigNetwork.getScale() * (fcCenter.y - center.y),
    })

    bigFabricCanvas.set(
      'backgroundColor',
      elem('underlay').style.backgroundColor || 'rgb(255, 255, 255)'
    )
    bigFabricCanvas.requestRenderAll()

    // create an image version of the background and copy it onto the big network canvas
    const bigBackgroundImage = document.createElement('img')
    bigBackgroundImage.onload = function () {
      bigNetContext.globalCompositeOperation = 'destination-over'
      bigNetContext.drawImage(bigBackgroundImage, 0, 0, bigWidth, bigWidth)

      // save the canvas to a file
      bigNetContext.canvas.toBlob((blob) => saveAs(blob, lastFileName))

      // clean up
      bigNetwork.destroy()
      bigNetDiv.remove()
      bigFabricCanvas.dispose()
    }
    bigBackgroundImage.src = bigFabricCanvas.toDataURL()
  })

  const box = mapBoundingBox(network, canvas, network.getSelectedNodes())
  let scale =
    network.getScale() *
    Math.min(
      (bigWidth - bigMargin) / (box.right - box.left),
      (bigWidth - bigMargin) / (box.bottom - box.top)
    )
  if (scale > maxScale) scale = maxScale
  const center = network.DOMtoCanvas({
    x: 0.5 * (box.right + box.left),
    y: 0.5 * (box.bottom + box.top),
  })
  bigNetwork.moveTo({
    scale,
    position: center,
  })

  /**
   * Get a bounding box for everything on the map (the nodes and the background objects)
   * @param {object} ntwk the map on which the nodes are placed
   * @param {array} selectedNodes Ids of selected nodes, if any
   * @returns box as an object, with dimensions in DOM coords
   */
  function mapBoundingBox(ntwk, fabCanvas, selectedNodes = []) {
    let top = Infinity
    let bottom = -Infinity
    let left = Infinity
    let right = -Infinity
    // use all nodes if none selected
    if (selectedNodes.length === 0) selectedNodes = data.nodes.map((n) => n.id)
    selectedNodes.forEach((nodeId) => {
      const canvasBB = ntwk.getBoundingBox(nodeId)
      const tl = ntwk.canvasToDOM({ x: canvasBB.left, y: canvasBB.top })
      const br = ntwk.canvasToDOM({ x: canvasBB.right, y: canvasBB.bottom })
      if (left > tl.x) left = tl.x
      if (right < br.x) right = br.x
      if (top > tl.y) top = tl.y
      if (bottom < br.y) bottom = br.y
    })
    // only include background objects if no nodes are selected
    if (selectedNodes.length === 0) {
      fabCanvas.forEachObject((obj) => {
        const boundingBox = obj.getBoundingRect()
        console.log(obj, boundingBox)
        if (left > boundingBox.left) left = boundingBox.left
        if (right < boundingBox.left + boundingBox.width) {
          right = boundingBox.left + boundingBox.width
        }
        if (top > boundingBox.top) top = boundingBox.top
        if (bottom < boundingBox.top + boundingBox.height) {
          bottom = boundingBox.top + boundingBox.height
        }
      })
    }
    if (left === Infinity) {
      top = bottom = left = right = 0
    }
    return { left, right, top, bottom }
  }
}
/**
 * save a local file containing all the node and edge notes, plus the map description, as a Word document
 */
export async function exportNotes() {
  let delta = { ops: [{ insert: '\n' }] }
  // start with the title of the map if there is one
  const title = elem('maptitle').innerText
  if (title !== 'Untitled map') {
    delta = {
      ops: [{ insert: title }, { attributes: { header: 1 }, insert: '\n' }],
    }
  }
  // get contents of map note if there is one
  if (yNetMap.get('mapDescription')) {
    delta.ops = delta.ops.concat(
      [{ insert: 'Description of the map' }, { attributes: { header: 2 }, insert: '\n' }],
      yNetMap.get('mapDescription').text.ops
    )
  }
  // add notes for factors
  data.nodes
    .get()
    .toSorted((a, b) => a.label.localeCompare(b.label))
    .forEach((n) => {
      delta.ops = delta.ops.concat(
        [{ insert: `Factor: ${stripNL(n.label)}` }, { attributes: { header: 2 }, insert: '\n' }],
        n.note ? n.note.ops : [{ insert: '[No note]\n' }]
      )
    })
  // add notes for links
  data.edges.forEach((e) => {
    const heading = `Link from '${stripNL(data.nodes.get(e.from).label)}' to '${stripNL(data.nodes.get(e.to).label)}'`
    delta.ops = delta.ops.concat([{ insert: heading }, { attributes: { header: 2 }, insert: '\n' }])
    delta.ops = delta.ops.concat(e.note ? e.note.ops : [{ insert: '[No note]\n' }])
  })
  // save the delta as a Word file
  const quillToWordConfig = {
    exportAs: 'blob',
    paragraphStyles: {
      normal: {
        paragraph: {
          spacing: {
            line: 240,
          },
        },
      },
    },
  }
  const ql = await import('quill-to-word')
  const docAsBlob = await ql.generateWord(delta, quillToWordConfig)
  setFileName('docx')
  saveAs(docAsBlob, lastFileName)
}
/**
 * resets lastFileName to a munged version of the map title, with the supplied extension
 * if lastFileName is null, uses the map title, or if no map title, 'network' as the filename
 * @param {string} extn filename extension to apply
 */
export function setFileName(extn = 'prsm') {
  const title = elem('maptitle').innerText
  if (title === 'Untitled map') lastFileName = 'network'
  else lastFileName = title.replace(/\s+/g, '').replaceAll('.', '_').toLowerCase()
  lastFileName += '.' + extn
}
/**
 * Save the map as CSV files, one for nodes and one for edges
 * Only node and edge labels and style ids are saved
 *
 * Now obsolete, as the Excel file format is much more useful
 */
/* export function exportCVS() {
	let dummyDiv = document.createElement('div')
	dummyDiv.id = 'dummy-div'
	dummyDiv.style.display = 'none'
	container.appendChild(dummyDiv)
	let qed = new Quill('#dummy-div')
	let str = 'Id,Label,Style,Note\n'
	for (let node of data.nodes.get()) {
		str += node.id + ','
		if (node.label) str += '"' + node.label.replaceAll('\n', ' ') + '"'
		str += ',' + node.grp + ','
		if (node.note) {
			qed.setContents(node.note)
			// convert Quill formatted note to HTML, escaping all "
			str +=
				'"' +
				new QuillDeltaToHtmlConverter(qed.getContents().ops, {
					inlineStyles: true,
				})
					.convert()
					.replaceAll('"', '""') +
				'"'
		}
		str += '\n'
	}
	saveStr(str, 'nodes.csv')
	str = 'Source,Target,Type,Id,Label,Style,Note\n'
	for (let edge of data.edges.get()) {
		str += edge.from + ','
		str += edge.to + ','
		str += 'directed,'
		str += edge.id + ','
		if (edge.label) str += edge.label.replaceAll('\n', ' ') + '"'
		str += ',' + edge.grp + ','
		if (edge.note) {
			qed.setContents(edge.note)
			// convert Quill formatted note to HTML, escaping all "
			str +=
				'"' +
				new QuillDeltaToHtmlConverter(qed.getContents().ops, {
					inlineStyles: true,
				})
					.convert()
					.replaceAll('"', '""') +
				'"'
		}
		str += '\n'
	}
	saveStr(str, 'edges.csv')
	dummyDiv.remove()
} */
/**
 * Save the map in an Excel workbook, with two sheets: Factors and Links
 */
export function exportExcel() {
  // set up Quill note conversion
  const dummyDiv = document.createElement('div')
  dummyDiv.id = 'dummy-div'
  dummyDiv.style.display = 'none'
  container.appendChild(dummyDiv)
  const qed = new Quill('#dummy-div')
  // create workbook
  const workbook = utils.book_new()
  // Factors
  let rows = data.nodes
    .get()
    .filter((n) => !n.isCluster)
    .map((n) => {
      if (n.created) {
        n.creator = n.created.user
        n.createdTime = new Date(n.created.time).toISOString()
      }
      if (n.modified) {
        n.modifier = n.modified.user
        n.modifiedTime = new Date(n.modified.time).toISOString()
      }
      n.style = parseInt(n.grp.substring(5)) + 1
      if (n.note) n.Note = quillToText(n.note)
      // don't save any of the listed properties
      return omit(n, [
        'bc',
        'borderWidth',
        'borderWidthSelected',
        'color',
        'created',
        'fixed',
        'font',
        'grp',
        'hidden',
        'id',
        'clusteredIn',
        'level',
        'labelHighlightBold',
        'locked',
        'margin',
        'modified',
        'nodeHidden',
        'opacity',
        'oldFont',
        'oldFontColor',
        'oldLabel',
        'note',
        'scaling',
        'shadow',
        'shapeProperties',
        'size',
        'heightConstraint',
        'val',
        'value',
        'wasFixed',
        'widthConstraint',
      ])
    })

  const factorWorksheet = utils.json_to_sheet(rows)
  utils.book_append_sheet(workbook, factorWorksheet, 'Factors')

  // Links
  const edges = deepCopy(data.edges.get().filter((e) => !e.isClusterEdge))
  rows = edges.map((e) => {
    if (e.created) {
      e.creator = e.created.user
      e.createdTime = new Date(e.created.time).toISOString()
    }
    if (e.modified) {
      e.modifier = e.modified.user
      e.modifiedTime = new Date(e.modified.time).toISOString()
    }
    e.style = parseInt(e.grp.substring(4)) + 1
    e.from = data.nodes.get(e.from).label
    e.to = data.nodes.get(e.to).label
    if (e.note) e.Note = quillToText(e.note)
    return omit(e, [
      'arrows',
      'color',
      'created',
      'dashes',
      'font',
      'grp',
      'hoverWidth',
      'id',
      'note',
      'selectionWidth',
      'width',
    ])
  })
  const linksWorksheet = utils.json_to_sheet(rows)
  utils.book_append_sheet(workbook, linksWorksheet, 'Links')

  setFileName('xlsx')
  writeFileXLSX(workbook, lastFileName)
  dummyDiv.remove()

  function omit(obj, props) {
    return Object.keys(obj)
      .filter((key) => props.indexOf(key) < 0)
      .reduce((obj2, key) => {
        obj2[key] = obj[key]
        return obj2
      }, {})
  }
  /**
   *
   * @param {object} ops
   * @returns contents of Quill note as plain text
   */
  function quillToText(ops) {
    qed.setContents(ops)
    // use qed.root.innerHTML to convert to HTML if that is preferred
    return qed.getText()
  }
}
/**
 * Save the map as a GML file
 * See https://web.archive.org/web/20190303094704/http://www.fim.uni-passau.de:80/fileadmin/files/lehrstuhl/brandenburg/projekte/gml/gml-technical-report.pdf for the format
 */
export function exportGML() {
  let str =
    'Creator "prsm ' +
    version +
    ' on ' +
    new Date(Date.now()).toLocaleString() +
    '"\ngraph\n[\n\tdirected 1\n'
  const nodeIds = data.nodes.map((n) => n.id) //use integers, not GUIDs for node ids
  for (const node of data.nodes.get()) {
    str += '\tnode\n\t[\n\t\tid ' + nodeIds.indexOf(node.id)
    if (node.label) str += '\n\t\tlabel "' + node.label.replace(/"/g, "'") + '"'
    const color = node.color.background || styles.nodes.group0.color.background
    str += '\n\t\tcolor "' + color + '"'
    str += '\n\t]\n'
  }
  for (const edge of data.edges.get()) {
    str += '\tedge\n\t[\n\t\tsource ' + nodeIds.indexOf(edge.from)
    str += '\n\t\ttarget ' + nodeIds.indexOf(edge.to)
    if (edge.label) str += '\n\t\tlabel "' + edge.label + '"'
    const color = edge.color.color || styles.edges.edge0.color.color
    str += '\n\t\tcolor "' + color + '"'
    str += '\n\t]\n'
  }
  str += '\n]'
  saveStr(str, 'gml')
}
/**
 * Save the map as GraphViz file
 * See https://graphviz.org/doc/info/lang.html
 */
export function exportDOT() {
  let str = `/* Creator PRSM ${version} on ${new Date(Date.now()).toLocaleString()} */\ndigraph {\n`
  for (const node of data.nodes.get()) {
    str += `"${node.id}" [label="${node.label}", 
			color="${standardizeColor(node.color.border)}", fillcolor="${standardizeColor(node.color.background)}",
			shape="${node.shape === 'text' ? 'plaintext' : node.shape}",
			${gvNodeStyle(node)},
			fontsize="${node.font.size}", fontcolor="${standardizeColor(node.font.color)}"]\n`
  }
  for (const edge of data.edges.get()) {
    str += `"${edge.from}" -> "${edge.to}" [label="${edge.label || ''}", 
			color="${standardizeColor(edge.color.color)}"
			style="${gvConvertEdgeStyle(edge)}"]\n`
  }
  str += '}\n'
  saveStr(str, 'gv')

  function gvNodeStyle(node) {
    const bDashes = node.shapeProperties.borderDashes
    let val = 'style="filled'
    if (Array.isArray(bDashes)) val += ', dotted'
    else val += `, ${bDashes ? 'dashed' : 'solid'}`
    val += `", penwidth="${node.borderWidth}"`
    return val
  }
  function gvConvertEdgeStyle(edge) {
    const bDashes = edge.dashes
    let val = 'solid'
    if (Array.isArray(bDashes)) {
      if (bDashes[0] === 10) val = 'dashed'
      else val = 'dotted'
    }
    return val
  }
}
/*
 * Save the map as a GraphML file
 * See http://graphml.graphdrawing.org/primer/graphml-primer.html
 * GraphML is an XML-based file format for graphs. It is a W3C standard and is used by many graph visualization tools.
 * The GraphML format is a simple and flexible way to represent graphs, including nodes, edges, and their attributes.
 * It is widely used in graph visualization and analysis tools, such as Gephi, Cytoscape, and Graphviz.
 * GraphML files can be easily generated and parsed by various programming languages and libraries, making it a popular choice for graph data exchange.
 * The GraphML format is based on XML, which means it is human-readable and can be easily edited with a text editor.
 * GraphML files can be used to represent directed and undirected graphs, as well as weighted and unweighted edges.
 * GraphML files can also include metadata, such as node and edge labels, colors, and styles.
 */
export function exportGraphML() {
  let str = `<?xml version="1.0" encoding="UTF-8"?>
	<graphml xmlns="http://graphml.graphdrawing.org/xmlns" 
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
	<key id="d0" for="node" attr.name="label" attr.type="string"/>
	<key id="d1" for="node" attr.name="style" attr.type="int"/>
	<key id="d2" for="node" attr.name="color" attr.type="string"/>
	<key id="d3" for="node" attr.name="shape" attr.type="string"/>
	<key id="d4" for="node" attr.name="x" attr.type="float"/>
	<key id="d5" for="node" attr.name="y" attr.type="float"/>
	<key id="d6" for="node" attr.name="r" attr.type="int"/>
	<key id="d7" for="node" attr.name="g" attr.type="int"/>
	<key id="d8" for="node" attr.name="b" attr.type="int"/>
	<key id="d9" for="node" attr.name="size" attr.type="int"/>
	<key id="d10" for="edge" attr.name="label" attr.type="string"/>
	<key id="d11" for="edge" attr.name="style" attr.type="int"/>
	<key id="d12" for="edge" attr.name="color" attr.type="string"/>
	<key id="d13" for="edge" attr.name="r" attr.type="int"/>
	<key id="d14" for="edge" attr.name="g" attr.type="int"/>
	<key id="d15" for="edge" attr.name="b" attr.type="int"/>
	<key id="d16" for="edge" attr.name="weight" attr.type="int"/>
	<graph id="${elem('maptitle').innerText}" edgedefault="directed">`
  for (const node of data.nodes.get()) {
    const color = node.color.background || styles.nodes.group0.color.background
    const rgb = rgbToArray(color)
    str += `
		<node id="${node.id}">
			<data key="d0">${encodeHTMLEntities(node.label)}</data>
			<data key="d1">${parseInt(node.grp.substring(5)) + 1}</data>
			<data key="d2">${color}</data>
			<data key="d3">${node.shape}</data>
			<data key="d4">${node.x}</data>
			<data key="d5">${node.y}</data>
			<data key="d6">${rgb[0]}</data>
			<data key="d7">${rgb[1]}</data>
			<data key="d8">${rgb[2]}</data>
			<data key="d9">${node.size}</data>
		</node>`
  }
  for (const edge of data.edges.get()) {
    const color = edge.color.color || styles.edges.edge0.color.background
    const rgb = rgbToArray(color)
    str += `
		<edge id="${edge.id}" source="${edge.from}" target="${edge.to}">
			<data key="d10">${encodeHTMLEntities(edge.label || '')}</data>
			<data key="d11">${parseInt(edge.grp.substring(4)) + 1}</data>
			<data key="d12">${color}</data>
			<data key="d13">${rgb[0]}</data>
			<data key="d14">${rgb[1]}</data>
			<data key="d15">${rgb[2]}</data>
			<data key="d16">${edge.width}</data>
		</edge>`
  }
  str += `
	</graph>
	</graphml>`
  saveStr(str, 'graphml')
}
/**
 * Save the map as a GEXF format file, for input to Gephi etc.
 * See https://gexf.net/index.html
 */
export function exportGEXF() {
  let str = `<?xml version='1.0' encoding='UTF-8'?>
		<gexf xmlns="http://gexf.net/1.3" version="1.3" xmlns:viz="http://gexf.net/1.3/viz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd">
		<meta lastmodifieddate="${new Date(Date.now()).toISOString().slice(0, 10)}">
			<creator>PRSM ${version}</creator>
			<title>${elem('maptitle').innerText}</title>
			<description>Generated from ${window.location.href}</description>
		</meta>
		<graph defaultedgetype="directed" mode="static">`
  const attributeNames = yNetMap.get('attributeTitles') || {}
  if (attributeNames) {
    str += `
			<attributes class="node" mode="static">
	`
    Object.keys(attributeNames).forEach((attr) => {
      str += `		<attribute id="${attr}" title="${attributeNames[attr]}" type="string"/>
	`
    })
    str += `		</attributes>`
  }
  str += `
		<nodes>`

  data.nodes.forEach((node) => {
    str += `
			<node id="${node.id}"
			label="${node.label}">`
    if (attributeNames) {
      str += `
			<attvalues>`
      Object.keys(attributeNames).forEach((attr) => {
        if (node[attr]) {
          str += `
				<attvalue for="${attr}" value="${node[attr]}"/>`
        }
      })
      str += `
			</attvalues>`
    }
    str += `
			<viz:size value="${node.size}"/>
			<viz:position x="${node.x}" y="${node.y}"/>
			</node>`
  })
  str += `
		</nodes>
		<edges>
    `
  data.edges.forEach((edge) => {
    str += `
		<edge id="${edge.id}" 
		source="${edge.from}" 
		target="${edge.to}"/>
		`
  })

  str += `
		</edges>
      </graph>
	</gexf>`

  saveStr(str, 'gexf')
}
