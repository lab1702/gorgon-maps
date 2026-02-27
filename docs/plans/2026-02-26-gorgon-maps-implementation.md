# Project Gorgon Interactive Map Viewer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page static web app that displays all Project Gorgon zones as an interactive hierarchical graph, with a lightbox map viewer triggered by clicking any zone.

**Architecture:** Vanilla HTML/JS/CSS, no build step. Cytoscape.js + cytoscape-dagre from CDN for the graph. Custom lightbox with CSS transforms for zoom/pan. All data pre-baked into `data/zones.json`.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES modules), Cytoscape.js 3.x, cytoscape-dagre

---

### Task 1: Create enriched zones.json data file

**Files:**
- Create: `data/zones.json`

**Step 1: Create the data directory and zones.json**

Take the existing `zone_connections.json` and enrich every zone with a `levels` field. Use these level ranges from the wiki:

Overworld:
- Anagoge Island: "1-10"
- Serbule: "1-30"
- Serbule Hills: "1-25"
- Eltibule: "15-40"
- Sun Vale: "20-40"
- Kur Mountains: "35-50"
- Ilmari: "45-60"
- Rahu: "50-65"
- Gazluk: "70-75"
- Fae Realm: "70-80"
- Povus: "75-85"
- Red Wing Casino: "any"
- Vidaria: "90-95"
- Statehelm: "80-100"
- Phantom Ilmari Desert: "1-25"

