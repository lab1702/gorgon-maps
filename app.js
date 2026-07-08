// app.js — Cytoscape graph with Dagre layout for Project Gorgon zone map

/**
 * Compute node color based on the minimum level parsed from the levels string.
 */
function getLevelColor(levels) {
  // Hex equivalents of oklch level-ramp tokens (canvas can't use CSS vars)
  if (levels === 'any') return '#6c9ab0';
  const minLevel = parseInt(levels.split('-')[0], 10);
  if (isNaN(minLevel)) return '#6c9ab0';
  if (minLevel <= 10) return '#6dba70';
  if (minLevel <= 25) return '#b6b84d';
  if (minLevel <= 40) return '#e4a339';
  if (minLevel <= 60) return '#e28247';
  if (minLevel <= 75) return '#d46660';
  return '#9c70bc';
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
      'font-family': 'JetBrains Mono, monospace',
      'font-size': 13,
      'color': '#e8e5d6',
      'text-outline-color': '#0c0b07',
      'text-outline-width': 2,
      'text-wrap': 'wrap',
      'text-max-width': 80,
      'width': 50,
      'height': 50,
      'shape': 'ellipse',
      'background-color': 'data(color)',
      'border-width': 2,
      'border-color': '#e8e5d6',
      'border-opacity': 0.19
    }
  },
  {
    selector: 'node[type="dungeon"]',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'font-family': 'JetBrains Mono, monospace',
      'font-size': 10,
      'color': '#a29f91',
      'text-outline-color': '#0c0b07',
      'text-outline-width': 2,
      'text-wrap': 'wrap',
      'text-max-width': 60,
      'width': 30,
      'height': 30,
      'shape': 'round-rectangle',
      'background-color': 'data(color)',
      'background-opacity': 0.6,
      'border-width': 1,
      'border-color': '#e8e5d6',
      'border-opacity': 0.125
    }
  },
  {
    selector: 'edge[edgeType="overworld"]',
    style: {
      'width': 3,
      'line-color': '#4f4d41',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none'
    }
  },
  {
    selector: 'edge[edgeType="dungeon"]',
    style: {
      'width': 1.5,
      'line-color': '#353329',
      'line-style': 'dashed',
      'curve-style': 'bezier',
      'target-arrow-shape': 'none'
    }
  },
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 3,
      'border-color': '#f9ad26',
      'border-opacity': 1,
      'z-index': 10
    }
  },
  {
    selector: 'node.neighbor',
    style: {
      'border-color': '#f9ad26',
      'border-opacity': 0.5,
      'z-index': 9
    }
  },
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.5
    }
  },
  {
    selector: 'edge.highlighted',
    style: {
      'line-color': '#f9ad26',
      'width': 3,
      'z-index': 10
    }
  },
  {
    selector: 'edge.dimmed',
    style: {
      'opacity': 0.5
    }
  }
];

/**
 * Set up click-to-highlight interaction.
 * @param {object} cy - Cytoscape instance
 * @param {function} [openLightbox] - Optional callback to open lightbox for a zone
 */
