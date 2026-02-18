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


This module does trophic layout.  
 ******************************************************************************************************************** */

/*
translation of the Trophic Levels algorithm to javascript

NG 18 December 2020

*/

/* simple minded adjacency matrix manipulation functions.
 * They generally assume that the matrix is square (no checks are done
 * that they are).
 * Assumes all weights are unity (TODO: allow weighted edges)
 * Matrix data structure is just an array of arrays
 */

import { NLEVELS } from "./prsm.js"
/**
 * convert a directed adjacency matrix to an undirected one
 * mirror the elements above the leading diagonal to below it
 * @param {array[]} a
 * @returns {array[]} a copy of a
 */
function undirected(a) {
	const b = Array(a.length)
	for (let i = 0; i < a.length; i++) {
		b[i] = new Array(a.length)
		b[i][i] = a[i][i]
	}
	for (let i = 0; i < a.length; i++) {
		for (let j = i + 1; j < a.length; j++) {
			if (a[i][j] || a[j][i]) {
				b[i][j] = 1
				b[j][i] = 1
			} else {
				b[i][j] = 0
				b[j][i] = 0
			}
		}
	}
	return b
}
/**
 * check that all nodes are connected to at least one other node
 * i.e. every row includes at least one 1
 * @param {array[]} a
 */
function connected(a) {
	for (let i = 0; i < a.length; i++) {
		let nonzero = false
		for (let j = 0; j < a.length; j++) {
			if (a[i][j] !== 0) {
				nonzero = true
				break
			}
		}
		if (!nonzero) return false
	}
	return true
}
/**
 * swap cell values across the leading diagonal
 * @param {array[]} a
 * @returns {array[]} a transposed copy of a
 */
function transpose(a) {
	const b = new Array(a.length)
	for (let i = 0; i < a.length; i++) {
		b[i] = new Array(a.length)
		for (let j = 0; j < a.length; j++) b[i][j] = a[j][i]
	}
	return b
}
/**
 * return a vector of the number of edges out of a node
 * @param {array[]} a
 * @returns {array}
 */
/* eslint-disable camelcase */
function out_degree(a) {
	const v = new Array(a.length)
	for (let row = 0; row < a.length; row++) v[row] = sumVec(a[row])
	return v
}
/**
 * return a vector of the number of edges into a node
 * @param {array[]} a
 * @returns {array}
 */
function in_degree(a) {
	return out_degree(transpose(a))
}
/* eslint-enable camelcase */
/**
 * returns the summation of the values in the vector
 * @param {array} v
 * @returns {number}
 */
function sumVec(v) {
	let sum = 0
	for (let i = 0; i < v.length; i++) sum += v[i]
	return sum
}
/**
 * v1 - v2
 * @param {array} v1
 * @param {array} v2
 * @returns {array}
 */
function subVec(v1, v2) {
	const res = new Array(v1.length)
	for (let i = 0; i < v1.length; i++) res[i] = v1[i] - v2[i]
	return res
}
/**
 * v1 + v2
 * @param {array} v1
 * @param {array} v2
 * @returns {array}
 */
function addVec(v1, v2) {
	const res = new Array(v1.length)
	for (let i = 0; i < v1.length; i++) res[i] = v1[i] + v2[i]
	return res
}
/**
 * subtract matrix b from a
 * @param {array[]} a
 * @param {array[]} b
 */
function subtract(a, b) {
	const c = new Array(a.length)
	for (let i = 0; i < a.length; i++) {
		c[i] = subVec(a[i], b[i])
	}
	return c
}
/**
 * Add matrix a to its transpose, but normalise the cell values resulting to 0/1
 * @param {array[]} a
 * @returns {array[]} a copy of the result
 */
function mergeTranspose(a) {
	const b = transpose(a)
	for (let i = 0; i < a.length; i++) {
		for (let j = 0; j < a.length; j++) if (a[i][j] > 0) b[i][j] = 1
	}
	return b
}
/**
 * create a new matrix of size n, with all cells zero
 * @param {number} n
 */
