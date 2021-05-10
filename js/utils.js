import * as Hammer from '@egjs/hammerjs';
import iro from '@jaames/iro';
import uniqolor from 'uniqolor';
/**
 * attach an event listener
 *
 * @param {string} elem - id of the element on which to hand the event listener
 * @param {string} event
 * @param {function} callback
 */
export function listen(id, event, callback) {
	elem(id).addEventListener(event, callback);
}

/**
 * return the HTML element with the id
 * @param {string} id
 */
export function elem(id) {
	return document.getElementById(id);
}

/**
 * Create a random scale free network, used only for testing and demoing
 * Taken from the vis-network distribution
 *
 * Created by Alex on 5/20/2015.
 */
export function getScaleFreeNetwork(nodeCount) {
	var nodes = [];
	var edges = [];
	var connectionCount = [];

	// randomly create some nodes and edges
	for (var i = 0; i < nodeCount; i++) {
		nodes.push({
			id: String(i),
			label: String(i),
			value: 1,
		});

		connectionCount[i] = 0;

		// create edges in a scale-free-network way
		if (i == 1) {
			var from = i;
			var to = 0;
			edges.push({
				from: from.toString(),
				to: to.toString(),
			});
			connectionCount[from]++;
			connectionCount[to]++;
		} else if (i > 1) {
			var conn = edges.length * 2;
			var rand = Math.floor(seededRandom() * conn);
			var cum = 0;
			var j = 0;
			while (j < connectionCount.length && cum < rand) {
				cum += connectionCount[j];
				j++;
			}

			from = i;
			to = j;
			edges.push({
				from: from.toString(),
				to: to.toString(),
			});
			connectionCount[from]++;
			connectionCount[to]++;
		}
	}

	return {
		nodes: nodes,
		edges: edges,
	};
}

var randomSeed = 764; // Math.round(Math.random()*1000);
function seededRandom() {
	var x = Math.sin(randomSeed++) * 10000;
	return x - Math.floor(x);
}

/**
 * return a GUID
 */
export function uuidv4() {
	return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
		(
			c ^
			(crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
		).toString(16)
	);
}

/*!
 * Deep merge two or more objects together.
 * (c) 2019 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param   {Object}   objects  The objects to merge together
 * @returns {Object}            A new, merged, object
 */
export function deepMerge() {
	// Setup merged object
	let newObj = {};

	// Merge the object into the newObj object
	function merge(obj) {
		for (let prop in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, prop)) {
				// If property is an object, merge properties
				if (
					Object.prototype.toString.call(obj[prop]) ===
					'[object Object]'
				) {
					newObj[prop] = deepMerge(newObj[prop], obj[prop]);
				} else {
					newObj[prop] = obj[prop];
				}
			}
		}
	}

	// Loop through each object and conduct a merge
	for (let i = 0; i < arguments.length; i++) {
		merge(arguments[i]);
	}

	return newObj;
}

/**
 * returns a deep copy of the object
 * @param {Object} obj
 */
export function deepCopy(obj) {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}
	if (obj instanceof Array) {
		return obj.reduce((arr, item, i) => {
			arr[i] = deepCopy(item);
			return arr;
		}, []);
	}
	if (obj instanceof Object) {
		return Object.keys(obj).reduce((newObj, key) => {
			newObj[key] = deepCopy(obj[key]);
			return newObj;
		}, {});
	}
}
window.deepCopy = deepCopy;
/**
 * compare two objects for deep equality
 * fast but doesn't cater for obscure cases
 * adapted from https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
 * @param {Object} x
 * @param {Object} y
 */
export function object_equals(x, y) {
	if (x === y) return true;
	// if both x and y are null or undefined and exactly the same

	if (!(x instanceof Object) || !(y instanceof Object)) return false;
	// if they are not strictly equal, they both need to be Objects

	if (x.constructor !== y.constructor) return false;
	// they must have the exact same prototype chain, the closest we can do is
	// test their constructor.

	for (let p in x) {
		if (!Object.prototype.hasOwnProperty.call(x, p)) continue;
		// other properties were tested using x.constructor === y.constructor

		if (!Object.prototype.hasOwnProperty.call(y, p)) return false;
		// allows to compare x[ p ] and y[ p ] when set to undefined

		if (x[p] === y[p]) continue;
		// if they have the same strict value or identity then they are equal

		if (typeof x[p] !== 'object') return false;
		// Numbers, Strings, Functions, Booleans must be strictly equal

		if (!object_equals(x[p], y[p])) return false;
		// Objects and Arrays must be tested recursively
	}

	for (let p in y)
		if (
			Object.prototype.hasOwnProperty.call(y, p) &&
			!Object.prototype.hasOwnProperty.call(x, p)
		)
			return false;
	// allows x[ p ] to be set to undefined

	return true;
}
/**
 * return a copy of an object, with the properties in the object propsToRemove removed
 * @param {Object} source
 * @param {Object} propsToRemove
 */
