/* graph.js -- force-directed domain graph + reverse lookup + compare view, ported from sepolicy_viz.html monolith */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: monolith lines 267-310 (detail view), 320-331 (reverse
     lookup), 335-353 (compare), 521-527 (VT graph). Also carries
     .fw-body .cpb-class from the floating-windows CSS block
     (monolith lines 558-559) since buildDomainSummaryHTML's pop-out
     content needs it and this module owns spawnFloatingWindow.
     Reverse/compare id selectors are renamed from #view-reverse /
     #view-compare to this module's own subview ids.
     ============================================================ */
  var CSS = ''
    + '.detail-toolbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--border);background:rgba(20,20,40,0.5);}'
    + '.detail-title{font-size:14px;color:var(--cyan);letter-spacing:1px;text-shadow:0 0 10px rgba(0,255,242,0.4);}'
    + '.detail-title .sub{color:var(--text2);font-size:11px;margin-left:10px;text-shadow:none;}'
    + '.detail-toolbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}'
    + '.graph-hint{color:var(--text2);font-size:10px;}'
    + '.detail-body{display:flex;height:calc(100vh - 54px - 47px);}'
    + '.graph-container{flex:1;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 50%, rgba(0,255,242,0.04), transparent 60%),var(--bg);}'
    + '.graph-container svg{display:block;width:100%;height:100%;cursor:grab;position:relative;z-index:1;}'
    + '.graph-container svg:active{cursor:grabbing;}'
    + '.graph-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--cyan);font-size:13px;letter-spacing:2px;text-shadow:0 0 10px rgba(0,255,242,0.6);background:rgba(10,10,26,0.6);z-index:10;}'
    + '.graph-loading.hidden{display:none;}'
    + '.detail-panel{width:320px;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto;padding:14px;background:var(--surface);}'
    + '.vt-props-panel{border-left:none;border-right:1px solid var(--border);}'
    + '.detail-panel h3{font-size:11px;color:var(--text2);letter-spacing:1px;margin:0 0 10px;text-transform:uppercase;}'
    + '.perm-class-group{border:1px solid var(--border);margin-bottom:8px;background:var(--bg);}'
    + '.perm-class-group summary{cursor:pointer;padding:8px 10px;font-size:11px;color:var(--text);list-style:none;display:flex;justify-content:space-between;}'
    + '.perm-class-group summary::-webkit-details-marker{display:none;}'
    + '.perm-class-group summary::before{content:"+ ";color:var(--cyan);}'
    + '.perm-class-group[open] summary::before{content:"- ";color:var(--magenta);}'
    + '.perm-class-group .group-count{color:var(--text2);}'
    + '.perm-target-row{padding:6px 10px 8px 20px;border-top:1px solid var(--border);}'
    + '.perm-target-row .target-name{color:var(--amber);font-size:11px;display:block;margin-bottom:4px;cursor:pointer;}'
    + '.perm-target-row .target-name:hover{text-decoration:underline;}'
    + '.graph-root{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h));}'
    + '.vt-graph-body{display:flex;flex:1;overflow:hidden;}'
    + '#graph-trail-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;}'
    + '.vt-node-label{fill:var(--text2);font-size:9px;pointer-events:none;}'
    + '#graph-subview-reverse.active{padding-bottom:40px;}'
    + '.reverse-list{padding:16px 24px;display:flex;flex-direction:column;gap:8px;}'
    + '.reverse-row{background:var(--surface);border:1px solid var(--border);padding:10px 14px;}'
    + '.reverse-row .rr-head{display:flex;align-items:center;gap:10px;cursor:pointer;}'
    + '.reverse-row .rr-domain{color:var(--cyan);font-size:12px;font-weight:700;}'
    + '.reverse-row .rr-count{color:var(--text2);font-size:11px;margin-left:auto;}'
    + '.reverse-row .rr-body{margin-top:8px;padding-top:8px;border-top:1px solid var(--border);}'
    + '.reverse-row .rr-class-line{margin-bottom:4px;}'
    + '.reverse-row .rr-class-name{color:var(--text2);font-size:10px;text-transform:uppercase;margin-right:6px;}'
    + '#graph-subview-compare.active{padding-bottom:40px;}'
    + '.compare-columns{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:0;min-height:calc(100vh - var(--topbar-h) - 47px);}'
    + '.compare-col{padding:16px;overflow-y:auto;max-height:calc(100vh - var(--topbar-h) - 47px);}'
    + '.compare-col-a{border-right:1px solid var(--border);}'
    + '.compare-col-b{border-left:1px solid var(--border);}'
    + '.compare-col h4{font-size:12px;letter-spacing:1px;margin:0 0 12px;position:sticky;top:0;background:var(--bg);padding:4px 0;}'
    + '.compare-col-a h4{color:var(--cyan);}'
    + '.compare-col-b h4{color:var(--magenta);}'
    + '.compare-col-shared h4{color:var(--amber);}'
    + '.compare-item{border:1px solid var(--border);background:var(--surface);padding:8px 10px;margin-bottom:6px;font-size:11px;}'
    + '.compare-item .ci-type{color:var(--text);display:block;margin-bottom:4px;}'
    + '.compare-item.shared .ci-type{color:var(--amber);}'
    + '.compare-item .ci-side{margin-top:4px;}'
    + '.compare-item .ci-side .ci-label{color:var(--text2);font-size:9px;text-transform:uppercase;margin-right:4px;}'
    + '.fw-body .cpb-class{margin-bottom:8px;}'
    + '.fw-body .cpb-class-name{color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px;}';
  var styleEl = null;

  /* ============================================================
     DOM template -- three sibling subviews (main graph / reverse
     lookup / compare), toggled locally via showSubView(). Adapted
     from monolith markup lines 759-823 (#view-graph, #view-reverse,
     #view-compare are top-level siblings there; here they are all
     owned by this one registered view and toggled internally).
     ============================================================ */
  var TEMPLATE = ''
    + '<div id="graph-subview-main" class="view active">'
    +   '<div class="detail-toolbar">'
    +     '<button id="btn-back-graph" class="btn-ghost" type="button">← BACK</button>'
    +     '<div id="graph-title" class="detail-title"></div>'
    +     '<div class="detail-toolbar-right">'
    +       '<span class="graph-hint">scroll = zoom &middot; drag node = reposition &middot; click node = expand connections (5 layers max) &middot; hover edge = shared targets</span>'
    +       '<button id="btn-graph-reset" class="btn-ghost" type="button">RESET</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="vt-graph-body">'
    +     '<aside id="vt-props-panel" class="detail-panel vt-props-panel"></aside>'
    +     '<div id="graph-container" class="graph-container">'
    +       '<canvas id="graph-trail-canvas"></canvas>'
    +       '<div id="graph-loading" class="graph-loading hidden">LAYING OUT GRAPH…</div>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div id="graph-subview-reverse" class="view">'
    +   '<div class="detail-toolbar">'
    +     '<button id="btn-back-reverse" class="btn-ghost" type="button">← BACK TO MATRIX</button>'
    +     '<div id="reverse-title" class="detail-title"></div>'
    +   '</div>'
    +   '<div id="reverse-list" class="reverse-list"></div>'
    + '</div>'
    + '<div id="graph-subview-compare" class="view">'
    +   '<div class="detail-toolbar">'
    +     '<button id="btn-back-compare" class="btn-ghost" type="button">← BACK TO MATRIX</button>'
    +     '<div id="compare-title" class="detail-title"></div>'
    +   '</div>'
    +   '<div id="compare-columns" class="compare-columns"></div>'
    + '</div>';

  /* ============================================================
     Local state (replaces S.graph*/S.win*/S.lastMainView fields).
     graphDomain/lastMainView/winZ/winSeq persist across
     create()/destroy() cycles (module scope), matching the
     monolith's persistent S object -- e.g. re-opening the GRAPH
     tab must re-show the last-inspected domain, and floating
     windows keep stacking/z-ordering across view switches.
     ============================================================ */
  var state = {
    graphDomain: null,
    graphSim: null,
    graphCtx: null,
    lastMainView: 'treemap',
    winZ: 100,
    winSeq: 0
  };
  /* one-shot request consumed by createGraph() when App.showView('graph')
     is triggered from outside this module (e.g. heatmap.js calling
     App.openReverse/App.openCompareView/App.openGraphView) */
  var pending = null;
  var els = {};
  var graphTickerRAF = null;
  var fwDrag = null;
  var fwDragInited = false;

  /* ============================================================
     Shared dependency helpers duplicated from elsewhere in the
     monolith (each is used by the in-scope functions below but is
     not itself part of the graph/reverse/compare block)
     ============================================================ */

  /* source: monolith line 1469 */
  function overlapCount(domainA,domainB){
    var setA = App.state.domainTypeSet[domainA], setB = App.state.domainTypeSet[domainB];
    if(!setA || !setB) return 0;
    var small = setA.size<setB.size?setA:setB, big = setA.size<setB.size?setB:setA;
    var n=0;
    small.forEach(function(t){ if(big.has(t)) n++; });
    return n;
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

  /* ============================================================
     Reverse lookup view
     source: monolith lines 2434-2478
     ============================================================ */
  function openReverse(type){
    captureLastMainView();
    if(App.activeView==='graph'){
      renderReverse(type);
      showSubView('reverse');
    } else {
      pending = {kind:'reverse', type:type};
      App.showView('graph');
    }
  }
  function renderReverse(type){
    els.reverseTitle.innerHTML =
      'REVERSE LOOKUP: <span style="color:var(--amber)">'+App.escapeHTML(type)+'</span>'+
      '<span class="sub">'+App.fmtNum(App.state.typeDomainCount[type]||0)+' domains</span>';
    var list = els.reverseList;
    list.innerHTML = '';
    var rows = [];
    App.state.domains.forEach(function(d){
      var entries = App.state.domainTypeMap[d] && App.state.domainTypeMap[d][type];
      if(entries) rows.push({domain:d, entries:entries});
    });
    if(rows.length===0){
      list.appendChild(App.el('div','empty-state','No domains grant access to this type.'));
      return;
    }
    rows.forEach(function(row){
      var rr = App.el('div','reverse-row');
      var head = App.el('div','rr-head');
      var nameSpan = App.el('span','rr-domain', App.escapeHTML(row.domain));
      nameSpan.style.cursor='pointer';
      nameSpan.title = 'open graph view';
      nameSpan.onclick = function(){ openGraphView(row.domain); };
      head.appendChild(nameSpan);
      var totalPerms = row.entries.reduce(function(n,en){ return n+en.p.length; },0);
      head.appendChild(App.el('span','rr-count', totalPerms+' perms / '+row.entries.length+' class'+(row.entries.length>1?'es':'')));
      rr.appendChild(head);
      var body = App.el('div','rr-body');
      row.entries.forEach(function(en){
        var line = App.el('div','rr-class-line');
        line.appendChild(App.el('span','rr-class-name', App.escapeHTML(en.c)));
        line.appendChild(App.el('span','', en.p.map(App.permBadgeHTML).join(' ')));
        body.appendChild(line);
      });
      rr.appendChild(body);
      list.appendChild(rr);
    });
  }

  /* ============================================================
     Comparison view
     source: monolith lines 2479-2533
     ============================================================ */
  function openCompareView(a,b){
    captureLastMainView();
    if(App.activeView==='graph'){
      renderCompare(a,b);
      showSubView('compare');
    } else {
      pending = {kind:'compare', a:a, b:b};
      App.showView('graph');
    }
  }
  function renderCompare(a,b){
    els.compareTitle.innerHTML =
      '<span style="color:var(--cyan)">'+App.escapeHTML(a)+'</span> <span style="color:var(--text2)">vs</span> <span style="color:var(--magenta)">'+App.escapeHTML(b)+'</span>';
    var cols = els.compareColumns;
    cols.innerHTML = '';
    var setA = App.state.domainTypeSet[a]||new Set(), setB = App.state.domainTypeSet[b]||new Set();
    var uniqueA=[], uniqueB=[], shared=[];
    setA.forEach(function(t){ if(setB.has(t)) shared.push(t); else uniqueA.push(t); });
    setB.forEach(function(t){ if(!setA.has(t)) uniqueB.push(t); });
    uniqueA.sort(); uniqueB.sort(); shared.sort();

    var colA = App.el('div','compare-col compare-col-a');
    colA.appendChild(App.el('h4','','UNIQUE TO '+App.escapeHTML(a)+' ('+uniqueA.length+')'));
    uniqueA.forEach(function(t){
      var item = App.el('div','compare-item');
      item.appendChild(App.el('span','ci-type', App.escapeHTML(t)));
      colA.appendChild(item);
    });
    if(uniqueA.length===0) colA.appendChild(App.el('div','empty-state','none'));

    var colShared = App.el('div','compare-col compare-col-shared');
    colShared.appendChild(App.el('h4','','SHARED TARGETS ('+shared.length+')'));
    shared.forEach(function(t){
      var item = App.el('div','compare-item shared');
      item.appendChild(App.el('span','ci-type', App.escapeHTML(t)));
      var entA = App.state.domainTypeMap[a][t], entB = App.state.domainTypeMap[b][t];
      var sideA = App.el('div','ci-side');
      sideA.innerHTML = '<span class="ci-label" style="color:var(--cyan)">A</span>'+entA.map(function(en){ return '<div>'+App.escapeHTML(en.c)+': '+en.p.map(App.permBadgeHTML).join(' ')+'</div>'; }).join('');
      var sideB = App.el('div','ci-side');
      sideB.innerHTML = '<span class="ci-label" style="color:var(--magenta)">B</span>'+entB.map(function(en){ return '<div>'+App.escapeHTML(en.c)+': '+en.p.map(App.permBadgeHTML).join(' ')+'</div>'; }).join('');
      item.appendChild(sideA);
      item.appendChild(sideB);
      colShared.appendChild(item);
    });
    if(shared.length===0) colShared.appendChild(App.el('div','empty-state','no shared targets'));

    var colB = App.el('div','compare-col compare-col-b');
    colB.appendChild(App.el('h4','','UNIQUE TO '+App.escapeHTML(b)+' ('+uniqueB.length+')'));
    uniqueB.forEach(function(t){
      var item = App.el('div','compare-item');
      item.appendChild(App.el('span','ci-type', App.escapeHTML(t)));
      colB.appendChild(item);
    });
    if(uniqueB.length===0) colB.appendChild(App.el('div','empty-state','none'));

    cols.appendChild(colA); cols.appendChild(colShared); cols.appendChild(colB);
  }

  /* ============================================================
     Relation classification -- shared by Graph View edge tooltips
     and the Relay Finder
     source: monolith lines 2538-2566
     ============================================================ */
  function permSetForEntries(entries){
    var set = {read:false, write:false, exec:false, other:false};
    entries.forEach(function(en){
      en.p.forEach(function(p){ set[App.permCategory(p)] = true; });
    });
    return set;
  }
  function flattenPermTokens(entries){
    var toks = [];
    entries.forEach(function(en){ en.p.forEach(function(p){ toks.push(en.c+':'+p); }); });
    return toks.sort();
  }
  function classifyRelation(entriesA, entriesB){
    var tokA = flattenPermTokens(entriesA).join('|');
    var tokB = flattenPermTokens(entriesB).join('|');
    if(tokA===tokB) return 'identical';
    var sa = permSetForEntries(entriesA), sb = permSetForEntries(entriesB);
    var aWrite = sa.write||sa.exec, aReadOnly = sa.read && !sa.write && !sa.exec;
    var bWrite = sb.write||sb.exec, bReadOnly = sb.read && !sb.write && !sb.exec;
    if((aWrite && bReadOnly) || (bWrite && aReadOnly)) return 'complementary';
    return 'mixed';
  }

  /* ============================================================
     Graph view (secondary view) -- VirusTotal-style threat graph
     Center = selected domain, satellites = other domains that
     share target types with it, clustered into rings by category.
     Rendered with a live d3.forceSimulation; a canvas layer behind
     the SVG accumulates a fading phosphor trail while it settles.
     source: monolith lines 2568-3003
     ============================================================ */
  function buildConnectedDomains(domain, limit){
    var out = [];
    for(var i=0;i<App.state.domains.length;i++){
      var d = App.state.domains[i];
      if(d===domain) continue;
      var n = overlapCount(domain,d);
      if(n>0) out.push({domain:d, overlap:n});
    }
    out.sort(function(a,b){ return b.overlap-a.overlap; });
    return out.slice(0, limit||30);
  }
  function hexPoints(r){
    var pts=[];
    for(var i=0;i<6;i++){
      var ang = Math.PI/180*(60*i-30);
      pts.push((r*Math.cos(ang)).toFixed(2)+','+(r*Math.sin(ang)).toFixed(2));
    }
    return pts.join(' ');
  }
  function buildDomainSummaryHTML(domain){
    var cat = App.state.domainCategory[domain]||'other';
    var rc = App.state.domainRuleCounts[domain]||0;
    var typeCount = App.state.domainTypeSet[domain] ? App.state.domainTypeSet[domain].size : 0;
    var html = '<h4>'+App.escapeHTML(domain)+'</h4>'+
      '<div style="color:var(--text2);margin-bottom:8px;">'+App.CAT_LABELS[cat]+' &middot; '+App.fmtNum(rc)+' rules &middot; '+App.fmtNum(typeCount)+' target types</div>';
    var tmap = App.state.domainTypeMap[domain]||{};
    var types = Object.keys(tmap).sort().slice(0,40);
    types.forEach(function(t){
      html += '<div class="cpb-class"><span class="cpb-class-name">'+App.escapeHTML(t)+'</span><div>'+
        tmap[t].map(function(en){ return App.escapeHTML(en.c)+': '+en.p.map(App.permBadgeHTML).join(' '); }).join('<br>')+
        '</div></div>';
    });
    if(Object.keys(tmap).length>40) html += '<div style="color:var(--text2);">+'+(Object.keys(tmap).length-40)+' more targets&hellip;</div>';
    return html;
  }
  function renderGraphPropsPanel(domain){
    var panel = els.propsPanel;
    panel.innerHTML = '';
    var cat = App.state.domainCategory[domain]||'other';
    var rc = App.state.domainRuleCounts[domain]||0;
    var typeCount = App.state.domainTypeSet[domain] ? App.state.domainTypeSet[domain].size : 0;

    var head = App.el('div','');
    head.style.marginBottom = '14px';
    head.innerHTML =
      '<div style="color:var(--cyan);font-size:13px;font-weight:700;word-break:break-all;">'+App.escapeHTML(domain)+'</div>'+
      '<div style="margin-top:6px;"><span style="color:'+App.CAT_COLORS[cat]+';border:1px solid '+App.CAT_COLORS[cat]+';padding:1px 6px;font-size:10px;letter-spacing:.5px;">'+App.CAT_LABELS[cat]+'</span></div>'+
      '<div style="color:var(--text2);font-size:11px;margin-top:8px;">'+App.fmtNum(rc)+' rules &middot; '+App.fmtNum(typeCount)+' target types</div>';
    panel.appendChild(head);

    var popBtn = document.createElement('button');
    popBtn.className = 'btn-ghost';
    popBtn.type = 'button';
    popBtn.textContent = 'POP OUT';
    popBtn.style.width = '100%';
    popBtn.style.marginBottom = '14px';
    popBtn.onclick = function(){ spawnFloatingWindow(domain, buildDomainSummaryHTML(domain)); };
    panel.appendChild(popBtn);

    var connected = buildConnectedDomains(domain, 12);
    if(connected.length){
      panel.appendChild(App.el('h3','','CONNECTED DOMAINS ('+connected.length+')'));
      var connWrap = App.el('div','');
      connected.forEach(function(c){
        var row = App.el('div','perm-target-row');
        var nm = App.el('span','target-name', App.escapeHTML(c.domain)+' <span style="color:var(--text2)">('+c.overlap+')</span>');
        nm.onclick = function(){
          var liveCtx = state.graphCtx;
          var liveNode = liveCtx && liveCtx.nodeById[c.domain];
          if(liveNode){ expandGraphNode(liveNode); }
          else { openGraphView(c.domain); }
        };
        row.appendChild(nm);
        connWrap.appendChild(row);
      });
      panel.appendChild(connWrap);
    }

    var tmap = App.state.domainTypeMap[domain] || {};
    var typeNames = Object.keys(tmap);
    var byClass = {};
    typeNames.forEach(function(t){
      tmap[t].forEach(function(en){
        if(!byClass[en.c]) byClass[en.c]=[];
        byClass[en.c].push({type:t, perms:en.p});
      });
    });
    panel.appendChild(App.el('h3','','PERMISSIONS BY CLASS ('+Object.keys(byClass).length+')'));
    Object.keys(byClass).sort().forEach(function(cls){
      var group = document.createElement('details');
      group.className = 'perm-class-group';
      var summary = document.createElement('summary');
      summary.innerHTML = '<span>'+App.escapeHTML(cls)+'</span><span class="group-count">'+byClass[cls].length+'</span>';
      group.appendChild(summary);
      byClass[cls].sort(function(a,b){ return a.type<b.type?-1:(a.type>b.type?1:0); }).forEach(function(row){
        var tr = App.el('div','perm-target-row');
        var tn = App.el('span','target-name', App.escapeHTML(row.type));
        tn.onclick = function(){ openReverse(row.type); };
        tr.appendChild(tn);
        tr.appendChild(App.el('div','', row.perms.map(App.permBadgeHTML).join(' ')));
        group.appendChild(tr);
      });
      panel.appendChild(group);
    });
    if(typeNames.length===0){
      panel.appendChild(App.el('div','empty-state','This domain grants no outbound access.'));
    }
  }
  function openGraphView(domain){
    captureLastMainView();
    state.graphDomain = domain;
    if(App.activeView==='graph'){
      showSubView('main');
      renderGraphView(domain);
    } else {
      pending = {kind:'graph', domain:domain};
      App.showView('graph');
    }
  }
  function stopGraphTicker(){ if(graphTickerRAF){ cancelAnimationFrame(graphTickerRAF); graphTickerRAF=null; } }

  /* ---- incremental (VirusTotal-style) graph expansion ---- */
  var GRAPH_MAX_DEPTH = 5;               /* layers reachable from center via clicking */
  var GRAPH_LAYER_OPACITY = [1, 1, 0.82, 0.66, 0.52, 0.4];
  var GRAPH_LAYER_SCALE   = [1, 1, 0.92, 0.84, 0.76, 0.68];
  var GRAPH_EXPAND_LIMIT = 15;           /* neighbors pulled in per click-expansion */
  var graphDragBehavior = d3.drag().on('drag', function(ev,d){
    if(d.isCenter) return;
    d.fx = ev.x; d.fy = ev.y;
    d.x = ev.x; d.y = ev.y;
  });
  function graphLayerOpacity(depth){
    var i = Math.max(0, Math.min(depth, GRAPH_LAYER_OPACITY.length-1));
    return GRAPH_LAYER_OPACITY[i];
  }
  function graphNodeRadius(d){
    if(d.isCenter) return 26;
    var base = Math.max(6, 6+Math.log2(1+d.ruleCount));
    var i = Math.max(0, Math.min(d.depth, GRAPH_LAYER_SCALE.length-1));
    return base*GRAPH_LAYER_SCALE[i];
  }
  function graphNodeGlow(d){
    if(d.isCenter) return 'drop-shadow(0 0 14px #00fff2)';
    var blur = Math.max(1.5, 3.5 - d.depth*0.5);
    return 'drop-shadow(0 0 '+blur+'px '+(App.CAT_COLORS[d.category]||'#8888aa')+')';
  }
  function graphTargetR(category, maxR){
    var ridx = App.CATS.indexOf(category||'other');
    if(ridx<0) ridx = App.CATS.length-1;
    var frac = 0.32 + 0.68*(ridx/(App.CATS.length-1));
    return frac*maxR;
  }
  function graphNodeKeyOf(d){ return d.id; }
  function graphLinkKey(a,b){ return a<b ? a+'�'+b : b+'�'+a; }
  function graphLinkKeyOf(d){ return graphLinkKey(d.source.id, d.target.id); }
  function graphLinkMouseMove(ev,d){
    var a = d.source, b = d.target;
    var setA = App.state.domainTypeSet[a.id], setB = App.state.domainTypeSet[b.id];
    var shared=[];
    if(setA && setB){ setA.forEach(function(t){ if(setB.has(t)) shared.push(t); }); }
    shared.sort();
    var html = '<span class="tt-title">'+App.escapeHTML(a.id)+' &harr; '+App.escapeHTML(b.id)+'</span>'+
      '<div style="color:var(--text2);font-size:10px;">'+shared.length+' shared target types</div>';
    shared.slice(0,6).forEach(function(t){ html += '<div>&middot; '+App.escapeHTML(t)+'</div>'; });
    if(shared.length>6) html += '<div style="color:var(--text2)">+'+(shared.length-6)+' more</div>';
    App.tooltip.show(ev.clientX, ev.clientY, html);
  }
  function graphNodeMouseMove(ev,d){
    var layerInfo = d.isCenter ? 'center' : ('layer '+d.depth+' &middot; '+d.overlap+' shared target types');
    var html = '<span class="tt-title">'+App.escapeHTML(d.id)+'</span>'+
      '<div style="color:var(--text2);font-size:10px;">'+App.CAT_LABELS[d.category]+' &middot; '+layerInfo+'</div>';
    App.tooltip.show(ev.clientX,ev.clientY,html);
  }
  function graphNodeClick(ev,d){
    ev.stopPropagation();
    expandGraphNode(d, ev);
  }
  function appendLinkVisuals(sel){
    return sel.attr('stroke','#39ff88')
      .attr('stroke-dasharray','4 3')
      .attr('stroke-width', function(d){ return Math.min(4, 0.8+Math.log2(1+d.shared)); })
      .attr('stroke-opacity', function(d){ return 0.55*graphLayerOpacity(Math.max(d.source.depth||0, d.target.depth||0)); })
      .style('cursor','pointer')
      .on('mousemove', graphLinkMouseMove)
      .on('mouseleave', App.tooltip.hide);
  }
  function appendNodeVisuals(sel){
    sel.append('polygon')
      .attr('points', function(d){ return hexPoints(graphNodeRadius(d)); })
      .attr('fill', function(d){ return d.isCenter?'rgba(0,255,242,0.18)':'rgba(20,20,40,0.9)'; })
      .attr('stroke', function(d){ return App.CAT_COLORS[d.category]||'#8888aa'; })
      .attr('stroke-width', function(d){ return d.isCenter?2.5:1.5; })
      .style('opacity', function(d){ return graphLayerOpacity(d.depth); })
      .style('filter', graphNodeGlow);
    sel.on('mousemove', graphNodeMouseMove).on('mouseleave', App.tooltip.hide).on('click', graphNodeClick);
    sel.call(graphDragBehavior);
    return sel;
  }
  function updateGraphLabels(ctx){
    if(ctx.nodes.length>80){
      if(ctx.labelSel){ ctx.labelSel.remove(); ctx.labelSel=null; }
      return;
    }
    var join = ctx.labelG.selectAll('text.vt-node-label').data(ctx.nodes, graphNodeKeyOf);
    var enter = join.enter().append('text')
      .attr('class','vt-node-label')
      .attr('x', function(d){ return d.x+(d.isCenter?30:12); })
      .attr('y', function(d){ return d.y+3; })
      .text(function(d){ return d.id; });
    ctx.labelSel = enter.merge(join);
  }
  function addGraphLinkIfMissing(ctx, a, b, shared, addedLinksArr){
    var key = graphLinkKey(a.id, b.id);
    if(ctx.linkKeys[key]) return;
    var link = {source:a, target:b, shared:shared};
    ctx.linkKeys[key] = true;
    ctx.links.push(link);
    addedLinksArr.push(link);
  }
  function highlightGraphNode(d){
    var ctx = state.graphCtx;
    if(!ctx || !ctx.nodeSel) return;
    ctx.activeId = d.id;
    ctx.nodeSel.classed('vt-node-active', function(n){ return n.id===d.id; })
      .select('polygon')
      .attr('stroke-width', function(n){
        if(n.id===d.id) return n.isCenter?3.5:3;
        return n.isCenter?2.5:1.5;
      });
  }
  function applyGraphExpansion(ctx, addedNodes, addedLinks){
    var linkEnter = ctx.linkG.selectAll('line').data(ctx.links, graphLinkKeyOf).enter().append('line');
    appendLinkVisuals(linkEnter);
    ctx.linkSel = linkEnter.merge(ctx.linkSel);

    var nodeEnter = ctx.nodeG.selectAll('g.vt-node').data(ctx.nodes, graphNodeKeyOf).enter().append('g')
      .attr('class','vt-node')
      .attr('transform', function(d){ return 'translate('+d.x+','+d.y+')'; })
      .style('cursor','pointer');
    appendNodeVisuals(nodeEnter);
    ctx.nodeSel = nodeEnter.merge(ctx.nodeSel);

    updateGraphLabels(ctx);

    ctx.sim.nodes(ctx.nodes);
    ctx.sim.force('link').links(ctx.links);
    ctx.sim.alpha(Math.max(ctx.sim.alpha(), 0.45)).restart();
    ctx.tickCount = 0;
    ctx.maxTicks = 200;
    if(ctx.loading) ctx.loading.classList.remove('hidden');
    if(!graphTickerRAF){ graphTickerRAF = requestAnimationFrame(ctx.frame); }
  }
  function expandGraphNode(d, ev){
    var ctx = state.graphCtx;
    if(!ctx) return;
    if(d.isCenter){ highlightGraphNode(d); return; }
    if(d.depth >= GRAPH_MAX_DEPTH){
      if(ev){
        App.tooltip.show(ev.clientX, ev.clientY,
          '<span class="tt-title">Max depth reached</span>'+
          '<div style="color:var(--text2);font-size:10px;">Expansion is limited to '+GRAPH_MAX_DEPTH+' layers from '+App.escapeHTML(ctx.domain)+'.</div>');
        setTimeout(App.tooltip.hide, 1800);
      }
      highlightGraphNode(d);
      return;
    }
    if(d.expanded){
      renderGraphPropsPanel(d.id);
      highlightGraphNode(d);
      return;
    }
    d.expanded = true;
    var newConns = buildConnectedDomains(d.id, GRAPH_EXPAND_LIMIT);
    var addedNodes = [], addedLinks = [];
    newConns.forEach(function(c){
      var existing = ctx.nodeById[c.domain];
      if(existing){
        addGraphLinkIfMissing(ctx, d, existing, c.overlap, addedLinks);
        return;
      }
      var node = {
        id: c.domain, isCenter:false, category:App.state.domainCategory[c.domain]||'other',
        overlap:c.overlap, ruleCount:App.state.domainRuleCounts[c.domain]||0, depth:d.depth+1, expanded:false,
        targetR: graphTargetR(App.state.domainCategory[c.domain]||'other', ctx.maxR),
        x: d.x+(Math.random()-0.5)*44, y: d.y+(Math.random()-0.5)*44
      };
      ctx.nodeById[c.domain] = node;
      ctx.nodes.push(node);
      addedNodes.push(node);
      addGraphLinkIfMissing(ctx, d, node, c.overlap, addedLinks);
    });

    if(addedNodes.length || addedLinks.length){
      applyGraphExpansion(ctx, addedNodes, addedLinks);
    }
    renderGraphPropsPanel(d.id);
    highlightGraphNode(d);
  }
  function resetGraphView(){
    if(state.graphDomain) openGraphView(state.graphDomain);
  }
  function renderGraphView(domain){
    stopGraphTicker();
    if(state.graphCtx && state.graphCtx.sim){ state.graphCtx.sim.stop(); }
    state.graphCtx = null;
    state.graphSim = null;

    var rc = App.state.domainRuleCounts[domain]||0;
    var typeCount = App.state.domainTypeSet[domain] ? App.state.domainTypeSet[domain].size : 0;
    els.graphTitle.innerHTML =
      App.escapeHTML(domain)+'<span class="sub">'+App.fmtNum(rc)+' rules &middot; '+App.fmtNum(typeCount)+' target types &middot; '+App.CAT_LABELS[App.state.domainCategory[domain]||'other']+'</span>';

    var container = els.graphContainer;
    var oldSvg = container.querySelector('svg');
    if(oldSvg) oldSvg.remove();
    var loading = els.graphLoading;

    renderGraphPropsPanel(domain);

    var connected = buildConnectedDomains(domain, 30);
    var trailCanvas = els.graphTrailCanvas;
    var width = container.clientWidth||900, height = container.clientHeight||600;
    var tctx = sizeCanvas(trailCanvas, width, height);
    tctx.fillStyle = '#0a0a1a';
    tctx.fillRect(0,0,width,height);

    if(connected.length===0){
      var svgEmpty = d3.select(container).append('svg').attr('width','100%').attr('height','100%');
      svgEmpty.append('text').attr('x','50%').attr('y','50%').attr('text-anchor','middle')
        .attr('fill','#8888aa').attr('font-size',12).text('No connected domains (no shared target types).');
      loading.classList.add('hidden');
      return;
    }

    var svg = d3.select(container).append('svg').attr('width','100%').attr('height','100%').attr('viewBox','0 0 '+width+' '+height);
    var zoomG = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.1,8]).on('zoom', function(ev){ zoomG.attr('transform', ev.transform); }));

    var cx = width/2, cy = height/2;
    var maxR = Math.max(60, Math.min(width,height)/2 - 50);

    var ctx = {
      domain: domain, cx: cx, cy: cy, maxR: maxR, width: width, height: height,
      tctx: tctx, container: container, loading: loading,
      nodes: [], links: [], nodeById: {}, linkKeys: {},
      tickCount: 0, maxTicks: 220, activeId: null
    };

    var centerNode = {id:domain, isCenter:true, category:App.state.domainCategory[domain]||'other', ruleCount:rc, depth:0, expanded:true, x:cx, y:cy, fx:cx, fy:cy};
    ctx.nodes.push(centerNode);
    ctx.nodeById[domain] = centerNode;

    connected.forEach(function(c){
      var node = {
        id:c.domain, isCenter:false, category:App.state.domainCategory[c.domain]||'other',
        overlap:c.overlap, ruleCount:App.state.domainRuleCounts[c.domain]||0, depth:1, expanded:false,
        targetR: graphTargetR(App.state.domainCategory[c.domain]||'other', maxR),
        x: cx+(Math.random()-0.5)*30, y: cy+(Math.random()-0.5)*30
      };
      ctx.nodes.push(node);
      ctx.nodeById[c.domain] = node;
      ctx.links.push({source:centerNode, target:node, shared:c.overlap});
      ctx.linkKeys[graphLinkKey(centerNode.id, node.id)] = true;
    });

    loading.classList.remove('hidden');

    ctx.linkG = zoomG.append('g');
    ctx.nodeG = zoomG.append('g');
    ctx.labelG = zoomG.append('g');

    var linkEnter = ctx.linkG.selectAll('line').data(ctx.links, graphLinkKeyOf).enter().append('line');
    ctx.linkSel = appendLinkVisuals(linkEnter);

    var nodeEnter = ctx.nodeG.selectAll('g.vt-node').data(ctx.nodes, graphNodeKeyOf).enter().append('g')
      .attr('class','vt-node')
      .attr('transform', function(d){ return 'translate('+d.x+','+d.y+')'; })
      .style('cursor','pointer');
    ctx.nodeSel = appendNodeVisuals(nodeEnter);

    ctx.labelSel = null;
    updateGraphLabels(ctx);

    var sim = d3.forceSimulation(ctx.nodes)
      .force('radial', d3.forceRadial(function(d){ return d.isCenter?0:d.targetR; }, cx, cy).strength(0.75))
      .force('charge', d3.forceManyBody().strength(-24).distanceMax(120))
      .force('collide', d3.forceCollide(function(d){ return d.isCenter?30:10; }).strength(0.9))
      .force('link', d3.forceLink(ctx.links).distance(function(d){ return 40+180/(1+d.shared); }).strength(0.15));
    sim.stop();
    ctx.sim = sim;

    ctx.positionAll = function(){
      ctx.linkSel.attr('x1', function(d){ return d.source.x; }).attr('y1', function(d){ return d.source.y; })
                 .attr('x2', function(d){ return d.target.x; }).attr('y2', function(d){ return d.target.y; });
      ctx.nodeSel.attr('transform', function(d){ return 'translate('+d.x+','+d.y+')'; });
      if(ctx.labelSel){
        ctx.labelSel.attr('x', function(d){ return d.x+(d.isCenter?30:12); }).attr('y', function(d){ return d.y+3; });
      }
    };
    ctx.drawTrailFrame = function(){
      tctx.fillStyle = 'rgba(10,10,26,0.15)';
      tctx.fillRect(0,0,width,height);
      tctx.save();
      tctx.strokeStyle = 'rgba(57,255,136,0.35)';
      tctx.setLineDash([4,3]);
      tctx.lineWidth = 1;
      ctx.links.forEach(function(l){
        var a = l.source, b = l.target;
        tctx.beginPath();
        tctx.moveTo(a.x, a.y);
        tctx.lineTo(b.x, b.y);
        tctx.stroke();
      });
      tctx.restore();
    };
    ctx.frame = function(){
      ctx.sim.tick();
      ctx.tickCount++;
      ctx.positionAll();
      ctx.drawTrailFrame();
      if(ctx.tickCount<ctx.maxTicks && ctx.sim.alpha()>0.015){
        graphTickerRAF = requestAnimationFrame(ctx.frame);
      } else {
        ctx.sim.stop();
        ctx.loading.classList.add('hidden');
        graphTickerRAF = null;
        var fadeCount=0;
        (function fadeOut(){
          tctx.fillStyle='rgba(10,10,26,0.2)';
          tctx.fillRect(0,0,width,height);
          fadeCount++;
          if(fadeCount<14) requestAnimationFrame(fadeOut);
        })();
      }
    };

    state.graphCtx = ctx;
    state.graphSim = sim;
    graphTickerRAF = requestAnimationFrame(ctx.frame);
  }

  /* ============================================================
     Floating windows -- draggable, resizable, neon-bordered popups
     spawned from graph props-panel pop-out / treemap leaf clicks
     source: monolith lines 3244-3282
     ============================================================ */
  function spawnFloatingWindow(title, bodyHTML, opts){
    opts = opts||{};
    var layer = document.getElementById('floating-windows-layer');
    state.winSeq++;
    var win = App.el('div','floating-window');
    win.id = 'fw-'+state.winSeq;
    var cascade = (state.winSeq%8);
    win.style.left = (opts.x!==undefined?opts.x:80+cascade*26)+'px';
    win.style.top = (opts.y!==undefined?opts.y:100+cascade*22)+'px';
    win.style.zIndex = String(++state.winZ);
    win.innerHTML =
      '<div class="fw-titlebar">'+
        '<span class="fw-title">'+App.escapeHTML(title)+'</span>'+
        '<span class="fw-btns">'+
          '<button class="fw-btn fw-min" type="button" title="minimize">_</button>'+
          '<button class="fw-btn fw-close" type="button" title="close">&times;</button>'+
        '</span>'+
      '</div>'+
      '<div class="fw-body">'+bodyHTML+'</div>';
    layer.appendChild(win);
    win.addEventListener('mousedown', function(){ win.style.zIndex = String(++state.winZ); });
    win.querySelector('.fw-titlebar').addEventListener('mousedown', function(e){
      if(e.target.closest('.fw-btn')) return;
      fwDrag = {win:win, sx:e.clientX, sy:e.clientY, ox:win.offsetLeft, oy:win.offsetTop};
      e.preventDefault();
    });
    win.querySelector('.fw-close').addEventListener('click', function(){ win.remove(); });
    win.querySelector('.fw-min').addEventListener('click', function(){ win.classList.toggle('minimized'); });
    return win;
  }
  function initFloatingWindowDrag(){
    if(fwDragInited) return;
    fwDragInited = true;
    document.addEventListener('mousemove', function(e){
      if(!fwDrag) return;
      fwDrag.win.style.left = Math.max(0, fwDrag.ox+(e.clientX-fwDrag.sx))+'px';
      fwDrag.win.style.top = Math.max(0, fwDrag.oy+(e.clientY-fwDrag.sy))+'px';
    });
    document.addEventListener('mouseup', function(){ fwDrag=null; });
  }

  /* ============================================================
     Subview switching + view lifecycle glue (this module's own --
     the monolith toggled #view-graph/#view-reverse/#view-compare
     as top-level siblings via a global showView(); here all three
     live inside this one registered view and are toggled locally)
     ============================================================ */
  function captureLastMainView(){
    var av = App.activeView;
    if(av && av!=='graph'){ state.lastMainView = av; }
  }
  function showSubView(name){
    ['main','reverse','compare'].forEach(function(v){
      var e = els['subview_'+v];
      if(e) e.classList.toggle('active', v===name);
    });
    App.tooltip.hide();
  }
  function onGraphResize(){
    if(!App.data) return;
    if(els.subview_main && els.subview_main.classList.contains('active') && state.graphDomain){
      sizeCanvas(els.graphTrailCanvas, els.graphContainer.clientWidth, els.graphContainer.clientHeight);
    }
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createGraph(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (graph / reverse / compare subviews) inside container */
    var root = App.el('div','graph-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.subview_main = root.querySelector('#graph-subview-main');
    els.subview_reverse = root.querySelector('#graph-subview-reverse');
    els.subview_compare = root.querySelector('#graph-subview-compare');

    els.btnBackGraph = root.querySelector('#btn-back-graph');
    els.graphTitle = root.querySelector('#graph-title');
    els.btnGraphReset = root.querySelector('#btn-graph-reset');
    els.propsPanel = root.querySelector('#vt-props-panel');
    els.graphContainer = root.querySelector('#graph-container');
    els.graphTrailCanvas = root.querySelector('#graph-trail-canvas');
    els.graphLoading = root.querySelector('#graph-loading');

    els.btnBackReverse = root.querySelector('#btn-back-reverse');
    els.reverseTitle = root.querySelector('#reverse-title');
    els.reverseList = root.querySelector('#reverse-list');

    els.btnBackCompare = root.querySelector('#btn-back-compare');
    els.compareTitle = root.querySelector('#compare-title');
    els.compareColumns = root.querySelector('#compare-columns');

    /* 3. Wire event listeners (source: monolith lines 4167-4170) */
    els.btnBackGraph.addEventListener('click', function(){ App.showView(state.lastMainView==='graph'?'treemap':state.lastMainView); });
    els.btnGraphReset.addEventListener('click', resetGraphView);
    els.btnBackReverse.addEventListener('click', function(){ App.showView(state.lastMainView); });
    els.btnBackCompare.addEventListener('click', function(){ App.showView(state.lastMainView); });

    /* floating-window drag listeners are process-global and only
       need to be wired once, ever -- not per create()/destroy() */
    initFloatingWindowDrag();

    /* 4. Render whatever was requested (or fall back to the
       monolith's tab-click behavior: re-show the last-inspected
       domain, else prompt the user to pick one) */
    if(pending){
      var p = pending; pending = null;
      if(p.kind==='reverse'){ renderReverse(p.type); showSubView('reverse'); }
      else if(p.kind==='compare'){ renderCompare(p.a, p.b); showSubView('compare'); }
      else { state.graphDomain = p.domain; showSubView('main'); renderGraphView(p.domain); }
    } else if(state.graphDomain){
      showSubView('main');
      renderGraphView(state.graphDomain);
    } else {
      showSubView('main');
      els.propsPanel.innerHTML = '<div class="empty-state">Select a domain from TREEMAP, HEATMAP, or search to inspect its graph.</div>';
    }
  }

  function destroyGraph(){
    stopGraphTicker();
    if(state.graphCtx && state.graphCtx.sim){ state.graphCtx.sim.stop(); }
    state.graphCtx = null;
    state.graphSim = null;

    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs (note: state.graphDomain/lastMainView/winZ/winSeq
       are intentionally NOT reset -- they persist across view
       switches, matching the monolith's persistent S object) */
    els = {};
  }

  /* Expose for other views (heatmap.js, treemap.js) to call into,
     matching the monolith's global openGraphView/openReverse/
     openCompareView/spawnFloatingWindow entry points */
  App.openGraphView = openGraphView;
  App.openReverse = openReverse;
  App.openCompareView = openCompareView;
  App.spawnFloatingWindow = spawnFloatingWindow;

  App.registerView('graph', { label: 'GRAPH', icon: '⌖', create: createGraph, destroy: destroyGraph, onResize: onGraphResize });
})();
