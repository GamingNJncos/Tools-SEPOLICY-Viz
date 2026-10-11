/* dontaudit-shadow.js -- allow/dontaudit overlap heatmap view, ported from
   sepolicy_viz/views/dontaudit-shadow.html standalone (816 lines) */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: standalone lines ~88-235 (toolbar/legend/grid/tooltip-content
     rules). :root/body/scrollbar/button/input/drop-zone/#app and the
     #tooltip positioning box are NOT ported -- those are already owned by
     the v2 shell (css/theme.css) and App.tooltip.
     ============================================================ */
  var CSS = ''
    + '.dontaudit-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));padding:0;}'
    + '#toolbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 16px;background:rgba(10,10,26,0.95);border-bottom:1px solid var(--border);box-shadow:0 0 20px rgba(0,255,242,0.06);flex:0 0 auto;}'
    + '#title-block{display:flex;flex-direction:column;gap:1px;margin-right:6px;}'
    + '#title-block .t1{color:var(--cyan);font-weight:700;font-size:14px;letter-spacing:.5px;text-shadow:0 0 8px rgba(0,255,242,0.5);}'
    + '#title-block .t2{color:var(--text2);font-size:10px;letter-spacing:.5px;}'
    + '.divider{width:1px;align-self:stretch;background:var(--border);margin:2px 2px;}'
    + '.tool-group{display:flex;align-items:center;gap:6px;}'
    + '.btn{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 10px;font-size:11px;letter-spacing:.5px;border-radius:3px;cursor:pointer;transition:border-color .12s,color .12s,box-shadow .12s;}'
    + '.btn:hover{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 10px rgba(0,255,242,0.2);}'
    + '.btn:active{transform:translateY(1px);}'
    + '#zoom-pct{color:var(--text2);font-size:11px;min-width:44px;text-align:center;}'
    + '.chk-wrap{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);cursor:pointer;user-select:none;}'
    + '.chk-wrap input{accent-color:var(--cyan);cursor:pointer;}'
    + '#stats{margin-left:auto;display:flex;gap:16px;flex-wrap:wrap;font-size:10px;color:var(--text2);}'
    + '#stats span b{color:var(--cyan);font-weight:700;}'
    + '#stats span.hot b{color:var(--red);}'
    + '#legend{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:6px 16px;background:var(--surface);border-bottom:1px solid var(--border);font-size:10px;color:var(--text2);flex:0 0 auto;}'
    + '.leg-item{display:flex;align-items:center;gap:6px;}'
    + '.leg-swatch{width:16px;height:16px;border:1px solid var(--border);border-radius:2px;flex:0 0 auto;}'
    + '.sw-allow{background:rgba(0,255,242,0.4);}'
    + '.sw-empty{background:var(--bg);}'
    + '.sw-dontaudit,.sw-both{background-image:repeating-linear-gradient(45deg,var(--red) 0 2px,transparent 2px 6px);}'
    + '.sw-dontaudit{background-color:var(--surface2);}'
    + '.sw-both{background-color:rgba(0,255,242,0.4);}'
    + '#grid-scroll{flex:1;min-height:0;overflow:auto;position:relative;background:var(--bg);}'
    + '#grid-content{position:relative;}'
    + '#col-headers{position:sticky;top:0;left:0;z-index:3;background:var(--bg);border-bottom:1px solid var(--border);}'
    + '.col-label{position:absolute;bottom:3px;transform-origin:left bottom;transform:rotate(-45deg);white-space:nowrap;font-size:9px;color:var(--text2);pointer-events:none;}'
    + '.col-label.hot{color:var(--red);}'
    + '.col-label.hi{color:var(--cyan);text-shadow:0 0 6px rgba(0,255,242,0.6);}'
    + '#row-labels{position:sticky;left:0;top:0;z-index:3;background:var(--bg);border-right:1px solid var(--border);}'
    + '.row-label{position:absolute;left:0;right:0;display:flex;align-items:center;gap:5px;padding:0 8px;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.03);}'
    + '.row-label .rl-cat{width:4px;align-self:stretch;flex:0 0 auto;border-radius:2px;}'
    + '.row-label .rl-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;color:var(--text);}'
    + '.row-label .rl-count{flex:0 0 auto;font-size:9px;color:var(--red);font-weight:700;min-width:20px;text-align:right;}'
    + '.row-label.hi{background:rgba(0,255,242,0.06);}'
    + '.row-label.hi .rl-name{color:var(--cyan);}'
    + '#corner{position:sticky;top:0;left:0;z-index:5;background:var(--bg);border-right:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;align-items:flex-end;justify-content:flex-start;padding:4px 6px;font-size:9px;color:var(--text2);}'
    + '#heat-canvas{position:absolute;cursor:crosshair;image-rendering:auto;}'
    + '#empty-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text2);font-size:12px;text-align:center;display:none;}'
    + '#tooltip .tt-title{color:var(--cyan);font-weight:700;margin-bottom:6px;font-size:12px;word-break:break-all;}'
    + '#tooltip .tt-row{display:flex;gap:6px;margin-bottom:3px;}'
    + '#tooltip .tt-key{color:var(--text2);flex:0 0 auto;min-width:64px;}'
    + '#tooltip .tt-val{color:var(--text);word-break:break-word;}'
    + '#tooltip .tt-sec{margin-top:6px;padding-top:6px;border-top:1px solid var(--border);}'
    + '#tooltip .tt-sec.allow{color:var(--cyan);}'
    + '#tooltip .tt-sec.dontaudit{color:var(--red);}'
    + '#tooltip .tt-sec .hdr{font-weight:700;letter-spacing:.5px;margin-bottom:3px;}'
    + '#tooltip .tt-entry{color:var(--text);font-size:10px;margin-bottom:2px;}'
    + '#tooltip .tt-entry .cls{color:var(--amber);}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from standalone markup lines ~256-290 --
     drop-zone / file-input / "LOAD NEW FILE" button removed since file
     loading is owned by the v2 shell, not per-view)
     ============================================================ */
  var TEMPLATE = ''
    + '<div id="toolbar">'
    +   '<div id="title-block">'
    +     '<div class="t1">DONTAUDIT SHADOW</div>'
    +     '<div class="t2">allow / dontaudit overlap matrix</div>'
    +   '</div>'
    +   '<div class="divider"></div>'
    +   '<div class="tool-group">'
    +     '<button class="btn" id="btn-zoom-out" title="Zoom out">&minus;</button>'
    +     '<span id="zoom-pct">100%</span>'
    +     '<button class="btn" id="btn-zoom-in" title="Zoom in">&plus;</button>'
    +     '<button class="btn" id="btn-zoom-reset" title="Reset zoom">RESET</button>'
    +   '</div>'
    +   '<div class="divider"></div>'
    +   '<label class="chk-wrap"><input type="checkbox" id="chk-show-allow" checked> SHOW ALLOW-ONLY</label>'
    +   '<div id="stats"></div>'
    + '</div>'
    + '<div id="legend">'
    +   '<div class="leg-item"><div class="leg-swatch sw-allow"></div>ALLOW ONLY &mdash; normal grant</div>'
    +   '<div class="leg-item"><div class="leg-swatch sw-dontaudit"></div>DONTAUDIT ONLY &mdash; invisible wall, no AVC logged</div>'
    +   '<div class="leg-item"><div class="leg-swatch sw-both"></div>BOTH &mdash; suspicious: granted AND hidden</div>'
    +   '<div class="leg-item"><div class="leg-swatch sw-empty"></div>NO RULE</div>'
    + '</div>'
    + '<div id="grid-scroll">'
    +   '<div id="grid-content">'
    +     '<div id="col-headers"></div>'
    +     '<div id="row-labels"></div>'
    +     '<div id="corner">domain \\ target</div>'
    +     '<canvas id="heat-canvas"></canvas>'
    +     '<div id="empty-msg"></div>'
    +   '</div>'
    + '</div>';

  /* ============================================================
     Local constants / state (replaces standalone's top-level S object)
     source: standalone lines 298-322
     ============================================================ */
  var LABEL_W = 190;
  var HEADER_H = 130;
  var MIN_CS = 3;
  var MAX_CS = 36;
  var DEFAULT_CS = 10;

  var CAT_COLORS = {app:'#2288ff',vendor:'#ffaa00',hal:'#44ddaa',system:'#ff6622',shell:'#b967ff',core:'#ff3355'};

  var S = {
    cellSize: DEFAULT_CS,
    rows: [],          // [{domain, count, cat}]
    cols: [],          // [{target, count}]
    rowIndex: {},       // domain -> i
    colIndex: {},        // target -> j
    grid: [],           // grid[i][j] = null | {a:[{c,p}], d:[{c,p}]}
    showAllowOnly: true,
    overlaps: 0,
    totalDontaudit: 0,
    rowLabelEls: [],
    colLabelEls: [],
    hoverRow: -1,
    hoverCol: -1,
    stripePattern: null,
    stripePatternCS: -1
  };

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text!=null) e.textContent = text;
    return e;
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ============================================================
     Data -> grid model
     source: standalone line 403 (initFromData). File-drop parsing
     removed -- reads the already-loaded/indexed App.data instead of a
     FileReader result.
     ============================================================ */
  function initFromData(){
    var data = App.data || {};
    var rules = data.rules || [];
    var dontaudit = data.dontaudit_rules || [];
    var categories = data.categories || {};

    var catOf = {};
    Object.keys(categories).forEach(function(cat){
      (categories[cat]||[]).forEach(function(d){ catOf[d] = cat; });
    });

    var daCountByDomain = {};
    dontaudit.forEach(function(r){
      daCountByDomain[r.s] = (daCountByDomain[r.s]||0) + 1;
    });

    var visibleDomains = Object.keys(daCountByDomain).filter(function(d){
      return daCountByDomain[d] > 0;
    });
    visibleDomains.sort(function(a,b){
      var diff = daCountByDomain[b] - daCountByDomain[a];
      if(diff !== 0) return diff;
      return a < b ? -1 : (a > b ? 1 : 0);
    });

    var visibleSet = {};
    visibleDomains.forEach(function(d){ visibleSet[d] = true; });

    var daCountByTarget = {};
    var colSet = {};
    rules.forEach(function(r){
      if(visibleSet[r.s]){ colSet[r.t] = true; }
    });
    dontaudit.forEach(function(r){
      if(visibleSet[r.s]){
        colSet[r.t] = true;
        daCountByTarget[r.t] = (daCountByTarget[r.t]||0) + 1;
      }
    });
    var cols = Object.keys(colSet);
    cols.sort(function(a,b){
      var diff = (daCountByTarget[b]||0) - (daCountByTarget[a]||0);
      if(diff !== 0) return diff;
      return a < b ? -1 : (a > b ? 1 : 0);
    });

    var rowIndex = {}, colIndex = {};
    visibleDomains.forEach(function(d,i){ rowIndex[d]=i; });
    cols.forEach(function(t,j){ colIndex[t]=j; });

    var grid = new Array(visibleDomains.length);
    for(var i=0;i<grid.length;i++) grid[i] = new Array(cols.length).fill(null);

    rules.forEach(function(r){
      var i = rowIndex[r.s], j = colIndex[r.t];
      if(i===undefined || j===undefined) return;
      var cell = grid[i][j];
      if(!cell){ cell = {a:[], d:[]}; grid[i][j] = cell; }
      cell.a.push({c:r.c, p:r.p||[]});
    });

    var overlaps = 0;
    dontaudit.forEach(function(r){
      var i = rowIndex[r.s], j = colIndex[r.t];
      if(i===undefined || j===undefined) return;
      var cell = grid[i][j];
      if(!cell){ cell = {a:[], d:[]}; grid[i][j] = cell; }
      if(cell.d.length===0 && cell.a.length>0) overlaps++;
      else if(cell.d.length===0 && cell.a.length===0){ /* pure dontaudit, no overlap */ }
      cell.d.push({c:r.c, p:r.p||[]});
    });
    /* recompute overlaps cleanly: cell counts as overlap if it has both a and d entries */
    overlaps = 0;
    for(var oi=0; oi<grid.length; oi++){
      for(var oj=0; oj<grid[oi].length; oj++){
        var c = grid[oi][oj];
        if(c && c.a.length>0 && c.d.length>0) overlaps++;
      }
    }

    S.rows = visibleDomains.map(function(d){
      return {domain:d, count:daCountByDomain[d]||0, cat:catOf[d]||''};
    });
    S.cols = cols.map(function(t){
      return {target:t, count:daCountByTarget[t]||0};
    });
    S.rowIndex = rowIndex;
    S.colIndex = colIndex;
    S.grid = grid;
    S.overlaps = overlaps;
    S.totalDontaudit = dontaudit.length;
    S.cellSize = DEFAULT_CS;

    buildLabels();
    layout();
    updateStats();
  }

  /* ============================================================
     Labels (D3 data join)
     source: standalone line 506
     ============================================================ */
  function buildLabels(){
    var rowLabelsWrap = d3.select(els.rowLabels);
    var rowSel = rowLabelsWrap.selectAll('.row-label').data(S.rows, function(d){return d.domain;});
    rowSel.exit().remove();
    var rowEnter = rowSel.enter().append('div').attr('class','row-label');
    rowEnter.append('div').attr('class','rl-cat');
    rowEnter.append('div').attr('class','rl-name');
    rowEnter.append('div').attr('class','rl-count');
    var rowMerged = rowEnter.merge(rowSel);
    rowMerged.each(function(d){
      var g = d3.select(this);
      g.select('.rl-cat').style('background', CAT_COLORS[d.cat] || 'var(--border)');
      g.select('.rl-name').text(d.domain).attr('title', d.domain);
      g.select('.rl-count').text(d.count);
    });
    S.rowLabelEls = rowMerged.nodes();

    var colHeadersWrap = d3.select(els.colHeaders);
    var colSel = colHeadersWrap.selectAll('.col-label').data(S.cols, function(d){return d.target;});
    colSel.exit().remove();
    var colEnter = colSel.enter().append('div').attr('class','col-label');
    var colMerged = colEnter.merge(colSel);
    colMerged.text(function(d){ return d.target; })
      .attr('title', function(d){ return d.target; })
      .classed('hot', function(d){ return d.count>0; });
    S.colLabelEls = colMerged.nodes();
  }

  function repositionLabels(){
    var cs = S.cellSize;
    var showText = cs >= 7;
    for(var i=0;i<S.rowLabelEls.length;i++){
      var re = S.rowLabelEls[i];
      re.style.top = (HEADER_H + i*cs) + 'px';
      re.style.height = cs + 'px';
      re.style.lineHeight = cs + 'px';
      re.style.visibility = showText ? 'visible' : 'hidden';
    }
    var showCol = cs >= 5;
    for(var j=0;j<S.colLabelEls.length;j++){
      var ce = S.colLabelEls[j];
      ce.style.left = (LABEL_W + j*cs + cs/2) + 'px';
      ce.style.visibility = showCol ? 'visible' : 'hidden';
    }
  }

  /* ============================================================
     Layout / sizing
     source: standalone line 555
     ============================================================ */
  function layout(){
    var cs = S.cellSize;
    var totalW = LABEL_W + S.cols.length*cs;
    var totalH = HEADER_H + S.rows.length*cs;

    els.gridContent.style.width = totalW + 'px';
    els.gridContent.style.height = totalH + 'px';

    els.colHeaders.style.width = totalW + 'px';
    els.colHeaders.style.height = HEADER_H + 'px';

    els.rowLabels.style.width = LABEL_W + 'px';
    els.rowLabels.style.height = totalH + 'px';

    els.corner.style.width = LABEL_W + 'px';
    els.corner.style.height = HEADER_H + 'px';

    if(S.rows.length===0){
      els.emptyMsg.style.display = 'block';
      els.emptyMsg.textContent = 'No domains with dontaudit rules found in this policy.';
    }else{
      els.emptyMsg.style.display = 'none';
    }

    repositionLabels();
    drawCanvas();
  }

  /* ============================================================
     Canvas rendering
     source: standalone line 593
     ============================================================ */
  function buildStripePattern(cs, ctx){
    if(S.stripePattern && S.stripePatternCS === cs) return S.stripePattern;
    var size = Math.max(6, cs);
    var pc = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    pc.width = size*dpr; pc.height = size*dpr;
    var pctx = pc.getContext('2d');
    pctx.scale(dpr,dpr);
    pctx.strokeStyle = '#ff3355';
    pctx.lineWidth = Math.max(1, size/5);
    pctx.beginPath();
    for(var x=-size; x<=size*2; x+=size/2){
      pctx.moveTo(x, size);
      pctx.lineTo(x+size, 0);
    }
    pctx.stroke();
    S.stripePattern = ctx.createPattern(pc, 'repeat');
    S.stripePatternCS = cs;
    return S.stripePattern;
  }

  function drawCanvas(){
    var cs = S.cellSize;
    var canvas = els.canvas;
    var cols = S.cols.length, rows = S.rows.length;
    var cssW = Math.max(1, cols*cs), cssH = Math.max(1, rows*cs);
    var dpr = window.devicePixelRatio || 1;

    canvas.style.left = LABEL_W + 'px';
    canvas.style.top = HEADER_H + 'px';
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = cssW*dpr;
    canvas.height = cssH*dpr;

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0,0,cssW,cssH);

    if(rows===0 || cols===0) return;

    var allowPath = new Path2D();
    var stripePath = new Path2D();
    var hasAllow = false, hasStripe = false;

    for(var i=0;i<rows;i++){
      var gridRow = S.grid[i];
      for(var j=0;j<cols;j++){
        var cell = gridRow[j];
        if(!cell) continue;
        var isAllow = cell.a.length>0;
        var isDA = cell.d.length>0;
        if(!isAllow && !isDA) continue;
        var x = j*cs, y = i*cs;
        if(isAllow && S.showAllowOnly){
          allowPath.rect(x,y,cs,cs);
          hasAllow = true;
        }
        if(isDA){
          stripePath.rect(x,y,cs,cs);
          hasStripe = true;
        }
      }
    }

    if(hasAllow){
      ctx.fillStyle = 'rgba(0,255,242,0.4)';
      ctx.fill(allowPath);
    }
    if(hasStripe){
      var darkFill = new Path2D();
      for(var i2=0;i2<rows;i2++){
        var gridRow2 = S.grid[i2];
        for(var j2=0;j2<cols;j2++){
          var cell2 = gridRow2[j2];
          if(cell2 && cell2.d.length>0 && !(S.showAllowOnly && cell2.a.length>0)){
            darkFill.rect(j2*cs, i2*cs, cs, cs);
          }
        }
      }
      ctx.fillStyle = '#1b1b36';
      ctx.fill(darkFill);

      var pattern = buildStripePattern(cs, ctx);
      ctx.fillStyle = pattern;
      ctx.fill(stripePath);
    }

    if(cs >= 9){
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(var gx=0; gx<=cols; gx++){ ctx.moveTo(gx*cs+0.5,0); ctx.lineTo(gx*cs+0.5,cssH); }
      for(var gy=0; gy<=rows; gy++){ ctx.moveTo(0,gy*cs+0.5); ctx.lineTo(cssW,gy*cs+0.5); }
      ctx.stroke();
    }

    if(S.hoverRow>=0 && S.hoverCol>=0){
      ctx.strokeStyle = '#00fff2';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(S.hoverCol*cs+0.75, S.hoverRow*cs+0.75, cs-1.5, cs-1.5);
    }
  }

  /* ============================================================
     Zoom controls
     source: standalone line 702
     ============================================================ */
  function setZoom(newCS){
    newCS = Math.max(MIN_CS, Math.min(MAX_CS, Math.round(newCS)));
    if(newCS === S.cellSize) return;
    S.cellSize = newCS;
    els.zoomPct.textContent = Math.round(newCS/DEFAULT_CS*100)+'%';
    layout();
  }
  function onZoomInClick(){ setZoom(S.cellSize*1.25); }
  function onZoomOutClick(){ setZoom(S.cellSize/1.25); }
  function onZoomResetClick(){ setZoom(DEFAULT_CS); }
  function onWheel(e){
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(S.cellSize * (e.deltaY<0 ? 1.1 : 0.9));
  }
  function onShowAllowChange(e){
    S.showAllowOnly = e.target.checked;
    drawCanvas();
  }

  /* ============================================================
     Hover / tooltip
     source: standalone line 727. Direct #tooltip manipulation replaced
     with App.tooltip.show/hide (shared shell tooltip element).
     ============================================================ */
  function onCanvasMouseMove(e){
    var cs = S.cellSize;
    var col = Math.floor(e.offsetX / cs);
    var row = Math.floor(e.offsetY / cs);
    if(row<0 || row>=S.rows.length || col<0 || col>=S.cols.length){
      clearHover();
      return;
    }
    if(row!==S.hoverRow || col!==S.hoverCol){
      setHover(row, col);
    }
    showTooltip(e.clientX, e.clientY, row, col);
  }
  function onCanvasMouseLeave(){
    clearHover();
  }

  function setHover(row, col){
    if(S.hoverRow>=0 && S.rowLabelEls[S.hoverRow]) S.rowLabelEls[S.hoverRow].classList.remove('hi');
    if(S.hoverCol>=0 && S.colLabelEls[S.hoverCol]) S.colLabelEls[S.hoverCol].classList.remove('hi');
    S.hoverRow = row; S.hoverCol = col;
    if(S.rowLabelEls[row]) S.rowLabelEls[row].classList.add('hi');
    if(S.colLabelEls[col]) S.colLabelEls[col].classList.add('hi');
    drawCanvas();
  }

  function clearHover(){
    if(S.hoverRow>=0 && S.rowLabelEls[S.hoverRow]) S.rowLabelEls[S.hoverRow].classList.remove('hi');
    if(S.hoverCol>=0 && S.colLabelEls[S.hoverCol]) S.colLabelEls[S.hoverCol].classList.remove('hi');
    S.hoverRow = -1; S.hoverCol = -1;
    drawCanvas();
    App.tooltip.hide();
  }

  function fmtEntries(list){
    return list.map(function(en){
      var perms = (en.p||[]).join(', ');
      return '<div class="tt-entry"><span class="cls">'+escapeHTML(en.c)+'</span>: '+escapeHTML(perms)+'</div>';
    }).join('');
  }

  function showTooltip(clientX, clientY, row, col){
    var domain = S.rows[row].domain;
    var target = S.cols[col].target;
    var cell = S.grid[row][col];
    if(!cell || (cell.a.length===0 && cell.d.length===0)){
      App.tooltip.hide();
      return;
    }
    var html = '<div class="tt-title">'+escapeHTML(domain)+' &rarr; '+escapeHTML(target)+'</div>';
    if(cell.a.length>0){
      html += '<div class="tt-sec allow"><div class="hdr">ALLOW</div>'+fmtEntries(cell.a)+'</div>';
    }
    if(cell.d.length>0){
      html += '<div class="tt-sec dontaudit"><div class="hdr">DONTAUDIT &mdash; no AVC log</div>'+fmtEntries(cell.d)+'</div>';
    }
    App.tooltip.show(clientX, clientY, html);
  }

  /* ============================================================
     Stats
     source: standalone line 801
     ============================================================ */
  function updateStats(){
    var fmt = d3.format(',');
    els.stats.innerHTML =
      '<span>DOMAINS <b>'+fmt(S.rows.length)+'</b></span>' +
      '<span>TARGET TYPES <b>'+fmt(S.cols.length)+'</b></span>' +
      '<span class="hot">DONTAUDIT RULES <b>'+fmt(S.totalDontaudit)+'</b></span>' +
      '<span class="hot">ALLOW+DONTAUDIT OVERLAPS <b>'+fmt(S.overlaps)+'</b></span>';
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createDontauditShadow(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM inside container */
    var root = App.el('div','dontaudit-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.toolbar = root.querySelector('#toolbar');
    els.zoomPct = root.querySelector('#zoom-pct');
    els.btnZoomOut = root.querySelector('#btn-zoom-out');
    els.btnZoomIn = root.querySelector('#btn-zoom-in');
    els.btnZoomReset = root.querySelector('#btn-zoom-reset');
    els.chkShowAllow = root.querySelector('#chk-show-allow');
    els.stats = root.querySelector('#stats');
    els.gridScroll = root.querySelector('#grid-scroll');
    els.gridContent = root.querySelector('#grid-content');
    els.colHeaders = root.querySelector('#col-headers');
    els.rowLabels = root.querySelector('#row-labels');
    els.corner = root.querySelector('#corner');
    els.canvas = root.querySelector('#heat-canvas');
    els.emptyMsg = root.querySelector('#empty-msg');

    /* initial zoom% label, source: standalone line 588 */
    els.zoomPct.textContent = Math.round(S.cellSize/DEFAULT_CS*100)+'%';

    /* 3. Wire event listeners */
    els.btnZoomIn.addEventListener('click', onZoomInClick);
    els.btnZoomOut.addEventListener('click', onZoomOutClick);
    els.btnZoomReset.addEventListener('click', onZoomResetClick);
    els.canvas.addEventListener('wheel', onWheel, {passive:false});
    els.chkShowAllow.addEventListener('change', onShowAllowChange);
    els.canvas.addEventListener('mousemove', onCanvasMouseMove);
    els.canvas.addEventListener('mouseleave', onCanvasMouseLeave);

    /* 4. Build grid model from App.data and draw */
    initFromData();
  }

  function destroyDontauditShadow(){
    /* Remove event listeners */
    if(els.btnZoomIn) els.btnZoomIn.removeEventListener('click', onZoomInClick);
    if(els.btnZoomOut) els.btnZoomOut.removeEventListener('click', onZoomOutClick);
    if(els.btnZoomReset) els.btnZoomReset.removeEventListener('click', onZoomResetClick);
    if(els.canvas){
      els.canvas.removeEventListener('wheel', onWheel);
      els.canvas.removeEventListener('mousemove', onCanvasMouseMove);
      els.canvas.removeEventListener('mouseleave', onCanvasMouseLeave);
    }
    if(els.chkShowAllow) els.chkShowAllow.removeEventListener('change', onShowAllowChange);

    App.tooltip.hide();

    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Reset local state */
    S.rows = [];
    S.cols = [];
    S.rowIndex = {};
    S.colIndex = {};
    S.grid = [];
    S.showAllowOnly = true;
    S.overlaps = 0;
    S.totalDontaudit = 0;
    S.rowLabelEls = [];
    S.colLabelEls = [];
    S.hoverRow = -1;
    S.hoverCol = -1;
    S.stripePattern = null;
    S.stripePatternCS = -1;
    S.cellSize = DEFAULT_CS;
  }

  App.registerView('dontaudit-shadow', {
    label: 'DONTAUDIT',
    icon: '░',
    create: createDontauditShadow,
    destroy: destroyDontauditShadow
  });
})();
