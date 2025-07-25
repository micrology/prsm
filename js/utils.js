/*********************************************************************************************************************  

PRSM Participatory System Mapper 

	Copyright (C) 2022  Nigel Gilbert prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.

This module provides a set of utility functions used widely within the PRSM code.  
**********************************************************************************************************************/

import * as Hammer from '@egjs/hammerjs'
import iro from '@jaames/iro'

const MANUALURL = './doc/help/doc_build/manual/Introduction.html'
/**
 * attach an event listener
 *
 * @param {string} id - id of the element on which to hang the event listener
 * @param {string} event
 * @param {function} callback
 * @param {object} options
 */
export function listen(id, event, callback, options) {
	elem(id).addEventListener(event, callback, options)
}

/**
 * return the HTML element with the id
 * @param {string} id
 */
export function elem(id) {
	return document.getElementById(id)
}

export function pushnew(array, item) {
	if (array) {
		if (!array.includes(item)) array.push(item)
	} else array = [item]
	return array
}

/**
 * Create a random scale free network, used only for testing and demoing
 * Taken from the vis-network distribution
 *
 * Created by Alex on 5/20/2015.
 */
export function getScaleFreeNetwork(nodeCount) {
	var nodes = []
	var edges = []
	var connectionCount = []

	// randomly create some nodes and edges
	for (var i = 0; i < nodeCount; i++) {
		nodes.push({
			id: String(i),
			label: String(i),
			grp: 'group0',
			value: 1,
		})

		connectionCount[i] = 0

		// create edges in a scale-free-network way
		if (i == 1) {
			var from = i
			var to = 0
			edges.push({
				from: from.toString(),
				to: to.toString(),
				grp: 'edge0',
			})
			connectionCount[from]++
			connectionCount[to]++
		} else if (i > 1) {
			var conn = edges.length * 2
			var rand = Math.floor(seededRandom() * conn)
			var cum = 0
			var j = 0
			while (j < connectionCount.length && cum < rand) {
				cum += connectionCount[j]
				j++
			}

			from = i
			to = j
			edges.push({
				from: from.toString(),
				to: to.toString(),
				grp: 'edge0',
			})
			connectionCount[from]++
			connectionCount[to]++
		}
	}

	return {
		nodes: nodes,
		edges: edges,
	}
}

var randomSeed = 764 // Math.round(Math.random()*1000);
function seededRandom() {
	var x = Math.sin(randomSeed++) * 10000
	return x - Math.floor(x)
}

/**
 * return a GUID
 */
export function uuidv4() {
	return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
		(c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
	)
}
/**
 * return true if obj has no properties, i.e. is {}
 * @param {Object} obj
 * @returns true or false
 */
export function isEmpty(obj) {
	for (let p in obj) return false
	return true
}
/*
 * Deep merge two or more objects together.
 * (c) 2019 Chris Ferdinandi, MIT License, https://gomakethings.com
 * if two objects have the same property, the value of the second one is used
 * @param   {Object[]}   objects  The objects to merge together
 * @returns {Object}            A new, merged, object
 */
export function deepMerge() {
	// Setup merged object
	let newObj = {}

	// Merge the object into the newObj object
	function merge(obj) {
		for (let prop in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, prop)) {
				// If property is an object, merge properties
				if (Object.prototype.toString.call(obj[prop]) === '[object Object]') {
					newObj[prop] = deepMerge(newObj[prop], obj[prop])
				} else {
					newObj[prop] = obj[prop]
				}
			}
		}
	}

	// Loop through each object and conduct a merge
	for (let i = 0; i < arguments.length; i++) {
		merge(arguments[i])
	}

	return newObj
}

/**
 * returns a deep copy of the object
 * original replaced by new built-in
 * @param {Object} obj
 */
export function deepCopy(obj) {
	/* 	if (typeof obj !== 'object' || obj === null) {
		return obj
	}
	if (obj instanceof Array) {
		return obj.reduce((arr, item, i) => {
			arr[i] = deepCopy(item)
			return arr
		}, [])
	}
	if (obj instanceof Object) {
		return Object.keys(obj).reduce((newObj, key) => {
			newObj[key] = deepCopy(obj[key])
			return newObj
		}, {})
	} */
	return structuredClone(obj)
}
window.deepCopy = deepCopy
/**
 * compare two objects for deep equality
 * fast but doesn't cater for obscure cases
 * adapted from https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
 * @param {Object} x
 * @param {Object} y
 */
