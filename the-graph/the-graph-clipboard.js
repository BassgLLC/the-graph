/**
 * Created by mpricope on 05.09.14.
 */

(function (context) {
  "use strict";
  var TheGraph = context.TheGraph;

  TheGraph.Clipboard = {};
  var clipboardContent = {nodes:[], edges:[], initializers:[], pasted: -1};

  var cloneObject = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  var makeNewId = function (label) {
    var num = 60466176; // 36^5
    num = Math.floor(Math.random() * num);
    var id = label + '_' + num.toString(36);
    return id;
  };

  TheGraph.Clipboard.isEmpty = function () {
    return clipboardContent.nodes.length == 0 && clipboardContent.edges.length == 0 && clipboardContent.initializers.length == 0;
  };

  TheGraph.Clipboard.copy = function (graph, nodeIds) {
    //Duplicate all the nodes before putting them in clipboard
    //this will make this work also with cut/Paste and once we
    //decide if/how we will implement cross-document copy&paste will work there too
    clipboardContent = {nodes:[], edges:[], initializers:[], pasted: -1};
    var map = {};
    var i, len;
    for (i = 0, len = nodeIds.length; i < len; i++) {
      var node = graph.getNode(nodeIds[i]);
      var newNode = cloneObject(node);
      newNode.id = makeNewId(node.component);
      clipboardContent.nodes.push(newNode);
      map[node.id] = newNode.id;
    }
    for (i = 0, len = graph.edges.length; i < len; i++) {
      var edge = graph.edges[i];
      var fromNode = edge.from.node;
      var toNode = edge.to.node;
      if (map.hasOwnProperty(fromNode) && map.hasOwnProperty(toNode)) {
        var newEdge = cloneObject(edge);
        newEdge.from.node = map[fromNode];
        newEdge.to.node = map[toNode];
        clipboardContent.edges.push(newEdge);
      }
    }
    for (i = 0, len = graph.initializers.length; i < len; i++) {
      var initial = graph.initializers[i];
      if (map.hasOwnProperty(initial.to.node)) {
        var newInitial = cloneObject(initial);
        newInitial.to.node = map[initial.to.node];
        clipboardContent.initializers.push(newInitial);
      }
    }
  };

  TheGraph.Clipboard.paste = function (graph) {
    var map = {};
    var pasted = {nodes:[], edges:[], initializers:[]};
    var i, len;
    for (i = 0, len = clipboardContent.nodes.length; i < len; i++) {
      var node = clipboardContent.nodes[i];
      var meta = cloneObject(node.metadata);
      meta.x += 36;
      meta.y += 36;
      var newNode = graph.addNode(makeNewId(node.component), node.component, meta);
      map[node.id] = newNode.id;
      pasted.nodes.push(newNode);
    }
    for (i = 0, len = clipboardContent.edges.length; i < len; i++) {
      var edge = clipboardContent.edges[i];
      var newEdgeMeta = cloneObject(edge.metadata);
      var newEdge;
      if (edge.from.hasOwnProperty('index') || edge.to.hasOwnProperty('index')) {
        // One or both ports are addressable
        var fromIndex = edge.from.index || null;
        var toIndex = edge.to.index || null;
        newEdge = graph.addEdgeIndex(map[edge.from.node], edge.from.port, fromIndex, map[edge.to.node], edge.to.port, toIndex, newEdgeMeta);
      } else {
        newEdge = graph.addEdge(map[edge.from.node], edge.from.port, map[edge.to.node], edge.to.port, newEdgeMeta);
      }
      pasted.edges.push(newEdge);
    }
    for (i = 0, len = clipboardContent.initializers.length; i < len; i++) {
      var initial = clipboardContent.initializers[i];
      var newInitial;
      var newMeta = cloneObject(initial.metadata);
      if (initial.to.hasOwnProperty('index')) {
        newInitial = graph.addInitialIndex(initial.from.data, map[initial.to.node], initial.to.port, initial.to.index || null, newMeta);
      } else {
        newInitial = graph.addInitial(initial.from.data, map[initial.to.node], initial.to.port, newMeta);
      }
      pasted.initializers.push(newInitial);
    }
    clipboardContent.pasted++;
    return pasted;
  };

  TheGraph.Clipboard.getClipboardContent = function () {
    clipboardContent.pasted++;
    return clipboardContent;
  };

})(this);