function zero(n) {
	const b = new Array(n)
	for (let i = 0; i < n; i++) {
		b[i] = new Array(n).fill(0)
	}
	return b
}
/**
 * create a zero matrix with v as the leading diagonal
 * @param {array} v
 * @returns {array[]}
 */
function diag(v) {
	const b = zero(v.length)
	for (let i = 0; i < v.length; i++) {
		b[i][i] = v[i]
	}
	return b
}
/**
 * subtract the minimum value of any cell from each cell of the vector
 * @param {array} v
 */
function rebase(v) {
	const min = Math.min(...v)
	const res = new Array(v.length)
	for (let i = 0; i < v.length; i++) res[i] = v[i] - min
	return res
}
/**
 * solve Ax=B by Gauss-Jordan elimination method
 * adapted from https://www.npmjs.com/package/linear-equation-system
 * @param {array[]} A
 * @param {array} B
 */
function solve(A, B) {
	let system = A.slice()
	for (let i = 0; i < B.length; i++) system[i].push(B[i])

	for (let i = 0; i < system.length; i++) {
		const pivotRow = findPivotRow(system, i)
		if (!pivotRow) return false //Singular system
		if (pivotRow !== i) system = swapRows(system, i, pivotRow)
		const pivot = system[i][i]
		for (let j = i; j < system[i].length; j++) {
			//divide row by pivot
			system[i][j] = system[i][j] / pivot
		}
		for (let j = i + 1; j < system.length; j++) {
			// Cancel below pivot
			if (system[j][i] !== 0) {
				const operable = system[j][i]
				for (let k = i; k < system[i].length; k++) {
					system[j][k] -= operable * system[i][k]
				}
			}
		}
	}
	for (let i = system.length - 1; i > 0; i--) {
		// Back substitution
		for (let j = i - 1; j >= 0; j--) {
			if (system[j][i] !== 0) {
				const operable = system[j][i]
				for (let k = j; k < system[j].length; k++) {
					system[j][k] -= operable * system[i][k]
				}
			}
		}
	}
	const answer = []
	for (let i = 0; i < system.length; i++) {
		answer.push(system[i].pop())
	}
	return answer

	function findPivotRow(sys, index) {
		let row = index
		for (let i = index; i < sys.length; i++) {
			if (Math.abs(sys[i][index]) > Math.abs(sys[row][index])) row = i
		}
		if (sys[row][index] === 0) return false
		return row
	}

	function swapRows(sys, row1, row2) {
		const cache = sys[row1]
		sys[row1] = sys[row2]
		sys[row2] = cache
		return sys
	}
}
/**
 * Round the cell values of v to the given number of decimal places
 * @param {array} v
 * @param {number} places
 */
function round(v, places) {
	for (let i = 0; i < v.length; i++) v[i] = v[i].toFixed(places)
	return v
}

/* --------------------------------------------------------------------*/
/**
 * This is the Trophic Levels Algorithm
 *
 * @param {array[]} a square adjacency matrix
 * @returns {array} levels (heights)
 */
/* eslint-disable camelcase */
function get_trophic_levels(a) {
	// get undirected matrix
	const au = undirected(a)
	// check connected
	if (connected(au)) {
		// get in degree vector
		const in_deg = in_degree(a)
		// get out degree vector
		const out_deg = out_degree(a)
		// get in - out
		const v = subVec(in_deg, out_deg)
		// get diagonal matrix, subtract (adj. matrix plus its transpose)
		const L = subtract(diag(addVec(in_deg, out_deg)), mergeTranspose(a))
		// set (0,0) to zero
		L[0][0] = 0
		// do linear solve
		let h = solve(L, v)
		if (!h) {
			throw new Error("Singular matrix")
		}
		// base to zero
		h = rebase(h)
		// round to 3 decimal places
		h = round(h, 3)
		// return tropic heights
		return h
	} else {
		throw new Error("Network must be weakly connected")
	}
}
/* eslint-enable camelcase */
/**
 * convert a vector of objects, each an edge referencing from and to nodes
 * to an adjacency matrix.  nodes is a list of nodes that acts as the index for the adj. matrix.
 * @param {array} v list of edges
 * @param {array} nodes list of node Ids
 * @returns matrix
 */
