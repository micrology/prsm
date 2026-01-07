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


This module handles operations related to the Styles tabs.  
 ******************************************************************************************************************** */

import { Network } from 'vis-network/peer/'
import { DataSet } from 'vis-data/peer'
import {
  listen,
  elem,
  deepMerge,
  deepCopy,
  standardizeColor,
  setNodeHidden,
  setEdgeHidden,
  dragElement,
  addContextMenu,
  statusMsg,
  alertMsg,
  clearStatusBar,
  factorSizeToPercent,
  setFactorSizeFromPercent,
  convertDashes,
  getDashes,
} from './utils.js'
import {
  network,
  data,
  ySamplesMap,
  yNetMap,
  selectFactors,
  selectLinks,
  updateLastSamples,
  cp,
  logHistory,
  progressBar,
} from './prsm.js'
import { styles } from './samples.js'

/**
 * The samples are each a mini vis-network showing just one node or two nodes and a link
 */
export function setUpSamples() {
  // expand the styles object to include the default values
  expandStylesObject()
  // Get all elements with class='sampleNode' and add listener and canvas
  const emptyDataSet = new DataSet([])
  let sampleElements = document.getElementsByClassName('sampleNode')
  for (let i = 0; i < sampleElements.length; i++) {
    const groupId = `group${i}`
    const sampleElement = sampleElements[i]
    const sampleOptions = styles.nodes[groupId]
    const groupLabel = styles.nodes[groupId].groupLabel
    const nodeDataSet = new DataSet([
      deepMerge(
        {
          id: '1',
          label: groupLabel === undefined ? '' : groupLabel,
        },
        sampleOptions,
        {
          chosen: false,
          widthConstraint: 50,
          heightConstraint: 50,
          font: { size: 14 },
          size: 50,
          margin: 10,
          scaling: { label: { enabled: false } },
        }
      ),
    ])
    initSample(sampleElement, {
      nodes: nodeDataSet,
      edges: emptyDataSet,
    })
    sampleElement.addEventListener('dblclick', () => {
      editNodeStyle(sampleElement, groupId)
    })
    sampleElement.addEventListener('click', () => {
      updateLastSamples(groupId, null)
    })
    sampleElement.addEventListener('pointerdown', (event) => {
      if (event.button === 2) {  // right click)
        styleNodeContextMenu(sampleElement, groupId)
      }
    })
    sampleElement.addEventListener('mouseover', () =>
      statusMsg(
        'Left click: apply style to selected; Double click: edit style; Right click: Select or Hide all with this style'
      )
    )
    sampleElement.addEventListener('mouseout', () => clearStatusBar())
    sampleElement.groupNode = groupId
    sampleElement.dataSet = nodeDataSet
  }
  // and to all sampleLinks
  sampleElements = document.getElementsByClassName('sampleLink')
  for (let i = 0; i < sampleElements.length; i++) {
    const sampleElement = sampleElements[i]
    const groupId = `edge${i}`
    const groupLabel = styles.edges[groupId].groupLabel
    const sampleOptions = styles.edges[groupId]
    const edgeDataSet = new DataSet([
      deepMerge(
        {
          id: '1',
          from: 1,
          to: 2,
          label: groupLabel === undefined ? '' : groupLabel,
        },
        sampleOptions,
        {
          font: {
            size: 24,
            color: 'black',
            align: 'top',
            vadjust: -40,
          },
          widthConstraint: 100,
          value: 10,
        }
      ),
    ])
    const nodesDataSet = new DataSet([
      {
        id: 1,
        size: 5,
        shape: 'dot',
        fixed: true,
        chosen: false,
      },
      {
        id: 2,
        size: 5,
        shape: 'dot',
        fixed: true,
        chosen: false,
      },
    ])
    initSample(sampleElement, {
      nodes: nodesDataSet,
      edges: edgeDataSet,
    })
    sampleElement.addEventListener('dblclick', () => {
      editLinkStyle(sampleElement, groupId)
    })
    sampleElement.addEventListener('click', () => {
      updateLastSamples(null, groupId)
    })
    sampleElement.addEventListener('pointerdown', (event) => {
      if (event.button === 2) {  // right click)
        styleEdgeContextMenu(sampleElement, groupId)
      }
    })
    sampleElement.addEventListener('mouseover', () =>
      statusMsg(
        'Left click: apply style to selected; Double click: edit style; Right click: Select all with this style'
      )
    )
    sampleElement.groupLink = groupId
    sampleElement.dataSet = edgeDataSet
  }
  // set up color pickers
  cp.createColorPicker('nodeStyleEditFillColor', nodeEditSave)
  cp.createColorPicker('nodeStyleEditBorderColor', nodeEditSave)
  cp.createColorPicker('nodeStyleEditFontColor', nodeEditSave)
  cp.createColorPicker('linkStyleEditLineColor', linkEditSave)

  // set up listeners
  listen('nodeStyleEditCancel', 'click', nodeEditCancel)
  listen('nodeStyleEditName', 'keyup', nodeEditSave)
  listen('nodeStyleEditShape', 'change', nodeEditSave)
  listen('nodeStyleEditBorder', 'change', nodeEditSave)
  listen('nodeStyleEditFontSize', 'change', nodeEditSave)
  listen('nodeStyleEditSubmit', 'click', nodeEditSubmit)

  listen('linkStyleEditCancel', 'click', linkEditCancel)
  listen('linkStyleEditName', 'keyup', linkEditSave)
  listen('linkStyleEditWidth', 'input', linkEditSave)
  listen('linkStyleEditDashes', 'input', linkEditSave)
  listen('linkStyleEditArrows', 'change', linkEditSave)
  listen('linkStyleEditSubmit', 'click', linkEditSubmit)
  listen('styleNodeContextMenuHide', 'contextmenu', (e) => e.preventDefault())
  listen('styleNodeContextMenuSelect', 'contextmenu', (e) => e.preventDefault())
  listen('styleEdgeContextMenuSelect', 'contextmenu', (e) => e.preventDefault())
}
/**
 * assemble styles by merging the specifics into the default
 */
