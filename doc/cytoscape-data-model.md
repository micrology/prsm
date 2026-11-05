# PRSM on Cytoscape: data model, file format and legacy mapping (draft 1)

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
