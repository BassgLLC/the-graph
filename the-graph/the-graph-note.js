(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  // Patching noflo to support notes in light mode.
  // (They isn't supported with journal and other structures.)
  var NoFlo = context.noflo;
  var _toJSON = NoFlo.Graph.prototype.toJSON;
  var _loadJSON = NoFlo.graph.loadJSON;

  NoFlo.Graph.prototype.toJSON = function () {
    var res = _toJSON.call(this);

    var notesDict = {};
    var notesList = this.notes;
    var note;
    for (var i=0, len = notesList.length; i < len; i++) {
      note = notesList[i];
      notesDict[note.id] = {
        text: note.text,
        metadata: note.metadata || {}
      }
    }

    res.notes = notesDict;
    return res;
  };

  NoFlo.graph.loadJSON = function (definition, success, metadata) {
    _loadJSON.call(this, definition, function (nofloGraph) {
      var srcNotes = definition.notes;
      var notesList = [];
      for (var id in srcNotes) {
        var note = srcNotes[id];
        note.id = id;
        if (!note.metadata) {
          note.metadata = {};
        }
        notesList.push(note);
      }

      nofloGraph.notes = notesList;
      success(nofloGraph);
    }, metadata);
  };

  NoFlo.Graph.prototype.addNote = function (id, text, metadata) {
    var note;
    note = {id: id, text: text, metadata: metadata || {}};
    if (!note.metadata.hasOwnProperty("x")) note.metadata.x = 0;
    if (!note.metadata.hasOwnProperty("y")) note.metadata.y = 0;
    this.checkTransactionStart();
    this.notes.push(note);
    this.emit('addNote', note);
    this.checkTransactionEnd();
    return note;
  };

  NoFlo.Graph.prototype.removeNote = function (noteID) {
    var i = this.notes.findIndex(function (n) {return n.id == noteID});
    if (i >= 0) {
      this.checkTransactionStart();
      this.notes.splice(i, 1);
      this.emit('removeNote', noteID);
      this.checkTransactionEnd();
    }
  };

  NoFlo.Graph.prototype.setNoteMetadata = function (noteID, metadata) {
    this.checkTransactionStart();
    var note = this.notes.find(function (n) {return n.id == noteID});
    note.metadata = TheGraph.merge(metadata, note.metadata, true);
    this.emit('changeNote', noteID);
    this.checkTransactionEnd();
  };

  NoFlo.Graph.prototype.setNoteText = function (noteID, text) {
    this.checkTransactionStart();
    var note = this.notes.find(function (n) {return n.id == noteID});
    note.text = text;
    this.emit('changeNote', noteID);
    this.checkTransactionEnd();
  };


  TheGraph.config.note = {
    container: {
      className: "group drag"
    },
    rect: {
      className: "tooltip-bg",
      x: 0,
      y: -7,
      rx: 3,
      ry: 3,
      height: 16
    },
    text: {
      className: "group-label drag",
      ref: "label"
    },
    snap: TheGraph.config.nodeSize
  };

  TheGraph.factories.note = {
    createNoteGroup: TheGraph.factories.createGroup,
    createNoteRect: TheGraph.factories.createRect,
    createNoteText: TheGraph.factories.createText
  };

  // Port view

  TheGraph.Note = React.createFactory( React.createClass({
    displayName: "TheGraphNote",
    componentDidMount: function () {
      var domNode = this.getDOMNode();

      // Dragging
      domNode.addEventListener("trackstart", this.onTrackStart);

      // Tap to select
      if (this.props.onNoteSelection) {
        domNode.addEventListener("tap", this.onNoteSelection, true);
      }

      // Context menu
      if (this.props.showContext) {
        domNode.addEventListener("contextmenu", this.showContext);
        domNode.addEventListener("hold", this.showContext);
      }
    },
    onNoteSelection: function () {
      // Don't tap app (unselect)
      event.stopPropagation();

      // var toggle = (TheGraph.metaKeyPressed || event.pointerType==="touch");
      this.props.onNoteSelection(this.props.noteID, this.props.note);
    },
    onTrackStart: function () {
      // Don't drag graph
      event.stopPropagation();

      // Don't change selection
      event.preventTap();

      // Don't drag under menu
      if (this.props.app.menuShown) { return; }

      // Don't drag while pinching
      if (this.props.app.pinching) { return; }

      var domNode = this.getDOMNode();
      domNode.addEventListener("track", this.onTrack);
      domNode.addEventListener("trackend", this.onTrackEnd);

      this.props.graph.startTransaction('movenote');
    },
    onTrack: function (event) {
      // Don't fire on graph
      event.stopPropagation();

      var scale = this.props.app.state.scale;
      var deltaX = Math.round( event.ddx / scale );
      var deltaY = Math.round( event.ddy / scale );

      // Fires a change event on noflo graph, which triggers redraw
      this.props.graph.setNoteMetadata(this.props.noteID, {
        x: this.props.note.metadata.x + deltaX,
        y: this.props.note.metadata.y + deltaY
      });
    },
    onTrackEnd: function (event) {
      // Don't fire on graph
      event.stopPropagation();

      var domNode = this.getDOMNode();
      domNode.removeEventListener("track", this.onTrack);
      domNode.removeEventListener("trackend", this.onTrackEnd);

      // Snap to grid
      var snap = TheGraph.config.note.snap / 2;
      this.props.graph.setNoteMetadata(this.props.noteID, {
        x: Math.round(this.props.note.metadata.x/snap) * snap,
        y: Math.round(this.props.note.metadata.y/snap) * snap
      });

      // Moving a node should only be a single transaction
      this.props.graph.endTransaction('movenote');
    },
    showContext: function () {
      // Don't show native context menu
      event.preventDefault();

      // Don't tap graph on hold event
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      var offset = TheGraph.getOffsetUpToElement(event.currentTarget, event.target);
      var x = (event.layerX || event.clientX || 0) - offset.left;
      var y = (event.layerY || event.clientY || 0) - offset.top;

      // App.showContext
      this.props.showContext({
        element: this,
        type: "note",
        x: x,
        y: y,
        graph: this.props.graph,
        itemKey: this.props.noteID,
        item: this.props.note
      });
    },
    getContext: function (menu, options, hide) {
      return TheGraph.Menu({
        menu: menu,
        options: options,
        triggerHideContext: hide,
        label: this.props.label,
        iconColor: this.props.route
      });
    },
    render: function () {
      var rectOptions = TheGraph.merge(TheGraph.config.note.rect, {width: this.props.text.length * 12});
      var rect = TheGraph.factories.note.createNoteRect.call(this, rectOptions);

      var textOptions = TheGraph.merge(TheGraph.config.note.text, { children: this.props.text });
      var text = TheGraph.factories.note.createNoteText.call(this, textOptions);

      var containerContents = [rect, text];

      var containerOptions = {
        className: "tooltip note" + (this.props.selected ? " selected" : " "),
        transform: "translate("+this.props.x+","+this.props.y+")"
      };
      containerOptions = TheGraph.merge(TheGraph.config.note.container, containerOptions);
      return TheGraph.factories.note.createNoteGroup.call(this, containerOptions, containerContents);

    }
  }));


})(this);
