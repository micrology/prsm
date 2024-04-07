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


This module provides the Data View  
 ******************************************************************************************************************** */

import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {
	listen,
	elem,
	deepCopy,
	deepMerge,
	timeAndDate,
	shorten,
	capitalizeFirstLetter,
	isQuillEmpty,
	setNodeHidden,
	setEdgeHidden,
} from './utils.js'
import {TabulatorFull as Tabulator} from 'tabulator-tables'
import {version} from '../package.json'
import Quill from 'quill'
import {QuillDeltaToHtmlConverter} from 'quill-delta-to-html'
import {DateTime} from 'luxon'

const shortAppName = 'PRSM'

var debug = ''
window.debug = debug
var room
const doc = new Y.Doc()
var websocket = 'wss://www.prsm.uk/wss' // web socket server URL
var clientID // unique ID for this browser
var yNodesMap // shared map of nodes
var yEdgesMap // shared map of edges
var yNetMap // shared map of network state
var ySamplesMap // shared map of styles
var yUndoManager // shared list of commands for undo
var table = 'factors-table' // the table that is currently on view (factors-table or links-table)
var factorsTable // the factors table object
var linksTable // the links table object
var openTable // the table object that is currently on view
var initialising = true // true until the tables have been loaded
var attributeTitles = {} // titles of each of the attributes
var myNameRec // my name etc.
var qed // Quill editor
var loadingDelayTimer // timer to delay the start of the loading animation for few moments

window.DateTime = DateTime

window.addEventListener('load', () => {
	loadingDelayTimer = setTimeout(() => {
		elem('loading').style.display = 'block'
	}, 100)
	elem('version').innerHTML = version
	qed = new Quill('#notes-div')
	setUpTabs()
	setUpShareDialog()
	startY()
})

/**
 * add event listeners for the Factor and Link tabs
 */

function setUpTabs() {
	elem('factors-table').style.display = 'block'
	elem('links-table').style.display = 'none'
	elem('factors-table-tab').classList.add('active')

	let tabs = document.getElementsByClassName('table-tab')
	for (let i = 0; i < tabs.length; i++) {
		listen(tabs[i].id, 'click', (e) => {
			let tabs = document.getElementsByClassName('table-tab')
			for (let i = 0; i < tabs.length; i++) {
				tabs[i].classList.remove('active')
			}
			e.currentTarget.classList.add('active')
			let tabcontent = document.getElementsByClassName('table')
			for (let i = 0; i < tabcontent.length; i++) {
				tabcontent[i].style.display = 'none'
			}
			elem(e.currentTarget.dataset.table).style.display = 'block'
			table = e.currentTarget.dataset.table
			openTable = table == 'factors-table' ? factorsTable : linksTable
			if (filterDisplayed) closeFilter()
		})
	}
}
/**
 * create a new shared document and connect to the WebSocket provider
 */
function startY() {
	// get the room number from the URL, or if none, complain
	let url = new URL(document.location)
	room = url.searchParams.get('room')
	if (room == null || room == '') alert('No room name')
	else room = room.toUpperCase()
	debug = [url.searchParams.get('debug')]
	document.title = document.title + ' ' + room
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc)
	wsProvider.on('sync', () => {
		console.log(exactTime() + ' remote content loaded')
		openTable = initialiseFactorTable()
		initialiseLinkTable()
		elem('links-table').style.display = 'none'
	})
	wsProvider.on('status', (event) => {
		console.log(exactTime() + event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' + room) // logs when websocket is "connected" or "disconnected"
	})

	yNodesMap = doc.getMap('nodes')
	yEdgesMap = doc.getMap('edges')
	yNetMap = doc.getMap('network')
	ySamplesMap = doc.getMap('samples')
	yUndoManager = new Y.UndoManager([yNodesMap, yEdgesMap, yNetMap])

	clientID = doc.clientID
	console.log('My client ID: ' + clientID)

	/* 
	for convenience when debugging
	 */
	window.debug = debug
	window.clientID = clientID
	window.yNodesMap = yNodesMap
	window.yEdgesMap = yEdgesMap
	window.yNetMap = yNetMap
	window.attributeTitles = attributeTitles

	yNodesMap.observe((event) => {
		yjsTrace('yNodesMap.observe', event.transaction.local, event)
		if (event.transaction.origin && !initialising) {
			let adds = [],
				updates = [],
				deletes = []
			event.changes.keys.forEach((value, key) => {
				switch (value.action) {
					case 'add':
						adds.push(convertNode(yNodesMap.get(key)))
						break
					case 'update':
						updates.push(convertNode(yNodesMap.get(key)))
						break
					case 'delete':
						deletes.push(key)
						break
				}
			})
			updateFromAndToLabels(updates)
			if (adds) factorsTable.addData(adds)
			if (updates) factorsTable.updateData(updates)
			if (deletes) factorsTable.deleteRow(deletes)
		}
		yjsTrace('yNodesMap.observe finished', event.transaction.local, event)
	})
	yEdgesMap.observe((event) => {
		yjsTrace('yEdgesMap.observe', event.transaction.local, event)
		if (event.transaction.origin && !initialising) {
			let adds = [],
				updates = [],
				deletes = []
			event.changes.keys.forEach((value, key) => {
				switch (value.action) {
					case 'add':
						adds.push(convertEdge(yEdgesMap.get(key)))
						break
					case 'update':
						updates.push(convertEdge(yEdgesMap.get(key)))
						break
					case 'delete':
						deletes.push(key)
						break
				}
			})
			if (adds) linksTable.addData(adds)
			if (updates) linksTable.updateData(updates)
			if (deletes) linksTable.deleteRow(deletes)
		}
		yjsTrace('yEdgesMap.observe finished', event.transaction.local, event)
	})
	yNetMap.observe((event) => {
		yjsTrace('YNetMap.observe', event.transaction.local, event)
		for (let key of event.keysChanged) {
			let obj = yNetMap.get(key)
			switch (key) {
				case 'mapTitle':
				case 'maptitle': {
					let title = obj
					let div = elem('maptitle')
					if (title == 'Untitled map') {
						div.classList.add('unsetmaptitle')
					} else {
						div.classList.remove('unsetmaptitle')
						document.title = `${title}: ${shortAppName} table`
					}
					if (title !== div.innerText) div.innerText = title
					break
				}
				case 'attributeTitles': {
					if (!initialising) {
						attributeTitles = obj
						let colComps = factorsTable.getColumns()
						for (let attributeFieldName in obj) {
							let colComp = colComps.find((c) => c.getField() == attributeFieldName)
							if (colComp) {
								if (obj[attributeFieldName] == '*deleted*') {
									colComp.delete()
								} else {
									colComp.updateDefinition({title: obj[attributeFieldName]})
								}
							} else {
								if (obj[attributeFieldName] != '*deleted*') {
									factorsTable.addColumn({
										title: obj[attributeFieldName],
										editableTitle: true,
										field: attributeFieldName,
										editor: 'input',
										width: 100,
										headerContextMenu: headerContextMenu,
									})
								}
							}
						}
					}
					break
				}
				default:
					break
			}
		}
	})
	yUndoManager.on('stack-item-added', (event) => {
		yjsTrace('yUndoManager.on stack-item-added', true, event)
		undoRedoButtonStatus()
	})
	yUndoManager.on('stack-item-popped', (event) => {
		yjsTrace('yUndoManager.on stack-item-popped', true, event)
		undoRedoButtonStatus()
	})
	myNameRec = JSON.parse(localStorage.getItem('myName'))
	myNameRec.id = clientID
	console.log('My name: ' + myNameRec.name)
} // end startY()

