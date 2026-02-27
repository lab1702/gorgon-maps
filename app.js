// app.js — Cytoscape graph with Dagre layout for Project Gorgon zone map

/**
 * Compute node color based on the minimum level parsed from the levels string.
 */
function getLevelColor(levels) {
  if (levels === 'any') return '#5a8ab3';
  const minLevel = parseInt(levels.split('-')[0], 10);
  if (isNaN(minLevel)) return '#5a8ab3';
  if (minLevel <= 10) return '#4a9e4a';
  if (minLevel <= 25) return '#5ab35a';
  if (minLevel <= 40) return '#c4a83c';
  if (minLevel <= 60) return '#d4853c';
  if (minLevel <= 75) return '#c45a5a';
  return '#8a5ab3';
}

/**
 * Compute a dagre rank tier for vertical ordering by level.
 */
function getLevelRank(levels) {
  if (levels === 'any') return 3;
  const minLevel = parseInt(levels.split('-')[0], 10);
  if (isNaN(minLevel)) return 3;
  if (minLevel <= 10) return 0;
  if (minLevel <= 25) return 1;
  if (minLevel <= 40) return 2;
  if (minLevel <= 50) return 3;
  if (minLevel <= 65) return 4;
  if (minLevel <= 80) return 5;
  return 6;
}

/**
 * Convert zones.json data into Cytoscape elements (nodes + deduplicated edges).
 */
function buildElements(zones) {
  const nodes = [];
  const edges = [];
  const edgeSet = new Set();

  for (const [zoneName, zone] of Object.entries(zones)) {
    nodes.push({
      data: {
        id: zoneName,
        label: zoneName,
        levels: zone.levels,
        type: zone.type,
        map_file: zone.map_file,
        hasMap: !!zone.map_file,
        color: getLevelColor(zone.levels),
        rank: getLevelRank(zone.levels)
      }
    });

    for (const target of zone.connections) {
      // Deduplicate: only create edge once, using alphabetical ordering
      const source = zoneName < target ? zoneName : target;
      const dest = zoneName < target ? target : zoneName;
      const edgeKey = `${source}|||${dest}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        const sourceType = zones[source] ? zones[source].type : 'dungeon';
        const destType = zones[dest] ? zones[dest].type : 'dungeon';
        const edgeType = (sourceType === 'overworld' && destType === 'overworld')
          ? 'overworld'
          : 'dungeon';
        edges.push({
          data: {
            source: source,
            target: dest,
            edgeType: edgeType
          }
        });
      }
    }
  }

  return [...nodes, ...edges];
}

/**
 * Cytoscape style array.
 */
const graphStyle = [
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
      'background-color': 'data(color)',
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
      'background-color': 'data(color)',
      'background-opacity': 0.6,
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
];

/**
 * Set up click-to-highlight interaction.
 */
function setupHighlighting(cy) {
  cy.on('tap', 'node', function (e) {
    const node = e.target;

    // Clear all classes first
    cy.elements().removeClass('highlighted neighbor dimmed');

    // Highlight tapped node
    node.addClass('highlighted');

    // Highlight neighbors
    node.neighborhood().nodes().addClass('neighbor');

    // Highlight connected edges
    node.connectedEdges().addClass('highlighted');

    // Dim everything else
    cy.elements().not(node).not(node.neighborhood().nodes()).not(node.connectedEdges()).addClass('dimmed');
  });

  cy.on('tap', function (e) {
    if (e.target === cy) {
      cy.elements().removeClass('highlighted neighbor dimmed');
    }
  });
}

/**
 * Set up tooltip on hover.
 */
function setupTooltip(cy) {
  const tooltip = document.getElementById('tooltip');

  cy.on('mouseover', 'node', function (e) {
    const node = e.target;
    const name = node.data('label');
    const levels = node.data('levels');
    const hasMap = node.data('hasMap');
    const connectionCount = node.connectedEdges().length;

    tooltip.innerHTML =
      `<strong>${name}</strong><br>` +
      `Levels: ${levels}<br>` +
      `${connectionCount} connection${connectionCount !== 1 ? 's' : ''}` +
      (hasMap ? '<br><em>Click to view map</em>' : '');

    // Position near the node
    const pos = node.renderedPosition();
    let left = pos.x + 15;
    let top = pos.y + 15;

    // Keep tooltip within viewport bounds
    const tooltipRect = tooltip.getBoundingClientRect();
    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;

    // We need to show it first to measure, so set position then adjust
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');

    // Adjust after rendering so we can measure
    const rect = tooltip.getBoundingClientRect();
    if (rect.right > vpWidth) {
      left = pos.x - rect.width - 15;
    }
    if (rect.bottom > vpHeight) {
      top = pos.y - rect.height - 15;
    }
    if (left < 0) left = 5;
    if (top < 0) top = 5;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  });

  cy.on('mouseout', 'node', function () {
    tooltip.classList.remove('visible');
  });
}

/**
 * Main initialization: fetch data, build graph, attach interactions.
 */
async function init() {
  const response = await fetch('data/zones.json');
  const zones = await response.json();
  const elements = buildElements(zones);

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: graphStyle,
    minZoom: 0.3,
    maxZoom: 3,
    wheelSensitivity: 0.3,
    layout: {
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 60,
      rankSep: 80,
      edgeSep: 20,
      // Sort nodes by level rank tier so lower-level zones appear higher
      sort: function (a, b) {
        return (a.data('rank') || 0) - (b.data('rank') || 0);
      }
    }
  });

  setupHighlighting(cy);
  setupTooltip(cy);
}

init();
