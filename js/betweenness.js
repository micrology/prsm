
/**
 Adapted from https://github.com/anvaka/ngraph.centrality/tree/master/src
 */
 
function betweenness(graph) {
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
     	return forEachOrientedLink(links, nodeId, callback);
     	}
  }

  function forEachOrientedLink(links, nodeId, callback) {
    var quitFast;
    for (var i = 0; i < links.length; ++i) {
      var link = links[i];
      if (link.from === nodeId) {
        quitFast = callback(nodes.get(link.to), link)
        if (quitFast) {
          return true; // Client does not need more iterations. Break now.
        }
      }
    }
  }
  
  function linksFrom(nodeId) {
  	data.edges.get({filter: function(item){
  		return (item.from == nodeId);
  		}
  	})
  }
  
 } 
}