function expandStylesObject() {
  let base = styles.nodes.base
  for (const prop in styles.nodes) {
    const grp = deepMerge(base, styles.nodes[prop])
    // make the hover and highlight colors the same as the basic ones
    grp.color.highlight = {}
    grp.color.highlight.border = grp.color.border
    grp.color.highlight.background = grp.color.background
    grp.color.hover = {}
    grp.color.hover.border = grp.color.border
    grp.color.hover.background = grp.color.background
    //		grp.font.size = base.font.size
    styles.nodes[prop] = grp
  }
  base = styles.edges.base
  for (const prop in styles.edges) {
    const grp = deepMerge(base, styles.edges[prop])
    grp.color.highlight = grp.color.color
    grp.color.hover = grp.color.color
    styles.edges[prop] = grp
  }
}
/**
 * create the sample network
 * @param {HTMLElement} wrapper
 * @param {object} sampleData
 */
function initSample(wrapper, sampleData) {
  const options = {
    interaction: {
      dragNodes: false,
      dragView: false,
      selectable: true,
      zoomView: false,
    },
    manipulation: {
      enabled: false,
    },
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'LR',
      },
    },
  }
  const net = new Network(wrapper, sampleData, options)
  net.fit()
  net.storePositions()
  wrapper.net = net
  return net
}
const factorsHiddenByStyle = {}
const linksHiddenByStyle = {}
/**
 * Context menu for node styles
 * @param {HTMLElement} sampleElement
 * @param {string} groupId
 */
function styleNodeContextMenu(sampleElement, groupId) {
  addContextMenu(sampleElement, [
    {
      label: 'Select Factors',
      action: () => selectFactorsWithStyle(groupId)
    },
    {
      label: `${sampleElement.dataset.hide === 'hidden' ? 'Unhide' : 'Hide'} Factors`,
      action: () => hideFactorsWithStyle(sampleElement, groupId)
    }])
}
/**
 * Select all the factors with the given style
 * Used by Style context menu
 * @param {integer} groupId 
 */