export function object_equals(x, y) {
	if (x === y) return true
	// if both x and y are null or undefined and exactly the same

	if (!(x instanceof Object) || !(y instanceof Object)) return false
	// if they are not strictly equal, they both need to be Objects

	if (x.constructor !== y.constructor) return false
	// they must have the exact same prototype chain, the closest we can do is
	// test their constructor.

	for (let p in x) {
		if (!Object.prototype.hasOwnProperty.call(x, p)) continue
		// other properties were tested using x.constructor === y.constructor

		if (!Object.prototype.hasOwnProperty.call(y, p)) return false
		// allows to compare x[ p ] and y[ p ] when set to undefined

		if (x[p] === y[p]) continue
		// if they have the same strict value or identity then they are equal

		if (typeof x[p] !== 'object') return false
		// Numbers, Strings, Functions, Booleans must be strictly equal

		if (!object_equals(x[p], y[p])) return false
		// Objects and Arrays must be tested recursively
	}

	for (let p in y)
		if (Object.prototype.hasOwnProperty.call(y, p) && !Object.prototype.hasOwnProperty.call(x, p)) return false
	// allows x[ p ] to be set to undefined

	return true
}
window.object_equals = object_equals
/**
 * return a copy of an object, with the properties in the object propsToRemove removed
 * @param {Object} source
 * @param {Object} propsToRemove
 */
export function clean(source, propsToRemove) {
	let out = {}
	for (let key in source) {
		if (!(key in propsToRemove)) out[key] = source[key]
	}
	return out
}
/**
 * remove the given properties from all the objects in the array
 * @param {Array} arr array of objects
 * @param {string} propsToRemove
 */
export function cleanArray(arr, propsToRemove) {
	return arr.map((item) => {
		return clean(item, propsToRemove)
	})
}
/**
 * return a copy of an object that only includes the properties that are in allowed
 * @param {Object} obj the object to copy
 * @param {array} allowed list of allowed properties
 */
export function strip(obj, allowed) {
	return allowed.reduce((a, e) => ((a[e] = obj[e]), a), {})
}
/**
 * divide txt into lines to make it roughly square, with a
 * maximum width of width characters, but not breaking words and
 * respecting embedded line breaks (\n).
 * @param {string} txt
 * @param {number} width
 */
export function splitText(txt, width = 10) {
	let lines = ''
	let chunks = txt.trim().split('\n')
	chunks.forEach((chunk) => {
		let words = chunk.trim().split(/\s/)
		let nChars = chunk.trim().length
		if (nChars > 2 * width) width = Math.floor(Math.sqrt(nChars))

		for (let i = 0, linelength = 0; i < words.length; i++) {
			lines += words[i]
			if (i == words.length - 1) break
			linelength += words[i].length
			if (linelength > width) {
				lines += '\n'
				linelength = 0
			} else lines += ' '
		}
		lines += '\n'
	})
	return lines.trim()
}
/**
 * Performs intersection operation between called set and otherSet
 */
Set.prototype.intersection = function (otherSet) {
	let intersectionSet = new Set()
	for (var el of otherSet) if (this.has(el)) intersectionSet.add(el)
	return intersectionSet
}
/**
 * Convert a factor size into a percent (with any size below 30 as zero), for the input range slider
 * @param {Integer} size
 * @returns {Integer} percent
 */
export function factorSizeToPercent(size) {
	let fSize = (size - 20) / 2.5
	return isNaN(fSize) || fSize < 30 ? 0 : fSize
}
/**
 * Set the factor size according to the input range slider value (less then 5% is treated as the normal size)
 * @param {object} node
 * @param {integer} percent
 */
export function setFactorSizeFromPercent(node, percent) {
	if (percent < 5) {
		if (node.widthConstraint?.minimum || node.heightConstraint?.minimum) return
		node.size = 25
		node.heightConstraint = node.widthConstraint = false
	} else {
		node.heightConstraint = node.widthConstraint = node.size = percent * 2.5 + 20
	}
}
/**
 * convert from style object properties to dashed border menu selection
 * @param {any} bDashes select menu value
 * @param {number} bWidth border width
 */
