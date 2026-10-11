/* marginal-heatmap.js -- domain x target-type heatmap with marginal
   distribution bars (top: type reach, left: domain rule count) and
   custom canvas pan/zoom, ported from
   sepolicy_viz/views/marginal-heatmap.html standalone (842 lines) */
(function() {

  /* ============================================================
     Constants
     source: monolith lines 260-271
     ============================================================ */
  var BASE_CELL_W = 8, BASE_CELL_H = 14;
  var MIN_ZOOM = 0.35, MAX_ZOOM = 6;

  var CLASS_HEX = {
    file:'#00fff2', process:'#ff00ff', capability:'#ff3355',
    binder:'#ffaa00', socket:'#39ff88', chrblk:'#b967ff', other:'#8888aa'
  };
  var CAT_HEX = {
    hal:'#00fff2', app:'#ff00ff', vendor:'#ffaa00', system:'#39ff88',
    shell:'#b967ff', core:'#ff3355', other:'#8888aa'
  };
  var CATEGORY_ORDER = ['core','system','vendor','hal','shell','app','other'];

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: monolith lines 8-182 -- dropzone/.dz-* rules dropped
     (file-drop removed, shell owns loading), html/body resets dropped
     (owned by shared theme.css), #tooltip box styling dropped (owned
     by shared .tooltip class in theme.css, App.tooltip is reused) --
     the :root color values here were identical to shared theme.css
     vars so this view references var(--bg)/var(--surface)/etc directly
     instead of redeclaring them
     ============================================================ */
  var CSS = ''
    + '.mh-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));width:100%;color:var(--text);}'
    + '#mh-controls{flex:0 0 auto;display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:var(--surface);border-bottom:1px solid var(--border);padding:8px 14px;font-size:11px;color:var(--text2);}'
    + '#mh-controls .mh-title{color:var(--cyan);font-size:12px;letter-spacing:1.5px;font-weight:bold;text-shadow:0 0 10px rgba(0,255,242,0.5);margin-right:4px;}'
    + '.mh-ctl-group{display:flex;align-items:center;gap:6px;}'
    + '.mh-ctl-group input[type="checkbox"]{accent-color:var(--cyan);}'
    + '.mh-ctl-group input[type="range"]{accent-color:var(--cyan);width:110px;}'
    + '.mh-btn{background:var(--bg);color:var(--text);border:1px solid var(--border);padding:4px 10px;font-family:inherit;font-size:11px;cursor:pointer;border-radius:3px;transition:border-color .12s ease,color .12s ease;}'
    + '.mh-btn:hover{border-color:var(--cyan);color:var(--cyan);}'
    + '.mh-legend{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto;}'
    + '.mh-legend-group{display:flex;align-items:center;gap:6px;}'
    + '.mh-legend-label{color:var(--text2);text-transform:uppercase;font-size:9px;letter-spacing:1px;margin-right:2px;}'
    + '.mh-swatch{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text2);}'
    + '.mh-sw-box{width:9px;height:9px;border-radius:2px;display:inline-block;}'
    + '.mh-hint{color:#555577;font-size:10px;margin-left:6px;}'
    + '#mh-zoom-readout{color:var(--cyan);min-width:38px;display:inline-block;text-align:right;}'
    + '#mh-grid{flex:1 1 auto;display:grid;grid-template-columns:90px 170px 1fr;grid-template-rows:80px 1fr;grid-template-areas:"corner corner top" "left label main";min-height:0;min-width:0;position:relative;}'
    + '#mh-corner{grid-area:corner;background:var(--surface);border-right:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#555577;font-size:9px;letter-spacing:1px;line-height:1.6;}'
    + '#mh-top-wrap{grid-area:top;overflow:hidden;position:relative;background:var(--surface);border-bottom:1px solid var(--border);}'
    + '#mh-left-wrap{grid-area:left;overflow:hidden;position:relative;background:var(--surface);border-right:1px solid var(--border);}'
    + '#mh-label-wrap{grid-area:label;overflow:hidden;position:relative;background:var(--surface);border-right:1px solid var(--border);}'
    + '#mh-main-wrap{grid-area:main;overflow:hidden;position:relative;background:#08081a;cursor:grab;user-select:none;}'
    + '#mh-main-wrap.mh-panning{cursor:grabbing;}'
    + '#mh-grid canvas{display:block;}'
    + '#tooltip .tt-row{margin-bottom:2px;}'
    + '#tooltip .tt-k{color:var(--text2);text-transform:uppercase;font-size:9px;letter-spacing:1px;margin-right:6px;}'
    + '#tooltip .tt-domain{color:var(--cyan);}'
    + '#tooltip .tt-type{color:#ffaa00;}'
    + '#tooltip .tt-perms{margin-top:6px;padding-top:6px;border-top:1px solid var(--border);color:var(--text);word-break:break-all;}'
    + '#mh-stats-bar{flex:0 0 auto;background:var(--surface);border-top:1px solid var(--border);padding:6px 14px;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;align-items:center;}'
    + '#mh-stats-bar .mh-stat-cyan{color:var(--cyan);}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from monolith lines 199-251 -- dropzone
     and "load new file" removed, shared shell owns file loading
     and reload; ids prefixed mh- to avoid collisions with other
     views' DOM)
     ============================================================ */
  var TEMPLATE = ''
    + '<div id="mh-controls">'
    +   '<span class="mh-title">MARGINAL HEATMAP</span>'
    +   '<div class="mh-ctl-group">'
    +     '<input type="checkbox" id="mh-noise-checkbox">'
    +     '<label for="mh-noise-checkbox">noise filter</label>'
    +     '<input type="range" id="mh-noise-slider" min="0" max="100" value="50" disabled>'
    +     '<span id="mh-noise-value">50%</span>'
    +   '</div>'
    +   '<button class="mh-btn" id="mh-reset-btn">reset view</button>'
    +   '<span>zoom <span id="mh-zoom-readout">100%</span></span>'
    +   '<span class="mh-hint">wheel = zoom &middot; drag = pan &middot; click label/bar = highlight row</span>'
    +   '<div class="mh-legend">'
    +     '<div class="mh-legend-group">'
    +       '<span class="mh-legend-label">domain cat</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#00fff2"></span>hal</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#ff00ff"></span>app</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#ffaa00"></span>vendor</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#39ff88"></span>system</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#b967ff"></span>shell</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#ff3355"></span>core</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#8888aa"></span>other</span>'
    +     '</div>'
    +     '<div class="mh-legend-group">'
    +       '<span class="mh-legend-label">cell class</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#00fff2"></span>file</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#ff00ff"></span>process</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#ff3355"></span>capability</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#ffaa00"></span>binder</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#39ff88"></span>socket</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#b967ff"></span>chr/blk</span>'
    +       '<span class="mh-swatch"><span class="mh-sw-box" style="background:#8888aa"></span>other</span>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div id="mh-grid">'
    +   '<div id="mh-corner">DOMAIN<br>&times;<br>TYPE</div>'
    +   '<div id="mh-top-wrap"><canvas id="mh-top-canvas"></canvas></div>'
    +   '<div id="mh-left-wrap"><canvas id="mh-left-canvas"></canvas></div>'
    +   '<div id="mh-label-wrap"><canvas id="mh-label-canvas"></canvas></div>'
    +   '<div id="mh-main-wrap"><canvas id="mh-main-canvas"></canvas></div>'
    + '</div>'
    + '<div id="mh-stats-bar">'
    +   '<span id="mh-stats-text">0 domains &times; 0 types, 0 rules total, noise filter: hidden 0 types</span>'
    +   '<span id="mh-sel-text"></span>'
    + '</div>';

  /* ============================================================
     Local state (mirrors monolith's state object, lines 274-297;
     .data field dropped -- App.data is the single source of truth)
     ============================================================ */
  var mhState = {
    rowOrder:[],
    allTypesSorted:[],
    visibleTypes:[],
    domainCategory:new Map(),
    ruleIndex:new Map(),
    domainReachByType:new Map(),
    typeCategoryCounts:new Map(),
    typeDominantCat:new Map(),
    domainRuleCounts:{},
    maxDomainCount:1,
    selectedDomain:null,
    zoom:1,
    cellW:BASE_CELL_W,
    cellH:BASE_CELL_H,
    scrollX:0, scrollY:0,
    maxScrollX:0, maxScrollY:0,
    noiseEnabled:false,
    noiseThreshold:50,
    isPanning:false,
    panStartX:0, panStartY:0,
    panStartScrollX:0, panStartScrollY:0
  };

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};
  var topCtx, leftCtx, labelCtx, mainCtx;
  var topWrapSize = {w:0,h:0}, leftWrapSize = {w:0,h:0}, labelWrapSize = {w:0,h:0}, mainWrapSize = {w:0,h:0};
  var ro = null;
  var rafPending = false;

  /* ============================================================
     Helpers
     source: monolith lines 330-380
     ============================================================ */
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  function hexToRgba(hex, a){
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function classFill(cat){
    var hex = CLASS_HEX[cat] || CLASS_HEX.other;
    return hexToRgba(hex, cat === 'other' ? 0.4 : 0.6);
  }
  function classFillStrong(cat){
    var hex = CLASS_HEX[cat] || CLASS_HEX.other;
    return hexToRgba(hex, cat === 'other' ? 0.55 : 0.85);
  }
  function catFill(cat, strong){
    var hex = CAT_HEX[cat] || CAT_HEX.other;
    return hexToRgba(hex, strong ? 0.95 : 0.75);
  }

  function classCategory(c){
    if(!c) return 'other';
    if(c === 'chr_file' || c === 'blk_file') return 'chrblk';
    if(c === 'file' || c === 'dir' || c === 'lnk_file' || c === 'fifo_file' ||
       c === 'sock_file' || c === 'filesystem') return 'file';
    if(c === 'process' || c === 'process2') return 'process';
    if(c === 'capability' || c === 'capability2') return 'capability';
    if(c === 'binder') return 'binder';
    if(c.indexOf('socket') !== -1) return 'socket';
    return 'other';
  }

  function dominantCat(counts){
    var best = 'other', bestN = -1;
    for(var k in counts){
      if(counts.hasOwnProperty(k) && counts[k] > bestN){ bestN = counts[k]; best = k; }
    }
    return bestN < 0 ? 'other' : best;
  }

  function mergedEntries(cell){
    var map = new Map();
    cell.entries.forEach(function(e){
      if(!map.has(e.c)) map.set(e.c, new Set());
      var set = map.get(e.c);
      (e.p || []).forEach(function(p){ set.add(p); });
    });
    var out = [];
    map.forEach(function(pset, c){ out.push(c + ':' + Array.from(pset).join(',')); });
    return out;
  }

  /* ============================================================
     Build indexes from App.data
     source: monolith initViz, lines 425-518 -- file-drop / JSON.parse /
     dropzone show-hide removed; App.data is already loaded and
     validated by the shared shell before any view is created
     ============================================================ */
  function initFromData(data){
    if(!data || !Array.isArray(data.domains) || !Array.isArray(data.types) || !Array.isArray(data.rules)){
      throw new Error('missing required arrays: domains[], types[], rules[]');
    }
    var categories = data.categories && typeof data.categories === 'object' ? data.categories : {};
    var domainRuleCounts = data.domain_rule_counts && typeof data.domain_rule_counts === 'object' ? data.domain_rule_counts : {};

    mhState.domainRuleCounts = domainRuleCounts;
    mhState.domainCategory = new Map();
    mhState.ruleIndex = new Map();
    mhState.domainReachByType = new Map();
    mhState.typeCategoryCounts = new Map();
    mhState.selectedDomain = null;
    mhState.zoom = 1; mhState.cellW = BASE_CELL_W; mhState.cellH = BASE_CELL_H;
    mhState.scrollX = 0; mhState.scrollY = 0;

    /* domain -> category, row order grouped by category */
    var catKeys = Object.keys(categories);
    catKeys.sort(function(a,b){
      var ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      var ra = ia === -1 ? 999 : ia, rb = ib === -1 ? 999 : ib;
      return ra - rb || a.localeCompare(b);
    });
    var assigned = new Set();
    var rowOrder = [];
    var domainSet = new Set(data.domains);
    catKeys.forEach(function(cat){
      var list = (categories[cat] || []).filter(function(d){ return domainSet.has(d) && !assigned.has(d); });
      list.sort(function(a,b){ return (domainRuleCounts[b]||0) - (domainRuleCounts[a]||0); });
      list.forEach(function(d){
        mhState.domainCategory.set(d, cat);
        assigned.add(d);
        rowOrder.push(d);
      });
    });
    data.domains.forEach(function(d){
      if(!assigned.has(d)){
        mhState.domainCategory.set(d, 'other');
        assigned.add(d);
        rowOrder.push(d);
      }
    });
    mhState.rowOrder = rowOrder;

    /* rule index + reach + per-type class counts */
    data.rules.forEach(function(r){
      var s = r.s, t = r.t, c = r.c, p = r.p || [];
      if(!s || !t) return;
      if(!mhState.ruleIndex.has(s)) mhState.ruleIndex.set(s, new Map());
      var typeMap = mhState.ruleIndex.get(s);
      if(!typeMap.has(t)) typeMap.set(t, {counts:{}, entries:[]});
      var cell = typeMap.get(t);
      var cat = classCategory(c);
      cell.counts[cat] = (cell.counts[cat] || 0) + 1;
      cell.entries.push({c:c, p:p});

      if(!mhState.domainReachByType.has(t)) mhState.domainReachByType.set(t, new Set());
      mhState.domainReachByType.get(t).add(s);

      if(!mhState.typeCategoryCounts.has(t)) mhState.typeCategoryCounts.set(t, {});
      var tcc = mhState.typeCategoryCounts.get(t);
      tcc[cat] = (tcc[cat] || 0) + 1;
    });

    /* columns: types sorted by domain-reach descending */
    var allTypesSorted = data.types.slice().sort(function(a,b){
      var ra = (mhState.domainReachByType.get(a) || new Set()).size;
      var rb = (mhState.domainReachByType.get(b) || new Set()).size;
      return rb - ra;
    });
    mhState.allTypesSorted = allTypesSorted;
    mhState.typeDominantCat = new Map();
    allTypesSorted.forEach(function(t){
      mhState.typeDominantCat.set(t, dominantCat(mhState.typeCategoryCounts.get(t) || {}));
    });

    var maxCount = 1;
    rowOrder.forEach(function(d){ maxCount = Math.max(maxCount, domainRuleCounts[d] || 0); });
    mhState.maxDomainCount = maxCount;

    recomputeVisibleTypes();
  }

  function recomputeVisibleTypes(){
    var total = mhState.rowOrder.length || 1;
    if(mhState.noiseEnabled){
      mhState.visibleTypes = mhState.allTypesSorted.filter(function(t){
        var reach = (mhState.domainReachByType.get(t) || new Set()).size;
        return (reach / total * 100) <= mhState.noiseThreshold;
      });
    } else {
      mhState.visibleTypes = mhState.allTypesSorted.slice();
    }
    recomputeMaxScroll();
    updateStats();
  }

  /* ============================================================
     Canvas fit / resize
     source: monolith lines 535-568
     ============================================================ */
  function fitCanvas(canvas, wrap, sizeObj){
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    sizeObj.w = w; sizeObj.h = h;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function refitAll(){
    mainCtx = fitCanvas(els.mainCanvas, els.mainWrap, mainWrapSize);
    leftCtx = fitCanvas(els.leftCanvas, els.leftWrap, leftWrapSize);
    labelCtx = fitCanvas(els.labelCanvas, els.labelWrap, labelWrapSize);
    topCtx = fitCanvas(els.topCanvas, els.topWrap, topWrapSize);
  }

  function recomputeMaxScroll(){
    mhState.maxScrollX = Math.max(0, mhState.visibleTypes.length * mhState.cellW - mainWrapSize.w);
    mhState.maxScrollY = Math.max(0, mhState.rowOrder.length * mhState.cellH - mainWrapSize.h);
    mhState.scrollX = clamp(mhState.scrollX, 0, mhState.maxScrollX);
    mhState.scrollY = clamp(mhState.scrollY, 0, mhState.maxScrollY);
  }

  /* ============================================================
     Draw
     source: monolith lines 570-697
     ============================================================ */
  function requestRedrawAll(){
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(function(){
      rafPending = false;
      drawMain(); drawLeft(); drawLabels(); drawTop();
    });
  }

  function drawMain(){
    if(!mainCtx) return;
    var w = mainWrapSize.w, h = mainWrapSize.h;
    mainCtx.clearRect(0, 0, w, h);
    mainCtx.fillStyle = '#08081a';
    mainCtx.fillRect(0, 0, w, h);
    if(!mhState.rowOrder.length || !mhState.visibleTypes.length) return;

    var cellW = mhState.cellW, cellH = mhState.cellH, scrollX = mhState.scrollX, scrollY = mhState.scrollY;
    var colStart = Math.max(0, Math.floor(scrollX / cellW));
    var colEnd = Math.min(mhState.visibleTypes.length - 1, Math.ceil((scrollX + w) / cellW));
    var rowStart = Math.max(0, Math.floor(scrollY / cellH));
    var rowEnd = Math.min(mhState.rowOrder.length - 1, Math.ceil((scrollY + h) / cellH));

    for(var row = rowStart; row <= rowEnd; row++){
      var domain = mhState.rowOrder[row];
      var y = row * cellH - scrollY;
      var isSel = domain === mhState.selectedDomain;
      if(isSel){
        mainCtx.fillStyle = 'rgba(255,255,255,0.06)';
        mainCtx.fillRect(0, y, w, cellH);
      }
      var typeMap = mhState.ruleIndex.get(domain);
      if(typeMap){
        for(var col = colStart; col <= colEnd; col++){
          var type = mhState.visibleTypes[col];
          var cell = typeMap.get(type);
          if(!cell) continue;
          var cat = dominantCat(cell.counts);
          var x = col * cellW - scrollX;
          mainCtx.fillStyle = classFill(cat);
          mainCtx.fillRect(x, y, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
        }
      }
      if(isSel){
        mainCtx.strokeStyle = 'rgba(0,255,242,0.9)';
        mainCtx.lineWidth = 1;
        mainCtx.strokeRect(0.5, y + 0.5, w - 1, Math.max(1, cellH - 1));
      }
    }
  }

  function drawLeft(){
    if(!leftCtx) return;
    var w = leftWrapSize.w, h = leftWrapSize.h;
    leftCtx.clearRect(0, 0, w, h);
    if(!mhState.rowOrder.length) return;
    var cellH = mhState.cellH, scrollY = mhState.scrollY;
    var rowStart = Math.max(0, Math.floor(scrollY / cellH));
    var rowEnd = Math.min(mhState.rowOrder.length - 1, Math.ceil((scrollY + h) / cellH));
    var barMaxW = Math.max(4, w - 10);
    var scale = d3.scaleLinear().domain([0, mhState.maxDomainCount]).range([2, barMaxW]);

    for(var row = rowStart; row <= rowEnd; row++){
      var domain = mhState.rowOrder[row];
      var y = row * cellH - scrollY;
      var count = mhState.domainRuleCounts[domain] || 0;
      var bw = scale(count);
      var cat = mhState.domainCategory.get(domain) || 'other';
      var isSel = domain === mhState.selectedDomain;
      leftCtx.fillStyle = catFill(cat, isSel);
      leftCtx.fillRect(w - 4 - bw, y + 1, bw, Math.max(1, cellH - 2));
      if(isSel){
        leftCtx.strokeStyle = 'rgba(255,255,255,0.9)';
        leftCtx.lineWidth = 1;
        leftCtx.strokeRect(w - 4 - bw + 0.5, y + 1.5, Math.max(1, bw - 1), Math.max(1, cellH - 3));
      }
    }
  }

  function drawLabels(){
    if(!labelCtx) return;
    var w = labelWrapSize.w, h = labelWrapSize.h;
    labelCtx.clearRect(0, 0, w, h);
    if(!mhState.rowOrder.length) return;
    var cellH = mhState.cellH, scrollY = mhState.scrollY;
    var rowStart = Math.max(0, Math.floor(scrollY / cellH));
    var rowEnd = Math.min(mhState.rowOrder.length - 1, Math.ceil((scrollY + h) / cellH));
    var fontSize = clamp(cellH - 4, 6, 11);
    labelCtx.font = fontSize + "px 'JetBrains Mono', Consolas, monospace";
    labelCtx.textBaseline = 'middle';
    var maxChars = Math.max(4, Math.floor((w - 10) / (fontSize * 0.62)));

    for(var row = rowStart; row <= rowEnd; row++){
      if(cellH < 5) break;
      var domain = mhState.rowOrder[row];
      var y = row * cellH - scrollY + cellH / 2;
      var isSel = domain === mhState.selectedDomain;
      labelCtx.fillStyle = isSel ? '#00fff2' : '#8888aa';
      var label = domain;
      if(label.length > maxChars) label = label.slice(0, Math.max(1, maxChars - 1)) + '…';
      labelCtx.fillText(label, 6, y);
    }
  }

  function drawTop(){
    if(!topCtx) return;
    var w = topWrapSize.w, h = topWrapSize.h;
    topCtx.clearRect(0, 0, w, h);
    if(!mhState.visibleTypes.length) return;
    var cellW = mhState.cellW, scrollX = mhState.scrollX;
    var colStart = Math.max(0, Math.floor(scrollX / cellW));
    var colEnd = Math.min(mhState.visibleTypes.length - 1, Math.ceil((scrollX + w) / cellW));
    var barMaxH = Math.max(4, h - 14);
    var maxReach = mhState.rowOrder.length || 1;
    var scale = d3.scaleLinear().domain([0, maxReach]).range([2, barMaxH]);

    for(var col = colStart; col <= colEnd; col++){
      var type = mhState.visibleTypes[col];
      var reach = (mhState.domainReachByType.get(type) || new Set()).size;
      var bh = scale(reach);
      var cat = mhState.typeDominantCat.get(type) || 'other';
      var x = col * cellW - scrollX;
      topCtx.fillStyle = classFillStrong(cat);
      topCtx.fillRect(x, h - bh, Math.max(1, cellW - 1), bh);
    }
  }

  /* ============================================================
     Interaction: zoom / pan
     source: monolith lines 699-743
     ============================================================ */
  function onMainWheel(e){
    e.preventDefault();
    if(!mhState.rowOrder.length) return;
    var rect = els.mainWrap.getBoundingClientRect();
    var offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
    var factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
    var newZoom = clamp(mhState.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if(newZoom === mhState.zoom) return;

    var virtualX = mhState.scrollX + offsetX, virtualY = mhState.scrollY + offsetY;
    var ratioX = virtualX / mhState.cellW, ratioY = virtualY / mhState.cellH;

    mhState.zoom = newZoom;
    mhState.cellW = BASE_CELL_W * newZoom;
    mhState.cellH = BASE_CELL_H * newZoom;
    recomputeMaxScroll();
    mhState.scrollX = clamp(ratioX * mhState.cellW - offsetX, 0, mhState.maxScrollX);
    mhState.scrollY = clamp(ratioY * mhState.cellH - offsetY, 0, mhState.maxScrollY);

    updateZoomReadout();
    requestRedrawAll();
    hideTooltip();
  }

  function onMainMouseDown(e){
    mhState.isPanning = true;
    mhState.panStartX = e.clientX; mhState.panStartY = e.clientY;
    mhState.panStartScrollX = mhState.scrollX; mhState.panStartScrollY = mhState.scrollY;
    els.mainWrap.classList.add('mh-panning');
    hideTooltip();
  }
  function onWindowMouseMove(e){
    if(!mhState.isPanning) return;
    var dx = e.clientX - mhState.panStartX, dy = e.clientY - mhState.panStartY;
    mhState.scrollX = clamp(mhState.panStartScrollX - dx, 0, mhState.maxScrollX);
    mhState.scrollY = clamp(mhState.panStartScrollY - dy, 0, mhState.maxScrollY);
    requestRedrawAll();
  }
  function onWindowMouseUp(){
    if(mhState.isPanning){
      mhState.isPanning = false;
      els.mainWrap.classList.remove('mh-panning');
    }
  }

  /* ============================================================
     Interaction: hover tooltip
     source: monolith lines 745-776 -- tooltipEl replaced by the
     shared App.tooltip singleton (id="tooltip" lives in the shell)
     ============================================================ */
  function showTooltip(clientX, clientY, domain, type, cell){
    var lines = mergedEntries(cell);
    var html =
      '<div class="tt-row"><span class="tt-k">domain</span><span class="tt-domain">' + domain + '</span></div>' +
      '<div class="tt-row"><span class="tt-k">type</span><span class="tt-type">' + type + '</span></div>' +
      '<div class="tt-perms">' + lines.join('<br>') + '</div>';
    App.tooltip.show(clientX, clientY, html);
  }
  function hideTooltip(){ App.tooltip.hide(); }

  function onMainMouseMove(e){
    if(mhState.isPanning || !mhState.rowOrder.length || !mhState.visibleTypes.length){ return; }
    var rect = els.mainWrap.getBoundingClientRect();
    var offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
    var col = Math.floor((mhState.scrollX + offsetX) / mhState.cellW);
    var row = Math.floor((mhState.scrollY + offsetY) / mhState.cellH);
    if(col < 0 || col >= mhState.visibleTypes.length || row < 0 || row >= mhState.rowOrder.length){
      hideTooltip(); return;
    }
    var domain = mhState.rowOrder[row];
    var type = mhState.visibleTypes[col];
    var typeMap = mhState.ruleIndex.get(domain);
    var cell = typeMap && typeMap.get(type);
    if(!cell){ hideTooltip(); return; }
    showTooltip(e.clientX, e.clientY, domain, type, cell);
  }
  function onMainMouseLeave(){ hideTooltip(); }

  /* ============================================================
     Interaction: row select
     source: monolith lines 778-801
     ============================================================ */
  function rowFromClientY(wrapEl, clientY){
    var rect = wrapEl.getBoundingClientRect();
    var offsetY = clientY - rect.top;
    var row = Math.floor((mhState.scrollY + offsetY) / mhState.cellH);
    if(row < 0 || row >= mhState.rowOrder.length) return null;
    return row;
  }
  function selectDomain(domain){
    mhState.selectedDomain = (mhState.selectedDomain === domain) ? null : domain;
    els.selText.textContent = mhState.selectedDomain ? ('selected: ' + mhState.selectedDomain) : '';
    requestRedrawAll();
  }
  /* factory: leftWrap and labelWrap both select-a-row-on-click, with a
     small drag-vs-click tolerance (same 4px threshold as the monolith) */
  function makeRowSelectHandlers(el){
    var h = {downY:0, moved:false};
    h.mousedown = function(e){ h.downY = e.clientY; h.moved = false; };
    h.mousemove = function(e){ if(Math.abs(e.clientY - h.downY) > 4) h.moved = true; };
    h.click = function(e){
      if(h.moved || !mhState.rowOrder.length) return;
      var row = rowFromClientY(el, e.clientY);
      if(row === null) return;
      selectDomain(mhState.rowOrder[row]);
    };
    return h;
  }

  /* ============================================================
     Controls
     source: monolith lines 803-829
     ============================================================ */
  function onNoiseCheckboxChange(){
    mhState.noiseEnabled = els.noiseCheckbox.checked;
    els.noiseSlider.disabled = !mhState.noiseEnabled;
    recomputeVisibleTypes();
    requestRedrawAll();
  }
  function onNoiseSliderInput(){
    mhState.noiseThreshold = +els.noiseSlider.value;
    els.noiseValue.textContent = mhState.noiseThreshold + '%';
    if(mhState.noiseEnabled){
      recomputeVisibleTypes();
      requestRedrawAll();
    }
  }
  function onResetClick(){
    mhState.zoom = 1; mhState.cellW = BASE_CELL_W; mhState.cellH = BASE_CELL_H;
    mhState.scrollX = 0; mhState.scrollY = 0; mhState.selectedDomain = null;
    els.selText.textContent = '';
    recomputeMaxScroll();
    updateZoomReadout();
    requestRedrawAll();
  }

  function updateZoomReadout(){
    els.zoomReadout.textContent = Math.round(mhState.zoom * 100) + '%';
  }
  function updateStats(){
    var hidden = mhState.allTypesSorted.length - mhState.visibleTypes.length;
    els.statsText.innerHTML =
      '<span class="mh-stat-cyan">' + mhState.rowOrder.length + '</span> domains &times; ' +
      '<span class="mh-stat-cyan">' + mhState.allTypesSorted.length + '</span> types, ' +
      '<span class="mh-stat-cyan">' + (App.data ? App.data.rules.length : 0) + '</span> rules total, ' +
      'noise filter: hidden <span class="mh-stat-cyan">' + hidden + '</span> types';
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createMarginalHeatmap(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (controls, grid, canvases, stats bar) inside container */
    var root = App.el('div','mh-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.controls = root.querySelector('#mh-controls');
    els.noiseCheckbox = root.querySelector('#mh-noise-checkbox');
    els.noiseSlider = root.querySelector('#mh-noise-slider');
    els.noiseValue = root.querySelector('#mh-noise-value');
    els.resetBtn = root.querySelector('#mh-reset-btn');
    els.zoomReadout = root.querySelector('#mh-zoom-readout');
    els.grid = root.querySelector('#mh-grid');
    els.corner = root.querySelector('#mh-corner');
    els.topWrap = root.querySelector('#mh-top-wrap');
    els.leftWrap = root.querySelector('#mh-left-wrap');
    els.labelWrap = root.querySelector('#mh-label-wrap');
    els.mainWrap = root.querySelector('#mh-main-wrap');
    els.topCanvas = root.querySelector('#mh-top-canvas');
    els.leftCanvas = root.querySelector('#mh-left-canvas');
    els.labelCanvas = root.querySelector('#mh-label-canvas');
    els.mainCanvas = root.querySelector('#mh-main-canvas');
    els.statsBar = root.querySelector('#mh-stats-bar');
    els.statsText = root.querySelector('#mh-stats-text');
    els.selText = root.querySelector('#mh-sel-text');

    /* 3. Wire event listeners on the created elements */
    els.mainWrap.addEventListener('wheel', onMainWheel, {passive:false});
    els.mainWrap.addEventListener('mousedown', onMainMouseDown);
    els.mainWrap.addEventListener('mousemove', onMainMouseMove);
    els.mainWrap.addEventListener('mouseleave', onMainMouseLeave);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    els.leftRowSelect = makeRowSelectHandlers(els.leftWrap);
    els.leftWrap.addEventListener('mousedown', els.leftRowSelect.mousedown);
    els.leftWrap.addEventListener('mousemove', els.leftRowSelect.mousemove);
    els.leftWrap.addEventListener('click', els.leftRowSelect.click);

    els.labelRowSelect = makeRowSelectHandlers(els.labelWrap);
    els.labelWrap.addEventListener('mousedown', els.labelRowSelect.mousedown);
    els.labelWrap.addEventListener('mousemove', els.labelRowSelect.mousemove);
    els.labelWrap.addEventListener('click', els.labelRowSelect.click);

    els.noiseCheckbox.addEventListener('change', onNoiseCheckboxChange);
    els.noiseSlider.addEventListener('input', onNoiseSliderInput);
    els.resetBtn.addEventListener('click', onResetClick);

    ro = new ResizeObserver(function(){
      refitAll();
      recomputeMaxScroll();
      requestRedrawAll();
    });
    ro.observe(els.mainWrap); ro.observe(els.leftWrap); ro.observe(els.labelWrap); ro.observe(els.topWrap);

    /* 4. Compute initial data from the already-loaded policy */
    initFromData(App.data);

    /* 5. Fit canvases + draw (deferred a frame so clientWidth/Height
       reflect the just-attached layout, same as the monolith) */
    requestAnimationFrame(function(){
      refitAll();
      recomputeMaxScroll();
      updateZoomReadout();
      updateStats();
      requestRedrawAll();
    });
  }

  function destroyMarginalHeatmap(){
    if(ro){ ro.disconnect(); ro = null; }

    if(els.mainWrap){
      els.mainWrap.removeEventListener('wheel', onMainWheel);
      els.mainWrap.removeEventListener('mousedown', onMainMouseDown);
      els.mainWrap.removeEventListener('mousemove', onMainMouseMove);
      els.mainWrap.removeEventListener('mouseleave', onMainMouseLeave);
    }
    window.removeEventListener('mousemove', onWindowMouseMove);
    window.removeEventListener('mouseup', onWindowMouseUp);

    if(els.leftWrap && els.leftRowSelect){
      els.leftWrap.removeEventListener('mousedown', els.leftRowSelect.mousedown);
      els.leftWrap.removeEventListener('mousemove', els.leftRowSelect.mousemove);
      els.leftWrap.removeEventListener('click', els.leftRowSelect.click);
    }
    if(els.labelWrap && els.labelRowSelect){
      els.labelWrap.removeEventListener('mousedown', els.labelRowSelect.mousedown);
      els.labelWrap.removeEventListener('mousemove', els.labelRowSelect.mousemove);
      els.labelWrap.removeEventListener('click', els.labelRowSelect.click);
    }

    if(els.noiseCheckbox) els.noiseCheckbox.removeEventListener('change', onNoiseCheckboxChange);
    if(els.noiseSlider) els.noiseSlider.removeEventListener('input', onNoiseSliderInput);
    if(els.resetBtn) els.resetBtn.removeEventListener('click', onResetClick);

    hideTooltip();

    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};
    topCtx = leftCtx = labelCtx = mainCtx = null;
    topWrapSize = {w:0,h:0}; leftWrapSize = {w:0,h:0}; labelWrapSize = {w:0,h:0}; mainWrapSize = {w:0,h:0};
    rafPending = false;

    /* Clear local state */
    mhState.rowOrder = [];
    mhState.allTypesSorted = [];
    mhState.visibleTypes = [];
    mhState.domainCategory = new Map();
    mhState.ruleIndex = new Map();
    mhState.domainReachByType = new Map();
    mhState.typeCategoryCounts = new Map();
    mhState.typeDominantCat = new Map();
    mhState.domainRuleCounts = {};
    mhState.maxDomainCount = 1;
    mhState.selectedDomain = null;
    mhState.zoom = 1;
    mhState.cellW = BASE_CELL_W;
    mhState.cellH = BASE_CELL_H;
    mhState.scrollX = 0; mhState.scrollY = 0;
    mhState.maxScrollX = 0; mhState.maxScrollY = 0;
    mhState.noiseEnabled = false;
    mhState.noiseThreshold = 50;
    mhState.isPanning = false;
  }

  App.registerView('marginal-heatmap', {
    label: 'MARGINAL',
    icon: '│',
    create: createMarginalHeatmap,
    destroy: destroyMarginalHeatmap
  });
})();