function selectFactorsWithStyle(groupId) {
  selectFactors(data.nodes.getIds({ filter: (node) => node.grp === groupId }))
}
/**
 * Hide or unhide all the factors with the given style
 * Used by Style context menu
 * @param {HTMLElement} sampleElement 
 * @param {integer} groupId 
 */
function hideFactorsWithStyle(sampleElement, groupId) {
  const wasHidden = sampleElement.dataset.hide === 'hidden'
  const nodes = data.nodes.get({ filter: (node) => node.grp === groupId })
  nodes.forEach((node) => {
    setNodeHidden(node, !wasHidden)
  })
  data.nodes.update(nodes)
  const edges = []
  nodes.forEach((node) => {
    const connectedEdges = network.getConnectedEdges(node.id)
    connectedEdges.forEach((edgeId) => {
      edges.push(data.edges.get(edgeId))
    })
  })
  edges.forEach((edge) => {
    setEdgeHidden(edge, !wasHidden)
  })
  data.edges.update(edges)
  factorsHiddenByStyle[sampleElement.id] = !wasHidden
  yNetMap.set('factorsHiddenByStyle', factorsHiddenByStyle)
  sampleElement.dataset.hide = wasHidden ? 'visible' : 'hidden'
}
/**
 * Context menu for edge styles
 * @param {HTMLElement} sampleElement
 * @param {string} groupId
 */
function styleEdgeContextMenu(sampleElement, groupId) {
  addContextMenu(sampleElement,
    [{
      label: 'Select Links',
      action: () => selectLinksWithStyle(groupId)
    },
      {
        label: `${sampleElement.dataset.hide === 'hidden' ? 'Unhide' : 'Hide'} Links`,
        action: () => hideLinksWithStyle(sampleElement, groupId)
      }])
}
/**
 * Select all the links with the given style
 * Used by Style context menu
 * @param {integer} groupId 
 */
function selectLinksWithStyle(groupId) {
  selectLinks(data.edges.getIds({ filter: (edge) => edge.grp === groupId }))
}
/**
 * Hide or unhide all the links with the given style
 * Used by Style context menu
 * @param {HTMLElement} sampleElement 
 * @param {integer} groupId 
 */
function hideLinksWithStyle(sampleElement, groupId) {
  const wasHidden = sampleElement.dataset.hide === 'hidden'
  const edges = data.edges.get({ filter: (edge) => edge.grp === groupId })
  edges.forEach((edge) => {
    setEdgeHidden(edge, !wasHidden)
  })
  data.edges.update(edges)
  linksHiddenByStyle[sampleElement.id] = !wasHidden
  yNetMap.set('linksHiddenByStyle', linksHiddenByStyle)
  sampleElement.dataset.hide = wasHidden ? 'visible' : 'hidden'
}
/**
 * open the dialog to edit a node style
 * @param {HTMLElement} styleElement
 * @param {number} groupId
 */
function editNodeStyle(styleElement, groupId) {
  styleElement.net.unselectAll()
  const container = elem('nodeStyleEditorContainer')
  container.groupId = groupId
  // save the current style format (so that there can be a revert in case of cancelling the edit)
  container.origGroup = deepCopy(styles.nodes[groupId])
  // save the div in which the style is displayed
  container.styleElement = styleElement
  // set the style dialog widgets with the current values for the group style
  updateNodeEditor(groupId)
  // display the style dialog
  nodeEditorShow()
}
/**
 * ensure that the edit node style dialog shows the current state of the style
 * @param {string} groupId
 */