function yjsTrace(where, source, what) {
	if (window.debug.includes('yjs')) {
		console.log(exactTime(), source ? 'local' : 'non-local', where, what)
	}
}
function exactTime() {
	let d = new Date()
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `
}
/**
 * set up the modal dialog that opens when the user clicks the Share icon in the nav bar
 */
function setUpShareDialog() {
	let modal = elem('shareModal')
	let inputElem = elem('text-to-copy')
	let copiedText = elem('copied-text')

	// When the user clicks the button, open the modal
	listen('share', 'click', () => {
		setLink('share')
	})

	function setLink(type) {
		let path
		switch (type) {
			case 'share':
				path = window.location.pathname.replace('table.html', 'prsm.html') + '?room=' + room
				break
			default:
				console.log('Bad case in setLink()')
				break
		}
		let linkToShare = window.location.origin + path
		modal.style.display = 'block'
		inputElem.cols = linkToShare.length.toString()
		inputElem.value = linkToShare
		inputElem.style.height = inputElem.scrollHeight - 3 + 'px'
		inputElem.select()
	}
	// When the user clicks on <span> (x), close the modal
	listen('modal-close', 'click', closeShareDialog)
	// When the user clicks anywhere on the background, close it
	listen('shareModal', 'click', closeShareDialog)

	function closeShareDialog() {
		let modal = elem('shareModal')
		if (event.target == modal || event.target == elem('modal-close')) {
			modal.style.display = 'none'
			copiedText.style.display = 'none'
		}
	}
	listen('copy-text', 'click', (e) => {
		e.preventDefault()
		// Select the text
		inputElem.select()
		if (copyText(inputElem.value))
			// Display the copied text message
			copiedText.style.display = 'inline-block'
	})
}
async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch (err) {
		console.error('Failed to copy: ', err)
		return false
	}
}
/*
The menu that appears on right clicking one of the additional user columns 
*/
var headerContextMenu = [
	{
		label: 'Delete Column',
		action: function (e, column) {
			deleteColumn(e, column)
		},
	},
]

/**
 * define the Factor table
 * @return {Tabulator} the table
 */
function initialiseFactorTable() {
	let tabledata = Array.from(yNodesMap.values())
		.filter((n) => !n.isCluster)
		.map((n) => {
			return convertNode(n)
		})
	factorsTable = new Tabulator('#factors-table', {
		data: tabledata, //assign data to table
		layout: 'fitData',
		layoutColumnsOnNewData: true,
		height: window.innerHeight - 180,
		resizableRows: true,
		clipboard: true,
		clipboardCopyConfig: {
			columnHeaders: true, //do not include column headers in clipboard output
			columnGroups: false, //do not include column groups in column headers for printed table
			rowGroups: false, //do not include row groups in clipboard output
			columnCalcs: false, //do not include column calculation rows in clipboard output
			dataTree: false, //do not include data tree in printed table
			formatCells: false, //show raw cell values without formatter
		},
		clipboardCopyRowRange: function () {
			// get the rows that remain after filtering
			let filteredRows = this.searchRows(this.getFilters())
			//only copy rows to clipboard that are selected, if any are
			let selectedRows = filteredRows.filter((row) => {
				return row.getData().selection
			})
			if (selectedRows.length > 0) return selectedRows
			else return filteredRows
		},
		index: 'id',
		columnHeaderVertAlign: 'bottom',
		columns: [
			{
				title: `Select&nbsp;
					<span  id="select-all"><span class="checkbox-box-off">${svg('cross')}</span>
			  		<span class="checkbox-box-on">${svg('tick')}</span></span>`,
				field: 'selection',
				hozAlign: 'center',
				formatter: 'tickCross',
				formatterParams: tickCrossFormatter(),
				headerVertical: true,
			},
			{
				title: 'Label',
				field: 'label',
				editor: 'textarea',
				maxWidth: 300,
				minWidth: 300,
				bottomCalc: 'count',
				bottomCalcFormatter: bottomCalcFormatter,
				bottomCalcFormatterParams: {legend: 'Count:'},
			},
			{
				title: 'Modified',
				field: 'modifiedTime',
				sorter: 'date',
				sorterParams: {
					format: 'd LLL y, H:m',
				},
				cssClass: 'grey',
			},
			{
				title: groupTitle('Format'),
				field: 'Format',
				columns: [
					{
						title: 'Style',
						field: 'groupLabel',
						minWidth: 100,
						editor: 'select',
						editorParams: {values: styleNodeNames},
					},
					{
						title: 'Shape',
						field: 'shape',
						minWidth: 100,
						editor: 'select',
						editorParams: {values: {box: 'box', ellipse: 'ellipse', circle: 'circle', text: 'none'}},
					},
					{
						title: `Hidden&nbsp;
						<span  id="hide-all-factors"><span class="checkbox-box-off">${svg('cross')}</span>
						  <span class="checkbox-box-on">${svg('tick')}</span></span>`,
						titleClipboard: 'Hidden',
						field: 'hidden',
						hozAlign: 'center',
						formatter: 'tickCross',
						formatterParams: tickCrossFormatter(),
						headerVertical: true,
						bottomCalc: 'count',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Count:'},
					},
					{
						title: 'Locked',
						field: 'fixed',
						hozAlign: 'center',
						formatter: 'tickCross',
						formatterParams: tickCrossFormatter(),
						headerVertical: true,
						bottomCalc: 'count',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Count:'},
					},
					{
						title: 'Relative Size',
						field: 'size',
						editor: 'number',
						editorParams: {
							min: 0,
							max: 10,
						},
						width: 60,
						headerVertical: true,
					},
					{
						title: 'Fill Colour',
						field: 'backgroundColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						editor: colorEditor,
					},
					{
						title: 'Border width',
						field: 'borderWidth',
						editor: 'number',
						editorParams: {
							min: 0,
							max: 20,
						},
						width: 15,
						headerVertical: true,
					},
					{
						title: 'Border Colour',
						field: 'borderColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						editor: colorEditor,
					},
					{
						title: 'Border Style',
						field: 'borderStyle',
						headerVertical: true,
						editor: 'select',
						editorParams: {values: ['Solid', 'Dashed', 'Dotted', 'None']},
					},
					{
						title: 'Font colour',
						field: 'fontColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						editor: colorEditor,
					},
					{
						title: 'Font size',
						field: 'fontSize',
						minWidth: 15,
						headerVertical: true,
						editor: 'number',
						editorParams: {
							min: 10,
							max: 30,
						},
					},
				],
			},
			{
				title: groupTitle('Statistics'),
				field: 'Statistics',
				columns: [
					{
						title: 'In-degree',
						field: 'indegree',
						headerVertical: true,
						minWidth: 100,
						hozAlign: 'center',
						cssClass: 'grey',
						bottomCalc: 'avg',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Avg:', precision: 2},
					},
					{
						title: 'Out-degree',
						field: 'outdegree',
						headerVertical: true,
						hozAlign: 'center',
						cssClass: 'grey',
						bottomCalc: 'avg',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Avg:', precision: 2},
					},
					{
						title: 'Total degree',
						field: 'degree',
						headerVertical: true,
						hozAlign: 'center',
						cssClass: 'grey',
						bottomCalc: 'avg',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Avg:', precision: 2},
					},
					{
						title: 'Leverage',
						field: 'leverage',
						hozAlign: 'center',
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Betweenness',
						field: 'bc',
						minWidth: 60,
						hozAlign: 'center',
						headerVertical: true,
						cssClass: 'grey',
						bottomCalc: 'max',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Max:'},
					},
					{
						title: `${svg('thumbUp')}`,
						field: 'thumbUp',
						hozAlign: 'center',
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: `${svg('thumbDown')}`,
						field: 'thumbDown',
						hozAlign: 'center',
						headerVertical: true,
						cssClass: 'grey',
					},
				],
			},
			{
				title: groupTitle('Notes'),
				field: 'Notes',
				columns: [
					{
						field: 'note',
						editor: quillEditor,
						formatter: quillFormatter,
						accessorClipboard: quillAccessor,
						maxWidth: 600,
						minWidth: 200,
						variableHeight: true,
					},
				],
			},
		],
	})
	factorsTable.on('tableBuilt', () => {
		// add all the user defined attribute columns
		attributeTitles = yNetMap.get('attributeTitles') || {}
		for (let field in attributeTitles) {
			if (attributeTitles[field] != '*deleted*') {
				factorsTable.addColumn({
					title: attributeTitles[field],
					editableTitle: true,
					field: field,
					editor: 'input',
					width: getWidthOfTitle(attributeTitles[field]),
					headerContextMenu: headerContextMenu,
				})
			}
		}
		listen('select-all', 'click', (e) => {
			let ticked = headerTickToggle(e, '#select-all')
			factorsTable.getRows('active').forEach((row) => {
				row.update({selection: !ticked})
			})
		})
		listen('hide-all-factors', 'click', (e) => {
			let ticked = headerTickToggle(e, '#hide-all-factors')
			doc.transact(() => {
				factorsTable.getRows().forEach((row) => {
					row.update({hidden: !ticked})
					let node = deepCopy(yNodesMap.get(row.getData().id))
					node.nodeHidden = !ticked
					yNodesMap.set(node.id, node)
				})
			})
		})
		// start with column groups collapsed
		collapseColGroup(factorsTable, 'Format')
		collapseColGroup(factorsTable, 'Statistics')
		collapseNotes(factorsTable)
		cancelLoading()
	})
	factorsTable.on('dataLoaded', () => {
		initialising = false
	})

	factorsTable.on('columnTitleChanged', (column) => updateColumnTitle(column))

	factorsTable.on('cellEdited', (cell) => updateNodeCellData(cell))

	factorsTable.on('cellClick', (e, cell) => {
		switch (cell.getField()) {
			case 'hidden':
			case 'selection':
			case 'fixed':
				tickToggle(e, cell)
				break
			default:
				break
		}
	})

	window.factorsTable = factorsTable

	return factorsTable
}
/**
 * After the Factor tab is loaded, cancel the Loading... dots
 */
function cancelLoading() {
	elem('loading').style.display = 'none'
	clearTimeout(loadingDelayTimer)
}

/**
 * return HTML string for column group header, with embedded collapse/reveal icon
 * @param {String} field field name of column group
 * @param {Boolean} collapse which header 9and which collapse/reveal icon) to use
 * @returns HTML string
 */
function groupTitle(field, collapse = true) {
	if (collapse)
		return `${field}<span style="float:right"><span id="hide${field}" data-collapsed="true" title="Collapse columns">${svg(
			'collapse'
		)}</span></span>`
	else
		return `${field}<span style="float:right"><span id="hide${field}" data-collapsed="false" title="Reveal columns">${svg(
			'uncollapse'
		)}</span></span>`
}
/**
 * hides (or shows) all but the first column in the column group and replaces the column group header
 * @param {Object} table table with this col group
 * @param {String} field field name of column group
 */
function collapseColGroup(table, field) {
	let first = true
	table.columnManager.columnsByIndex.forEach((col) => {
		if (col.parent.field == field) {
			if (first) {
				first = false
				if (document.getElementById(`hide${field}`).dataset.collapsed == 'true')
					col.parent.titleElement.innerHTML = groupTitle(field, false)
				else col.parent.titleElement.innerHTML = groupTitle(field, true)
				listen(`hide${field}`, 'click', () => {
					collapseColGroup(table, field)
				})
			} else {
				if (col.visible) col.hide()
				else col.show()
			}
		}
	})
}
/**
 * reduce (and shorten the notes text) or expand the width of the Notes column
 * @param {Tabulator} table
 * @param {string} field
 */
function collapseNotes(table, field = 'Notes') {
	let col = table.columnManager.columnsByIndex.filter((c) => c.field == 'note')[0]
	if (document.getElementById(`hide${field}`).dataset.collapsed == 'true') {
		col.parent.titleElement.innerHTML = groupTitle(field, false)
		col.setWidth(200)
	} else {
		col.parent.titleElement.innerHTML = groupTitle(field, true)
		col.setWidth(600)
	}
	// rewrite the values, so that the Notes formatter can shorten or expand the displayed text
	col.getCells().forEach((cell) => cell.setValue(cell.getValue()))
	listen(`hide${field}`, 'click', () => {
		collapseNotes(table, field)
	})
}

/**
 * Toggle the value of a cell in a TickCross column
 * @param {event} e
 * @param {object} cell
 */
function tickToggle(e, cell) {
	cell.setValue(!cell.getValue())
}
/**
 * Toggle the displayed state of the checkbox in a TickCross column
 * @param {Event} e
 * @param {String} id id of checkbox in header of a tickCross column
 */
function headerTickToggle(e, id) {
	e.stopPropagation()
	let off = document.querySelector(id + ' .checkbox-box-off')
	let on = document.querySelector(id + ' .checkbox-box-on')
	let ticked = off.style.display == 'none'
	if (ticked) {
		off.style.display = 'inline'
		on.style.display = 'none'
	} else {
		on.style.display = 'inline'
		off.style.display = 'none'
	}
	return ticked
}

function tickCrossFormatter() {
	return {
		allowTruthy: true,
		tickElement: svg('tick'),
		crossElement: svg('cross'),
	}
}
function bottomCalcFormatter(cell, params) {
	return `<span class="col-calc">${params.legend} ${cell.getValue()}</span>`
}
/**
 * @return list of Factor Style names (omitting those called the default, 'Sample')
 */
function styleNodeNames() {
	return Array.from(ySamplesMap.values())
		.filter((s) => s.node)
		.map((s) => s.node.groupLabel)
		.filter((l) => l != 'Sample')
}
/**
 * return the SVG code for the given icon (see Bootstrap Icons)
 * @param {String} icon
 */
function svg(icon) {
	switch (icon) {
		case 'tick':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-square" viewBox="0 0 16 16">
		<path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
		<path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/>
	  </svg>`
		case 'cross':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-square" viewBox="0 0 16 16">
		<path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
	  </svg>`
		case 'close':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-square" viewBox="0 0 16 16">
		<path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
		<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
	  </svg>`
		case 'collapse':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-bar-left" viewBox="0 0 16 16">
			<path fill-rule="evenodd" d="M12.5 15a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5zM10 8a.5.5 0 0 1-.5.5H3.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L3.707 7.5H9.5a.5.5 0 0 1 .5.5z"/>
		  </svg>`
		case 'uncollapse':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-bar-right" viewBox="0 0 16 16">
			<path fill-rule="evenodd" d="M6 8a.5.5 0 0 0 .5.5h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L12.293 7.5H6.5A.5.5 0 0 0 6 8zm-2.5 7a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5z"/>
		  </svg>`
		case 'thumbUp':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-hand-thumbs-up-fill" viewBox="0 0 16 16">
			<path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z"/>
		  </svg>`
		case 'thumbDown':
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-hand-thumbs-down-fill" viewBox="0 0 16 16">
			<path d="M6.956 14.534c.065.936.952 1.659 1.908 1.42l.261-.065a1.38 1.38 0 0 0 1.012-.965c.22-.816.533-2.512.062-4.51q.205.03.443.051c.713.065 1.669.071 2.516-.211.518-.173.994-.68 1.2-1.272a1.9 1.9 0 0 0-.234-1.734c.058-.118.103-.242.138-.362.077-.27.113-.568.113-.856 0-.29-.036-.586-.113-.857a2 2 0 0 0-.16-.403c.169-.387.107-.82-.003-1.149a3.2 3.2 0 0 0-.488-.9c.054-.153.076-.313.076-.465a1.86 1.86 0 0 0-.253-.912C13.1.757 12.437.28 11.5.28H8c-.605 0-1.07.08-1.466.217a4.8 4.8 0 0 0-.97.485l-.048.029c-.504.308-.999.61-2.068.723C2.682 1.815 2 2.434 2 3.279v4c0 .851.685 1.433 1.357 1.616.849.232 1.574.787 2.132 1.41.56.626.914 1.28 1.039 1.638.199.575.356 1.54.428 2.591"/>
		  </svg>`
		default:
			console.log('Bad request for svg')
	}
}
/**
 * returns the note for this factor in HTML format, shortening it with ellipses if the column is collapsed
 * @param {object} cell
 * @returns HTML string
 */
