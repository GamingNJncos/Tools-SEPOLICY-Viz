/* entropy-strip.js -- permission entropy strip view (per-domain Shannon
   entropy over rule object-class distribution), ported from
   sepolicy_viz/views/entropy-strip.html standalone (696 lines) */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: standalone entropy-strip.html lines 60-244. The
     standalone's :root/html,body/#dropzone/#file-input/#app/full
     .tooltip block are dropped -- those are handled globally by the
     v2 shell (theme.css + ui.js's #tooltip element / App.tooltip).
     .tooltip .tt-sub is kept since theme.css's shared tooltip rules
     only style .tt-title/.tt-class, not .tt-sub (source line 238-243).
     ============================================================ */
  var CSS = ''
    + '.entropy-strip-root{padding:16px 24px 24px 24px;overflow-y:auto;max-height:calc(100vh - var(--topbar-h));}'
    + '.entropy-strip-root .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:1px solid var(--border);}'
    + '.entropy-strip-root .header .title{font-size:18px;letter-spacing:3px;color:var(--cyan);text-shadow:0 0 10px rgba(0,255,242,0.4);}'
    + '.entropy-strip-root .header .subtitle{margin-top:6px;font-size:11px;color:var(--text2);max-width:760px;line-height:1.5;}'
    + '.entropy-strip-root .legend{display:flex;flex-wrap:wrap;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);}'
    + '.entropy-strip-root .legend-item{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--text);user-select:none;}'
    + '.entropy-strip-root .legend-item.hidden{opacity:0.3;text-decoration:line-through;}'
    + '.entropy-strip-root .legend-swatch{width:10px;height:10px;border-radius:2px;display:inline-block;}'
    + '.entropy-strip-root .section{padding:18px 0 26px 0;border-bottom:1px solid var(--border);}'
    + '.entropy-strip-root .section-title{font-size:13px;letter-spacing:2px;color:var(--text);margin-bottom:4px;}'
    + '.entropy-strip-root .section-sub{font-size:10px;letter-spacing:0;color:var(--text2);text-transform:none;}'
    + '.entropy-strip-root .chart-wrap{width:100%;overflow-x:auto;}'
    + '.entropy-strip-root .chart-wrap svg{display:block;}'
    + '.entropy-strip-root .axis path,.entropy-strip-root .axis line{stroke:var(--border);}'
    + '.entropy-strip-root .axis text{fill:var(--text2);font-size:10px;}'
    + '.entropy-strip-root .domain-dot{cursor:pointer;stroke:#000;stroke-opacity:0.35;stroke-width:0.6;}'
    + '.entropy-strip-root .domain-dot:hover{stroke:var(--text);stroke-opacity:0.9;stroke-width:1.2;}'
    + '.entropy-strip-root .label-leader{stroke:var(--text2);stroke-width:0.6;opacity:0.5;}'
    + '.entropy-strip-root .label-text{fill:var(--text2);font-size:9px;}'
    + '.entropy-strip-root .hist-bar{fill:var(--cyan);opacity:0.45;}'
    + '.entropy-strip-root .brush .selection{fill:var(--cyan);fill-opacity:0.08;stroke:var(--cyan);stroke-opacity:0.6;}'
    + '.entropy-strip-root .list-label{margin-top:14px;font-size:10px;letter-spacing:1px;color:var(--text2);}'
    + '.entropy-strip-root .filtered-list{margin-top:6px;max-height:170px;overflow-y:auto;font-size:11px;border:1px solid var(--border);border-radius:4px;padding:6px 10px;background:var(--surface);}'
    + '.entropy-strip-root .filtered-list .row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid var(--border);}'
    + '.entropy-strip-root .filtered-list .row:last-child{border-bottom:none;}'
    + '.entropy-strip-root .filtered-list .list-empty{color:var(--text2);padding:4px 0;}'
    + '.entropy-strip-root .no-data-msg{color:var(--text2);font-size:11px;padding:20px 0;}'
    + '.tooltip .tt-sub{margin-top:5px;color:var(--text2);border-top:1px solid var(--border);padding-top:4px;}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from standalone markup lines 255-279).
     #app is renamed to .entropy-strip-root (this module's own
     container, standalone used a persistent top-level <div id="app">).
     The #dropzone/#file-input markup and the header's reset-btn are
     dropped -- file loading and "LOAD NEW FILE" are handled globally
     by the v2 shell. Ids are prefixed "es-" to keep this view's DOM
     self-describing (matches audit-/treemap- prefixing convention in
     sibling view modules); the standalone's own "#tooltip" div is
     dropped entirely since it would collide with the shell's
     persistent #tooltip element (index.html) driven by App.tooltip.
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="header">'
    +   '<div>'
    +     '<div class="title">PERMISSION ENTROPY STRIP</div>'
    +     '<div class="subtitle">Shannon entropy of each domain\'s object-class distribution. Low entropy (left) = tightly focused on 1-2 classes, expected for purpose-built daemons. High entropy (right) = rules spread across many classes — investigate for over-privilege.</div>'
    +   '</div>'
    + '</div>'
    + '<div id="es-legend" class="legend"></div>'
    + '<div class="section" id="es-section-main">'
    +   '<div class="section-title">RULE ENTROPY <span class="section-sub">— allow rules, H = -sum(p * log2 p) over object classes</span></div>'
    +   '<div class="chart-wrap"><svg id="es-svg-main"></svg></div>'
    +   '<div class="list-label">SELECTED DOMAINS — drag a range on the strip above to filter</div>'
    +   '<div class="filtered-list" id="es-list-main"><div class="list-empty">no selection</div></div>'
    + '</div>'
    + '<div class="section" id="es-section-da">'
    +   '<div class="section-title">DONTAUDIT ENTROPY <span class="section-sub">— high entropy here means a domain\'s dontaudit rules hide many distinct access types</span></div>'
    +   '<div class="chart-wrap" id="es-chart-wrap-da"><svg id="es-svg-da"></svg></div>'
    +   '<div class="list-label">SELECTED DOMAINS — drag a range on the strip above to filter</div>'
    +   '<div class="filtered-list" id="es-list-da"><div class="list-empty">no selection</div></div>'
    + '</div>';

  /* ============================================================
     Local state (replaces the standalone's top-level rawData/
     domainCategory/hiddenCategories/sections/state vars, source
     lines 293-297). rawData/domainCategory are dropped -- the v2
     shell already loads App.data and builds App.state.domainCategory
     centrally (data.js buildIndices), so categoryOf() below reads
     that instead of recomputing its own map.
     ============================================================ */
  var hiddenCategories = new Set();
  var sections = {};
  var state = null;

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  var CATEGORY_COLORS = {
    hal:'#00fff2', app:'#ff00ff', vendor:'#ffaa00', system:'#39ff88',
    shell:'#b967ff', core:'#ff3355', other:'#8888aa'
  };
  var CATEGORY_ORDER = ['hal','app','vendor','system','shell','core','other'];

  /* source: standalone lines 347-357 */
  function hashStr(str){
    var h = 0;
    for(var i=0;i<str.length;i++){
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    h = h ^ (h >>> 15);
    return Math.abs(h);
  }
  function jitter01(str){
    return (hashStr(str) % 1000) / 1000;
  }

  /* source: standalone lines 359-370 (buildDomainCategoryMap dropped --
     App.state.domainCategory is already built by App.buildIndices with
     the same semantics: data.categories membership, default 'other') */
  function categoryOf(domain){
    return App.state.domainCategory[domain] || 'other';
  }

  /* source: standalone lines 372-403 */
  function computeStats(rules){
    var byDomain = new Map();
    (rules || []).forEach(function(r){
      if(!r || !r.s || !r.c) return;
      if(!byDomain.has(r.s)) byDomain.set(r.s, new Map());
      var m = byDomain.get(r.s);
      m.set(r.c, (m.get(r.c) || 0) + 1);
    });
    var out = [];
    byDomain.forEach(function(classCounts, domain){
      var total = 0;
      classCounts.forEach(function(v){ total += v; });
      if(total === 0) return;
      var H = 0;
      var entries = [];
      classCounts.forEach(function(count, cls){
        var p = count / total;
        if(p > 0) H -= p * Math.log2(p);
        entries.push({ cls: cls, count: count, pct: p * 100 });
      });
      entries.sort(function(a,b){ return b.count - a.count; });
      out.push({
        domain: domain,
        category: categoryOf(domain),
        entropy: H,
        totalRules: total,
        classCount: entries.length,
        topClasses: entries.slice(0,3)
      });
    });
    return out;
  }

  /* source: standalone lines 405-416 */
  function buildLegend(){
    var legend = d3.select('#es-legend');
    legend.html('');
    CATEGORY_ORDER.forEach(function(cat){
      var item = legend.append('div')
        .attr('class','legend-item')
        .attr('data-cat', cat)
        .on('click', function(){ toggleCategory(cat); });
      item.append('span').attr('class','legend-swatch').style('background', CATEGORY_COLORS[cat]);
      item.append('span').text(cat);
    });
  }

  /* source: standalone lines 418-423 */
  function toggleCategory(cat){
    if(hiddenCategories.has(cat)) hiddenCategories.delete(cat);
    else hiddenCategories.add(cat);
    d3.select('.legend-item[data-cat="' + cat + '"]').classed('hidden', hiddenCategories.has(cat));
    updateVisibility();
  }

  /* source: standalone lines 425-432 */
  function updateVisibility(){
    d3.selectAll('.domain-dot').style('display', function(d){
      return hiddenCategories.has(d.category) ? 'none' : null;
    });
    Object.keys(sections).forEach(function(prefix){
      redrawHistogram(prefix);
    });
  }

  /* source: standalone lines 434-446 (showTooltip). positionTooltip
     (source lines 447-456) and the local tooltip div lookup are
     dropped -- App.tooltip.show/hide own placement + visibility now. */
  function tooltipHTML(d){
    var html = '<div class="tt-title" style="color:' + CATEGORY_COLORS[d.category] + '">' + App.escapeHTML(d.domain) + '</div>';
    html += '<div>category: <b style="color:' + CATEGORY_COLORS[d.category] + '">' + d.category + '</b></div>';
    html += '<div>entropy: <b>' + d.entropy.toFixed(3) + '</b> bits (' + d.classCount + ' classes)</div>';
    html += '<div>total rules: <b>' + d.totalRules + '</b></div>';
    html += '<div class="tt-sub">top classes</div>';
    d.topClasses.forEach(function(c){
      html += '<div>' + App.escapeHTML(c.cls) + ' — ' + c.count + ' (' + c.pct.toFixed(1) + '%)</div>';
    });
    return html;
  }

  /* source: standalone lines 461-474 */
  function placeLabels(items, xScale, minGap){
    var sorted = items.slice().sort(function(a,b){
      return xScale(a.d.entropy) - xScale(b.d.entropy);
    });
    var lastX = -Infinity;
    sorted.forEach(function(item){
      var desired = xScale(item.d.entropy);
      var x = Math.max(desired, lastX + minGap);
      lastX = x;
      item.anchorX = desired;
      item.labelX = x;
    });
    return sorted;
  }

  /* source: standalone lines 476-489 */
  function renderList(prefix, sel){
    var list = d3.select('#es-list-' + prefix);
    list.html('');
    if(!sel.length){
      list.append('div').attr('class','list-empty').text('no domains in range');
      return;
    }
    sel.sort(function(a,b){ return b.entropy - a.entropy; });
    sel.forEach(function(d){
      var row = list.append('div').attr('class','row');
      row.append('span').style('color', CATEGORY_COLORS[d.category]).text(d.domain);
      row.append('span').style('color','var(--text2)').text(d.entropy.toFixed(3) + ' bits · ' + d.totalRules + ' rules');
    });
  }

  /* source: standalone lines 491-506 */
  function redrawHistogram(prefix){
    var s = sections[prefix];
    if(!s) return;
    var visible = s.stats.filter(function(d){ return !hiddenCategories.has(d.category); });
    var binGen = d3.bin().domain(s.xScale.domain()).thresholds(20);
    var binsData = binGen(visible.map(function(d){ return d.entropy; }));
    var maxBin = d3.max(binsData, function(d){ return d.length; }) || 1;
    var yHist = d3.scaleLinear().domain([0, maxBin]).range([s.histH, 0]);
    var gHist = d3.select('#es-hist-g-' + prefix);
    gHist.selectAll('.hist-bar').data(binsData).join('rect')
      .attr('class','hist-bar')
      .attr('x', function(d){ return s.xScale(d.x0) + 1; })
      .attr('width', function(d){ return Math.max(0, s.xScale(d.x1) - s.xScale(d.x0) - 2); })
      .attr('y', function(d){ return yHist(d.length); })
      .attr('height', function(d){ return s.histH - yHist(d.length); });
  }

  /* source: standalone lines 508-634 */
  function renderStrip(prefix, stats, maxEntropy){
    var svg = d3.select('#es-svg-' + prefix);
    svg.selectAll('*').remove();
    var container = document.getElementById('es-svg-' + prefix).parentElement;
    var W = Math.max(760, container.clientWidth);

    var marginL = 130, marginR = 30;
    var Y_TOP_PAD = 40;
    var stripH = 240;
    var Y_STRIP_TOP = Y_TOP_PAD;
    var Y_STRIP_BOTTOM = Y_TOP_PAD + stripH;
    var Y_LOW_LABEL = Y_STRIP_BOTTOM + 26;
    var Y_AXIS = Y_STRIP_BOTTOM + 56;
    var Y_HIST_TOP = Y_AXIS + 26;
    var histH = 90;
    var totalH = Y_HIST_TOP + histH + 16;

    svg.attr('width', W).attr('height', totalH).attr('viewBox', '0 0 ' + W + ' ' + totalH);

    var xScale = d3.scaleLinear().domain([0, maxEntropy]).range([marginL, W - marginR]).nice();

    var yBand = d3.scaleBand().domain(CATEGORY_ORDER).range([Y_STRIP_TOP, Y_STRIP_BOTTOM]).paddingInner(0.08);

    CATEGORY_ORDER.forEach(function(cat){
      var y0 = yBand(cat);
      svg.append('rect')
        .attr('x', 0).attr('y', y0)
        .attr('width', W).attr('height', yBand.bandwidth())
        .attr('fill', CATEGORY_COLORS[cat]).attr('opacity', 0.035);
      svg.append('text')
        .attr('x', 8).attr('y', y0 + yBand.bandwidth()/2).attr('dy','0.32em')
        .attr('fill', CATEGORY_COLORS[cat]).attr('font-size', 10)
        .text(cat);
    });

    var maxCount = d3.max(stats, function(d){ return d.totalRules; }) || 1;
    var rScale = maxCount > 1
      ? d3.scaleSqrt().domain([1, maxCount]).range([4,8])
      : function(){ return 6; };

    svg.selectAll('.domain-dot').data(stats, function(d){ return d.domain; }).join('circle')
      .attr('class','domain-dot')
      .attr('cx', function(d){ return xScale(d.entropy); })
      .attr('cy', function(d){ return yBand(d.category) + 6 + jitter01(d.domain) * (yBand.bandwidth() - 12); })
      .attr('r', function(d){ return rScale(d.totalRules); })
      .attr('fill', function(d){ return CATEGORY_COLORS[d.category]; })
      .attr('fill-opacity', 0.75)
      .style('display', function(d){ return hiddenCategories.has(d.category) ? 'none' : null; })
      .on('mousemove', function(event,d){ App.tooltip.show(event.clientX, event.clientY, tooltipHTML(d)); })
      .on('mouseleave', function(){ App.tooltip.hide(); })
      .on('click', function(event,d){ if (App.openGraphView) App.openGraphView(d.domain); });

    var sorted = stats.slice().sort(function(a,b){ return b.entropy - a.entropy; });
    var highest = sorted.slice(0,10).map(function(d){ return { d: d }; });
    var lowSource = sorted.slice(-5).reverse();
    var seen = {};
    highest.forEach(function(item){ seen[item.d.domain] = true; });
    var lowest = [];
    lowSource.forEach(function(d){
      if(!seen[d.domain]){ lowest.push({ d: d }); seen[d.domain] = true; }
    });

    var highPlaced = placeLabels(highest, xScale, 46);
    highPlaced.forEach(function(item){
      var d = item.d;
      var y0 = yBand(d.category) + 6 + jitter01(d.domain) * (yBand.bandwidth() - 12);
      svg.append('line').attr('class','label-leader')
        .attr('x1', item.anchorX).attr('y1', y0)
        .attr('x2', item.labelX).attr('y2', 14);
      svg.append('text').attr('class','label-text')
        .attr('x', item.labelX).attr('y', 10)
        .attr('text-anchor','start')
        .attr('transform', 'rotate(-38 ' + item.labelX + ' 10)')
        .text(d.domain);
    });

    var lowPlaced = placeLabels(lowest, xScale, 46);
    lowPlaced.forEach(function(item){
      var d = item.d;
      var y0 = yBand(d.category) + 6 + jitter01(d.domain) * (yBand.bandwidth() - 12);
      svg.append('line').attr('class','label-leader')
        .attr('x1', item.anchorX).attr('y1', y0)
        .attr('x2', item.labelX).attr('y2', Y_LOW_LABEL - 6);
      svg.append('text').attr('class','label-text')
        .attr('x', item.labelX).attr('y', Y_LOW_LABEL)
        .attr('text-anchor','start')
        .attr('transform', 'rotate(38 ' + item.labelX + ' ' + Y_LOW_LABEL + ')')
        .text(d.domain);
    });

    var gAxis = svg.append('g').attr('class','axis').attr('transform', 'translate(0,' + Y_AXIS + ')');
    gAxis.call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('.2f')));
    svg.append('text')
      .attr('x', (marginL + (W - marginR)) / 2).attr('y', Y_AXIS + 34)
      .attr('text-anchor','middle').attr('fill','var(--text2)').attr('font-size',10)
      .text('entropy (bits)');

    var gHist = svg.append('g').attr('id', 'es-hist-g-' + prefix).attr('transform', 'translate(0,' + Y_HIST_TOP + ')');
    svg.append('text')
      .attr('x', marginL).attr('y', Y_HIST_TOP - 8)
      .attr('fill','var(--text2)').attr('font-size',9)
      .text('domain count per entropy bin');

    sections[prefix] = {
      xScale: xScale, stats: stats, histH: histH,
      Y_STRIP_TOP: Y_STRIP_TOP, Y_STRIP_BOTTOM: Y_STRIP_BOTTOM
    };
    redrawHistogram(prefix);

    var brush = d3.brushX()
      .extent([[marginL, Y_STRIP_TOP], [W - marginR, Y_STRIP_BOTTOM]])
      .on('end', function(event){
        if(!event.selection){
          renderList(prefix, []);
          return;
        }
        var range = event.selection.map(xScale.invert);
        var lo = Math.min(range[0], range[1]);
        var hi = Math.max(range[0], range[1]);
        var sel = stats.filter(function(d){
          return !hiddenCategories.has(d.category) && d.entropy >= lo && d.entropy <= hi;
        });
        renderList(prefix, sel);
      });

    svg.append('g').attr('class','brush').call(brush);
  }

  /* source: standalone lines 636-642. Invoked via the onResize view
     hook (App core dispatches window resize to the active view, see
     core.js) instead of the standalone's own window listener. */
  function rerenderAll(){
    if(!state) return;
    renderStrip('main', state.mainStats, state.maxE);
    if(state.daStats.length){
      renderStrip('da', state.daStats, state.maxE);
    }
  }

  /* source: standalone line 652 -- debounce(rerenderAll,250) wrapped
     the resize listener there; same debounce is kept here, just
     wired through App.debounce + the onResize lifecycle hook below. */
  var debouncedRerenderAll = App.debounce(rerenderAll, 250);

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createEntropyStrip(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (header, legend, two entropy-strip sections)
       inside container */
    var root = App.el('div','entropy-strip-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    /* 3. Reset local state (view may be re-created after destroy) */
    hiddenCategories = new Set();
    sections = {};
    state = null;

    /* 4. Compute stats + render (equivalent to the standalone's
       onDataLoaded(), source lines 654-674, inlined here rather than
       reacting to a file-load event -- App.data is already loaded by
       the time this view is created) */
    buildLegend();
    var mainStats = computeStats(App.data.rules);
    var daStats = computeStats(App.data.dontaudit_rules);
    var maxE = Math.max(1, d3.max(mainStats.concat(daStats), function(d){ return d.entropy; }) || 1) * 1.08;

    state = { mainStats: mainStats, daStats: daStats, maxE: maxE };

    renderStrip('main', mainStats, maxE);

    if(daStats.length){
      renderStrip('da', daStats, maxE);
    } else {
      d3.select('#es-chart-wrap-da').html('<div class="no-data-msg">no dontaudit_rules present in this dataset</div>');
    }
  }

  function destroyEntropyStrip(){
    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Clear local state */
    hiddenCategories = new Set();
    sections = {};
    state = null;
  }

  App.registerView('entropy-strip', { label: 'ENTROPY', icon: 'Ħ', create: createEntropyStrip, destroy: destroyEntropyStrip, onResize: debouncedRerenderAll });
})();
