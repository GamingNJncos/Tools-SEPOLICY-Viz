(function() {

  var CSS = `
  :root{
    --bg:#0a0a1a; --surface:#141428; --surface2:#1b1b36; --border:#1a1a3a;
    --text:#e0e0ff; --text2:#8888aa; --cyan:#00fff2; --magenta:#ff00ff;
    --amber:#ffaa00; --green:#39ff88; --red:#ff3355; --purple:#b967ff;
  }
  .scatterplot-view{ display:flex; flex-direction:column; width:100%; height:100%; }
  .scatterplot-view *{ box-sizing:border-box; }

  /* ---------- toolbar ---------- */
  .scatterplot-view #toolbar{
    display:flex; flex-wrap:wrap; align-items:center; gap:18px;
    background:var(--surface); border-bottom:1px solid var(--border);
    padding:10px 16px; flex:0 0 auto;
  }
  .scatterplot-view .tb-group{ display:flex; align-items:center; gap:8px; }
  .scatterplot-view .tb-group label{
    font-size:10px; letter-spacing:1.5px; color:var(--text2); text-transform:uppercase;
  }
  .scatterplot-view select{
    background:var(--surface2); color:var(--text); border:1px solid var(--border);
    font-family:inherit; font-size:12px; padding:6px 10px; border-radius:4px; outline:none;
    cursor:pointer;
  }
  .scatterplot-view select:hover, .scatterplot-view select:focus{ border-color:var(--cyan); }
  .scatterplot-view .tb-sep{ width:1px; align-self:stretch; background:var(--border); }
  .scatterplot-view #category-filters{ display:flex; flex-wrap:wrap; gap:6px; }
  .scatterplot-view .cat-chip{
    --chip-color:#8888aa;
    display:flex; align-items:center; gap:6px; padding:4px 10px 4px 8px;
    border:1px solid var(--border); border-radius:20px; cursor:pointer; user-select:none;
    font-size:10px; letter-spacing:1px; color:var(--text2); background:var(--surface2);
    transition:border-color .12s ease, color .12s ease;
  }
  .scatterplot-view .cat-chip:hover{ border-color:var(--chip-color); color:var(--text); }
  .scatterplot-view .cat-chip input{ display:none; }
  .scatterplot-view .chip-swatch{
    width:9px; height:9px; border-radius:50%; background:var(--chip-color);
    box-shadow:0 0 6px var(--chip-color); flex:0 0 auto;
  }
  .scatterplot-view .cat-chip input:not(:checked) ~ .chip-swatch{ box-shadow:none; opacity:0.25; }
  .scatterplot-view .cat-chip input:not(:checked) ~ .chip-label{ opacity:0.35; text-decoration:line-through; }
  .scatterplot-view #tb-stats{
    margin-left:auto; font-size:11px; color:var(--text2); letter-spacing:1px;
    white-space:nowrap;
  }

  /* ---------- chart ---------- */
  .scatterplot-view #chart-container{ position:relative; flex:1 1 auto; min-height:0; }
  .scatterplot-view #scatter-svg{ display:block; width:100%; height:100%; }
  .scatterplot-view .axis path, .scatterplot-view .axis line{ stroke:var(--border); }
  .scatterplot-view .axis text{ fill:var(--text2); font-size:10px; font-family:inherit; }
  .scatterplot-view .axis-label{ fill:var(--text); font-size:11px; letter-spacing:1.5px; text-transform:uppercase; }
  .scatterplot-view .ref-line{ stroke:var(--amber); stroke-width:1; stroke-dasharray:4 4; stroke-opacity:0.35; }
  .scatterplot-view .dot{ cursor:pointer; transition:fill-opacity .1s ease, stroke-width .1s ease; }

  .scatterplot-view .tt-title{ font-size:13px; font-weight:700; color:var(--text); margin-bottom:2px; word-break:break-all; }
  .scatterplot-view .tt-cat{ font-size:10px; letter-spacing:1.5px; margin-bottom:8px; }
  .scatterplot-view .tt-row{ display:flex; justify-content:space-between; gap:16px; color:var(--text2); }
  .scatterplot-view .tt-row span:last-child{ color:var(--text); }

  .scatterplot-view #legend-size{
    position:absolute; right:16px; bottom:14px; display:flex; align-items:flex-end; gap:10px;
    background:rgba(20,20,40,0.75); border:1px solid var(--border); border-radius:6px;
    padding:10px 14px; font-size:9px; color:var(--text2); letter-spacing:1px;
  }
  .scatterplot-view #legend-size .ls-title{ position:absolute; top:-16px; left:0; font-size:9px; letter-spacing:1px; }
  .scatterplot-view .ls-dot{ display:flex; flex-direction:column; align-items:center; gap:4px; }
  .scatterplot-view .ls-dot svg{ display:block; }
  .scatterplot-view .ls-circle{ fill:none; stroke:var(--text2); stroke-width:1; }
  `;

  var styleEl = null;
  var containerEl = null;
  var resizeHandler = null;
  var resizeTimer = null;

  var METRICS = [
    { key:'ruleCount',          label:'Rule Count' },
    { key:'capabilityCount',    label:'Capability Count' },
    { key:'targetTypeBreadth',  label:'Target Type Breadth' },
    { key:'execTypeCount',      label:'Exec Type Count' },
    { key:'writeTargetCount',   label:'Write Target Count' },
    { key:'dontauditCount',     label:'Dontaudit Count' },
    { key:'transitionFanout',   label:'Transition Fan-out' }
  ];

  var CATEGORY_ORDER = ['hal','app','vendor','system','shell','core','other'];
  var CATEGORY_COLORS = {
    hal:'#00fff2', app:'#ff00ff', vendor:'#ffaa00', system:'#39ff88',
    shell:'#b967ff', core:'#ff3355', other:'#8888aa'
  };

  var allData = [];
  var policyMeta = {};
  var activeCategories = new Set(CATEGORY_ORDER);
  var xKey = 'targetTypeBreadth';
  var yKey = 'capabilityCount';

  // ---------- data processing ----------

  function buildDomainData(policy){
    var domains = Array.isArray(policy.domains) ? policy.domains : [];
    var categories = policy.categories || {};
    var domainRuleCounts = policy.domain_rule_counts || {};
    var rules = Array.isArray(policy.rules) ? policy.rules : [];
    var dontauditRules = Array.isArray(policy.dontaudit_rules) ? policy.dontaudit_rules : [];
    var typeTransitions = Array.isArray(policy.type_transitions) ? policy.type_transitions : [];

    var catLookup = {};
    Object.keys(categories).forEach(function(cat){
      (categories[cat] || []).forEach(function(d){ catLookup[d] = cat; });
    });

    var rulesBySource = new Map();
    rules.forEach(function(r){
      if (!r || !r.s) return;
      if (!rulesBySource.has(r.s)) rulesBySource.set(r.s, []);
      rulesBySource.get(r.s).push(r);
    });

    var dontauditBySource = new Map();
    dontauditRules.forEach(function(r){
      if (!r || !r.s) return;
      dontauditBySource.set(r.s, (dontauditBySource.get(r.s) || 0) + 1);
    });

    var transitionsBySource = new Map();
    typeTransitions.forEach(function(r){
      if (!r || !r.s) return;
      if (r.c === 'process'){
        transitionsBySource.set(r.s, (transitionsBySource.get(r.s) || 0) + 1);
      }
    });

    return domains.map(function(name){
      var domainRules = rulesBySource.get(name) || [];
      var targetTypes = new Set();
      var capPerms = new Set();
      var execTargets = new Set();
      var writeTargets = new Set();

      domainRules.forEach(function(r){
        if (r.t) targetTypes.add(r.t);
        var cls = (r.c || '').toLowerCase();
        var perms = Array.isArray(r.p) ? r.p : [];
        if (cls.indexOf('capability') !== -1){
          perms.forEach(function(p){ capPerms.add(p); });
        }
        if (perms.indexOf('execute_no_trans') !== -1){
          execTargets.add(r.t);
        }
        if (cls === 'file' && (perms.indexOf('write') !== -1 || perms.indexOf('create') !== -1)){
          writeTargets.add(r.t);
        }
      });

      var ruleCount = (domainRuleCounts[name] !== undefined) ? domainRuleCounts[name] : domainRules.length;

      return {
        name: name,
        category: catLookup[name] || 'other',
        ruleCount: ruleCount,
        capabilityCount: capPerms.size,
        targetTypeBreadth: targetTypes.size,
        execTypeCount: execTargets.size,
        writeTargetCount: writeTargets.size,
        dontauditCount: dontauditBySource.get(name) || 0,
        transitionFanout: transitionsBySource.get(name) || 0
      };
    });
  }

  // ---------- ui: axis selects ----------

  function buildAxisSelects(){
    var xSel = containerEl.querySelector('#x-select');
    var ySel = containerEl.querySelector('#y-select');
    METRICS.forEach(function(m){
      var optX = document.createElement('option');
      optX.value = m.key; optX.textContent = m.label;
      xSel.appendChild(optX);
      var optY = document.createElement('option');
      optY.value = m.key; optY.textContent = m.label;
      ySel.appendChild(optY);
    });
    xSel.value = xKey;
    ySel.value = yKey;
    xSel.addEventListener('change', function(){ xKey = xSel.value; renderChart(); });
    ySel.addEventListener('change', function(){ yKey = ySel.value; renderChart(); });
  }

  // ---------- ui: category filters ----------

  function buildCategoryFilters(){
    var wrap = containerEl.querySelector('#category-filters');
    wrap.innerHTML = '';
    var counts = {};
    CATEGORY_ORDER.forEach(function(c){ counts[c] = 0; });
    allData.forEach(function(d){ counts[d.category] = (counts[d.category] || 0) + 1; });

    CATEGORY_ORDER.forEach(function(cat){
      var label = document.createElement('label');
      label.className = 'cat-chip';
      label.style.setProperty('--chip-color', CATEGORY_COLORS[cat]);

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;

      var swatch = document.createElement('span');
      swatch.className = 'chip-swatch';

      var text = document.createElement('span');
      text.className = 'chip-label';
      text.textContent = cat.toUpperCase() + ' (' + counts[cat] + ')';

      label.appendChild(input);
      label.appendChild(swatch);
      label.appendChild(text);
      wrap.appendChild(label);

      input.addEventListener('change', function(){
        if (input.checked) activeCategories.add(cat); else activeCategories.delete(cat);
        renderChart();
      });
    });
  }

  // ---------- tooltip ----------

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(ch){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch];
    });
  }

  function metricLabel(key){
    for (var i = 0; i < METRICS.length; i++){
      if (METRICS[i].key === key) return METRICS[i].label;
    }
    return key;
  }

  function tooltipHtml(d){
    var rows = METRICS.map(function(m){
      return '<div class="tt-row"><span>' + escapeHtml(m.label) + '</span><span>' + d[m.key] + '</span></div>';
    }).join('');
    return '<div class="tt-title">' + escapeHtml(d.name) + '</div>' +
      '<div class="tt-cat" style="color:' + (CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other) + '">' +
        escapeHtml(d.category.toUpperCase()) +
      '</div>' + rows;
  }

  function showTooltip(event, d){
    App.tooltip.show(event, tooltipHtml(d));
  }

  function hideTooltip(){
    App.tooltip.hide();
  }

  // ---------- stats ----------

  function updateStats(visibleCount){
    var el = containerEl.querySelector('#tb-stats');
    var totalDomains = policyMeta.domain_count !== undefined ? policyMeta.domain_count : allData.length;
    var totalRules = policyMeta.rule_count !== undefined ? policyMeta.rule_count : d3.sum(allData, function(d){ return d.ruleCount; });
    el.textContent = totalDomains + ' DOMAINS • ' + totalRules + ' RULES • VISIBLE ' + visibleCount + '/' + allData.length;
  }

  // ---------- chart ----------

  function renderChart(){
    if (!allData.length) return;

    var container = containerEl.querySelector('#chart-container');
    var svg = d3.select(containerEl.querySelector('#scatter-svg'));
    svg.selectAll('*').remove();

    var bounds = container.getBoundingClientRect();
    var width = Math.max(bounds.width, 200);
    var height = Math.max(bounds.height, 200);
    var margin = { top:26, right:26, bottom:56, left:64 };
    var innerW = Math.max(width - margin.left - margin.right, 10);
    var innerH = Math.max(height - margin.top - margin.bottom, 10);

    var visibleData = allData.filter(function(d){ return activeCategories.has(d.category); });

    var xMax = d3.max(allData, function(d){ return d[xKey]; }) || 1;
    var yMax = d3.max(allData, function(d){ return d[yKey]; }) || 1;
    var rMax = d3.max(allData, function(d){ return d.ruleCount; }) || 1;

    var xScale = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerW]);
    var yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);
    var rScale = d3.scaleSqrt().domain([0, rMax]).range([3, 20]);

    svg.attr('width', width).attr('height', height);
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    g.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', 'translate(0,' + innerH + ')')
      .call(d3.axisBottom(xScale).ticks(8));

    g.append('g')
      .attr('class', 'axis axis-y')
      .call(d3.axisLeft(yScale).ticks(8));

    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', innerW / 2)
      .attr('y', innerH + 44)
      .attr('text-anchor', 'middle')
      .text(metricLabel(xKey));

    g.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -46)
      .attr('text-anchor', 'middle')
      .text(metricLabel(yKey));

    var xMedian = d3.median(allData, function(d){ return d[xKey]; });
    var yMedian = d3.median(allData, function(d){ return d[yKey]; });

    if (xMedian !== undefined){
      g.append('line')
        .attr('class', 'ref-line')
        .attr('x1', xScale(xMedian)).attr('x2', xScale(xMedian))
        .attr('y1', 0).attr('y2', innerH);
    }
    if (yMedian !== undefined){
      g.append('line')
        .attr('class', 'ref-line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', yScale(yMedian)).attr('y2', yScale(yMedian));
    }

    g.selectAll('circle.dot')
      .data(visibleData, function(d){ return d.name; })
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', function(d){ return xScale(d[xKey]); })
      .attr('cy', function(d){ return yScale(d[yKey]); })
      .attr('r', function(d){ return rScale(d.ruleCount); })
      .attr('fill', function(d){ return CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other; })
      .attr('fill-opacity', 0.7)
      .attr('stroke', function(d){ return CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other; })
      .attr('stroke-width', 1)
      .on('mouseenter', function(event, d){
        d3.select(this).raise().attr('fill-opacity', 1).attr('stroke-width', 2);
        showTooltip(event, d);
      })
      .on('mousemove', function(event, d){
        showTooltip(event, d);
      })
      .on('mouseleave', function(){
        d3.select(this).attr('fill-opacity', 0.7).attr('stroke-width', 1);
        hideTooltip();
      })
      .on('click', function(event, d){
        if (App.openGraphView) App.openGraphView(d.domain);
      });

    buildSizeLegend(rScale, rMax);
    updateStats(visibleData.length);
  }

  function buildSizeLegend(rScale, rMax){
    var legend = containerEl.querySelector('#legend-size');
    Array.prototype.slice.call(legend.querySelectorAll('.ls-dot')).forEach(function(el){ el.remove(); });

    var steps = [Math.round(rMax * 0.15) || 1, Math.round(rMax * 0.5) || 1, rMax || 1];
    var uniqueSteps = Array.from(new Set(steps));
    var maxR = rScale(rMax);

    uniqueSteps.forEach(function(val){
      var r = rScale(val);
      var box = document.createElement('div');
      box.className = 'ls-dot';
      var svgNS = 'http://www.w3.org/2000/svg';
      var svgEl = document.createElementNS(svgNS, 'svg');
      svgEl.setAttribute('width', maxR * 2 + 4);
      svgEl.setAttribute('height', maxR * 2 + 4);
      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('class', 'ls-circle');
      circle.setAttribute('cx', maxR + 2);
      circle.setAttribute('cy', maxR * 2 + 2 - r);
      circle.setAttribute('r', r);
      svgEl.appendChild(circle);
      var lbl = document.createElement('span');
      lbl.textContent = val;
      box.appendChild(svgEl);
      box.appendChild(lbl);
      box.style.position = 'relative';
      legend.appendChild(box);
    });
  }

  // ---------- load ----------

  function loadFromAppData(){
    var policy = (App && App.data) ? App.data : {};
    allData = buildDomainData(policy);
    policyMeta = policy.meta || {};
    activeCategories = new Set(CATEGORY_ORDER);

    buildCategoryFilters();
    renderChart();
  }

  // ---------- wiring ----------

  function create(container){
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    containerEl = container;
    containerEl.classList.add('scatterplot-view');
    containerEl.innerHTML =
      '<div id="toolbar">' +
        '<div class="tb-group"><label for="x-select">X Axis</label><select id="x-select"></select></div>' +
        '<div class="tb-group"><label for="y-select">Y Axis</label><select id="y-select"></select></div>' +
        '<div class="tb-sep"></div>' +
        '<div id="category-filters"></div>' +
        '<div id="tb-stats"></div>' +
      '</div>' +
      '<div id="chart-container">' +
        '<svg id="scatter-svg"></svg>' +
        '<div id="legend-size"><div class="ls-title">RULE COUNT</div></div>' +
      '</div>';

    buildAxisSelects();
    loadFromAppData();

    resizeHandler = function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        if (allData.length) renderChart();
      }, 150);
    };
    window.addEventListener('resize', resizeHandler);
  }

  function destroy(){
    if (resizeHandler){
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    clearTimeout(resizeTimer);
    resizeTimer = null;

    App.tooltip.hide();

    if (containerEl){
      containerEl.classList.remove('scatterplot-view');
      containerEl.innerHTML = '';
      containerEl = null;
    }

    if (styleEl){
      styleEl.remove();
      styleEl = null;
    }

    allData = [];
    policyMeta = {};
    activeCategories = new Set(CATEGORY_ORDER);
  }

  App.registerView('scatterplot', { label: 'SCATTER', icon: '⊕', create: create, destroy: destroy });

})();