export function clean(source, propsToRemove) {
	let out = {};
	for (let key in source) {
		if (!(key in propsToRemove)) out[key] = source[key];
	}
	return out;
}
/**
 * remove the given properties from all the objects in the array
 * @param {Array} arr array of objects
 * @param {string} propsToRemove
 */
export function cleanArray(arr, propsToRemove) {
	return arr.map((item) => {
		return clean(item, propsToRemove);
	});
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
	);
}
/**
 * divide txt into lines to make it roughly square, with a
 * maximum width of width characters, but not breaking words and
 * respecting embedded line breaks (\n).
 * @param {string} txt
 * @param {integer} width
 */
export function splitText(txt, width) {
	let lines = '';
	let chunks = txt.trim().split('\n');
	chunks.forEach((chunk) => {
		let words = chunk.trim().split(/\s/);
		let nChars = chunk.trim().length;
		if (nChars > 2 * width) width = Math.floor(Math.sqrt(nChars));

		for (let i = 0, linelength = 0; i < words.length; i++) {
			lines += words[i];
			if (i == words.length - 1) break;
			linelength += words[i].length;
			if (linelength > width) {
				lines += '\n';
				linelength = 0;
			} else lines += ' ';
		}
		lines += '\n';
	});
	return lines.trim();
}
/**
 * Performs intersection operation between called set and otherSet
 */
Set.prototype.intersection = function (otherSet) {
	let intersectionSet = new Set();
	for (var elem of otherSet) if (this.has(elem)) intersectionSet.add(elem);
	return intersectionSet;
};
/**
 * allow user to drag the elem that has a header element that acts as the handle
 * @param {HTMLelement} elem
 * @param {HTMLelement} header
 */
export function dragElement(elem, header) {
	header.addEventListener('mouseenter', () => (header.style.cursor = 'move'));
	header.addEventListener('mouseout', () => (header.style.cursor = 'auto'));

	let mc = new Hammer.Manager(header, {
		recognizers: [
			[Hammer.Pan, {direction: Hammer.DIRECTION_ALL, threshold: 0}],
		],
	});
	// tie in the handler that will be called
	mc.on('pan', handleDrag);

	let lastPosX = 0;
	let lastPosY = 0;
	let isDragging = false;

	function handleDrag(ev) {
		// DRAG STARTED
		// here, let's snag the current position
		// and keep track of the fact that we're dragging
		if (!isDragging) {
			isDragging = true;
			lastPosX = elem.offsetLeft;
			lastPosY = elem.offsetTop;
		}

		// we simply need to determine where the x,y of this
		// object is relative to where it's "last" known position is
		// NOTE:
		//    deltaX and deltaY are cumulative
		// Thus we need to always calculate 'real x and y' relative
		// to the "lastPosX/Y"
		elem.style.cursor = 'move';
		let posX = ev.deltaX + lastPosX;
		let posY = ev.deltaY + lastPosY;

		// move our element to that position
		elem.style.left = posX + 'px';
		elem.style.top = posY + 'px';

		// DRAG ENDED
		// this is where we simply forget we are dragging
		if (ev.isFinal) {
			isDragging = false;
			elem.style.cursor = 'auto';
		}
	}
}
/**
 * return the hex value for the CSS color in str (which may be a color name, e.g. white, or a hex number
 * or any other legal CSS color value)
 * @param {string} str
 */
export function standardize_color(str) {
	let ctx = document.createElement('canvas').getContext('2d');
	ctx.fillStyle = str;
	return ctx.fillStyle;
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
]);

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
]);

const random = (items) => items[(Math.random() * items.length) | 0];

const capitalize = (string) => string[0].toUpperCase() + string.slice(1);
/**
 * return a random fancy name for an avatar, with a random colour
 */
export function generateName() {
	let name = capitalize(random(ADJECTIVES)) +
	' ' +
	capitalize(random(SEA_CREATURES));

	return {
		... uniqolor(name , { saturation: 95, lightness: 60 }),
		name: name,
		anon: true,
		asleep: false,
	};
}
/*----------- Status messages ---------------------------------------
 */
/**
 * show status messages at the bottom of the window
 * @param {string} msg
 * @param {string} status type of msg - warning, error or other
 */
