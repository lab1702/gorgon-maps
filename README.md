# Gorgon Maps

Interactive zone map viewer and connection graph for [Project Gorgon](https://projectgorgon.com/).

Browse 59 zones — 15 overworld areas and 44 dungeons — as a hierarchical graph color-coded by level range. Double-click any zone to view its full map with zoom and pan.

## Running locally

No build step required. Serve the static files with any HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

| Action | Input |
|--------|-------|
| Select a zone | Click node |
| Select multiple zones | Ctrl+click |
| View zone map | Double-click node |
| Zoom map | Mouse wheel / +/- keys |
| Pan map | Click and drag |
| Close map | Escape |

## Project structure

```
index.html              Entry point
app.js                  Application logic (Cytoscape graph + lightbox)
style.css               Dark-theme styling
data/zones.json         Zone metadata (connections, levels, map files)
maps/                   Zone map images (PNG)
```

### Data extraction scripts

These one-time Python scripts extract data from Project Gorgon's Unity game files:

- `extract_connections.py` — parse zone connections from asset files (requires UnityPy)
- `extract_maps.py` — extract map images from game assets
- `build_graph.py` — enrich raw connections with level ranges into `data/zones.json`

## Tech stack

- [Cytoscape.js](https://js.cytoscape.org/) with dagre layout for graph rendering
- Vanilla HTML/CSS/JS, no build tools
- Cytoscape loaded from unpkg CDN
