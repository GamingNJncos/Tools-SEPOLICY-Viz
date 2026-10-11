/* data.js — constants, helpers, buildIndices for SEPolicy Viz v2 */

/* ============================================================
   Constants
   ============================================================ */
App.CATS = ['core','shell','vendor','other','system','app','hal'];
App.CAT_LABELS = {hal:'HAL',app:'APP',vendor:'VENDOR',system:'SYSTEM',shell:'SHELL',core:'CORE',other:'OTHER'};
App.CAT_COLORS = {core:'#ff2244',system:'#ff6622',vendor:'#ffaa00',hal:'#44ddaa',shell:'#b967ff',app:'#2288ff',other:'#556688'};
/* privilege heatmap: core/root=red(hot), system=orange, vendor=amber, hal=yellow, shell=purple, app=blue(cool), other=gray */
App.CLASS_COLORS = {
  file:'#00fff2',
  dir:'#00ccbb',
  lnk_file:'#009999',
  chr_file:'#ff00ff',
  blk_file:'#cc00aa',
  fifo_file:'#ff8844',
  sock_file:'#ee7722',
  socket:'#ffaa00',
  unix_stream_socket:'#ffcc33',
  unix_dgram_socket:'#ddaa22',
  tcp_socket:'#ff6600',
  udp_socket:'#dd5500',
  binder:'#39ff88',
  hwservice_manager:'#22cc66',
  process:'#ff4477',
  capability:'#ff3355',
  capability2:'#dd2244',
  service_manager:'#b967ff',
  keystore2_key:'#ff99cc',
  keystore_key:'#ee88bb',
  security:'#ff1111',
  perf_event:'#ff66aa',
  other:'#5a5a82'
};
/* priority order used when a (domain,type) pair was granted via multiple
   classes -- pick the most "interesting" one to color/categorize the cell */
App.CLASS_PRIORITY = ['security','capability','capability2','process','keystore2_key','keystore_key','perf_event','service_manager','hwservice_manager','binder','blk_file','chr_file','tcp_socket','unix_stream_socket','socket','fifo_file','sock_file','unix_dgram_socket','udp_socket','dir','file','lnk_file'];

App.BASE_CELL_W = 3, App.BASE_CELL_H = 14;
App.HEADER_H = 9;
App.MIN_ZOOM = 0.4, App.MAX_ZOOM = 10, App.ZOOM_STEP = 1.35;

App.READ_WORDS = ['read','getattr','search','open','ioctl','lock','watch','watch_reads','recv','recvfrom','poll','stat','list','getopt','use','call'];
App.WRITE_WORDS = ['write','append','create','unlink','rename','setattr','add','remove','relabel','link','enqueue','send','sendto','connect','bind','listen','accept','set','destroy','insert','remove_name','add_name','reparent','rmdir','mkdir','associate'];
App.EXEC_WORDS = ['execute','execute_no_trans','execmod','entrypoint','transition'];

/* ============================================================
   Pivot Finder — adversarial category definitions
   Each entry: key, label, icon, danger level, match function
   Match fn receives (rules, domain) where rules = App.data.rules
   ============================================================ */
