/* sankey-flow.js -- category -> class -> permission-group sankey rule-flow
   view, ported from sepolicy_viz/views/sankey-flow.html standalone view.
   The standalone page owned its own file drop-zone and loaded d3 + d3-sankey
   via top-level <script> tags; this module uses App.data (already loaded by
   the shell) and lazy-loads the d3-sankey plugin itself in create(), since
   this is the only view that needs it. */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: sankey-flow.html lines 9-121 (dropzone/#app/#tooltip rules from
     the standalone page are dropped -- this module reuses the shell's
     #view-container sizing and the shared #tooltip element/.tt-title class
     from theme.css, and only adds the two tooltip sub-classes theme.css
     does not already define: .tt-path / .tt-row)
     ============================================================ */
  var CSS = ''
    + '.snk-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));}'
    + '.snk-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:18px;background:var(--surface);border-bottom:1px solid var(--border);padding:10px 16px;flex:0 0 auto;}'
    + '.snk-toolbar .tb-group{display:flex;align-items:center;gap:8px;}'
    + '.snk-toolbar .tb-group label{font-size:10px;letter-spacing:1.5px;color:var(--text2);text-transform:uppercase;}'
    + '.snk-toolbar .tb-sep{width:1px;align-self:stretch;background:var(--border);}'
    + '#snk-toggle-group{display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;}'
    + '.snk-toggle-btn{background:var(--surface2);color:var(--text2);border:none;outline:none;font-family:inherit;font-size:11px;letter-spacing:1.5px;padding:7px 14px;cursor:pointer;text-transform:uppercase;transition:background .12s ease, color .12s ease;}'
    + '.snk-toggle-btn + .snk-toggle-btn{border-left:1px solid var(--border);}'
    + '.snk-toggle-btn.active{background:rgba(0,255,242,0.12);color:var(--cyan);}'
    + '.snk-toggle-btn[data-mode="dontaudit"].active{background:rgba(255,51,85,0.12);color:var(--red);}'
    + '.snk-toggle-btn:hover:not(.active){color:var(--text);}'
    + '.snk-filter-hint{font-size:10px;letter-spacing:1px;color:var(--text2);display:none;}'
    + '.snk-filter-hint.on{display:inline;color:var(--amber);}'
    + '.snk-stats{margin-left:auto;font-size:11px;color:var(--text2);letter-spacing:1px;white-space:nowrap;}'
    + '.snk-chart-container{position:relative;flex:1 1 auto;min-height:0;}'
    + '#snk-svg{display:block;width:100%;height:100%;}'
    + '.snk-node-rect{cursor:default;transition:opacity .12s ease;stroke-width:1.5;}'
    + '.snk-node-rect.clickable{cursor:pointer;}'
    + '.snk-link{transition:stroke-opacity .12s ease;}'
    + '.snk-label{fill:var(--text);font-size:10px;font-family:inherit;pointer-events:none;}'
    + '.snk-label-sub{fill:var(--text2);font-size:9px;font-family:inherit;pointer-events:none;}'
    + '.snk-col-title{fill:var(--text2);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:inherit;}'
    + '.tooltip .tt-path{font-size:10px;letter-spacing:0.5px;margin-bottom:8px;word-break:break-word;}'
    + '.tooltip .tt-row{display:flex;justify-content:space-between;gap:16px;color:var(--text2);}'
    + '.tooltip .tt-row span:last-child{color:var(--text);}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from sankey-flow.html lines 137-154 -- the
     #dropzone, #app wrapper, file-input and #reset-btn/"Load New File"
     markup are dropped since this module uses App.data and the shell's
     own load-new-file button; the local #tooltip div is dropped in favor
     of the shared #tooltip element driven by App.tooltip)
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="snk-toolbar">'
    +   '<div class="tb-group">'
    +     '<label>Rule Set</label>'
    +     '<div id="snk-toggle-group">'
    +       '<button type="button" class="snk-toggle-btn active" data-mode="allow">Allow Rules</button>'
    +       '<button type="button" class="snk-toggle-btn" data-mode="dontaudit">Dontaudit Rules</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="tb-sep"></div>'
    +   '<span id="snk-filter-hint" class="snk-filter-hint">FILTERED &mdash; CLICK CATEGORY AGAIN TO RESET</span>'
    +   '<div id="snk-stats" class="snk-stats"></div>'
    + '</div>'
    + '<div id="snk-chart-container" class="snk-chart-container">'
    +   '<svg id="snk-svg"></svg>'
    + '</div>';

  /* ============================================================
     Constants (source: sankey-flow.html lines 159-179, unchanged)
     ============================================================ */
  var CATEGORY_ORDER = ['hal','app','vendor','system','shell','core','other'];
  var CATEGORY_COLORS = {
    hal:'#00fff2', app:'#ff00ff', vendor:'#ffaa00', system:'#39ff88',
    shell:'#b967ff', core:'#ff3355', other:'#8888aa'
  };

  var PERM_GROUP_ORDER = ['READ','WRITE','EXECUTE','CONNECT','IPC','SIGNAL','CAPABILITY','OTHER'];
  var PERM_COLORS = {
    READ:'#00fff2', WRITE:'#ff00ff', EXECUTE:'#ffaa00', CONNECT:'#39ff88',
    IPC:'#b967ff', SIGNAL:'#ff3355', CAPABILITY:'#ff3355', OTHER:'#8888aa'
  };

  var READ_SET = { read:1, getattr:1, open:1, search:1, list:1 };
  var WRITE_SET = { write:1, create:1, append:1, setattr:1, unlink:1, rename:1, rmdir:1, link:1 };
  var EXECUTE_SET = { execute:1, execute_no_trans:1, map:1 };
  var CONNECT_SET = { connect:1, connectto:1, bind:1, listen:1, accept:1 };
  var IPC_SET = { call:1, transfer:1, impersonate:1 };
  var SIGNAL_SET = { signal:1, sigchld:1, sigkill:1, sigstop:1 };

  var MAX_CLASSES = 20;
  var CLASS_FILL = '#1b1b36';

  /* ============================================================
     Local state (replaces the standalone page's rawPolicy/catLookup/
     currentMode/activeFilterCat/hoverLink/hoverNodeId/lastGraph module
     vars, source: sankey-flow.html lines 181-187. rawPolicy itself is
     dropped -- App.data is the equivalent.)
     ============================================================ */
  var state = {
    catLookup: {},
    currentMode: 'allow',
    activeFilterCat: null,
    hoverLink: null,
    hoverNodeId: null,
    lastGraph: null
  };

  /* DOM element references (created in create(), null after destroy()) */
  var els = {};

  /* ============================================================
     Lazy-load d3-sankey. The standalone page pulled it in via a
     top-level <script src="https://cdn.jsdelivr.net/npm/d3-sankey@0.12/
     dist/d3-sankey.min.js"> (source: sankey-flow.html line 8) alongside
     d3 itself; here d3 is already the global App-wide `d3`, and only this
     view needs the sankey plugin, so it is fetched on demand -- a local
     copy first, falling back to the same CDN URL the source page used.
     ============================================================ */
  var SANKEY_LOCAL_SRC = 'js/d3-sankey.min.js';
  var SANKEY_CDN_SRC = 'https://cdn.jsdelivr.net/npm/d3-sankey@0.12/dist/d3-sankey.min.js';
  function ensureSankeyLib(callback){
    if (typeof d3.sankey === 'function'){ callback(); return; }
    var script = document.createElement('script');
    script.src = SANKEY_LOCAL_SRC;
    script.onload = function(){ callback(); };
    script.onerror = function(){
      var cdnScript = document.createElement('script');
      cdnScript.src = SANKEY_CDN_SRC;
      cdnScript.onload = function(){ callback(); };
      cdnScript.onerror = function(){ console.error('sankey-flow: failed to load d3-sankey from local copy and CDN fallback'); };
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  }

  /* ============================================================
     Permission classification (source: sankey-flow.html lines 189-202, unchanged)
     ============================================================ */
  function classifyPerm(cls, perm){
    var c = String(cls || '').toLowerCase();
    var p = String(perm || '').toLowerCase();
    if (c.indexOf('capability') !== -1) return 'CAPABILITY';
    if (READ_SET[p]) return 'READ';
    if (WRITE_SET[p]) return 'WRITE';
    if (EXECUTE_SET[p]) return 'EXECUTE';
    if (CONNECT_SET[p]) return 'CONNECT';
    if (IPC_SET[p]) return 'IPC';
    if (SIGNAL_SET[p]) return 'SIGNAL';
    return 'OTHER';
  }

  /* ============================================================
     Data processing (source: sankey-flow.html lines 204-333)
     ============================================================ */
  function buildCatLookup(policy){
    var lookup = {};
    var categories = policy.categories || {};
    Object.keys(categories).forEach(function(cat){
      (categories[cat] || []).forEach(function(d){ lookup[d] = cat; });
    });
    return lookup;
  }

  function computeDataset(rulesArray){
    var classTotalsRaw = {};
    var validRules = [];
    (rulesArray || []).forEach(function(r){
      if (!r || !r.s || !r.c) return;
      validRules.push(r);
      classTotalsRaw[r.c] = (classTotalsRaw[r.c] || 0) + 1;
    });

    var classEntries = Object.keys(classTotalsRaw).map(function(c){
      return { cls:c, count:classTotalsRaw[c] };
    });
    classEntries.sort(function(a,b){ return b.count - a.count; });
    var topClasses = classEntries.slice(0, MAX_CLASSES).map(function(e){ return e.cls; });
    var topSet = {};
    topClasses.forEach(function(c){ topSet[c] = true; });

    var catClassCounts = {};
    var clsPermCounts = {};
    var permGroupTotals = {};
    var finalClassTotals = {};

    validRules.forEach(function(r){
      var cat = state.catLookup[r.s] || 'other';
      var finalCls = topSet[r.c] ? r.c : 'other_classes';
      finalClassTotals[finalCls] = (finalClassTotals[finalCls] || 0) + 1;

      var k1 = cat + '' + finalCls;
      catClassCounts[k1] = (catClassCounts[k1] || 0) + 1;

      var perms = Array.isArray(r.p) ? r.p : [];
      var seenGroups = {};
      perms.forEach(function(p){
        var grp = classifyPerm(r.c, p);
        if (seenGroups[grp]) return;
        seenGroups[grp] = true;
        var k2 = cat + '' + finalCls + '' + grp;
        clsPermCounts[k2] = (clsPermCounts[k2] || 0) + 1;
        permGroupTotals[grp] = (permGroupTotals[grp] || 0) + 1;
      });
    });

    return {
      totalRules: validRules.length,
      catClassCounts: catClassCounts,
      clsPermCounts: clsPermCounts,
      permGroupTotals: permGroupTotals,
      finalClassTotals: finalClassTotals
    };
  }

  function buildSankeyGraph(dataset){
    var nodes = [];
    var nodeIndex = {};

    function addNode(id, name, group, extra){
      if (nodeIndex.hasOwnProperty(id)) return nodeIndex[id];
      var n = { id:id, name:name, group:group };
      if (extra){ Object.keys(extra).forEach(function(k){ n[k] = extra[k]; }); }
      nodeIndex[id] = nodes.length;
      nodes.push(n);
      return nodeIndex[id];
    }

    var catTotals = {};
    var classDominant = {};
    Object.keys(dataset.catClassCounts).forEach(function(k){
      var parts = k.split('');
      var cat = parts[0], cls = parts[1];
      var v = dataset.catClassCounts[k];
      catTotals[cat] = (catTotals[cat] || 0) + v;
      if (!classDominant[cls] || v > classDominant[cls].val){
        classDominant[cls] = { cat:cat, val:v };
      }
    });

    CATEGORY_ORDER.forEach(function(cat){
      if (catTotals[cat]) addNode('C::' + cat, cat, 'category', { color:CATEGORY_COLORS[cat], total:catTotals[cat] });
    });

    var classNames = Object.keys(dataset.finalClassTotals).filter(function(c){ return c !== 'other_classes'; });
    classNames.sort(function(a,b){ return dataset.finalClassTotals[b] - dataset.finalClassTotals[a]; });
    classNames.forEach(function(c){
      var dom = classDominant[c];
      addNode('K::' + c, c, 'class', {
        total:dataset.finalClassTotals[c],
        borderColor: dom ? CATEGORY_COLORS[dom.cat] : '#8888aa'
      });
    });
    if (dataset.finalClassTotals.other_classes){
      var domOther = classDominant.other_classes;
      addNode('K::other_classes', 'other_classes', 'class', {
        total:dataset.finalClassTotals.other_classes,
        borderColor: domOther ? CATEGORY_COLORS[domOther.cat] : '#8888aa'
      });
    }

    PERM_GROUP_ORDER.forEach(function(g){
      if (dataset.permGroupTotals[g]) addNode('P::' + g, g, 'permgroup', { color:PERM_COLORS[g], total:dataset.permGroupTotals[g] });
    });

    var links = [];
    Object.keys(dataset.catClassCounts).forEach(function(k){
      var parts = k.split('');
      var cat = parts[0], cls = parts[1];
      var srcId = 'C::' + cat, tgtId = 'K::' + cls;
      if (!nodeIndex.hasOwnProperty(srcId) || !nodeIndex.hasOwnProperty(tgtId)) return;
      links.push({ source:srcId, target:tgtId, value:dataset.catClassCounts[k], cat:cat, cls:cls, stage:1 });
    });
    Object.keys(dataset.clsPermCounts).forEach(function(k){
      var parts = k.split('');
      var cat = parts[0], cls = parts[1], grp = parts[2];
      var srcId = 'K::' + cls, tgtId = 'P::' + grp;
      if (!nodeIndex.hasOwnProperty(srcId) || !nodeIndex.hasOwnProperty(tgtId)) return;
      links.push({ source:srcId, target:tgtId, value:dataset.clsPermCounts[k], cat:cat, cls:cls, grp:grp, stage:2 });
    });

    return { nodes:nodes, links:links, totalRules:dataset.totalRules };
  }

  /* ============================================================
     Rendering (source: sankey-flow.html lines 335-588. escapeHtml/fmtNum
     are dropped in favor of the shared App.escapeHTML/App.fmtNum helpers;
     positionTooltip/hideTooltip are dropped in favor of the shared
     App.tooltip.show/hide, matching the other ported views.)
     ============================================================ */
  function updateStats(graph){
    var flowCount = graph.links.filter(function(l){ return l.stage === 2; }).length;
    els.stats.textContent = App.fmtNum(graph.totalRules) + ' RULES • ' + App.fmtNum(flowCount) + ' FLOWS • SHOWING: ' + state.currentMode.toUpperCase();
  }

  function nodeColor(d){
    if (d.group === 'class') return CLASS_FILL;
    return d.color || '#8888aa';
  }

  function nodeStroke(d){
    if (d.group === 'class') return d.borderColor || '#8888aa';
    return d3.color(d.color || '#8888aa').brighter(0.6);
  }

  function computeOpacities(){
    var linkOp = function(d){
      if (state.hoverLink){
        return (d.cat === state.hoverLink.cat && d.cls === state.hoverLink.cls) ? 0.85 : 0.04;
      }
      if (state.hoverNodeId){
        var touches = (d.source.id === state.hoverNodeId || d.target.id === state.hoverNodeId);
        return touches ? 0.85 : 0.04;
      }
      if (state.activeFilterCat){
        return d.cat === state.activeFilterCat ? 0.45 : 0.05;
      }
      return 0.2;
    };
    var nodeOp = function(d){
      if (state.hoverNodeId){
        if (d.id === state.hoverNodeId) return 1;
        var neigh = d.neighbors && d.neighbors[state.hoverNodeId];
        return neigh ? 1 : 0.25;
      }
      if (state.activeFilterCat){
        if (d.group === 'category') return d.id === ('C::' + state.activeFilterCat) ? 1 : 0.2;
        return (d.cats && d.cats[state.activeFilterCat]) ? 1 : 0.2;
      }
      return 1;
    };
    return { linkOp:linkOp, nodeOp:nodeOp };
  }

  function refreshOpacity(){
    if (!state.lastGraph) return;
    var ops = computeOpacities();
    d3.select('#snk-svg').selectAll('path.snk-link').attr('stroke-opacity', ops.linkOp);
    d3.select('#snk-svg').selectAll('rect.snk-node-rect').attr('opacity', ops.nodeOp);
    d3.select('#snk-svg').selectAll('text.snk-label').attr('opacity', function(d){ return ops.nodeOp(d); });
    d3.select('#snk-svg').selectAll('text.snk-label-sub').attr('opacity', function(d){ return ops.nodeOp(d); });
  }

  function showLinkTooltip(event, d, totalRules){
    var pathStr = d.stage === 1
      ? App.escapeHTML(d.cat) + ' &rarr; ' + App.escapeHTML(d.cls)
      : App.escapeHTML(d.cat) + ' &rarr; ' + App.escapeHTML(d.cls) + ' &rarr; ' + App.escapeHTML(d.grp);
    var pct = totalRules ? ((d.value / totalRules) * 100).toFixed(1) : '0.0';
    var html =
      '<div class="tt-title">FLOW</div>' +
      '<div class="tt-path" style="color:' + (CATEGORY_COLORS[d.cat] || '#8888aa') + '">' + pathStr + '</div>' +
      '<div class="tt-row"><span>Rule Count</span><span>' + App.fmtNum(d.value) + '</span></div>' +
      '<div class="tt-row"><span>% of Total</span><span>' + pct + '%</span></div>';
    App.tooltip.show(event.clientX, event.clientY, html);
  }

  function showNodeTooltip(event, d, totalRules){
    var color = d.group === 'class' ? (d.borderColor || '#8888aa') : (d.color || '#8888aa');
    var pct = totalRules ? ((d.total / totalRules) * 100).toFixed(1) : '0.0';
    var html =
      '<div class="tt-title">' + App.escapeHTML(d.name) + '</div>' +
      '<div class="tt-path" style="color:' + color + '">' + App.escapeHTML(d.group.toUpperCase()) + '</div>' +
      '<div class="tt-row"><span>Rule Count</span><span>' + App.fmtNum(d.total) + '</span></div>' +
      '<div class="tt-row"><span>% of Total</span><span>' + pct + '%</span></div>';
    App.tooltip.show(event.clientX, event.clientY, html);
  }

  function renderSankey(){
    if (!App.data) return;
    if (!els.chartContainer) return;
    var rulesArray = state.currentMode === 'allow' ? App.data.rules : App.data.dontaudit_rules;
    var dataset = computeDataset(rulesArray || []);
    var built = buildSankeyGraph(dataset);

    var container = els.chartContainer;
    var svg = d3.select('#snk-svg');
    svg.selectAll('*').remove();

    var bounds = container.getBoundingClientRect();
    var width = Math.max(bounds.width, 300);
    var height = Math.max(bounds.height, 300);
    svg.attr('width', width).attr('height', height);

    if (!built.nodes.length || !built.links.length){
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#8888aa')
        .attr('font-size', 13)
        .text('No rules available for this view.');
      updateStats({ totalRules:built.totalRules, links:[] });
      return;
    }

    var nodePad = built.nodes.length > 30 ? 3 : (built.nodes.length > 16 ? 5 : 10);

    var sankeyGen = d3.sankey()
      .nodeId(function(d){ return d.id; })
      .nodeWidth(16)
      .nodePadding(nodePad)
      .nodeAlign(d3.sankeyJustify)
      .nodeSort(null)
      .linkSort(null)
      .extent([[1, 24], [width - 1, height - 12]]);

    var graph = sankeyGen({
      nodes: built.nodes.map(function(d){ return Object.assign({}, d); }),
      links: built.links.map(function(d){ return Object.assign({}, d); })
    });
    graph.totalRules = built.totalRules;

    var maxDepth = d3.max(graph.nodes, function(d){ return d.depth; });

    // adjacency + category-touch sets, built off the live layout node/link objects
    graph.nodes.forEach(function(n){ n.neighbors = {}; n.cats = {}; });
    graph.links.forEach(function(l){
      l.source.neighbors[l.target.id] = true;
      l.target.neighbors[l.source.id] = true;
      l.source.cats[l.cat] = true;
      l.target.cats[l.cat] = true;
    });

    var linkGen = d3.sankeyLinkHorizontal();

    var linkSel = svg.append('g').attr('class', 'links').attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('class', 'snk-link')
      .attr('d', linkGen)
      .attr('stroke', function(d){ return CATEGORY_COLORS[d.cat] || '#8888aa'; })
      .attr('stroke-width', function(d){ return Math.max(1, d.width); })
      .attr('stroke-opacity', 0.2)
      .on('mousemove', function(event, d){
        state.hoverLink = d; state.hoverNodeId = null;
        refreshOpacity();
        showLinkTooltip(event, d, graph.totalRules);
      })
      .on('mouseleave', function(){
        state.hoverLink = null;
        refreshOpacity();
        App.tooltip.hide();
      });

    var nodeG = svg.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(graph.nodes)
      .join('g');

    nodeG.append('rect')
      .attr('class', function(d){ return 'snk-node-rect' + (d.group === 'category' ? ' clickable' : ''); })
      .attr('x', function(d){ return d.x0; })
      .attr('y', function(d){ return d.y0; })
      .attr('width', function(d){ return d.x1 - d.x0; })
      .attr('height', function(d){ return Math.max(1, d.y1 - d.y0); })
      .attr('fill', nodeColor)
      .attr('stroke', nodeStroke)
      .on('mousemove', function(event, d){
        state.hoverNodeId = d.id; state.hoverLink = null;
        refreshOpacity();
        showNodeTooltip(event, d, graph.totalRules);
      })
      .on('mouseleave', function(){
        state.hoverNodeId = null;
        refreshOpacity();
        App.tooltip.hide();
      })
      .on('click', function(event, d){
        if (d.group !== 'category') return;
        var cat = d.name;
        state.activeFilterCat = (state.activeFilterCat === cat) ? null : cat;
        els.filterHint.classList.toggle('on', !!state.activeFilterCat);
        refreshOpacity();
      });

    nodeG.filter(function(d){ return (d.y1 - d.y0) >= 8; })
      .append('text')
      .attr('class', 'snk-label')
      .attr('x', function(d){ return d.depth < maxDepth ? d.x1 + 6 : d.x0 - 6; })
      .attr('y', function(d){ return (d.y0 + d.y1) / 2 - 2; })
      .attr('text-anchor', function(d){ return d.depth < maxDepth ? 'start' : 'end'; })
      .attr('dominant-baseline', 'auto')
      .text(function(d){ return d.name; });

    nodeG.filter(function(d){ return (d.y1 - d.y0) >= 8; })
      .append('text')
      .attr('class', 'snk-label-sub')
      .attr('x', function(d){ return d.depth < maxDepth ? d.x1 + 6 : d.x0 - 6; })
      .attr('y', function(d){ return (d.y0 + d.y1) / 2 + 10; })
      .attr('text-anchor', function(d){ return d.depth < maxDepth ? 'start' : 'end'; })
      .text(function(d){ return App.fmtNum(d.total); });

    // column titles
    var colLabels = ['DOMAIN CATEGORY', 'OBJECT CLASS', 'PERMISSION GROUP'];
    for (var depth = 0; depth <= maxDepth; depth++){
      var colNodes = graph.nodes.filter(function(n){ return n.depth === depth; });
      if (!colNodes.length) continue;
      var cx = (colNodes[0].x0 + colNodes[0].x1) / 2;
      svg.append('text')
        .attr('class', 'snk-col-title')
        .attr('x', cx)
        .attr('y', 14)
        .attr('text-anchor', 'middle')
        .text(colLabels[depth] || '');
    }

    state.lastGraph = graph;
    refreshOpacity();
    updateStats(graph);
  }

  /* ============================================================
     Mode toggle (source: sankey-flow.html lines 592-603)
     ============================================================ */
  function setMode(mode){
    if (mode === state.currentMode) return;
    state.currentMode = mode;
    state.activeFilterCat = null;
    state.hoverLink = null;
    state.hoverNodeId = null;
    els.filterHint.classList.remove('on');
    els.toggleButtons.forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    renderSankey();
  }

  /* ============================================================
     Resize (source: sankey-flow.html lines 707-713 -- the standalone
     page's own window resize listener + setTimeout debounce is replaced
     by the App.registerView onResize hook + App.debounce helper, matching
     how the other ported views handle resize)
     ============================================================ */
  var debouncedRenderSankey = App.debounce(function(){
    if (App.activeView !== 'sankey-flow') return;
    if (App.data) renderSankey();
  }, 150);
  function onSankeyResize(){ debouncedRenderSankey(); }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createSankey(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (toolbar + chart container) inside container */
    var root = App.el('div','snk-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.toggleButtons = root.querySelectorAll('.snk-toggle-btn');
    els.filterHint = root.querySelector('#snk-filter-hint');
    els.stats = root.querySelector('#snk-stats');
    els.chartContainer = root.querySelector('#snk-chart-container');

    /* 3. Wire event listeners (source: sankey-flow.html lines 690-692) */
    els.toggleButtons.forEach(function(btn){
      btn.addEventListener('click', function(){ setMode(btn.getAttribute('data-mode')); });
    });

    /* 4. Index App.data the way loadPolicy() indexed a freshly-dropped
       file (source: sankey-flow.html lines 626-627) */
    state.catLookup = buildCatLookup(App.data || {});

    /* 5. Lazy-load d3-sankey, then render */
    ensureSankeyLib(function(){
      if (App.activeView !== 'sankey-flow') return;
      if (!els.chartContainer) return;
      renderSankey();
    });
  }

  function destroySankey(){
    if (els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if (styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Clear local state */
    state.catLookup = {};
    state.currentMode = 'allow';
    state.activeFilterCat = null;
    state.hoverLink = null;
    state.hoverNodeId = null;
    state.lastGraph = null;
  }

  App.registerView('sankey-flow', { label: 'SANKEY', icon: '⇉', create: createSankey, destroy: destroySankey, onResize: onSankeyResize });
})();