function quillFormatter(cell) {
	let note = cell.getValue()
	if (note) {
		qed.setContents(note)
		let html = new QuillDeltaToHtmlConverter(qed.getContents().ops, {inlineStyles: true}).convert()
		// this should work, but there is a bug in Tabulator
		//		if (elem(`hide${cell.getColumn().getParentColumn().getField()}`).dataset.collapsed == 'false')
		if (elem(`hide${table === 'factors-table' ? 'Notes' : 'LinkNotes'}`).dataset.collapsed == 'false')
			return shorten(html, 50)
		else return html
	}
	return ''
}
/**
 * Used to convert Quill formatted notes into HTML ready for copying to the clipboard
 * @param { array} note - Quill delta
 * @returns note in HTML format
 */
function quillAccessor(note) {
	if (note) {
		qed.setContents(note)
		return new QuillDeltaToHtmlConverter(qed.getContents().ops, {inlineStyles: true}).convert()
	}
	return ''
}
/**
 * start up a Quill editor for the note in this cell
 * @param {object} cell
 * @param {function} onRendered not used
 * @param {function} success function to call when user has finished editing
 * @returns HTMLElement placeholder for the cell while it is being edited elsewhere
 */
function quillEditor(cell, onRendered, success) {
	let pane = document.createElement('div')
	pane.className = 'quill-pane'
	elem('container').appendChild(pane)
	let element = document.createElement('div')
	pane.appendChild(element)
	let editor = new Quill(element, {
		modules: {
			toolbar: [
				'bold',
				'italic',
				'underline',
				'link',
				{list: 'ordered'},
				{list: 'bullet'},
				{indent: '-1'},
				{indent: '+1'},
			],
		},
		placeholder: 'Notes',
		theme: 'snow',
		bounds: element,
	})
	let note = cell.getValue()
	if (note) {
		if (note instanceof Object) editor.setContents(note)
		else editor.setText(note)
	} else editor.setText('')
	editor.on('selection-change', (range) => {
		if (!range) {
			finish(cell)
		}
	})
	editor.focus()
	let placeholder = document.createElement('div')
	placeholder.className = 'quill-placeholder'
	return placeholder

	function finish(cell) {
		cell.getTable().modules.edit.currentCell = cell._cell
		success(isQuillEmpty(editor) ? '' : editor.getContents())
		pane.remove()
	}
}