Dungeons: inherit level range from their primary parent overworld zone. For dungeons connected only to other dungeons (e.g. Aktaari Cave -> Errruka's Cave -> Povus), trace up to the nearest overworld zone.

Write to `data/zones.json`. Format:

```json
{
  "Serbule": {
    "connections": ["Eltibule", "Sun Vale", "Serbule Hills", "Anagoge Island"],
    "map_file": "Map_AreaSerbule.png",
    "type": "overworld",
    "levels": "1-30"
  }
}
```

**Step 2: Verify the file is valid JSON**

Run: `python3 -c "import json; d=json.load(open('data/zones.json')); print(f'{len(d)} zones loaded')" `
Expected: `59 zones loaded`

**Step 3: Commit**

```bash
git add data/zones.json
git commit -m "feat: add enriched zones.json with level ranges"
```

---

### Task 2: Create HTML skeleton and CSS dark theme

**Files:**
- Create: `index.html`
- Create: `style.css`

**Step 1: Create index.html**

Minimal HTML shell:
- `<!DOCTYPE html>` with viewport meta, charset, title "Project Gorgon Map Viewer"
- Link to `style.css`
- CDN scripts: cytoscape.js (https://unpkg.com/cytoscape@3/dist/cytoscape.min.js), dagre (https://unpkg.com/dagre@0.8/dist/dagre.min.js), cytoscape-dagre (https://unpkg.com/cytoscape-dagre@2/cytoscape-dagre.js)
- Body contains:
  - `<div id="cy">` — full viewport, the Cytoscape container
  - `<div id="lightbox">` — hidden overlay for map viewer, contains:
    - `<div class="lightbox-header">` — zone name `<h2>`, level range `<span>`, close `<button>`
    - `<div class="lightbox-body">` — `<img>` for the map, will get zoom/pan transforms
    - `<div class="lightbox-nav">` — prev/next buttons for connected zones
  - `<div id="tooltip">` — absolutely-positioned tooltip, hidden by default
- `<script type="module" src="app.js"></script>` at end of body

**Step 2: Create style.css**

Dark theme styles:
- `body`: margin 0, overflow hidden, background `#1a1a2e`, color `#e0e0e0`, font-family `'Segoe UI', system-ui, sans-serif`
- `#cy`: width 100vw, height 100vh
- `#tooltip`: position absolute, background `rgba(20, 20, 40, 0.95)`, border `1px solid #3a3a5c`, border-radius 8px, padding 10px 14px, pointer-events none, opacity 0, transition opacity 0.15s, z-index 100, max-width 220px, font-size 13px
- `#tooltip.visible`: opacity 1
- `#lightbox`: position fixed, inset 0, background `rgba(0,0,0,0.85)`, display none, z-index 200, flex-direction column, align-items center, justify-content center
- `#lightbox.open`: display flex
- `.lightbox-header`: display flex, align-items center, gap 16px, padding 16px 24px, width 100%
- `.lightbox-header h2`: margin 0, font-size 24px, color `#f0f0f0`
- `.lightbox-header .levels`: color `#aaa`, font-size 14px
- `.lightbox-header .close-btn`: margin-left auto, background none, border none, color `#888`, font-size 28px, cursor pointer
- `.lightbox-body`: flex 1, display flex, align-items center, justify-content center, overflow hidden, width 100%, position relative, cursor grab
- `.lightbox-body.dragging`: cursor grabbing
- `.lightbox-body img`: max-width 90vw, max-height 75vh, object-fit contain, transform-origin center center, transition transform 0.1s ease-out, user-select none, -webkit-user-drag none
- `.lightbox-nav`: display flex, gap 12px, padding 16px, align-items center
- `.lightbox-nav button`: background `#2a2a4a`, border `1px solid #4a4a6a`, color `#e0e0e0`, padding 8px 20px, border-radius 6px, cursor pointer, font-size 14px
- `.lightbox-nav button:hover`: background `#3a3a5a`
- `.lightbox-nav button:disabled`: opacity 0.3, cursor default

**Step 3: Verify HTML loads without errors**

Open `index.html` in a browser or run:
```bash
python3 -m http.server 8000 &
curl -s http://localhost:8000/index.html | head -5
kill %1
```
Expected: returns the HTML doctype and head.

**Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: add HTML skeleton and dark theme CSS"
```

---

### Task 3: Build Cytoscape graph with Dagre layout

**Files:**
- Create: `app.js`

**Step 1: Write app.js — data loading and graph initialization**

The file should:

1. Fetch `data/zones.json`
2. Convert to Cytoscape elements array:
   - For each zone, create a node: `{ data: { id: zoneName, label: zoneName, levels: zone.levels, type: zone.type, map_file: zone.map_file, hasMap: !!zone.map_file } }`
   - For each zone's connections, create an edge (deduplicated — only create edge if `source < target` alphabetically to avoid duplicates): `{ data: { source: zoneName, target: connectedZone, edgeType: bothOverworld ? 'overworld' : 'dungeon' } }`
3. Initialize Cytoscape on `#cy` with:
   - `layout`: dagre with `rankDir: 'TB'`, `nodeSep: 60`, `rankSep: 80`, `edgeSep: 20`. Set `rank` function that returns a tier based on min level (parse from `levels` string): tier 0 for "1-10", tier 1 for "1-25"/"1-30", tier 2 for "15-40"/"20-40", tier 3 for "35-50"/"45-60", tier 4 for "50-65", tier 5 for "70-75"/"70-80"/"75-85", tier 6 for "80-100"/"90-95", tier 7 for "any".
   - `style`: array of style rules (see step 2)
   - `minZoom: 0.3`, `maxZoom: 3`, `wheelSensitivity: 0.3`

**Step 2: Define node/edge color scheme**

Node colors by minimum level (parse first number from `levels` string):
- 1-10: `#4a9e4a` (earthy green)
- 11-25: `#5ab35a` (lighter green)
- 26-40: `#c4a83c` (gold)
- 41-60: `#d4853c` (amber)
- 61-75: `#c45a5a` (warm red)
- 76-100: `#8a5ab3` (purple)
- "any": `#5a8ab3` (blue)

Cytoscape style array:
```javascript
[
  {
    selector: 'node[type="overworld"]',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'font-size': 12,
      'color': '#d0d0d0',
      'text-outline-color': '#1a1a2e',
      'text-outline-width': 2,
      'width': 50,
      'height': 50,
      'shape': 'ellipse',
      'background-color': function mapped by level,
      'border-width': 2,
      'border-color': '#ffffff30'
    }
  },
  {
    selector: 'node[type="dungeon"]',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'font-size': 10,
      'color': '#999',
      'text-outline-color': '#1a1a2e',
      'text-outline-width': 2,
      'width': 30,
      'height': 30,
      'shape': 'round-rectangle',
      'background-color': same function but with 0.6 opacity,
      'border-width': 1,
      'border-color': '#ffffff20'
    }
  },
  {
    selector: 'edge[edgeType="overworld"]',
    style: {
      'width': 3,
      'line-color': '#4a4a6a',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none'
    }
  },
  {
    selector: 'edge[edgeType="dungeon"]',
    style: {
      'width': 1.5,
      'line-color': '#3a3a5a',
      'line-style': 'dashed',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none'
    }
  },
  // Highlight styles for selected node + neighbors
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 3,
      'border-color': '#ffd700',
      'z-index': 10
    }
  },
  {
    selector: 'node.neighbor',
    style: {
      'border-color': '#ffd70080',
      'z-index': 9
    }
  },
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.2
    }
  },
  {
    selector: 'edge.highlighted',
    style: {
      'line-color': '#ffd700',
      'width': 3,
      'z-index': 10
    }
  },
  {
    selector: 'edge.dimmed',
    style: {
      'opacity': 0.15
    }
  }
]
```

Use `data()` mapper for background-color: store the hex color directly in node data as a `color` field computed during element creation.

**Step 3: Add node interaction — click highlight**

On `cy.on('tap', 'node', ...)`:
1. Remove all highlight/dim/neighbor classes
2. Add `.highlighted` to tapped node
3. Add `.neighbor` to all connected nodes (`node.neighborhood().nodes()`)
4. Add `.highlighted` to all connected edges (`node.connectedEdges()`)
5. Add `.dimmed` to all other nodes and edges

On `cy.on('tap', ...)` (background tap):
1. Remove all highlight/dim/neighbor classes (reset)

**Step 4: Add tooltip on hover**

On `cy.on('mouseover', 'node', ...)`:
1. Get `#tooltip` element
2. Set innerHTML: zone name (bold), level range, number of connections, "(click to view map)" if hasMap
3. Position tooltip near the node using `renderedPosition` + offset
4. Add `.visible` class

On `cy.on('mouseout', 'node', ...)`:
1. Remove `.visible` class from tooltip

**Step 5: Verify graph renders**

Run: `python3 -m http.server 8000` and open browser to localhost:8000
Expected: see a dark-themed hierarchical graph of all 59 zones with proper colors and layout

**Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add Cytoscape graph with Dagre layout, highlighting, and tooltips"
```

---

### Task 4: Build map lightbox with zoom/pan

**Files:**
- Modify: `app.js` — add lightbox logic

**Step 1: Add lightbox open on node click**

Extend the existing `cy.on('tap', 'node', ...)` handler. After highlighting, if the node has a map_file:
1. Set lightbox header h2 text to zone name
2. Set lightbox `.levels` span to level range
3. Set lightbox img src to `maps/${map_file}`
4. Reset zoom/pan state (scale = 1, translateX = 0, translateY = 0)
5. Store current zone ID and its connected zones (that have maps) for prev/next nav
6. Update prev/next button states (disabled if no prev/next)
7. Add `.open` class to `#lightbox`

**Step 2: Add lightbox close**

- Close button click: remove `.open` class
- Backdrop click (click on `#lightbox` itself, not children): remove `.open` class
- Escape key: remove `.open` class

**Step 3: Add mouse wheel zoom**

On `wheel` event on `.lightbox-body`:
1. Prevent default
2. Adjust scale: `scale *= e.deltaY < 0 ? 1.15 : 0.87` (clamped to 0.5–8)
3. Apply transform to img: `transform: scale(${scale}) translate(${tx}px, ${ty}px)`

**Step 4: Add click-drag pan**

On `mousedown` on `.lightbox-body`:
1. Record start position, set dragging flag, add `.dragging` class
On `mousemove` (document-level while dragging):
1. Update translateX/Y by delta from last position
2. Apply transform
On `mouseup`:
1. Clear dragging flag, remove `.dragging` class

**Step 5: Add prev/next navigation**

Store an array of navigable connected zones (those with map files). Prev/next buttons cycle through them:
1. On click, load the new zone's map, update header, update nav buttons
2. Also highlight the new node in the graph behind the lightbox

**Step 6: Verify lightbox works**

Run local server, click a zone node (e.g. Serbule), verify:
- Lightbox opens with map image
- Scroll to zoom works
- Drag to pan works
- Prev/next navigates to connected zones
- Clicking backdrop or X closes
- Escape key closes

**Step 7: Commit**

```bash
git add app.js style.css
git commit -m "feat: add map lightbox with zoom, pan, and zone navigation"
```

---

### Task 5: Polish and final details

**Files:**
- Modify: `index.html` — add favicon, meta description
- Modify: `style.css` — responsive tweaks, animations
- Modify: `app.js` — edge cases, loading state

**Step 1: Add loading state**

Before Cytoscape initializes, show a centered "Loading..." text in `#cy`. Remove it after layout completes (`cy.on('layoutstop', ...)`).

**Step 2: Add URL hash navigation**

When a zone is selected, update `location.hash` to `#ZoneName`. On page load, if hash is set, auto-select that zone and open its lightbox. This lets users share links to specific zones.

**Step 3: Add keyboard navigation**

- When lightbox is open: left/right arrow keys for prev/next, escape to close
- `+`/`-` keys for zoom in lightbox

**Step 4: Add touch support for lightbox**

- Pinch-to-zoom on the lightbox image (track two-touch distance delta)
- Single-finger drag for pan

**Step 5: Responsive text sizing**

On small screens (< 768px):
- Reduce node label font sizes
- Make lightbox nav buttons larger (touch targets)
- Lightbox image max-width: 95vw

**Step 6: Add a small legend**

Bottom-left corner of the graph view, a small semi-transparent box:
- Colored circles for level range tiers
- Square icon = dungeon, circle = overworld
- "Click zone to view map"

**Step 7: Verify everything**

Run local server, test:
- Graph loads, layout looks hierarchical
- Tooltip on hover
- Click highlights node + neighbors
- Click opens lightbox for zones with maps
- Zoom/pan in lightbox
- Prev/next navigation
- URL hash updates and works on reload
- Keyboard shortcuts
- Legend visible

**Step 8: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: add polish - loading state, hash nav, keyboard, touch, legend"
```

---

### Task 6: Final review and cleanup

**Files:**
- All files

**Step 1: Review all files for correctness**

- Verify `data/zones.json` has all 59 zones with correct connections and level ranges
- Verify no console errors in browser
- Verify all map images load (no 404s)

**Step 2: Add .gitignore**

```
.venv/
__pycache__/
*.pyc
```

**Step 3: Final commit**

```bash
git add .gitignore
git commit -m "chore: add gitignore, cleanup"
```