export function getDashes(bDashes, bWidth) {
	if (bWidth === 0) return 'none'
	if (bDashes === false) return 'solid'
	if (bDashes === true) return 'dashed'
	if (Array.isArray(bDashes)) {
		if (bDashes[0] === 10) return 'dashedLinks'
		return 'dots'
	}
	return null
}
/**
 * Convert from dashed menu selection to style object properties
 * @param {string} val
 */
export function convertDashes(val) {
	switch (val) {
		case 'dashed': // dashes [5,15] for node borders
			return true
		case 'dashedLinks': // dashes for links
			return [10, 10]
		case 'solid': // solid
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
 * allow user to drag the element that has a header element that acts as the handle
 * @param {HTMLElement} el
 * @param {HTMLElement} header
 */
export function dragElement(el, header) {
	header.addEventListener('mouseenter', () => (header.style.cursor = 'move'))
	header.addEventListener('mouseout', () => (header.style.cursor = 'auto'))

	let mc = new Hammer.Manager(header, {
		recognizers: [[Hammer.Pan, {direction: Hammer.DIRECTION_ALL, threshold: 0}]],
	})
	// tie in the handler that will be called
	mc.on('pan', handleDrag)

	let lastPosX = 0
	let lastPosY = 0
	let isDragging = false
	let width = 0
	let height = 0

	function handleDrag(ev) {
		// DRAG STARTED
		// here, let's snag the current position
		// and keep track of the fact that we're dragging
		if (!isDragging) {
			isDragging = true
			lastPosX = el.offsetLeft
			lastPosY = el.offsetTop
			width = el.offsetWidth
			height = el.offsetHeight
		}

		// we simply need to determine where the x,y of this
		// object is relative to where it's "last" known position is
		// NOTE:
		//    deltaX and deltaY are cumulative
		// Thus we need to always calculate 'real x and y' relative
		// to the "lastPosX/Y"
		el.style.cursor = 'move'
		let posX = ev.deltaX + lastPosX
		if (posX < 0) posX = 0
		if (posX > window.innerWidth - width) posX = window.innerWidth - width
		let posY = ev.deltaY + lastPosY
		if (posY < 0) posY = 0
		if (posY > window.innerHeight - height) posY = window.innerHeight - height

		// move our element to that position
		el.style.left = posX + 'px'
		el.style.top = posY + 'px'

		// DRAG ENDED
		// this is where we simply forget we are dragging
		if (ev.isFinal) {
			isDragging = false
			el.style.cursor = 'auto'
		}
	}
}
/**
 * Create a context menu that pops up when elem is right clicked
 * @param {HTMLElement} elem click this to get a context menu
 * @param {array} menu array of menu options: ([{label: string, action: function to call when this option selected} {...}])
 */
export function addContextMenu(elem, menu) {
	const menuEl = document.createElement('div')
	menuEl.classList.add('context-menu')
	document.body.appendChild(menuEl)
	elem.addEventListener('contextmenu', (event) => {
		event.preventDefault()
		const {clientX: mouseX, clientY: mouseY} = event
		let posX =
			window.innerWidth - mouseX < menuEl.offsetWidth + 4 ? window.innerWidth - menuEl.offsetWidth - 4 : mouseX
		let posY =
			window.innerHeight - mouseY < menuEl.offsetHeight + 4
				? window.innerHeight - menuEl.offsetHeight - 4
				: mouseY
		menuEl.style.top = `${posY}px`
		menuEl.style.left = `${posX}px`
		menuEl.classList.remove('visible')
		setTimeout(() => {
			menuEl.classList.add('visible')
		})
	})
	document.body.addEventListener('click', () => {
		menuEl.classList.remove('visible')
	})
	menu.forEach((item) => {
		const {label, action} = item
		let option = document.createElement('div')
		option.classList.add('item')
		option.innerHTML = label
		option.addEventListener('click', () => {
			document.body.removeChild(menuEl)
			action()
		})
		option.addEventListener('contextmenu', (event) => event.preventDefault())
		menuEl.appendChild(option)
	})
}

const SEA_CREATURES = Object.freeze([
	'walrus',
	'seal',
	'fish',
	'shark',
	'clam',
	'coral',
	'whale',
	'crab',
	'lobster',
	'starfish',
	'eel',
	'dolphin',
	'squid',
	'jellyfish',
	'ray',
	'shrimp',
	'herring',
	'angler',
	'mackerel',
	'salmon',
	'urchin',
	'anemone',
	'morel',
	'axolotl',
	'blobfish',
	'tubeworm',
	'seabream',
	'seaweed',
	'anchovy',
	'cod',
	'barramundi',
	'carp',
	'crayfish',
	'haddock',
	'hake',
	'octopus',
	'plaice',
	'sardine',
	'skate',
	'sturgeon',
	'swordfish',
	'whelk',
])

const ADJECTIVES = Object.freeze([
	'cute',
	'adorable',
	'lovable',
	'happy',
	'sandy',
	'bubbly',
	'friendly',
	'drifting',
	'huge',
	'big',
	'small',
	'giant',
	'massive',
	'tiny',
	'nippy',
	'odd',
	'perfect',
	'rude',
	'wonderful',
	'agile',
	'beautiful',
	'bossy',
	'candid',
	'carnivorous',
	'clever',
	'cold',
	'cold-blooded',
	'colorful',
	'cuddly',
	'curious',
	'cute',
	'dangerous',
	'deadly',
	'domestic',
	'dominant',
	'energetic',
	'fast',
	'feisty',
	'ferocious',
	'fierce',
	'fluffy',
	'friendly',
	'furry',
	'fuzzy',
	'grumpy',
	'hairy',
	'heavy',
	'herbivorous',
	'jealous',
	'large',
	'lazy',
	'loud',
	'lovable',
	'loving',
	'malicious',
	'maternal',
	'mean',
	'messy',
	'nocturnal',
	'noisy',
	'nosy',
	'picky',
	'playful',
	'poisonous',
	'quick',
	'rough',
	'sassy',
	'scaly',
	'short',
	'shy',
	'slimy',
	'slow',
	'small',
	'smart',
	'smelly',
	'soft',
	'spikey',
	'stinky',
	'strong',
	'stubborn',
	'submissive',
	'tall',
	'tame',
	'tenacious',
	'territorial',
	'tiny',
	'vicious',
	'warm',
	'wild',
])

let colors = [
	'#00ffff',
	'#f0ffff',
	'#f5f5dc',
	'#0000ff',
	'#a52a2a',
	'#00008b',
	'#008b8b',
	'#a9a9a9',
	'#006400',
	'#bdb76b',
	'#8b008b',
	'#556b2f',
	'#ff8c00',
	'#9932cc',
	'#8b0000',
	'#e9967a',
	'#9400d3',
	'#ff00ff',
	'#ffd700',
	'#008000',
	'#4b0082',
	'#f0e68c',
	'#add8e6',
	'#e0ffff',
	'#90ee90',
	'#d3d3d3',
	'#ffb6c1',
	'#ffffe0',
	'#00ff00',
	'#ff00ff',
	'#800000',
	'#000080',
	'#808000',
	'#ffa500',
	'#ffc0cb',
	'#800080',
	'#ff0000',
	'#c0c0c0',
	'#ffff00',
]

const random = (items) => items[(Math.random() * items.length) | 0]

/**
 * Determine whether the RGB color is light or not
 * http://www.w3.org/TR/AERT#color-contrast
 * @param  {number}  r               Red
 * @param  {number}  g               Green
 * @param  {number}  b               Blue
 * @param  {number}  differencePoint
 * @return {boolean}
 */
export const rgbIsLight = (r, g, b, differencePoint = 128) => (r * 299 + g * 587 + b * 114) / 1000 >= differencePoint

/**
 * return a random colour, with a flag to show whether the color is light or dark,
 *  to suggest whether text applied should be white or black
 * @returns {Object} {color: string, isLight: boolean}
 */
function randomColour() {
	const color = random(colors)
	const rgb = color.replace('#', '')
	return {
		color: color,
		isLight: rgbIsLight(
			parseInt(rgb.substring(0, 2), 16),
			parseInt(rgb.substring(2, 4), 16),
			parseInt(rgb.substring(4, 6), 16),
			128,
		),
	}
}

const capitalize = (string) => string[0].toUpperCase() + string.slice(1)

/**
 * return a random fancy name for an avatar, with a random colour
 */
export function generateName() {
	let name = capitalize(random(ADJECTIVES)) + ' ' + capitalize(random(SEA_CREATURES))

	return {
		...randomColour(),
		name: name,
		anon: true,
		asleep: false,
	}
}

/*----------- Status messages ---------------------------------------
 */
/**
 * show status message at the bottom of the window
 * @param {string} msg
 */
export function statusMsg(msg) {
	elem('statusBar').innerHTML = htmlEntities(msg)
}
/**
 * show alert messages at the bottom of the window
 * @param {string} msg
 * @param {string} [status] type of msg - info, warn, error
 * @param {boolean} [dontFade] if true, don't fade the message in and out
 */
export function alertMsg(msg, status, dontFade) {
	let errMsgElement = elem('errMsg')
	switch (status) {
		case 'info':
			errMsgElement.style.backgroundColor = 'black'
			errMsgElement.style.color = 'white'
			break
		case 'warn':
			errMsgElement.style.backgroundColor = '#FFEB3B'
			errMsgElement.style.color = 'black'
			break
		case 'error':
			errMsgElement.style.backgroundColor = 'red'
			errMsgElement.style.color = 'white'
			break
		default:
			console.log('Unknown status in alertMsg: ' + status)
			return
	}
	errMsgElement.innerHTML = msg
	if (dontFade) {
		errMsgElement.style.opacity = 1
	} else {
		listen('errMsg', 'animationend', () => {
			elem('errMsg').classList.remove('fadeInAndOut')
		})
		errMsgElement.classList.add('fadeInAndOut')
	}
}
/**
 * replace special characters with their HTML entity codes
 * @param {string} str
 */
function htmlEntities(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&quot;')
}
/**
 * remove any previous message from the status bar
 */
export function clearStatusBar() {
	statusMsg(' ')
}
/**
 * shorten the label if necessary and add an ellipsis
 * @param {string} label text to shorten
 * @param {number} maxLength if longer than this, cut the excess
 */
const SHORTLABELLEN = 25 // when listing node labels, use ellipsis after this number of chars

export function shorten(label, maxLength = SHORTLABELLEN) {
	return label.length > maxLength ? label.substring(0, maxLength) + '...' : label
}
/**
 * return the initials of the given name as a string: Nigel Gilbert -> NG
 * @param {string} name
 */
export function initials(name) {
	return name
		.replace(/[^A-Za-z0-9À-ÿ ]/gi, '')
		.replace(/ +/gi, ' ')
		.match(/(^\S\S?|\b\S)?/g)
		.join('')
		.match(/(^\S|\S$)?/g)
		.join('')
		.toUpperCase()
}

/**********************************************************colours ************************************************** */

const hiddenOpacity = 0.1
/**
 * set this node to its 'hidden' appearance (very faint), or restore it to its usual appearance
 * @param {object} node
 * @param {boolean} hide
 * @returns {object} node
 */
export function setNodeHidden(node, hide) {
	node.nodeHidden = hide
	node.opacity = hide ? hiddenOpacity : 1.0
	if (node.font.color.charAt(0) === '#') node.font.color = hexToRgba(node.font.color)
	node.font.color = rgba(node.font.color, hide ? hiddenOpacity : 1.0)
	return node
}

/**
 * covert a hex color string such as #123456 to an rgba string
 * @param {string} hex
 * @param {string} alpha
 * @returns string
 */
export function hexToRgba(hex, alpha = 1) {
	hex = hex.replace('#', '')
	if (hex.length === 3)
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('')
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * set this edge to its 'hidden' appearance (very faint), or restore it to its usual appearance
 * @param {object} edge
 * @param {boolean} hide
 * @returns {object} edge
 */
export function setEdgeHidden(edge, hide) {
	edge.edgeHidden = hide
	edge.color.opacity = hide ? hiddenOpacity : 1.0
	if (!edge.font.color) edge.font.color = 'rgba(0,0,0,1)'
	edge.font.color = rgba(edge.font.color, hide ? hiddenOpacity : 1.0)
	return edge
}

/**
 * convert an rgb(a) string to rgba with given alpha value
 */
function rgba(rgb, alpha) {
	if (rgb.indexOf('a') == -1) rgb = rgb.replace('rgb', 'rgba').replace(')', ',0.0)')
	return rgb.replace(/[^,]*$/, ` ${alpha})`)
}
/**
 * return the hex value for the CSS color in str (which may be a color name, e.g. white, or a hex number
 * or any other legal CSS color value)
 * @param {string} str
 */
export function standardize_color(str) {
	if (!str) return '#000000'
	if (str.charAt(0) === '#') return str
	let ctx = document.createElement('canvas').getContext('2d')
	ctx.fillStyle = str
	return ctx.fillStyle
}
/**
 * convert a color string to an array of numbers
 * e.g. 'rgb(255, 0, 0)' -> [255, 0, 0]
 * @param {string} rgb
 * @returns {array} array of numbers
 */
export function rgbToArray(rgb) {
	let values = rgb.slice(rgb.indexOf('(') + 1, rgb.indexOf(')')).split(',')
	return values.map((value) => {
		return parseInt(value)
	})
}

/**
 * return the inverse/complementary colour
 * @param {string} color as a hex string
 * @returns hex string
 */
export function invertColor(color) {
	return '#' + ('000000' + (0xffffff ^ parseInt(color.substring(1), 16)).toString(16)).slice(-6)
}

/**
 * closure to generate a sequence of colours (as rgb strings, e.g. 'rgb(246,121,16)')
 * based on https://krazydad.com/tutorials/makecolors.php
 */
export const makeColor = (function () {
	let counter = 0
	let freq = 0.3,
		phase1 = 0,
		phase2 = 2,
		phase3 = 4,
		center = 128,
		width = 127
	return function () {
		counter += 1
		let red = Math.sin(freq * counter + phase1) * width + center
		let grn = Math.sin(freq * counter + phase2) * width + center
		let blu = Math.sin(freq * counter + phase3) * width + center
		return 'rgb(' + Math.round(red) + ',' + Math.round(grn) + ',' + Math.round(blu) + ')'
	}
})()

window.makeColor = makeColor
/**
 * Determine whether a color is light or dark (so text in a contrasting color can be overlaid)
 * from https://awik.io/determine-color-bright-dark-using-javascript/
 * @param {string} color
 * @returns 'light' or 'dark'
 */
export function lightOrDark(color) {
	// Variables for red, green, blue values
	let r, g, b, hsp

	// Check the format of the color, HEX or RGB?
	if (color.match(/^rgb/)) {
		// If RGB --> store the red, green, blue values in separate variables
		color = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/)

		r = color[1]
		g = color[2]
		b = color[3]
	} else {
		// If hex --> Convert it to RGB: http://gist.github.com/983661
		color = +('0x' + color.slice(1).replace(color.length < 5 && /./g, '$&$&'))

		r = color >> 16
		g = (color >> 8) & 255
		b = color & 255
	}

	// HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
	hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b))

	// Using the HSP value, determine whether the color is light or dark
	if (hsp > 127.5) {
		return 'light'
	} else {
		return 'dark'
	}
}

