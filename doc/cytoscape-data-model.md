# PRSM on Cytoscape: data model, file format and legacy mapping (draft 1)

> Historical design and implementation notes: references below to `cy/`,
> `js/app/`, and the old HTML locations predate the move to `prsm4/`.
> Current production modules are in `prsm4/src/`, tests in `prsm4/tests/`,
> and the conversion report in `prsm4/tools/`.

Status: design draft for discussion. No code has been changed.

## 1. Goals and principles

1. Write PRSM as if it had always used Cytoscape.js: no vis-network-shaped objects in the core.
2. Two copies of the map only: **Yjs** (persistent, shared) and **Cytoscape** (live, with selection and
   positions). The vis-data `DataSet`s go.
3. Styles are a Cytoscape stylesheet; elements reference styles by class.
4. Old `.prsm` files, and old collaboration rooms stored on the server, load via a one-way translator.
5. Design now for backgrounds as nodes (section 7), but build them last. Fabric is removed entirely.

## 2. Findings from the current code and the 111 sample maps in `data/`

- Yjs doc today: `nodes`, `edges`, `samples` (styles), `network` (settings), `drawing` (Fabric JSON),
  `points` (v1 underlay), `history`. Each `nodes` and `edges` entry is the whole vis object, copied on every
  change. The undo manager covers `nodes`, `edges` and `network`.
- Saved nodes are mostly redundant. 10,205 of 10,998 nodes carry full `color`, `font`, `borderWidth` and
  `shapeProperties` objects that are copies of their group's style. Only the differences need to be kept
  as per-element overrides.
- Per-edge `smooth` is **always null** in the samples. Curvature is a map-wide setting (`buttons.curve`).
  Only edges dragged in the fork get their own `smooth{type,roundness}`.
- Shapes in use: default (ellipse), `circle`, `ellipse`, `triangle`, `hexagon`, `box`. Arrows in use: `vee` at the end only.
  Dashes are `[10,10]`, `[2,8]`, `true` or `false`.
- Id hazards: all ids are strings, but 3 of the sample files have a node id equal to an edge id. vis-network
  keeps separate id spaces and Cytoscape does not, so the translator must remap on collision.
- Runtime-only state, never saved and never put in Yjs: `isCluster`, `clusteredIn`, `isClusterEdge`,
  `nodeHidden`, `edgeHidden`, `val` (sizing metric), `bc` (centrality), `size`, `widthConstraint` and `heightConstraint`
  (derived from sizing), and `fixed` (derived from `locked` and view-only mode).
- Files may be LZ-compressed (`compressToUTF16`) and have many historical quirks (see section 6).

## 3. New Yjs schema (`schemaVersion: 2`)

| Y structure | Key | Value | Notes |
|---|---|---|---|
| `meta` (Map) | `schemaVersion` | `2` | Absent means a legacy doc. |
| | `title`, `description`, `attributeTitles` | as before | Replaces the matching `network` keys. |
| | `settings` | `{curve, snapToGrid, background, legend, sizing, showNotes, viewOnly, voting}` | Map-wide options. Not undoable, as now. |
| `nodes` (Map) | node id | node record (below) | One entry per node. |
| `edges` (Map) | edge id | edge record (below) | |
| `styles` (Map) | style id (`group0`, `edge0`, `base`) | `{kind, name, css}` | `css` is a plain object of Cytoscape style properties. |
| `regions` (Map), later | region id | region record (section 7) | Not built in the first cut. |
| `drawing`, `points` | | unchanged | Kept until phase 6. |
| `history` (Array) | | unchanged | |

**Node record** (persistent fields only):

```
{ label, note /*Quill delta*/, x, y, style: 'group0', created, modified,
  locked?, thumbUp?, thumbDown?, att1..attN?,
  overrides?: { /* Cytoscape style props that differ from the style, e.g. 'background-color' */ } }
```

**Edge record:**

```
{ source, target, label, note, style: 'edge0', created, modified,
  curve?: { 'curve-style': 'unbundled-bezier', 'control-point-distances': [..], 'control-point-weights': [..] },
  overrides?: { ... } }
```

Rules:

- Cytoscape `data` is the record plus `id`. `style` becomes the **class** (`ele.addClass('group0')`).
  `x` and `y` become `position`.
- Positions are written to Yjs on `dragfree` and not on each drag frame, as now. Remote moves animate using `ele.animate({position})`.
- Selection, hover, hidden, cluster and sizing state live **only** in Cytoscape (classes, `scratch`), never in Yjs.
- Do not store `from`/`to`, `grp`, `color` or `font` blobs. They are replaced by `source`/`target`, `style`, and `overrides` (only where an element differs from its style).

### The Yjs ↔ Cytoscape binding (one small module, `graph.js`)

- Yjs `observe` on `nodes`, `edges` and `styles` calls `cy.batch(...)` with `add`, `remove`, `data()`, `position()` or a stylesheet rebuild.
  Origin checks prevent echo.
- Cytoscape events (`add`, `remove`, `data`, `dragfree`) write to Yjs inside `doc.transact`, using the same local/remote origin test as now.
  Elements flagged `scratch('_runtime')` (clusters, ghosts) are skipped.
- The null-coordinate feedback loop noted in `prsm.js` goes away, because Cytoscape accepts only numbers and the translator normalises on load.

