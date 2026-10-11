/* transition-dag.js -- type transition DAG (domain execution chain graph), ported from sepolicy_viz/views/transition-dag.html standalone */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: transition-dag.html lines 7-184. Page-shell rules
     (html/body reset, ::selection, scrollbar, #dropzone/dz-*,
     #app/header/#body-row) are dropped -- the host app shell
     (index.html + theme.css) already provides equivalents. The
     standalone page's own #tooltip markup/CSS is dropped in favor
     of the shared App.tooltip.show/hide. Ids are namespaced with
     a dag- prefix and .link/.node/.node-label rules are scoped
     under .dag-main to avoid bleeding into other views' markup.
     ============================================================ */
  var CSS = ''
    + '.dag-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));}'
    + '.dag-body{flex:1 1 auto;display:flex;min-height:0;}'
    + '.dag-sidebar{width:308px;flex:0 0 auto;overflow-y:auto;background:var(--surface);border-right:1px solid var(--border);padding:12px;}'
    + '.dag-sidebar section{border:1px solid var(--border);border-radius:8px;background:var(--surface2);padding:10px 12px;margin-bottom:12px;}'
    + '.dag-sidebar section h2{margin:0 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text2);font-weight:600;}'
    + '.dag-sidebar label{display:block;font-size:11px;color:var(--text2);margin:8px 0 3px;}'
    + '.dag-sidebar select,.dag-sidebar input[type=text]{width:100%;padding:6px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-family:inherit;font-size:12px;outline:none;}'
    + '.dag-sidebar select:focus,.dag-sidebar input[type=text]:focus{border-color:var(--cyan);}'
    + '.dag-btn-row{display:flex;gap:8px;margin-top:10px;}'
    + '.dag-sidebar button.action{flex:1;padding:7px 8px;font-family:inherit;font-size:11px;letter-spacing:.4px;border-radius:5px;cursor:pointer;border:1px solid var(--cyan);color:var(--cyan);background:rgba(0,255,242,0.06);transition:background .15s,box-shadow .15s;}'
    + '.dag-sidebar button.action:hover{background:rgba(0,255,242,0.16);box-shadow:0 0 12px rgba(0,255,242,.3);}'
    + '.dag-sidebar button.action.secondary{border-color:var(--border);color:var(--text2);background:transparent;}'
    + '.dag-sidebar button.action.secondary:hover{color:var(--red);border-color:var(--red);background:rgba(255,51,85,.08);box-shadow:none;}'
    + '#dag-path-results{margin-top:10px;max-height:220px;overflow-y:auto;font-size:11px;line-height:1.7;}'
    + '#dag-path-results .path-line{padding:4px 6px;margin-bottom:4px;background:var(--bg);border-left:2px solid var(--cyan);border-radius:2px;word-break:break-word;color:var(--text);}'
    + '#dag-path-results .path-line b{color:var(--cyan);}'
    + '#dag-path-results .path-empty{color:var(--text2);font-style:italic;}'
    + '#dag-path-results .path-count{color:var(--text2);margin-bottom:6px;}'
    + '.dag-legend-row{display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:6px;color:var(--text);}'
    + '.dag-legend-row:last-child{margin-bottom:0;}'
    + '.dag-legend-swatch{width:11px;height:11px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 6px currentColor;}'
    + '.dag-stat-row{display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px;}'
    + '.dag-stat-row b{color:var(--text);font-weight:600;}'
    + '.dag-main{flex:1 1 auto;position:relative;min-width:0;}'
    + '#dag-svg{display:block;width:100%;height:100%;background:var(--bg);cursor:grab;}'
    + '#dag-svg:active{cursor:grabbing;}'
    + '.dag-main .link{stroke:var(--border);stroke-opacity:.55;fill:none;}'
    + '.dag-main .link.dim{stroke-opacity:.06;}'
    + '.dag-main .link.hl-path{stroke:var(--cyan);stroke-opacity:1;stroke-width:2.2px;}'
    + '.dag-main .link.hl-succ{stroke:var(--green);stroke-opacity:.95;stroke-width:1.8px;}'
    + '.dag-main .link.hl-pred{stroke:var(--red);stroke-opacity:.95;stroke-width:1.8px;}'
    + '.dag-main .link-label{font-size:8.5px;fill:var(--text2);pointer-events:none;opacity:0;transition:opacity .12s;}'
    + '.dag-main .link-label.show{opacity:.85;}'
    + '.dag-main .link-label.hl-path{fill:var(--cyan);opacity:1;font-weight:600;}'
    + '.dag-main .link-label.hl-succ{fill:var(--green);opacity:1;}'
    + '.dag-main .link-label.hl-pred{fill:var(--red);opacity:1;}'
    + '.dag-main .link-label.dim{opacity:0 !important;}'
    + '.dag-main .node{stroke:var(--bg);stroke-width:1.4px;cursor:pointer;transition:opacity .12s;}'
    + '.dag-main .node.dim{opacity:.12;}'
    + '.dag-main .node.selected{stroke:#fff;stroke-width:2.6px;filter:drop-shadow(0 0 10px #fff);}'
    + '.dag-main .node.succ{stroke:var(--green);stroke-width:2.4px;filter:drop-shadow(0 0 8px var(--green));}'
    + '.dag-main .node.pred{stroke:var(--red);stroke-width:2.4px;filter:drop-shadow(0 0 8px var(--red));}'
    + '.dag-main .node.hl-path{stroke:var(--cyan);stroke-width:2.6px;filter:drop-shadow(0 0 10px var(--cyan));}'
    + '.dag-main .node.search-hit{stroke:#fff;stroke-width:3px;filter:drop-shadow(0 0 14px #fff);}'
    + '.dag-main .node-label{font-size:9px;fill:var(--text);pointer-events:none;text-anchor:middle;paint-order:stroke;stroke:var(--bg);stroke-width:2.5px;opacity:0;transition:opacity .12s;}'
    + '.dag-main .node-label.show{opacity:.9;}'
    + '.dag-main .node-label.dim{opacity:0 !important;}'
    + '.dag-main .node-label.hl-path,.dag-main .node-label.selected,.dag-main .node-label.succ,.dag-main .node-label.pred{opacity:1 !important;fill:#fff;}'
    + '.dag-zoom-hud{position:absolute;bottom:12px;right:14px;font-size:10px;color:var(--text2);background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:5px 9px;z-index:15;letter-spacing:.4px;}'
    + '.dag-legend-hint{position:absolute;bottom:12px;left:14px;font-size:10px;color:var(--text2);background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:5px 9px;z-index:15;line-height:1.6;}'
    + '.dag-legend-hint b{color:var(--text);}';
  var styleEl = null;

  /* ============================================================
     DOM template -- sidebar (legend / path finder / search /
     stats) + main graph pane, adapted from transition-dag.html
     lines 208-249 (#sidebar + <main>). The standalone page's own
     header (title/subtitle/reload) and #dropzone are dropped --
     the host app shell already provides tabs + a title bar, and
     file loading is handled by the host's own loader. The local
     #tooltip div is dropped in favor of the shared App.tooltip.
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="dag-body">'
    +   '<aside id="dag-sidebar" class="dag-sidebar">'
    +     '<section id="dag-legend-section">'
    +       '<h2>Category Legend</h2>'
    +       '<div id="dag-legend-list"></div>'
    +     '</section>'
    +     '<section id="dag-pathfinder-section">'
    +       '<h2>Path Finder</h2>'
    +       '<label for="dag-src-select">Source domain</label>'
    +       '<select id="dag-src-select"></select>'
    +       '<label for="dag-dst-select">Target domain</label>'
    +       '<select id="dag-dst-select"></select>'
    +       '<div class="dag-btn-row">'
    +         '<button class="action" id="dag-find-paths-btn" type="button">FIND PATHS</button>'
    +         '<button class="action secondary" id="dag-clear-btn" type="button">CLEAR</button>'
    +       '</div>'
    +       '<div id="dag-path-results"></div>'
    +     '</section>'
    +     '<section id="dag-search-section">'
    +       '<h2>Search / Center</h2>'
    +       '<input type="text" id="dag-search-input" list="dag-domain-list" placeholder="type domain name, press enter...">'
    +       '<datalist id="dag-domain-list"></datalist>'
    +     '</section>'
    +     '<section id="dag-stats-section">'
    +       '<h2>Graph Stats</h2>'
    +       '<div id="dag-stats-list"></div>'
    +     '</section>'
    +   '</aside>'
    +   '<div id="dag-main" class="dag-main">'
    +     '<svg id="dag-svg"></svg>'
    +     '<div id="dag-zoom-hud" class="dag-zoom-hud">zoom: <span id="dag-zoom-level">1.00</span>x</div>'
    +     '<div id="dag-legend-hint" class="dag-legend-hint">'
    +       '<div><b>hover</b> node &mdash; details</div>'
    +       '<div><b>click</b> node &mdash; predecessors(red) / successors(green)</div>'
    +       '<div><b>scroll</b> zoom &middot; <b>drag</b> pan / move node</div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  /* ============================================================
     Local state (module scope), mirrors the standalone page's
     top-of-IIFE vars (source lines 284-288)
     ============================================================ */
  var els = {};
  var svg, zoomLayer, linkG, linkLabelG, nodeG, nodeLabelG;
  var simulation, zoomBehavior;
  var nodes = [], links = [], nodeById = new Map(), adj = new Map();
  var selectedNodeId = null;
  var currentK = 1;

  /* ============================================================
     Graph construction from App.data (replaces the standalone
     page's FileReader -> JSON.parse -> buildGraph(parsed) flow,
     source lines 292-317, 345-406). Field shape (data.domains[],
     data.categories{}, data.type_transitions[] with s/t/c/d) is
     unchanged -- this view is read directly from the already-
     loaded App.data instead of a dropped file.
     ============================================================ */
  function buildGraph(data){
    var domains    = Array.isArray(data.domains) ? data.domains.slice() : [];
    var categories = data.categories && typeof data.categories === 'object' ? data.categories : {};
    var rawTrans   = Array.isArray(data.type_transitions) ? data.type_transitions : [];

    var domainSet = new Set(domains);

    var catOf = new Map();
    Object.keys(categories).forEach(function(catName){
      var list = categories[catName];
      if (!Array.isArray(list)) return;
      list.forEach(function(d){ catOf.set(d, catName); });
    });

    var filtered = rawTrans.filter(function(t){
      return t && t.c === 'process' && domainSet.has(t.s) && domainSet.has(t.d);
    });

    var outCount = new Map(), outSet = new Map(), inSet = new Map();
    domains.forEach(function(d){ outCount.set(d,0); outSet.set(d,new Set()); inSet.set(d,new Set()); });

    filtered.forEach(function(t){
      outCount.set(t.s, (outCount.get(t.s)||0) + 1);
      outSet.get(t.s).add(t.d);
      inSet.get(t.d).add(t.s);
    });

    var maxOut = 0;
    domains.forEach(function(d){ maxOut = Math.max(maxOut, outCount.get(d)||0); });

    nodes = domains.map(function(d){
      var oc = outCount.get(d) || 0;
      var r = 6 + Math.sqrt(oc) * 4.2;
      r = Math.max(6, Math.min(r, 42));
      return {
        id: d,
        category: catOf.get(d) || 'other',
        outCount: oc,
        outDegree: outSet.get(d).size,
        inDegree: inSet.get(d).size,
        r: r
      };
    });

    nodeById = new Map(nodes.map(function(n){ return [n.id, n]; }));

    links = filtered.map(function(t, i){
      return { id:'e'+i, source: t.s, target: t.d, type: t.t };
    });

    adj = new Map();
    domains.forEach(function(d){ adj.set(d, []); });
    filtered.forEach(function(t){
      adj.get(t.s).push({ to: t.d, type: t.t });
    });

    populateLegend();
    populateDropdowns(domains);
    populateStats(domains.length, filtered.length);
  }

  /* source: lines 408-423. CAT_COLORS swapped for the shared
     App.CAT_COLORS palette (task instruction); the display order
     of the legend rows is unchanged from the standalone page. */
  function populateLegend(){
    els.legendList.innerHTML = '';
    var order = ['hal','app','vendor','system','shell','core','other'];
    order.forEach(function(cat){
      var row = document.createElement('div');
      row.className = 'dag-legend-row';
      var sw = document.createElement('div');
      sw.className = 'dag-legend-swatch';
      sw.style.background = App.CAT_COLORS[cat];
      sw.style.color = App.CAT_COLORS[cat];
      var label = document.createElement('span');
      label.textContent = cat;
      row.appendChild(sw); row.appendChild(label);
      els.legendList.appendChild(row);
    });
  }

  /* source: lines 425-431 */
  function populateDropdowns(domains){
    var sorted = domains.slice().sort();
    var opts = sorted.map(function(d){ return '<option value="'+App.escapeHTML(d)+'">'+App.escapeHTML(d)+'</option>'; }).join('');
    els.srcSelect.innerHTML = opts;
    els.dstSelect.innerHTML = opts;
    els.domainList.innerHTML = sorted.map(function(d){ return '<option value="'+App.escapeHTML(d)+'">'; }).join('');
  }

  /* source: lines 433-445 */
  function populateStats(domainCount, edgeCount){
    var withEdges = 0;
    nodes.forEach(function(n){ if (n.outDegree>0 || n.inDegree>0) withEdges++; });
    var rows = [
      ['total domains', domainCount],
      ['process transitions', edgeCount],
      ['domains with edges', withEdges],
      ['isolated domains', domainCount - withEdges]
    ];
    els.statsList.innerHTML = rows.map(function(r){
      return '<div class="dag-stat-row"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>';
    }).join('');
  }

  /* ============================================================
     svg / simulation
     source: lines 455-509. document.querySelector('main')/'#graph'
     swapped for this view's own els.main/els.svg container refs;
     the resize listener is registered via App.registerView's
     onResize hook (see onDagResize below) instead of a raw
     window 'resize' listener, matching the other v2 view modules.
     ============================================================ */
  function initSvg(){
    var w = els.main.clientWidth, h = els.main.clientHeight;

    svg = d3.select(els.svgEl).attr('width', w).attr('height', h);
    svg.selectAll('*').remove();

    var defs = svg.append('defs');
    [
      ['arrow-normal', 'rgba(160,160,200,0.55)'],
      ['arrow-path', '#00fff2'],
      ['arrow-succ', '#39ff88'],
      ['arrow-pred', '#ff3355']
    ].forEach(function(pair){
      defs.append('marker')
        .attr('id', pair[0])
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 9)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', pair[1]);
    });

    zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    linkG      = zoomLayer.append('g').attr('class', 'links-layer');
    linkLabelG = zoomLayer.append('g').attr('class', 'link-labels-layer');
    nodeG      = zoomLayer.append('g').attr('class', 'nodes-layer');
    nodeLabelG = zoomLayer.append('g').attr('class', 'node-labels-layer');

    zoomBehavior = d3.zoom()
      .scaleExtent([0.03, 10])
      .on('zoom', function(event){
        zoomLayer.attr('transform', event.transform);
        currentK = event.transform.k;
        els.zoomLevelEl.textContent = currentK.toFixed(2);
        updateLabelVisibility();
      });
    svg.call(zoomBehavior);

    svg.on('click', function(){ clearSelection(); });
  }

  function onDagResize(){
    if (!svg || !els.main) return;
    var nw = els.main.clientWidth, nh = els.main.clientHeight;
    svg.attr('width', nw).attr('height', nh);
    if (simulation){
      simulation.force('center', d3.forceCenter(nw/2, nh/2));
      simulation.alpha(0.1).restart();
    }
  }

  /* source: lines 511-583 */
  function render(){
    var w = els.main.clientWidth, h = els.main.clientHeight;

    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function(d){ return d.id; }).distance(110).strength(0.25))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(w/2, h/2))
      .force('collision', d3.forceCollide().radius(function(d){ return d.r + 10; }))
      .on('tick', ticked);

    var linkSel = linkG.selectAll('line.link')
      .data(links, function(d){ return d.id; })
      .enter().append('line')
        .attr('class', 'link')
        .attr('id', function(d){ return 'link-' + d.id; })
        .attr('marker-end', 'url(#arrow-normal)');

    var linkLabelSel = linkLabelG.selectAll('text.link-label')
      .data(links, function(d){ return d.id; })
      .enter().append('text')
        .attr('class', 'link-label')
        .attr('id', function(d){ return 'linklabel-' + d.id; })
        .text(function(d){ return d.type; });

    var nodeSel = nodeG.selectAll('circle.node')
      .data(nodes, function(d){ return d.id; })
      .enter().append('circle')
        .attr('class', function(d){ return 'node cat-' + d.category; })
        .attr('id', function(d){ return 'node-' + cssSafe(d.id); })
        .attr('r', function(d){ return d.r; })
        .attr('fill', function(d){ return App.CAT_COLORS[d.category] || App.CAT_COLORS.other; })
        .on('mousemove', onNodeMove)
        .on('mouseleave', onNodeOut)
        .on('click', onNodeClick)
        .call(dragBehavior(simulation));

    var nodeLabelSel = nodeLabelG.selectAll('text.node-label')
      .data(nodes, function(d){ return d.id; })
      .enter().append('text')
        .attr('class', 'node-label')
        .attr('id', function(d){ return 'nodelabel-' + cssSafe(d.id); })
        .attr('dy', function(d){ return -(d.r + 5); })
        .text(function(d){ return d.id; });

    function ticked(){
      linkSel.each(function(d){
        var sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y;
        var dx = tx - sx, dy = ty - sy;
        var dist = Math.sqrt(dx*dx + dy*dy) || 1;
        var ux = dx / dist, uy = dy / dist;
        var tr = d.target.r || 6;
        var ex = tx - ux * (tr + 3);
        var ey = ty - uy * (tr + 3);
        d3.select(this)
          .attr('x1', sx).attr('y1', sy)
          .attr('x2', ex).attr('y2', ey);
      });

      linkLabelSel
        .attr('x', function(d){ return (d.source.x + d.target.x) / 2; })
        .attr('y', function(d){ return (d.source.y + d.target.y) / 2; });

      nodeSel.attr('cx', function(d){ return d.x; }).attr('cy', function(d){ return d.y; });

      nodeLabelSel
        .attr('x', function(d){ return d.x; })
        .attr('y', function(d){ return d.y; });
    }

    updateLabelVisibility();
  }

  function cssSafe(id){
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function updateLabelVisibility(){
    var show = currentK > 0.9;
    d3.selectAll('.node-label').classed('show', show);
    d3.selectAll('.link-label').classed('show', show && currentK > 1.6);
  }

  function dragBehavior(sim){
    function started(event, d){
      if (!event.active) sim.alphaTarget(0.25).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d){ d.fx = event.x; d.fy = event.y; }
    function ended(event, d){
      if (!event.active) sim.alphaTarget(0);
      d.fx = null; d.fy = null;
    }
    return d3.drag().on('start', started).on('drag', dragged).on('end', ended);
  }

  /* ---------------- hover tooltip ----------------
     source: lines 610-626 (onNodeHover/onNodeMove/onNodeOut).
     Folded into one mousemove handler that builds+positions via
     App.tooltip.show(x,y,html) each call, matching the pattern
     used by graph.js's graphNodeMouseMove/App.tooltip.hide. */
  function onNodeMove(event, d){
    var html =
      '<span class="tt-title">' + App.escapeHTML(d.id) + '</span>' +
      '<div style="color:var(--text2);font-size:10px;">category: <b style="color:var(--text)">' + App.escapeHTML(d.category) + '</b></div>' +
      '<div style="color:var(--text2);font-size:10px;">in-degree: <b style="color:var(--text)">' + d.inDegree + '</b></div>' +
      '<div style="color:var(--text2);font-size:10px;">out-degree: <b style="color:var(--text)">' + d.outDegree + '</b></div>' +
      '<div style="color:var(--text2);font-size:10px;">outgoing transitions: <b style="color:var(--text)">' + d.outCount + '</b></div>';
    App.tooltip.show(event.clientX, event.clientY, html);
  }
  function onNodeOut(){
    App.tooltip.hide();
  }

  /* ---------------- click select: predecessors / successors ----------------
     source: lines 630-701 */
  function onNodeClick(event, d){
    event.stopPropagation();
    clearPathHighlight();
    if (selectedNodeId === d.id){
      clearSelection();
      return;
    }
    selectedNodeId = d.id;
    applySelectionStyles();
  }

  function clearSelection(){
    selectedNodeId = null;
    applySelectionStyles();
  }

  function applySelectionStyles(){
    if (!selectedNodeId){
      d3.selectAll('.node').classed('dim', false).classed('selected', false).classed('succ', false).classed('pred', false);
      d3.selectAll('.node-label').classed('dim', false).classed('selected', false).classed('succ', false).classed('pred', false);
      d3.selectAll('.link').classed('dim', false).classed('hl-succ', false).classed('hl-pred', false).attr('marker-end', 'url(#arrow-normal)');
      d3.selectAll('.link-label').classed('dim', false).classed('hl-succ', false).classed('hl-pred', false);
      return;
    }

    var predIds = new Set(), succIds = new Set();
    links.forEach(function(l){
      var sId = typeof l.source === 'object' ? l.source.id : l.source;
      var tId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sId === selectedNodeId) succIds.add(tId);
      if (tId === selectedNodeId) predIds.add(sId);
    });

    d3.selectAll('circle.node').each(function(nd){
      var el = d3.select(this);
      el.classed('selected', nd.id === selectedNodeId);
      el.classed('succ', succIds.has(nd.id));
      el.classed('pred', predIds.has(nd.id));
      el.classed('dim', nd.id !== selectedNodeId && !succIds.has(nd.id) && !predIds.has(nd.id));
    });
    d3.selectAll('text.node-label').each(function(nd){
      var el = d3.select(this);
      el.classed('selected', nd.id === selectedNodeId);
      el.classed('succ', succIds.has(nd.id));
      el.classed('pred', predIds.has(nd.id));
      el.classed('dim', nd.id !== selectedNodeId && !succIds.has(nd.id) && !predIds.has(nd.id));
    });

    d3.selectAll('line.link').each(function(l){
      var sId = typeof l.source === 'object' ? l.source.id : l.source;
      var tId = typeof l.target === 'object' ? l.target.id : l.target;
      var el = d3.select(this);
      if (sId === selectedNodeId){
        el.classed('hl-succ', true).classed('hl-pred', false).classed('dim', false)
          .attr('marker-end', 'url(#arrow-succ)');
      } else if (tId === selectedNodeId){
        el.classed('hl-pred', true).classed('hl-succ', false).classed('dim', false)
          .attr('marker-end', 'url(#arrow-pred)');
      } else {
        el.classed('dim', true).classed('hl-succ', false).classed('hl-pred', false)
          .attr('marker-end', 'url(#arrow-normal)');
      }
    });
    d3.selectAll('text.link-label').each(function(l){
      var sId = typeof l.source === 'object' ? l.source.id : l.source;
      var tId = typeof l.target === 'object' ? l.target.id : l.target;
      var el = d3.select(this);
      el.classed('hl-succ', sId === selectedNodeId);
      el.classed('hl-pred', tId === selectedNodeId);
      el.classed('dim', sId !== selectedNodeId && tId !== selectedNodeId);
    });
  }

  /* ---------------- path finder (all shortest paths via BFS) ----------------
     source: lines 705-823 */
  function findAllShortestPaths(src, dst){
    if (!adj.has(src) || !adj.has(dst)) return [];
    if (src === dst) return [[{node:src, type:null}]];

    var dist = new Map(); dist.set(src, 0);
    var preds = new Map();
    var queue = [src];
    var qi = 0;

    while (qi < queue.length){
      var cur = queue[qi++];
      var curDist = dist.get(cur);
      var edges = adj.get(cur) || [];
      for (var i=0;i<edges.length;i++){
        var e = edges[i];
        var nd = e.to;
        if (!dist.has(nd)){
          dist.set(nd, curDist + 1);
          preds.set(nd, [{from:cur, type:e.type}]);
          queue.push(nd);
        } else if (dist.get(nd) === curDist + 1){
          preds.get(nd).push({from:cur, type:e.type});
        }
      }
    }

    if (!dist.has(dst)) return [];

    var allPaths = [];
    var MAX_PATHS = 200;

    function backtrack(node, pathSoFar){
      if (allPaths.length >= MAX_PATHS) return;
      if (node === src){
        var full = pathSoFar.slice();
        full.push({node: src, type: null});
        full.reverse();
        allPaths.push(full);
        return;
      }
      var ps = preds.get(node) || [];
      for (var i=0;i<ps.length;i++){
        if (allPaths.length >= MAX_PATHS) return;
        var p = ps[i];
        pathSoFar.push({node: node, type: p.type});
        backtrack(p.from, pathSoFar);
        pathSoFar.pop();
      }
    }
    backtrack(dst, []);
    return allPaths;
  }

  function clearPathHighlight(){
    d3.selectAll('.node').classed('hl-path', false);
    d3.selectAll('.node-label').classed('hl-path', false);
    d3.selectAll('.link').classed('hl-path', false).classed('dim', false).attr('marker-end', 'url(#arrow-normal)');
    d3.selectAll('.link-label').classed('hl-path', false).classed('dim', false);
    els.pathResults.innerHTML = '';
  }

  function onFindPathsClick(){
    clearSelection();
    var src = els.srcSelect.value, dst = els.dstSelect.value;
    if (!src || !dst) return;

    var paths = findAllShortestPaths(src, dst);

    var pathNodeIds = new Set();
    var pathEdgeKeys = new Set();
    paths.forEach(function(p){
      for (var i=0;i<p.length;i++){
        pathNodeIds.add(p[i].node);
        if (i>0) pathEdgeKeys.add(p[i-1].node + '=>' + p[i].node + '=>' + p[i].type);
      }
    });

    d3.selectAll('circle.node').each(function(nd){
      d3.select(this).classed('hl-path', pathNodeIds.has(nd.id)).classed('dim', paths.length>0 && !pathNodeIds.has(nd.id));
    });
    d3.selectAll('text.node-label').each(function(nd){
      d3.select(this).classed('hl-path', pathNodeIds.has(nd.id)).classed('dim', paths.length>0 && !pathNodeIds.has(nd.id));
    });
    d3.selectAll('line.link').each(function(l){
      var sId = typeof l.source === 'object' ? l.source.id : l.source;
      var tId = typeof l.target === 'object' ? l.target.id : l.target;
      var key = sId + '=>' + tId + '=>' + l.type;
      var el = d3.select(this);
      var onPath = pathEdgeKeys.has(key);
      el.classed('hl-path', onPath)
        .classed('dim', paths.length>0 && !onPath)
        .attr('marker-end', onPath ? 'url(#arrow-path)' : 'url(#arrow-normal)');
    });
    d3.selectAll('text.link-label').each(function(l){
      var sId = typeof l.source === 'object' ? l.source.id : l.source;
      var tId = typeof l.target === 'object' ? l.target.id : l.target;
      var key = sId + '=>' + tId + '=>' + l.type;
      var onPath = pathEdgeKeys.has(key);
      d3.select(this).classed('hl-path', onPath).classed('dim', paths.length>0 && !onPath);
    });

    if (paths.length === 0){
      els.pathResults.innerHTML = '<div class="path-empty">no path found: ' + App.escapeHTML(src) + ' &rarr; ' + App.escapeHTML(dst) + '</div>';
      return;
    }

    var html = '<div class="path-count">' + paths.length + ' shortest path(s), length ' + (paths[0].length-1) + ' hop(s)</div>';
    html += paths.map(function(p){
      var parts = [];
      for (var i=0;i<p.length;i++){
        parts.push('<b>' + App.escapeHTML(p[i].node) + '</b>');
        if (i < p.length-1){
          parts.push('&nbsp;&rarr;<sub>[' + App.escapeHTML(p[i+1].type) + ']</sub>&rarr;&nbsp;');
        }
      }
      return '<div class="path-line">' + parts.join('') + '</div>';
    }).join('');
    els.pathResults.innerHTML = html;
  }

  function onClearClick(){
    clearSelection();
    clearPathHighlight();
    els.searchInput.value = '';
  }

  /* ---------------- search / center ----------------
     source: lines 833-864 */
  function centerOnNode(node){
    var w = els.main.clientWidth, h = els.main.clientHeight;
    var targetK = Math.max(currentK, 1.4);
    var transform = d3.zoomIdentity
      .translate(w/2, h/2)
      .scale(targetK)
      .translate(-node.x, -node.y);
    svg.transition().duration(500).call(zoomBehavior.transform, transform);

    var el = d3.select('#node-' + cssSafe(node.id));
    el.classed('search-hit', true);
    setTimeout(function(){ el.classed('search-hit', false); }, 1800);
  }

  function doSearch(){
    var val = els.searchInput.value.trim();
    if (!val) return;
    var node = nodeById.get(val);
    if (!node){
      var lower = val.toLowerCase();
      nodes.some(function(n){
        if (n.id.toLowerCase() === lower){ node = n; return true; }
        return false;
      });
    }
    if (node) centerOnNode(node);
  }

  function onSearchKeydown(e){
    if (e.key === 'Enter') doSearch();
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createDag(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM inside container */
    var root = App.el('div','dag-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.sidebar = root.querySelector('#dag-sidebar');
    els.legendList = root.querySelector('#dag-legend-list');
    els.srcSelect = root.querySelector('#dag-src-select');
    els.dstSelect = root.querySelector('#dag-dst-select');
    els.findBtn = root.querySelector('#dag-find-paths-btn');
    els.clearBtn = root.querySelector('#dag-clear-btn');
    els.pathResults = root.querySelector('#dag-path-results');
    els.searchInput = root.querySelector('#dag-search-input');
    els.domainList = root.querySelector('#dag-domain-list');
    els.statsList = root.querySelector('#dag-stats-list');
    els.main = root.querySelector('#dag-main');
    els.svgEl = root.querySelector('#dag-svg');
    els.zoomLevelEl = root.querySelector('#dag-zoom-level');

    /* 3. Wire event listeners */
    els.findBtn.addEventListener('click', onFindPathsClick);
    els.clearBtn.addEventListener('click', onClearClick);
    els.searchInput.addEventListener('keydown', onSearchKeydown);

    /* 4. Build graph from the already-loaded policy + render */
    buildGraph(App.data || {});
    initSvg();
    render();
  }

  function destroyDag(){
    if (simulation){ simulation.stop(); simulation = null; }
    App.tooltip.hide();

    if (els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if (styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs + local state */
    els = {};
    svg = null; zoomLayer = null; linkG = null; linkLabelG = null; nodeG = null; nodeLabelG = null;
    zoomBehavior = null;
    nodes = []; links = []; nodeById = new Map(); adj = new Map();
    selectedNodeId = null;
    currentK = 1;
  }

  App.registerView('transition-dag', { label: 'TRANS DAG', icon: '→', create: createDag, destroy: destroyDag, onResize: onDagResize });
})();