/* --------------------color picker -----------------------------*/

export class CP {
	constructor() {
		this.container = document.createElement('div')
		this.container.className = 'color-picker-container'
		this.container.id = 'colorPicker'
		let controls = document.createElement('div')
		controls.id = 'colorPickerControls'
		this.container.appendChild(controls)
		document.querySelector('body').insertAdjacentElement('beforeend', this.container)

		// see https://iro.js.org/guide.html#getting-started
		this.colorPicker = new iro.ColorPicker('#colorPickerControls', {
			width: 160,
			color: 'rgba(255, 255, 255, 1)',
			borderWidth: 1,
			borderColor: 'rgba(255, 255, 255,1)',
			margin: 6,
			layout: [
				{
					component: iro.ui.Wheel,
					options: {
						borderColor: '#ffffff',
					},
				},
				{
					component: iro.ui.Slider,
					options: {
						borderColor: '#000000',
						sliderType: 'value',
						padding: 2,
						handleRadius: 4,
					},
				},
				{
					component: iro.ui.Slider,
					options: {
						borderColor: '#000000',
						sliderType: 'alpha',
						padding: 2,
						handleRadius: 4,
					},
				},
			],
		})

		// set up a grid of squares to hold last 8 selected colors
		this.colorCache = document.createElement('div')
		this.colorCache.id = 'colorCache'
		this.colorCache.className = 'color-cache'
		for (let i = 0; i < 8; i++) {
			let c = document.createElement('div')
			c.id = 'color' + i
			c.className = 'cached-color'
			// prefill with standard colours
			c.style.backgroundColor = [
				'rgba(255, 0, 0,1)',
				'rgba(0, 255, 0,1)',
				'rgb(0, 0, 255)',
				'rgba(255, 255, 0,1)',
				'rgb(255, 255, 255)',
				'rgba(0, 0, 0,1)',
				'rgba(154, 219, 180,1)',
				'rgba(219, 110, 103,1)',
			][i]
			c.addEventListener('click', (e) => {
				let color = e.target.style.backgroundColor
				if (color) this.colorPicker.color.rgbaString = e.target.style.backgroundColor
			})
			this.colorCache.appendChild(c)
		}
		document.getElementById('colorPickerControls').insertAdjacentElement('afterend', this.colorCache)
	}

