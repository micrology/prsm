import * as Hammer from '@egjs/hammerjs'
import iro from '@jaames/iro'
import uniqolor from 'uniqolor'
/**
 * attach an event listener
 *
 * @param {string} id - id of the element on which to hand the event listener
 * @param {string} event
 * @param {function} callback
 */
export function listen(id, event, callback) {
	elem(id).addEventListener(event, callback)
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
		(c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
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
 * @param   {Object}   objects  The objects to merge together
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
 * @param {Object} obj
 */
export function deepCopy(obj) {
	if (typeof obj !== 'object' || obj === null) {
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
	}
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
 * @param {Object} allowed the object with allowed properties
 */
export function strip(obj, allowed) {
	return Object.fromEntries(
		Object.entries(obj).filter(
			([key, val]) => allowed.includes(key) // eslint-disable-line no-unused-vars
		)
	)
}
/**
 * divide txt into lines to make it roughly square, with a
 * maximum width of width characters, but not breaking words and
 * respecting embedded line breaks (\n).
 * @param {string} txt
 * @param {number} width
 */
export function splitText(txt, width) {
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

const random = (items) => items[(Math.random() * items.length) | 0]

const capitalize = (string) => string[0].toUpperCase() + string.slice(1)
/**
 * return a random fancy name for an avatar, with a random colour
 */
export function generateName() {
	let name = capitalize(random(ADJECTIVES)) + ' ' + capitalize(random(SEA_CREATURES))

	return {
		...uniqolor(name, {saturation: 95, lightness: 60}),
		name: name,
		anon: true,
		asleep: false,
	}
}
/*----------- Status messages ---------------------------------------
 */
/**
 * show status messages at the bottom of the window
 * @param {string} msg
 * @param {string} [status] type of msg - warning, error or other
 */
export function statusMsg(msg, status) {
	let el = elem('statusBar')
	switch (status) {
		case 'warn':
			el.style.backgroundColor = 'yellow'
			break
		case 'error':
			el.style.backgroundColor = 'red'
			el.style.color = 'white'
			break
		default:
			el.style.backgroundColor = 'white'
			break
	}
	el.innerHTML = htmlEntities(msg)
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

/**
 * Convert #xxyyzz to rgb(aa,bb,cc)
 * @param {String} hex 
 * @returns String
 */
 /* function hex2rgb(hex) {
	return (
		'rgb(' + [('0x' + hex[1] + hex[2]) | 0, ('0x' + hex[3] + hex[4]) | 0, ('0x' + hex[5] + hex[6]) | 0].join() + ')'
	)
} */
/**
 * Convert rgb(aa,bb,cc) to #xxyyzz
 * @param {String} str 
 * @returns String
 */
function rgbToHex(str) {
	if (~str.indexOf('#')) return str
	str = str.replace(/[^\d,]/g, '').split(',')
	return '#' + ((1 << 24) + (+str[0] << 16) + (+str[1] << 8) + +str[2]).toString(16).slice(1)
}

/**
 * return the hex value for the CSS color in str (which may be a color name, e.g. white, or a hex number
 * or any other legal CSS color value)
 * @param {string} str
 */
 export function standardize_color(str) {
	if (str.charAt(0) === '#') return str
	let ctx = document.createElement('canvas').getContext('2d')
	ctx.fillStyle = str
	return ctx.fillStyle
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
			color: '#ffffff',
			borderWidth: 1,
			borderColor: '#ffffff',
			margin: 0,
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
				'#ff0000',
				'#00ff00',
				'#0000ff',
				'#ffff00',
				'#ffffff',
				'#000000',
				'#9ADBB4',
				'#DB6E67',
			][i]
			c.addEventListener('click', (e) => {
				let color = e.target.style.backgroundColor
				if (color) this.colorPicker.color.hexString = rgbToHex(e.target.style.backgroundColor)
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
	createColorPicker(wellId, callback) {
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
			let left = event.clientX
			if (left < netPane.left) left = netPane.left + 10
			if (left > netPane.right - this.container.offsetWidth)
				left = netPane.right - this.container.offsetWidth - 10
			this.container.style.top = `${top}px`
			this.container.style.left = `${left}px`
			this.container.well = well
			this.container.callback = callback
			this.colorPicker.color.hexString = rgbToHex(well.style.backgroundColor)
			this.onclose = this.closeColorPicker.bind(this)
			document.addEventListener('click', this.onclose, true)

			// update well as color is changed
			this.colorPicker.on(['color:change'], function (color) {
				elem('colorPicker').well.style.backgroundColor = color.hexString
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

/**
 * Returns a nicely formatted Date (or time if the date is today), given a Time value (from Date() )
 * @param {number} utc
 * @param {boolean} full - if true, don't use Today in date
 */
export function timeAndDate(utc, full = false) {
	let time = new Date()
	time.setTime(utc)
	if (!full && time.toDateString() == new Date().toDateString()) {
		return (
			'Today, ' +
			time.toLocaleString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
			})
		)
	} else {
		return time.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		})
	}
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
export function exactTime() {
	let d = new Date()
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `
}