/**
 * spread some deep values to the top level to suit the requirements of the Tabulator package better
 * NB: any such converted values cannot then be edited without special attention (in updateEdgeCellData)
 * @param {Object} node
 * @returns {object} the node augmented with new properties
 */
function convertNode(node) {
	let n = deepCopy(node)
	let conversions = {
		borderColor: ['color', 'border'],
		backgroundColor: ['color', 'background'],
		fontFace: ['font', 'face'],
		fontColor: ['font', 'color'],
		fontSize: ['font', 'size'],
	}
	for (let prop in conversions) {
		n[prop] = n[conversions[prop][0]][conversions[prop][1]]
	}
	n.size =
		n.scaling.label.enabled && n.value != undefined && !isNaN(n.value) ? parseFloat(n.value).toPrecision(3) : '--'
	if (n.groupLabel == 'Sample') n.groupLabel = '--'
	n.borderStyle = n.shapeProperties.borderDashes
	if (n.borderWidth == 0) n.borderStyle = 'None'
	else {
		if (Array.isArray(n.borderStyle)) n.borderStyle = 'Dotted'
		else n.borderStyle = n.borderStyle ? 'Dashed' : 'Solid'
	}
	n.hidden = n.nodeHidden
	if (n.modified) n.modifiedTime = timeAndDate(n.modified.time, true)
	else if (n.created) n.modifiedTime = timeAndDate(n.created.time, true)
	else n.modifiedTime = '--'
	n.indegree = 0
	n.outdegree = 0
	Array.from(yEdgesMap.values()).forEach((e) => {
		if (n.id == e.from) n.outdegree++
		if (n.id == e.to) n.indegree++
	})
	n.degree = n.outdegree + n.indegree
	n.leverage = n.indegree == 0 ? '--' : (n.outdegree / n.indegree).toPrecision(3)
	if (n.bc == undefined) n.bc = '--'
	else n.bc = parseFloat(n.bc).toPrecision(3)
	n.thumbUp = n.thumbUp.length
	n.thumbDown = n.thumbDown.length

	return n
}

