# Project Gorgon Interactive Map Viewer — Design

## Purpose

Community-facing web tool for Project Gorgon players. Provides a hierarchical zone connection graph as the primary navigation, with a lightbox map viewer triggered by clicking any zone node.

## Architecture

Single-page static site. No build step — open `index.html` directly or serve from any static host.

```
gorgon-maps/
├── index.html
├── app.js
├── style.css
├── data/
│   └── zones.json          (zone connections + level ranges + map filenames)
├── maps/                    (83 extracted PNGs, up to 2048x2048)
└── lib/                     (optional local copies)
    ├── cytoscape.min.js
    └── cytoscape-dagre.js
```

Dependencies (CDN): Cytoscape.js + cytoscape-dagre layout plugin. No other libraries.

## Graph View

- Full-viewport Cytoscape canvas with Dagre hierarchical layout
- Nodes organized by level progression: Anagoge at top, high-level zones at bottom
- **Overworld nodes**: larger, colored by level range (greens low, golds mid, reds/purples high), show zone name + level range
- **Dungeon nodes**: smaller, muted color, positioned near parent overworld zone
- **Edges**: solid for overworld-to-overworld, dashed for overworld-to-dungeon
- Click node: highlight it + connected nodes/edges, dim the rest
- Hover: tooltip with zone name, level range, connection count
- Zoom/pan: built-in Cytoscape controls

## Map Lightbox

- Triggered by clicking a zone node that has a map image
- Dark semi-transparent backdrop
- Map image at native resolution, fit-to-viewport if larger
- Mouse wheel zoom, click-drag pan within lightbox
- Zone name header, X button or backdrop-click to dismiss
- Left/right navigation arrows to step through connected zones

## Data

`zones.json` enriches the extracted `zone_connections.json` with level ranges:

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

59 zones total: 15 overworld, 44 dungeons. 83 map images (some zones share maps or lack them).

## Visual Design

- Dark theme (game-appropriate, easy on eyes)
- Color palette: earthy greens, warm golds, icy blues scaling with zone level
- Clean sans-serif font
- Minimal chrome — the graph is the UI

## Tech Decisions

- **Cytoscape.js + Dagre** over D3 or hand-drawn SVG: built-in hierarchical layout, interactive graph for free, small codebase
- **Custom lightbox** over a library: CSS transforms for zoom/pan, keeps dependencies minimal
- **Vanilla HTML/JS/CSS** over React/Svelte: no build step, community can fork/host easily