	/**
	 * attach a color picker to an element to recolor the background to that element
	 * @param {string} wellId the id of the DOM element to attach the color picker to
	 * @param {string} callback - function to call when the color has been chosen, with that color as argument
	 */
	createColorPicker(wellId, callback, onChange) {
		let well = elem(wellId)
		well.style.backgroundColor = '#ffffff'
		// add listener to display picker when well clicked
		well.addEventListener('click', (event) => {
			this.container.style.display = 'block'
			let netPane = elem('net-pane').getBoundingClientRect()
			// locate picker so it does not go outside netPane
			let top = event.clientY + well.offsetHeight + 10
			if (top > netPane.bottom - this.container.offsetHeight)
				top = netPane.bottom - this.container.offsetHeight - 10
			if (top < netPane.top) top = netPane.top + 10
			let left = event.clientX - this.container.offsetWidth / 2
			if (left < netPane.left) left = netPane.left + 10
			if (left > netPane.right - this.container.offsetWidth)
				left = netPane.right - this.container.offsetWidth - 10
			this.container.style.top = `${top}px`
			this.container.style.left = `${left}px`
			this.container.well = well
			this.container.callback = callback
			this.container.onChange = onChange
			this.colorPicker.color.rgbaString = well.style.backgroundColor
			this.onclose = this.closeColorPicker.bind(this)
			document.addEventListener('click', this.onclose, true)

			// update well as color is changed
			this.colorPicker.on('color:change', (color) => {
				well.style.backgroundColor = color.rgbaString
				if (onChange) onChange()
			})
		})
	}
	/**
	 * Report chosen colour when user clicks outside of picker (and well)
	 * Hide the picker and save the colour choice in the previously selected colour grid
	 * @param {event} event
	 */
	closeColorPicker(event) {
		if (!(this.container.contains(event.target) || this.container.well.contains(event.target))) {
			this.container.style.display = 'none'
			document.removeEventListener('click', this.onclose, true)
			let color = this.container.well.style.backgroundColor
			// save the chosen color for future selection if it is not already there
			this.saveColor(color)

			let callback = this.container.callback
			if (callback) callback(color)
			this.colorPicker.off('color:change')
		}
	}
	/**
	 * Save the color in the previously selected colour grid, if not already saved
	 * into a free slot, or if there isn't one shift the current colours to the left
	 * and save the new at the right end
	 * @param {string} color
	 */
	saveColor(color) {
		let saveds = this.colorCache.children
		for (let i = 0; i < 8; i++) {
			if (saveds[i].style.backgroundColor == color) return
		}
		for (let i = 0; i < 8; i++) {
			if (saveds[i].style.backgroundColor == '') {
				saveds[i].style.backgroundColor = color
				return
			}
		}
		for (let i = 0, j = 1; j < 8; i++, j++) {
			saveds[i].style.backgroundColor = saveds[j].style.backgroundColor
		}
		saveds[7].style.backgroundColor = color
	}
}