App.PIVOT_CATEGORIES = [
  {key:'shell_exec', label:'SHELL EXEC', icon:'⌘', danger:'high',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='file' && r.p.indexOf('execute_no_trans')!==-1 && (r.t.indexOf('shell_exec')!==-1||r.t.indexOf('system_file')!==-1)) return true;
     } return false;}},
  {key:'unix_socket', label:'UNIX SOCKET', icon:'⚓', danger:'low',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='unix_stream_socket' && r.p.indexOf('connectto')!==-1) return true;
     } return false;}},
  {key:'tcp_bind', label:'TCP BIND', icon:'⇅', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='tcp_socket' && r.p.indexOf('bind')!==-1 && r.p.indexOf('listen')!==-1) return true;
     } return false;}},
  {key:'udp_bind', label:'UDP BIND', icon:'⇄', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='udp_socket' && r.p.indexOf('bind')!==-1) return true;
     } return false;}},
  {key:'raw_socket', label:'RAW SOCKET', icon:'⚠', danger:'high',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if((r.c==='rawip_socket'||r.c==='icmp_socket') && r.p.indexOf('create')!==-1) return true;
     } return false;}},
  {key:'cap_setuid', label:'CAP SETUID', icon:'↑', danger:'high',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='capability' && (r.p.indexOf('setuid')!==-1||r.p.indexOf('setgid')!==-1)) return true;
     } return false;}},
  {key:'cap_sysadmin', label:'CAP SYSADMIN', icon:'☠', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='capability' && (r.p.indexOf('sys_admin')!==-1||r.p.indexOf('sys_module')!==-1||r.p.indexOf('sys_ptrace')!==-1)) return true;
     } return false;}},
  {key:'sensitive_write', label:'SENSITIVE WRITE', icon:'✎', danger:'high',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='file' && (r.p.indexOf('write')!==-1||r.p.indexOf('create')!==-1) && (r.t.indexOf('system_data_file')!==-1||r.t.indexOf('vendor_data_file')!==-1||r.t.indexOf('app_data_file')!==-1)) return true;
     } return false;}},
  {key:'binder_call', label:'BINDER CALL', icon:'☎', danger:'low',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='binder' && r.p.indexOf('call')!==-1 && r.t!==d) return true;
     } return false;}},
  {key:'service_find', label:'SERVICE FIND', icon:'⌕', danger:'low',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if((r.c==='service_manager'||r.c==='hwservice_manager') && r.p.indexOf('find')!==-1) return true;
     } return false;}},
  {key:'process_ptrace', label:'PROCESS PTRACE', icon:'⌖', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='process' && r.p.indexOf('ptrace')!==-1) return true;
     } return false;}},
  {key:'device_node', label:'DEVICE NODE', icon:'⌸', danger:'low',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='chr_file' && r.p.indexOf('open')!==-1 && r.t.indexOf('device')!==-1) return true;
     } return false;}},
  {key:'blk_read', label:'BLK READ', icon:'▀', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='blk_file' && r.p.indexOf('read')!==-1 && r.p.indexOf('open')!==-1) return true;
     } return false;}},
  {key:'module_load', label:'MODULE LOAD', icon:'⬆', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='system' && r.p.indexOf('module_load')!==-1) return true;
     } return false;}},
  {key:'prop_set', label:'PROP SET', icon:'⚙', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='property_service' && r.p.indexOf('set')!==-1) return true;
     } return false;}},
  {key:'selinux_write', label:'SELINUX WRITE', icon:'☢', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='security' && r.p.indexOf('write')!==-1) return true;
       if(r.t.indexOf('selinuxfs')!==-1 && r.p.indexOf('write')!==-1) return true;
     } return false;}},
  {key:'cap_dac_override', label:'DAC OVERRIDE', icon:'⛨', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='capability' && r.p.indexOf('dac_override')!==-1) return true;
     } return false;}},
  {key:'cap2_syslog', label:'CAP2 SYSLOG', icon:'⎙', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='capability2' && r.p.indexOf('syslog')!==-1) return true;
     } return false;}},
  {key:'cap2_mac_admin', label:'MAC ADMIN', icon:'⚿', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='capability2' && r.p.indexOf('mac_admin')!==-1) return true;
     } return false;}},
  {key:'vendor_module_load', label:'VENDOR MODULE', icon:'⬆', danger:'critical',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.t.indexOf('vendor_file')!==-1 && r.p.indexOf('module_load')!==-1) return true;
     } return false;}},
  {key:'netlink_socket', label:'NETLINK SOCKET', icon:'⇶', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if((r.c==='netlink_socket'||r.c==='netlink_route_socket'||r.c==='netlink_audit_socket'||r.c==='netlink_firewall_socket') && r.p.indexOf('create')!==-1) return true;
     } return false;}},
  {key:'ipc_write', label:'IPC TRANSFER', icon:'⇌', danger:'medium',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.c==='binder' && r.p.indexOf('transfer')!==-1 && r.t!==d) return true;
     } return false;}},
  {key:'keystore_access', label:'KEYSTORE', icon:'⚷', danger:'high',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if(r.t.indexOf('keystore')!==-1 && (r.p.indexOf('open')!==-1||r.p.indexOf('read')!==-1||r.p.indexOf('write')!==-1||r.p.indexOf('find')!==-1)) return true;
     } return false;}},
  {key:'tee_access', label:'TEE ACCESS', icon:'⛊', danger:'high',
   match:function(rules,d){
     for(var i=0;i<rules.length;i++){
       var r=rules[i]; if(r.s!==d) continue;
       if((r.t.indexOf('tee')!==-1||r.t.indexOf('trusty')!==-1||r.t.indexOf('optee')!==-1) && (r.p.indexOf('open')!==-1||r.p.indexOf('read')!==-1||r.p.indexOf('write')!==-1||r.p.indexOf('ioctl')!==-1)) return true;
     } return false;}}
];

