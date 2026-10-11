/* pivot.js -- adversarial pivot/threat finder + relay finder panel, ported from sepolicy_viz.html monolith */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: monolith lines 582-656 (pivot finder), 485-519 (relay
     finder panel). Also carries .hm-filter-toggle (monolith lines
     377-378, shared with heatmap's HIDE COMMON checkbox) and
     .cell-popup-close (monolith lines 425-426, shared with the
     matrix cell popup) since this view's markup reuses both and
     neither lives in theme.css or an already-loaded view module --
     each view module is self-contained and its CSS is removed on
     destroy, so classes reused by this view's markup must be
     re-declared here too. #view-pivot is renamed to .pivot-root
     (this module's own container class, monolith used a persistent
     top-level <section id="view-pivot">).
     ============================================================ */
  var CSS = ''
    + '.btn-ghost.purple{color:var(--purple2);border-color:var(--purple2);}'
    + '.btn-ghost.purple:hover{background:rgba(144,112,176,0.08);}'
    + '.relay-panel{'
    +   'position:fixed;top:var(--topbar-h);right:0;bottom:0;width:340px;z-index:800;'
    +   'background:rgba(15,15,30,0.97);border-left:1px solid var(--purple2);'
    +   'box-shadow:-4px 0 12px rgba(0,0,0,0.3);'
    +   'display:flex;flex-direction:column;'
    +   'transform:translateX(0);transition:transform .2s ease;'
    + '}'
    + '.relay-panel.hidden{transform:translateX(100%);pointer-events:none;box-shadow:none;}'
    + '.relay-panel-head{'
    +   'display:flex;align-items:center;justify-content:space-between;'
    +   'padding:10px 14px;border-bottom:1px solid var(--border);'
    +   'color:var(--purple2);font-size:12px;letter-spacing:1px;'
    + '}'
    + '.relay-panel-body{flex:1;overflow-y:auto;padding:14px;}'
    + '.relay-select-row{margin-bottom:10px;}'
    + '.relay-select-row label{display:block;font-size:10px;color:var(--text2);letter-spacing:.5px;margin-bottom:4px;}'
    + '.relay-select-row input{'
    +   'width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);'
    +   'padding:7px 8px;font-size:12px;font-family:var(--font);'
    + '}'
    + '.relay-select-row input:focus{outline:none;border-color:var(--purple2);}'
    + '.relay-summary{color:var(--text2);font-size:11px;margin:10px 0;padding:8px 10px;border:1px solid var(--border);background:var(--surface);}'
    + '.relay-results{display:flex;flex-direction:column;gap:6px;}'
    + '.relay-row{border:1px solid var(--border);background:var(--surface);padding:8px 10px;font-size:11px;cursor:pointer;}'
    + '.relay-row:hover{border-color:var(--purple2);}'
    + '.relay-row .rl-head{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;}'
    + '.relay-row .rl-target{color:var(--amber);}'
    + '.relay-row .rl-rarity{color:var(--text2);font-size:9px;margin-bottom:2px;}'
    + '.relay-tag{font-size:9px;padding:1px 5px;border:1px solid currentColor;text-transform:uppercase;letter-spacing:.5px;}'
    + '.relay-tag.complementary{color:var(--green2);}'
    + '.relay-tag.identical{color:var(--amber);}'
    + '.relay-tag.mixed{color:var(--text2);}'
    + '.relay-row .rl-side{margin-top:2px;font-size:10px;color:var(--text2);}'
    + '.hm-filter-toggle{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--green);cursor:pointer;white-space:nowrap;letter-spacing:.5px;}'
    + '.hm-filter-toggle input{accent-color:var(--green);cursor:pointer;}'
    + '.cell-popup-close{background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;}'
    + '.cell-popup-close:hover{color:var(--magenta);}'
    + '.pivot-root{padding:1.2rem 1.5rem;overflow-y:auto;max-height:calc(100vh - 80px);}'
    + '.pivot-header{display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;}'
    + '.pivot-header h2{font:700 1.1rem var(--font);color:var(--cyan);text-transform:uppercase;letter-spacing:.12em;margin:0;}'
    + '.pivot-filters{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;min-height:32px;}'
    + '.pivot-chip{display:inline-flex;align-items:center;gap:.35rem;padding:3px 10px;border-radius:3px;font:600 .72rem var(--font);text-transform:uppercase;letter-spacing:.06em;border:1px solid;cursor:default;animation:pivotChipIn .25s ease-out;}'
    + '.pivot-chip .chip-x{cursor:pointer;opacity:.6;font-size:.85rem;margin-left:2px;}'
    + '.pivot-chip .chip-x:hover{opacity:1;}'
    + '.pivot-pipe{color:var(--text2);font-size:1rem;opacity:.5;font-weight:700;}'
    + '.pivot-clear{font:600 .68rem var(--font);color:var(--red);background:none;border:1px solid rgba(255,51,85,.25);padding:3px 10px;border-radius:3px;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;}'
    + '.pivot-clear:hover{background:rgba(255,51,85,.12);border-color:var(--red);}'
    + '@keyframes pivotChipIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}'
    + '.pivot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.4rem;}'
    + '.pivot-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:.4rem .5rem;cursor:pointer;transition:border-color .18s,box-shadow .18s;overflow:hidden;}'
    + '.pivot-card:hover{border-color:var(--text2);}'
    + '.pivot-card.active{border-width:2px;}'
    + '.pivot-card.danger-critical:hover,.pivot-card.danger-critical.active{border-color:var(--red);}'
    + '.pivot-card.danger-critical.active{background:rgba(224,85,85,.06);}'
    + '.pivot-card.danger-high:hover,.pivot-card.danger-high.active{border-color:var(--magenta);}'
    + '.pivot-card.danger-high.active{background:rgba(208,122,184,.05);}'
    + '.pivot-card.danger-medium:hover,.pivot-card.danger-medium.active{border-color:var(--amber);}'
    + '.pivot-card.danger-medium.active{background:rgba(224,168,64,.05);}'
    + '.pivot-card.danger-low:hover,.pivot-card.danger-low.active{border-color:var(--cyan);}'
    + '.pivot-card.danger-low.active{background:rgba(77,216,208,.04);}'
    + '.pivot-card-icon{font-size:.85rem;display:inline;margin-right:.3rem;}'
    + '.pivot-card-name{font:700 .68rem var(--font);text-transform:uppercase;letter-spacing:.06em;display:inline;}'
    + '.pivot-card-count{font:400 .6rem var(--font);color:var(--text2);margin-top:.2rem;}'
    + '.pivot-card-count span{font-weight:700;font-size:.68rem;}'
    + '.pivot-card-bar{display:none;}'
    + '.chip-critical{color:var(--red);border-color:rgba(255,51,85,.5);background:rgba(255,51,85,.08);}'
    + '.chip-high{color:var(--magenta);border-color:rgba(255,0,255,.4);background:rgba(255,0,255,.06);}'
    + '.chip-medium{color:var(--amber);border-color:rgba(255,170,0,.4);background:rgba(255,170,0,.06);}'
    + '.chip-low{color:var(--cyan);border-color:rgba(0,255,242,.35);background:rgba(0,255,242,.05);}'
    + '.pivot-results{margin-top:1rem;}'
    + '.pivot-results-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;padding:0 .3rem;}'
    + '.pivot-results-title{font:700 .78rem var(--font);color:var(--text2);text-transform:uppercase;letter-spacing:.08em;}'
    + '.pivot-results-count{font:400 .7rem var(--font);color:var(--text2);}'
    + '.pivot-domain-list{display:flex;flex-direction:column;gap:3px;}'
    + '.pivot-domain-row{display:flex;align-items:center;gap:.7rem;padding:.45rem .7rem;background:var(--surface);border:1px solid var(--border);border-radius:3px;cursor:pointer;transition:border-color .15s,background .15s;}'
    + '.pivot-domain-row:hover{border-color:var(--cyan);background:var(--surface2);}'
    + '.pivot-domain-name{font:600 .75rem var(--font);color:var(--text);min-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.pivot-domain-uid{font:400 .65rem var(--font);color:var(--text2);min-width:70px;}'
    + '.pivot-domain-tags{display:flex;gap:3px;flex-wrap:wrap;flex:1;}'
    + '.pivot-tag{font-size:8px;padding:1px 4px;border:1px solid currentColor;border-radius:2px;letter-spacing:.3px;white-space:nowrap;}'
    + '.pivot-tag.tag-critical{color:var(--red);}'
    + '.pivot-tag.tag-high{color:var(--magenta);}'
    + '.pivot-tag.tag-medium{color:var(--amber);}'
    + '.pivot-tag.tag-low{color:var(--cyan);}'
    + '.pivot-domain-caps{font:600 .65rem var(--font);color:var(--red);min-width:36px;text-align:right;}'
    + '.pivot-domain-targets{font:400 .65rem var(--font);color:var(--text2);min-width:44px;text-align:right;}'
    + '.pivot-domain-score{font:700 .78rem var(--font);min-width:32px;text-align:center;padding:2px 6px;border-radius:3px;letter-spacing:.05em;}'
    + '.pivot-domain-score.score-high{color:var(--red);background:rgba(224,85,85,.1);}'
    + '.pivot-domain-score.score-med{color:var(--amber);background:rgba(255,170,0,.08);}'
    + '.pivot-domain-score.score-low{color:var(--cyan);background:rgba(0,255,242,.06);}'
    + '.pivot-domain-row.pivot-hot{border-left:2px solid var(--red);}'
    + '@keyframes pivotHotPulse{0%,100%{box-shadow:none;}50%{box-shadow:0 0 12px rgba(255,51,85,.2);}}'
    + '.pivot-empty{padding:2rem;text-align:center;font:400 .8rem var(--font);color:var(--text2);}';
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from monolith markup lines 777-795
     for the pivot section, 827-845 for the relay panel aside).
     The RELAY FINDER toggle button lived in the global header in
     the monolith (line 677); since this module cannot touch
     index.html's chrome, it is folded into the pivot header here.
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="pivot-root">'
    +   '<div class="pivot-header">'
    +     '<h2>PIVOT FINDER</h2>'
    +     '<label class="hm-filter-toggle" style="margin-left:16px;" title="Show all 17 high-value permission combos with matching domains and UIDs">'
    +       '<input type="checkbox" id="chk-high-value-combos"> HIGH VALUE COMBOS'
    +     '</label>'
    +     '<button id="btn-relay-toggle" class="btn-ghost purple" type="button" style="margin-left:8px;">RELAY FINDER</button>'
    +     '<div class="pivot-export" style="margin-left:auto;display:flex;align-items:center;gap:4px;">'
    +       '<input type="text" id="pivot-export-name" placeholder="report_name" style="width:120px;font-size:10px;padding:2px 6px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:2px;font-family:inherit;">'
    +       '<button class="btn-ghost" id="btn-export-txt" type="button" style="font-size:10px;padding:2px 6px;">TXT</button>'
    +       '<button class="btn-ghost" id="btn-export-tsv" type="button" style="font-size:10px;padding:2px 6px;">TSV</button>'
    +       '<button class="btn-ghost" id="btn-export-csv" type="button" style="font-size:10px;padding:2px 6px;">CSV</button>'
    +     '</div>'
    +     '<div class="pivot-filters" id="pivot-filters"></div>'
    +   '</div>'
    +   '<div id="pivot-presets" class="pivot-presets" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:0 8px;"></div>'
    +   '<div id="pivot-high-value" class="pivot-results" style="display:none;"></div>'
    +   '<div id="pivot-grid" class="pivot-grid"></div>'
    +   '<div id="pivot-results" class="pivot-results"></div>'
    + '</div>'
    + '<aside id="relay-panel" class="relay-panel hidden">'
    +   '<div class="relay-panel-head">'
    +     '<span>RELAY FINDER</span>'
    +     '<button id="btn-relay-close" class="cell-popup-close" type="button">&times;</button>'
    +   '</div>'
    +   '<div class="relay-panel-body">'
    +     '<div class="relay-select-row">'
    +       '<label>DOMAIN A</label>'
    +       '<input id="relay-domain-a" list="relay-domains-list" placeholder="type to search..." autocomplete="off">'
    +     '</div>'
    +     '<div class="relay-select-row">'
    +       '<label>DOMAIN B</label>'
    +       '<input id="relay-domain-b" list="relay-domains-list" placeholder="type to search..." autocomplete="off">'
    +     '</div>'
    +     '<datalist id="relay-domains-list"></datalist>'
    +     '<div id="relay-summary" class="relay-summary">Pick two domains to find shared / complementary target types.</div>'
    +     '<div id="relay-results" class="relay-results"></div>'
    +   '</div>'
    + '</aside>';

  /* ============================================================
     Local state (replaces S.pivotFilters / S.pivotShowHighValue /
     S.relayOpen, which are view-specific and not shared with other
     modules, unlike S.pivotIndex/S.pivotCatDomains/S.pivotBuilt
     which App.pivotPrecompute() populates onto App.state)
     ============================================================ */
  var pivotFilters = [];
  var pivotShowHighValue = false;
  var relayOpen = false;

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  /* ============================================================
     High-value combo presets, monolith line 3578 (kept local --
     pivot-specific, not shared with other views)
     ============================================================ */
  var PIVOT_PRESETS = [
    {label:'SHELL+SETUID', keys:['shell_exec','cap_setuid'], danger:'critical'},
    {label:'SHELL+TCP', keys:['shell_exec','tcp_bind'], danger:'critical'},
    {label:'SHELL+SYSADMIN', keys:['shell_exec','cap_sysadmin'], danger:'critical'},
    {label:'SETUID+TCP', keys:['cap_setuid','tcp_bind'], danger:'high'},
    {label:'MODULE LOAD', keys:['module_load'], danger:'critical'},
    {label:'MODULE LOAD (V)', keys:['vendor_module_load'], danger:'critical'},
    {label:'SELINUX WRITE', keys:['selinux_write'], danger:'critical'},
    {label:'SELINUX DISABLE', keys:['selinux_write','cap2_mac_admin'], danger:'critical'},
    {label:'BLK+SHELL', keys:['blk_read','shell_exec'], danger:'high'},
    {label:'PTRACE+SHELL', keys:['process_ptrace','shell_exec'], danger:'high'},
    {label:'DEVNODE+SETUID', keys:['device_node','cap_setuid'], danger:'high'},
    {label:'SOCKET+BINDER', keys:['unix_socket','binder_call'], danger:'medium'},
    {label:'WRITE+SHELL', keys:['sensitive_write','shell_exec'], danger:'high'},
    {label:'SYSADMIN+TCP', keys:['cap_sysadmin','tcp_bind'], danger:'high'},
    {label:'CAP2 SYSLOG', keys:['cap2_syslog'], danger:'medium'},
    {label:'DAC+SETUID', keys:['cap_dac_override','cap_setuid'], danger:'critical'},
    {label:'SETUID+SYSADMIN', keys:['cap_setuid','cap_sysadmin'], danger:'critical'},
    {label:'PTRACE+SETUID', keys:['process_ptrace','cap_setuid'], danger:'critical'},
    {label:'DAC+SHELL', keys:['cap_dac_override','shell_exec'], danger:'critical'},
    {label:'PROP+SHELL', keys:['prop_set','shell_exec'], danger:'high'},
    {label:'RAW+TCP', keys:['raw_socket','tcp_bind'], danger:'high'},
    {label:'WRITE+SETUID', keys:['sensitive_write','cap_setuid'], danger:'critical'},
    {label:'BLK+SETUID', keys:['blk_read','cap_setuid'], danger:'critical'},
    {label:'MODULE+SHELL', keys:['module_load','shell_exec'], danger:'critical'},
    {label:'DEVNODE+SYSADMIN', keys:['device_node','cap_sysadmin'], danger:'high'},
    {label:'BINDER+PTRACE', keys:['binder_call','process_ptrace'], danger:'high'},
    {label:'SELINUX+SHELL', keys:['selinux_write','shell_exec'], danger:'critical'},
    {label:'DAC+WRITE', keys:['cap_dac_override','sensitive_write'], danger:'high'}
  ];

  /* ============================================================
     Shared dependency helpers duplicated from elsewhere in the
     monolith (used by computeRelay/renderRelayResults below but
     not themselves part of the relay-finder block; monolith
     comment: "Relation classification -- shared by Graph View
     edge tooltips and the Relay Finder", lines 2534-2559)
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
     Relay finder -- finds target types where two domains both hold
     grants, flags complementary (one writes what the other reads)
     vs identical access, ranked by rarity (fewer holders = rarer)
     source: monolith lines 3171-3238
     ============================================================ */
  function populateRelayDatalist(){
    var dl = els.relayDomainsList;
    dl.innerHTML = App.state.domains.map(function(d){ return '<option value="'+App.escapeHTML(d)+'">'; }).join('');
  }
  function toggleRelayPanel(force){
    var panel = els.relayPanel;
    relayOpen = (force!==undefined) ? force : !relayOpen;
    panel.classList.toggle('hidden', !relayOpen);
  }
  function computeRelay(a,b){
    var setA = App.state.domainTypeSet[a], setB = App.state.domainTypeSet[b];
    if(!setA || !setB) return [];
    var shared = [];
    setA.forEach(function(t){ if(setB.has(t)) shared.push(t); });
    var rows = shared.map(function(t){
      var entriesA = App.state.domainTypeMap[a][t], entriesB = App.state.domainTypeMap[b][t];
      return {
        type:t,
        domainCount: App.state.typeDomainCount[t]||1,
        relation: classifyRelation(entriesA, entriesB),
        entriesA:entriesA, entriesB:entriesB
      };
    });
    rows.sort(function(x,y){ return x.domainCount-y.domainCount; });
    return rows;
  }
  function renderRelayResults(a,b){
    var summary = els.relaySummary;
    var results = els.relayResults;
    results.innerHTML = '';
    if(App.state.domainRowIndex[a]===undefined || App.state.domainRowIndex[b]===undefined || a===b){
      summary.textContent = 'Select two different, valid domains.';
      return;
    }
    var rows = computeRelay(a,b);
    var nComp = rows.filter(function(r){return r.relation==='complementary';}).length;
    var nIdent = rows.filter(function(r){return r.relation==='identical';}).length;
    summary.innerHTML = App.fmtNum(rows.length)+' shared target types &middot; <span style="color:var(--green2)">'+nComp+' complementary</span> &middot; <span style="color:var(--amber)">'+nIdent+' identical</span>';
    if(rows.length===0){ results.appendChild(App.el('div','empty-state','No shared target types.')); return; }
    rows.forEach(function(r){
      var row = App.el('div','relay-row');
      var head = App.el('div','rl-head');
      head.appendChild(App.el('span','rl-target', App.escapeHTML(r.type)));
      head.appendChild(App.el('span','relay-tag '+r.relation, r.relation));
      row.appendChild(head);
      row.appendChild(App.el('div','rl-rarity', 'shared by '+App.fmtNum(r.domainCount)+' domain'+(r.domainCount===1?'':'s')+' total'));
      row.appendChild(App.el('div','rl-side', '<b style="color:var(--cyan)">A</b> '+r.entriesA.map(function(en){return App.escapeHTML(en.c)+':'+en.p.length;}).join(', ')));
      row.appendChild(App.el('div','rl-side', '<b style="color:var(--magenta)">B</b> '+r.entriesB.map(function(en){return App.escapeHTML(en.c)+':'+en.p.length;}).join(', ')));
      row.onclick = function(){
        var html = '<h4>'+App.escapeHTML(a)+' &harr; '+App.escapeHTML(b)+'</h4>'+
          '<div style="color:var(--amber);margin-bottom:6px;">'+App.escapeHTML(r.type)+'</div>'+
          '<div style="margin-bottom:6px;"><b style="color:var(--cyan)">'+App.escapeHTML(a)+'</b><br>'+r.entriesA.map(function(en){return App.escapeHTML(en.c)+': '+en.p.map(App.permBadgeHTML).join(' ');}).join('<br>')+'</div>'+
          '<div><b style="color:var(--magenta)">'+App.escapeHTML(b)+'</b><br>'+r.entriesB.map(function(en){return App.escapeHTML(en.c)+': '+en.p.map(App.permBadgeHTML).join(' ');}).join('<br>')+'</div>';
        if(App.spawnFloatingWindow) App.spawnFloatingWindow(a+' <-> '+b, html);
      };
      results.appendChild(row);
    });
  }
  var onRelayInputChange = App.debounce(function(){
    var a = els.relayDomainA.value.trim();
    var b = els.relayDomainB.value.trim();
    if(a && b) renderRelayResults(a,b);
  }, 150);

  /* ============================================================
     Pivot Finder -- rendering, filter stacking
     App.pivotPrecompute() (data.js) already populates
     App.state.pivotIndex / App.state.pivotCatDomains /
     App.state.pivotBuilt -- do NOT re-implement it here.
     source: monolith lines 3388-3813 (minus pivotPrecompute
     itself, already ported to data.js)
     ============================================================ */
  function pivotDangerClass(danger){
    return 'danger-'+danger;
  }
  function pivotChipClass(danger){
    return 'chip-'+danger;
  }
  function pivotThreatScore(domain){
    var cats = App.state.pivotIndex[domain];
    if(!cats) return 0;
    var score = 0;
    cats.forEach(function(ck){
      for(var i=0;i<App.PIVOT_CATEGORIES.length;i++){
        if(App.PIVOT_CATEGORIES[i].key===ck){
          if(App.PIVOT_CATEGORIES[i].danger==='critical') score += 4;
          else if(App.PIVOT_CATEGORIES[i].danger==='high') score += 3;
          else if(App.PIVOT_CATEGORIES[i].danger==='medium') score += 2;
          else score += 1;
          break;
        }
      }
    });
    return score;
  }

  function pivotCatByKey(key){
    for(var i=0;i<App.PIVOT_CATEGORIES.length;i++){
      if(App.PIVOT_CATEGORIES[i].key===key) return App.PIVOT_CATEGORIES[i];
    }
    return null;
  }

  function renderPivotGrid(){
    var grid = els.pivotGrid;
    grid.innerHTML = '';
    var maxCount = 0;
    for(var i=0;i<App.PIVOT_CATEGORIES.length;i++){
      var cnt = App.state.pivotCatDomains[App.PIVOT_CATEGORIES[i].key].length;
      if(cnt>maxCount) maxCount = cnt;
    }
    for(var ci=0;ci<App.PIVOT_CATEGORIES.length;ci++){
      var cat = App.PIVOT_CATEGORIES[ci];
      var count = App.state.pivotCatDomains[cat.key].length;
      var card = App.el('div','pivot-card '+pivotDangerClass(cat.danger));
      card.dataset.catkey = cat.key;
      if(pivotFilters.indexOf(cat.key)!==-1) card.classList.add('active');
      var iconSpan = App.el('span','pivot-card-icon','');
      iconSpan.textContent = cat.icon;
      iconSpan.style.color = App.DANGER_COLORS[cat.danger];
      card.appendChild(iconSpan);
      card.appendChild(App.el('div','pivot-card-name',App.escapeHTML(cat.label)));
      card.appendChild(App.el('div','pivot-card-count','<span>'+App.fmtNum(count)+'</span> domain'+(count===1?'':'s')));
      var bar = App.el('div','pivot-card-bar','');
      bar.style.width = (maxCount>0? Math.round(count/maxCount*100) : 0)+'%';
      bar.style.background = App.DANGER_COLORS[cat.danger];
      card.appendChild(bar);
      card.addEventListener('click', (function(key){ return function(){ pivotToggleFilter(key); }; })(cat.key));
      grid.appendChild(card);
    }
  }

  function pivotToggleFilter(catKey){
    var idx = pivotFilters.indexOf(catKey);
    if(idx===-1){
      pivotFilters.push(catKey);
    } else {
      pivotFilters.splice(idx,1);
    }
    renderPivotView();
  }

  function pivotRemoveFilter(catKey){
    var idx = pivotFilters.indexOf(catKey);
    if(idx!==-1) pivotFilters.splice(idx,1);
    renderPivotView();
  }

  function pivotClearFilters(){
    pivotFilters = [];
    renderPivotView();
  }

  function renderPivotFilters(){
    var container = els.pivotFilters;
    container.innerHTML = '';
    if(pivotFilters.length===0) return;
    for(var i=0;i<pivotFilters.length;i++){
      var cat = pivotCatByKey(pivotFilters[i]);
      if(!cat) continue;
      if(i>0){
        container.appendChild(App.el('span','pivot-pipe','|'));
      }
      var chip = App.el('span','pivot-chip '+pivotChipClass(cat.danger), App.escapeHTML(cat.label));
      var x = App.el('span','chip-x','x');
      x.addEventListener('click', (function(key){ return function(e){ e.stopPropagation(); pivotRemoveFilter(key); }; })(cat.key));
      chip.appendChild(x);
      container.appendChild(chip);
    }
    var clearBtn = App.el('button','pivot-clear','CLEAR ALL');
    clearBtn.addEventListener('click', pivotClearFilters);
    container.appendChild(clearBtn);
  }

  function renderPivotResults(){
    var results = els.pivotResults;
    results.innerHTML = '';
    if(pivotFilters.length===0) return;
    /* find domains matching ALL active filters */
    var matching = [];
    for(var di=0;di<App.state.domains.length;di++){
      var domain = App.state.domains[di];
      var cats = App.state.pivotIndex[domain];
      if(!cats) continue;
      var matchAll = true;
      for(var fi=0;fi<pivotFilters.length;fi++){
        if(!cats.has(pivotFilters[fi])){ matchAll=false; break; }
      }
      if(matchAll) matching.push(domain);
    }
    /* sort by threat score descending */
    matching.sort(function(a,b){ return pivotThreatScore(b)-pivotThreatScore(a); });
    /* header */
    var hdr = App.el('div','pivot-results-header','');
    hdr.appendChild(App.el('span','pivot-results-title','Matching domains'));
    hdr.appendChild(App.el('span','pivot-results-count',App.fmtNum(matching.length)+' result'+(matching.length===1?'':'s')));
    results.appendChild(hdr);
    if(matching.length===0){
      results.appendChild(App.el('div','pivot-empty','No domains match all selected filters.'));
      return;
    }
    var list = App.el('div','pivot-domain-list','');
    for(var mi=0;mi<matching.length;mi++){
      var d = matching[mi];
      var score = pivotThreatScore(d);
      var row = App.el('div','pivot-domain-row','');
      /* pulse effect for high-threat domains */
      if(score >= 12) row.classList.add('pivot-hot');
      var nameDiv = App.el('div','pivot-domain-name',App.escapeHTML(App.domainLabel(d)));
      var dCat = App.state.domainCategory[d]||'other';
      if(dCat==='app'){
        var appTag = App.el('span','','APP');
        appTag.style.cssText='font-size:9px;padding:1px 4px;margin-left:6px;border:1px solid #2288ff;color:#2288ff;border-radius:2px;vertical-align:middle;';
        nameDiv.appendChild(appTag);
      } else if(dCat==='vendor'){
        var vendTag = App.el('span','','VENDOR');
        vendTag.style.cssText='font-size:9px;padding:1px 4px;margin-left:6px;border:1px solid #ffaa00;color:#ffaa00;border-radius:2px;vertical-align:middle;';
        nameDiv.appendChild(vendTag);
      } else if(dCat==='hal'){
        var halTag = App.el('span','','HAL');
        halTag.style.cssText='font-size:9px;padding:1px 4px;margin-left:6px;border:1px solid #44ddaa;color:#44ddaa;border-radius:2px;vertical-align:middle;';
        nameDiv.appendChild(halTag);
      }
      if(App.state.permissiveDomains.has(d)){
        var permTag = App.el('span','','PERMISSIVE');
        permTag.style.cssText='font-size:9px;padding:1px 4px;margin-left:6px;border:1px solid #ffff00;color:#ffff00;background:rgba(255,255,0,0.15);border-radius:2px;vertical-align:middle;font-weight:bold;';
        nameDiv.appendChild(permTag);
      }
      row.appendChild(nameDiv);
      var uid = App.domainUid(d);
      row.appendChild(App.el('div','pivot-domain-uid', uid!==null ? 'uid:'+uid : ''));
      /* category tags as readable text labels */
      var tagsDiv = App.el('div','pivot-domain-tags','');
      var dCats = App.state.pivotIndex[d];
      for(var pi=0;pi<App.PIVOT_CATEGORIES.length;pi++){
        var pc = App.PIVOT_CATEGORIES[pi];
        if(dCats.has(pc.key)){
          var tag = App.el('span','pivot-tag tag-'+pc.danger,pc.label);
          tagsDiv.appendChild(tag);
        }
      }
      row.appendChild(tagsDiv);
      /* capability and target counts */
      var capCount = 0, targetCount = 0;
      var rules = App.data.rules;
      for(var ri=0;ri<rules.length;ri++){
        if(rules[ri].s===d){
          if(rules[ri].c==='capability') capCount += rules[ri].p.length;
        }
      }
      targetCount = App.state.domainTypeSet[d] ? App.state.domainTypeSet[d].size : 0;
      row.appendChild(App.el('div','pivot-domain-caps',capCount>0 ? capCount+' caps' : ''));
      row.appendChild(App.el('div','pivot-domain-targets',targetCount+' types'));
      /* threat score badge */
      var scoreEl = App.el('div','pivot-domain-score',String(score));
      if(score>=12) scoreEl.classList.add('score-high');
      else if(score>=6) scoreEl.classList.add('score-med');
      else scoreEl.classList.add('score-low');
      row.appendChild(scoreEl);
      row.addEventListener('click', (function(dom){ return function(){ if(App.openGraphView) App.openGraphView(dom); }; })(d));
      list.appendChild(row);
    }
    results.appendChild(list);
  }

  function renderPivotView(){
    renderPivotPresets();
    renderPivotGrid();
    renderPivotFilters();
    renderPivotResults();
  }

  function renderPivotPresets(){
    var container = els.pivotPresets;
    container.innerHTML = '';
    var lbl = App.el('span','','COMBOS: ');
    lbl.style.cssText='color:var(--text2);font-size:10px;letter-spacing:.5px;align-self:center;margin-right:4px;';
    container.appendChild(lbl);
    for(var i=0;i<PIVOT_PRESETS.length;i++){
      var p = PIVOT_PRESETS[i];
      var btn = App.el('button','btn-ghost','');
      btn.textContent = p.label;
      btn.style.cssText='font-size:10px;padding:2px 8px;border-color:'+(App.DANGER_COLORS[p.danger]||'var(--border)')+';color:'+(App.DANGER_COLORS[p.danger]||'var(--text2)')+';';
      btn.addEventListener('click',(function(keys){return function(){
        pivotFilters = keys.slice();
        renderPivotView();
      };})(p.keys));
      container.appendChild(btn);
    }
  }
  function pivotExportData(){
    if(!App.state.pivotBuilt) App.pivotPrecompute();
    var sections = [];
    var filterDesc = '';
    if(pivotShowHighValue){
      filterDesc = 'High Value Combos (all '+PIVOT_PRESETS.length+' presets)';
      for(var pi=0;pi<PIVOT_PRESETS.length;pi++){
        var preset = PIVOT_PRESETS[pi];
        var matching = [];
        for(var di=0;di<App.state.domains.length;di++){
          var domain = App.state.domains[di];
          var cats = App.state.pivotIndex[domain];
          if(!cats) continue;
          var matchAll = true;
          for(var ki=0;ki<preset.keys.length;ki++){
            if(!cats.has(preset.keys[ki])){ matchAll=false; break; }
          }
          if(matchAll) matching.push(domain);
        }
        matching.sort(function(a,b){ return pivotThreatScore(b)-pivotThreatScore(a); });
        sections.push({combo:preset.label, keys:preset.keys.join('+'), danger:preset.danger, domains:matching});
      }
    } else if(pivotFilters.length>0){
      var filterNames = [];
      for(var fi=0;fi<pivotFilters.length;fi++){
        for(var ci=0;ci<App.PIVOT_CATEGORIES.length;ci++){
          if(App.PIVOT_CATEGORIES[ci].key===pivotFilters[fi]){ filterNames.push(App.PIVOT_CATEGORIES[ci].label); break; }
        }
      }
      filterDesc = filterNames.join(' + ');
      var matching = [];
      for(var di=0;di<App.state.domains.length;di++){
        var domain = App.state.domains[di];
        var cats = App.state.pivotIndex[domain];
        if(!cats) continue;
        var matchAll = true;
        for(var fi2=0;fi2<pivotFilters.length;fi2++){
          if(!cats.has(pivotFilters[fi2])){ matchAll=false; break; }
        }
        if(matchAll) matching.push(domain);
      }
      matching.sort(function(a,b){ return pivotThreatScore(b)-pivotThreatScore(a); });
      sections.push({combo:filterDesc, keys:pivotFilters.join('+'), danger:'custom', domains:matching});
    }
    return {filterDesc:filterDesc, sections:sections};
  }
  function pivotExport(format){
    var ed = pivotExportData();
    if(ed.sections.length===0){ alert('No active filter or High Value Combos to export.'); return; }
    var nameInput = els.pivotExportName;
    var baseName = (nameInput.value||'pivot_export').replace(/[^a-zA-Z0-9_\-]/g,'_');
    var metaSource = (App.data && App.data.meta && App.data.meta.source) ? App.data.meta.source : '';
    var source = metaSource || App.state.loadedFileName || 'unknown';
    var sep = format==='csv' ? ',' : format==='tsv' ? '\t' : '    ';
    var ext = format==='csv' ? '.csv' : format==='tsv' ? '.tsv' : '.txt';
    var lines = [];
    lines.push('Filter: '+ed.filterDesc);
    lines.push('Source Policy Filename: '+source);
    lines.push('');
    if(format==='txt'){
      for(var si=0;si<ed.sections.length;si++){
        var sec = ed.sections[si];
        lines.push('=== '+sec.combo+' ('+sec.keys+') === '+sec.domains.length+' domain(s)');
        if(sec.domains.length===0){ lines.push('  (none)'); }
        for(var di=0;di<sec.domains.length;di++){
          var d = sec.domains[di];
          var uid = App.domainUid(d);
          var uidStr = uid!==null ? 'uid:'+uid : '';
          var cat = App.state.domainCategory[d]||'other';
          lines.push('  '+App.domainLabel(d)+sep+uidStr+sep+cat);
        }
        lines.push('');
      }
    } else {
      lines.push(['Combo','Keys','Domain','UID','Category','Permissive'].join(sep));
      for(var si2=0;si2<ed.sections.length;si2++){
        var sec2 = ed.sections[si2];
        if(sec2.domains.length===0){
          lines.push([sec2.combo,sec2.keys,'(none)','','','',''].join(sep));
        }
        for(var di2=0;di2<sec2.domains.length;di2++){
          var d2 = sec2.domains[di2];
          var uid2 = App.domainUid(d2);
          var uidStr2 = uid2!==null ? String(uid2) : '';
          var cat2 = App.state.domainCategory[d2]||'other';
          var perm2 = App.state.permissiveDomains.has(d2) ? 'YES' : '';
          var label2 = App.domainLabel(d2);
          if(format==='csv'){ label2 = '"'+label2.replace(/"/g,'""')+'"'; }
          lines.push([sec2.combo,sec2.keys,label2,uidStr2,cat2,perm2].join(sep));
        }
      }
    }
    lines.push('');
    lines.push('Report Generated by Viz');
    var blob = new Blob([lines.join('\n')], {type:'text/plain'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = baseName+ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function renderHighValueCombos(){
    var container = els.pivotHighValue;
    if(!pivotShowHighValue){ container.style.display='none'; return; }
    container.style.display='block';
    container.innerHTML='';
    if(!App.state.pivotBuilt) App.pivotPrecompute();
    var hdr = App.el('div','pivot-results-header','');
    hdr.appendChild(App.el('span','pivot-results-title','HIGH VALUE COMBOS'));
    hdr.appendChild(App.el('span','pivot-results-count',PIVOT_PRESETS.length+' combos'));
    container.appendChild(hdr);
    for(var pi=0;pi<PIVOT_PRESETS.length;pi++){
      var preset = PIVOT_PRESETS[pi];
      var matching = [];
      for(var di=0;di<App.state.domains.length;di++){
        var domain = App.state.domains[di];
        var cats = App.state.pivotIndex[domain];
        if(!cats) continue;
        var matchAll = true;
        for(var ki=0;ki<preset.keys.length;ki++){
          if(!cats.has(preset.keys[ki])){ matchAll=false; break; }
        }
        if(matchAll) matching.push(domain);
      }
      matching.sort(function(a,b){ return pivotThreatScore(b)-pivotThreatScore(a); });
      var section = App.el('div','','');
      section.style.cssText='margin-bottom:12px;padding:8px;border:1px solid var(--border);border-radius:4px;border-left:3px solid '+(App.DANGER_COLORS[preset.danger]||'var(--border)')+';';
      var titleRow = App.el('div','','');
      titleRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:6px;';
      var badge = App.el('span','',preset.label);
      badge.style.cssText='font-size:11px;font-weight:bold;letter-spacing:.5px;color:'+(App.DANGER_COLORS[preset.danger]||'var(--text2)')+';';
      titleRow.appendChild(badge);
      var countBadge = App.el('span','',matching.length+' domain'+(matching.length===1?'':'s'));
      countBadge.style.cssText='font-size:10px;color:var(--text2);';
      titleRow.appendChild(countBadge);
      var keysList = App.el('span','',preset.keys.join(' + '));
      keysList.style.cssText='font-size:9px;color:var(--text2);opacity:0.6;margin-left:auto;';
      titleRow.appendChild(keysList);
      section.appendChild(titleRow);
      if(matching.length===0){
        var empty = App.el('div','','No domains match.');
        empty.style.cssText='font-size:10px;color:var(--text2);opacity:0.5;padding-left:4px;';
        section.appendChild(empty);
      } else {
        for(var mi=0;mi<matching.length;mi++){
          var d = matching[mi];
          var row = App.el('div','','');
          row.style.cssText='display:flex;align-items:center;gap:10px;padding:2px 4px;cursor:pointer;border-radius:2px;';
          row.addEventListener('mouseover',function(){this.style.background='var(--surface)';});
          row.addEventListener('mouseout',function(){this.style.background='none';});
          row.addEventListener('click',(function(dom){return function(){ if(App.openGraphView) App.openGraphView(dom); };})(d));
          var uid = App.domainUid(d);
          var uidStr = uid!==null ? 'uid:'+uid : '';
          var lbl = App.domainLabel(d);
          var nameEl = App.el('span','',App.escapeHTML(lbl));
          nameEl.style.cssText='font-size:11px;color:var(--text);min-width:200px;';
          row.appendChild(nameEl);
          var uidEl = App.el('span','',uidStr);
          uidEl.style.cssText='font-size:10px;color:var(--green);min-width:60px;';
          row.appendChild(uidEl);
          var dCat = App.state.domainCategory[d]||'other';
          var catColors = {app:'#2288ff',vendor:'#ffaa00',hal:'#44ddaa',system:'#ff6622',shell:'#b967ff',core:'#ff3355'};
          if(catColors[dCat]){
            var catTag = App.el('span','',dCat.toUpperCase());
            catTag.style.cssText='font-size:9px;padding:1px 4px;border:1px solid '+catColors[dCat]+';color:'+catColors[dCat]+';border-radius:2px;';
            row.appendChild(catTag);
          }
          if(App.state.permissiveDomains.has(d)){
            var ptag = App.el('span','','PERMISSIVE');
            ptag.style.cssText='font-size:9px;padding:1px 4px;border:1px solid #ffff00;color:#ffff00;background:rgba(255,255,0,0.15);border-radius:2px;font-weight:bold;';
            row.appendChild(ptag);
          }
          section.appendChild(row);
        }
      }
      container.appendChild(section);
    }
  }
  function openPivotView(){
    if(!App.state.pivotBuilt) App.pivotPrecompute();
    App.showView('pivot');
    renderPivotView();
    renderHighValueCombos();
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createPivot(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (pivot grid/filters/results + relay panel aside)
       inside container */
    var root = App.el('div','pivot-view-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.chkHighValue = root.querySelector('#chk-high-value-combos');
    els.btnRelayToggle = root.querySelector('#btn-relay-toggle');
    els.pivotExportName = root.querySelector('#pivot-export-name');
    els.btnExportTxt = root.querySelector('#btn-export-txt');
    els.btnExportTsv = root.querySelector('#btn-export-tsv');
    els.btnExportCsv = root.querySelector('#btn-export-csv');
    els.pivotFilters = root.querySelector('#pivot-filters');
    els.pivotPresets = root.querySelector('#pivot-presets');
    els.pivotHighValue = root.querySelector('#pivot-high-value');
    els.pivotGrid = root.querySelector('#pivot-grid');
    els.pivotResults = root.querySelector('#pivot-results');

    els.relayPanel = root.querySelector('#relay-panel');
    els.btnRelayClose = root.querySelector('#btn-relay-close');
    els.relayDomainA = root.querySelector('#relay-domain-a');
    els.relayDomainB = root.querySelector('#relay-domain-b');
    els.relayDomainsList = root.querySelector('#relay-domains-list');
    els.relaySummary = root.querySelector('#relay-summary');
    els.relayResults = root.querySelector('#relay-results');

    /* 3. Wire event listeners (source: monolith lines 4236-4250) */
    els.chkHighValue.addEventListener('change', function(){
      pivotShowHighValue = this.checked;
      renderHighValueCombos();
    });
    els.btnExportTxt.addEventListener('click', function(){ pivotExport('txt'); });
    els.btnExportTsv.addEventListener('click', function(){ pivotExport('tsv'); });
    els.btnExportCsv.addEventListener('click', function(){ pivotExport('csv'); });
    els.btnRelayToggle.addEventListener('click', function(){ toggleRelayPanel(); });
    els.btnRelayClose.addEventListener('click', function(){ toggleRelayPanel(false); });
    els.relayDomainA.addEventListener('input', onRelayInputChange);
    els.relayDomainB.addEventListener('input', onRelayInputChange);

    /* 4. Compute initial data + render (equivalent to the
       monolith's openPivotView(), inlined here rather than calling
       that function directly -- it calls App.showView('pivot'),
       which would recurse back into this create() call) */
    if(!App.state.pivotBuilt) App.pivotPrecompute();
    populateRelayDatalist();
    els.relayPanel.classList.toggle('hidden', !relayOpen);
    renderPivotView();
    renderHighValueCombos();
  }

  function destroyPivot(){
    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if(styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};
  }

  App.registerView('pivot', { label: 'PIVOT', icon: '⚡', create: createPivot, destroy: destroyPivot });
})();