## 4. Styles as a Cytoscape stylesheet

Stored form (in Yjs and in the file) is JSON-safe, one entry per style:

```
styles: {
  base:   { kind: 'node', name: 'Sample', css: { shape:'ellipse', 'background-color':'#fff', 'border-width':0,
            'font-family':'Oxygen', 'font-size':14, color:'#000', padding:20, width:'label', height:'label' } },
  group0: { kind: 'node', name: 'Sample', css: { 'background-color':'rgb(154,219,180)', 'border-color':'rgb(154,219,180)' } },
  edge0:  { kind: 'edge', name: 'Sample', css: { 'line-color':'#000', width:1, 'target-arrow-shape':'vee' } }
}
```

At runtime the stylesheet is compiled from these entries plus fixed system rules, in this order:

1. `node` and `edge` base rules (from `base` and from the `edge` defaults).
2. `.group<N>` and `.edge<N>` rules (user styles).
3. Data-driven rules, which replace the old sizing and `scaling` code: for example `node[val]` with `width: mapData(val, vmin, vmax, MIN, MAX)`.
   Hidden: `.hidden { display: none }`.
4. State rules: `:selected` (replaces the `borderWidthSelected` and chosen-shadow behaviour), `.locked`, `.cluster`, `.faded`.
5. Per-element `overrides` are applied with `ele.style()` after the stylesheet. Since they are rare (see section 2), this is cheap.

The Style panel (sample swatches) edits `styles[id].css`. Hiding by style is a class toggle.

## 5. Legacy → new mapping

### Nodes

| vis-network (old) | Cytoscape (new) | Notes |
|---|---|---|
| `id` | `id` | Remap on node/edge id collision (record the mapping in the translator only). |
| `label` | `label` (data) + `label: data(label)` | `splitText` newlines kept; `text-wrap: wrap`. |
| `note` / `title` | `note` | Existing upgrade: `title` → Quill delta. |
| `grp` | `style` → class | |
| `x`, `y` (null→0) | `position` | |
| `shape` | `shape` | `ellipse`→`ellipse`, `box`→`round-rectangle` or `rectangle`, `circle`→`ellipse` with equal width and height, `triangle`→`triangle`, `hexagon`→`hexagon`, `diamond`→`diamond`, `star`→`star`, `database`→`barrel`, `text`→`rectangle` with no fill or border. |
| `color.background` / `.border` | `background-color` / `border-color` | |
| `color.highlight.*`, `.hover.*` | `:selected` rule | Old maps rarely differ from the base colour. |
| `borderWidth`, `borderWidthSelected` | `border-width`, `:selected border-width` | |
| `shapeProperties.borderDashes` | `border-style: dashed` | |
| `font.color`, `.size`, `.face` | `color`, `font-size`, `font-family` | |
| `margin` | `padding` | Use `width: label` and `height: label` for ellipse and box. |
| `widthConstraint`, `heightConstraint`, `size` | `width`, `height` | `size` is a radius in vis (width = 2 × size). Runtime only. |
| `scaling.*` | `mapData` rule | Runtime from the sizing setting. |
| `thumbUp`, `thumbDown`, `created`, `modified`, `locked`, `att*` | same | |

### Edges

| vis-network (old) | Cytoscape (new) | Notes |
|---|---|---|
| `from`, `to` | `source`, `target` | |
| `grp` | `style` → class | |
| `width` | `width` | |
| `color.color` (`inherit`, `opacity`) | `line-color`, `target-arrow-color`, `opacity` | |
| `dashes` | `line-style` | `true` → `dashed`, `[2,8]` → `dotted`, other arrays → `line-dash-pattern: [..]`. |
| `arrows.to.type` (`vee`) | `target-arrow-shape` | `arrow`→`triangle`, `vee`→`vee`, `circle`→`circle`, `bar`→`tee`. |
| `font.*`, `label` | `label`, `font-size`, `text-background-*`, `text-rotation: autorotate` | |
| `smooth` null → map `curve` setting | **map-wide** `curve` setting selects the default edge rule | See below. |
| `smooth{type,roundness}` (fork, dragged) | `curve` record | See below. |
| `note`, `created`, `modified` | same | |

**Curves.** Map-wide `Curved` selects `curve-style: unbundled-bezier` with a computed default control point. `Straight` selects `curve-style: bezier`.
Parallel and reverse edges can use plain `bezier`, which spreads them automatically. This is something vis did not do.
The vis `cubicBezier` with `roundness r` is an S-shaped curve whose control points sit at fractions of the edge's x or y extent.
The exact formula for `roundness` → `control-point-distances` and `weights` needs measuring in phase 2 and is the main source of visible difference.
The plan is to match the common case closely, and accept small deviations for dragged edges.
Dragging an edge writes `curve.control-point-distances` and weights, which need a custom handle.
Snap-to-straight when the distance is near zero (as the fork does) is kept.

### Map-level settings

`buttons.{snapToGrid, curve, background, legend, sizing}` → `meta.settings`. `lastNodeSample`, `lastLinkSample` → `meta.settings.lastNodeStyle` and `lastEdgeStyle`.
Cluster, up/down stream, radius and paths settings stay unsaved, as now.

## 6. File format

New file (JSON, still optionally LZ-compressed for now):