/**
 * store the user's edit to the cell value
 * (but if other rows are selected, put that new value in those rows too)
 * @param {object} cell
 */
function updateNodeCellData(cell) {
	let field = cell.getField()
	// don't do anything with the selection column
	if (field == 'selection') return
	let rows = factorsTable.getRows().filter((row) => row.getData().selection)
	if (rows.length == 0) rows = [cell.getRow()] // no rows selected, so process just this cell
	let value = cell.getValue()
	rows.forEach((row) => {
		// process all selected rows to update their field with cell value
		// get the old value of the node
		let node = deepCopy(yNodesMap.get(row.getData().id))
		// update it with the cell's new value
		node = convertNodeBack(node, field, value)
		if (field == 'groupLabel') {
			node = deepMerge(node, ySamplesMap.get(node.grp).node)
			factorsTable.updateData([convertNode(node)])
		}
		node.modified = {time: Date.now(), user: myNameRec.name}
		let update = {id: node.id, modifiedTime: timeAndDate(node.modified.time)}
		update[field] = value
		cell.getTable().updateData([update])
		// sync it
		yNodesMap.set(node.id, node)
		updateFromAndToLabels([node])
	})
}

/**
 * Convert the properties of the node back into the format required by vis-network
 * @param {object} node
 * @param {string} field
 * @param {any} value
 */
function convertNodeBack(node, field, value) {
	switch (field) {
		case 'groupLabel':
			node.grp = getNodeGroupFromGroupLabel(value)
			break
		case 'hidden':
			hideNodeAndEdges(node, value)
			break
		case 'fixed':
			node.shadow = value
			node.fixed = value
			break
		case 'borderStyle':
			if (node.borderWidth == 0) node.borderWidth = 4
			switch (value) {
				case 'None':
					node.borderWidth = 0
					node.shapeProperties.borderDashes = false
					break
				case 'Dotted':
					node.shapeProperties.borderDashes = false
					break
				case 'Dashed':
					node.shapeProperties.borderDashes = true
					break
				case 'Solid':
					node.shapeProperties.borderDashes = false
					break
			}
			break
		case 'backgroundColor':
			node.color.background = value
			break
		case 'borderColor':
			node.color.border = value
			break
		case 'fontColor':
			node.font.color = value
			break
		case 'fontSize':
			node.font.size = parseFloat(value)
			break
		case 'size':
			if (value == '--') node.scaling.label.enabled = false
			else {
				node.scaling.label.enabled = true
				node.value = parseFloat(value)
			}
			break
		default:
			node[field] = value
			break
	}
	return node
}
/**
 * Set the node's hidden property to true, and hide all the connected edges (or the reverse if value is false)
 * @param {object} node
 * @param {boolean} value new value (hidden or not hidden)
 */
