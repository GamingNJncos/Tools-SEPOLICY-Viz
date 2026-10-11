/* treemap.js -- WinDirStat-style space-filling treemap view (canvas), ported from sepolicy_viz.html monolith */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: monolith lines ~466-480 (treemap-specific), plus
     shared legend/zoom-controls/statusbar rules duplicated from
     monolith lines ~366-431 (same shared rules heatmap.js also
     carries a copy of -- each view module is self-contained and
     its CSS is removed on destroy, so the classes reused by this
     view's markup must be re-declared here too)
     ============================================================ */
  var CSS = ''
    + '.treemap-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));padding:0;}'
    + '.treemap-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);background:rgba(20,20,40,0.5);flex-shrink:0;}'
    + '.breadcrumb{display:flex;align-items:center;flex-wrap:wrap;gap:4px;font-size:11px;}'
    + '.breadcrumb .bc-item{color:var(--cyan);cursor:pointer;}'
    + '.breadcrumb .bc-item:hover{text-decoration:underline;}'
    + '.breadcrumb .bc-item.current{color:var(--text);cursor:default;text-decoration:none;}'
    + '.breadcrumb .bc-sep{color:var(--text2);}'
    + '.heatmap-legend{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:10px;color:var(--text2);}'
    + '.legend-swatch{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}'
    + '.legend-dot{width:9px;height:9px;display:inline-block;border-radius:1px;box-shadow:0 0 4px currentColor;}'
    + '.zoom-controls{display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--border);padding:2px;}'
    + '.zoom-controls .btn-ghost{padding:3px 9px;font-size:12px;}'
    + '.zoom-level{color:var(--text2);font-size:11px;min-width:42px;text-align:center;}'
    + '.treemap-stage-wrap{position:relative;flex:1;overflow:hidden;background:var(--bg);}'
    + '#treemap-canvas{display:block;width:100%;height:100%;cursor:pointer;}'
    + '.heatmap-statusbar{flex-shrink:0;padding:6px 16px;font-size:10px;color:var(--text2);border-top:1px solid var(--border);background:rgba(20,20,40,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from monolith markup lines ~705-720)
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="treemap-toolbar">'
    +   '<div id="treemap-breadcrumb" class="breadcrumb"><span class="bc-item current">ALL</span></div>'
    +   '<div id="treemap-legend" class="heatmap-legend"></div>'
    +   '<button id="btn-tm-invert" class="btn-ghost" type="button">INVERT</button>'
    +   '<span class="zoom-controls">'
    +     '<button id="btn-tm-zoom-out" class="btn-ghost" type="button">−</button>'
    +     '<span id="tm-zoom-level" class="zoom-level">100%</span>'
    +     '<button id="btn-tm-zoom-in" class="btn-ghost" type="button">+</button>'
    +   '</span>'
    + '</div>'
    + '<div id="treemap-stage-wrap" class="treemap-stage-wrap">'
    +   '<canvas id="treemap-canvas"></canvas>'
    + '</div>'
    + '<div class="heatmap-statusbar">click a block = drill in · right-click / breadcrumb = drill out · scroll or +/- = scale zoom · drag = pan when zoomed · hover = inspect · click a leaf target = pop out detail window</div>';

  /* ============================================================
     Local state (replaces S.tm* treemap-specific fields,
     monolith lines ~1171-1184). Note: S.tmClassFilter is NOT
     mirrored here -- it lives on App.state.tmClassFilter because
     heatmap.js's legend (already ported) reads/writes it and
     guard-calls App.computeTreemapLayout/App.drawTreemap when
     this view is active.
     ============================================================ */
  var tmState = {
    tmLevel: 'root',
    tmCat: null,
    tmDomain: null,
    tmLayout: [],
    tmHover: null,
    tmAnim: null,
    tmTypeHighlight: null,
    tmInvert: false,
    /* scale zoom / pan (independent of drill level) */
    tmZoom: 1,
    tmPanX: 0,
    tmPanY: 0,
    tmCanvasW: 0,
    tmCanvasH: 0
  };

  /* treemap: semantic-zoom scale constants, monolith line 1220 */
  var TM_MIN_ZOOM = 1, TM_MAX_ZOOM = 8, TM_ZOOM_STEP = 1.35;

  /* drag state for pan-vs-click disambiguation, monolith line 2370 */
  var tmDrag = null;

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  /* ============================================================
     Shared dependency helpers duplicated from elsewhere in the
     monolith (each is used by the in-scope treemap functions
     below but is not itself part of the treemap block).
     ============================================================ */

  /* source: monolith line 1490 */
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

  /* source: monolith line 1516 */
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

  /* source: monolith line 1832 */
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
     Treemap -- WinDirStat-style space-filling view (canvas)
     Hierarchy: root -> category -> domain -> target type
     Two independent zoom axes:
       - semantic "drill" zoom (click a block, changes tmState.tmLevel)
       - scale zoom/pan (wheel / +- buttons, magnifies current level)
     source: monolith lines 2090-2432
     ============================================================ */
  function buildOverviewChildren(catFilter){
    var cats = catFilter ? [catFilter] : App.CATS;
    var out = [];
    cats.forEach(function(cat){
      var range = App.state.categoryRowRanges[cat];
      if(!range) return;
      var domainsInCat = App.state.domains.slice(range.start, range.start+range.count).filter(function(d){
        if(!App.state.domainTypeMap[d] || Object.keys(App.state.domainTypeMap[d]).length===0) return false;
        if(App.state.tmClassFilter){
          var tmap = App.state.domainTypeMap[d];
          for(var t in tmap){
            for(var ei=0;ei<tmap[t].length;ei++){
              if(App.classCategory(tmap[t][ei].c)===App.state.tmClassFilter) return true;
            }
          }
          return false;
        }
        return true;
      });
      if(!domainsInCat.length) return;
      out.push({
        name: App.CAT_LABELS[cat], key:'cat:'+cat, kind:'category', catKey:cat,
        children: domainsInCat.map(function(d){
          return { name:d, key:'dom:'+d, kind:'domain', domain:d,
                   value: Math.max(1, App.state.domainRuleCounts[d]||0),
                   cls: domainDominantClass(d) };
        })
      });
    });
    return out;
  }
  function buildDomainChildren(domain){
    var tmap = App.state.domainTypeMap[domain]||{};
    return Object.keys(tmap).map(function(t){
      var entries = tmap[t];
      var permN = entries.reduce(function(n,en){ return n+en.p.length; },0);
      return { name:t, key:'type:'+t, kind:'type', domain:domain, type:t,
               value: Math.max(1,permN), cls: App.cellCategoryFromEntries(entries) };
    });
  }
  function computeTreemapLayout(){
    var wrap = els.stageWrap;
    var w = wrap.clientWidth||800, h = wrap.clientHeight||500;
    var rootData;
    if(tmState.tmLevel==='domain'){
      rootData = {name:tmState.tmDomain, key:'root', children: buildDomainChildren(tmState.tmDomain)};
    } else if(tmState.tmLevel==='category'){
      var catChildren = buildOverviewChildren(tmState.tmCat);
      rootData = {name:'ALL', key:'root', children: catChildren.length?catChildren[0].children:[]};
    } else {
      rootData = {name:'ALL', key:'root', children: buildOverviewChildren(null)};
    }
    var root = d3.hierarchy(rootData).sum(function(d){ return d.value||0; })
      .sort(function(a,b){ return tmState.tmInvert ? a.value-b.value : b.value-a.value; });
    var layout = d3.treemap()
      .size([w,h])
      .paddingOuter(2)
      .paddingInner(1)
      .paddingTop(function(d){ return (tmState.tmLevel==='root' && d.depth===1) ? 15 : 0; })
      .round(true);
    layout(root);
    tmState.tmCanvasW = w; tmState.tmCanvasH = h;
    var rects = [];
    if(tmState.tmLevel==='root' && root.children){
      root.children.forEach(function(catNode){
        rects.push({x0:catNode.x0,y0:catNode.y0,x1:catNode.x1,y1:catNode.y1,isCategory:true,data:catNode.data});
      });
    }
    root.leaves().forEach(function(leaf){
      rects.push({x0:leaf.x0,y0:leaf.y0,x1:leaf.x1,y1:leaf.y1,isCategory:false,data:leaf.data});
    });
    tmState.tmLayout = rects;
  }
  function easeOutBack(t){
    var c1=1.70158, c3=c1+1;
    return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
  }
  function tmCanvasLocalXY(e){
    var canvas = els.canvas;
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX-rect.left, y: e.clientY-rect.top };
  }
  function tmToLayoutCoords(cx,cy){
    return { x:(cx-tmState.tmPanX)/tmState.tmZoom, y:(cy-tmState.tmPanY)/tmState.tmZoom };
  }
  function clampTreemapPan(){
    var w = tmState.tmCanvasW||1, h = tmState.tmCanvasH||1;
    var minX = Math.min(0, w-w*tmState.tmZoom), minY = Math.min(0, h-h*tmState.tmZoom);
    tmState.tmPanX = Math.max(minX, Math.min(0, tmState.tmPanX));
    tmState.tmPanY = Math.max(minY, Math.min(0, tmState.tmPanY));
  }
  function setTreemapZoom(z, anchorX, anchorY){
    var wrap = els.stageWrap;
    var w = wrap.clientWidth||800, h = wrap.clientHeight||500;
    if(anchorX===undefined) anchorX = w/2;
    if(anchorY===undefined) anchorY = h/2;
    var oldZoom = tmState.tmZoom;
    var newZoom = Math.max(TM_MIN_ZOOM, Math.min(TM_MAX_ZOOM, z));
    var layoutX = (anchorX-tmState.tmPanX)/oldZoom, layoutY = (anchorY-tmState.tmPanY)/oldZoom;
    tmState.tmZoom = newZoom;
    tmState.tmPanX = anchorX-layoutX*newZoom;
    tmState.tmPanY = anchorY-layoutY*newZoom;
    clampTreemapPan();
    var lvl = els.zoomLevel;
    if(lvl) lvl.textContent = Math.round(tmState.tmZoom*100)+'%';
    if(!tmState.tmAnim) drawTreemap();
  }
  function resetTreemapZoom(){
    tmState.tmZoom=1; tmState.tmPanX=0; tmState.tmPanY=0;
    var lvl = els.zoomLevel;
    if(lvl) lvl.textContent='100%';
  }
  function drawTreemap(){
    var canvas = els.canvas;
    var wrap = els.stageWrap;
    var w = wrap.clientWidth||800, h = wrap.clientHeight||500;
    var ctx = sizeCanvas(canvas, w, h);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0,0,w,h);

    var animProgress = tmState.tmAnim ? Math.min(1,(performance.now()-tmState.tmAnim.start)/tmState.tmAnim.dur) : 1;
    var scaleF = tmState.tmAnim ? (0.82 + 0.18*easeOutBack(animProgress)) : 1;

    ctx.save();
    ctx.translate(tmState.tmPanX, tmState.tmPanY);
    ctx.scale(tmState.tmZoom, tmState.tmZoom);

    if(tmState.tmLevel==='root'){
      tmState.tmLayout.forEach(function(r){
        if(!r.isCategory) return;
        ctx.strokeStyle = App.CAT_COLORS[r.data.catKey]||'#8888aa';
        ctx.lineWidth = 1/tmState.tmZoom;
        ctx.strokeRect(r.x0+0.5, r.y0+0.5, Math.max(0,r.x1-r.x0-1), Math.max(0,r.y1-r.y0-1));
        ctx.fillStyle = App.CAT_COLORS[r.data.catKey]||'#8888aa';
        ctx.font = "700 10px 'JetBrains Mono', Consolas, monospace";
        ctx.fillText(r.data.name, r.x0+4, r.y0+11);
      });
    }

    tmState.tmLayout.forEach(function(r){
      if(r.isCategory) return;
      var cx=(r.x0+r.x1)/2, cy=(r.y0+r.y1)/2;
      var rw=(r.x1-r.x0), rh=(r.y1-r.y0);
      var sw=rw*scaleF, sh=rh*scaleF;
      var x0=cx-sw/2, y0=cy-sh/2;
      var color;
      if(r.data.kind==='domain'){
        var domCls = r.data.cls||'other';
        if(domCls!=='other' && domCls!=='file' && domCls!=='dir' && domCls!=='lnk_file' && App.CLASS_COLORS[domCls]){
          color = App.CLASS_COLORS[domCls];
        } else {
          var dCat = App.state.domainCategory[r.data.domain]||'other';
          color = App.CAT_COLORS[dCat]||App.CAT_COLORS.other;
        }
      } else {
        color = App.CLASS_COLORS[r.data.cls]||App.CLASS_COLORS.other;
      }
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.fillRect(x0,y0,Math.max(0,sw),Math.max(0,sh));
      ctx.globalAlpha = 1;
      var isHover = tmState.tmHover===r;
      var isTypeHi = tmState.tmTypeHighlight && r.data.kind==='domain' && tmState.tmTypeHighlight.domains.indexOf(r.data.domain)!==-1;
      ctx.lineWidth = (isHover?1.5:1)/tmState.tmZoom;
      ctx.strokeStyle = isHover ? '#ffffff' : 'rgba(10,10,26,0.6)';
      ctx.strokeRect(x0+0.5,y0+0.5,Math.max(0,sw-1),Math.max(0,sh-1));
      if(isHover){
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.strokeStyle = color; ctx.lineWidth = 2/tmState.tmZoom;
        ctx.strokeRect(x0+1,y0+1,Math.max(0,sw-2),Math.max(0,sh-2));
        ctx.restore();
      }
      if(isTypeHi){
        ctx.save();
        ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2/tmState.tmZoom;
        ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 10;
        ctx.strokeRect(x0+1,y0+1,Math.max(0,sw-2),Math.max(0,sh-2));
        ctx.restore();
      }
      if(sw*tmState.tmZoom>34 && sh*tmState.tmZoom>14){
        ctx.fillStyle = '#0a0a1a';
        ctx.font = "10px 'JetBrains Mono', Consolas, monospace";
        var label = r.data.name;
        var maxChars = Math.floor(sw/6.2);
        if(label.length>maxChars) label = label.slice(0,Math.max(1,maxChars-1))+'…';
        ctx.fillText(label, x0+3, y0+12);
      }
    });

    ctx.restore();

    if(tmState.tmAnim && animProgress<1){
      requestAnimationFrame(drawTreemap);
    } else {
      tmState.tmAnim = null;
    }
  }
  function treemapLeafAt(lx,ly){
    var list = tmState.tmLayout;
    for(var i=0;i<list.length;i++){
      var r=list[i];
      if(r.isCategory) continue;
      if(lx>=r.x0 && lx<=r.x1 && ly>=r.y0 && ly<=r.y1) return r;
    }
    return null;
  }
  function treemapCategoryLabelAt(lx,ly){
    if(tmState.tmLevel!=='root') return null;
    var list = tmState.tmLayout;
    for(var i=0;i<list.length;i++){
      var r=list[i];
      if(!r.isCategory) continue;
      if(lx>=r.x0 && lx<=r.x1 && ly>=r.y0 && ly<=r.y0+15) return r;
    }
    return null;
  }
  function startTreemapAnim(){
    tmState.tmAnim = {start:performance.now(), dur:260};
    requestAnimationFrame(drawTreemap);
  }
  function renderTreemapBreadcrumb(){
    var bc = els.breadcrumb;
    bc.innerHTML='';
    var allItem = App.el('span','bc-item'+(tmState.tmLevel==='root'?' current':''), 'ALL');
    if(tmState.tmLevel!=='root') allItem.onclick=navigateTreemapToRoot;
    bc.appendChild(allItem);
    if(tmState.tmLevel!=='root' && tmState.tmCat){
      bc.appendChild(App.el('span','bc-sep','/'));
      var catSpan = App.el('span','bc-item'+(tmState.tmLevel==='category'?' current':''));
      if(tmState.tmLevel==='domain'){ catSpan.onclick=function(){ navigateTreemapToCategory(tmState.tmCat); }; }
      bc.appendChild(catSpan);
      App.rainbowize(catSpan, App.CAT_LABELS[tmState.tmCat]);
    }
    if(tmState.tmLevel==='domain'){
      bc.appendChild(App.el('span','bc-sep','/'));
      bc.appendChild(App.el('span','bc-item current', App.escapeHTML(tmState.tmDomain)));
    }
  }
  function navigateTreemapToRoot(){
    tmState.tmLevel='root'; tmState.tmCat=null; tmState.tmDomain=null; tmState.tmHover=null;
    resetTreemapZoom();
    computeTreemapLayout(); renderTreemapBreadcrumb(); startTreemapAnim();
  }
  function navigateTreemapToCategory(cat){
    tmState.tmLevel='category'; tmState.tmCat=cat; tmState.tmDomain=null; tmState.tmHover=null;
    resetTreemapZoom();
    computeTreemapLayout(); renderTreemapBreadcrumb(); startTreemapAnim();
  }
  function navigateTreemapToDomain(domain){
    tmState.tmLevel='domain'; tmState.tmDomain=domain; tmState.tmCat=App.state.domainCategory[domain]||'other'; tmState.tmHover=null;
    resetTreemapZoom();
    computeTreemapLayout(); renderTreemapBreadcrumb(); startTreemapAnim();
  }
  function navigateTreemapOut(){
    if(tmState.tmLevel==='domain'){ navigateTreemapToCategory(tmState.tmCat); }
    else if(tmState.tmLevel==='category'){ navigateTreemapToRoot(); }
  }
  function openTreemapView(){
    App.showView('treemap');
    computeTreemapLayout();
    renderTreemapBreadcrumb();
    startTreemapAnim();
  }
  function buildCellDetailHTML(domain,type){
    var entries = App.state.domainTypeMap[domain] && App.state.domainTypeMap[domain][type];
    if(!entries) return '<div class="empty-state">no grant</div>';
    var html = '<h4>'+App.escapeHTML(domain)+' &rarr; '+App.escapeHTML(type)+'</h4>';
    entries.forEach(function(en){
      html += '<div class="cpb-class"><span class="cpb-class-name">'+App.escapeHTML(en.c)+' ('+en.p.length+')</span><div>'+en.p.map(App.permBadgeHTML).join(' ')+'</div></div>';
    });
    return html;
  }
  function onTreemapMouseDown(e){
    var p = tmCanvasLocalXY(e);
    tmDrag = {sx:p.x, sy:p.y, startPanX:tmState.tmPanX, startPanY:tmState.tmPanY, moved:false};
  }
  function onTreemapDocMouseMove(e){
    if(!tmDrag) return;
    var p = tmCanvasLocalXY(e);
    var dx = p.x-tmDrag.sx, dy = p.y-tmDrag.sy;
    if(Math.abs(dx)>3||Math.abs(dy)>3) tmDrag.moved = true;
    if(tmDrag.moved && tmState.tmZoom>1){
      tmState.tmPanX = tmDrag.startPanX+dx;
      tmState.tmPanY = tmDrag.startPanY+dy;
      clampTreemapPan();
      if(!tmState.tmAnim) drawTreemap();
      App.tooltip.hide();
    }
  }
  function onTreemapDocMouseUp(e){
    if(!tmDrag) return;
    if(!tmDrag.moved){ handleTreemapClick(e); }
    tmDrag = null;
  }
  function onTreemapMove(e){
    if(tmDrag && tmDrag.moved) return;
    var p = tmCanvasLocalXY(e);
    var lc = tmToLayoutCoords(p.x,p.y);
    var leaf = treemapLeafAt(lc.x,lc.y);
    if(leaf!==tmState.tmHover){ tmState.tmHover=leaf; if(!tmState.tmAnim) drawTreemap(); }
    if(leaf){
      var html;
      if(leaf.data.kind==='domain'){ html = tooltipForCell(leaf.data.domain,null,null); }
      else { var entries=App.state.domainTypeMap[leaf.data.domain][leaf.data.type]; html = tooltipForCell(leaf.data.domain, leaf.data.type, entries); }
      App.tooltip.show(e.clientX,e.clientY,html);
    } else { App.tooltip.hide(); }
  }
  function onTreemapLeave(){
    if(!tmDrag){ tmState.tmHover=null; App.tooltip.hide(); if(!tmState.tmAnim) drawTreemap(); }
  }
  function handleTreemapClick(e){
    var p = tmCanvasLocalXY(e);
    var lc = tmToLayoutCoords(p.x,p.y);
    var leaf = treemapLeafAt(lc.x,lc.y);
    if(leaf){
      if(leaf.data.kind==='domain'){ navigateTreemapToDomain(leaf.data.domain); }
      else if(leaf.data.kind==='type'){
        if(App.spawnFloatingWindow) App.spawnFloatingWindow(leaf.data.domain+' -> '+leaf.data.type, buildCellDetailHTML(leaf.data.domain, leaf.data.type), {x:e.clientX-150,y:e.clientY-40});
      }
      return;
    }
    var catHit = treemapCategoryLabelAt(lc.x,lc.y);
    if(catHit){ navigateTreemapToCategory(catHit.data.catKey); }
  }
  function onTreemapContext(e){
    e.preventDefault();
    navigateTreemapOut();
  }
  function onTreemapWheel(e){
    e.preventDefault();
    var p = tmCanvasLocalXY(e);
    var factor = e.deltaY<0 ? TM_ZOOM_STEP : 1/TM_ZOOM_STEP;
    setTreemapZoom(tmState.tmZoom*factor, p.x, p.y);
  }

  /* ============================================================
     Legend rendering (duplicated from the shared monolith copy,
     source: monolith line ~3095 -- same function heatmap.js also
     carries its own copy of, one instance per legend target)
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
  function createTreemap(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (toolbar, breadcrumb, legend, canvas, statusbar) inside container */
    var root = App.el('div','treemap-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.breadcrumb = root.querySelector('#treemap-breadcrumb');
    els.legend = root.querySelector('#treemap-legend');
    els.btnInvert = root.querySelector('#btn-tm-invert');
    els.btnZoomOut = root.querySelector('#btn-tm-zoom-out');
    els.zoomLevel = root.querySelector('#tm-zoom-level');
    els.btnZoomIn = root.querySelector('#btn-tm-zoom-in');
    els.stageWrap = root.querySelector('#treemap-stage-wrap');
    els.canvas = root.querySelector('#treemap-canvas');

    /* 3. Wire event listeners on the created elements */
    els.canvas.addEventListener('mousemove', onTreemapMove);
    els.canvas.addEventListener('mouseleave', onTreemapLeave);
    els.canvas.addEventListener('mousedown', onTreemapMouseDown);
    els.canvas.addEventListener('contextmenu', onTreemapContext);
    els.canvas.addEventListener('wheel', onTreemapWheel, {passive:false});
    document.addEventListener('mousemove', onTreemapDocMouseMove);
    document.addEventListener('mouseup', onTreemapDocMouseUp);

    els.btnZoomIn.addEventListener('click', function(){ setTreemapZoom(tmState.tmZoom*TM_ZOOM_STEP); });
    els.btnZoomOut.addEventListener('click', function(){ setTreemapZoom(tmState.tmZoom/TM_ZOOM_STEP); });
    els.btnInvert.addEventListener('click', function(){
      tmState.tmInvert = !tmState.tmInvert;
      this.textContent = tmState.tmInvert ? 'INVERT ✓' : 'INVERT';
      this.style.color = tmState.tmInvert ? 'var(--cyan)' : '';
      computeTreemapLayout(); drawTreemap();
    });

    /* 4. Compute initial data */
    renderLegend('treemap-legend');

    /* 5. Draw */
    computeTreemapLayout();
    renderTreemapBreadcrumb();
    startTreemapAnim();
  }

  function destroyTreemap(){
    /* Remove event listeners */
    if(els.canvas){
      els.canvas.removeEventListener('mousemove', onTreemapMove);
      els.canvas.removeEventListener('mouseleave', onTreemapLeave);
      els.canvas.removeEventListener('mousedown', onTreemapMouseDown);
      els.canvas.removeEventListener('contextmenu', onTreemapContext);
      els.canvas.removeEventListener('wheel', onTreemapWheel);
    }
    document.removeEventListener('mousemove', onTreemapDocMouseMove);
    document.removeEventListener('mouseup', onTreemapDocMouseUp);

    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Clear local state */
    tmDrag = null;
    tmState.tmLevel='root';
    tmState.tmCat=null;
    tmState.tmDomain=null;
    tmState.tmLayout=[];
    tmState.tmHover=null;
    tmState.tmAnim=null;
    tmState.tmTypeHighlight=null;
    tmState.tmInvert=false;
    tmState.tmZoom=1;
    tmState.tmPanX=0;
    tmState.tmPanY=0;
    tmState.tmCanvasW=0;
    tmState.tmCanvasH=0;
  }

  /* Expose for heatmap.js's legend click-through, which guard-calls
     these when App.activeView==='treemap' (monolith line ~3157 wiring) */
  App.computeTreemapLayout = computeTreemapLayout;
  App.drawTreemap = drawTreemap;

  App.registerView('treemap', { label: 'TREEMAP', icon: '▣', create: createTreemap, destroy: destroyTreemap });
})();