export function statusMsg(msg, status) {
	let el = elem('statusBar');
	switch (status) {
		case 'warn':
			el.style.backgroundColor = 'yellow';
			break;
		case 'error':
			el.style.backgroundColor = 'red';
			el.style.color = 'white';
			break;
		default:
			el.style.backgroundColor = 'white';
			break;
	}
	el.innerHTML = htmlEntities(msg);
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
		.replace(/'/g, '&quot;');
}
/**
 * remove any previous message from the status bar
 */
export function clearStatusBar() {
	statusMsg(' ');
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
		.toUpperCase();
}
/* --------------------color picker -----------------------------*/

export class CP {
	constructor() {
		this.container = document.createElement('div');
		this.container.className = 'color-picker-container';
		this.container.id = 'colorPicker';
		let controls = document.createElement('div');
		controls.id = 'colorPickerControls';
		this.container.appendChild(controls);
		document
			.querySelector('body')
			.insertAdjacentElement('beforeend', this.container);

		// see https://iro.js.org/guide.html#getting-started
		this.colorPicker = new iro.ColorPicker('#colorPickerControls', {
			width: 160,
			color: 'rgb(255, 255, 255)',
			borderWidth: 1,
			borderColor: '#fff',
			margin: 0,
		});

		// set up a grid of squares to hold last 8 selected colors
		this.colorCache = document.createElement('div');
		this.colorCache.id = 'colorCache';
		this.colorCache.className = 'color-cache';
		for (let i = 0; i < 8; i++) {
			let c = document.createElement('div');
			c.id = 'color' + i;
			c.className = 'cached-color';
			// prefill with standard colours
			c.style.backgroundColor = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffffff', '#000000', '#9ADBB4', '#DB6E67'][i];
			c.addEventListener('click', (e) => {
				let color = e.target.style.backgroundColor;
				if (color.search('rgb') != -1)
					this.colorPicker.color.rgbString =
						e.target.style.backgroundColor;
			});
			this.colorCache.appendChild(c);
		}
		document
			.getElementById('colorPickerControls')
			.insertAdjacentElement('afterend', this.colorCache);
	}

	/**
	 * attach a color picker to an element to recolor the background to that element
	 * @param {string} wellId the id of the DOM element to attach the color picker to
	 * @param {string} callback - function to call when the color has been chosen, with that color as argument
	 */
	createColorPicker(wellId, callback) {
		let well = elem(wellId);
		well.style.backgroundColor = '#ffffff';
		// add listener to display picker when well clicked
		well.addEventListener('click', (event) => {
			this.container.style.display = 'block';
			let netPane = elem('net-pane').getBoundingClientRect();
			// locate picker so it does not go outside netPane
			let top = event.clientY + well.offsetHeight + 10;
			if (top > netPane.bottom - this.container.offsetHeight)
				top = netPane.bottom - this.container.offsetHeight - 10;
			if (top < netPane.top) top = netPane.top + 10;
			let left = event.clientX;
			if (left < netPane.left) left = netPane.left + 10;
			if (left > netPane.right - this.container.offsetWidth)
				left = netPane.right - this.container.offsetWidth - 10;
			this.container.style.top = `${top}px`;
			this.container.style.left = `${left}px`;
			this.container.well = well;
			this.container.callback = callback;
			this.colorPicker.color.rgbString = well.style.backgroundColor;
			this.onclose = this.closeColorPicker.bind(this);
			document.addEventListener('click', this.onclose, true);

			// update well as color is changed
			this.colorPicker.on(['color:change'], function (color) {
				elem('colorPicker').well.style.backgroundColor =
					color.rgbString;
			});
		});
	}
	/**
	 * Report chosen colour when user clicks outside of picker (and well)
	 * Hide the picker and save the colour choice in the previously selected colour grid
	 * @param {event} event
	 */
	closeColorPicker(event) {
		if (
			!(
				this.container.contains(event.target) ||
				this.container.well.contains(event.target)
			)
		) {
			this.container.style.display = 'none';
			document.removeEventListener('click', this.onclose, true);
			let color = this.container.well.style.backgroundColor;
			// save the chosen color for future selection if it is not already there
			this.saveColor(color);

			let callback = this.container.callback;
			if (callback) callback(color);
		}
	}
	/**
	 * Save the color in the previously selected colour grid, if not already saved
	 * into a free slot, or if there isn't one shift the current colours to the left
	 * and save the new at the right end
	 * @param {color} color 
	 */
	saveColor(color) {
		let saveds = this.colorCache.children;
		for (let i = 0; i < 8; i++) {
			if (saveds[i].style.backgroundColor == color) return;
		}
		for (let i = 0; i < 8; i++) {
			if (saveds[i].style.backgroundColor == "") {
				saveds[i].style.backgroundColor = color;
				return;
			}
		}
		for (let i = 0, j = 1; j < 8; i++, j++) {
			saveds[i].style.backgroundColor = saveds[j].style.backgroundColor
		}
		saveds[7].style.backgroundColor = color;
		}
}

/**
 * Returns a nicely formatted Date (or time if the date is today), given a Time value (from Date() )
 * @param {Integer} utc
 */
export function timeAndDate(utc) {
	let time = new Date();
	time.setTime(utc);
	if (time.toDateString() == new Date().toDateString()) {
		return (
			'Today, ' +
			time.toLocaleString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
			})
		);
	} else {
		return time.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
}