function hideNodeAndEdges(node, value) {
	setNodeHidden(node, value)
	yEdgesMap.forEach((e) => {
		if (e.from == node.id || e.to == node.id) {
			setEdgeHidden(e, value)
			yEdgesMap.set(e.id, e)
		}
	})
}
/**
 * Given a label for a style, return the style's group id.  Assumes that the style label is unique
 * @param {String} groupLabel
 */
function getNodeGroupFromGroupLabel(groupLabel) {
	return Array.from(ySamplesMap.entries()).filter((a) => a[1].node && a[1].node.groupLabel == groupLabel)[0][0]
}
/**
 * define the Link table
 * @return {Tabulator} the table
 */
function initialiseLinkTable() {
	let tabledata = Array.from(yEdgesMap.values()).map((n) => {
		return convertEdge(n)
	})

	linksTable = new Tabulator('#links-table', {
		data: tabledata, //assign data to table
		clipboard: true,
		clipboardCopyConfig: {
			columnHeaders: true, //do not include column headers in clipboard output
			columnGroups: false, //do not include column groups in column headers for printed table
			rowGroups: false, //do not include row groups in clipboard output
			columnCalcs: false, //do not include column calculation rows in clipboard output
			dataTree: false, //do not include data tree in printed table
			formatCells: false, //show raw cell values without formatter
		},
		clipboardCopyRowRange: function () {
			// get the rows that remain after filtering
			let filteredRows = this.searchRows(this.getFilters())
			//only copy rows to clipboard that are selected, if any are
			let selectedRows = filteredRows.filter((row) => {
				return row.getData().selection
			})
			if (selectedRows.length > 0) return selectedRows
			else return filteredRows
		},
		layout: 'fitData',
		height: window.innerHeight - 180,
		index: 'id',
		columnHeaderVertAlign: 'bottom',
		columns: [
			{
				title: `Select&nbsp;
					<span  id="select-all-links"><span class="checkbox-box-off">${svg('cross')}</span>
			  		<span class="checkbox-box-on">${svg('tick')}</span></span>`,
				field: 'selection',
				hozAlign: 'center',
				formatter: 'tickCross',
				formatterParams: tickCrossFormatter(),
				headerVertical: true,
			},
			{
				title: 'From',
				field: 'fromLabel',
				width: 300,
				cssClass: 'grey',
				bottomCalc: 'count',
				bottomCalcFormatter: bottomCalcFormatter,
				bottomCalcFormatterParams: {legend: 'Count:'},
			},
			{title: 'To', field: 'toLabel', width: 300, cssClass: 'grey'},
			{
				title: 'Modified',
				field: 'modifiedTime',
				sorter: 'date',
				sorterParams: {
					format: 'd LLL y, H:m',
				},
				cssClass: 'grey',
			},
			{
				title: groupTitle('Style'),
				field: 'Style',
				columns: [
					{
						title: 'Style',
						field: 'groupLabel',
						minWidth: 100,
						editor: 'select',
						editorParams: {values: styleEdgeNames},
					},
					{
						title: `Hidden&nbsp;
						<span  id="hide-all-links"><span class="checkbox-box-off">${svg('cross')}</span>
						  <span class="checkbox-box-on">${svg('tick')}</span></span>`,
						titleClipboard: 'Hidden',
						field: 'hidden',
						hozAlign: 'center',
						formatter: 'tickCross',
						formatterParams: tickCrossFormatter(),
						headerVertical: true,
						bottomCalc: 'count',
						bottomCalcFormatter: bottomCalcFormatter,
						bottomCalcFormatterParams: {legend: 'Count:'},
					},
					{
						title: 'Arrow',
						field: 'arrowShape',
						headerVertical: true,
						editor: 'select',
						editorParams: {
							values: ['vee', 'arrow', 'bar', 'circle', 'box', 'diamond', 'none'],
						},
					},
					{
						title: 'Colour',
						field: 'arrowColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						editor: colorEditor,
					},
					{
						title: 'Width',
						field: 'width',
						editor: 'number',
						editorParams: {
							min: 0,
							max: 20,
						},
						width: 15,
						headerVertical: true,
					},
					{
						title: 'Line Style',
						field: 'lineStyle',
						editor: 'select',
						editorParams: {
							values: ['Solid', 'Dashed', 'Dotted'],
						},
						headerVertical: true,
					},
					{
						title: 'Font size',
						field: 'fontSize',
						width: 15,
						editor: 'select',
						editorParams: {
							values: [10, 14, 18],
						},
						headerVertical: true,
					},
				],
			},
			{
				title: groupTitle('LinkNotes'),
				field: 'LinkNotes',
				columns: [
					{
						field: 'note',
						editor: quillEditor,
						formatter: quillFormatter,
						accessorClipboard: quillAccessor,
						maxWidth: 600,
						minWidth: 200,
						variableHeight: true,
					},
				],
			},
		],
	})
	linksTable.on('tableBuilt', () => {
		// add all the user defined attribute columns
		attributeTitles = yNetMap.get('attributeTitles') || {}
		for (let field in attributeTitles) {
			if (attributeTitles[field] != '*deleted*') {
				linksTable.addColumn({
					title: attributeTitles[field],
					editableTitle: true,
					field: field,
					editor: 'input',
					width: getWidthOfTitle(attributeTitles[field]),
					headerContextMenu: headerContextMenu,
				})
			}
		}
		listen('select-all-links', 'click', (e) => {
			let ticked = headerTickToggle(e, '#select-all-links')
			linksTable.getRows('active').forEach((row) => {
				row.update({selection: !ticked})
			})
		})
		listen('hide-all-links', 'click', (e) => {
			let ticked = headerTickToggle(e, '#hide-all-links')
			doc.transact(() => {
				linksTable.getRows().forEach((row) => {
					row.update({hidden: !ticked})
					let edge = deepCopy(yEdgesMap.get(row.getData().id))
					edge.edgeHidden = !ticked
					yEdgesMap.set(edge.id, edge)
				})
			})
		})
		collapseColGroup(linksTable, 'Style')
		collapseNotes(linksTable, 'LinkNotes')
		if (table == 'factors-table') elem('links-table').style.display = 'none'
	})
	linksTable.on('dataLoaded', () => {
		initialising = false
	})

	linksTable.on('columnTitleChanged', (column) => updateColumnTitle(column))

	linksTable.on('cellEdited', (cell) => updateEdgeCellData(cell))

	linksTable.on('cellClick', (e, cell) => {
		switch (cell.getField()) {
			case 'hidden':
			case 'selection':
				tickToggle(e, cell)
				break
			default:
				break
		}
	})

	window.linksTable = linksTable

	return linksTable
}
/**
 * @return list of Factor Style names (omitting those called the default, 'Sample')
 */