```
{ "format": "prsm2", "schemaVersion": 2, "appVersion": "...", "saved": "...", "room": "...",
  "meta": { title, description, attributeTitles, settings },
  "styles": { ... }, "nodes": [ {id, ...record} ], "edges": [ {id, ...record} ],
  "background": ..., "history": [ ... ] }
```

Legacy detection: no `format` key. Loading a legacy file is two stages.

1. **Normalise** with the existing logic, extracted from `loadPRSMfile` as a pure function. This handles the version quirks:
   `samples`→`styles`, `title`→`note`, string notes to a Quill delta, Gephi-style `source/target` files, `underlay` (v1 background),
   double-stringified `background`, null coordinates, and compressed text.
2. **Convert** to v2 with a pure function `legacyToV2(json)`: remap ids, convert styles (using the section 5 mapping),
   compute `overrides` by diffing each element against its style, and map curves.

Both are pure and unit-testable on the 111 maps in `data/`. The legacy loader is kept for the life of the project.
An optional `v2ToLegacy` exporter is deferred (decision 4).

Importers for GraphML, GEXF, GML, CSV, Excel, Kumu and draw.io already produce node and edge arrays. They should be switched to emit v2 records directly.
The DOT and Gephi parsers currently come from the vis-network fork and need a replacement (decision 6).

## 7. Backgrounds as nodes (design now, build later)

Region record in `regions`, rendered as a Cytoscape node:

```
{ kind: 'box' | 'ellipse' | 'text' | 'image' | 'free', label, style, members?: [nodeIds], x, y, w, h }
```

- A **member-bound region** is a compound node whose `parent` is set on its member factors, so it auto-fits when they move. Z-order is low (`z-index`, `z-compound-depth: bottom`).
- **Free** regions (not linked to nodes) are ordinary unlinked nodes with a fixed size and a resize handle.
- Free-form lines and drawings have no Cytoscape equivalent. Regions are limited to shapes, text and images; freehand drawing is dropped.
- Compound parents interact with clustering (section 8) and with edge routing. This must be prototyped before phase 6.
- Old `drawing` data is kept and converted later. Until then the old Fabric code is left alone, so nothing blocks phases 2 to 5. It is deleted when regions are done.

## 8. Dependants affected

| Module | Change |
|---|---|
| `table.js` | Reads and writes Yjs records and `cy`; no node-format conversion function. |
| `cluster.js` | Compound nodes (decision 5). |
| `betweenness.js`, `trophic.js` | Can use `cy.elements().betweennessCentrality()` and graph helpers. Verify the numeric results match before replacing. |
| `merge.js`, `aiasst.js`, `api-server` | Read and write v2 records. The server needs a schema version check. |
| `styles.js`, `samples.js` | Style editor edits `styles[id].css`; swatches become small Cytoscape instances or CSS. |
| `3d.js` | Uses its own `Network` and Yjs doc. Needs a separate review. |

## 9. Existing rooms and compatibility

- A room's Yjs doc without `meta.schemaVersion` is legacy. On first open by the new app, **one** client migrates it inside a single `doc.transact` (guarded by a flag), writing the v2 schema, and then sets `schemaVersion`.
  Old clients opening a migrated doc will see empty or odd maps. Show a "this room has been upgraded" notice.
- Old and new apps cannot co-edit the same room. This is the largest compatibility cost of a native schema, and should be accepted explicitly (decision 3).
- Server `dbDir*` snapshots are migrated lazily, on first open. Keep a backup of each snapshot before migration.

## 10. Decisions (resolved)

