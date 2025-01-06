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

import {Network} from 'vis-network/peer/'
import {DataSet} from 'vis-data/peer'
import {
	listen,
	elem,
	deepMerge,
	deepCopy,
	standardize_color,
	setNodeHidden,
	setEdgeHidden,
	dragElement,
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
import {styles} from './samples.js'

/**
 * The samples are each a mini vis-network showing just one node or two nodes and a link
 */
export function setUpSamples() {
	// expand the styles object to include the default values
	expandStylesObject()
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
					font: {size: 14},
					size: 50,
					margin: 10,
					scaling: {label: {enabled: false}},
				},
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
				'Left click: apply style to selected; Double click: edit style; Right click: Select or Hide all with this style',
			),
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
					value: 10,
				},
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
				'Left click: apply style to selected; Double click: edit style; Right click: Select all with this style',
			),
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
	for (let prop in styles.nodes) {
		let grp = deepMerge(base, styles.nodes[prop])
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
	}
	let net = new Network(wrapper, sampleData, options)
	net.fit()
	net.storePositions()
	wrapper.net = net
	return net
}

var factorsHiddenByStyle = {}
var linksHiddenByStyle = {}
listen('nodesTab', 'contextmenu', (e) => {
	e.preventDefault()
})
listen('linksTab', 'contextmenu', (e) => {
	e.preventDefault()
})

/**
 * Context menu for node styles
 * @param {Event} event
 * @param {HTMLElement} sampleElement
 * @param {string} groupId
 */
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
		if (x + menu.offsetWidth > elem('container').offsetWidth) x = elem('container').offsetWidth - menu.offsetWidth
		if (y + menu.offsetHeight > elem('container').offsetHeight)
			y = elem('container').offsetHeighth - menu.offsetHeight
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
			setNodeHidden(node, toggle)
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
			setEdgeHidden(edge, toggle)
		})
		data.edges.update(edges)
		factorsHiddenByStyle[sampleElement.id] = toggle
		yNetMap.set('factorsHiddenByStyle', factorsHiddenByStyle)
	}
}

/**
 * Context menu for edge styles
 * @param {Event} event
 * @param {HTMLElement} sampleElement
 * @param {string} groupId
 */