function styleEdgeNames() {
	return Array.from(ySamplesMap.values())
		.filter((s) => s.edge)
		.map((s) => s.edge.groupLabel)
		.filter((l) => l != 'Sample')
}
/**
 * spread some deep values to the top level to suit the requirements of the Tabulator package better
 * NB: any such converted values cannot then be edited without special attention (in updateEdgeCellData)
 * @param {object} edge
 * @returns {object} the node augmented with new properties
 */
function convertEdge(edge) {
	let e = deepCopy(edge)
	e.fromLabel = yNodesMap.get(e.from).label
	e.toLabel = yNodesMap.get(e.to).label
	e.arrowShape = e.arrows.to.type
	if (e.groupLabel == 'Sample') e.groupLabel = '--'
	if (Array.isArray(e.dashes)) e.lineStyle = 'Dotted'
	else if (e.dashes) e.lineStyle = 'Dashed'
	else e.lineStyle = 'Solid'
	let conversions = {
		arrowColor: ['color', 'color'],
		fontSize: ['font', 'size'],
	}
	for (let prop in conversions) {
		e[prop] = e[conversions[prop][0]][conversions[prop][1]]
	}
	e.hidden = e.edgeHidden
	if (e.modified) e.modifiedTime = timeAndDate(e.modified.time)
	else if (e.created) e.modifiedTime = timeAndDate(e.created.time)
	else e.modifiedTime = '--'
	return e
}
/**
 * When a node is updated, the update may include a change of its label.  Make the corresponding changes to the
 * references to that node in the Links table
 * @param {Array} nodes - array of updated nodes
 */
function updateFromAndToLabels(nodes) {
	let linksToUpdate = []
	nodes.forEach((node) => {
		linksToUpdate = linksToUpdate.concat(
			Array.from(yEdgesMap.values()).filter((e) => e.from == node.id || e.to == node.id)
		)
	})
	if (linksToUpdate.length) linksTable.updateOrAddData(linksToUpdate.map((e) => convertEdge(e)))
}

/**
 * store the user's edit to the cell value
 * @param {object} cell
 */
function updateEdgeCellData(cell) {
	let field = cell.getField()
	// don't do anything with the selection column
	if (field == 'selection') return // get the old value of the edge
	let rows = linksTable.getRows().filter((row) => row.getData().selection)
	if (rows.length == 0) rows = [cell.getRow()] // no rows selected, so process just this cell
	let value = cell.getValue()
	rows.forEach((row) => {
		let edge = deepCopy(yEdgesMap.get(row.getData().id))
		// update it with the cell's new value
		edge = convertEdgeBack(edge, field, value)
		if (field == 'groupLabel') {
			edge = deepMerge(edge, ySamplesMap.get(edge.grp).edge)
			linksTable.updateData([convertEdge(edge)])
		}
		edge.modified = {time: Date.now(), user: myNameRec.name}
		let update = {id: edge.id, modifiedTime: timeAndDate(edge.modified.time)}
		update[field] = value
		cell.getTable().updateData([update])
		// sync it
		yEdgesMap.set(edge.id, edge)
	})
}
/**
 * Convert the properties of the edge back into the format required by vis-network
 * @param {object} edge
 * @param {string} field
 * @param {any} value
 */
function convertEdgeBack(edge, field, value) {
	switch (field) {
		case 'groupLabel':
			edge.grp = getEdgeGroupFromGroupLabel(value)
			break
		case 'arrowShape':
			edge.arrows.to.type = edge.arrowShape
			break
		case 'fontSize':
			edge.font.size = edge.fontSize
			break
		case 'lineStyle':
			switch (value) {
				case 'Solid':
					edge.dashes = false
					break
				case 'Dashed':
					edge.dashes = [10, 10]
					break
				case 'Dotted':
					edge.dashes = [2, 8]
					break
				default:
					edge.dashes = value
					break
			}
			break
		case 'arrowColor':
			edge.color.color = edge.arrowColor
			break
		default:
			edge[field] = value
			break
	}
	return edge
}

function getEdgeGroupFromGroupLabel(groupLabel) {
	return Array.from(ySamplesMap.entries()).filter((a) => a[1].edge && a[1].edge.groupLabel == groupLabel)[0][0]
}

/**
 * store the user's new title for the column
 * @param {object} column
 */

function updateColumnTitle(column) {
	let newTitle = column.getDefinition().title
	attributeTitles[column.getField()] = newTitle
	yNetMap.set('attributeTitles', attributeTitles)
}

/**
 * return the length of the string in pixels when displayed using given font
 * @param {string} text
 * @param {string} fontname
 * @param {number} fontsize
 * @return {number} pixels
 */