App.DANGER_COLORS = {critical:'var(--red)',high:'var(--magenta)',medium:'var(--amber)',low:'var(--cyan)'};

/* Android AID (Android ID) table — maps usernames to UIDs.
   SELinux domains often run as these UIDs. */
App.AID_TABLE = {
  root:0, system:1000, radio:1001, bluetooth:1002, graphics:1003,
  input:1004, audio:1005, camera:1006, log:1007, compass:1008,
  mount:1009, wifi:1010, adb:1011, install:1012, media:1013,
  dhcp:1014, sdcard_rw:1015, vpn:1016, keystore:1017, usb:1018,
  drm:1019, mdnsr:1020, gps:1021, media_rw:1023, mtp:1024,
  nfc:1025, shell:2000, cache:2001, diag:2002, net_bt_admin:3001,
  net_bt:3002, inet:3003, net_raw:3004, net_admin:3005,
  everybody:9997, misc:9998, nobody:9999
};
/* domain-to-AID-name mapping for domains whose process name differs
   from the AID username */
App.DOMAIN_AID_ALIAS = {
  adbd:'adb', netd:'root', vold:'root', installd:'install',
  system_server:'system', surfaceflinger:'graphics', audioserver:'audio',
  cameraserver:'camera', mediaserver:'media', drmserver:'drm',
  gatekeeperd:'system', healthd:'system', hwservicemanager:'system',
  servicemanager:'system', gpsd:'gps', wpa:'wifi', hostapd:'wifi',
  dnsmasq:'root', logd:'log', lmkd:'root', storaged:'root',
  tombstoned:'root', traced:'root', traced_probes:'root',
  incidentd:'root', statsd:'root', init:'root', ueventd:'root',
  keystore2:'keystore', credstore:'keystore'
};
/* app-type domains get uid:10000+ */
App.APP_DOMAINS = {
  untrusted_app:'app', untrusted_app_25:'app', untrusted_app_27:'app',
  untrusted_app_29:'app', untrusted_app_30:'app', untrusted_app_32:'app',
  platform_app:'platform_app', system_app:'system_app',
  priv_app:'priv_app', ephemeral_app:'ephemeral_app',
  isolated_app:'isolated_app', isolated_compute_app:'isolated_compute_app',
  gmscore_app:'gmscore_app', app_zygote:'app_zygote',
  sdk_sandbox:'sdk_sandbox'
};
App.domainLabel = function(domain){
  /* check app domains first */
  if(App.APP_DOMAINS[domain]!==undefined){
    return 'uid:10000+ '+App.APP_DOMAINS[domain];
  }
  /* check direct AID match (domain name IS the username) */
  if(App.AID_TABLE[domain]!==undefined){
    return 'uid:'+App.AID_TABLE[domain]+' '+domain;
  }
  /* check alias mapping */
  var alias = App.DOMAIN_AID_ALIAS[domain];
  if(alias!==undefined && App.AID_TABLE[alias]!==undefined){
    return 'uid:'+App.AID_TABLE[alias]+' '+alias+' ('+domain+')';
  }
  /* HALs — strip prefix, show as domain name */
  return domain;
};

