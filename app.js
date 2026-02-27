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
 * @param {object} cy - Cytoscape instance
 * @param {function} [openLightbox] - Optional callback to open lightbox for a zone
 */
function setupHighlighting(cy, openLightbox) {
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

    // Open lightbox if the node has a map
    if (node.data('hasMap') && openLightbox) {
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
 * Set up lightbox for viewing zone maps with zoom/pan and neighbor navigation.
 * Returns an openLightbox(zoneName) function for use by other handlers.
 */
function setupLightbox(cy, zones) {
  const lightbox = document.getElementById('lightbox');
  const headerH2 = lightbox.querySelector('.lightbox-header h2');
  const levelsSpan = lightbox.querySelector('.lightbox-header .levels');
  const closeBtn = lightbox.querySelector('.close-btn');
  const body = lightbox.querySelector('.lightbox-body');
  const img = body.querySelector('img');
  const prevBtn = lightbox.querySelector('.lightbox-nav .prev');
  const nextBtn = lightbox.querySelector('.lightbox-nav .next');
  const navLabel = lightbox.querySelector('.lightbox-nav .nav-label');

  // Zoom/pan state
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  // Navigation state
  let currentZoneName = null;
  let navigableNeighbors = []; // connected zones with maps, sorted alphabetically
  let neighborIndex = -1;

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
   * Compute the list of navigable connected zones (those with map files),
   * sorted alphabetically.
   */
  function computeNavigableNeighbors(zoneName) {
    const zone = zones[zoneName];
    if (!zone) return [];
    return zone.connections
      .filter(name => zones[name] && zones[name].map_file)
      .sort();
  }

  function updateNavButtons() {
    if (navigableNeighbors.length === 0) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      prevBtn.textContent = '\u2190 Prev';
      nextBtn.textContent = 'Next \u2192';
      navLabel.textContent = '';
    } else {
      // neighborIndex === -1 means we're at the origin zone, not yet navigated
      prevBtn.disabled = (neighborIndex <= 0);
      nextBtn.disabled = (neighborIndex >= navigableNeighbors.length - 1);

      // Show target zone name on each button
      if (neighborIndex <= 0) {
        prevBtn.textContent = '\u2190 Prev';
      } else {
        prevBtn.textContent = `\u2190 ${navigableNeighbors[neighborIndex - 1]}`;
      }

      if (neighborIndex === -1 && navigableNeighbors.length > 0) {
        // Haven't navigated yet; next goes to first neighbor
        nextBtn.disabled = false;
        nextBtn.textContent = `${navigableNeighbors[0]} \u2192`;
      } else if (neighborIndex < navigableNeighbors.length - 1) {
        nextBtn.textContent = `${navigableNeighbors[neighborIndex + 1]} \u2192`;
      } else {
        nextBtn.textContent = 'Next \u2192';
      }

      navLabel.textContent = currentZoneName;
    }
  }

  /**
   * Open the lightbox for a given zone name.
   */
  function openLightbox(zoneName) {
    const zone = zones[zoneName];
    if (!zone || !zone.map_file) return;

    currentZoneName = zoneName;
    headerH2.textContent = zoneName;
    levelsSpan.textContent = `Levels: ${zone.levels}`;
    img.src = `maps/${zone.map_file}`;
    img.alt = `Map of ${zoneName}`;

    resetTransform();

    // Compute navigable neighbors for this zone and reset navigation index.
    // neighborIndex = -1 means "at the opened zone"; first Next click goes to index 0.
    navigableNeighbors = computeNavigableNeighbors(zoneName);
    neighborIndex = -1;
    updateNavButtons();

    lightbox.classList.add('open');

    // Update URL hash for shareable links
    location.hash = encodeURIComponent(zoneName);
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    // Clear URL hash when closing
    history.replaceState(null, '', location.pathname + location.search);
  }

  /**
   * Navigate to a neighbor zone by index in the navigableNeighbors array.
   */
  function navigateToNeighbor(index) {
    if (index < 0 || index >= navigableNeighbors.length) return;
    const targetName = navigableNeighbors[index];
    const targetZone = zones[targetName];
    if (!targetZone || !targetZone.map_file) return;

    currentZoneName = targetName;
    headerH2.textContent = targetName;
    levelsSpan.textContent = `Levels: ${targetZone.levels}`;
    img.src = `maps/${targetZone.map_file}`;
    img.alt = `Map of ${targetName}`;

    resetTransform();

    // Recompute navigable neighbors for the new zone
    navigableNeighbors = computeNavigableNeighbors(targetName);
    neighborIndex = -1; // reset: at the new zone's origin
    updateNavButtons();

    // Update URL hash for shareable links
    location.hash = encodeURIComponent(targetName);
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
    if (!lightbox.classList.contains('open')) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (neighborIndex > 0) {
          navigateToNeighbor(neighborIndex - 1);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (neighborIndex === -1 && navigableNeighbors.length > 0) {
          navigateToNeighbor(0);
        } else if (neighborIndex < navigableNeighbors.length - 1) {
          navigateToNeighbor(neighborIndex + 1);
        }
        break;
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
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    scale *= factor;
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

  // --- Prev/Next navigation ---

  prevBtn.addEventListener('click', function () {
    if (neighborIndex > 0) {
      navigateToNeighbor(neighborIndex - 1);
    } else if (neighborIndex === -1) {
      // Already at start, do nothing (button should be disabled)
    }
  });

  nextBtn.addEventListener('click', function () {
    if (neighborIndex === -1 && navigableNeighbors.length > 0) {
      navigateToNeighbor(0);
    } else if (neighborIndex < navigableNeighbors.length - 1) {
      navigateToNeighbor(neighborIndex + 1);
    }
  });

  return openLightbox;
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
    layout: { name: 'preset' } // start with no layout; run dagre after registering listeners
  });

  // Remove loading indicator once layout finishes
  cy.on('layoutstop', function () {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.remove();
    }
  });

  // Run dagre layout now that the layoutstop listener is registered
  cy.layout({
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 60,
    rankSep: 80,
    edgeSep: 20,
    sort: function (a, b) {
      return (a.data('rank') || 0) - (b.data('rank') || 0);
    }
  }).run();

  const openLightbox = setupLightbox(cy, zones);
  setupHighlighting(cy, openLightbox);
  setupTooltip(cy);

  // URL hash navigation: open zone from hash on startup
  if (location.hash) {
    const zoneName = decodeURIComponent(location.hash.slice(1));
    if (zoneName && zones[zoneName]) {
      // Wait for layout to finish before acting on the hash
      cy.one('layoutstop', function () {
        const node = cy.getElementById(zoneName);
        if (node && node.length > 0) {
          // Highlight the node
          cy.elements().removeClass('highlighted neighbor dimmed');
          node.addClass('highlighted');
          node.neighborhood().nodes().addClass('neighbor');
          node.connectedEdges().addClass('highlighted');
          cy.elements().not(node).not(node.neighborhood().nodes()).not(node.connectedEdges()).addClass('dimmed');

          // Center on the node
          cy.animate({ center: { eles: node }, duration: 300 });

          // Open lightbox if it has a map
          if (node.data('hasMap')) {
            openLightbox(zoneName);
          }
        }
      });
    }
  }
}

init();