function getWidthOfTitle(text, fontname = 'Oxygen', fontsize = 13.33) {
	if (getWidthOfTitle.c === undefined) {
		getWidthOfTitle.c = document.createElement('canvas')
		getWidthOfTitle.ctx = getWidthOfTitle.c.getContext('2d')
	}
	let fontspec = fontsize + ' ' + fontname
	if (getWidthOfTitle.ctx.font !== fontspec) getWidthOfTitle.ctx.font = fontspec
	return getWidthOfTitle.ctx.measureText(text + '  ').width + 90
}
/**
 * Use the browser standard color picker to edit the cell colour
 * @param {object} cell - the cell component for the editable cell
 * @param {function} onRendered - function to call when the editor has been rendered
 * @param {function} success function to call to pass the successfully updated value to Tabulator
 * @return {HTMLElement} the editor element
 */
function colorEditor(cell, onRendered, success) {
	let editor = document.createElement('input')
	editor.setAttribute('type', 'color')
	editor.style.width = '100%'
	editor.style.padding = '0px'
	editor.style.boxSizing = 'border-box'

	editor.value = cell.getValue()

	//set focus on the select box when the editor is selected (timeout allows for editor to be added to DOM)
	onRendered(function () {
		editor.focus()
		editor.style.css = '100%'
	})

	//when the value has been set, trigger the cell to update
	function successFunc() {
		success(editor.value)
	}

	editor.addEventListener('change', successFunc)
	editor.addEventListener('blur', successFunc)

	return editor
}

listen('col-insert', 'click', addColumn)

/**
 * user has clicked the button to add a column for a user-defined attribute
 */
function addColumn() {
	let nAttributes = Object.keys(attributeTitles).length + 1
	openTable.addColumn({
		title: 'Att ' + nAttributes,
		editableTitle: true,
		field: 'att' + nAttributes,
		editor: 'input',
		width: 100,
		headerContextMenu: headerContextMenu,
	})
	attributeTitles['att' + nAttributes] = 'Att ' + nAttributes
	yNetMap.set('attributeTitles', attributeTitles)
}

/**
 * delete the column from the table and mark the data as deleted
 * @param {object} column
 */
function deleteColumn(e, column) {
	attributeTitles[column.getField()] = '*deleted*'
	yNetMap.set('attributeTitles', attributeTitles)
	column.delete()
}
/**
 * Undo/redo
 */
listen('undo', 'click', undo)
listen('redo', 'click', redo)

function undo() {
	yUndoManager.undo()
}

function redo() {
	yUndoManager.redo()
}

function undoRedoButtonStatus() {
	setButtonDisabledStatus('undo', yUndoManager.undoStack.length === 0)
	setButtonDisabledStatus('redo', yUndoManager.redoStack.length === 0)
}

/**
 * Change the visible state of a button
 * @param {String} id
 * @param {Boolean} state - true to make the button disabled
 */
function setButtonDisabledStatus(id, state) {
	if (state) elem(id).classList.add('disabled')
	else elem(id).classList.remove('disabled')
}

listen('filter', 'click', setUpFilter)

var filterDisplayed = false

/**
 * Display a dialog box to get the filter parameters
 */
function setUpFilter() {
	let filterDiv = elem('filter-dialog')
	if (filterDisplayed) {
		closeFilter()
		return
	}
	filterDisplayed = true
	filterDiv.style.display = 'block'
	let select = document.createElement('select')
	select.id = 'filter-field'
	let i = 0
	openTable.getColumns().forEach((colComp) => {
		let def = colComp.getDefinition()
		if (def.formatter != 'color' && def.field != 'selection')
			// cannot sort by color
			select[i++] = new Option(def.titleClipboard || def.title || capitalizeFirstLetter(def.field), def.field)
	})
	filterDiv.appendChild(select)
	filterDiv.insertAdjacentHTML('afterbegin', 'Filter: ')
	filterDiv.insertAdjacentHTML(
		'beforeend',
		`
	<select id="filter-type">
		<option value="like">contains</option>
		<option value="=">matches</option>
		<option value="starts">starts with</option>
		<option value="ends">ends with</option>
		<option value="=">=</option>
		<option value="<"><</option>
		<option value="<="><=</option>
		<option value=">">></option>
		<option value=">=">>=</option>
		<option value="!=">!=</option>
  	</select>
	  <input id="filter-value" type="text">
	  <button id= "filter-close">${svg('close')}</button>`
	)
	listen('filter-field', 'change', updateFilter)
	listen('filter-type', 'change', updateFilter)
	listen('filter-value', 'keyup', updateFilter)
	listen('filter-close', 'click', closeFilter)
}

/**
 * Update the table to show only the rows that pass the filter
 */
function updateFilter() {
	let select = elem('filter-field'),
		type = elem('filter-type'),
		value = elem('filter-value').value
	let filterVal = select.options[select.selectedIndex].value
	var typeVal = type.options[type.selectedIndex].value
	if (filterVal) {
		if (filterVal == 'note') openTable.setFilter(noteFilter, {type: typeVal, str: value})
		else openTable.setFilter(filterVal, typeVal, value)
	}
}
/**
 * Custom filter for Notes -first converts Quill format to string and then checks the string
 * @param {object} data - a row
 * @param {object} params - {type of comparison, str: string to match}
 * @returns Boolean
 */
function noteFilter(data, params) {
	if (data.note) {
		qed.setContents(data.note)
		let html = new QuillDeltaToHtmlConverter(qed.getContents().ops, {inlineStyles: true})
			.convert()
			.replace(/(<([^>]+)>)/gi, '')
		switch (params.type) {
			case 'like':
				return html.includes(params.str)
			case '=':
				return html == params.str
			case 'starts':
				return html.startsWith(params.str)
			case 'ends':
				return html.endsWith(params.str)
			default:
				return true
		}
	}
	return false
}
/**
 * Close the filter dialog and remove the filter (i.e. display all rows)
 */
function closeFilter() {
	elem('filter-dialog').innerHTML = ''
	openTable.clearFilter()
	filterDisplayed = false
	elem('filter-dialog').style.display = 'none'
}

listen('copy', 'click', copyTable)
/**
 * Copy the all or filtered rows of the table to the clipboard
 * If some rows are selected, only those will be copied (see
 * the clipboardCopyRowRange option in the table definitions)
 */
function copyTable() {
	openTable.copyToClipboard()
}

listen('help', 'click', displayHelp)

/**
 * display help page in a separate window
 */
function displayHelp() {
	window.open('./help.html#contents', 'helpWindow')
}