function edgeListToAdjMatrix(v, nodes) {
	const a = zero(nodes.length)
	for (let i = 0; i < v.length; i++) {
		a[nodes.indexOf(v[i].from)][nodes.indexOf(v[i].to)] = 1
	}
	return a
}
/**
 * returns a list of the node Ids mentioned in a vector of edges
 * @param {array} v edges
 */
function nodeList(v) {
	const nodes = []
	for (let i = 0; i < v.length; i++) {
		if (nodes.indexOf(v[i].from) === -1) nodes.push(v[i].from)
		if (nodes.indexOf(v[i].to) === -1) nodes.push(v[i].to)
	}
	return nodes
}
/**
 * given a complete set of edges, returns a list of lists of edges, each list being the edges of a connected component
 * @param {object} data
 */
function connectedComponents(data) {
	const edges = data.edges.get()
	const cc = []
	const added = []
	let component = []
	// starting from each edge...
	edges.forEach((e) => {
		if (!added.includes(e)) {
			component = []
			//do a depth first search for connected edges
			dfs(e)
			cc.push(component)
		}
	})
	/**
	 * depth first search for edges connected to 'to' or 'from' nodes of this edge
	 * adds edges found to component array
	 * @param {object} e
	 */
	function dfs(e) {
		added.push(e)
		component.push(e)
		edges
			.filter((next) => {
				return (
					e !== next &&
					(next.from === e.to ||
						next.to === e.from ||
						next.from === -e.from ||
						next.to === e.to)
				)
			})
			.forEach((next) => {
				if (!added.includes(next)) dfs(next)
			})
	}
	return cc
}

/**
 * shift the positions of nodes according to the trophic 'height' (actually, here, the x coordinate)
 * @param {object} data
 * @returns list of nodes whose positions have been altered
 */
export function trophic(data) {
	// get a list of lists of connected components, each list being pairs of to and from nodes
	// process each connected component individually
	// nodes that are not connected to anything (degree 0) moved to the base level
	const updatedNodes = []
	// save min and max x coordinates of nodes
	const minX = Math.min(...data.nodes.map((n) => n.x))
	const maxX = Math.max(...data.nodes.map((n) => n.x))
	connectedComponents(data).forEach((edges) => {
		const nodeIds = nodeList(edges)
		const nodes = data.nodes.get(nodeIds)
		// convert to an adjacency matrix
		const adj = edgeListToAdjMatrix(edges, nodeIds)
		// get trophic levels
		let levels = get_trophic_levels(adj)
		// experimental: round levels to integers within the range 0 .. NLEVELS
		let range = Math.max(...levels) - Math.min(...levels)
		levels = levels.map((l) => Math.round((l * NLEVELS) / range))
		// rescale x to match original max and min
		range = Math.max(...levels) - Math.min(...levels)
		// if all nodes are at same trophic height (range === 0, so scale would be infinity), line them up
		const scale = range > 0.000001 ? (maxX - minX) / range : 0
		// move nodes to new positions
		for (let i = 0; i < nodeIds.length; i++) {
			const node = nodes[i]
			node.x = levels[i] * scale + minX
			node.level = levels[i]
			updatedNodes.push(node)
		}
	})
	// move all the rest (i.e. unconnected nodes) to the base level
	data.nodes
		.get()
		.filter((n) => !updatedNodes.some((u) => n.id === u.id))
		.forEach((n) => {
			n.x = minX
			n.level = 0
		})

	return data.nodes.get()
}
