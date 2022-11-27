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


This modules handles operations related to the Styles tabs.  
 ******************************************************************************************************************** */

import {Network} from 'vis-network/peer/'
import {DataSet} from 'vis-data/peer'
import {listen, elem, deepMerge, deepCopy, standardize_color, dragElement, statusMsg, clearStatusBar} from './utils.js'
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
} from './prsm.js'
import {styles} from './samples.js'

/**
 * The samples are each a mini vis-network showing just one node or two nodes and a link
 */
export function setUpSamples() {
	// create sample configurations
	configSamples()
	// Get all elements with class='sampleNode' and add listener and canvas
	let emptyDataSet = new DataSet([])
	let sampleElements = document.getElementsByClassName('sampleNode')
	for (let i = 0; i < sampleElements.length; i++) {
		let groupId = `group${i}`
		let sampleElement = sampleElements[i]
		let sampleOptions = styles.nodes[groupId]
		let groupLabel = styles.nodes[groupId].groupLabel
		let nodeDataSet = new DataSet([
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
					margin: 10,
					scaling: {label: {enabled: false}},
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
		sampleElement.addEventListener('contextmenu', (event) => {
			styleNodeContextMenu(event, sampleElement, groupId)
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
		let sampleElement = sampleElements[i]
		let groupId = `edge${i}`
		let groupLabel = styles.edges[groupId].groupLabel
		let sampleOptions = styles.edges[groupId]
		let edgeDataSet = new DataSet([
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
				}
			),
		])
		let nodesDataSet = new DataSet([
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
		sampleElement.addEventListener('contextmenu', (event) => {
			styleEdgeContextMenu(event, sampleElement, groupId)
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
	cp.createColorPicker('nodeEditFillColor', nodeEditSave)
	cp.createColorPicker('nodeEditBorderColor', nodeEditSave)
	cp.createColorPicker('nodeEditFontColor', nodeEditSave)
	cp.createColorPicker('linkEditLineColor', linkEditSave)

	// set up listeners
	listen('nodeEditCancel', 'click', nodeEditCancel)
	listen('nodeEditName', 'keyup', nodeEditSave)
	listen('nodeEditShape', 'change', nodeEditSave)
	listen('nodeEditBorder', 'change', nodeEditSave)
	listen('nodeEditFontSize', 'change', nodeEditSave)
	listen('nodeEditSubmit', 'click', nodeEditSubmit)

	listen('linkEditCancel', 'click', linkEditCancel)
	listen('linkEditName', 'keyup', linkEditSave)
	listen('linkEditWidth', 'input', linkEditSave)
	listen('linkEditDashes', 'input', linkEditSave)
	listen('linkEditArrows', 'change', linkEditSave)
	listen('linkEditSubmit', 'click', linkEditSubmit)
	listen('styleNodeContextMenuHide', 'contextmenu', (e) => e.preventDefault())
	listen('styleNodeContextMenuSelect', 'contextmenu', (e) => e.preventDefault())
	listen('styleEdgeContextMenuSelect', 'contextmenu', (e) => e.preventDefault())
}

var factorsHiddenByStyle = {}
listen('nodesTab', 'contextmenu', (e) => {
	e.preventDefault()
})
listen('linksTab', 'contextmenu', (e) => {
	e.preventDefault()
})

function styleNodeContextMenu(event, sampleElement, groupId) {
	let menu = elem('styleNodeContextMenu')
	showMenu(event.pageX, event.pageY)
	document.addEventListener('click', onClick, false)

	function onClick(event) {
		// Safari emits a contextmenu and a click event on control-click; ignore the click
		if (event.ctrlKey && !event.target.id) return
		event.preventDefault()
		hideMenu()
		document.removeEventListener('click', onClick)
		switch (event.target.id) {
			case 'styleNodeContextMenuSelect': {
				selectFactorsWithStyle(groupId)
				break
			}
			case 'styleNodeContextMenuHide': {
				if (sampleElement.dataset.hide !== 'hidden') {
					hideFactorsWithStyle(groupId, true)
					sampleElement.dataset.hide = 'hidden'
					sampleElement.style.opacity = 0.6
				} else {
					hideFactorsWithStyle(groupId, false)
					sampleElement.dataset.hide = 'visible'
					sampleElement.style.opacity = 1.0
				}
				break
			}
			default: // clicked off menu
				break
		}
	}
	function showMenu(x, y) {
		elem('styleNodeContextMenuHide').innerText =
			sampleElement.dataset.hide === 'hidden' ? 'Unhide Factors' : 'Hide Factors'
		menu.style.left = `${x}px`
		menu.style.top = `${y}px`
		menu.classList.add('show-menu')
	}
	function hideMenu() {
		menu.classList.remove('show-menu')
	}
	function selectFactorsWithStyle(groupId) {
		selectFactors(data.nodes.getIds({filter: (node) => node.grp === groupId}))
	}
	function hideFactorsWithStyle(groupId, toggle) {
		let nodes = data.nodes.get({filter: (node) => node.grp === groupId})
		nodes.forEach((node) => {
			node.hidden = toggle
		})
		data.nodes.update(nodes)
		let edges = []
		nodes.forEach((node) => {
			let connectedEdges = network.getConnectedEdges(node.id)
			connectedEdges.forEach((edgeId) => {
				edges.push(data.edges.get(edgeId))
			})
		})
		edges.forEach((edge) => {
			edge.hidden = toggle
		})
		data.edges.update(edges)
		factorsHiddenByStyle[sampleElement.id] = toggle
		yNetMap.set('factorsHiddenByStyle', factorsHiddenByStyle)
	}
}

function styleEdgeContextMenu(event, sampleElement, groupId) {
	let menu = elem('styleEdgeContextMenu')
	event.preventDefault()
	showMenu(event.pageX, event.pageY)
	document.addEventListener('click', onClick, false)

	function onClick(event) {
		// Safari emits a contextmenu and a click event on control-click; ignore the click
		if (event.ctrlKey && !event.target.id) return
		event.preventDefault()
		hideMenu()
		document.removeEventListener('click', onClick)
		if (event.target.id === 'styleEdgeContextMenuSelect') {
			selectLinksWithStyle(groupId)
		}
	}
	function showMenu(x, y) {
		menu.style.left = `${x}px`
		menu.style.top = `${y}px`
		menu.classList.add('show-menu')
	}
	function hideMenu() {
		menu.classList.remove('show-menu')
	}
	function selectLinksWithStyle(groupId) {
		selectLinks(data.edges.getIds({filter: (edge) => edge.grp === groupId}))
	}
}
/**
 * assemble configurations by merging the specifics into the default
 */
function configSamples() {
	let base = styles.nodes.base
	for (let prop in styles.nodes) {
		let grp = deepMerge(base, styles.nodes[prop])
		// make the hover and highlight colors the same as the basic ones
		grp.color.highlight = {}
		grp.color.highlight.border = grp.color.border
		grp.color.highlight.background = grp.color.background
		grp.color.hover = {}
		grp.color.hover.border = grp.color.border
		grp.color.hover.background = grp.color.background
		grp.font.size = base.font.size
		styles.nodes[prop] = grp
	}
	base = styles.edges.base
	for (let prop in styles.edges) {
		let grp = deepMerge(base, styles.edges[prop])
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
	let options = {
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
		nodes: {
			widthConstraint: 50,
			heightConstraint: 50,
		},
		edges: {
			value: 10, // to make the links more visible at very small scale for the samples
		},
	}
	let net = new Network(wrapper, sampleData, options)
	net.fit()
	net.storePositions()
	wrapper.net = net
	return net
}

/**
 * open the dialog to edit a node style
 * @param {HTMLElement} styleElement
 * @param {number} groupId
 */
function editNodeStyle(styleElement, groupId) {
	styleElement.net.unselectAll()
	let container = elem('nodeStyleEditorContainer')
	container.styleElement = styleElement
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
	let group = styles.nodes[groupId]
	elem('nodeEditName').value = group.groupLabel !== 'Sample' ? group.groupLabel : ''
	elem('nodeEditFillColor').style.backgroundColor = standardize_color(group.color.background)
	elem('nodeEditBorderColor').style.backgroundColor = standardize_color(group.color.border)
	elem('nodeEditFontColor').style.backgroundColor = standardize_color(group.font.color)
	elem('nodeEditShape').value = group.shape
	elem('nodeEditBorder').value = getDashes(group.shapeProperties.borderDashes, group.borderWidth)
	elem('nodeEditFontSize').value = group.font.size
	if (group.fixed) {
		elem('nodeEditFixed').style.display = 'block'
		elem('nodeEditUnfixed').style.display = 'none'
	} else {
		elem('nodeEditFixed').style.display = 'none'
		elem('nodeEditUnfixed').style.display = 'block'
	}
}
listen('nodeEditLock', 'click', toggleNodeStyleLock)

function toggleNodeStyleLock() {
	let group = styles.nodes[elem('nodeStyleEditorContainer').groupId]
	if (group.fixed) {
		elem('nodeEditFixed').style.display = 'none'
		elem('nodeEditUnfixed').style.display = 'block'
	} else {
		elem('nodeEditFixed').style.display = 'block'
		elem('nodeEditUnfixed').style.display = 'none'
	}
	group.fixed = !group.fixed
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function nodeEditSave() {
	let groupId = elem('nodeStyleEditorContainer').groupId
	let group = styles.nodes[groupId]
	group.groupLabel = elem('nodeEditName').value
	if (group.groupLabel === '') group.groupLabel = 'Sample'
	group.color.background = elem('nodeEditFillColor').style.backgroundColor
	group.color.border = elem('nodeEditBorderColor').style.backgroundColor
	group.color.highlight.background = group.color.background
	group.color.highlight.border = group.color.border
	group.color.hover.background = group.color.background
	group.color.hover.border = group.color.border
	group.font.color = elem('nodeEditFontColor').style.backgroundColor
	group.shape = elem('nodeEditShape').value
	let border = elem('nodeEditBorder').value
	group.shapeProperties.borderDashes = groupDashes(border)
	group.borderWidth = border === 'none' ? 0 : 4
	group.font.size = parseInt(elem('nodeEditFontSize').value)
	nodeEditUpdateStyleSample(group)
}
/**
 * update the style sample to show changes to style
 * @param {Object} group
 */
function nodeEditUpdateStyleSample(group) {
	let groupId = elem('nodeStyleEditorContainer').groupId
	let styleElement = elem('nodeStyleEditorContainer').styleElement
	let node = styleElement.dataSet.get('1')
	node.label = group.groupLabel
	node = deepMerge(node, styles.nodes[groupId], {chosen: false})
	let dataSet = styleElement.dataSet
	dataSet.update(node)
}
/**
 * cancel any editing of the style and revert to what it was previously
 */
function nodeEditCancel() {
	// restore saved group format
	let groupId = elem('nodeStyleEditorContainer').groupId
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
	let panelRect = elem('panel').getBoundingClientRect()
	let container = elem('nodeStyleEditorContainer')
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
	let groupId = elem('nodeStyleEditorContainer').groupId
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
	let nodesToUpdate = data.nodes.get({
		filter: (item) => {
			return groupIds.includes(item.grp)
		},
	})
	data.nodes.update(
		nodesToUpdate.map((node) => {
			return force ? deepMerge(node, styles.nodes[node.grp]) : deepMerge(styles.nodes[node.grp], node)
		})
	)
}

/**
 * open the dialog to edit a link style
 * @param {HTMLElement} styleElement
 * @param {string} groupId
 */
function editLinkStyle(styleElement, groupId) {
	let container = elem('linkStyleEditorContainer')
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
	let group = styles.edges[groupId]
	elem('linkEditName').value = group.groupLabel !== 'Sample' ? group.groupLabel : ''
	elem('linkEditLineColor').style.backgroundColor = standardize_color(group.color.color)
	elem('linkEditWidth').value = group.width
	elem('linkEditDashes').value = getDashes(group.dashes, 1)
	elem('linkEditArrows').value = getArrows(group.arrows)
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function linkEditSave() {
	let groupId = elem('linkStyleEditorContainer').groupId
	let group = styles.edges[groupId]
	group.groupLabel = elem('linkEditName').value
	if (group.groupLabel === '') group.groupLabel = 'Sample'
	group.color.color = elem('linkEditLineColor').style.backgroundColor
	group.color.highlight = group.color.color
	group.color.hover = group.color.color
	group.width = parseInt(elem('linkEditWidth').value)
	group.dashes = groupDashes(elem('linkEditDashes').value)
	groupArrows(elem('linkEditArrows').value)
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
	let groupId = elem('linkStyleEditorContainer').groupId
	let styleElement = elem('linkStyleEditorContainer').styleElement
	let edge = styleElement.dataSet.get('1')
	edge.label = group.groupLabel
	edge = deepMerge(edge, styles.edges[groupId], {chosen: false})
	let dataSet = styleElement.dataSet
	dataSet.update(edge)
}
/**
 * cancel any editing of the style and revert to what it was previously
 */
function linkEditCancel() {
	// restore saved group format
	let groupId = elem('linkStyleEditorContainer').groupId
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
	let panelRect = elem('panel').getBoundingClientRect()
	let container = elem('linkStyleEditorContainer')
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
	let groupId = elem('linkStyleEditorContainer').groupId
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
 * @param {number[]} groupIds
 * @param {boolean} [force] override any existing individual edge styling
 */
export function reApplySampleToLinks(groupIds, force) {
	let edgesToUpdate = data.edges.get({
		filter: (item) => {
			return groupIds.includes(item.grp)
		},
	})
	data.edges.update(
		edgesToUpdate.map((edge) => {
			return force ? deepMerge(edge, styles.edges[edge.grp]) : deepMerge(styles.edges[edge.grp], edge)
		})
	)
}
/**
 * convert from style object properties to dashed border menu selection
 * @param {any} bDashes select menu value
 * @param {number} bWidth border width
 */
function getDashes(bDashes, bWidth) {
	let val = bDashes.toString()
	if (Array.isArray(bDashes)) {
		if (bDashes[0] === 10) val = 'dashes'
		else val = 'dots'
	} else if (bWidth === 0) val = 'none'
	return val
}
/**
 * Convert from dashed menu selection to style object properties
 * @param {string} val
 */
function groupDashes(val) {
	switch (val) {
		case 'true': // dashes [5,15] for node borders
			return true
		case 'dashes': // dashes for links
			return [10, 10]
		case 'false': // solid
			return false
		case 'none': //solid, zero width
			return false
		case 'dots':
			return [2, 8]
		default:
			return false
	}
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

var legendData = {nodes: new DataSet(), edges: new DataSet()}
var legendNetwork = null
const LEGENDSPACING = 60
const HALFLEGENDWIDTH = 60
/**
 * display a legend on the map (but only if the styles have been given names)
 * @param {Boolean} warn true if user is switching display legend on, but there is nothing to show
 */
export function legend(warn = false) {
	clearLegend()

	let sampleNodeDivs = document.getElementsByClassName('sampleNode')
	let nodes = Array.from(sampleNodeDivs).filter((elem) => elem.dataSet.get('1').groupLabel !== 'Sample')
	let sampleEdgeDivs = document.getElementsByClassName('sampleLink')
	let edges = Array.from(sampleEdgeDivs).filter(
		(elem) => !['Sample', '', ' '].includes(elem.dataSet.get('1').groupLabel)
	)
	let nItems = nodes.length + edges.length
	if (nItems === 0) {
		if (warn) statusMsg('Nothing to include in the Legend - rename some styles first', 'warn')
		elem('showLegendSwitch').checked = false
		return
	}
	let legendBox = document.createElement('div')
	legendBox.className = 'legend'
	legendBox.id = 'legendBox'
	elem('main').appendChild(legendBox)
	let title = document.createElement('p')
	title.id = 'Legend'
	title.className = 'legendTitle'
	title.appendChild(document.createTextNode('Legend'))
	legendBox.appendChild(title)
	legendBox.style.height = `${LEGENDSPACING * nItems}${title.offsetHeight}px`
	legendBox.style.width = `${HALFLEGENDWIDTH * 2}px`
	let canvas = document.createElement('div')
	canvas.className = 'legendCanvas'
	canvas.style.height = `${LEGENDSPACING * nItems}px`
	legendBox.appendChild(canvas)

	dragElement(legendBox, title)

	legendNetwork = new Network(canvas, legendData, {
		physics: {enabled: false},
		interaction: {zoomView: false, dragView: false},
	})
	let height = legendNetwork.DOMtoCanvas({x: 0, y: 0}).y
	for (let i = 0; i < nodes.length; i++) {
		let node = deepMerge(styles.nodes[nodes[i].groupNode])
		node.id = i + 10000
		node.label = node.groupLabel
		node.fixed = true
		node.chosen = false
		node.margin = 10
		node.x = 0
		node.y = 0
		node.widthConstraint = 40
		node.heightConstraint = 40
		node.font.size = 10
		legendData.nodes.update(node)
		let bbox = legendNetwork.getBoundingBox(node.id)
		node.y = (bbox.bottom - bbox.top) / 2 + height
		height += bbox.bottom - bbox.top
		legendData.nodes.update(node)
	}
	height += 50
	for (let i = 0; i < edges.length; i++) {
		let edge = deepMerge(styles.edges[edges[i].groupLink])
		edge.label = edge.groupLabel
		edge.id = i + 10000
		edge.from = i + 20000
		edge.to = i + 30000
		edge.smooth = {type: 'straightCross'}
		edge.font = {size: 12, color: 'black', align: 'top', vadjust: -10}
		edge.widthConstraint = 80
		edge.chosen = false
		let nodes = [
			{
				id: edge.from,
				size: 5,
				shape: 'dot',
				x: -25,
				y: height,
				fixed: true,
				chosen: false,
			},
			{
				id: edge.to,
				shape: 'dot',
				size: 5,
				x: +25,
				y: height,
				fixed: true,
				chosen: false,
			},
		]
		legendData.nodes.update(nodes)
		legendData.edges.update(edge)
		height += 50
	}
	legendNetwork.fit({})
}
window.legendData = legendData
/**
 * remove the legend from the map
 */
export function clearLegend() {
	legendData.nodes.clear()
	legendData.edges.clear()
	if (legendNetwork) legendNetwork.destroy()
	let legendBox = elem('legendBox')
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