1. **Style storage:** `{kind, name, css}`. `kind` is `'node'` or `'edge'`; it chooses the selector the stylesheet
   compiler uses (`node.group0` or `edge.edge0`) and which palette the Style panel shows the style in.
   `name` is the user-visible label of the style (today's `groupLabel`, shown in the legend and the style menus).
   `css` holds the Cytoscape style properties. Agreed.
2. **Hidden and sizing:** Cytoscape classes and `mapData` rules. Agreed.
3. **Old and new clients in one room:** unsupported. A migrated room carries `meta.schemaVersion = 2`. An old client that
   opens it must detect the flag and show a message asking the user to reload the page to get the new version.
   This needs one small change to the current app (a check in `prsm.js` on room join), released before the new app.
4. **New → legacy export:** not needed.
5. **Clustering:** compound nodes (`parent`), collapsed and expanded with the expand-collapse extension or custom code.
   The old `isCluster`, `clusteredIn` and `isClusterEdge` bookkeeping goes. Region nodes (section 7) use the same compound mechanism.
   Needs a prototype for edges to collapsed clusters and for nested compounds.
6. **Importers:** rebuild all import parsers (DOT, Gephi, GraphML, GEXF, GML, CSV, Excel, Kumu, draw.io), emitting v2 records directly,
   with small standalone dependencies where needed.
7. **Fabric:** replaced entirely by region nodes (shapes, text, images). Freehand drawing is dropped. Old `drawing` objects are converted
   on import where they are shapes, text or images; freehand paths are skipped and reported in the import log.
8. **Edge handles:** open. Phase 3 will evaluate `edgehandles` (add-link by drag) and an edge-editing extension (curve control points)
   against the requirements: same gestures as today, touch support, snap-to-straight, and the ability to veto invalid links
   (self-links, duplicates, links to clusters). Build our own for any that fail.

## 11. Phase 2 results (done)

Code is in `cy/`: `legacy.js` (parse, normalise, `legacyToV2`), `curves.js`, `graph.js` (stylesheet and elements), `report.mjs`
(`node cy/report.mjs [dir]`) and a test page (`npx parcel build cy/test.html`, then open it and choose a `.prsm` file).

- **Corpus:** 216 of 217 maps in `data/` convert (19,927 factors, 130,457 links). The exception, `styles.prsm`, is not a map and is not valid JSON.
  No Gephi-format files occur. Conversion takes about 25 ms per typical map.
- **Data repairs made by the translator:** 20 links that referred to missing factors are dropped; 48 factors with an undefined style
  (for example `kumuNode`) fall back to `nodeBase` plus their own overrides; 605 edge ids that clashed with node ids or with each other were renamed.
- **Styles:** node and edge base styles are `nodeBase` and `edgeBase` (both were called `base`, which collided). Only 13,312 of 150,000 elements need overrides.
- **Curves:** the map-wide S-curve is approximated by two Cytoscape control points fitted to vis-network's cubic.
  Mean deviation is 1.3% of edge length, worst 1.6%, well inside the agreed 10%. Dragged edges (`curvedSymmetricCW/CCW`) map exactly to
  `{side, roundness}` with one control point. Control points are recomputed for the connected edges when a node moves (3.5 ms for two nodes on a 679-link map).
- **Rendering:** a 246-factor, 679-link map renders in 161 ms. A 469-factor, 102,830-link outlier (`Kissler_DataS1ids.prsm`, a dense data matrix, not a real system map) takes 18 s.
- **Visual check:** shapes, colours, dashed borders and links, arrowheads and S-curves match the old app on the maps tried.

Open issues for phase 3:

1. `width: label` and `height: label` work but are deprecated in Cytoscape 3.34 with no replacement. Either keep them, or measure text ourselves and
   store the size in data (`width: data(w)`).
2. The old "note" icon on links with notes (a middle arrow of type image) is not reproduced. It will be a class-based indicator.
3. Ellipse labels need extra padding to look like vis-network's; to be tuned by eye.
4. Reciprocal links (A to B and B to A) overlap exactly with the S-curve, as before. Cytoscape's `bezier` style could separate them.
5. `legacy.js` imports the default styles from `js/samples.js`. Move them into `cy/` before the old code is deleted.
6. Still to be written: Gephi, DOT and other importers emitting v2 records (decision 6), and conversion of Fabric drawings to regions.

## 12. Phase 3 results (binding and editing, done in the test bed)

Code: `cy/store.js` (Yjs document and all mutations), `cy/binding.js` (store to graph), `cy/editing.js` (gestures).
`cy/test.html` now shows two independent users (two Yjs docs connected by update forwarding) so that collaboration can be seen.

- **Data flow:** gestures call `MapStore` methods; the store changes come back to the graph through one `afterTransaction` handler,
  which is the same path for local, undo/redo and remote changes. The only direct graph change is the node position during a drag;
  `dragfree` then writes all moved nodes in one transaction.
- **Records** are stored whole (one value per node or edge), as before, so two users changing different fields of the same factor at
  the same moment will conflict (last writer wins). Splitting records into per-field Y.Maps is possible later if this matters.
- **Undo/redo:** `Y.UndoManager` over nodes, edges and styles; steps closer than 400 ms merge. Loading a file is not undoable.
- **Link creation (decision 8): `cytoscape-edgehandles` is adopted.** Its draw mode gives the same gesture as the present
  Add Link button (drag from factor to factor), works with touch, and `canConnect` vetoes self-links and duplicates.
  Links to clusters will be vetoed in phase 5. The link it creates is discarded and the store makes the real one.
- **Curve editing: own code, not `cytoscape-edge-editing`.** That extension edits free control points, which is not our model
  (`{side, roundness}`). Dragging a selected link bends it live, snaps to straight below roundness 0.04, and saves on release.
- **Other gestures built:** Add Factor (click on background), double-click to edit a label, Delete, Ctrl/Cmd-Z and Shift-Z.
- **Checked in the browser:** drag, add factor, add link (valid and duplicate), bend, delete (links go with factors), undo/redo,
  style changes with per-element overrides preserved, curve mode switch, and mirroring to the second user.
- **Not yet done:** selection details (select-all, lasso), remote cursors/awareness, snap-to-grid, locked nodes, copy/paste,
  the style editor (phase 4), and Yjs-server transport (the test bed uses in-page forwarding).

## 13. Phase 4 results (clustering and style editor, in the test bed)

- **Clusters** are ordinary node records: `{label, style:'clusterNode', cluster:{collapsed}, x, y}`; members carry `inCluster: <clusterId>`.
  Old `cluster` node and edge styles became `clusterNode` and `clusterEdge` (they previously collided under one id).
  `cluster.js` holds the store-side operations (`clusterBy`, `setCollapsed`, `dissolveCluster`); `clusterview.js` derives, at
  runtime only, the hidden members, the compound parent of an expanded cluster, and the summary ("meta") links with counts.
- **Gestures:** double-click toggles collapsed/expanded (an expanded cluster is a dashed compound box); right-click dissolves.
  Links to clusters are refused by `canLink`; deleting a cluster frees its members.
- **Style editor** (`styleeditor.js`): lists node and link styles, edits the `css` of one style (shape, colours, border, font,
  arrows, line style), adds, renames and deletes styles (elements of a deleted style revert to the base style), sets the style of
  the selection and edits per-element `overrides` (colour) with "Clear overrides". Everything goes through `MapStore`
  (`setStyle`, `addStyle`, `deleteStyle`, `setElementStyle`, `setOverrides`), so it is undoable and shared. Changing the shape
  applies the same size/label-position bundle the converter uses. The old placeholder style name `Sample` is converted to "unnamed".
- **Not yet done:** Louvain clustering, attribute choices in the Cluster menu, stats, table view, richer override controls.

## 14. Table view specification (phase 4, to be built in the test bed)

Replaces `js/table.js` and `tabulator-tables` with a hand-written `<table>` rendered from `MapStore`. (`xlsx` is used only by `files.js`
for spreadsheet import/export and is dealt with in phase 5.) The table runs in its own window, with its own `MapStore` on the same room.

**Architecture.** Columns are data: `{id, title, group, type, editable, get(rec, resolved), set(store, ids, value), aggregate}`. The
Factors and Links tabs, sorting, filtering, the footer and clipboard copy are all generated from these lists. One `afterTransaction`
listener re-renders only changed rows. Edits call `MapStore` methods, so undo/redo and sharing need no extra code. Degree, leverage and
betweenness come from a headless Cytoscape graph kept in step with the store by `bindGraph`.

**Factors tab.** Header groups Factor (Select, Label, Modified), Format (Style, Shape, Hidden, Locked, Relative size, Fill, Border
width, Border colour, Border style, Font colour, Font size), Statistics (In-degree, Out-degree, Total degree, Leverage, Betweenness,
thumbs up, thumbs down), user attribute columns, Notes. Footer: count of factors, hidden, locked, mean degrees, maximum betweenness.
**Links tab.** From, To, Modified; Style group (Style, Hidden, Arrow, Colour, Width, Line style, Font size, Font colour); Notes.

**Editing.** Editable columns have a darker heading. Number: type; Shape, Border style, Arrow, Line style, Style: dropdown; colours:
colour widget; Hidden and Locked: checkbox; Notes: click opens the Quill dialog (cell shows the first 30 characters of plain text).
Style-dependent cells show the *resolved* value (override, else style); editing writes a per-element override, and an empty value
clears it (shown as '—' for Style and Relative size). Relative size is a size multiplier override. Cluster nodes have no rows; the footer
mentions how many there are. Members of collapsed clusters are listed normally. Sort: every column, ascending/descending, empties last;
colour columns sort by hue. Footer covers all rows, not just filtered ones.

**Kept from the old table:** user attribute columns (add, rename, delete), filter dialog, copy to clipboard, collapsible column groups,
row selection linked to the map selection, undo/redo buttons.

## 15. Phase 4 results: table and clustering

Table built as `tableview.js` (DOM), `columns.js` (columns as data), `tablemodel.js` (sort/filter/footer), `stats.js` (degree, leverage,
Brandes betweenness computed straight from the store; no headless graph), `noteeditor.js`. Changes from the spec as built: the footer
covers only the rows left after filtering; factor and link labels are editable (a factor label edit reaches the links table because link
ends are looked up from the store); labels and notes are shortened to 30 characters with an ellipsis in cells; Relative size is a
percentage (5 to 100) mapped to a node width/height of 32.5 to 270 px, as the old size slider did. `created`/`modified` are `{time, user}`.

Clustering menu: None, Style, Color, Louvain (`louvain.js`, the old jLouvain moved out of `js/cluster.js` unchanged) and one entry per
user attribute. All produce ordinary cluster node records, so they are shared and undoable.

## 16. Sharing test and the element dialog

**Real Yjs server.** The test bed takes `?ws=ws://localhost:4399&room=name`; each pane is then a separate `y-websocket` client of the
server (`cd ws-server && PORT=4399 node src/server.js`; port 4321 was in use by another project on the development machine).
Verified: loading a map in one client, label and position edits, undo (undoes only the local user's own changes), clustering and its
undo, and a client joining later all behave as with the in-page forwarding.

**Element dialog** (`elementeditor.js`). Double-clicking a factor or link opens a dialog over it (cluster nodes still expand or
collapse; locked factors do not open). It edits the label, fill/border/font colours, shape, border style, font size and relative size
(factors), or colour, width, arrow, line style and font size (links). Its fields are the table's columns, so reads and writes share one
code path and write overrides. Nothing is written until Save (or Enter in the label); Escape or the cross cancels. Save is one undoable
transaction. Relative size is now applied as a per-element width/height, so it also beats a shape's own size. Not yet done: portal shapes.

## 17. Phase 6 plan: the user interface (the new app shell)

**Current order.** 6 = UI (this section); 7 = side-by-side interaction and UI review (deferred);
8 = save/open/merge/export/importers; then backgrounds as region nodes and cut-over (room
migration, version gate, deleting vis-network, vis-data, Fabric, Tabulator, `js/table.js`).

**Approach.** Reuse the markup and css of `html/prsm.html` and `css/prsm.css`, so the look is the same, but replace `js/prsm.js` (5,965 lines,
144 functions, about 150 `data.nodes/edges` uses and about 190 `network.*` calls) by small modules around the `cy/` modules. The new
app is a separate entry point (`html/prsm2.html` and `js/app/*.js`) built alongside the old one, which keeps working until phase 9.
Nothing in the new modules may use a global `network`, `data` or `doc`: each takes the `MapStore` and the `cy` instance it needs.

**Inventory of what the original UI has, and what it becomes.**

| Area (original) | New module | Notes |
|---|---|---|
| Navbar: title, rooms/projects menu, Add factor, Add link, Undo, Redo, Delete, Share, Open/Save/Export, Search, Help, panel toggle | `toolbar.js`, `rooms.js` (reuse `projects.js` with little change) | File actions are wired in phase 8. |
| Canvas, zoom control, status bar, alerts | `statusbar.js` | Cytoscape gives zoom, pinch and pan. Fit and zoom slider are small. |
| Side panel, tab Factors/Links: 15 sample swatches each, click applies to the selection, double-click edits | `palette.js` | Swatches are the styles already in `store.styles`; the edit dialog is the phase 4 style editor. |
| Side panel, tab Network: layout, snap to grid, curves, background colour, drawing, legend, users, history, notes, voting switches | `networkpanel.js` | Layouts: Off, Trophic (`trophic.js` reused), Fan, and force layouts from `cytoscape-fcose` or `cose` in place of Barnes Hut, Force Atlas 2, Repulsion. Snap to grid done by our own code on drag-free. |
| Side panel, tab Analysis: radius, upstream/downstream, paths, shortest path, sizing, clustering | `analysis.js` | Much simpler with Cytoscape: `neighborhood`, `successors`/`predecessors`, `aStar`/`dijkstra`. Hidden-by-analysis becomes a class, not a data change. |
| Notes panels for factors and links (Quill, resizable, AI-generated notes) | `notespanel.js` | Reuse `noteeditor.js` and `aiasst.js`. |
| Search bar | `search.js` | Uses `cy.nodes()` filters and `cy.fit`. |
| History log and rollback | `history.js` | Log is already a shared Yjs array; rollback uses stored snapshots. Needs a decision, see below. |
| Awareness: other users' cursors, avatars, follow, ghost factor while a user adds one | `awareness.js` | DOM overlays placed from `renderedPosition`; Yjs awareness unchanged. |
| Badges on factors (pin, note card, thumbs) | `badges.js` | Cytoscape has no canvas hook as vis had. Options: SVG data-URI `background-image` classes (cheap, scale with zoom), or a DOM overlay. Start with classes. |
| Legend, minimap | `legend.js`, `minimap.js` | Legend is built from the styles. Minimap: own small canvas, as now. |
| Share dialog (QR, clone, view-only), view-only mode, clone | `share.js` | Mostly DOM; room logic reused. |
| Tutorial, help, What's New, splash and user name | reuse `tutorial.js`, `index.js` pieces | |
| Drawing layer, background shapes | later backgrounds phase | The Drawing switch is hidden until then. |
| 3D view (`3d.js`) | phase 9 | Reads the store through a small adapter. Needs checking for vis dependencies. |

**Order of work (each step ends with a browser check against a real Yjs server, and a note in this document).**
1. *Shell*: `prsm2.html`, `app.js`: room from the URL, Yjs provider and persistence, user name, open a legacy `.prsm` via the converter,
   full-window `cy`, toolbar (add, link, delete, undo, redo, fit), zoom and status bar, alerts. Styles and table as panels/windows.
2. *Side panel*: tabs, palettes, Network tab settings that already exist (curves, cluster, layout Off/Trophic/force, snap to grid, background colour).
3. *Notes and search*: notes panels, search, badges (pin, notes, thumbs) and the voting switch.
4. *Collaboration*: awareness cursors, avatars, follow, ghost factor, users switch; history log and rollback.
5. *Analysis tab and sizing*; legend; minimap.
6. *Share, view-only, clone, rooms/projects menus, tutorial and help*.
7. *Side-by-side review* of old and new on the same maps; fix visual differences (fonts, spacing, panel behaviour) until the two are close to identical.

**Decisions needed.**
- *History/rollback*: keep the existing log and snapshots (each snapshot a v2 file; larger than now) or only keep the log text and rely on undo? Proposal: keep both, snapshots stored compressed as now.
- *Layouts*: are Barnes Hut, Force Atlas 2 and Repulsion needed under those names? Proposal: offer Off, Trophic, Fan, Force-directed (fcose) and Hierarchical (dagre, if the dependency is acceptable).
- *Badges* as image classes (proposal) rather than DOM overlay.
- *Whether prsm2.html is a separate page until the cut-over* (proposal) or an in-place replacement on a branch.
- *Size of the job*: new code is expected to be roughly 4,000 to 5,000 lines (the old file is 6,000 plus html), much of it moved rather than invented; an estimate of the token cost is 150 to 250k output tokens.

### 17.1 Decisions and step 1 result

Decisions: keep both log and compressed snapshots; layouts are Off, Trophic, Fan, Force-directed (fcose) and Hierarchical (dagre); badges are image classes; the new app is a separate page named `prsm4.html` (the current release is 3.3.3), the old app remaining until the cut-over.

Step 1 (shell) is done: `html/prsm4.html` is a copy of `prsm.html` without the Fabric toolbox, loading `js/app/app.js` and `css/prsm4.css`.

- `room.js`: room from the URL (generated and redirected if absent), server address (`?ws=` overrides; a non-standard port means `ws://host:1234`), document name `prsm4<ROOM>` so that v4 maps never share a room with older ones.
- `user.js`: the user record in local storage (`myName`), as before.
- `toolbar.js`: Add factor, Add link, Undo, Redo, Delete, Open, with the `pressed` and `disabled` states.
- `zoom.js`: the zoom slider and +/- (the slider value is the Cytoscape zoom, as before).
- `app.js`: the App class owns store, graph, editor and provider; no globals except `window.prsm` for tests. A new room is given the standard styles. Opening a file reads any legacy format through the converter.
- Verified against a real Yjs server with two clients: room sync, add, delete, undo, button states, zoom, opening a legacy map, which appeared in the other client.

Still the copy of the old markup: the side panel, search, minimap and dialogs, which are wired in the following steps.

### 17.2 Step 2 result: the side panel

- `palette.js`: 15 factor and 15 link swatches, each a small Cytoscape graph drawn with the shared stylesheet. Click applies the style to the selection; double-click opens the style editor in a dialog.
- `sidepanel.js`: panel toggle, dragging, tabs and the colour picker.
- `netsettings.js`: layout menu, curve, snap to grid and background colour. These are shared settings in `meta.settings`.
- `layouts.js`: Off, Trophic (`cy/trophic.js`), Fan, Force-directed (fcose) and Hierarchical (dagre). Only visible factors take part. Fan: selected factors form level 0; unreached factors share that column.
- The version shown is a constant in `app.js` (4.0.0).
- Verified with scripted events against a Yjs server on a legacy map, including the Fan layout.

### 17.3 Step 3 result: notes, search, badges and voting

- `badges.js`: pin, note card and thumbs (with counts) are drawn on a canvas laid over the map, using the original Bootstrap icon paths. A canvas rather than image classes, because vote counts are text and link badges sit at the link midpoint. A click just below a factor's left or right half is a vote (stored in `thumbUp`/`thumbDown`).
- `notes.js`: the draggable, resizeable Quill panel for the one selected factor or link, with created/modified details and the pin button (sets `locked`). It follows remote edits, undo and the Show notes switch. The AI and "open in a new window" buttons are hidden until later.
- `search.js`: suggestions from labels; choosing one centres the map on the factor at zoom 1.
- Show notes (`showNotes`) and Show reactions (`voting`) are shared settings in `meta.settings`.
- The converter maps the old pin (`fixed: true`) to `locked`. The store stamps edits with the user's name.

### 17.4 Problem-list fixes and step 4 (collaboration)

Fixes after review: shared editor CSS moved to `cy/editors.css`; all colour inputs use the iro.js picker through `cy/colorwell.js` (`CP.attachTo`); double-clicking a style swatch opens a single-style dialog (Save, × and Esc revert) that can be dragged; the background double-click fits the map; Cytoscape warnings that cannot be avoided (`width: label`, wheel sensitivity, overlapping edge endpoints) are filtered in `cy/graph.js`; Add link clears the selection.

Step 4: `js/app/collab.js` (`Collaboration`) draws avatars, pointers and the ghost factor from Yjs awareness (colours through the `--user-color` custom properties), follows a user when their avatar is clicked (click again to stop), renames the user, and selects a user's edits on right click. `js/app/history.js` (`History`) logs each local transaction in the shared `history` array of the document, describing it by comparing the records with the previous state, and keeps a compressed v2 snapshot of the map before each action in localForage (last 15) so that the user can roll back their own actions.

Subsequent fixes: cursor-only awareness updates move only the relevant pointer, and pan and zoom remain local unless following another user. Curve control points are kept clear of node bounds, with a straight link when there is insufficient room. Element overrides are applied after creation to avoid Cytoscape's creation-time bypass warning. Link swatches explicitly reset node padding so their end markers remain small.

### 17.5 Step 5: analysis, sizing, legend and overview

- The Analysis tab filters the local Cytoscape view without changing shared node or edge records. Radius and upstream/downstream filters can be combined with directed paths between selected factors. All-path search is bounded and reports when a map is too complex to enumerate safely.
- Sizing is a shared setting, calculated from the underlying factors and links; Off restores individual size overrides. Clustering uses the shared, undoable cluster records and supports named attributes.
- The legend displays named factor and link styles and follows the shared legend setting. The minimap is a simplified local overview with a viewport rectangle; click, drag, or use arrow keys to pan.
- Removing an expanded cluster first detaches its members so Cytoscape does not remove them and their links with the compound node. Clustering history entries name the chosen grouping; legend samples use fixed dimensions for label-sized shapes. The minimap accepts arrow keys when focused, with a visible focus indicator.

### 17.6 Step 6 in progress

The Share button opens an accessible dialog with an editable-room invitation link, QR code and clipboard action; the configured websocket override is retained in the link. Data view opens a separate tab connected to the same room, with shared edits and history, sorting, filtering, copy and undo. The map title is shared and saved in the file; pressing Enter commits a change and Escape cancels it. The Help button opens the published original user manual (which describes the older app and requires internet access).

The title dropdown provides recent titled maps and local projects, including creating a new room, adding maps to projects, and saving/loading a list. Each v4 list entry contains its websocket server and room. Lists are stored separately from the older app and older `.prsml` lists are rejected rather than pointing to different-schema rooms; conflicting project imports are reported without changing the existing list. The most recent 50 maps are retained.

When a different room has the same title as an existing map, its menu label includes the date and time; the shared map title remains unchanged. A server without `YPERSISTENCE` retains inactive rooms in memory only, so they survive participants leaving but not a server restart. Configure `YPERSISTENCE` for durable maps.

The Share dialog can create an editable clone in a new room on the same server. It snapshots the complete map, checks that the new room is empty and waits for another client to receive the snapshot before opening it. It keeps the initializing connection open until the new tab joins. Edits to either room are independent.

The Share dialog can also make a separate read-only copy, optionally allowing viewers to create an editable clone. Its read-only flag is stored with the map so a link, a reopened room and Data View retain the same interface. Map changes, including notes, votes, keyboard shortcuts and table edits, are disabled; pan, zoom, search and notes remain available. This is a UI convenience, **not server-enforced access control**.

The introductory tour uses the existing control descriptions and runs for first-time users. To see it again, open Help from the map, reset the tour from the Getting Started page of the user manual and reload the map. It is not shown for read-only copies. The published Help link still describes the older app.

## 18. Phase 8: files, import and export

The side-by-side UI review is deferred. The first file-workflow increment connects Save and Export → PRSM to a compressed native schema-v2 `.prsm` file, and Open and Replace to either that format or legacy PRSM maps. Replacement is confirmed for a non-empty shared map, and invalid or unsupported files do not replace it. The saved file contains map metadata, styles, factors, links and shared history; it is not compatible with the legacy app.

Legacy background data is retained in map metadata and in subsequent saves, but is not yet displayed or converted to region nodes. The user is warned when opening a map containing it. Links with missing endpoints in legacy files are omitted and reported. The parser converted 216 of the 217 `.prsm` files in `data/`; the remaining `styles.prsm` is invalid JSON.

Merge accepts a PRSM 4 map's sharing link and reads the source room without changing it. It matches factors by ID, then by a unique label ignoring whitespace; a changed label for the same ID creates a red dashed factor and red dashed links. Matching factors and links keep their destination style and receive the source note. New factors and links retain their source styles, with conflicting style IDs remapped. The merge is one undoable transaction and is recorded in history. Ambiguous factor labels and differing attribute titles stop the merge without changes. Source backgrounds are not merged and are reported.

Excel import supports `Factors` and `Links` worksheets, including labels, numbered styles, positions, plain-text notes and attributes. Excel export adds IDs so links remain unambiguous when factor labels repeat. It is an interchange format: rich note formatting and custom style definitions are not preserved. CSV import reads an edge list with a header, source and target labels, and optional source, target and link style numbers. Invalid files are rejected before replacing the map.

GraphML and GEXF can be opened and exported as interchange formats. Basic labels, positions, plain-text notes and attributes are imported; simple colours and link weights are also read where available. Missing or colliding link IDs are remapped, dangling links are omitted, and undirected links become directed; these changes are reported. Nested graphs and ambiguous repeated attributes are rejected. Advanced formatting, undeclared attributes, defaults and dynamic graph features may be omitted. Exports retain labels, positions, plain notes, attributes and link widths, but not full PRSM styling; cluster records and links to omitted factors are excluded. Use native PRSM files for a complete backup.

GML import and export cover factors, links, labels, positions, simple colours and plain-text notes. GML exports use numeric factor IDs and omit attributes, most styling, clusters and links to omitted factors. Unsupported properties may be omitted on import; dangling links and conversion of undirected links are reported.

Graphviz DOT/GV import and export support labels, simple colours, positions and plain-text notes. Imports handle node and edge defaults, subgraphs, edge chains and strict graphs; undirected links become directed and unsupported properties may be omitted. HTML labels are rejected rather than silently discarded. Exports omit attributes, most styling, clusters and links to omitted factors; notes and link IDs use PRSM-specific DOT attributes. PRSM coordinates are retained as Graphviz `pos` values, although Graphviz layout engines may change positions.

Image export renders an 8192 × 8192 pixel PNG on a separate Cytoscape graph, independent of screen zoom and pixel density. The whole visible map is framed when nothing is selected; selected factors determine the centre and scale otherwise, with nearby map content also visible. Selection highlights are omitted. The map background colour is included, but the HTML legend and retained legacy background objects are not. Export reports an error if the browser cannot allocate or encode an image at the required dimensions. PNG pixel dimensions are fixed; the physical print size depends on the resolution chosen when placing the image in a publication.

Notes export produces a Word `.docx` containing the map title, retained description, alphabetically sorted factors and then links, including `[No note]` for items without notes. It retains supported Quill text formatting, hyperlinks, lists and embedded PNG images. Other image types and externally hosted images are omitted and reported; unsupported embedded items cause an explicit error. Cluster records and links without two ordinary factors are excluded.

Still to do: background conversion. Kumu and draw.io are intentionally excluded from PRSM 4 because their earlier importers were unreliable and rarely used.
