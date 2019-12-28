
/**
 Adapted from https://github.com/anvaka/ngraph.centrality/tree/master/src
 */
 
var betweennessCache = {
	structure: [],
	betweenness: 0
	};
	
function betweenness(graph) {
	let struct = data.nodes.getIds().concat(data.edges.getIds());
	if (eqArray(struct, betweennessCache.structure)) return betweennessCache.betweenness;
	betweennessCache = {structure: struct, betweenness: betweenness1(graph)};
	console.log('calculating betweenness');
	return betweennessCache.betweenness;
}

function eqArray(a,b) {
	if (a.length != b.length) return false;
	a = a.sort(); b = b.sort();
	for (let i = 0; i < a.length; i++) if (a[i] != b[i]) return false;
	return true;
}

function betweenness1(graph) {
// graph is an object: {nodes, edges} where nodes and edges are vis.DataSets
  var Q = [],
    S = []; // Queue and Stack
  // list of predecessors on shortest paths from source
  var pred = Object.create(null);
  // distance from source
  var dist = Object.create(null);
  // number of shortest paths from source to key
  var sigma = Object.create(null);
  // dependency of source on key
  var delta = Object.create(null);

  var currentNode;
  var centrality = Object.create(null);

  graph.nodes.forEach(setCentralityToZero);
  graph.nodes.forEach(calculateCentrality);

  return centrality;

  function setCentralityToZero(node) {
    centrality[node.id] = 0;
  }

  function calculateCentrality(node) {
    currentNode = node.id;
    singleSourceShortestPath(currentNode);
    accumulate();
  }

  function accumulate() {
    graph.nodes.forEach(setDeltaToZero);
    while (S.length) {
      var w = S.pop();
      var coeff = (1 + delta[w])/sigma[w];
      var predecessors = pred[w];
      for (var idx = 0; idx < predecessors.length; ++idx) {
        var v = predecessors[idx];
        delta[v] += sigma[v] * coeff;
      }
      if (w !== currentNode) {
        centrality[w] += delta[w];
      }
    }
  }

  function setDeltaToZero(node) {
    delta[node.id] = 0;
  }

  function singleSourceShortestPath(source) {
    graph.nodes.forEach(initNode);
    dist[source] = 0;
    sigma[source] = 1;
    Q.push(source);

    while (Q.length) {
      var v = Q.shift();
      S.push(v);
      forEachLinkedNode(v, toId);
    }

    function toId(otherNode) {
      // NOTE: This code will also consider multi-edges, which are often
      // ignored by popular software (Gephi/NetworkX). Depending on your use
      // case this may not be desired and deduping needs to be performed. To
      // save memory I'm not deduping here...
      processNode(otherNode.id);
    }

    function initNode(node) {
      var nodeId = node.id;
      pred[nodeId] = []; // empty list
      dist[nodeId] = -1;
      sigma[nodeId] = 0;
    }

    function processNode(w) {
      // path discovery
      if (dist[w] === -1) {
        // Node w is found for the first time
        dist[w] = dist[v] + 1;
        Q.push(w);
      }
      // path counting
      if (dist[w] === dist[v] + 1) {
        // edge (v, w) on a shortest path
        sigma[w] += sigma[v];
        pred[w].push(v);
      }
    }
    
  function forEachLinkedNode(nodeId, callback) {
     let links = linksFrom(nodeId);
     if (links) {
		for (var i = 0; i < links.length; ++i) {
		  var link = links[i];
		  if (link.from === nodeId) {
			callback(nodes.get(link.to), link)
		  }
     	}
     }
  }
  
  function linksFrom(nodeId) {
  	return data.edges.get({filter: function(item){
  										return (item.from == nodeId);
  									}
  							})
  }
  
 } 
}

