/* ****************************************************************************************
trophic.js: trophic levels of the factors of a map (after MacKay et al. 2020), used to lay the map
out with causes on the left and effects on the right.  The matrix functions are unchanged from
js/trophic.js; the interface to the map is new.
**************************************************************************************** */
export const NLEVELS = 20 // max. number of levels

/* simple minded adjacency matrix manipulation functions.
 * They generally assume that the matrix is square.  All weights are unity.
 * Matrix data structure is just an array of arrays
 */
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
      throw new Error('Singular matrix')
    }
    // base to zero
    h = rebase(h)
    // round to 3 decimal places
    h = round(h, 3)
    // return tropic heights
    return h
  } else {
    throw new Error('Network must be weakly connected')
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
 * @param {Array<{id:string}>} nodes
 * @param {Array<{from:string,to:string}>} links
 * @returns {Array<Array<string>>} the node ids of each connected group of factors
 */
function components(nodes, links) {
  const parent = new Map(nodes.map((n) => [n.id, n.id]))
  const root = (id) => (parent.get(id) === id ? id : root(parent.get(id)))
  for (const { from, to } of links) {
    if (parent.has(from) && parent.has(to)) parent.set(root(from), root(to))
  }
  const groups = new Map()
  for (const { id } of nodes) groups.set(root(id), [...(groups.get(root(id)) ?? []), id])
  return [...groups.values()]
}

/**
 * Trophic level of each factor, scaled to the integers 0..NLEVELS; unlinked factors are at level 0
 * @param {Array<{id:string}>} nodes
 * @param {Array<{from:string,to:string}>} links
 * @returns {Map<string, number>}
 */
export function trophicLevels(nodes, links) {
  const levels = new Map(nodes.map((n) => [n.id, 0]))
  for (const ids of components(nodes, links)) {
    if (ids.length < 2) continue
    const own = links.filter((l) => ids.includes(l.from) && ids.includes(l.to))
    const raw = get_trophic_levels(edgeListToAdjMatrix(own, ids))
    const range = Math.max(...raw) - Math.min(...raw)
    ids.forEach((id, i) =>
      levels.set(id, Math.round((raw[i] * NLEVELS) / (range < 1e-6 ? 1 : range)))
    )
  }
  return levels
}

/**
 * New positions for a trophic layout: x follows the trophic level, within the present spread of x;
 * the factors on one level are stacked vertically, in their present order.
 * @param {Array<{id:string,x:number,y:number}>} nodes
 * @param {Array<{from:string,to:string}>} links
 * @param {function(string):number} heightOf height of a factor, in graph units
 * @returns {Object<string,{x:number,y:number}>} positions by factor id
 */
export function trophicPositions(nodes, links, heightOf) {
  const levels = trophicLevels(nodes, links)
  const minX = Math.min(...nodes.map((n) => n.x))
  const maxX = Math.max(...nodes.map((n) => n.x))
  const top = Math.max(...levels.values())
  const bottom = Math.min(...levels.values())
  const scale = top > bottom ? (maxX - minX) / (top - bottom) : 0
  const positions = {}
  for (let level = bottom; level <= top; level++) {
    const onLevel = nodes.filter((n) => levels.get(n.id) === level).sort((a, b) => a.y - b.y)
    if (onLevel.length === 0) continue
    const heights = onLevel.map((n) => heightOf(n.id) + 10)
    let y = -heights.reduce((a, b) => a + b, 0) / 2
    onLevel.forEach((n, i) => {
      positions[n.id] = { x: level * scale + minX, y }
      y += heights[i]
    })
  }
  return positions
}
