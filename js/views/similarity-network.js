/* similarity-network.js -- domain-to-domain Jaccard similarity network, ported from sepolicy_viz/views/similarity-network.html standalone */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: standalone lines 7-165 (dropzone/reset-btn/local
     #tooltip rules dropped -- file-loading UI is not part of this
     view in the v2 shell, and the tooltip is the shared global
     #tooltip element driven by App.tooltip). All element ids are
     prefixed simnet- to avoid colliding with the shell's own ids
     (search-input, tooltip, ...) or other views' DOM.
     ============================================================ */
  var CSS = ''
    + '.simnet-root{position:relative;display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));}'
    + '.simnet-toolbar{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:8px 16px;min-height:52px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;}'
    + '#simnet-status{color:var(--cyan);white-space:nowrap;min-width:220px;}'
    + '.simnet-toolbar .toolbar-group{display:flex;align-items:center;gap:8px;}'
    + '.simnet-toolbar .toolbar-label{color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:.05em;}'
    + '#simnet-threshold-value{color:var(--cyan);min-width:38px;display:inline-block;}'
    + '.simnet-toolbar input[type=range]{width:150px;accent-color:var(--cyan);background:transparent;}'
    + '#simnet-search-wrap{position:relative;}'
    + '#simnet-search-input{background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:inherit;font-size:12px;padding:5px 8px;border-radius:4px;width:170px;outline:none;}'
    + '#simnet-search-input:focus{border-color:var(--cyan);}'
    + '#simnet-search-results{display:none;position:absolute;top:calc(100% + 4px);left:0;width:220px;max-height:220px;overflow-y:auto;background:var(--surface2);border:1px solid var(--border);border-radius:4px;z-index:30;}'
    + '#simnet-search-results .search-item{padding:6px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);}'
    + '#simnet-search-results .search-item:last-child{border-bottom:none;}'
    + '#simnet-search-results .search-item:hover{background:var(--bg);color:var(--cyan);}'
    + '#simnet-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}'
    + '#simnet-legend .legend-item{display:flex;align-items:center;gap:5px;cursor:pointer;opacity:1;user-select:none;}'
    + '#simnet-legend .legend-item.off{opacity:.32;}'
    + '#simnet-legend .swatch{width:10px;height:10px;border-radius:50%;display:inline-block;}'
    + '#simnet-legend .legend-label{color:var(--text2);font-size:11px;}'
    + '.simnet-body{position:relative;flex:1;overflow:hidden;}'
    + '#simnet-graph{position:absolute;inset:0;}'
    + '#simnet-graph svg{display:block;width:100%;height:100%;background:var(--bg);}'
    + '#simnet-graph .edge{stroke:var(--text2);opacity:.35;}'
    + '#simnet-graph .edge.dim{opacity:.04;}'
    + '#simnet-graph .edge.hidden-cat{display:none;}'
    + '#simnet-graph .node circle{stroke:#05050f;stroke-width:1px;cursor:pointer;}'
    + '#simnet-graph .node.dim circle{opacity:.14;}'
    + '#simnet-graph .node.dim text.label{opacity:0 !important;}'
    + '#simnet-graph .node.hidden-cat{display:none;}'
    + '#simnet-graph .node.selected circle{stroke:var(--cyan);stroke-width:2.5px;filter:drop-shadow(0 0 6px var(--cyan));}'
    + '#simnet-graph .node.highlighted circle{stroke:#fff;stroke-width:1.2px;}'
    + '#simnet-graph .node text.label{opacity:0;pointer-events:none;fill:var(--text);font-size:9px;text-anchor:middle;paint-order:stroke;stroke:#05050f;stroke-width:3px;transition:opacity .1s;}'
    + '#simnet-graph .node.show-label text.label{opacity:.85;}'
    + '#simnet-graph .node.highlighted text.label{opacity:1;}'
    + '#simnet-graph .node.pulse circle{animation:simnet-pulse 1s ease-out 2;}'
    + '@keyframes simnet-pulse{0%{filter:drop-shadow(0 0 0 var(--cyan));}50%{filter:drop-shadow(0 0 12px var(--cyan));}100%{filter:drop-shadow(0 0 0 var(--cyan));}}'
    + '#simnet-graph .node:hover text.label{opacity:1;}'
    + '.tooltip .simnet-tt-row{display:flex;justify-content:space-between;gap:14px;color:var(--text2);}'
    + '.tooltip .simnet-tt-row b{color:var(--text);font-weight:normal;}'
    + '#simnet-side-panel{position:absolute;top:0;right:0;bottom:0;width:290px;z-index:15;background:var(--surface);border-left:1px solid var(--border);transform:translateX(100%);transition:transform .18s ease-out;overflow-y:auto;padding:18px 16px;}'
    + '#simnet-side-panel.open{transform:translateX(0);}'
    + '#simnet-panel-close{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text2);font-size:16px;cursor:pointer;line-height:1;}'
    + '#simnet-panel-close:hover{color:var(--red);}'
    + '#simnet-panel-name{color:var(--cyan);font-size:15px;word-break:break-all;margin:2px 30px 4px 0;}'
    + '#simnet-panel-meta{color:var(--text2);font-size:11px;margin-bottom:16px;line-height:1.7;}'
    + '#simnet-panel-meta b{color:var(--text);font-weight:normal;}'
    + '#simnet-panel-sub{color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;}'
    + '#simnet-panel-list .sim-row{margin-bottom:9px;cursor:pointer;}'
    + '#simnet-panel-list .sim-row-head{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px;}'
    + '#simnet-panel-list .sim-row-name{color:var(--text);word-break:break-all;padding-right:8px;}'
    + '#simnet-panel-list .sim-row-name:hover{color:var(--cyan);}'
    + '#simnet-panel-list .sim-row-val{color:var(--cyan);flex-shrink:0;}'
    + '#simnet-panel-list .sim-bar-track{height:4px;background:var(--bg);border-radius:2px;overflow:hidden;}'
    + '#simnet-panel-list .sim-bar-fill{height:100%;background:var(--cyan);}'
    + '#simnet-progress-overlay{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(10,10,26,.92);}'
    + '#simnet-progress-overlay.hidden{display:none;}'
    + '#simnet-progress-overlay .progress-box{width:min(420px, 80vw);text-align:center;}'
    + '#simnet-progress-overlay .progress-label{color:var(--text2);margin-bottom:14px;letter-spacing:.04em;}'
    + '#simnet-progress-overlay .progress-track{height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;border:1px solid var(--border);}'
    + '#simnet-progress-overlay .progress-bar{height:100%;width:0%;background:var(--cyan);box-shadow:0 0 8px var(--cyan);transition:width .05s linear;}'
    + '#simnet-progress-overlay .progress-pct{margin-top:10px;color:var(--cyan);}';
  var styleEl = null;

  /* ============================================================
     DOM template
     source: standalone lines 180-216 (dropzone lines 170-178 and
     reset-btn/"load new file" dropped -- the v2 shell already owns
     file loading via #btn-load-new / App.resetToLoader; the local
     #tooltip markup, lines 208, is dropped in favor of the shell's
     shared #tooltip element driven by App.tooltip)
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="simnet-toolbar">'
    +   '<div id="simnet-status">—</div>'
    +   '<div class="toolbar-group">'
    +     '<span class="toolbar-label">threshold</span>'
    +     '<input type="range" id="simnet-threshold-slider" min="0.05" max="0.50" step="0.01" value="0.15" />'
    +     '<span id="simnet-threshold-value">0.15</span>'
    +   '</div>'
    +   '<div id="simnet-search-wrap" class="toolbar-group">'
    +     '<span class="toolbar-label">search</span>'
    +     '<input type="text" id="simnet-search-input" placeholder="domain name..." autocomplete="off" />'
    +     '<div id="simnet-search-results"></div>'
    +   '</div>'
    +   '<div id="simnet-legend"></div>'
    + '</div>'
    + '<div class="simnet-body">'
    +   '<div id="simnet-graph"></div>'
    +   '<div id="simnet-side-panel">'
    +     '<button id="simnet-panel-close" type="button">&times;</button>'
    +     '<div id="simnet-panel-name"></div>'
    +     '<div id="simnet-panel-meta"></div>'
    +     '<div id="simnet-panel-sub">top similar domains</div>'
    +     '<div id="simnet-panel-list"></div>'
    +   '</div>'
    + '</div>'
    + '<div id="simnet-progress-overlay" class="hidden">'
    +   '<div class="progress-box">'
    +     '<div class="progress-label">computing similarity matrix...</div>'
    +     '<div class="progress-track"><div id="simnet-progress-bar" class="progress-bar"></div></div>'
    +     '<div id="simnet-progress-pct" class="progress-pct">0%</div>'
    +   '</div>'
    + '</div>';

  /* ============================================================
     Module constants -- source: standalone lines 223-231
     ============================================================ */
  var CATEGORY_COLORS = {
    hal:'#00fff2', app:'#ff00ff', vendor:'#ffaa00', system:'#39ff88',
    shell:'#b967ff', core:'#ff3355', other:'#8888aa'
  };
  var CATEGORY_ORDER = ['hal','app','vendor','system','shell','core','other'];
  var MIN_THRESHOLD = 0.05;
  var MAX_THRESHOLD = 0.50;
  var DEFAULT_THRESHOLD = 0.15;
  var LABEL_TOP_N = 20;

  /* ============================================================
     Local state -- source: standalone lines 233-250, reset fresh
     each create() (this module has no cross-cycle persistence,
     unlike graph.js's graphDomain/lastMainView)
     ============================================================ */
  var domains = [];
  var domainIndexMap = new Map();
  var categoryOf = {};
  var ruleCounts = {};
  var pairs = [];            /* [i, j, jaccard] */
  var currentThreshold = DEFAULT_THRESHOLD;
  var hiddenCategories = new Set();
  var selectedId = null;

  var nodesData = [];
  var linksCurrent = [];
  var degreeMap = {};

  var width = 0, height = 0;
  var svg, g, linkLayer, nodeLayer, zoomBehavior, simulation;
  var currentNodeSel, currentLinkSel;
  var dragBehavior;

  var hoverTooltipHtml = '';
  var jaccardRAF = null;
  var els = {};

  /* ============================================================
     Jaccard precompute (chunked, progress bar) -- kept intact
     source: standalone lines 365-412
     ============================================================ */
  function updateProgress(fraction){
    var pct = Math.min(100, Math.round(fraction * 100));
    els.progressBar.style.width = pct + '%';
    els.progressPct.textContent = pct + '%';
  }

  function precomputeJaccard(domainList, targetSets, onDone){
    var n = domainList.length;
    var sets = new Array(n);
    for (var k = 0; k < n; k++) sets[k] = targetSets.get(domainList[k]) || new Set();

    var total = n > 1 ? (n * (n - 1)) / 2 : 0;
    if (total === 0){ onDone([]); return; }

    var out = [];
    var i = 0, j = 1, processed = 0;
    var CHUNK = 4000;

    function step(){
      var count = 0;
      while (i < n - 1 && count < CHUNK){
        var a = sets[i], b = sets[j];
        if (a.size && b.size){
          var small = a.size < b.size ? a : b;
          var big = a.size < b.size ? b : a;
          var inter = 0;
          small.forEach(function(x){ if (big.has(x)) inter++; });
          var union = a.size + b.size - inter;
          if (union > 0){
            var v = inter / union;
            if (v > 0) out.push([i, j, v]);
          }
        }
        j++;
        processed++;
        count++;
        if (j >= n){ i++; j = i + 1; }
      }
      updateProgress(processed / total);
      if (i < n - 1){
        jaccardRAF = requestAnimationFrame(step);
      } else {
        jaccardRAF = null;
        onDone(out);
      }
    }
    jaccardRAF = requestAnimationFrame(step);
  }

  /* ============================================================
     Bootstrap -- source: standalone lines 310-363 (startApp),
     dropzone/appEl show-hide dropped, "data" replaced with App.data
     ============================================================ */
  function startFromData(){
    els.progressOverlay.classList.remove('hidden');
    updateProgress(0);

    var data = App.data;

    /* domain set: declared domains ∪ any rule sources not listed */
    var domainSet = new Set(Array.isArray(data.domains) ? data.domains : []);
    var rules = Array.isArray(data.rules) ? data.rules : [];
    for (var r = 0; r < rules.length; r++){ if (rules[r] && rules[r].s) domainSet.add(rules[r].s); }
    domains = Array.from(domainSet);
    domainIndexMap = new Map();
    for (var di = 0; di < domains.length; di++) domainIndexMap.set(domains[di], di);

    /* category lookup */
    categoryOf = {};
    var cats = data.categories || {};
    Object.keys(cats).forEach(function(cat){
      var list = cats[cat] || [];
      for (var k = 0; k < list.length; k++) categoryOf[list[k]] = cat;
    });

    /* rule counts */
    ruleCounts = {};
    var providedCounts = data.domain_rule_counts || {};
    var hasCounts = Object.keys(providedCounts).length > 0;
    if (hasCounts){
      for (var c = 0; c < domains.length; c++) ruleCounts[domains[c]] = providedCounts[domains[c]] || 0;
    } else {
      for (var c2 = 0; c2 < domains.length; c2++) ruleCounts[domains[c2]] = 0;
      for (var r2 = 0; r2 < rules.length; r2++){
        var src = rules[r2] && rules[r2].s;
        if (src != null) ruleCounts[src] = (ruleCounts[src] || 0) + 1;
      }
    }

    /* target-type sets per domain */
    var targetSets = new Map();
    for (var t = 0; t < domains.length; t++) targetSets.set(domains[t], new Set());
    for (var r3 = 0; r3 < rules.length; r3++){
      var rule = rules[r3];
      if (!rule || !rule.s || !rule.t) continue;
      var set = targetSets.get(rule.s);
      if (!set){ set = new Set(); targetSets.set(rule.s, set); }
      set.add(rule.t);
    }

    precomputeJaccard(domains, targetSets, function(computed){
      pairs = computed;
      els.progressOverlay.classList.add('hidden');
      buildGraph();
    });
  }

  /* ============================================================
     Graph construction -- source: standalone lines 415-450
     ============================================================ */
  function radiusScaleFor(domainList, counts){
    var logs = domainList.map(function(d){ return Math.log1p(counts[d] || 0); });
    var lo = d3.min(logs), hi = d3.max(logs);
    if (lo === undefined) { lo = 0; hi = 1; }
    if (lo === hi) hi = lo + 1;
    return d3.scaleLinear().domain([lo, hi]).range([3, 15]).clamp(true);
  }

  function buildGraph(){
    var radiusScale = radiusScaleFor(domains, ruleCounts);
    nodesData = domains.map(function(d, idx){
      return {
        id: d,
        idx: idx,
        category: categoryOf[d] || 'other',
        ruleCount: ruleCounts[d] || 0,
        r: radiusScale(Math.log1p(ruleCounts[d] || 0)),
        pinned: false
      };
    });

    setupSvg();
    setupLegend();
    setupSearch();

    els.thresholdSlider.value = String(DEFAULT_THRESHOLD);
    els.thresholdValue.textContent = DEFAULT_THRESHOLD.toFixed(2);
    els.thresholdSlider.addEventListener('input', function(){
      var v = parseFloat(els.thresholdSlider.value);
      els.thresholdValue.textContent = v.toFixed(2);
      applyThreshold(v);
    });

    applyThreshold(DEFAULT_THRESHOLD);
  }

  /* ============================================================
     SVG / simulation setup -- source: standalone lines 452-520
     ============================================================ */
  function setupSvg(){
    var container = d3.select(els.graph);
    container.selectAll('*').remove();
    width = els.graph.clientWidth;
    height = els.graph.clientHeight;

    svg = container.append('svg').attr('width', width).attr('height', height);
    g = svg.append('g').attr('class', 'zoom-container');
    linkLayer = g.append('g').attr('class', 'links');
    nodeLayer = g.append('g').attr('class', 'nodes');

    zoomBehavior = d3.zoom().scaleExtent([0.05, 8]).on('zoom', function(event){
      g.attr('transform', event.transform);
    });
    svg.call(zoomBehavior);
    svg.on('click', function(event){
      if (event.target === svg.node()) clearSelection();
    });

    dragBehavior = d3.drag()
      .on('start', function(event, d){
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', function(event, d){ d.fx = event.x; d.fy = event.y; })
      .on('end', function(event, d){
        if (!event.active) simulation.alphaTarget(0);
        if (!d.pinned){ d.fx = null; d.fy = null; }
      });

    simulation = d3.forceSimulation()
      .force('charge', d3.forceManyBody().strength(-90))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(function(d){ return d.r + 3; }))
      .on('tick', ticked);
  }

  function linkDistance(v){ return 18 + (1 - v) * 160; }

  function applyThreshold(threshold){
    currentThreshold = threshold;
    var filtered = pairs.filter(function(p){ return p[2] > threshold; });
    linksCurrent = filtered.map(function(p){
      return { source: domains[p[0]], target: domains[p[1]], value: p[2] };
    });

    degreeMap = {};
    for (var d0 = 0; d0 < domains.length; d0++) degreeMap[domains[d0]] = 0;
    for (var l0 = 0; l0 < linksCurrent.length; l0++){
      degreeMap[linksCurrent[l0].source]++;
      degreeMap[linksCurrent[l0].target]++;
    }

    var sortedByDegree = domains.slice().sort(function(a, b){ return degreeMap[b] - degreeMap[a]; });
    var highDegreeSet = new Set();
    for (var s0 = 0; s0 < Math.min(LABEL_TOP_N, sortedByDegree.length); s0++){
      if (degreeMap[sortedByDegree[s0]] > 0) highDegreeSet.add(sortedByDegree[s0]);
    }

    render(linksCurrent, highDegreeSet);
    updateStatus();
    if (selectedId) highlightNeighbors(selectedId);
  }

  function render(links, highDegreeSet){
    simulation.nodes(nodesData);
    simulation.force('link', d3.forceLink(links).id(function(d){ return d.id; })
      .distance(function(d){ return linkDistance(d.value); })
      .strength(function(d){ return Math.min(1, Math.max(0.04, d.value)); }));

    var linkSel = linkLayer.selectAll('line.edge')
      .data(links, function(d){ return d.source + '|' + d.target; })
      .join(
        function(enter){
          return enter.append('line')
            .attr('class', 'edge')
            .attr('stroke-width', function(d){ return 0.6 + d.value * 3; });
        },
        function(update){
          return update.attr('stroke-width', function(d){ return 0.6 + d.value * 3; });
        },
        function(exit){ return exit.remove(); }
      );
    currentLinkSel = linkSel;

    var nodeSel = nodeLayer.selectAll('g.node')
      .data(nodesData, function(d){ return d.id; })
      .join(
        function(enter){
          var gEnter = enter.append('g')
            .attr('class', 'node')
            .call(dragBehavior)
            .on('mouseenter', nodeMouseOver)
            .on('mousemove', nodeMouseMove)
            .on('mouseleave', nodeMouseOut)
            .on('click', nodeClicked);
          gEnter.append('circle')
            .attr('r', function(d){ return d.r; })
            .attr('fill', function(d){ return CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other; });
          gEnter.append('text')
            .attr('class', 'label')
            .attr('dy', function(d){ return -(d.r + 4); })
            .text(function(d){ return d.id; });
          return gEnter;
        },
        function(update){ return update; },
        function(exit){ return exit.remove(); }
      );
    currentNodeSel = nodeSel;
    nodeSel.classed('show-label', function(d){ return highDegreeSet.has(d.id); });
    nodeSel.classed('hidden-cat', function(d){ return hiddenCategories.has(d.category); });
    applyEdgeVisibility();

    simulation.alpha(0.7).restart();
  }

  function ticked(){
    if (currentLinkSel){
      currentLinkSel
        .attr('x1', function(d){ return d.source.x; })
        .attr('y1', function(d){ return d.source.y; })
        .attr('x2', function(d){ return d.target.x; })
        .attr('y2', function(d){ return d.target.y; });
    }
    if (currentNodeSel){
      currentNodeSel.attr('transform', function(d){ return 'translate(' + d.x + ',' + d.y + ')'; });
    }
  }

  /* ============================================================
     Selection / highlight -- source: standalone lines 581-619
     ============================================================ */
  function nodeClicked(event, d){
    event.stopPropagation();
    d.pinned = !d.pinned;
    if (d.pinned){ d.fx = d.x; d.fy = d.y; } else { d.fx = null; d.fy = null; }
    selectNode(d.id);
  }

  function selectNode(id){
    selectedId = id;
    currentNodeSel.classed('selected', function(d){ return d.id === id; });
    highlightNeighbors(id);
    showSidePanel(id);
  }

  function clearSelection(){
    selectedId = null;
    if (currentNodeSel) currentNodeSel.classed('selected', false);
    hideSidePanel();
    clearHighlight();
  }

  function highlightNeighbors(id){
    var neighborIds = new Set([id]);
    currentLinkSel.classed('dim', function(l){
      var s = (l.source && l.source.id !== undefined) ? l.source.id : l.source;
      var t = (l.target && l.target.id !== undefined) ? l.target.id : l.target;
      var touches = (s === id || t === id);
      if (touches){ neighborIds.add(s); neighborIds.add(t); }
      return !touches;
    });
    currentNodeSel.classed('dim', function(d){ return !neighborIds.has(d.id); });
    currentNodeSel.classed('highlighted', function(d){ return neighborIds.has(d.id) && d.id !== id; });
  }

  function clearHighlight(){
    if (currentNodeSel) currentNodeSel.classed('dim', false).classed('highlighted', false);
    if (currentLinkSel) currentLinkSel.classed('dim', false);
  }

  /* ============================================================
     Tooltip -- source: standalone lines 621-640, adapted to the
     shared App.tooltip (id="tooltip") instead of this view's own
     local tooltip div; mouseenter still builds+shows the content,
     mousemove re-shows the same cached html to reposition it,
     matching the source's mouseenter/mousemove split exactly
     ============================================================ */
  function nodeMouseOver(event, d){
    highlightNeighbors(d.id);
    var deg = degreeMap[d.id] || 0;
    hoverTooltipHtml =
      '<span class="tt-title">' + App.escapeHTML(d.id) + '</span>' +
      '<div class="simnet-tt-row"><span>category</span><b style="color:' + (CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other) + '">' + App.escapeHTML(d.category) + '</b></div>' +
      '<div class="simnet-tt-row"><span>rules</span><b>' + d.ruleCount + '</b></div>' +
      '<div class="simnet-tt-row"><span>connections</span><b>' + deg + '</b></div>';
    App.tooltip.show(event.clientX, event.clientY, hoverTooltipHtml);
  }

  function nodeMouseMove(event){
    App.tooltip.show(event.clientX, event.clientY, hoverTooltipHtml);
  }

  function nodeMouseOut(){
    App.tooltip.hide();
    if (selectedId) highlightNeighbors(selectedId); else clearHighlight();
  }

  /* ============================================================
     Side panel -- source: standalone lines 642-686
     ============================================================ */
  function topSimilar(id, n){
    var idx = domainIndexMap.get(id);
    var results = [];
    for (var p = 0; p < pairs.length; p++){
      var a = pairs[p][0], b = pairs[p][1], v = pairs[p][2];
      if (a === idx) results.push([domains[b], v]);
      else if (b === idx) results.push([domains[a], v]);
    }
    results.sort(function(x, y){ return y[1] - x[1]; });
    return results.slice(0, n || 10);
  }

  function showSidePanel(id){
    var node = nodesData.find(function(n){ return n.id === id; });
    if (!node) return;
    els.panelName.textContent = node.id;
    els.panelMeta.innerHTML =
      '<div>category: <b style="color:' + (CATEGORY_COLORS[node.category] || CATEGORY_COLORS.other) + '">' + App.escapeHTML(node.category) + '</b></div>' +
      '<div>rules: <b>' + node.ruleCount + '</b></div>' +
      '<div>connections: <b>' + (degreeMap[node.id] || 0) + '</b></div>' +
      '<div>pinned: <b>' + (node.pinned ? 'yes' : 'no') + '</b></div>';

    var top = topSimilar(id, 10);
    els.panelList.innerHTML = '';
    if (top.length === 0){
      els.panelList.innerHTML = '<div style="color:var(--text2);">no measurable similarity to other domains</div>';
    } else {
      top.forEach(function(entry){
        var name = entry[0], val = entry[1];
        var row = document.createElement('div');
        row.className = 'sim-row';
        row.innerHTML =
          '<div class="sim-row-head"><span class="sim-row-name">' + App.escapeHTML(name) + '</span>' +
          '<span class="sim-row-val">' + val.toFixed(3) + '</span></div>' +
          '<div class="sim-bar-track"><div class="sim-bar-fill" style="width:' + (val * 100) + '%;"></div></div>';
        row.addEventListener('click', function(){ focusNode(name); });
        els.panelList.appendChild(row);
      });
    }
    els.sidePanel.classList.add('open');
  }

  function hideSidePanel(){ els.sidePanel.classList.remove('open'); }

  /* ============================================================
     Legend -- source: standalone lines 688-723
     ============================================================ */
  function setupLegend(){
    var counts = {};
    CATEGORY_ORDER.forEach(function(c){ counts[c] = 0; });
    domains.forEach(function(d){
      var c = categoryOf[d] || 'other';
      if (counts[c] === undefined) counts[c] = 0;
      counts[c]++;
    });

    var legend = d3.select(els.legend);
    legend.selectAll('*').remove();
    var items = legend.selectAll('.legend-item')
      .data(CATEGORY_ORDER)
      .join('div')
      .attr('class', 'legend-item')
      .on('click', function(event, cat){
        if (hiddenCategories.has(cat)) hiddenCategories.delete(cat); else hiddenCategories.add(cat);
        d3.select(this).classed('off', hiddenCategories.has(cat));
        currentNodeSel.classed('hidden-cat', function(d){ return hiddenCategories.has(d.category); });
        applyEdgeVisibility();
        updateStatus();
      });
    items.append('span').attr('class', 'swatch').style('background', function(c){ return CATEGORY_COLORS[c]; });
    items.append('span').attr('class', 'legend-label').text(function(c){ return c + ' (' + (counts[c] || 0) + ')'; });
  }

  function linkHiddenByCategory(l){
    var sc = (l.source && l.source.category !== undefined) ? l.source.category : (categoryOf[l.source] || 'other');
    var tc = (l.target && l.target.category !== undefined) ? l.target.category : (categoryOf[l.target] || 'other');
    return hiddenCategories.has(sc) || hiddenCategories.has(tc);
  }

  function applyEdgeVisibility(){
    if (currentLinkSel) currentLinkSel.classed('hidden-cat', linkHiddenByCategory);
  }

  /* ============================================================
     Search -- source: standalone lines 725-773
     ============================================================ */
  function setupSearch(){
    var input = d3.select(els.searchInput);
    var list = d3.select(els.searchResults);

    input.on('input', function(){
      var q = input.property('value').trim().toLowerCase();
      list.selectAll('*').remove();
      if (!q){ list.style('display', 'none'); return; }
      var matches = domains.filter(function(d){ return d.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
      list.style('display', matches.length ? 'block' : 'none');
      list.selectAll('.search-item')
        .data(matches)
        .join('div')
        .attr('class', 'search-item')
        .text(function(d){ return d; })
        .on('click', function(event, d){
          focusNode(d);
          input.property('value', d);
          list.style('display', 'none');
        });
    });

    input.on('keydown', function(event){
      if (event.key === 'Enter'){
        var q = input.property('value').trim().toLowerCase();
        if (!q) return;
        var match = domains.find(function(d){ return d.toLowerCase() === q; }) ||
                    domains.find(function(d){ return d.toLowerCase().indexOf(q) !== -1; });
        if (match){ focusNode(match); list.style('display', 'none'); }
      }
    });
  }

  function focusNode(id){
    var node = nodesData.find(function(n){ return n.id === id; });
    if (!node) return;
    var k = 2;
    var transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-node.x, -node.y);
    svg.transition().duration(600).call(zoomBehavior.transform, transform);
    selectNode(id);
    currentNodeSel.classed('pulse', function(d){ return d.id === id; });
    setTimeout(function(){
      if (currentNodeSel) currentNodeSel.classed('pulse', false);
    }, 2000);
  }

  /* ============================================================
     Status -- source: standalone lines 775-780
     ============================================================ */
  function updateStatus(){
    var visibleNodes = nodesData.filter(function(d){ return !hiddenCategories.has(d.category); }).length;
    var visibleLinks = linksCurrent.filter(function(l){ return !linkHiddenByCategory(l); }).length;
    els.status.textContent = visibleNodes + ' nodes, ' + visibleLinks + ' edges (threshold: ' + currentThreshold.toFixed(2) + ')';
  }

  /* ============================================================
     Resize -- source: standalone lines 782-791, converted from a
     raw window resize listener (never removed in the monolith) to
     the view lifecycle's onResize hook, which core.js only invokes
     while this view is active
     ============================================================ */
  function onSimNetResize(){
    if (!svg || !els.graph) return;
    width = els.graph.clientWidth;
    height = els.graph.clientHeight;
    svg.attr('width', width).attr('height', height);
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createSimNet(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM inside container */
    var root = App.el('div', 'simnet-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.status = root.querySelector('#simnet-status');
    els.thresholdSlider = root.querySelector('#simnet-threshold-slider');
    els.thresholdValue = root.querySelector('#simnet-threshold-value');
    els.searchInput = root.querySelector('#simnet-search-input');
    els.searchResults = root.querySelector('#simnet-search-results');
    els.legend = root.querySelector('#simnet-legend');
    els.graph = root.querySelector('#simnet-graph');
    els.sidePanel = root.querySelector('#simnet-side-panel');
    els.panelClose = root.querySelector('#simnet-panel-close');
    els.panelName = root.querySelector('#simnet-panel-name');
    els.panelMeta = root.querySelector('#simnet-panel-meta');
    els.panelList = root.querySelector('#simnet-panel-list');
    els.progressOverlay = root.querySelector('#simnet-progress-overlay');
    els.progressBar = root.querySelector('#simnet-progress-bar');
    els.progressPct = root.querySelector('#simnet-progress-pct');

    /* 3. Wire static listeners (source: standalone line 686) */
    els.panelClose.addEventListener('click', clearSelection);

    /* 4. Reset local state fresh for this cycle */
    domains = [];
    domainIndexMap = new Map();
    categoryOf = {};
    ruleCounts = {};
    pairs = [];
    currentThreshold = DEFAULT_THRESHOLD;
    hiddenCategories = new Set();
    selectedId = null;
    nodesData = [];
    linksCurrent = [];
    degreeMap = {};
    hoverTooltipHtml = '';

    /* 5. Bootstrap from already-loaded policy data */
    startFromData();
  }

  function destroySimNet(){
    if (jaccardRAF){ cancelAnimationFrame(jaccardRAF); jaccardRAF = null; }
    if (simulation){ simulation.stop(); simulation = null; }

    if (els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if (styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM/d3 refs */
    els = {};
    svg = null; g = null; linkLayer = null; nodeLayer = null;
    zoomBehavior = null; dragBehavior = null;
    currentNodeSel = null; currentLinkSel = null;
  }

  App.registerView('similarity-network', { label: 'SIMILAR', icon: '≈', create: createSimNet, destroy: destroySimNet, onResize: onSimNetResize });
})();
