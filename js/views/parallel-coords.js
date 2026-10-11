/* parallel-coords.js -- domain metric parallel-coordinates view,
   ported from sepolicy_viz/views/parallel-coords.html standalone
   ============================================================ */
(function() {
  "use strict";

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: parallel-coords.html lines 84-244 (app shell / chart /
     legend / stats / axis / brush / tooltip-content rules). The
     dropzone (lines 36-82) and #app/header/reload-btn shell rules
     (lines 85-176, 260-268) are dropped -- this module renders
     straight into the v2 view container and reuses the app-level
     loader/tab chrome. The bare #tooltip box rules (lines 218-232)
     are dropped too since the v2 shell already styles the shared
     #tooltip element (css/theme.css .tooltip) -- only the
     tooltip *content* classes (tt-name/tt-cat/table) are kept,
     scoped under the same global #tooltip id.
     ============================================================ */
  var CSS = ''
    + '.pc-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));overflow:hidden;}'
    + '.pc-toolbar{display:flex;align-items:center;gap:14px;padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface);flex-wrap:wrap;}'
    + '#pc-stats{font-size:12px;color:var(--cyan);background:rgba(0,255,242,0.08);border:1px solid rgba(0,255,242,0.3);border-radius:4px;padding:5px 10px;white-space:nowrap;}'
    + '#pc-stats.hidden{display:none;}'
    + '#pc-stats .clear-link{color:var(--text2);margin-left:10px;cursor:pointer;text-decoration:underline;}'
    + '#pc-stats .clear-link:hover{color:var(--cyan);}'
    + '#pc-legend{display:flex;gap:4px;flex-wrap:wrap;margin-left:auto;}'
    + '.legend-item{display:flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid var(--border);border-radius:4px;cursor:pointer;user-select:none;background:var(--surface2);transition:opacity 0.15s ease, border-color 0.15s ease;}'
    + '.legend-item:hover{border-color:var(--text2);}'
    + '.legend-item.inactive{opacity:0.35;}'
    + '.legend-item .swatch{width:10px;height:10px;border-radius:2px;flex:none;}'
    + '.legend-item .cat-name{color:var(--text);font-size:11.5px;}'
    + '.legend-item .cat-count{color:var(--text2);font-size:10.5px;}'
    + '#pc-chart-wrap{flex:1;position:relative;overflow:hidden;padding:10px 30px 24px 30px;}'
    + '#pc-chart{width:100%;height:100%;display:block;}'
    + '.axis-line{stroke:var(--border);stroke-width:1px;}'
    + '.pc-axis path.domain{stroke:var(--border);}'
    + '.pc-axis line{stroke:var(--border);}'
    + '.pc-axis text{fill:var(--text2);font-size:10px;font-family:inherit;}'
    + '.axis-label{fill:var(--text);font-size:11.5px;font-weight:600;text-anchor:middle;cursor:grab;letter-spacing:0.02em;}'
    + '.axis-label:active{cursor:grabbing;fill:var(--cyan);}'
    + '.axis-hint{fill:var(--text2);font-size:9px;text-anchor:middle;pointer-events:none;}'
    + '.line-hit{fill:none;stroke:transparent;stroke-width:10px;pointer-events:stroke;cursor:pointer;}'
    + '.line-visible{fill:none;stroke-width:1px;pointer-events:none;transition:stroke-width 0.1s ease;}'
    + '.pc-brush .selection{fill:var(--cyan);fill-opacity:0.12;stroke:var(--cyan);stroke-opacity:0.7;stroke-width:1px;}'
    + '.pc-brush .handle{fill:var(--cyan);fill-opacity:0.5;}'
    + '.pc-brush .overlay{cursor:crosshair;}'
    + '#tooltip .tt-name{color:var(--cyan);font-weight:600;font-size:12px;margin-bottom:4px;word-break:break-all;}'
    + '#tooltip .tt-cat{color:var(--text2);margin-bottom:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;}'
    + '#tooltip table{border-collapse:collapse;}'
    + '#tooltip td{padding:1px 6px 1px 0;font-size:10.5px;}'
    + '#tooltip td.tt-k{color:var(--text2);}'
    + '#tooltip td.tt-v{color:var(--text);text-align:right;font-weight:600;}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from monolith markup lines 259-272 --
     drops #dropzone, header/title-block/reload-btn; #stats and
     #legend keep their role but move into a plain toolbar row)
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="pc-toolbar">'
    +   '<div id="pc-stats" class="hidden"></div>'
    +   '<div id="pc-legend"></div>'
    + '</div>'
    + '<div id="pc-chart-wrap">'
    +   '<svg id="pc-chart"></svg>'
    + '</div>';

  /* ============================================================
     Constants -- kept as this file's own local palette/order
     (distinct from the app-wide App.CATS / App.CAT_COLORS in
     data.js) to preserve the standalone tool's exact appearance.
     source: parallel-coords.html lines 281-302
     ============================================================ */
  var CATEGORY_ORDER = ["hal","app","vendor","system","shell","core","other"];
  var CATEGORY_COLORS = {
    hal:"#00fff2",
    app:"#ff00ff",
    vendor:"#ffaa00",
    system:"#39ff88",
    shell:"#b967ff",
    core:"#ff3355",
    other:"#8888aa"
  };

  var DIMENSIONS = [
    {key:"ruleCount",        label:"Rule Count"},
    {key:"capCount",         label:"Capability Count"},
    {key:"targetBreadth",    label:"Target Type Breadth"},
    {key:"execTypeCount",    label:"Exec Type Count"},
    {key:"writeTargetCount", label:"Write Target Count"},
    {key:"dontauditCount",   label:"Dontaudit Count"},
    {key:"transitionFanout", label:"Transition Fan-out"}
  ];
  var DIM_BY_KEY = {};
  DIMENSIONS.forEach(function(d){ DIM_BY_KEY[d.key] = d; });

  /* ============================================================
     DOM element references (created in create(), null after
     destroy()) -- replaces the monolith's direct
     document.getElementById() globals
     ============================================================ */
  var els = {};

  /* ============================================================
     Chart / interaction state (replaces the monolith's loose
     top-level vars, source: parallel-coords.html lines 317-327)
     ============================================================ */
  var domainData       = [];   // [{name, category, metrics:{...}}]
  var currentOrder     = DIMENSIONS.map(function(d){ return d.key; });
  var brushExtents     = {};   // key -> [lo, hi] in data space
  var activeCategories = new Set(CATEGORY_ORDER);
  var dragging          = {};  // key -> temp pixel x during axis reorder drag
  var yScales           = {};
  var xScale            = null;
  var chartWidth = 0, chartHeight = 0;
  var margin = {top:56, right:44, bottom:18, left:44};
  var resizeTimer = null;
  var svg, linesLayer, axesLayer, brushGroups = {};

  /* ================= metrics ================= */
  /* source: parallel-coords.html lines 385-448 (computeMetrics).
     Reads directly from App.data (the parsed policy JSON, set by
     App.buildIndices) instead of a locally file-dropped `data`
     var; category lookup uses the already-built
     App.state.domainCategory instead of re-deriving it from
     data.categories -- both are otherwise identical to the
     original per-domain metric computation. */

  function computeMetrics(){
    var data = App.data;
    var rules       = data.rules || [];
    var dontaudit   = data.dontaudit_rules || [];
    var transitions = data.type_transitions || [];

    function groupBySource(list){
      var m = new Map();
      list.forEach(function(r){
        if(!m.has(r.s)) m.set(r.s, []);
        m.get(r.s).push(r);
      });
      return m;
    }
    var rulesBySrc = groupBySource(rules);
    var daBySrc    = groupBySource(dontaudit);
    var trBySrc    = groupBySource(transitions);

    var domains = data.domains || [];

    return domains.map(function(domain){
      var rs = rulesBySrc.get(domain) || [];
      var capSet    = new Set();
      var targetSet = new Set();
      var execSet   = new Set();
      var writeSet  = new Set();

      rs.forEach(function(r){
        targetSet.add(r.t);
        var perms = r.p || [];
        if(r.c === "capability"){
          perms.forEach(function(p){ capSet.add(p); });
        }
        if(perms.indexOf("execute_no_trans") !== -1){
          execSet.add(r.t);
        }
        if(r.c === "file" && (perms.indexOf("write") !== -1 || perms.indexOf("create") !== -1)){
          writeSet.add(r.t);
        }
      });

      var das = daBySrc.get(domain) || [];
      var trs = (trBySrc.get(domain) || []).filter(function(t){ return t.c === "process"; });

      return {
        name: domain,
        category: App.state.domainCategory[domain] || "other",
        metrics: {
          ruleCount:        rs.length,
          capCount:         capSet.size,
          targetBreadth:    targetSet.size,
          execTypeCount:    execSet.size,
          writeTargetCount: writeSet.size,
          dontauditCount:   das.length,
          transitionFanout: trs.length
        }
      };
    });
  }

  /* ================= legend ================= */
  /* source: parallel-coords.html lines 474-512 */

  function buildLegend(presentCats){
    els.legend.innerHTML = "";
    var counts = {};
    domainData.forEach(function(d){ counts[d.category] = (counts[d.category] || 0) + 1; });

    CATEGORY_ORDER.filter(function(c){ return presentCats.has(c); }).forEach(function(cat){
      var item = document.createElement("div");
      item.className = "legend-item";
      item.dataset.cat = cat;

      var swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = CATEGORY_COLORS[cat];
      item.appendChild(swatch);

      var name = document.createElement("span");
      name.className = "cat-name";
      name.textContent = cat;
      item.appendChild(name);

      var count = document.createElement("span");
      count.className = "cat-count";
      count.textContent = "(" + (counts[cat] || 0) + ")";
      item.appendChild(count);

      item.addEventListener("click", function(){
        if(activeCategories.has(cat)){
          activeCategories.delete(cat);
          item.classList.add("inactive");
        }else{
          activeCategories.add(cat);
          item.classList.remove("inactive");
        }
        render();
      });

      els.legend.appendChild(item);
    });
  }

  /* ================= chart build ================= */
  /* source: parallel-coords.html lines 516-637 */

  function dimPos(key){
    return dragging[key] != null ? dragging[key] : xScale(key);
  }

  function linePathFor(d){
    var pts = currentOrder.map(function(key){
      return [dimPos(key), yScales[key](d.metrics[key])];
    });
    return d3.line()(pts);
  }

  function buildChart(){
    var rect = els.chartWrap.getBoundingClientRect();
    chartWidth  = Math.max(200, rect.width  - margin.left - margin.right);
    chartHeight = Math.max(150, rect.height - margin.top  - margin.bottom);

    d3.select(els.svg).selectAll("*").remove();
    svg = d3.select(els.svg)
      .attr("width", rect.width)
      .attr("height", rect.height);

    var root = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    xScale = d3.scalePoint()
      .domain(currentOrder)
      .range([0, chartWidth])
      .padding(0.5);

    yScales = {};
    DIMENSIONS.forEach(function(dim){
      var maxVal = d3.max(domainData, function(d){ return d.metrics[dim.key]; }) || 1;
      yScales[dim.key] = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([chartHeight, 0]);
    });

    linesLayer = root.append("g").attr("class", "lines-layer");

    var lineGroups = linesLayer.selectAll("g.line-group")
      .data(domainData, function(d){ return d.name; })
      .enter()
      .append("g")
      .attr("class", "line-group");

    lineGroups.append("path")
      .attr("class", "line-visible")
      .attr("d", linePathFor)
      .style("stroke", function(d){ return CATEGORY_COLORS[d.category]; })
      .style("stroke-opacity", 0.3);

    lineGroups.append("path")
      .attr("class", "line-hit")
      .attr("d", linePathFor)
      .on("mousemove", onLineHover)
      .on("mouseover", onLineHover)
      .on("mouseout", onLineOut);

    axesLayer = root.append("g").attr("class", "axes-layer");

    var axisDrag = d3.drag()
      .on("start", function(event, key){
        dragging[key] = dimPos(key);
      })
      .on("drag", function(event, key){
        dragging[key] = Math.max(0, Math.min(chartWidth, event.x));
        currentOrder.sort(function(a, b){ return dimPos(a) - dimPos(b); });
        xScale.domain(currentOrder);
        axesLayer.selectAll("g.pc-dimension")
          .attr("transform", function(k){ return "translate(" + dimPos(k) + ",0)"; });
        lineGroups.select("path.line-visible").attr("d", linePathFor);
        lineGroups.select("path.line-hit").attr("d", linePathFor);
      })
      .on("end", function(event, key){
        delete dragging[key];
        axesLayer.selectAll("g.pc-dimension")
          .transition().duration(280)
          .attr("transform", function(k){ return "translate(" + xScale(k) + ",0)"; });
        lineGroups.select("path.line-visible").transition().duration(280).attr("d", linePathFor);
        lineGroups.select("path.line-hit").attr("d", linePathFor);
      });

    var dimGroups = axesLayer.selectAll("g.pc-dimension")
      .data(currentOrder, function(k){ return k; })
      .enter()
      .append("g")
      .attr("class", "pc-dimension")
      .attr("transform", function(k){ return "translate(" + xScale(k) + ",0)"; });

    dimGroups.append("g")
      .attr("class", "pc-axis")
      .each(function(key){
        d3.select(this).call(d3.axisLeft(yScales[key]).ticks(6));
      });

    dimGroups.append("text")
      .attr("class", "axis-label")
      .attr("y", -34)
      .text(function(key){ return DIM_BY_KEY[key].label; })
      .call(axisDrag);

    dimGroups.append("text")
      .attr("class", "axis-hint")
      .attr("y", -20)
      .text("drag to reorder");

    brushGroups = {};
    dimGroups.each(function(key){
      var g = d3.select(this).append("g")
        .attr("class", "pc-brush");
      var brush = d3.brushY()
        .extent([[-9, 0], [9, chartHeight]])
        .on("start brush end", function(event){ brushed(event, key); });
      g.call(brush);
      brushGroups[key] = {sel: g, brush: brush};
    });

    render();
  }

  /* ================= brushing ================= */
  /* source: parallel-coords.html lines 641-659 */

  function brushed(event, key){
    var sel = event.selection;
    if(sel == null){
      delete brushExtents[key];
    }else{
      var v0 = yScales[key].invert(sel[1]);
      var v1 = yScales[key].invert(sel[0]);
      brushExtents[key] = [v0, v1];
    }
    render();
  }

  function clearAllBrushes(){
    Object.keys(brushGroups).forEach(function(key){
      brushGroups[key].sel.call(brushGroups[key].brush.move, null);
    });
    brushExtents = {};
    render();
  }

  /* ================= render (filter + style) ================= */
  /* source: parallel-coords.html lines 663-706 */

  function passInfo(d){
    var catOk = activeCategories.has(d.category);
    var keys = Object.keys(brushExtents);
    var brushOk = keys.every(function(k){
      var ext = brushExtents[k];
      var v = d.metrics[k];
      return v >= ext[0] && v <= ext[1];
    });
    return {catOk: catOk, brushOk: brushOk, highlighted: catOk && brushOk};
  }

  function styleForLine(d, anyBrush){
    var info = passInfo(d);
    if(!info.catOk) return {display: "none", opacity: 0};
    if(!anyBrush) return {display: null, opacity: 0.3};
    return {display: null, opacity: info.highlighted ? 0.9 : 0.05};
  }

  function render(){
    if(!linesLayer) return;
    var keys = Object.keys(brushExtents);
    var anyBrush = keys.length > 0;

    linesLayer.selectAll("g.line-group").each(function(d){
      var s = styleForLine(d, anyBrush);
      var g = d3.select(this);
      g.style("display", s.display);
      g.select("path.line-visible")
        .style("stroke-opacity", s.opacity)
        .style("stroke-width", "1px");
    });

    if(anyBrush){
      var n = domainData.filter(function(d){ return passInfo(d).highlighted; }).length;
      els.stats.innerHTML = n + " of " + domainData.length + " domains selected" +
        "<span class=\"clear-link\" id=\"pc-clear-brushes\">clear</span>";
      els.stats.classList.remove("hidden");
      var clearLink = els.stats.querySelector("#pc-clear-brushes");
      if(clearLink){ clearLink.addEventListener("click", clearAllBrushes); }
    }else{
      els.stats.classList.add("hidden");
      els.stats.innerHTML = "";
    }
  }

  /* ================= hover ================= */
  /* source: parallel-coords.html lines 710-752. positionTooltip()
     is dropped -- App.tooltip.show() already clamps to the
     viewport; escapeHtml() is replaced by the shared
     App.escapeHTML(). */

  function onLineHover(event, d){
    var info = passInfo(d);
    if(!info.catOk) return;

    var g = d3.select(event.currentTarget.parentNode);
    g.raise();
    g.select("path.line-visible")
      .style("stroke-opacity", 0.95)
      .style("stroke-width", "2.5px");

    var html =
      "<div class=\"tt-name\">" + App.escapeHTML(d.name) + "</div>" +
      "<div class=\"tt-cat\">" + App.escapeHTML(d.category) + "</div>" +
      "<table>" + DIMENSIONS.map(function(dim){
        return "<tr><td class=\"tt-k\">" + dim.label + "</td><td class=\"tt-v\">" + d.metrics[dim.key] + "</td></tr>";
      }).join("") + "</table>";
    App.tooltip.show(event.clientX, event.clientY, html);
  }

  function onLineOut(event, d){
    var anyBrush = Object.keys(brushExtents).length > 0;
    var s = styleForLine(d, anyBrush);
    var g = d3.select(event.currentTarget.parentNode);
    g.select("path.line-visible")
      .style("stroke-opacity", s.opacity)
      .style("stroke-width", "1px");
    App.tooltip.hide();
  }

  /* ================= view lifecycle ================= */

  function createParallelCoords(container){
    /* 1. Inject CSS */
    styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (toolbar + chart svg) inside container */
    var root = App.el("div", "pc-root");
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root      = root;
    els.legend    = root.querySelector("#pc-legend");
    els.stats     = root.querySelector("#pc-stats");
    els.chartWrap = root.querySelector("#pc-chart-wrap");
    els.svg       = root.querySelector("#pc-chart");

    /* 3. Compute per-domain metrics (source: monolith bootstrap(),
       parallel-coords.html lines 452-470) */
    domainData   = computeMetrics();
    currentOrder = DIMENSIONS.map(function(d){ return d.key; });
    brushExtents = {};
    dragging     = {};

    var presentCats = new Set(domainData.map(function(d){ return d.category; }));
    activeCategories = new Set(CATEGORY_ORDER.filter(function(c){ return presentCats.has(c); }));

    /* 4. Draw */
    buildLegend(presentCats);
    buildChart();
  }

  function destroyParallelCoords(){
    clearTimeout(resizeTimer);
    resizeTimer = null;

    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Clear chart state */
    svg = null;
    linesLayer = null;
    axesLayer = null;
    brushGroups = {};
    domainData = [];
    currentOrder = DIMENSIONS.map(function(d){ return d.key; });
    brushExtents = {};
    activeCategories = new Set(CATEGORY_ORDER);
    dragging = {};
    yScales = {};
    xScale = null;

    App.tooltip.hide();
  }

  /* source: parallel-coords.html lines 763-772 (window resize
     listener + 200ms debounce). Ported to the registerView
     onResize hook, which core.js only invokes while this view is
     the active one -- replaces the monolith's own
     `appEl.classList.contains("active")` guard. */
  function onParallelCoordsResize(){
    if(!App.data || !els.chartWrap) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      /* brush pixel ranges do not survive a resize cleanly, so
         filters are cleared and the chart is rebuilt at the new
         dimensions. */
      brushExtents = {};
      buildChart();
    }, 200);
  }

  App.registerView('parallel-coords', {
    label: 'PARALLEL',
    icon: '≡',
    create: createParallelCoords,
    destroy: destroyParallelCoords,
    onResize: onParallelCoordsResize
  });
})();
