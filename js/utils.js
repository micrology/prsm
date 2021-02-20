import * as Hammer from '@egjs/hammerjs';

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
	// test there constructor.

	for (var p in x) {
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

	for (p in y)
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
]);

const COLORS = Object.freeze([
	'hotpink',
	'red',
	'lightblue',
	'fuchsia',
	'green',
	'lime',
	'olive',
	'darkorange',
	'chartreuse',
	'teal',
	'aqua',
	'orange',
	'beige',
	'gainsboro',
	'cadetblue',
	'coral',
	'gold',
]);

const random = (items) => items[(Math.random() * items.length) | 0];

const capitalize = (string) => string[0].toUpperCase() + string.slice(1);
/**
 * return a random fancy name for an avatar, with a random colour
 */
export function generateName() {
	return {
		color: random(COLORS),
		name:
			capitalize(random(ADJECTIVES)) +
			' ' +
			capitalize(random(SEA_CREATURES)),
		anon: true,
		asleep: false,
	};
}
/**
 * Set up a contenteditable <div> to have a placeholder that disappears when text is written into it
 * @param {CSSselector} selector
 */
export function divWithPlaceHolder(selector) {
	const editable = document.querySelector(selector);
	const placeholder = `<span class="placeholder">${editable.dataset.placeholder}</span>`;
	// add placeholder on load
	editable.innerHTML = placeholder;
	editable.addEventListener('keyup', () => {
		if (editable.innerText.length == 0) editable.innerHTML = placeholder;
	});
	editable.addEventListener('keydown', () => {
		if (editable.innerHTML == placeholder) editable.innerHTML = '';
	});
	editable.addEventListener('focus', () => {
		if (editable.innerText.length == 0) editable.innerHTML = placeholder;
		if (editable.innerHTML == placeholder) editable.innerHTML = '';
	});
}
