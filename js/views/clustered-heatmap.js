/* clustered-heatmap.js -- domain x target-type seriation matrix (canvas,
   greedy Jaccard clustering) view, ported from
   toolchain/sepolicy_viz/views/clustered-heatmap.html (standalone tool).
   That file has its own independent drop-zone/file-load UI and its own
   index-building code (buildCategoryOf/buildTypeDomainCounts/
   buildCellIndex/parseData) rather than sharing app.js's
   App.buildIndices()/App.state shape -- this port keeps that internal
   indexing logic byte-for-byte (S.categoryOf / S.cellIndex / S.usedTypes
   are this view's own thing, distinct from App.state.domainCategory /
   App.state.domainTypeMap / App.state.types used by the other views) and
   only swaps the data *source* from a dropped file to the already-loaded
   App.data, per the v2 view module pattern. */
(function() {
"use strict";

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: clustered-heatmap.html lines ~100-171 -- global reset,
     :root vars, #app-header, drop-zone and .tooltip *container* rules
     are dropped here because the v2 shell (theme.css) already provides
     equivalents (same --cyan/--magenta/--amber/--border/--text/--text2/
     --surface custom properties, a shared #tooltip element/.tooltip
     class). Tooltip *content* classes (.tt-domain/.tt-type/.tt-class/
     .tt-dot) are view-specific and are kept. .busy-overlay/.busy-box
     have no v2 shell equivalent and are kept in full, plus a scoped
     ".busy-overlay.hidden" rule since v2 has no generic ".hidden"
     utility class (only scoped combos like ".btn-ghost.hidden").
     ============================================================ */
  var CSS = ''
    + '.clustered-heatmap-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));padding:10px 14px 14px;gap:10px;}'
    + '.toolbar{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:0;background:var(--surface);border:1px solid var(--border);padding:8px 14px;}'
    + '.tb-group{display:flex;align-items:center;gap:8px;padding:2px 16px;border-right:1px solid var(--border);}'
    + '.tb-group:last-child{border-right:none;}'
    + '.tb-stats{color:var(--text2);font-size:11px;letter-spacing:.5px;margin-left:auto;border-right:none;text-align:right;}'
    + '.tb-stats .tb-sub{color:var(--amber);}'
    + '.btn{background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:11px;letter-spacing:.5px;padding:6px 12px;cursor:pointer;white-space:nowrap;transition:border-color .15s,color .15s,box-shadow .15s;}'
    + '.btn:hover{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 10px rgba(0,255,242,0.25);}'
    + '.btn.active{border-color:var(--magenta);color:var(--magenta);box-shadow:0 0 10px rgba(255,0,255,0.3);}'
    + '.btn-sq{width:30px;text-align:center;padding:6px 0;}'
    + '.chk{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);letter-spacing:.5px;cursor:pointer;user-select:none;}'
    + '.chk input{accent-color:var(--cyan);}'
    + '.tb-val{font-size:11px;color:var(--text2);min-width:34px;display:inline-block;text-align:center;}'
    + 'input[type=range]{accent-color:var(--cyan);width:110px;}'
    + 'input[type=range]:disabled{opacity:.35;}'
    + '.legend{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:26px;background:var(--surface);border:1px solid var(--border);padding:6px 14px;font-size:11px;color:var(--text2);}'
    + '.legend-block{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}'
    + '.legend-title{color:var(--text);letter-spacing:1px;font-weight:700;margin-right:4px;}'
    + '.legend-item{display:flex;align-items:center;gap:5px;white-space:nowrap;}'
    + '.legend-item i{width:9px;height:9px;display:inline-block;border-radius:2px;}'
    /* spacer and canvas share the same grid cell so the sticky canvas's
       static (pre-stick) position starts at (0,0) of the scrollable
       content for the ENTIRE scroll range, not just after a huge spacer
       box. The spacer's JS-assigned width/height drives the real
       scrollbars; the canvas is redrawn from scroll offsets on every
       scroll/resize/zoom. source: clustered-heatmap.html lines 148-154 */
    + '.hm-scroll-outer{position:relative;flex:1;min-height:0;overflow:auto;border:1px solid var(--border);background:var(--bg);display:grid;}'
    + '.hm-spacer{grid-column:1;grid-row:1;position:relative;}'
    + '.hm-canvas{grid-column:1;grid-row:1;position:sticky;top:0;left:0;justify-self:start;align-self:start;display:block;}'
    + '.tt-domain{color:var(--cyan);font-weight:700;letter-spacing:.5px;margin-bottom:2px;}'
    + '.tt-type{color:var(--text2);margin-bottom:6px;word-break:break-word;}'
    + '.tt-class{display:flex;align-items:baseline;gap:6px;color:var(--text);word-break:break-word;}'
    + '.tt-dot{width:7px;height:7px;border-radius:2px;display:inline-block;flex:0 0 auto;position:relative;top:-1px;}'
    + '.busy-overlay{position:fixed;inset:0;background:rgba(10,10,26,0.6);display:flex;align-items:center;justify-content:center;z-index:2000;}'
    + '.busy-overlay.hidden{display:none;}'
    + '.busy-box{background:var(--surface);border:1px solid var(--magenta);box-shadow:0 0 30px rgba(255,0,255,0.35);padding:22px 36px;font-size:13px;letter-spacing:2px;color:var(--magenta);}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from clustered-heatmap.html markup lines
     ~199-244 -- the #view-loader drop-zone section and #app-header are
     dropped; this view module only owns the toolbar/legend/canvas
     region formerly inside #view-viz)
     ============================================================ */
  var TEMPLATE = ''
    + '<div id="toolbar" class="toolbar">'
    +   '<div class="tb-group">'
    +     '<button id="btn-mode" class="btn btn-toggle" type="button" data-mode="category">MODE: CATEGORY</button>'
    +   '</div>'
    +   '<div class="tb-group">'
    +     '<label class="chk"><input type="checkbox" id="chk-noise" checked><span>NOISE FILTER</span></label>'
    +     '<input type="range" id="rng-noise" min="50" max="100" step="1" value="80">'
    +     '<span id="lbl-noise" class="tb-val">80%</span>'
    +   '</div>'
    +   '<div class="tb-group">'
    +     '<button id="btn-zoom-out" class="btn btn-sq" type="button" title="zoom out">&minus;</button>'
    +     '<span id="lbl-zoom" class="tb-val">12px</span>'
    +     '<button id="btn-zoom-in" class="btn btn-sq" type="button" title="zoom in">+</button>'
    +     '<button id="btn-zoom-reset" class="btn" type="button">RESET</button>'
    +   '</div>'
    +   '<div class="tb-group tb-stats" id="stats-line">0 domains &times; 0 types shown</div>'
    + '</div>'
    + '<div id="legend" class="legend">'
    +   '<div class="legend-block">'
    +     '<span class="legend-title">CELL CLASS</span>'
    +     '<span class="legend-item"><i style="background:#00fff2"></i>file</span>'
    +     '<span class="legend-item"><i style="background:#ff00ff"></i>process</span>'
    +     '<span class="legend-item"><i style="background:#ff3355"></i>capability</span>'
    +     '<span class="legend-item"><i style="background:#ffaa00"></i>binder</span>'
    +     '<span class="legend-item"><i style="background:#39ff88"></i>socket</span>'
    +     '<span class="legend-item"><i style="background:#8888aa"></i>other</span>'
    +   '</div>'
    +   '<div class="legend-block">'
    +     '<span class="legend-title">DOMAIN CAT</span>'
    +     '<span class="legend-item"><i style="background:#ff3355"></i>core</span>'
    +     '<span class="legend-item"><i style="background:#ff6622"></i>system</span>'
    +     '<span class="legend-item"><i style="background:#ffaa00"></i>vendor</span>'
    +     '<span class="legend-item"><i style="background:#ffdd44"></i>hal</span>'
    +     '<span class="legend-item"><i style="background:#b967ff"></i>shell</span>'
    +     '<span class="legend-item"><i style="background:#2288ff"></i>app</span>'
    +     '<span class="legend-item"><i style="background:#556688"></i>other</span>'
    +   '</div>'
    + '</div>'
    + '<div id="hm-scroll-outer" class="hm-scroll-outer">'
    +   '<div id="hm-spacer" class="hm-spacer"></div>'
    +   '<canvas id="hm-canvas" class="hm-canvas"></canvas>'
    + '</div>';

  /* ================= constants ================= */
  /* source: clustered-heatmap.html lines 253-267 */
  var ROW_LABEL_W = 190;
  var COL_HEADER_H = 110;
  var DOT_R = 4;
  var CAT_ORDER = ['hal','app','vendor','system','shell','core','other'];
  var DOMAIN_CAT_COLOR = {
    hal:'#ffdd44', app:'#2288ff', vendor:'#ffaa00', system:'#ff6622',
    shell:'#b967ff', core:'#ff3355', other:'#556688'
  };
  var CLASS_CAT_COLOR = {
    file:'#00fff2', process:'#ff00ff', capability:'#ff3355',
    binder:'#ffaa00', socket:'#39ff88', other:'#8888aa'
  };
  var CLASS_CAT_ORDER = ['file','process','capability','binder','socket','other'];
  var BG_COLOR = '#0a0a1a';
  var GRID_LINE = '#1a1a3a';

  /* ================= state ================= */
  /* source: clustered-heatmap.html lines 271-289. canvasInited is
     dropped -- the standalone file used it to guard re-entry into
     initCanvas() across its loader<->viz two-phase flow; the view
     module lifecycle (create() always gets a fresh DOM subtree,
     destroy() always tears listeners down) replaces that need. */
  var S = {
    data:null,
    domains:[],
    rules:[],
    categoryOf:new Map(),
    usedTypes:[],
    typeDomainCount:new Map(),
    cellIndex:new Map(),
    mode:'category',
    noiseOn:true,
    noiseThreshold:0.8,
    cellSize:12,
    minCell:3,
    maxCell:40,
    rowOrder:[],
    colOrder:[],
    hoverCell:null
  };

  /* ================= classification ================= */
  /* source: clustered-heatmap.html line 292 */
  function classCategory(c){
    if(/binder/i.test(c)) return 'binder';
    if(c==='process' || c==='process2') return 'process';
    if(c==='capability' || c==='capability2') return 'capability';
    if(/socket/i.test(c)) return 'socket';
    if(/(^|_)file$/.test(c) || c==='dir' || c==='lnk_file' || c==='filesystem') return 'file';
    return 'other';
  }

  /* ================= data indexing ================= */
  /* source: clustered-heatmap.html line 302 */
  function buildCategoryOf(raw){
    var of = new Map();
    var cats = raw.categories || {};
    CAT_ORDER.forEach(function(cat){
      var list = cats[cat] || [];
      list.forEach(function(d){ if(!of.has(d)) of.set(d, cat); });
    });
    (raw.domains||[]).forEach(function(d){ if(!of.has(d)) of.set(d, 'other'); });
    return of;
  }

  function buildTypeDomainCounts(rules){
    var perType = new Map();
    for(var i=0;i<rules.length;i++){
      var r = rules[i];
      var set = perType.get(r.t);
      if(!set){ set = new Set(); perType.set(r.t, set); }
      set.add(r.s);
    }
    var counts = new Map();
    perType.forEach(function(set, t){ counts.set(t, set.size); });
    return counts;
  }

  /* cellIndex is a nested Map: domain -> (type -> cell). A real nested
     map (instead of a "domain+sep+type" string key) sidesteps any
     ambiguity/collision from delimiter choice entirely. */
  function buildCellIndex(rules){
    var outer = new Map();
    for(var i=0;i<rules.length;i++){
      var r = rules[i];
      var inner = outer.get(r.s);
      if(!inner){ inner = new Map(); outer.set(r.s, inner); }
      var cell = inner.get(r.t);
      if(!cell){
        cell = { classes:{}, catWeight:{file:0,process:0,capability:0,binder:0,socket:0,other:0}, dominant:'other' };
        inner.set(r.t, cell);
      }
      var cat = classCategory(r.c);
      if(!cell.classes[r.c]) cell.classes[r.c] = new Set();
      var perms = r.p || [];
      for(var j=0;j<perms.length;j++) cell.classes[r.c].add(perms[j]);
      cell.catWeight[cat] += (perms.length ? perms.length : 1);
    }
    outer.forEach(function(inner){
      inner.forEach(function(cell){
        var domCat='other', domW=-1;
        for(var k=0;k<CLASS_CAT_ORDER.length;k++){
          var cat = CLASS_CAT_ORDER[k];
          if(cell.catWeight[cat] > domW){ domW = cell.catWeight[cat]; domCat = cat; }
        }
        cell.dominant = domCat;
      });
    });
    return outer;
  }
  function lookupCell(domain, type){
    var inner = S.cellIndex.get(domain);
    return inner ? inner.get(type) : undefined;
  }

  /* source: clustered-heatmap.html line 363. raw is App.data instead of
     a dropped-file JSON parse -- see file header comment. validateSchema
     (monolith line 382) is dropped along with the file-drop error-hint
     UI it fed; App.data is already validated by the point any view is
     created. */
  function parseData(raw){
    S.data = raw;
    S.domains = Array.isArray(raw.domains) ? raw.domains.slice() : [];
    S.rules = Array.isArray(raw.rules) ? raw.rules : [];
    S.categoryOf = buildCategoryOf(raw);
    S.typeDomainCount = buildTypeDomainCounts(S.rules);
    var allTypes = Array.isArray(raw.types) ? raw.types : [];
    var usedSet = new Set();
    var used = [];
    allTypes.forEach(function(t){
      if((S.typeDomainCount.get(t)||0) > 0 && !usedSet.has(t)){ usedSet.add(t); used.push(t); }
    });
    S.typeDomainCount.forEach(function(cnt, t){
      if(cnt > 0 && !usedSet.has(t)){ usedSet.add(t); used.push(t); }
    });
    S.usedTypes = used;
    S.cellIndex = buildCellIndex(S.rules);
  }

  /* ================= noise filter ================= */
  /* source: clustered-heatmap.html line 390 */
  function computeVisibleTypes(){
    if(!S.noiseOn) return S.usedTypes.slice();
    var total = S.domains.length || 1;
    var thr = S.noiseThreshold;
    return S.usedTypes.filter(function(t){
      var cnt = S.typeDomainCount.get(t) || 0;
      return (cnt/total) <= thr;
    });
  }

  /* ================= seriation ================= */
  /* source: clustered-heatmap.html line 401 */
  function popcount(x){
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    x = (x + (x >>> 4)) & 0x0f0f0f0f;
    return (x * 0x01010101) >>> 24;
  }
  function jaccardSim(a, b, words){
    var inter=0, uni=0;
    for(var i=0;i<words;i++){
      var x=a[i], y=b[i];
      inter += popcount(x & y);
      uni += popcount(x | y);
    }
    return uni===0 ? 0 : inter/uni;
  }
  function greedySeriate(items, bitsets, words, weightFn){
    if(items.length === 0) return [];
    if(items.length === 1) return items.slice();
    var remaining = new Set(items);
    var start = items[0], bestW = -Infinity;
    for(var i=0;i<items.length;i++){
      var w = weightFn(items[i]);
      if(w > bestW){ bestW = w; start = items[i]; }
    }
    var order = [start];
    remaining.delete(start);
    var current = start;
    while(remaining.size > 0){
      var best=null, bestSim=-1;
      remaining.forEach(function(cand){
        var sim = jaccardSim(bitsets.get(current), bitsets.get(cand), words);
        if(sim > bestSim){ bestSim = sim; best = cand; }
      });
      if(bestSim <= 0){
        var w2=-Infinity, nxt=null;
        remaining.forEach(function(cand){
          var w3 = weightFn(cand);
          if(w3 > w2){ w2 = w3; nxt = cand; }
        });
        best = nxt;
      }
      order.push(best);
      remaining.delete(best);
      current = best;
    }
    return order;
  }
  function seriateRows(domains, visTypes, rules){
    var typeIdx = new Map();
    visTypes.forEach(function(t,i){ typeIdx.set(t,i); });
    var words = Math.max(1, Math.ceil(visTypes.length/32));
    var bitsets = new Map();
    var ruleCount = new Map();
    domains.forEach(function(d){ bitsets.set(d, new Uint32Array(words)); ruleCount.set(d, 0); });
    for(var i=0;i<rules.length;i++){
      var r = rules[i];
      if(!bitsets.has(r.s)) continue;
      ruleCount.set(r.s, ruleCount.get(r.s)+1);
      var idx = typeIdx.get(r.t);
      if(idx===undefined) continue;
      bitsets.get(r.s)[idx>>>5] |= (1 << (idx & 31));
    }
    return greedySeriate(domains, bitsets, words, function(d){ return ruleCount.get(d); });
  }
  function seriateCols(types, domains, rules){
    var domIdx = new Map();
    domains.forEach(function(d,i){ domIdx.set(d,i); });
    var words = Math.max(1, Math.ceil(domains.length/32));
    var bitsets = new Map();
    var typeSet = new Set(types);
    types.forEach(function(t){ bitsets.set(t, new Uint32Array(words)); });
    for(var i=0;i<rules.length;i++){
      var r = rules[i];
      if(!typeSet.has(r.t)) continue;
      var idx = domIdx.get(r.s);
      if(idx===undefined) continue;
      bitsets.get(r.t)[idx>>>5] |= (1 << (idx & 31));
    }
    var degree = new Map();
    bitsets.forEach(function(arr, t){
      var c=0; for(var i=0;i<words;i++) c += popcount(arr[i]);
      degree.set(t, c);
    });
    return greedySeriate(types, bitsets, words, function(t){ return degree.get(t); });
  }

  /* ================= ordering ================= */
  /* source: clustered-heatmap.html line 488 */
  function recomputeOrder(cb){
    var visTypes = computeVisibleTypes();
    if(S.mode === 'category'){
      S.rowOrder = S.domains.slice().sort(function(a,b){
        var ra = CAT_ORDER.indexOf(S.categoryOf.get(a) || 'other');
        var rb = CAT_ORDER.indexOf(S.categoryOf.get(b) || 'other');
        if(ra !== rb) return ra - rb;
        return a.localeCompare(b);
      });
      S.colOrder = visTypes.slice().sort(function(a,b){ return a.localeCompare(b); });
      finishRecompute(cb);
    } else {
      showBusy(true);
      setTimeout(function(){
        S.rowOrder = seriateRows(S.domains, visTypes, S.rules);
        S.colOrder = seriateCols(visTypes, S.domains, S.rules);
        showBusy(false);
        finishRecompute(cb);
      }, 20);
    }
  }
  function finishRecompute(cb){
    layoutSpacer();
    updateStats();
    scheduleDraw();
    if(cb) cb();
  }
  function showBusy(v){
    document.getElementById('busy-overlay').classList.toggle('hidden', !v);
  }
  function updateStats(){
    var el = document.getElementById('stats-line');
    var hidden = S.usedTypes.length - S.colOrder.length;
    var txt = S.rowOrder.length + ' domains × ' + S.colOrder.length + ' types shown';
    el.textContent = txt;
    if(S.noiseOn && hidden > 0){
      var sub = document.createElement('span');
      sub.className = 'tb-sub';
      sub.textContent = '  (' + hidden + ' hidden by noise filter)';
      el.appendChild(sub);
    }
  }

  /* ================= canvas / layout ================= */
  /* source: clustered-heatmap.html line 532. scrollOuter/spacer/canvas/
     ctx/dpr are (re)populated by initCanvas(), called from create(),
     and cleared in destroy() so a later create() re-queries fresh DOM. */
  var scrollOuter, spacer, canvas, ctx, dpr;
  var drawScheduled = false;
  var scrollScheduled = false;

  function initCanvas(){
    scrollOuter = document.getElementById('hm-scroll-outer');
    spacer = document.getElementById('hm-spacer');
    canvas = document.getElementById('hm-canvas');
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
    scrollOuter.addEventListener('scroll', onScroll, {passive:true});
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    scrollOuter.addEventListener('wheel', onWheel, {passive:false});
  }
  function resizeCanvasToViewport(){
    var w = scrollOuter.clientWidth || 1;
    var h = scrollOuter.clientHeight || 1;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.max(1, Math.round(w*dpr));
    canvas.height = Math.max(1, Math.round(h*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function layoutSpacer(){
    var gridW = S.colOrder.length * S.cellSize;
    var gridH = S.rowOrder.length * S.cellSize;
    spacer.style.width = (ROW_LABEL_W + gridW) + 'px';
    spacer.style.height = (COL_HEADER_H + gridH) + 'px';
    resizeCanvasToViewport();
  }
  function onScroll(){
    if(scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(function(){ scrollScheduled=false; scheduleDraw(); });
  }
  /* window resize is dispatched via the onResize hook passed to
     App.registerView() below (core.js calls it for the active view on
     window 'resize') instead of this module adding its own raw
     window.addEventListener('resize', ...), matching the heatmap.js /
     treemap.js view module pattern. */
  function onWheel(e){
    if(e.ctrlKey){
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    }
  }
  function scheduleDraw(){
    if(drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(function(){ drawScheduled=false; drawAll(); });
  }
  function zoomBy(dir){
    var factor = dir > 0 ? 1.25 : 0.8;
    var next = Math.round(S.cellSize * factor);
    if(next === S.cellSize) next = S.cellSize + dir;
    S.cellSize = Math.max(S.minCell, Math.min(S.maxCell, next));
    document.getElementById('lbl-zoom').textContent = S.cellSize + 'px';
    layoutSpacer();
    scheduleDraw();
  }

  /* ================= drawing ================= */
  /* source: clustered-heatmap.html line 594 */
  function truncateText(c, text, maxWidth){
    if(maxWidth <= 0) return '';
    if(c.measureText(text).width <= maxWidth) return text;
    var lo=0, hi=text.length;
    while(lo < hi){
      var mid = (lo+hi+1) >> 1;
      var t = text.slice(0,mid) + '…';
      if(c.measureText(t).width <= maxWidth) lo = mid; else hi = mid-1;
    }
    return lo>0 ? text.slice(0,lo) + '…' : '';
  }

  function drawAll(){
    if(!ctx || !S.data) return;
    var w = scrollOuter.clientWidth, h = scrollOuter.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0,0,w,h);

    var scrollLeft = scrollOuter.scrollLeft, scrollTop = scrollOuter.scrollTop;
    var cs = S.cellSize;
    var nRows = S.rowOrder.length, nCols = S.colOrder.length;
    if(nRows===0 || nCols===0){
      ctx.fillStyle = '#8888aa';
      ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText('No rows/columns to display for the current filter.', 16, 24);
      return;
    }

    var firstCol = Math.max(0, Math.floor(scrollLeft/cs) - 1);
    var lastCol = Math.min(nCols-1, Math.ceil((scrollLeft + (w-ROW_LABEL_W))/cs) + 1);
    var firstRow = Math.max(0, Math.floor(scrollTop/cs) - 1);
    var lastRow = Math.min(nRows-1, Math.ceil((scrollTop + (h-COL_HEADER_H))/cs) + 1);

    var gap = cs > 4 ? 1 : 0;

    /* cells */
    ctx.save();
    ctx.beginPath();
    ctx.rect(ROW_LABEL_W, COL_HEADER_H, Math.max(0,w-ROW_LABEL_W), Math.max(0,h-COL_HEADER_H));
    ctx.clip();
    for(var r=firstRow; r<=lastRow; r++){
      var domain = S.rowOrder[r];
      var sy = COL_HEADER_H + (r*cs - scrollTop);
      for(var c=firstCol; c<=lastCol; c++){
        var type = S.colOrder[c];
        var cell = lookupCell(domain, type);
        if(!cell) continue;
        var sx = ROW_LABEL_W + (c*cs - scrollLeft);
        ctx.fillStyle = CLASS_CAT_COLOR[cell.dominant] || CLASS_CAT_COLOR.other;
        ctx.fillRect(sx, sy, cs-gap, cs-gap);
      }
    }
    if(S.hoverCell && S.hoverCell.r>=firstRow && S.hoverCell.r<=lastRow && S.hoverCell.c>=firstCol && S.hoverCell.c<=lastCol){
      var hx = ROW_LABEL_W + (S.hoverCell.c*cs - scrollLeft);
      var hy = COL_HEADER_H + (S.hoverCell.r*cs - scrollTop);
      ctx.strokeStyle = '#00fff2';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx+1, hy+1, cs-2, cs-2);
    }
    ctx.restore();

    /* column header */
    ctx.fillStyle = '#141428';
    ctx.fillRect(ROW_LABEL_W, 0, Math.max(0,w-ROW_LABEL_W), COL_HEADER_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ROW_LABEL_W, 0, Math.max(0,w-ROW_LABEL_W), COL_HEADER_H);
    ctx.clip();
    var labelStep = 1;
    if(cs < 9 && cs > 0) labelStep = Math.max(1, Math.ceil(9/cs));
    if(cs >= 5){
      ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = '#8888aa';
      ctx.textBaseline = 'middle';
      for(var c2=firstCol; c2<=lastCol; c2++){
        if(((c2-firstCol) % labelStep) !== 0) continue;
        var cx = ROW_LABEL_W + (c2*cs - scrollLeft) + cs/2;
        var isHoverCol = S.hoverCell && S.hoverCell.c === c2;
        ctx.save();
        ctx.translate(cx, COL_HEADER_H - 6);
        ctx.rotate(-Math.PI/3);
        ctx.fillStyle = isHoverCol ? '#00fff2' : '#8888aa';
        var t2 = truncateText(ctx, S.colOrder[c2], COL_HEADER_H - 14);
        ctx.fillText(t2, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    /* row labels */
    ctx.fillStyle = '#141428';
    ctx.fillRect(0, COL_HEADER_H, ROW_LABEL_W, Math.max(0,h-COL_HEADER_H));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, COL_HEADER_H, ROW_LABEL_W, Math.max(0,h-COL_HEADER_H));
    ctx.clip();
    ctx.textBaseline = 'middle';
    var dotR = Math.max(1.5, Math.min(DOT_R, cs*0.35));
    for(var r2=firstRow; r2<=lastRow; r2++){
      var d2 = S.rowOrder[r2];
      var sy2 = COL_HEADER_H + (r2*cs - scrollTop) + cs/2;
      var isHoverRow = S.hoverCell && S.hoverCell.r === r2;
      ctx.fillStyle = DOMAIN_CAT_COLOR[S.categoryOf.get(d2) || 'other'];
      ctx.beginPath();
      ctx.arc(12, sy2, dotR, 0, Math.PI*2);
      ctx.fill();
      if(cs >= 7){
        ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = isHoverRow ? '#00fff2' : '#e0e0ff';
        var maxW = ROW_LABEL_W - (12 + dotR*2 + 8) - 6;
        var t3 = truncateText(ctx, d2, maxW);
        ctx.fillText(t3, 12 + dotR*2 + 4, sy2);
      }
    }
    ctx.restore();

    /* corner */
    ctx.fillStyle = '#141428';
    ctx.fillRect(0,0,ROW_LABEL_W,COL_HEADER_H);
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5,0.5,ROW_LABEL_W-1,COL_HEADER_H-1);
    ctx.strokeRect(ROW_LABEL_W+0.5, 0.5, Math.max(0,w-ROW_LABEL_W-1), Math.max(0,h-1));
  }

  /* ================= hover / tooltip ================= */
  /* source: clustered-heatmap.html line 721 */
  function onCanvasMouseMove(e){
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    if(x < ROW_LABEL_W || y < COL_HEADER_H){
      if(S.hoverCell){ S.hoverCell=null; scheduleDraw(); }
      hideTooltip();
      return;
    }
    var scrollLeft = scrollOuter.scrollLeft, scrollTop = scrollOuter.scrollTop;
    var cs = S.cellSize;
    var c = Math.floor((x - ROW_LABEL_W + scrollLeft)/cs);
    var r = Math.floor((y - COL_HEADER_H + scrollTop)/cs);
    if(r<0 || r>=S.rowOrder.length || c<0 || c>=S.colOrder.length){
      if(S.hoverCell){ S.hoverCell=null; scheduleDraw(); }
      hideTooltip();
      return;
    }
    if(!S.hoverCell || S.hoverCell.r!==r || S.hoverCell.c!==c){
      S.hoverCell = {r:r, c:c};
      scheduleDraw();
    }
    var domain = S.rowOrder[r], type = S.colOrder[c];
    var cell = lookupCell(domain, type);
    if(!cell){ hideTooltip(); return; }
    showTooltip(e.clientX, e.clientY, domain, type, cell);
  }
  function onCanvasMouseLeave(){
    if(S.hoverCell){ S.hoverCell=null; scheduleDraw(); }
    hideTooltip();
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  /* showTooltip/hideTooltip route through the shared App.tooltip
     helper (ui.js) instead of touching a local #tooltip div directly --
     same v2 view port pattern used by heatmap.js/treemap.js. The
     tooltip HTML content-building logic (tt-domain/tt-type/tt-class/
     tt-dot) is unchanged; positionTooltip (monolith line 771) is
     dropped since App.tooltip.show() does its own positioning. */
  function showTooltip(clientX, clientY, domain, type, cell){
    var lines = [];
    lines.push('<div class="tt-domain">' + escapeHtml(domain) + '</div>');
    lines.push('<div class="tt-type">&rarr; ' + escapeHtml(type) + '</div>');
    var classNames = Object.keys(cell.classes).sort();
    classNames.forEach(function(cn){
      var perms = Array.from(cell.classes[cn]).sort().join(', ');
      var cat = classCategory(cn);
      lines.push('<div class="tt-class"><span class="tt-dot" style="background:' + CLASS_CAT_COLOR[cat] + '"></span><b>' + escapeHtml(cn) + '</b>: ' + escapeHtml(perms) + '</div>');
    });
    App.tooltip.show(clientX, clientY, lines.join(''));
  }
  function hideTooltip(){ App.tooltip.hide(); }

  /* ================= wiring ================= */
  /* source: clustered-heatmap.html line 867. wireDropZone (monolith
     line 840) is dropped along with the drop-zone markup; the
     "LOAD NEW FILE" button belongs to the v2 shell chrome, not this
     view, so that one listener line is dropped too. */
  function wireToolbar(){
    document.getElementById('btn-mode').addEventListener('click', function(){
      S.mode = (S.mode==='category') ? 'clustered' : 'category';
      var btn = document.getElementById('btn-mode');
      btn.textContent = 'MODE: ' + (S.mode==='category' ? 'CATEGORY' : 'CLUSTERED');
      btn.classList.toggle('active', S.mode==='clustered');
      recomputeOrder();
    });
    document.getElementById('chk-noise').addEventListener('change', function(e){
      S.noiseOn = e.target.checked;
      document.getElementById('rng-noise').disabled = !S.noiseOn;
      recomputeOrder();
    });
    document.getElementById('rng-noise').addEventListener('input', function(e){
      document.getElementById('lbl-noise').textContent = e.target.value + '%';
    });
    document.getElementById('rng-noise').addEventListener('change', function(e){
      S.noiseThreshold = parseInt(e.target.value,10)/100;
      recomputeOrder();
    });
    document.getElementById('btn-zoom-in').addEventListener('click', function(){ zoomBy(1); });
    document.getElementById('btn-zoom-out').addEventListener('click', function(){ zoomBy(-1); });
    document.getElementById('btn-zoom-reset').addEventListener('click', function(){
      S.cellSize = 12;
      document.getElementById('lbl-zoom').textContent = '12px';
      layoutSpacer();
      scheduleDraw();
    });
  }

  /* ============================================================
     View lifecycle -- replaces onDataReady (monolith line 801, ran
     once per dropped file) + the one-time wireToolbar()/wireDropZone()
     calls at the bottom of the monolith's IIFE (monolith line 898).
     ============================================================ */
  var rootEl = null;
  var busyOverlayEl = null;

  function createClusteredHeatmap(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (toolbar, legend, scroll/canvas grid) inside container */
    rootEl = App.el('div','clustered-heatmap-root');
    rootEl.innerHTML = TEMPLATE;
    container.appendChild(rootEl);

    /* busy-overlay is a floating, fixed-position element -- lives at
       body level, same as heatmap.js's cell-popup */
    busyOverlayEl = App.el('div','busy-overlay hidden','<div class="busy-box">CLUSTERING&hellip;</div>');
    busyOverlayEl.id = 'busy-overlay';
    document.body.appendChild(busyOverlayEl);

    /* 3. Wire event listeners on the created elements */
    initCanvas();
    wireToolbar();

    /* 4. Load data (App.data instead of a dropped file) + reset view
       state to the same defaults onDataReady used to set */
    parseData(App.data);

    S.mode = 'category';
    var modeBtn = document.getElementById('btn-mode');
    modeBtn.textContent = 'MODE: CATEGORY';
    modeBtn.classList.remove('active');

    S.noiseOn = true;
    document.getElementById('chk-noise').checked = true;
    S.noiseThreshold = 0.8;
    document.getElementById('rng-noise').value = 80;
    document.getElementById('rng-noise').disabled = false;
    document.getElementById('lbl-noise').textContent = '80%';

    S.cellSize = 12;
    document.getElementById('lbl-zoom').textContent = '12px';
    S.hoverCell = null;

    /* 5. Compute order + draw */
    recomputeOrder(function(){
      scrollOuter.scrollLeft = 0;
      scrollOuter.scrollTop = 0;
    });
  }

  function destroyClusteredHeatmap(){
    /* Remove event listeners */
    if(scrollOuter){
      scrollOuter.removeEventListener('scroll', onScroll);
      scrollOuter.removeEventListener('wheel', onWheel);
    }
    if(canvas){
      canvas.removeEventListener('mousemove', onCanvasMouseMove);
      canvas.removeEventListener('mouseleave', onCanvasMouseLeave);
    }
    App.tooltip.hide();

    if(busyOverlayEl && busyOverlayEl.parentNode) busyOverlayEl.parentNode.removeChild(busyOverlayEl);
    busyOverlayEl = null;
    if(rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    rootEl = null;

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM/canvas refs */
    scrollOuter = null; spacer = null; canvas = null; ctx = null;
    drawScheduled = false; scrollScheduled = false;

    /* Clear local state */
    S.data = null;
    S.domains = []; S.rules = [];
    S.categoryOf = new Map();
    S.usedTypes = []; S.typeDomainCount = new Map(); S.cellIndex = new Map();
    S.rowOrder = []; S.colOrder = [];
    S.hoverCell = null;
  }

  App.registerView('clustered-heatmap', {
    label: 'CLUSTERED',
    icon: '▚',
    create: createClusteredHeatmap,
    destroy: destroyClusteredHeatmap,
    onResize: function(){ if(ctx){ resizeCanvasToViewport(); scheduleDraw(); } }
  });
})();