function updateNodeEditor(groupId) {
  const group = styles.nodes[groupId]
  elem('nodeStyleEditName').value = group.groupLabel !== 'Sample' ? group.groupLabel : ''
  elem('nodeStyleEditFillColor').style.backgroundColor = standardizeColor(group.color.background)
  elem('nodeStyleEditBorderColor').style.backgroundColor = standardizeColor(group.color.border)
  elem('nodeStyleEditFontColor').style.backgroundColor = standardizeColor(group.font.color)
  elem('nodeStyleEditShape').value = group.shape
  elem('nodeStyleEditBorder').value = getDashes(
    group.shapeProperties.borderDashes,
    group.borderWidth
  )
  elem('nodeStyleEditFontSize').value = group.font.size
  if (group.fixed) {
    elem('nodeStyleEditFixed').style.display = 'inline'
    elem('nodeStyleEditUnfixed').style.display = 'none'
  } else {
    elem('nodeStyleEditFixed').style.display = 'none'
    elem('nodeStyleEditUnfixed').style.display = 'inline'
  }
  elem('nodeStyleEditFactorSize').value = factorSizeToPercent(group.size)
  progressBar(elem('nodeStyleEditFactorSize'))
}
listen('nodeStyleEditLock', 'click', toggleNodeStyleLock)

/**
 * Toggle the lock state of the node style
 */
