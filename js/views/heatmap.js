/* heatmap.js -- domain x target-type heatmap view, ported from sepolicy_viz.html monolith */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: monolith lines ~366-431
     ============================================================ */
  var CSS = ''
    + '.heatmap-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));padding:0;}'
    + '.heatmap-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);background:rgba(20,20,40,0.5);flex-shrink:0;}'
    + '.heatmap-legend{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:10px;color:var(--text2);}'
    + '.legend-swatch{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}'
    + '.legend-dot{width:9px;height:9px;display:inline-block;border-radius:1px;box-shadow:0 0 4px currentColor;}'
    + '.heatmap-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}'
    + '.heatmap-selection-info{font-size:11px;color:var(--amber);max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.hm-filter-toggle{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--green);cursor:pointer;white-space:nowrap;letter-spacing:.5px;}'
    + '.hm-filter-toggle input{accent-color:var(--green);cursor:pointer;}'
    + '.hm-filter-stats{font-size:10px;color:var(--text2);white-space:nowrap;}'
    + '.zoom-controls{display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--border);padding:2px;}'
    + '.zoom-controls .btn-ghost{padding:3px 9px;font-size:12px;}'
    + '.zoom-level{color:var(--text2);font-size:11px;min-width:42px;text-align:center;}'
    + '.heatmap-outer{flex:1;display:flex;overflow:hidden;background:var(--bg);}'
    + '.heatmap-labels-wrap{flex-shrink:0;overflow:hidden;display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--surface);}'
    + '.hm-label-spacer{flex-shrink:0;}'
    + '#heatmap-labels{display:block;cursor:pointer;}'
    + '.heatmap-scroll{flex:1;overflow:auto;position:relative;background:var(--bg);}'
    + '.heatmap-stage{position:relative;}'
    + '#heatmap-header{position:sticky;top:0;left:0;display:block;z-index:3;background:var(--surface2);border-bottom:1px solid var(--border);}'
    + '.heatmap-body-wrap{position:relative;}'
    + '#heatmap-canvas,#heatmap-overlay{position:absolute;top:0;left:0;display:block;}'
    + '#heatmap-overlay{pointer-events:none;}'
    + '.heatmap-statusbar{flex-shrink:0;padding:6px 16px;font-size:10px;color:var(--text2);border-top:1px solid var(--border);background:rgba(20,20,40,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.heatmap-scroll.grabbing{cursor:grabbing;}'
    + '.row-label-badge{position:absolute;left:6px;pointer-events:none;font-size:9px;color:var(--text2);letter-spacing:1px;text-transform:uppercase;background:rgba(10,10,26,0.65);padding:1px 5px;border-left:2px solid var(--border);}'
    + '.cell-popup{position:fixed;z-index:1500;background:var(--surface);border:1px solid var(--cyan);box-shadow:0 0 24px rgba(0,255,242,0.3);min-width:240px;max-width:360px;padding:0;}'
    + '.cell-popup.hidden{display:none;}'
    + '.cell-popup-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--surface2);}'
    + '.cell-popup-head .cph-title{font-size:11px;color:var(--cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.cell-popup-close{background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;}'
    + '.cell-popup-close:hover{color:var(--magenta);}'
    + '.cell-popup-body{padding:10px;max-height:320px;overflow-y:auto;}'
    + '.cell-popup-body .cpb-class{margin-bottom:8px;}'
    + '.cell-popup-body .cpb-class-name{color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px;}'
    + '.cell-popup-actions{display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--border);}'
    + '.cell-popup-actions .btn-ghost{flex:1;font-size:10px;padding:6px 4px;text-align:center;}';
  var styleEl = null;

  /* ============================================================
     DOM templates (adapted from monolith markup lines ~722-757, ~851-859)
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="heatmap-toolbar">'
    +   '<div id="heatmap-legend" class="heatmap-legend"></div>'
    +   '<div class="heatmap-controls">'
    +     '<span id="heatmap-selection-info" class="heatmap-selection-info"></span>'
    +     '<button id="btn-graph-view" class="btn-ghost magenta hidden" type="button">GRAPH VIEW →</button>'
    +     '<button id="btn-compare-view" class="btn-ghost amber hidden" type="button">COMPARE →</button>'
    +     '<button id="btn-clear-heatmap-selection" class="btn-ghost hidden" type="button">CLEAR [x]</button>'
    +     '<button id="btn-hm-filter-mode" class="btn-ghost hidden" type="button">OVERLAP</button>'
    +     '<label class="hm-filter-toggle" title="Hide target types accessed by 30%+ of all domains (attribute-inherited noise)"><input type="checkbox" id="chk-hide-common" checked> HIDE COMMON</label>'
    +     '<span id="hm-filter-stats" class="hm-filter-stats"></span>'
    +     '<span class="zoom-controls">'
    +       '<button id="btn-zoom-out" class="btn-ghost" type="button">−</button>'
    +       '<span id="zoom-level" class="zoom-level">100%</span>'
    +       '<button id="btn-zoom-in" class="btn-ghost" type="button">+</button>'
    +     '</span>'
    +   '</div>'
    + '</div>'
    + '<div id="heatmap-outer" class="heatmap-outer">'
    +   '<div id="heatmap-labels-wrap" class="heatmap-labels-wrap">'
    +     '<div class="hm-label-spacer"></div>'
    +     '<canvas id="heatmap-labels"></canvas>'
    +   '</div>'
    +   '<div id="heatmap-scroll" class="heatmap-scroll">'
    +     '<div id="heatmap-stage" class="heatmap-stage">'
    +       '<canvas id="heatmap-header"></canvas>'
    +       '<div id="heatmap-body-wrap" class="heatmap-body-wrap">'
    +         '<canvas id="heatmap-canvas"></canvas>'
    +         '<canvas id="heatmap-overlay"></canvas>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div id="heatmap-statusbar" class="heatmap-statusbar">hover a cell to inspect · click a Y-axis label = select UID · click a cell in selected row = filter by target type · click selected label again = clear</div>';

  var POPUP_TEMPLATE = ''
    + '<div class="cell-popup-head">'
    +   '<span id="cell-popup-title" class="cph-title"></span>'
    +   '<button class="cell-popup-close" type="button">×</button>'
    + '</div>'
    + '<div id="cell-popup-body" class="cell-popup-body"></div>'
    + '<div class="cell-popup-actions">'
    +   '<button id="cell-popup-goto-reverse" class="btn-ghost amber" type="button">REVERSE LOOKUP</button>'
    +   '<button id="cell-popup-goto-graph" class="btn-ghost magenta" type="button">GRAPH VIEW</button>'
    + '</div>';

  /* ============================================================
     Local state (replaces S.* heatmap-specific fields, monolith line ~1148-1219)
     ============================================================ */
  var hmState = {
    zoom: 1,
    selectedRow: null,
    compareRow: null,
    hoverRow: -1,
    hoverCol: -1,
    jumpHighlightCol: null,
    jumpHighlightRow: null,
    hmRowLayouts: null,

    /* heatmap noise filter */
    hideCommon: true,
    hideCommonThreshold: 0.30,
    filteredTypes: [],
    filteredTypeColIndex: {},
    /* sparse heatmap visible sets (collapsed empty rows/cols) */
    hmVisDomains: [],
    hmVisDomainIndex: {},
    hmVisTypes: [],
    hmVisTypeColIndex: {},
    /* heatmap filter state (label-click -> cell-click interaction) */
    hmFilterDomain: null,
    hmFilterType: null,
    hmFilterMode: 'overlap'
  };

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  /* ============================================================
     Heatmap noise filter -- hides target type columns that appear
     in more than threshold% of all domains.  These are attribute-
     inherited grants (domain, coredomain, appdomain, etc.) that
     create uniform horizontal bands obscuring actual per-domain
     differences.  Toggle via the "Hide common" checkbox.
     source: monolith line 1362
     ============================================================ */
  function computeFilteredTypes(){
    var totalDomains = App.state.domains.length;
    var cutoff = Math.floor(totalDomains * hmState.hideCommonThreshold);
    if(hmState.hideCommon && totalDomains>0){
      hmState.filteredTypes = App.state.types.filter(function(t){ return (App.state.typeDomainCount[t]||0) <= cutoff; });
    } else {
      hmState.filteredTypes = App.state.types.slice();
    }
    hmState.filteredTypeColIndex = {};
    hmState.filteredTypes.forEach(function(t,i){ hmState.filteredTypeColIndex[t]=i; });
    computeHeatmapVisibleSets();
  }

  /* Compute the sparse row/column sets for the heatmap.
     Only domains that have at least one grant in the visible types are
     included as rows; only types that have at least one grant from a
     visible domain are included as columns.  This collapses empty
     rows and columns so every pixel of the heatmap is meaningful.
     source: monolith line 1380 */
  function computeHeatmapVisibleSets(){
    var visColIdx = hmState.hideCommon ? hmState.filteredTypeColIndex : App.state.typeColIndex;
    /* pass 1: find domains that have at least one grant in visible types */
    var visDomains = [];
    App.state.domains.forEach(function(d){
      var tmap = App.state.domainTypeMap[d];
      if(!tmap) return;
      for(var t in tmap){
        if(visColIdx[t]!==undefined){ visDomains.push(d); return; }
      }
    });
    /* Y-axis row order: ascending by numeric UID (uid:0 at top, then
       uid:1000, uid:1001, uid:2000 shell, uid:10000+ apps, ...). Domains
       with no known UID mapping sort to the bottom, alphabetically. */
    visDomains.sort(App.domainUidSortCompare);
    var visDomainIndex = {};
    visDomains.forEach(function(d,i){ visDomainIndex[d]=i; });
    /* pass 2: find types that have at least one grant from a visible domain */
    var visTypes = hmState.hideCommon ? hmState.filteredTypes : App.state.types;
    var usedTypes = [];
    var usedTypeIdx = {};
    visTypes.forEach(function(t){
      for(var i=0;i<visDomains.length;i++){
        var tmap = App.state.domainTypeMap[visDomains[i]];
        if(tmap && tmap[t]){ usedTypes.push(t); usedTypeIdx[t]=usedTypes.length-1; return; }
      }
    });
    hmState.hmVisDomains = visDomains;
    hmState.hmVisDomainIndex = visDomainIndex;
    hmState.hmVisTypes = usedTypes;
    hmState.hmVisTypeColIndex = usedTypeIdx;

    /* --- filter override: when a domain+type filter is active, narrow the
       visible domains to only those that share grants on the target type --- */
    if(hmState.hmFilterDomain && hmState.hmFilterType){
      var ft = hmState.hmFilterType;
      var fd = hmState.hmFilterDomain;
      var filterDomains = [fd];
      var refSig = (hmState.hmFilterMode==='exact') ? permSignature(fd, ft) : null;
      for(var fi=0; fi<visDomains.length; fi++){
        var d = visDomains[fi];
        if(d===fd) continue;
        var tmap = App.state.domainTypeMap[d];
        if(!tmap || !tmap[ft]) continue;
        if(hmState.hmFilterMode==='exact'){
          if(permSignature(d, ft)!==refSig) continue;
        }
        filterDomains.push(d);
      }
      /* rebuild index */
      var fIdx = {};
      filterDomains.forEach(function(d,i){ fIdx[d]=i; });
      /* rebuild visible types for this filtered set */
      var fTypes = [];
      var fTypeIdx = {};
      usedTypes.forEach(function(t){
        for(var k=0;k<filterDomains.length;k++){
          var tm = App.state.domainTypeMap[filterDomains[k]];
          if(tm && tm[t]){ fTypes.push(t); fTypeIdx[t]=fTypes.length-1; return; }
        }
      });
      hmState.hmVisDomains = filterDomains;
      hmState.hmVisDomainIndex = fIdx;
      hmState.hmVisTypes = fTypes;
      hmState.hmVisTypeColIndex = fTypeIdx;
    }
  }

  /* returns the types and typeColIndex to use for heatmap rendering */
  function hmTypes(){ return hmState.hmVisTypes||[]; }
  function hmTypeColIndex(){ return hmState.hmVisTypeColIndex||{}; }
  function hmDomains(){ return hmState.hmVisDomains||[]; }
  function hmDomainIndex(){ return hmState.hmVisDomainIndex||{}; }
  function updateFilterStats(){
    var el = els.filterStats;
    if(!el) return;
    var vt = hmTypes(), vd = hmDomains();
    if(hmState.hideCommon){
      var hiddenT = App.state.types.length - vt.length;
      var hiddenD = App.state.domains.length - vd.length;
      el.textContent = '('+App.fmtNum(vt.length)+'/'+App.fmtNum(App.state.types.length)+' types, '+App.fmtNum(vd.length)+'/'+App.fmtNum(App.state.domains.length)+' domains visible)';
    } else {
      el.textContent = '('+App.fmtNum(vt.length)+' types, '+App.fmtNum(vd.length)+' domains)';
    }
  }

  /* ============================================================
     Overlap computation (domain vs domain)
     source: monolith line 1469
     ============================================================ */
  function overlapCount(domainA,domainB){
    var setA = App.state.domainTypeSet[domainA], setB = App.state.domainTypeSet[domainB];
    if(!setA || !setB) return 0;
    var small = setA.size<setB.size?setA:setB, big = setA.size<setB.size?setB:setA;
    var n=0;
    small.forEach(function(t){ if(big.has(t)) n++; });
    return n;
  }
  /* Build a canonical string signature for the permissions a domain has on
     a given target type.  Two domains match in EXACT mode iff their
     signatures are identical. */
  function permSignature(domain, type){
    var entries = App.state.domainTypeMap[domain] && App.state.domainTypeMap[domain][type];
    if(!entries) return '';
    var parts = entries.map(function(en){
      return en.c + ':' + en.p.slice().sort().join(',');
    });
    parts.sort();
    return parts.join(';');
  }

  function domainDominantClass(domain){
    var tmap = App.state.domainTypeMap[domain];
    if(!tmap) return 'other';
    var counts = {};
    for(var t in tmap){
      var cat = App.cellCategoryFromEntries(tmap[t]);
      counts[cat] = (counts[cat]||0)+1;
    }
    var keys = Object.keys(counts);
    if(!keys.length) return 'other';
    keys.sort(function(a,b){
      if(counts[b]!==counts[a]) return counts[b]-counts[a];
      var pa=App.CLASS_PRIORITY.indexOf(a), pb=App.CLASS_PRIORITY.indexOf(b);
      if(pa<0) pa=99;
      if(pb<0) pb=99;
      return pa-pb;
    });
    return keys[0];
  }

  /* ============================================================
     Heatmap rendering
     source: monolith line ~1513
     ============================================================ */
  function cw(){ return App.BASE_CELL_W*hmState.zoom; }
  function ch(){ return App.BASE_CELL_H*hmState.zoom; }

  function sizeCanvas(canvas,wpx,hpx){
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.max(1,Math.round(wpx*dpr));
    canvas.height = Math.max(1,Math.round(hpx*dpr));
    canvas.style.width = wpx+'px';
    canvas.style.height = hpx+'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return ctx;
  }

  function drawHeatmapAll(){
    var visTypes = hmTypes();
    var visColIdx = hmTypeColIndex();
    var visDomains = hmDomains();
    var visDomIdx = hmDomainIndex();
    var rows = visDomains.length;
    var CW = cw(), CH = ch();
    var GAP_W = Math.max(1, Math.round(CW*0.25));

    /* ---- RLE pass: build per-row compressed layouts ----
       For each row, walk visTypes left-to-right.
         grant cell  -> full CW width
         consecutive empties -> one thin GAP_W spacer
       Store {x0, w, type, isGap} per segment for hit testing. */
    hmState.hmRowLayouts = new Array(rows);
    var maxRowW = 0;
    for(var ri=0; ri<rows; ri++){
      var domain = visDomains[ri];
      var tmap = App.state.domainTypeMap[domain];
      var segs = [];
      var x = 0;
      var emptyRun = 0;
      for(var ci=0; ci<visTypes.length; ci++){
        var t = visTypes[ci];
        var hasGrant = tmap && tmap[t];
        if(hasGrant){
          if(emptyRun>0){
            segs.push({x0:x, w:GAP_W, type:null, isGap:true});
            x += GAP_W;
            emptyRun = 0;
          }
          segs.push({x0:x, w:CW, type:t, isGap:false});
          x += CW;
        } else {
          emptyRun++;
        }
      }
      hmState.hmRowLayouts[ri] = segs;
      if(x>maxRowW) maxRowW = x;
    }

    var totalW = Math.max(1, maxRowW);
    var totalH = rows*CH;
    var stage = els.stage;
    var wrap = els.bodyWrap;
    stage.style.width = totalW+'px';
    wrap.style.width = totalW+'px';
    wrap.style.height = totalH+'px';

    /* header -- simple bar */
    var headerCanvas = els.headerCanvas;
    var hctx = sizeCanvas(headerCanvas, totalW, App.HEADER_H);
    hctx.fillStyle = '#1b1b36';
    hctx.fillRect(0,0,totalW,App.HEADER_H);

    /* --- compute overlap set BEFORE label drawing so labels can dim --- */
    var selSet = hmState.selectedRow ? App.state.domainTypeSet[hmState.selectedRow] : null;
    var selVisIdx = (hmState.selectedRow && visDomIdx[hmState.selectedRow]!==undefined) ? visDomIdx[hmState.selectedRow] : -1;
    var overlapDomains = null;
    if(selSet && !hmState.hmFilterType){
      overlapDomains = new Set();
      overlapDomains.add(hmState.selectedRow);
      for(var oi=0; oi<visDomains.length; oi++){
        var od = visDomains[oi];
        if(od===hmState.selectedRow) continue;
        if(overlapCount(hmState.selectedRow, od)>0) overlapDomains.add(od);
      }
    }

    /* Y-axis label column -- UID:NNNN username (or domain name fallback).
       Font size scales with zoom but is always clamped so the glyph can
       never exceed the row it has to sit inside (rowHeight-1, capped at a
       comfortable max). Rows shorter than MIN_TEXT_ROW_H don't get text at
       all -- text there would be illegible and would bleed into neighboring
       rows -- instead we draw a thin colored tick so the category is still
       visible. Text is additionally clipped per-row as a second guard
       against bleed. */
    var BASE_LABEL_FONT_SZ = 8;
    var MAX_LABEL_FONT_SZ = 13;
    var BASE_LABEL_W = 170;
    var MIN_TEXT_ROW_H = 10; /* rows shorter than this: tick only, no text */
    var desiredLabelFontSz = Math.min(MAX_LABEL_FONT_SZ, Math.max(BASE_LABEL_FONT_SZ, BASE_LABEL_FONT_SZ*hmState.zoom));
    var showLabelText = CH >= MIN_TEXT_ROW_H;
    var labelFontSz = Math.min(desiredLabelFontSz, Math.max(1, CH-1));
    var LABEL_W = Math.max(BASE_LABEL_W, BASE_LABEL_W*hmState.zoom);
    var labelCanvas = els.labelsCanvas;
    var lctx = sizeCanvas(labelCanvas, LABEL_W, totalH);
    lctx.fillStyle = '#141428';
    lctx.fillRect(0,0,LABEL_W,totalH);
    lctx.font = labelFontSz+"px 'JetBrains Mono',Consolas,monospace";
    lctx.textBaseline = 'middle';
    var labelSpacer = els.labelSpacer;
    labelSpacer.style.height = App.HEADER_H+'px';
    els.labelsWrap.style.width = LABEL_W+'px';
    var maxLabelChars = Math.floor((LABEL_W-8) / (labelFontSz*0.6));
    var isFiltered = !!(hmState.hmFilterDomain && hmState.hmFilterType);
    for(var li=0; li<rows; li++){
      var ld = visDomains[li];
      var rowTop = li*CH;
      var ly = rowTop + CH*0.5;
      var isFilterAnchor = hmState.hmFilterDomain===ld;
      var isSel = isFilterAnchor || hmState.selectedRow===ld;
      var lCat = App.state.domainCategory[ld]||'other';
      lctx.fillStyle = isSel ? '#00fff2' : (App.CAT_COLORS[lCat]||'#8888aa');
      if(isSel) lctx.globalAlpha = 1.0;
      else lctx.globalAlpha = (overlapDomains && !overlapDomains.has(ld)) ? 0.15 : 0.85;
      if(showLabelText){
        var labelText = App.domainLabel(ld);
        if(labelText.length>maxLabelChars) labelText = labelText.substring(0,maxLabelChars-1)+'~';
        lctx.save();
        lctx.beginPath();
        lctx.rect(0, rowTop, LABEL_W, CH);
        lctx.clip();
        lctx.fillText(labelText, 4, ly);
        lctx.restore();
      } else {
        var tickH = Math.max(1, Math.min(2, CH-1));
        lctx.fillRect(4, ly-tickH/2, 14, tickH);
      }
      /* draw a cyan left-border glow on the filter anchor row label */
      if(isFilterAnchor && showLabelText){
        lctx.save();
        lctx.globalAlpha = 1.0;
        lctx.fillStyle = '#00fff2';
        lctx.fillRect(0, rowTop, 3, CH);
        lctx.restore();
      }
    }
    lctx.globalAlpha = 1.0;

    /* base data layer */
    var base = els.canvas;
    var bctx = sizeCanvas(base, totalW, totalH);
    bctx.fillStyle = '#0a0a1a';
    bctx.fillRect(0,0,totalW,totalH);

    for(var ri=0; ri<rows; ri++){
      var domain = visDomains[ri];
      var tmap = App.state.domainTypeMap[domain];
      if(!tmap) continue;
      var y = ri*CH;
      var isVisible = !overlapDomains || overlapDomains.has(domain);
      bctx.globalAlpha = isVisible ? 1.0 : 0.04;
      var segs = hmState.hmRowLayouts[ri];
      for(var si=0; si<segs.length; si++){
        var seg = segs[si];
        if(seg.isGap) continue;
        var cellCls = App.cellCategory(domain, seg.type);
        bctx.fillStyle = App.CLASS_COLORS[cellCls]||App.CLASS_COLORS.other;
        bctx.fillRect(seg.x0, y, Math.max(1,seg.w-0.4), Math.max(1,CH-0.6));
      }
    }
    bctx.globalAlpha = 1.0;

    /* category row-group divider ticks based on visible domains */
    var prevCat = null;
    for(var di=0; di<visDomains.length; di++){
      var dcat = App.state.domainCategory[visDomains[di]]||'other';
      if(dcat!==prevCat && prevCat!==null){
        bctx.fillStyle = 'rgba(224,224,255,0.35)';
        bctx.fillRect(0, di*CH, 3, 1);
      }
      prevCat = dcat;
    }

    var overlay = els.overlay;
    sizeCanvas(overlay, totalW, totalH);
    drawOverlay();
  }

  /* helper: find the segment in a row layout that covers a given type */
  function segForType(segs, type){
    for(var i=0;i<segs.length;i++){ if(segs[i].type===type) return segs[i]; }
    return null;
  }

  function drawOverlay(){
    var overlay = els.overlay;
    var dpr = window.devicePixelRatio||1;
    var ctx = overlay.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    var w = overlay.width/dpr, h = overlay.height/dpr;
    ctx.clearRect(0,0,w,h);
    var CH=ch();
    var visDomains = hmDomains();
    var visDomIdx = hmDomainIndex();
    var layouts = hmState.hmRowLayouts;

    if(hmState.hoverRow>=0 && hmState.hoverRow<visDomains.length){
      ctx.fillStyle='rgba(224,224,255,0.07)';
      ctx.fillRect(0,hmState.hoverRow*CH,w,CH);
    }

    if(hmState.jumpHighlightRow!==null && hmState.jumpHighlightRow!==undefined){
      ctx.fillStyle='rgba(0,255,242,0.22)';
      ctx.fillRect(0,hmState.jumpHighlightRow*CH,w,Math.max(2,CH));
    }

    if(hmState.selectedRow){
      var selVisRow = visDomIdx[hmState.selectedRow];
      var selSet = App.state.domainTypeSet[hmState.selectedRow];
      var selSegs = (selVisRow!==undefined && layouts) ? layouts[selVisRow] : null;
      if(selSet && layouts){
        var maxPossible = Math.max(1,selSet.size);
        /* build a type->segment lookup for the selected row */
        var selSegByType = {};
        if(selSegs){
          for(var ssi=0;ssi<selSegs.length;ssi++){
            if(!selSegs[ssi].isGap) selSegByType[selSegs[ssi].type] = selSegs[ssi];
          }
        }
        for(var ri=0; ri<visDomains.length; ri++){
          if(ri===selVisRow) continue;
          var d = visDomains[ri];
          var oc = overlapCount(hmState.selectedRow,d);
          if(oc>0){
            var alpha = Math.min(0.85, 0.2+(oc/maxPossible)*0.65);
            ctx.fillStyle='rgba(255,0,255,'+alpha.toFixed(3)+')';
            ctx.fillRect(0, ri*CH, 5, Math.max(1,CH-0.5));
            /* highlight shared grant segments + draw connectors */
            var rowSegs = layouts[ri];
            if(rowSegs){
              for(var si=0;si<rowSegs.length;si++){
                var seg = rowSegs[si];
                if(seg.isGap) continue;
                if(!selSet.has(seg.type)) continue;
                /* highlight the shared cell */
                ctx.fillStyle='rgba(0,255,242,0.18)';
                ctx.fillRect(seg.x0, ri*CH, seg.w, CH);
                ctx.strokeStyle='rgba(0,255,242,0.5)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(seg.x0+0.5, ri*CH+0.5, seg.w-1, CH-1);
                /* draw connector line from selected row cell to this cell */
                var sSeg = selSegByType[seg.type];
                if(sSeg){
                  var sx = sSeg.x0 + sSeg.w*0.5;
                  var tx = seg.x0 + seg.w*0.5;
                  var sy = selVisRow < ri ? (selVisRow+1)*CH : selVisRow*CH;
                  var ty = selVisRow < ri ? ri*CH : (ri+1)*CH;
                  ctx.strokeStyle='rgba(0,255,242,0.14)';
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.moveTo(sx, sy);
                  ctx.lineTo(tx, ty);
                  ctx.stroke();
                }
              }
            }
          }
        }
      }
      if(selVisRow!==undefined){
        /* bright selected row highlight */
        ctx.fillStyle='rgba(0,255,242,0.2)';
        ctx.fillRect(0,selVisRow*CH,w,CH);
        ctx.strokeStyle='#00fff2'; ctx.lineWidth=1.5;
        ctx.strokeRect(0.5,selVisRow*CH+0.5,w-1,Math.max(1,CH-1));
        /* highlight selected row's own cells with a glow border */
        if(selSegs){
          for(var sgi=0;sgi<selSegs.length;sgi++){
            if(selSegs[sgi].isGap) continue;
            ctx.strokeStyle='rgba(0,255,242,0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(selSegs[sgi].x0+0.5, selVisRow*CH+0.5, selSegs[sgi].w-1, CH-1);
          }
        }
      }
    }

    if(hmState.compareRow){
      var cVisRow = visDomIdx[hmState.compareRow];
      if(cVisRow!==undefined){
        ctx.fillStyle='rgba(255,0,255,0.16)';
        ctx.fillRect(0,cVisRow*CH,w,CH);
        ctx.strokeStyle='#ff00ff'; ctx.lineWidth=1;
        ctx.strokeRect(0.5,cVisRow*CH+0.5,w-1,Math.max(1,CH-1));
      }
    }
  }

  function setZoom(z){
    hmState.zoom = Math.max(App.MIN_ZOOM, Math.min(App.MAX_ZOOM, z));
    els.zoomLevel.textContent = Math.round(hmState.zoom*100)+'%';
    drawHeatmapAll();
  }

  /* ============================================================
     Tooltip HTML builder
     source: monolith line 1832
     ============================================================ */
  function tooltipForCell(domain,type,entries){
    var html = '<span class="tt-title">'+App.escapeHTML(domain)+'</span>';
    if(type && entries){
      html += '<div>&rarr; '+App.escapeHTML(type)+'</div>';
      entries.forEach(function(en){
        html += '<span class="tt-class">'+App.escapeHTML(en.c)+':</span> ';
        html += en.p.slice(0,6).map(App.permBadgeHTML).join(' ');
        if(en.p.length>6) html += ' <span class="tt-class">+'+(en.p.length-6)+' more</span>';
      });
    } else {
      var rc = App.state.domainRuleCounts[domain]||0;
      html += '<div style="color:var(--text2);font-size:10px;">'+App.fmtNum(rc)+' rules &middot; '+App.CAT_LABELS[App.state.domainCategory[domain]||'other']+'</div>';
    }
    return html;
  }

  /* ============================================================
     Cell detail popup
     source: monolith line 1851
     ============================================================ */
  function showCellPopup(domain,type,clientX,clientY){
    var pop = els.popup;
    var entries = App.state.domainTypeMap[domain] && App.state.domainTypeMap[domain][type];
    if(!entries) return;
    var body = els.popupBody;
    body.innerHTML = '';
    entries.forEach(function(en){
      var block = App.el('div','cpb-class');
      block.appendChild(App.el('span','cpb-class-name',App.escapeHTML(en.c)+' <span style="color:var(--text2)">('+en.p.length+')</span>'));
      var permsWrap = App.el('div','',en.p.map(App.permBadgeHTML).join(' '));
      block.appendChild(permsWrap);
      body.appendChild(block);
    });
    els.popupTitle.textContent = domain+' -> '+type;
    els.popupGotoReverse.onclick = function(){ hideCellPopup(); if(App.openReverse) App.openReverse(type); };
    els.popupGotoGraph.onclick = function(){ hideCellPopup(); if(App.openGraphView) App.openGraphView(domain); };
    pop.classList.remove('hidden');
    var pw = 320, ph = pop.offsetHeight||240;
    var x = clientX+14, y = clientY+14;
    if(x+pw>window.innerWidth) x = window.innerWidth-pw-10;
    if(y+ph>window.innerHeight) y = window.innerHeight-ph-10;
    pop.style.left = Math.max(4,x)+'px';
    pop.style.top = Math.max(4,y)+'px';
  }
  function hideCellPopup(){
    els.popup.classList.add('hidden');
  }

  /* ============================================================
     Heatmap mouse interaction
     source: monolith line ~1882
     ============================================================ */
  function rowFromEvent(e){
    return Math.floor(e.offsetY/ch());
  }
  /* hit-test a row's RLE layout to find which type (if any) is at pixel x */
  function typeAtRowX(row, px){
    var layouts = hmState.hmRowLayouts;
    if(!layouts || row<0 || row>=layouts.length) return null;
    var segs = layouts[row];
    for(var i=0;i<segs.length;i++){
      var s = segs[i];
      if(px>=s.x0 && px<s.x0+s.w){
        return s.isGap ? null : s.type;
      }
    }
    return null;
  }

  function onBodyMouseMove(e){
    var visDom = hmDomains();
    var row = rowFromEvent(e);
    if(row<0||row>=visDom.length){
      if(hmState.hoverRow!==-1){ hmState.hoverRow=-1; drawOverlay(); }
      App.tooltip.hide();
      return;
    }
    if(row!==hmState.hoverRow){ hmState.hoverRow=row; drawOverlay(); }
    var domain = visDom[row];
    var type = typeAtRowX(row, e.offsetX);
    var entries = type ? (App.state.domainTypeMap[domain] && App.state.domainTypeMap[domain][type]) : null;
    if(entries){
      App.tooltip.show(e.clientX,e.clientY,tooltipForCell(domain,type,entries));
    } else {
      App.tooltip.hide();
    }
  }
  function onBodyMouseLeave(){
    if(hmState.hoverRow!==-1){ hmState.hoverRow=-1; drawOverlay(); }
    App.tooltip.hide();
  }
  function onBodyClick(e){
    var visDom = hmDomains();
    var row = rowFromEvent(e);
    if(row<0||row>=visDom.length) return;
    var domain = visDom[row];
    var type = typeAtRowX(row, e.offsetX);
    var entries = type ? (App.state.domainTypeMap[domain] && App.state.domainTypeMap[domain][type]) : null;

    /* ---- filter-aware click logic ---- */
    if(hmState.hmFilterDomain){
      /* A filter anchor is active */
      if(domain===hmState.hmFilterDomain && type){
        /* Clicked a cell in the anchor row -> filter (or re-filter) by this type */
        hmState.hmFilterType = type;
        computeHeatmapVisibleSets();
        drawHeatmapAll();
        updateFilterUI();
        updateFilterStats();
        if(entries){ showCellPopup(domain,type,e.clientX,e.clientY); }
        return;
      }
      /* Clicked a cell on a non-anchor row -> just show popup */
      if(entries){ showCellPopup(domain,type,e.clientX,e.clientY); }
      return;
    }

    /* ---- No filter active: legacy selection behavior ---- */
    if(e.shiftKey && hmState.selectedRow && hmState.selectedRow!==domain){
      hmState.compareRow = domain;
      updateSelectionUI();
      drawHeatmapAll();
    } else if(hmState.selectedRow===domain){
      hmState.selectedRow = null; hmState.compareRow = null;
      updateSelectionUI();
      drawHeatmapAll();
    } else {
      hmState.selectedRow = domain;
      if(hmState.compareRow===domain) hmState.compareRow=null;
      updateSelectionUI();
      drawHeatmapAll();
    }

    if(entries){ showCellPopup(domain,type,e.clientX,e.clientY); }
  }

  function onHeaderMouseMove(e){ App.tooltip.hide(); }
  function onHeaderMouseLeave(){ App.tooltip.hide(); }
  function onHeaderClick(e){ }

  function updateSelectionUI(){
    var info = els.selectionInfo;
    var btnGraph = els.btnGraphView;
    var btnCompare = els.btnCompareView;
    var btnClear = els.btnClearSelection;
    if(hmState.selectedRow && hmState.compareRow){
      info.textContent = hmState.selectedRow+' vs '+hmState.compareRow+' (shared: '+overlapCount(hmState.selectedRow,hmState.compareRow)+')';
      btnGraph.classList.add('hidden');
      btnCompare.classList.remove('hidden');
      btnClear.classList.remove('hidden');
    } else if(hmState.selectedRow){
      var rc = App.state.domainRuleCounts[hmState.selectedRow]||0;
      var selSet = App.state.domainTypeSet[hmState.selectedRow];
      var overlapN = 0;
      var visDom = hmDomains();
      if(selSet){
        for(var oi=0;oi<visDom.length;oi++){
          if(visDom[oi]!==hmState.selectedRow && overlapCount(hmState.selectedRow,visDom[oi])>0) overlapN++;
        }
      }
      info.textContent = hmState.selectedRow+' selected ('+App.fmtNum(rc)+' rules) -- showing '+App.fmtNum(overlapN)+' overlapping domains -- shift-click a row to compare';
      btnGraph.classList.remove('hidden');
      btnCompare.classList.add('hidden');
      btnClear.classList.remove('hidden');
    } else {
      info.textContent = '';
      btnGraph.classList.add('hidden');
      btnCompare.classList.add('hidden');
      btnClear.classList.add('hidden');
    }
    updateFilterUI();
  }
  function clearHeatmapSelection(){
    hmState.selectedRow=null; hmState.compareRow=null;
    clearHeatmapFilter();
  }

  /* ============================================================
     Heatmap filter interaction (label-click -> cell-click)
     source: monolith line 2010
     ============================================================ */
  function onLabelClick(e){
    var row = Math.floor(e.offsetY / ch());
    var visDom = hmDomains();
    if(row<0 || row>=visDom.length) return;
    var domain = visDom[row];

    if(hmState.hmFilterDomain===domain){
      /* clicking the selected label again = clear filter */
      clearHeatmapFilter();
      return;
    }
    /* select this domain as the filter anchor */
    hmState.hmFilterDomain = domain;
    hmState.hmFilterType = null;
    hmState.selectedRow = domain;
    hmState.compareRow = null;
    computeHeatmapVisibleSets();
    drawHeatmapAll();
    updateFilterUI();
    updateFilterStats();
    /* scroll so the selected domain is at the top */
    var scroll = els.scroll;
    scroll.scrollTop = 0;
  }

  function clearHeatmapFilter(){
    hmState.hmFilterDomain = null;
    hmState.hmFilterType = null;
    hmState.selectedRow = null;
    hmState.compareRow = null;
    computeHeatmapVisibleSets();
    drawHeatmapAll();
    updateFilterUI();
    updateFilterStats();
    updateSelectionUI();
  }

  function updateFilterUI(){
    var statusbar = els.statusbar;
    var clearBtn = els.btnClearSelection;
    var modeBtn = els.btnFilterMode;

    if(hmState.hmFilterDomain && hmState.hmFilterType){
      var matchCount = hmDomains().length - 1;
      var label = App.domainLabel(hmState.hmFilterDomain);
      statusbar.textContent = 'FILTERED: '+label+' -> '+hmState.hmFilterType+' ('+hmState.hmFilterMode.toUpperCase()+' mode) -- '+matchCount+' matching UIDs';
      clearBtn.classList.remove('hidden');
      if(modeBtn) modeBtn.classList.remove('hidden');
    } else if(hmState.hmFilterDomain){
      statusbar.textContent = 'SELECTED: '+App.domainLabel(hmState.hmFilterDomain)+' -- click a cell in this row to filter by target type';
      clearBtn.classList.remove('hidden');
      if(modeBtn) modeBtn.classList.add('hidden');
    } else {
      statusbar.textContent = 'hover a cell to inspect · click a Y-axis label = select UID · click a cell in selected row = filter by target type · click selected label again = clear';
      clearBtn.classList.add('hidden');
      if(modeBtn) modeBtn.classList.add('hidden');
    }
  }

  /* ============================================================
     Legend rendering
     source: monolith line ~3095
     ============================================================ */
  function renderLegend(targetId){
    var legend = document.getElementById(targetId);
    if(!legend) return;
    legend.innerHTML='';
    var order = ['file','chr_file','blk_file','process','capability','binder','service_manager','hwservice_manager','unix_stream_socket','tcp_socket','fifo_file','keystore2_key','security','perf_event','other'];
    var labels = {file:'file/dir',chr_file:'chr_file',blk_file:'blk_file',process:'process',capability:'capability',binder:'binder',service_manager:'svc_mgr',hwservice_manager:'hw_svc_mgr',unix_stream_socket:'unix_sock',tcp_socket:'tcp_sock',fifo_file:'fifo',keystore2_key:'keystore',security:'security',perf_event:'perf_event',other:'other'};
    order.forEach(function(cat){
      var sw = App.el('span','legend-swatch');
      sw.style.cursor = 'pointer';
      sw.innerHTML = '<span class="legend-dot" style="background:'+App.CLASS_COLORS[cat]+';color:'+App.CLASS_COLORS[cat]+'"></span>'+labels[cat];
      sw.addEventListener('click', function(){
        if(App.state.tmClassFilter===cat){ App.state.tmClassFilter=null; }
        else { App.state.tmClassFilter=cat; }
        updateLegendHighlight(targetId);
        if(App.activeView==='treemap'){
          if(App.computeTreemapLayout) App.computeTreemapLayout();
          if(App.drawTreemap) App.drawTreemap();
        }
      });
      sw.dataset.cls = cat;
      legend.appendChild(sw);
    });
  }
  function updateLegendHighlight(targetId){
    var legend = document.getElementById(targetId);
    if(!legend) return;
    var swatches = legend.querySelectorAll('.legend-swatch');
    for(var i=0;i<swatches.length;i++){
      var s = swatches[i];
      if(App.state.tmClassFilter && s.dataset.cls!==App.state.tmClassFilter){
        s.style.opacity='0.25';
      } else {
        s.style.opacity='1';
      }
    }
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createHeatmap(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (toolbar, labels, canvases, statusbar) inside container */
    var root = App.el('div','heatmap-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.legend = root.querySelector('#heatmap-legend');
    els.selectionInfo = root.querySelector('#heatmap-selection-info');
    els.btnGraphView = root.querySelector('#btn-graph-view');
    els.btnCompareView = root.querySelector('#btn-compare-view');
    els.btnClearSelection = root.querySelector('#btn-clear-heatmap-selection');
    els.btnFilterMode = root.querySelector('#btn-hm-filter-mode');
    els.chkHideCommon = root.querySelector('#chk-hide-common');
    els.filterStats = root.querySelector('#hm-filter-stats');
    els.btnZoomOut = root.querySelector('#btn-zoom-out');
    els.zoomLevel = root.querySelector('#zoom-level');
    els.btnZoomIn = root.querySelector('#btn-zoom-in');
    els.outer = root.querySelector('#heatmap-outer');
    els.labelsWrap = root.querySelector('#heatmap-labels-wrap');
    els.labelSpacer = root.querySelector('.hm-label-spacer');
    els.labelsCanvas = root.querySelector('#heatmap-labels');
    els.scroll = root.querySelector('#heatmap-scroll');
    els.stage = root.querySelector('#heatmap-stage');
    els.headerCanvas = root.querySelector('#heatmap-header');
    els.bodyWrap = root.querySelector('#heatmap-body-wrap');
    els.canvas = root.querySelector('#heatmap-canvas');
    els.overlay = root.querySelector('#heatmap-overlay');
    els.statusbar = root.querySelector('#heatmap-statusbar');

    /* cell-popup is a floating, fixed-position element -- lives at body level,
       same as the monolith's popup (defined as a body-level sibling, not
       nested inside the heatmap view section) */
    els.popup = App.el('div','cell-popup hidden');
    els.popup.id = 'cell-popup';
    els.popup.innerHTML = POPUP_TEMPLATE;
    document.body.appendChild(els.popup);
    els.popupTitle = els.popup.querySelector('#cell-popup-title');
    els.popupBody = els.popup.querySelector('#cell-popup-body');
    els.popupGotoReverse = els.popup.querySelector('#cell-popup-goto-reverse');
    els.popupGotoGraph = els.popup.querySelector('#cell-popup-goto-graph');
    els.popupClose = els.popup.querySelector('.cell-popup-close');

    /* 3. Wire event listeners on the created elements */
    els.bodyWrap.addEventListener('mousemove', onBodyMouseMove);
    els.bodyWrap.addEventListener('mouseleave', onBodyMouseLeave);
    els.bodyWrap.addEventListener('click', onBodyClick);

    els.headerCanvas.addEventListener('mousemove', onHeaderMouseMove);
    els.headerCanvas.addEventListener('mouseleave', onHeaderMouseLeave);
    els.headerCanvas.addEventListener('click', onHeaderClick);

    els.btnZoomIn.addEventListener('click', function(){ setZoom(hmState.zoom*App.ZOOM_STEP); });
    els.btnZoomOut.addEventListener('click', function(){ setZoom(hmState.zoom/App.ZOOM_STEP); });
    els.btnClearSelection.addEventListener('click', clearHeatmapSelection);
    els.btnGraphView.addEventListener('click', function(){ if(hmState.selectedRow && App.openGraphView) App.openGraphView(hmState.selectedRow); });
    els.btnCompareView.addEventListener('click', function(){ if(hmState.selectedRow && hmState.compareRow && App.openCompareView) App.openCompareView(hmState.selectedRow,hmState.compareRow); });

    /* label Y-axis click -> select filter anchor */
    els.labelsCanvas.addEventListener('click', onLabelClick);

    /* EXACT / OVERLAP mode toggle */
    els.btnFilterMode.addEventListener('click', function(){
      hmState.hmFilterMode = hmState.hmFilterMode==='overlap' ? 'exact' : 'overlap';
      this.textContent = hmState.hmFilterMode.toUpperCase();
      if(hmState.hmFilterDomain && hmState.hmFilterType){
        computeHeatmapVisibleSets();
        drawHeatmapAll();
        updateFilterUI();
        updateFilterStats();
      }
    });

    els.wheelHandler = function(e){
      if(e.ctrlKey || e.metaKey){
        e.preventDefault();
        setZoom(hmState.zoom * (e.deltaY<0?App.ZOOM_STEP:1/App.ZOOM_STEP));
      }
    };
    els.scroll.addEventListener('wheel', els.wheelHandler, {passive:false});

    /* sync label column vertical scroll with heatmap data scroll */
    els.scrollHandler = function(){
      var labelsCanvas = els.labelsCanvas;
      if(labelsCanvas) labelsCanvas.style.marginTop = (-els.scroll.scrollTop)+'px';
    };
    els.scroll.addEventListener('scroll', els.scrollHandler);

    /* heatmap noise filter toggle */
    els.chkHideCommon.addEventListener('change', function(){
      hmState.hideCommon = this.checked;
      computeFilteredTypes();
      updateFilterStats();
      drawHeatmapAll();
    });

    els.popupClose.addEventListener('click', hideCellPopup);

    els.keydownHandler = function(e){ if(e.key==='Escape') hideCellPopup(); };
    document.addEventListener('keydown', els.keydownHandler);

    els.docClickHandler = function(e){
      var pop = els.popup;
      if(!pop.classList.contains('hidden') && !pop.contains(e.target)){
        var insideBody = e.target.closest && e.target.closest('#heatmap-body-wrap');
        if(!insideBody) hideCellPopup();
      }
    };
    document.addEventListener('click', els.docClickHandler);

    /* 4. Compute initial data (computeFilteredTypes, etc.) */
    renderLegend('heatmap-legend');
    computeFilteredTypes();
    updateFilterStats();
    hmState.selectedRow = null;
    hmState.compareRow = null;

    /* 5. Draw */
    setZoom(1);
    updateSelectionUI();
  }

  function destroyHeatmap(){
    /* Remove event listeners */
    if(els.bodyWrap){
      els.bodyWrap.removeEventListener('mousemove', onBodyMouseMove);
      els.bodyWrap.removeEventListener('mouseleave', onBodyMouseLeave);
      els.bodyWrap.removeEventListener('click', onBodyClick);
    }
    if(els.headerCanvas){
      els.headerCanvas.removeEventListener('mousemove', onHeaderMouseMove);
      els.headerCanvas.removeEventListener('mouseleave', onHeaderMouseLeave);
      els.headerCanvas.removeEventListener('click', onHeaderClick);
    }
    if(els.scroll){
      if(els.wheelHandler) els.scroll.removeEventListener('wheel', els.wheelHandler);
      if(els.scrollHandler) els.scroll.removeEventListener('scroll', els.scrollHandler);
    }
    if(els.keydownHandler) document.removeEventListener('keydown', els.keydownHandler);
    if(els.docClickHandler) document.removeEventListener('click', els.docClickHandler);

    if(els.popup && els.popup.parentNode) els.popup.parentNode.removeChild(els.popup);
    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Clear local state */
    hmState.selectedRow = null;
    hmState.compareRow = null;
    hmState.hoverRow = -1;
    hmState.hoverCol = -1;
    hmState.jumpHighlightRow = null;
    hmState.jumpHighlightCol = null;
    hmState.hmFilterDomain = null;
    hmState.hmFilterType = null;
    hmState.hmRowLayouts = null;
  }

  App.registerView('heatmap', {
    label: 'HEATMAP',
    icon: '▦',
    create: createHeatmap,
    destroy: destroyHeatmap,
    onResize: function(){ if(App.data) drawHeatmapAll(); }
  });
})();