/* numeric UID for a domain (same precedence as domainLabel): app-type
   domains bucket at 10000, direct AID match, then alias match.
   Returns null when no UID mapping is known. */
App.domainUid = function(domain){
  if(App.APP_DOMAINS[domain]!==undefined) return 10000;
  if(App.AID_TABLE[domain]!==undefined) return App.AID_TABLE[domain];
  var alias = App.DOMAIN_AID_ALIAS[domain];
  if(alias!==undefined && App.AID_TABLE[alias]!==undefined) return App.AID_TABLE[alias];
  return null;
};
/* heatmap row order: ascending by numeric UID (uid:0 root/init/netd/etc
   at top, then uid:1000 system, uid:1001 radio, uid:2000 shell,
   uid:10000+ apps, ...). Domains with no known UID mapping sort to the
   bottom, alphabetically among themselves. */
App.domainUidSortCompare = function(a,b){
  var ua = App.domainUid(a), ub = App.domainUid(b);
  if(ua===null && ub===null) return a<b?-1:(a>b?1:0);
  if(ua===null) return 1;
  if(ub===null) return -1;
  if(ua!==ub) return ua-ub;
  return a<b?-1:(a>b?1:0);
};

/* ============================================================
   Small helpers
   ============================================================ */
App.classCategory = function(c){
  if(App.CLASS_COLORS[c]) return c;
  if(c==='cap_userns'||c==='cap2_userns') return 'capability';
  return 'other';
};
App.cellCategoryFromEntries = function(entries){
  var cats = {};
  for(var i=0;i<entries.length;i++){ cats[App.classCategory(entries[i].c)] = true; }
  for(var p=0;p<App.CLASS_PRIORITY.length;p++){ if(cats[App.CLASS_PRIORITY[p]]) return App.CLASS_PRIORITY[p]; }
  return 'other';
};
App.cellCategory = function(domain,type){
  var key = domain+''+type;
  var cached = App.state.cachedCellCat[key];
  if(cached) return cached;
  var entries = App.state.domainTypeMap[domain] && App.state.domainTypeMap[domain][type];
  var cat = entries ? App.cellCategoryFromEntries(entries) : 'other';
  App.state.cachedCellCat[key] = cat;
  return cat;
};
App.permCategory = function(p){
  var lp = p.toLowerCase();
  for(var i=0;i<App.EXEC_WORDS.length;i++){ if(lp===App.EXEC_WORDS[i]) return 'exec'; }
  for(var j=0;j<App.WRITE_WORDS.length;j++){ if(lp===App.WRITE_WORDS[j] || lp.indexOf(App.WRITE_WORDS[j])===0) return 'write'; }
  for(var k=0;k<App.READ_WORDS.length;k++){ if(lp===App.READ_WORDS[k]) return 'read'; }
  if(lp.indexOf('write')!==-1) return 'write';
  if(lp.indexOf('read')!==-1) return 'read';
  return 'other';
};
App.permBadgeHTML = function(p){
  return '<span class="perm perm-'+App.permCategory(p)+'">'+App.escapeHTML(p)+'</span>';
};
App.escapeHTML = function(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
App.el = function(tag,cls,html){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html!==undefined) e.innerHTML = html;
  return e;
};
App.debounce = function(fn,ms){
  var t=null;
  return function(){
    var args=arguments, ctx=this;
    clearTimeout(t);
    t=setTimeout(function(){ fn.apply(ctx,args); }, ms);
  };
};
App.fmtNum = function(n){ return n.toLocaleString(); };
App.rainbowize = function(node, text){
  node.innerHTML = '';
  text.split('').forEach(function(ch,i){
    var span = document.createElement('span');
    span.className = 'rainbow-char';
    span.style.animationDelay = (i*0.08)+'s';
    span.textContent = ch;
    node.appendChild(span);
  });
};