/********************************************************************** text ************************************************ */
/**
 * Returns a nicely formatted Date (or time if the date is today), given a Time value (from Date() )
 * @param {number} utc
 * @param {boolean} full - if true, don't use Today in date
 */
export function timeAndDate(utc, full = false) {
	let time = new Date()
	time.setTime(utc)
	if (!full && time.toDateString() == new Date().toDateString()) {
		// return Today, 12:34
		return (
			'Today, ' +
			time.toLocaleString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
			})
		)
	}
	if (!full && time.getFullYear() == new Date().getFullYear()) {
		// return 12 Sept, 12:34
		return time.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		})
	}
	// return 12 Sep 2023, 12:34
	return time
		.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
		.replace('Sept', 'Sep')
}
/**
 * positions the caret at the end of text in a contenteditable div
 * @param {*} contentEditableElement
 */
export function setEndOfContenteditable(contentEditableElement) {
	let range = document.createRange() //Create a range (a range is a like the selection but invisible)
	range.selectNodeContents(contentEditableElement) //Select the entire contents of the element with the range
	range.collapse(false) //collapse the range to the end point. false means collapse to end rather than the start
	let selection = window.getSelection() //get the selection object (allows you to change selection)
	selection.removeAllRanges() //remove any selections already made
	selection.addRange(range) //make the range you have just created the visible selection
}