function toggleNodeStyleLock() {
  const group = styles.nodes[elem('nodeStyleEditorContainer').groupId]
  if (group.fixed) {
    elem('nodeStyleEditFixed').style.display = 'none'
    elem('nodeStyleEditUnfixed').style.display = 'inline'
  } else {
    elem('nodeStyleEditFixed').style.display = 'inline'
    elem('nodeStyleEditUnfixed').style.display = 'none'
  }
  group.fixed = !group.fixed
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function nodeEditSave() {
  const groupId = elem('nodeStyleEditorContainer').groupId
  const group = styles.nodes[groupId]
  group.groupLabel = elem('nodeStyleEditName').value
  if (group.groupLabel === '') group.groupLabel = 'Sample'
  group.color.background = elem('nodeStyleEditFillColor').style.backgroundColor
  group.color.border = elem('nodeStyleEditBorderColor').style.backgroundColor
  group.color.highlight.background = group.color.background
  group.color.highlight.border = group.color.border
  group.color.hover.background = group.color.background
  group.color.hover.border = group.color.border
  group.font.color = elem('nodeStyleEditFontColor').style.backgroundColor
  group.shape = elem('nodeStyleEditShape').value
  const border = elem('nodeStyleEditBorder').value
  group.shapeProperties.borderDashes = convertDashes(border)
  group.borderWidth = border === 'none' ? 0 : border === 'solid' ? 1 : 4
  group.font.size = parseInt(elem('nodeStyleEditFontSize').value)
  setFactorSizeFromPercent(group, elem('nodeStyleEditFactorSize').value)
  nodeEditUpdateStyleSample(group)
}
/**
 * update the style sample to show changes to style
 * @param {Object} group
 */
function nodeEditUpdateStyleSample(group) {
  const groupId = elem('nodeStyleEditorContainer').groupId
  const styleElement = elem('nodeStyleEditorContainer').styleElement
  let node = styleElement.dataSet.get('1')
  node.label = group.groupLabel
  // the node in the style sample does not change size
  node = deepMerge(node, styles.nodes[groupId], {
    chosen: false,
    size: 50,
    widthConstraint: 50,
    heightConstraint: 50,
    margin: 10,
    font: { size: 14 },
  })
  styleElement.dataSet.update(node)
}
/**
 * cancel any editing of the style and revert to what it was previously
 */
function nodeEditCancel() {
  // restore saved group format
  const groupId = elem('nodeStyleEditorContainer').groupId
  styles.nodes[groupId] = elem('nodeStyleEditorContainer').origGroup
  nodeEditUpdateStyleSample(styles.nodes[groupId])
  nodeEditorHide()
}
/**
 * hide the node style editor dialog
 */
function nodeEditorHide() {
  elem('nodeStyleEditorContainer').classList.add('hideEditor')
}
/**
 * show the node style editor dialog
 */
function nodeEditorShow() {
  const panelRect = elem('panel').getBoundingClientRect()
  const container = elem('nodeStyleEditorContainer')
  container.style.top = `${panelRect.top}px`
  container.style.left = `${panelRect.left - 300}px`
  container.classList.remove('hideEditor')
}
/**
 * save the edited style and close the style editor.  Update the nodes
 * in the map and the legend to the current style
 */
function nodeEditSubmit() {
  nodeEditSave()
  nodeEditorHide()
  // apply updated style to all nodes having that style
  const groupId = elem('nodeStyleEditorContainer').groupId
  // somewhere - but I have no idea where or why, this is set to true, but it must be false
  styles.nodes[groupId].scaling.label.enabled = false
  reApplySampleToNodes([groupId], true)
  ySamplesMap.set(groupId, {
    node: styles.nodes[groupId],
  })
  updateLegend()
  network.redraw()
  logHistory('edited a Factor style')
}
/**
 * update all nodes in the map with this style to the current style features
 * @param {number[]} groupIds
 * @param {boolean} [force] override any existing individual node styling
 */
export function reApplySampleToNodes(groupIds, force) {
  const nodesToUpdate = data.nodes.get({
    filter: (item) => {
      return groupIds.includes(item.grp)
    },
  })
  data.nodes.update(
    nodesToUpdate.map((node) => {
      return force
        ? deepMerge(node, styles.nodes[node.grp])
        : deepMerge(styles.nodes[node.grp], node)
    })
  )
}
/**
 * ensure that the styles displayed in the node styles panel display the styles defined in the styles array
 */
export function refreshSampleNode(groupId) {
  const sampleElements = Array.from(document.getElementsByClassName('sampleNode'))
  const sampleElement = sampleElements[groupId.match(/\d+/)?.[0]]
  if (!sampleElement) return
  let node = sampleElement.dataSet.get()[0]
  node = deepMerge(node, styles.nodes[groupId], {
    chosen: false,
    size: 50,
    widthConstraint: 50,
    heightConstraint: 50,
    margin: 10,
    font: { size: 14 },
  })
  node.label = node.groupLabel
  sampleElement.dataSet.remove(node.id)
  sampleElement.dataSet.update(node)
  sampleElement.net.fit()
}
/**
 * open the dialog to edit a link style
 * @param {HTMLElement} styleElement
 * @param {string} groupId
 */
function editLinkStyle(styleElement, groupId) {
  const container = elem('linkStyleEditorContainer')
  container.styleElement = styleElement
  container.groupId = groupId
  // save the current style format (so that there can be a revert in case of cancelling the edit)
  container.origGroup = deepCopy(styles.edges[groupId])
  // set the style dialog widgets with the current values for the group style
  updateLinkEditor(groupId)
  // display the style dialog
  linkEditorShow()
}
/**
 * ensure that the edit link style dialog shows the current state of the style
 * @param {string} groupId
 */
function updateLinkEditor(groupId) {
  const group = styles.edges[groupId]
  elem('linkStyleEditName').value = group.groupLabel !== 'Sample' ? group.groupLabel : ''
  elem('linkStyleEditLineColor').style.backgroundColor = standardizeColor(group.color.color)
  elem('linkStyleEditWidth').value = group.width
  elem('linkStyleEditDashes').value = getDashes(group.dashes, 1)
  elem('linkStyleEditArrows').value = getArrows(group.arrows)
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function linkEditSave() {
  const groupId = elem('linkStyleEditorContainer').groupId
  const group = styles.edges[groupId]
  group.groupLabel = elem('linkStyleEditName').value
  if (group.groupLabel === '') group.groupLabel = 'Sample'
  group.color.color = elem('linkStyleEditLineColor').style.backgroundColor
  group.color.highlight = group.color.color
  group.color.hover = group.color.color
  group.width = parseInt(elem('linkStyleEditWidth').value)
  group.dashes = convertDashes(elem('linkStyleEditDashes').value)
  groupArrows(elem('linkStyleEditArrows').value)
  linkEditUpdateStyleSample(group)
  /**
   * Set the link object properties to show various arrow types
   * @param {string} val
   */
  function groupArrows(val) {
    if (val !== '') {
      group.arrows.from.enabled = false
      group.arrows.middle.enabled = false
      group.arrows.to.enabled = true
      if (val === 'none') group.arrows.to.enabled = false
      else group.arrows.to.type = val
    }
  }
}
/**
 * update the style sample to show changes to style
 * @param {Object} group
 */
function linkEditUpdateStyleSample(group) {
  // update the style edge to show changes to style
  const groupId = elem('linkStyleEditorContainer').groupId
  const styleElement = elem('linkStyleEditorContainer').styleElement
  let edge = styleElement.dataSet.get('1')
  edge.label = group.groupLabel
  edge = deepMerge(edge, styles.edges[groupId], { chosen: false })
  const dataSet = styleElement.dataSet
  dataSet.update(edge)
}
/**
 * cancel any editing of the style and revert to what it was previously
 */
function linkEditCancel() {
  // restore saved group format
  const groupId = elem('linkStyleEditorContainer').groupId
  styles.edges[groupId] = elem('linkStyleEditorContainer').origGroup
  linkEditorHide()
}
/**
 * hide the link style editor dialog
 */
function linkEditorHide() {
  elem('linkStyleEditorContainer').classList.add('hideEditor')
}
/**
 * show the link style editor dialog
 */
function linkEditorShow() {
  const panelRect = elem('panel').getBoundingClientRect()
  const container = elem('linkStyleEditorContainer')
  container.style.top = `${panelRect.top}px`
  container.style.left = `${panelRect.left - 300}px`
  container.classList.remove('hideEditor')
}
/**
 * save the edited style and close the style editor.  Update the links
 * in the map and the legend to the current style
 */
function linkEditSubmit() {
  linkEditSave()
  linkEditorHide()
  // apply updated style to all edges having that style
  const groupId = elem('linkStyleEditorContainer').groupId
  reApplySampleToLinks([groupId], true)
  ySamplesMap.set(groupId, {
    edge: styles.edges[groupId],
  })
  updateLegend()
  network.redraw()
  logHistory('edited a Link style')
}
/**
 * update all links in the map with this style to the current style features
 *   (don't touch cluster edges)
 * @param {number[]} groupIds
 * @param {boolean} [force] override any existing individual edge styling
 */
export function reApplySampleToLinks(groupIds, force) {
  const edgesToUpdate = data.edges.get({
    filter: (item) => {
      return groupIds.includes(item.grp) && !item.isClusterEdge
    },
  })
  data.edges.update(
    edgesToUpdate.map((edge) => {
      return force
        ? deepMerge(edge, styles.edges[edge.grp])
        : deepMerge(styles.edges[edge.grp], edge)
    })
  )
}
/**
 * ensure that the styles displayed in the link styles panel display the styles defined in the styles array
 */
export function refreshSampleLink(groupId) {
  const sampleElements = Array.from(document.getElementsByClassName('sampleLink'))
  const sampleElement = sampleElements[groupId.match(/\d+/)?.[0]]
  if (!sampleElement) return
  let edge = sampleElement.dataSet.get()[0]
  edge = deepMerge(edge, styles.edges[groupId], { chosen: false, value: 10 })
  edge.label = edge.groupLabel
  sampleElement.dataSet.remove(edge.id)
  sampleElement.dataSet.update(edge)
  sampleElement.net.fit()
}
/**
 * Convert from style object properties to arrow menu selection
 * @param {Object} prop
 */
function getArrows(prop) {
  let val = 'none'
  if (prop.to?.enabled && prop.to.type) val = prop.to.type
  return val
}

/*  ------------display the map legend (includes all styles with a group label that is neither blank or 'Sample') */

const LEGENDHEIGHT = 35
const LEGENDWIDTH = 120
/**
 * display a legend on the map (but only if the styles have been given names)
 * @param {Boolean} warn true if user is switching display legend on, but there is nothing to show
 */
export function legend(warn = false) {
  clearLegend()

  const sampleNodeDivs = document.getElementsByClassName('sampleNode')
  const nodes = Array.from(sampleNodeDivs).filter(
    (elem) => elem.dataSet.get('1').groupLabel !== 'Sample'
  )
  const sampleEdgeDivs = document.getElementsByClassName('sampleLink')
  const edges = Array.from(sampleEdgeDivs).filter(
    (elem) => !['Sample', '', ' '].includes(elem.dataSet.get('1').groupLabel)
  )
  const nItems = nodes.length + edges.length
  if (nItems === 0) {
    if (warn) alertMsg('Nothing to include in the Legend - rename some styles first', 'warn')
    elem('showLegendSwitch').checked = false
    return
  }
  const legendBox = document.createElement('div')
  legendBox.className = 'legend'
  legendBox.id = 'legendBox'
  elem('main').appendChild(legendBox)
  const title = document.createElement('p')
  title.id = 'Legend'
  title.classList.add('legendTitle', 'dragHandle')
  title.appendChild(document.createTextNode('Legend'))
  legendBox.appendChild(title)
  legendBox.style.height = `${LEGENDHEIGHT * nItems + title.offsetHeight}px`
  legendBox.style.width = `${LEGENDWIDTH}px`
  const legendWrapper = document.createElement('div')
  legendWrapper.className = 'legendWrapper'
  legendBox.appendChild(legendWrapper)

  dragElement(legendBox, title)

  for (let i = 0; i < nodes.length; i++) {
    const canvas = document.createElement('div')
    canvas.className = 'legendCanvas'
    legendWrapper.appendChild(canvas)
    const legendData = { nodes: new DataSet(), edges: new DataSet() }
    const legendNetwork = new Network(canvas, legendData, {
      physics: { enabled: false },
      interaction: { zoomView: false, dragView: false },
    })
    const node = deepMerge(styles.nodes[nodes[i].groupNode])
    node.id = i + 10000
    node.shape === 'text' ? (node.label = 'groupLabel') : (node.label = '')
    node.fixed = true
    node.chosen = false
    node.margin = 10
    node.x = 0
    node.y = 0
    node.widthConstraint = 10
    node.heightConstraint = 10
    node.font.size = 10
    node.size = 10
    legendData.nodes.update(node)
    legendNetwork.fit()

    const style = document.createElement('div')
    style.className = 'legendStyleName'
    style.textContent = node.groupLabel
    legendWrapper.appendChild(style)
  }

  for (let i = 0; i < edges.length; i++) {
    const canvas = document.createElement('div')
    canvas.className = 'legendCanvas'
    legendWrapper.appendChild(canvas)
    const legendData = { nodes: new DataSet(), edges: new DataSet() }
    const legendNetwork = new Network(canvas, legendData, {
      physics: { enabled: false },
      interaction: { zoomView: false, dragView: false },
    })

    const edge = deepMerge(styles.edges[edges[i].groupLink])
    edge.label = ''
    edge.id = i + 10000
    edge.from = i + 20000
    edge.to = i + 30000
    edge.smooth = { type: 'straightCross' }
    edge.chosen = false
    const nodes = [
      {
        id: edge.from,
        size: 5,
        shape: 'dot',
        x: -20,
        y: 0,
        fixed: true,
        chosen: false,
      },
      {
        id: edge.to,
        shape: 'dot',
        size: 5,
        x: +20,
        y: 0,
        fixed: true,
        chosen: false,
      },
    ]
    legendData.nodes.update(nodes)
    legendData.edges.update(edge)
    legendNetwork.fit()
    const style = document.createElement('div')
    style.className = 'legendStyleName'
    style.textContent = edge.groupLabel
    legendWrapper.appendChild(style)
  }
}
/**
 * remove the legend from the map
 */
export function clearLegend() {
  const legendBox = elem('legendBox')
  if (legendBox) legendBox.remove()
}
/**
 * redraw the legend (to show updated styles)
 */
export function updateLegend() {
  if (elem('showLegendSwitch').checked) {
    legend(false)
    clearStatusBar()
  }
}