function setupHighlighting(cy, openLightbox) {
  function updateHighlighting() {
    const selected = cy.nodes('.highlighted');
    cy.elements().removeClass('neighbor dimmed');
    cy.edges().removeClass('highlighted');

    if (selected.length === 0) return;

    // Collect all neighbors and connected edges of selected nodes
    let neighbors = cy.collection();
    let connectedEdges = cy.collection();
    selected.forEach(function (node) {
      neighbors = neighbors.union(node.neighborhood().nodes());
      connectedEdges = connectedEdges.union(node.connectedEdges());
    });

    // Also highlight edges between selected nodes
    const interEdges = selected.edgesWith(selected);
    connectedEdges = connectedEdges.union(interEdges);

    neighbors.not(selected).addClass('neighbor');
    connectedEdges.addClass('highlighted');
    cy.elements().not(selected).not(neighbors).not(connectedEdges).addClass('dimmed');
  }

  // Single click: highlight only (Ctrl+click to add to selection)
  cy.on('tap', 'node', function (e) {
    const node = e.target;
    if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
      // Toggle this node's selection
      if (node.hasClass('highlighted')) {
        node.removeClass('highlighted');
      } else {
        node.addClass('highlighted');
      }
    } else {
      // Replace selection
      cy.elements().removeClass('highlighted neighbor dimmed');
      node.addClass('highlighted');
    }
    updateHighlighting();
  });

  // Double click: highlight + open lightbox
  cy.on('dbltap', 'node', function (e) {
    const node = e.target;
    cy.elements().removeClass('highlighted neighbor dimmed');
    node.addClass('highlighted');
    updateHighlighting();
    if (openLightbox) {
      openLightbox(node.data('id'));
    }
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

    const strong = document.createElement('strong');
    strong.textContent = name;
    tooltip.replaceChildren(
      strong,
      document.createElement('br'),
      document.createTextNode(`Levels: ${levels}`),
      document.createElement('br'),
      document.createTextNode(`${connectionCount} connection${connectionCount !== 1 ? 's' : ''}`)
    );
    const em = document.createElement('em');
    em.textContent = hasMap ? 'Double-click to view map' : 'Double-click for details';
    tooltip.appendChild(document.createElement('br'));
    tooltip.appendChild(em);

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
 * Set up lightbox for viewing zone maps with zoom/pan and neighbor navigation.
 * Returns an openLightbox(zoneName) function for use by other handlers.
 */
function setupLightbox(cy, zones) {
  const lightbox = document.getElementById('lightbox');
  const headerH2 = lightbox.querySelector('.lightbox-header h2');
  const levelsSpan = lightbox.querySelector('.lightbox-header .levels');
  const closeBtn = lightbox.querySelector('.close-btn');
  const body = lightbox.querySelector('.lightbox-body');
  const loadingMsg = body.querySelector('.lightbox-loading');
  const img = body.querySelector('img');
  // Zoom/pan state
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function applyTransform() {
    img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  /**
   * Open the lightbox for a given zone name.
   */
  function openLightbox(zoneName) {
    const zone = zones[zoneName];
    if (!zone) return;

    headerH2.textContent = zoneName;
    levelsSpan.textContent = `Levels: ${zone.levels}`;

    if (zone.map_file) {
      // Show map image
      img.style.display = '';
      img.style.visibility = 'hidden';
      loadingMsg.textContent = 'Loading map...';
      loadingMsg.classList.add('visible');
      img.onload = function () {
        loadingMsg.classList.remove('visible');
        img.style.visibility = '';
      };
      img.src = `maps/${zone.map_file}`;
      img.alt = `Map of ${zoneName}`;
    } else {
      // No map available
      img.style.display = 'none';
      loadingMsg.textContent = 'No map available for this zone';
      loadingMsg.classList.add('visible');
    }

    resetTransform();

    lightbox.classList.add('open');

    // Update URL hash for shareable links
    location.hash = encodeURIComponent(zoneName);
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    // Clear URL hash when closing
    history.replaceState(null, '', location.pathname + location.search);
  }

  // --- Close handlers ---

  closeBtn.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', function (e) {
    // Close on backdrop click (click directly on #lightbox, not its children)
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (lightbox.classList.contains('open')) {
        closeLightbox();
      } else {
        cy.elements().removeClass('highlighted neighbor dimmed');
      }
      return;
    }

    if (!lightbox.classList.contains('open')) return;

    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        scale = Math.min(8, scale * 1.15);
        applyTransform();
        break;
      case '-':
        e.preventDefault();
        scale = Math.max(0.5, scale * 0.87);
        applyTransform();
        break;
    }
  });

  // --- Mouse wheel zoom ---

  body.addEventListener('wheel', function (e) {
    e.preventDefault();
    scale *= Math.pow(0.997, e.deltaY);
    // Clamp between 0.5 and 8
    scale = Math.max(0.5, Math.min(8, scale));
    applyTransform();
  }, { passive: false });

  // --- Click-drag pan ---

  body.addEventListener('mousedown', function (e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    body.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    // Divide by scale so panning feels consistent at any zoom level
    translateX += dx / scale;
    translateY += dy / scale;
    applyTransform();
  });

  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    body.classList.remove('dragging');
  });

  // --- Touch support (single-finger drag + pinch-to-zoom) ---

  let touchStartDist = 0;
  let touchStartScale = 1;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let isTouchDragging = false;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  body.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      // Pinch-to-zoom start
      e.preventDefault();
      touchStartDist = getTouchDistance(e.touches);
      touchStartScale = scale;
      isTouchDragging = false;
    } else if (e.touches.length === 1) {
      // Single-finger drag start
      isTouchDragging = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }, { passive: false });

  body.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2) {
      // Pinch-to-zoom
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      const ratio = currentDist / touchStartDist;
      scale = Math.max(0.5, Math.min(8, touchStartScale * ratio));
      applyTransform();
      isTouchDragging = false;
    } else if (e.touches.length === 1 && isTouchDragging) {
      // Single-finger drag
      e.preventDefault();
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      translateX += dx / scale;
      translateY += dy / scale;
      applyTransform();
    }
  }, { passive: false });

  body.addEventListener('touchend', function () {
    isTouchDragging = false;
  });

  return openLightbox;
}

/**
 * Main initialization: fetch data, build graph, attach interactions.
 */
async function init() {
  let zones;
  try {
    const response = await fetch('data/zones.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    zones = await response.json();
  } catch (err) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.textContent = 'Failed to load zone data. Try refreshing the page.';
      loadingEl.style.color = '#f2716a';
    }
    console.error('Failed to load zone data:', err);
    return;
  }
  const elements = buildElements(zones);

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: graphStyle,
    minZoom: 0.3,
    maxZoom: 3,
    wheelSensitivity: 3,
    layout: { name: 'preset' } // start with no layout; run dagre after registering listeners
  });

  const openLightbox = setupLightbox(cy, zones);
  setupHighlighting(cy, openLightbox);
  setupTooltip(cy);

  // Remove loading indicator and handle URL hash navigation once layout finishes
  cy.one('layoutstop', function () {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.remove();
    }
    cy.fit(undefined, 40);

    // URL hash navigation: open zone from hash on startup
    if (location.hash) {
      const zoneName = decodeURIComponent(location.hash.slice(1));
      if (zoneName && zones[zoneName]) {
        const node = cy.getElementById(zoneName);
        if (node && node.length > 0) {
          cy.elements().removeClass('highlighted neighbor dimmed');
          node.addClass('highlighted');
          node.neighborhood().nodes().addClass('neighbor');
          node.connectedEdges().addClass('highlighted');
          cy.elements().not(node).not(node.neighborhood().nodes()).not(node.connectedEdges()).addClass('dimmed');
          cy.animate({ center: { eles: node }, duration: 300 });
          openLightbox(zoneName);
        }
      }
    }
  });

  // Run dagre layout now that the layoutstop listener is registered
  cy.layout({
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 50,
    rankSep: 100,
    edgeSep: 20,
    ranker: 'tight-tree',
    sort: function (a, b) {
      return (a.data('rank') || 0) - (b.data('rank') || 0);
    }
  }).run();
}

init();