/**
 * @returns a string with current time to the nearest millisecond
 */
export function exactTime(time) {
	let d = time ? new Date(time) : new Date()
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `
}

export function capitalizeFirstLetter(string) {
	return string ? string.charAt(0).toUpperCase() + string.slice(1) : ''
}
export function lowerFirstLetter(string) {
	return string ? string.charAt(0).toLowerCase() + string.slice(1) : ''
}
/**
 * convert a number of bytes to a human-readable string
 * @param {number} bytes integer to convert
 * @param {boolean} isDecimal use base 10 (true) or base 2 (false)
 * @returns {string} e.g. humanSize(1929637) => 1.9MB
 */
export function humanSize(bytes, isDecimal = true) {
	if (bytes === 0) return '0B'

	const decimalUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
	const binaryUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

	const base = isDecimal ? 1000 : 1024
	const units = isDecimal ? decimalUnits : binaryUnits

	const i = Math.floor(Math.log(bytes) / Math.log(base))
	const size = bytes / Math.pow(base, i)

	const formatted = size % 1 === 0 ? size.toString() : size.toFixed(1)
	return `${formatted}${units[i]}`
}
/**
 * test whether the editor has any content
 * (could be an empty string or a Quill insert operation of just a single newline character)
 * @param {object} quill editor
 * @returns boolean
 */
export function isQuillEmpty(quill) {
	if ((quill.getContents()['ops'] || []).length !== 1) {
		return false
	}
	return quill.getText().trim().length === 0
}
/**
 * Replace all \n, \r with a space
 * @param {string} str
 * @returns string
 */
export function stripNL(str) {
	return str.replace(/\r?\n|\r/g, ' ')
}

/**
 * encode characters such as & to HTML entities such as &amp; to
 * make the string XML compliant. Only deals with common entities.
 * @param {string} text
 * @returns string
 */
export function encodeHTMLEntities(text) {
	return text.replace(
		/[&<>"']/g,
		(match) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[match],
	)
}

/**
 * display help page in a separate window
 */
export function displayHelp() {
	window.open(MANUALURL, 'helpWindow')
}
/**
 * remove any crud in Local storage
 * @param {*} preserve - list of items in local storage to keep
 */
export async function cleanLocalStorage(preserve = ['doneIntro', 'seenWN', 'myName', 'recents']) {
	// remove all local storage items that are not in the list
	let keys = Object.keys(localStorage)
	keys.forEach((key) => {
		if (!preserve.includes(key)) localStorage.removeItem(key)
	})
	// remove all IndexDB databases (we don't use them any more) except localforage
	indexedDB.databases().then((dbs) =>
		dbs.forEach((db) => {
			if (db.name !== 'localforage') indexedDB.deleteDatabase(db.name)
		}),
	)
}