/* ============================================================
   Index building — single pass over data.rules
   ============================================================ */
App.buildIndices = function(data){
  App.data = data;
  App.state.domainCategory = {};
  App.state.domainTypeMap = {};
  App.state.domainTypeSet = {};
  App.state.cachedCellCat = {};
  App.state.domainRuleCounts = data.domain_rule_counts || {};
  App.state.permissiveDomains = new Set(data.permissive_domains || []);

  var known = {};
  App.CATS.forEach(function(cat){
    var list = (data.categories && data.categories[cat]) || [];
    list.forEach(function(d){ App.state.domainCategory[d]=cat; known[d]=true; });
  });
  (data.domains||[]).forEach(function(d){ if(!known[d]) App.state.domainCategory[d]='other'; });

  var typeDomainCountSet = {};
  var rules = data.rules || [];
  for(var i=0;i<rules.length;i++){
    var r = rules[i];
    var s=r.s, t=r.t, c=r.c, p=r.p||[];
    var tm = App.state.domainTypeMap[s];
    if(!tm){ tm = App.state.domainTypeMap[s] = {}; }
    var arr = tm[t];
    if(!arr){ arr = tm[t] = []; }
    arr.push({c:c,p:p});

    var set = App.state.domainTypeSet[s];
    if(!set){ set = App.state.domainTypeSet[s] = new Set(); }
    set.add(t);

    var tdset = typeDomainCountSet[t];
    if(!tdset){ tdset = typeDomainCountSet[t] = new Set(); }
    tdset.add(s);
  }
  App.state.typeDomainCount = {};
  Object.keys(typeDomainCountSet).forEach(function(t){ App.state.typeDomainCount[t]=typeDomainCountSet[t].size; });

  /* row order: grouped by category, alphabetical within category */
  App.state.domains = [];
  App.state.domainRowIndex = {};
  App.state.categoryRowRanges = {};
  App.CATS.forEach(function(cat){
    var list = (data.categories && data.categories[cat] && data.categories[cat].slice()) || [];
    list.sort();
    var start = App.state.domains.length;
    list.forEach(function(d){
      App.state.domainRowIndex[d] = App.state.domains.length;
      App.state.domains.push(d);
    });
    App.state.categoryRowRanges[cat] = {start:start, count:list.length};
  });

  /* column order: all declared types, sorted by descending domain-reach,
     ties broken alphabetically */
  var types = (data.types||[]).slice();
  types.sort(function(a,b){
    var ca = App.state.typeDomainCount[a]||0, cb = App.state.typeDomainCount[b]||0;
    if(cb!==ca) return cb-ca;
    return a<b?-1:(a>b?1:0);
  });
  App.state.types = types;
  App.state.typeColIndex = {};
  types.forEach(function(t,i){ App.state.typeColIndex[t]=i; });
};

/* ============================================================
   Pivot Finder — precomputation
   ============================================================ */
App.pivotPrecompute = function(){
  var rules = App.data.rules;
  App.state.pivotIndex = {};
  App.state.pivotCatDomains = {};
  App.state.pivotFilters = [];
  for(var ci=0; ci<App.PIVOT_CATEGORIES.length; ci++){
    App.state.pivotCatDomains[App.PIVOT_CATEGORIES[ci].key] = [];
  }
  for(var di=0; di<App.state.domains.length; di++){
    var domain = App.state.domains[di];
    var cats = new Set();
    for(var ci2=0; ci2<App.PIVOT_CATEGORIES.length; ci2++){
      var cat = App.PIVOT_CATEGORIES[ci2];
      if(cat.match(rules, domain)){
        cats.add(cat.key);
        App.state.pivotCatDomains[cat.key].push(domain);
      }
    }
    App.state.pivotIndex[domain] = cats;
  }
  App.state.pivotBuilt = true;
};
