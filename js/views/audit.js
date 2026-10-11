/* audit.js -- security audit view (permissive domains, dontaudit rules,
   type transitions, attributes, high-value domain ranking), ported from
   sepolicy_viz.html monolith */
(function() {

  /* ============================================================
     DOM template (adapted from monolith markup lines 797-807).
     #view-audit is renamed to .audit-root (this module's own
     container class, monolith used a persistent top-level
     <section id="view-audit">). No view-specific CSS is needed --
     the monolith rendered this view entirely with inline styles
     (cssText assignments in the render functions below plus the
     inline style="" attributes on the template divs), so there is
     no class-based stylesheet to carry over.
     ============================================================ */
  var TEMPLATE = ''
    + '<div class="audit-root" style="padding:12px;overflow-y:auto;max-height:calc(100vh - var(--topbar-h) - 40px);">'
    +   '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">'
    +     '<h2 style="margin:0;">SECURITY AUDIT</h2>'
    +     '<span id="audit-summary" style="font-size:11px;color:var(--text2);"></span>'
    +   '</div>'
    +   '<div id="audit-permissive" style="margin-bottom:16px;"></div>'
    +   '<div id="audit-dontaudit" style="margin-bottom:16px;"></div>'
    +   '<div id="audit-transitions" style="margin-bottom:16px;"></div>'
    +   '<div id="audit-attributes" style="margin-bottom:16px;"></div>'
    +   '<div id="audit-high-value" style="margin-bottom:16px;"></div>'
    + '</div>';

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  /* ============================================================
     Security Audit -- permissive domains, dontaudit rules, type
     transition chains, attribute membership, high-value domain
     ranking. source: monolith lines 3814-4096
     ============================================================ */
  function renderAuditView(){
    var data = App.data;
    if(!data) return;
    var permissive = data.permissive_domains || [];
    var dontaudit = data.dontaudit_rules || [];
    var transitions = data.type_transitions || [];
    var auditallow = data.auditallow_rules || [];
    var attributes = data.attributes || {};
    els.summary.textContent =
      permissive.length+' permissive / '+dontaudit.length+' dontaudit / '+transitions.length+' transitions / '+auditallow.length+' auditallow / '+Object.keys(attributes).length+' attributes';
    renderAuditPermissive(permissive);
    renderAuditDontaudit(dontaudit);
    renderAuditTransitions(transitions);
    renderAuditAttributes(attributes);
    renderAuditHighValue();
  }
  function auditSection(title, count, dangerColor){
    var sec = App.el('div','','');
    sec.style.cssText='border:1px solid var(--border);border-radius:4px;border-left:3px solid '+(dangerColor||'var(--border)')+';padding:10px;';
    var hdr = App.el('div','','');
    hdr.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;';
    var t = App.el('span','',title);
    t.style.cssText='font-size:12px;font-weight:bold;letter-spacing:.5px;color:'+(dangerColor||'var(--text)')+';';
    hdr.appendChild(t);
    var c = App.el('span','',String(count));
    c.style.cssText='font-size:10px;color:var(--text2);';
    hdr.appendChild(c);
    sec.appendChild(hdr);
    var body = App.el('div','','');
    body.style.cssText='max-height:400px;overflow-y:auto;';
    sec.appendChild(body);
    hdr.addEventListener('click', function(){ body.style.display = body.style.display==='none'?'block':'none'; });
    return {container:sec, body:body};
  }
  function renderAuditPermissive(permissive){
    var target = els.permissive;
    target.innerHTML='';
    if(permissive.length===0){
      var ok = App.el('div','','No permissive domains (all enforcing)');
      ok.style.cssText='font-size:11px;color:var(--green);padding:6px;border:1px solid var(--border);border-left:3px solid var(--green);border-radius:4px;';
      target.appendChild(ok);
      return;
    }
    var s = auditSection('PERMISSIVE DOMAINS — enforcement disabled, policy grants are meaningless', permissive.length, '#ffff00');
    for(var i=0;i<permissive.length;i++){
      var row = App.el('div','',App.escapeHTML(permissive[i]));
      row.style.cssText='font-size:11px;padding:2px 4px;color:#ffff00;';
      s.body.appendChild(row);
    }
    target.appendChild(s.container);
  }
  function renderAuditDontaudit(rules){
    var target = els.dontaudit;
    target.innerHTML='';
    if(rules.length===0){ target.appendChild(App.el('div','','No dontaudit rules.')); return; }
    var byDomain = {};
    for(var i=0;i<rules.length;i++){
      var r = rules[i];
      if(!byDomain[r.s]) byDomain[r.s] = [];
      byDomain[r.s].push(r);
    }
    var sorted = Object.keys(byDomain).sort(function(a,b){ return byDomain[b].length - byDomain[a].length; });
    var s = auditSection('DONTAUDIT — hidden denials (no AVC logged)', rules.length, 'var(--red)');
    var tbl = App.el('div','','');
    tbl.style.cssText='font-size:10px;';
    var hdrRow = App.el('div','','');
    hdrRow.style.cssText='display:grid;grid-template-columns:200px 60px 1fr;gap:4px;padding:2px 4px;color:var(--text2);border-bottom:1px solid var(--border);font-weight:bold;';
    hdrRow.appendChild(App.el('span','','DOMAIN'));
    hdrRow.appendChild(App.el('span','','COUNT'));
    hdrRow.appendChild(App.el('span','','HIDDEN OPERATIONS'));
    tbl.appendChild(hdrRow);
    for(var di=0;di<sorted.length;di++){
      var d = sorted[di];
      var dr = byDomain[d];
      var row = App.el('div','','');
      row.style.cssText='display:grid;grid-template-columns:200px 60px 1fr;gap:4px;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.03);';
      row.addEventListener('mouseover',function(){this.style.background='var(--surface)';});
      row.addEventListener('mouseout',function(){this.style.background='none';});
      var nameEl = App.el('span','',App.escapeHTML(d));
      nameEl.style.cssText='color:var(--text);';
      row.appendChild(nameEl);
      var countEl = App.el('span','',String(dr.length));
      countEl.style.cssText='color:var(--red);';
      row.appendChild(countEl);
      var ops = {};
      for(var ri=0;ri<dr.length;ri++){
        var key = dr[ri].t+':'+dr[ri].c;
        if(!ops[key]) ops[key] = [];
        for(var pi=0;pi<dr[ri].p.length;pi++){
          if(ops[key].indexOf(dr[ri].p[pi])===-1) ops[key].push(dr[ri].p[pi]);
        }
      }
      var opKeys = Object.keys(ops).sort();
      var summary = opKeys.slice(0,5).map(function(k){ return k+'{'+ops[k].join(',')+'}'; }).join('  ');
      if(opKeys.length>5) summary += '  ...'+(opKeys.length-5)+' more';
      var opsEl = App.el('span','',App.escapeHTML(summary));
      opsEl.style.cssText='color:var(--text2);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(opsEl);
      tbl.appendChild(row);
    }
    s.body.appendChild(tbl);
    target.appendChild(s.container);
  }
  function renderAuditTransitions(transitions){
    var target = els.transitions;
    target.innerHTML='';
    if(transitions.length===0){ target.appendChild(App.el('div','','No type_transition rules.')); return; }
    var bySource = {};
    var byTarget = {};
    for(var i=0;i<transitions.length;i++){
      var t = transitions[i];
      if(!bySource[t.s]) bySource[t.s] = [];
      bySource[t.s].push(t);
      if(!byTarget[t.d]) byTarget[t.d] = [];
      byTarget[t.d].push(t);
    }
    var domainSet = new Set(App.state.domains);
    var execTransitions = transitions.filter(function(t){ return t.c==='process' && domainSet.has(t.s) && domainSet.has(t.d); });
    var s = auditSection('TYPE TRANSITIONS — domain execution chains (process class: '+execTransitions.length+')', transitions.length, 'var(--purple)');
    var tbl = App.el('div','','');
    tbl.style.cssText='font-size:10px;';
    var hdrRow = App.el('div','','');
    hdrRow.style.cssText='display:grid;grid-template-columns:180px 30px 180px 200px;gap:4px;padding:2px 4px;color:var(--text2);border-bottom:1px solid var(--border);font-weight:bold;';
    hdrRow.appendChild(App.el('span','','SOURCE DOMAIN'));
    hdrRow.appendChild(App.el('span','',''));
    hdrRow.appendChild(App.el('span','','LANDS IN'));
    hdrRow.appendChild(App.el('span','','WHEN EXECUTING'));
    tbl.appendChild(hdrRow);
    execTransitions.sort(function(a,b){ return a.s < b.s ? -1 : a.s > b.s ? 1 : 0; });
    for(var i=0;i<execTransitions.length;i++){
      var tr = execTransitions[i];
      var row = App.el('div','','');
      row.style.cssText='display:grid;grid-template-columns:180px 30px 180px 200px;gap:4px;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.03);';
      row.addEventListener('mouseover',function(){this.style.background='var(--surface)';});
      row.addEventListener('mouseout',function(){this.style.background='none';});
      var srcEl = App.el('span','',App.escapeHTML(tr.s));
      srcEl.style.cssText='color:var(--text);';
      row.appendChild(srcEl);
      var arrow = App.el('span','','→');
      arrow.style.cssText='color:var(--purple);text-align:center;';
      row.appendChild(arrow);
      var dstEl = App.el('span','',App.escapeHTML(tr.d));
      dstEl.style.cssText='color:var(--cyan);';
      row.appendChild(dstEl);
      var execEl = App.el('span','',App.escapeHTML(tr.t));
      execEl.style.cssText='color:var(--text2);font-size:9px;';
      row.appendChild(execEl);
      tbl.appendChild(row);
    }
    s.body.appendChild(tbl);
    target.appendChild(s.container);
  }
  function renderAuditAttributes(attributes){
    var target = els.attributes;
    target.innerHTML='';
    var keys = Object.keys(attributes);
    if(keys.length===0){ target.appendChild(App.el('div','','No attribute data.')); return; }
    keys.sort(function(a,b){ return (attributes[b]||[]).length - (attributes[a]||[]).length; });
    var s = auditSection('ATTRIBUTES — shared permission groups (broadest first)', keys.length, 'var(--amber)');
    var tbl = App.el('div','','');
    tbl.style.cssText='font-size:10px;';
    var hdrRow = App.el('div','','');
    hdrRow.style.cssText='display:grid;grid-template-columns:250px 60px 1fr;gap:4px;padding:2px 4px;color:var(--text2);border-bottom:1px solid var(--border);font-weight:bold;';
    hdrRow.appendChild(App.el('span','','ATTRIBUTE'));
    hdrRow.appendChild(App.el('span','','MEMBERS'));
    hdrRow.appendChild(App.el('span','','DOMAINS'));
    tbl.appendChild(hdrRow);
    for(var i=0;i<Math.min(keys.length,50);i++){
      var attr = keys[i];
      var members = attributes[attr] || [];
      var row = App.el('div','','');
      row.style.cssText='display:grid;grid-template-columns:250px 60px 1fr;gap:4px;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.03);';
      row.addEventListener('mouseover',function(){this.style.background='var(--surface)';});
      row.addEventListener('mouseout',function(){this.style.background='none';});
      var nameEl = App.el('span','',App.escapeHTML(attr));
      nameEl.style.cssText='color:var(--amber);';
      row.appendChild(nameEl);
      var countEl = App.el('span','',String(members.length));
      countEl.style.cssText='color:var(--text);';
      row.appendChild(countEl);
      var preview = members.slice(0,8).join(', ');
      if(members.length>8) preview += ' ...+'+(members.length-8);
      var membersEl = App.el('span','',App.escapeHTML(preview));
      membersEl.style.cssText='color:var(--text2);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(membersEl);
      tbl.appendChild(row);
    }
    if(keys.length>50){
      var more = App.el('div','','...and '+(keys.length-50)+' more attributes');
      more.style.cssText='font-size:10px;color:var(--text2);padding:4px;';
      tbl.appendChild(more);
    }
    s.body.appendChild(tbl);
    target.appendChild(s.container);
  }
  function renderAuditHighValue(){
    var target = els.highValue;
    target.innerHTML='';
    if(!App.state.pivotBuilt) App.pivotPrecompute();
    var domainSet = new Set(App.state.domains);
    var appDomains = App.state.domains.filter(function(d){ return (App.state.domainCategory[d]==='app'); });
    var ranked = [];
    for(var di=0;di<App.state.domains.length;di++){
      var d = App.state.domains[di];
      var cats = App.state.pivotIndex[d];
      if(!cats || cats.size===0) continue;
      var capCount = 0;
      var dontauditCount = 0;
      var transitionTargets = [];
      var rules = App.data.rules;
      for(var ri=0;ri<rules.length;ri++){
        if(rules[ri].s===d && rules[ri].c==='capability') capCount += rules[ri].p.length;
      }
      var da = App.data.dontaudit_rules || [];
      for(var dai=0;dai<da.length;dai++){
        if(da[dai].s===d) dontauditCount++;
      }
      var tt = App.data.type_transitions || [];
      for(var ti=0;ti<tt.length;ti++){
        if(tt[ti].s===d && tt[ti].c==='process' && domainSet.has(tt[ti].d)) transitionTargets.push(tt[ti].d);
      }
      var targetCount = App.state.domainTypeSet[d] ? App.state.domainTypeSet[d].size : 0;
      ranked.push({domain:d, cats:cats.size, capCount:capCount, dontauditCount:dontauditCount, transitionTargets:transitionTargets, targetCount:targetCount});
    }
    ranked.sort(function(a,b){
      if(b.capCount!==a.capCount) return b.capCount-a.capCount;
      return b.targetCount-a.targetCount;
    });
    var s = auditSection('HIGH VALUE DOMAINS — ranked by capability breadth + target reach', Math.min(ranked.length,30), 'var(--cyan)');
    var tbl = App.el('div','','');
    tbl.style.cssText='font-size:10px;';
    var hdrRow = App.el('div','','');
    hdrRow.style.cssText='display:grid;grid-template-columns:180px 50px 60px 70px 60px 1fr;gap:4px;padding:2px 4px;color:var(--text2);border-bottom:1px solid var(--border);font-weight:bold;';
    hdrRow.appendChild(App.el('span','','DOMAIN'));
    hdrRow.appendChild(App.el('span','','UID'));
    hdrRow.appendChild(App.el('span','','CAPS'));
    hdrRow.appendChild(App.el('span','','TARGETS'));
    hdrRow.appendChild(App.el('span','','HIDDEN'));
    hdrRow.appendChild(App.el('span','','CAN TRANSITION TO'));
    tbl.appendChild(hdrRow);
    for(var i=0;i<Math.min(ranked.length,30);i++){
      var entry = ranked[i];
      var row = App.el('div','','');
      row.style.cssText='display:grid;grid-template-columns:180px 50px 60px 70px 60px 1fr;gap:4px;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;';
      row.addEventListener('mouseover',function(){this.style.background='var(--surface)';});
      row.addEventListener('mouseout',function(){this.style.background='none';});
      row.addEventListener('click',(function(dom){return function(){ if(App.openGraphView) App.openGraphView(dom); };})(entry.domain));
      var nameEl = App.el('span','',App.escapeHTML(entry.domain));
      nameEl.style.cssText='color:var(--text);';
      if(App.state.permissiveDomains.has(entry.domain)) nameEl.style.color='#ffff00';
      row.appendChild(nameEl);
      var uid = App.domainUid(entry.domain);
      var uidEl = App.el('span','',uid!==null?String(uid):'');
      uidEl.style.cssText='color:var(--green);font-size:9px;';
      row.appendChild(uidEl);
      var capEl = App.el('span','',String(entry.capCount));
      capEl.style.cssText='color:'+(entry.capCount>=10?'var(--red)':entry.capCount>=5?'var(--amber)':'var(--text2)')+';';
      row.appendChild(capEl);
      var targEl = App.el('span','',String(entry.targetCount));
      targEl.style.cssText='color:var(--text2);';
      row.appendChild(targEl);
      var daEl = App.el('span','',entry.dontauditCount>0?String(entry.dontauditCount):'');
      daEl.style.cssText='color:var(--red);';
      row.appendChild(daEl);
      var transStr = entry.transitionTargets.slice(0,4).join(', ');
      if(entry.transitionTargets.length>4) transStr += ' +'+(entry.transitionTargets.length-4);
      var transEl = App.el('span','',App.escapeHTML(transStr));
      transEl.style.cssText='color:var(--purple);font-size:9px;';
      row.appendChild(transEl);
      tbl.appendChild(row);
    }
    s.body.appendChild(tbl);
    target.appendChild(s.container);
  }

  /* ============================================================
     View lifecycle
     ============================================================ */
  function createAudit(container){
    /* 1. Build DOM (audit summary + 5 collapsible sections) inside
       container */
    var root = App.el('div','audit-view-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.summary = root.querySelector('#audit-summary');
    els.permissive = root.querySelector('#audit-permissive');
    els.dontaudit = root.querySelector('#audit-dontaudit');
    els.transitions = root.querySelector('#audit-transitions');
    els.attributes = root.querySelector('#audit-attributes');
    els.highValue = root.querySelector('#audit-high-value');

    /* 2. Compute initial data + render (equivalent to the monolith's
       openAuditView(), inlined here rather than calling that function
       directly -- it calls showView('audit'), which would recurse back
       into this create() call) */
    if(!App.state.pivotBuilt) App.pivotPrecompute();
    renderAuditView();
  }

  function destroyAudit(){
    if(els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Clear DOM refs */
    els = {};
  }

  App.registerView('audit', { label: 'AUDIT', icon: '☠', create: createAudit, destroy: destroyAudit });
})();