function styleEdgeContextMenu(event, sampleElement, groupId) {
	let menu = elem('styleEdgeContextMenu')
	showMenu(event.pageX, event.pageY)
	document.addEventListener('click', onClick, false)

	function onClick(event) {
		// Safari emits a contextmenu and a click event on control-click; ignore the click
		if (event.ctrlKey && !event.target.id) return
		event.preventDefault()
		hideMenu()
		document.removeEventListener('click', onClick)
		switch (event.target.id) {
			case 'styleEdgeContextMenuSelect': {
				selectLinksWithStyle(groupId)
				break
			}
			case 'styleEdgeContextMenuHide': {
				if (sampleElement.dataset.hide !== 'hidden') {
					hideLinksWithStyle(groupId, true)
					sampleElement.dataset.hide = 'hidden'
					sampleElement.style.opacity = 0.6
				} else {
					hideLinksWithStyle(groupId, false)
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
		elem('styleEdgeContextMenuHide').innerText =
			sampleElement.dataset.hide === 'hidden' ? 'Unhide Links' : 'Hide Links'
		if (x + menu.offsetWidth > elem('container').offsetWidth) x = elem('container').offsetWidth - menu.offsetWidth
		if (y + menu.offsetHeight > elem('container').offsetHeight)
			y = elem('container').offsetHeighth - menu.offsetHeight
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
	function hideLinksWithStyle(groupId, toggle) {
		let edges = data.edges.get({filter: (edge) => edge.grp === groupId})
		edges.forEach((edge) => {
			setEdgeHidden(edge, toggle)
		})
		data.edges.update(edges)
		linksHiddenByStyle[sampleElement.id] = toggle
		yNetMap.set('linksHiddenByStyle', linksHiddenByStyle)
	}
}
/**
 * open the dialog to edit a node style
 * @param {HTMLElement} styleElement
 * @param {number} groupId
 */
function editNodeStyle(styleElement, groupId) {
	styleElement.net.unselectAll()
	let container = elem('nodeStyleEditorContainer')
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
	elem('nodeStyleEditName').value = group.groupLabel !== 'Sample' ? group.groupLabel : ''
	elem('nodeStyleEditFillColor').style.backgroundColor = standardize_color(group.color.background)
	elem('nodeStyleEditBorderColor').style.backgroundColor = standardize_color(group.color.border)
	elem('nodeStyleEditFontColor').style.backgroundColor = standardize_color(group.font.color)
	elem('nodeStyleEditShape').value = group.shape
	elem('nodeStyleEditBorder').value = getDashes(group.shapeProperties.borderDashes, group.borderWidth)
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
	let group = styles.nodes[elem('nodeStyleEditorContainer').groupId]
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
	let groupId = elem('nodeStyleEditorContainer').groupId
	let group = styles.nodes[groupId]
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
	let border = elem('nodeStyleEditBorder').value
	group.shapeProperties.borderDashes = convertDashes(border)
	group.borderWidth = border === 'none' ? 0 : 4
	group.font.size = parseInt(elem('nodeStyleEditFontSize').value)
	setFactorSizeFromPercent(group, elem('nodeStyleEditFactorSize').value)
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
	// the node in the style sample does not change size
	node = deepMerge(node, styles.nodes[groupId], {
		chosen: false,
		size: 50,
		widthConstraint: 50,
		heightConstraint: 50,
		margin: 10,
		font: {size: 14},
	})
	styleElement.dataSet.update(node)
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
		}),
	)
}
/**
 * ensure that the styles displayed in the node styles panel display the styles defined in the styles array
 */
export function refreshSampleNode(groupId) {
	let sampleElements = Array.from(document.getElementsByClassName('sampleNode'))
	let sampleElement = sampleElements[groupId.match(/\d+/)?.[0]]
	let node = sampleElement.dataSet.get()[0]
	node = deepMerge(node, styles.nodes[groupId], {
		chosen: false,
		size: 50,
		widthConstraint: 50,
		heightConstraint: 50,
		margin: 10,
		font: {size: 14},
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
	elem('linkStyleEditName').value = group.groupLabel !== 'Sample' ? group.groupLabel : ''
	elem('linkStyleEditLineColor').style.backgroundColor = standardize_color(group.color.color)
	elem('linkStyleEditWidth').value = group.width
	elem('linkStyleEditDashes').value = getDashes(group.dashes, 1)
	elem('linkStyleEditArrows').value = getArrows(group.arrows)
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function linkEditSave() {
	let groupId = elem('linkStyleEditorContainer').groupId
	let group = styles.edges[groupId]
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
		}),
	)
}
/**
 * ensure that the styles displayed in the link styles panel display the styles defined in the styles array
 */
export function refreshSampleLink(groupId) {
	let sampleElements = Array.from(document.getElementsByClassName('sampleLink'))
	let sampleElement = sampleElements[groupId.match(/\d+/)?.[0]]
	let edge = sampleElement.dataSet.get()[0]
	edge = deepMerge(edge, styles.edges[groupId], {chosen: false, value: 10})
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
		(elem) => !['Sample', '', ' '].includes(elem.dataSet.get('1').groupLabel),
	)
	let nItems = nodes.length + edges.length
	if (nItems === 0) {
		if (warn) alertMsg('Nothing to include in the Legend - rename some styles first', 'warn')
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
	legendBox.style.height = `${LEGENDSPACING * nItems + title.offsetHeight}px`
	legendBox.style.width = `${HALFLEGENDWIDTH * 2}px`
	let legendWrapper = document.createElement('div')
	legendWrapper.className = 'legendWrapper'
	legendBox.appendChild(legendWrapper)
	let canvas = document.createElement('div')
	canvas.className = 'legendCanvas'
	canvas.style.height = `${LEGENDSPACING * nItems}px`
	legendWrapper.appendChild(canvas)

	dragElement(legendBox, title)

	legendNetwork = new Network(canvas, legendData, {
		physics: {enabled: false},
		interaction: {zoomView: false, dragView: false},
	})
	let height = 0
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
	// required to allow scrolling on IOS
	canvas.firstElementChild.firstElementChild.style.touchAction = 'pan-y'
	canvas.firstElementChild.firstElementChild.style.webkitUserSelect = 'all'
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
