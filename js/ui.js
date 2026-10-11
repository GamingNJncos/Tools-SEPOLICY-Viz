/* ui.js -- shell UI: drop zone, tab bar, tooltip, search, animations, themes */

/* ============================================================
   Theme system
   ============================================================ */
var THEME_PRESETS = {
  'default': {
    label: 'Default (Neon)',
    bg:'#0a0a1a', surface:'#141428', surface2:'#1b1b36', border:'#1a1a3a',
    text:'#e0e0ff', text2:'#8888aa',
    cyan:'#00fff2', magenta:'#ff00ff', amber:'#ffaa00', green:'#39ff88',
    red:'#ff3355', purple:'#b967ff', purple2:'#aa55ff', green2:'#00ff88', gray:'#8888aa'
  },
  'midnight': {
    label: 'Midnight',
    bg:'#121218', surface:'#1a1a22', surface2:'#22222c', border:'#2e2e3a',
    text:'#d0d0dc', text2:'#808090',
    cyan:'#40c8c0', magenta:'#c870b0', amber:'#d0a040', green:'#48b070',
    red:'#d05050', purple:'#9878b0', purple2:'#8868a0', green2:'#40a868', gray:'#808090'
  },
  'slate': {
    label: 'Slate',
    bg:'#1c1f26', surface:'#252830', surface2:'#2e323c', border:'#3c4050',
    text:'#c8ccd4', text2:'#7c8090',
    cyan:'#38b4b0', magenta:'#b868a8', amber:'#c89838', green:'#40a868',
    red:'#c85050', purple:'#8870a8', purple2:'#7860a0', green2:'#389860', gray:'#7c8090'
  },
  'carbon': {
    label: 'Carbon',
    bg:'#1a1a1a', surface:'#242424', surface2:'#2e2e2e', border:'#404040',
    text:'#d0d0d0', text2:'#888888',
    cyan:'#50b8b8', magenta:'#c070a8', amber:'#c89830', green:'#48a868',
    red:'#d05848', purple:'#9070b0', purple2:'#8060a0', green2:'#40a060', gray:'#888888'
  },
  'terminal': {
    label: 'Terminal Green',
    bg:'#0a100a', surface:'#101810', surface2:'#182018', border:'#283828',
    text:'#b0d8b0', text2:'#608860',
    cyan:'#30d890', magenta:'#c870b0', amber:'#c8b030', green:'#40e870',
    red:'#d05050', purple:'#9080b0', purple2:'#8070a0', green2:'#38d060', gray:'#608860'
  }
};

var currentTheme = 'default';
var bgOverride = null;

function applyTheme(name) {
  var preset = THEME_PRESETS[name];
  if (!preset) return;
  currentTheme = name;
  localStorage.setItem('sepolicy-viz-theme', name);
  var r = document.documentElement.style;
  var keys = ['surface','surface2','border','text','text2','cyan','magenta','amber','green','red','purple','purple2','green2','gray'];
  for (var i = 0; i < keys.length; i++) {
    r.setProperty('--' + keys[i], preset[keys[i]]);
  }
  r.setProperty('--bg', bgOverride || preset.bg);
  var picker = document.getElementById('theme-bg-picker');
  var hex = document.getElementById('theme-bg-hex');
  if (picker) picker.value = bgOverride || preset.bg;
  if (hex) hex.textContent = bgOverride || preset.bg;
  renderThemePresets();
}

function renderThemePresets() {
  var list = document.getElementById('theme-preset-list');
  if (!list) return;
  list.innerHTML = '';
  var names = Object.keys(THEME_PRESETS);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var preset = THEME_PRESETS[name];
    var row = document.createElement('div');
    row.className = 'sp-preset' + (name === currentTheme ? ' active' : '');
    var swatch = document.createElement('span');
    swatch.className = 'sp-swatch';
    swatch.style.background = preset.bg;
    row.appendChild(swatch);
    var lbl = document.createElement('span');
    lbl.textContent = preset.label;
    row.appendChild(lbl);
    row.addEventListener('click', (function(n) { return function() { applyTheme(n); }; })(name));
    list.appendChild(row);
  }
}

function loadThemeSettings() {
  var lsBg = localStorage.getItem('sepolicy-viz-bg-override');
  if (lsBg && lsBg.match(/^#[0-9a-fA-F]{6}$/)) {
    bgOverride = lsBg;
  }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'theme.json', true);
  xhr.onload = function() {
    if (xhr.status === 200 || xhr.status === 0) {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.bg && typeof data.bg === 'string' && data.bg.match(/^#[0-9a-fA-F]{6}$/)) {
          if (!bgOverride) bgOverride = data.bg;
        }
      } catch(e) {}
    }
    var saved = localStorage.getItem('sepolicy-viz-theme');
    applyTheme(saved && THEME_PRESETS[saved] ? saved : 'default');
  };
  xhr.onerror = function() {
    var saved = localStorage.getItem('sepolicy-viz-theme');
    applyTheme(saved && THEME_PRESETS[saved] ? saved : 'default');
  };
  xhr.send();
}

function saveBgOverride(hex) {
  localStorage.setItem('sepolicy-viz-bg-override', hex);
}

function exportThemeFile() {
  var json = JSON.stringify({ bg: bgOverride || THEME_PRESETS[currentTheme].bg }, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'theme.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function toggleThemeMenu() {
  var panel = document.getElementById('theme-menu-panel');
  if (!panel) return;
  if (panel.classList.contains('hidden')) {
    renderThemePresets();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

/* ============================================================
   Tooltip
   ============================================================ */
App.tooltip = {
  show: function(x, y, html) {
    var el = document.getElementById('tooltip');
    if (!el) return;
    el.innerHTML = html;
    el.classList.remove('hidden');
    el.style.left = Math.min(x + 12, window.innerWidth - 340) + 'px';
    el.style.top = Math.min(y + 12, window.innerHeight - 200) + 'px';
  },
  hide: function() {
    var el = document.getElementById('tooltip');
    if (el) el.classList.add('hidden');
  }
};

/* ============================================================
   Tab bar
   ============================================================ */
App.renderTabs = function() {
  if (!App.enabledViews) App._loadEnabledViews();
  var nav = document.getElementById('view-tabs');
  nav.innerHTML = '';
  nav.classList.remove('hidden');
  var order = (typeof VIEW_FILES !== 'undefined') ? VIEW_FILES : App._viewOrder;
  for (var i = 0; i < order.length; i++) {
    var name = order[i];
    var view = App.views[name];
    if (!view) continue;
    if (!App.enabledViews.has(name)) continue;
    var btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.view = name;
    btn.type = 'button';
    btn.textContent = (view.icon || '') + ' ' + (view.label || name.toUpperCase());
    btn.addEventListener('click', (function(n) { return function() { App.showView(n); }; })(name));
    nav.appendChild(btn);
  }
};

/* ============================================================
   Views menu panel — toggle views on/off
   ============================================================ */
App.renderViewsMenu = function() {
  var panel = document.getElementById('views-menu-panel');
  if (!panel) return;
  var list = panel.querySelector('.vm-list');
  if (!list) return;
  list.innerHTML = '';
  if (!App.enabledViews) App._loadEnabledViews();
  var sorted = App._viewOrder.slice().sort(function(a,b){ var la = (App.views[a]&&App.views[a].label)||a, lb = (App.views[b]&&App.views[b].label)||b; return la.localeCompare(lb); });
  for (var i = 0; i < sorted.length; i++) {
    var name = sorted[i];
    var view = App.views[name];
    if (!view) continue;
    var row = document.createElement('label');
    row.className = 'vm-row';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = App.enabledViews.has(name);
    cb.addEventListener('change', (function(n) { return function() { App.toggleView(n); App.renderViewsMenu(); }; })(name));
    var icon = document.createElement('span');
    icon.className = 'vm-icon';
    icon.textContent = view.icon || '';
    var label = document.createElement('span');
    label.className = 'vm-label';
    label.textContent = view.label || name.toUpperCase();
    row.appendChild(cb);
    row.appendChild(icon);
    row.appendChild(label);
    list.appendChild(row);
  }
};

function toggleViewsMenu() {
  var panel = document.getElementById('views-menu-panel');
  if (!panel) return;
  var isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    App.renderViewsMenu();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
};

App._onViewRegistered = function() {
  if (App.data) App.renderTabs();
};

/* ============================================================
   Search
   ============================================================ */
function buildSuggestions(query){
  var q = query.toLowerCase();
  var domainMatches=[], typeMatches=[];
  for(var i=0;i<App.state.domains.length && domainMatches.length<8;i++){
    if(App.state.domains[i].toLowerCase().indexOf(q)!==-1) domainMatches.push(App.state.domains[i]);
  }
  for(var j=0;j<App.state.types.length && typeMatches.length<8;j++){
    if(App.state.types[j].toLowerCase().indexOf(q)!==-1) typeMatches.push(App.state.types[j]);
  }
  return {domainMatches:domainMatches, typeMatches:typeMatches};
}
function renderSuggestions(query){
  var box = document.getElementById('search-suggest');
  if(!query){ box.classList.add('hidden'); box.innerHTML=''; return; }
  var res = buildSuggestions(query);
  if(res.domainMatches.length===0 && res.typeMatches.length===0){ box.classList.add('hidden'); box.innerHTML=''; return; }
  box.innerHTML='';
  res.domainMatches.forEach(function(d){
    var row = App.el('div','suggest-row');
    row.innerHTML = '<span>'+App.escapeHTML(d)+'</span><span class="suggest-tag domain-tag">DOMAIN</span>';
    row.onclick = function(){ document.getElementById('search-input').value=d; box.classList.add('hidden'); jumpToDomain(d); };
    box.appendChild(row);
  });
  res.typeMatches.forEach(function(t){
    var row = App.el('div','suggest-row');
    row.innerHTML = '<span>'+App.escapeHTML(t)+'</span><span class="suggest-tag type-tag">TYPE</span>';
    row.onclick = function(){ document.getElementById('search-input').value=t; box.classList.add('hidden'); jumpToType(t); };
    box.appendChild(row);
  });
  box.classList.remove('hidden');
}

App.onSearchSelect = null; /* views override this */
function jumpToDomain(domain){
  if (App.onSearchSelect) App.onSearchSelect('domain', domain);
}
function jumpToType(type){
  if (App.onSearchSelect) App.onSearchSelect('type', type);
}

var onSearchInput = App.debounce(function(e){ renderSuggestions(e.target.value.trim()); }, 80);
function onSearchKeydown(e){
  if(e.key==='Enter'){
    var q = e.target.value.trim();
    if(!q) return;
    var res = buildSuggestions(q);
    var lowerQ = q.toLowerCase();
    var exactType = App.state.types.filter(function(t){ return t.toLowerCase()===lowerQ; })[0];
    var exactDomain = App.state.domains.filter(function(d){ return d.toLowerCase()===lowerQ; })[0];
    if(exactType) jumpToType(exactType);
    else if(exactDomain) jumpToDomain(exactDomain);
    else if(res.domainMatches.length) jumpToDomain(res.domainMatches[0]);
    else if(res.typeMatches.length) jumpToType(res.typeMatches[0]);
    document.getElementById('search-suggest').classList.add('hidden');
  } else if(e.key==='Escape'){
    document.getElementById('search-suggest').classList.add('hidden');
  }
}

/* ============================================================
   File loading
   ============================================================ */
function handleFile(file){
  var hint = document.getElementById('drop-hint');
  hint.style.color = 'var(--text2)';
  hint.textContent = 'Reading '+file.name+'...';
  App.state.loadedFileName = file.name;
  var reader = new FileReader();
  reader.onerror = function(){ hint.style.color='var(--red)'; hint.textContent='Failed to read file.'; };
  reader.onload = function(ev){
    var data;
    try{ data = JSON.parse(ev.target.result); }
    catch(err){ hint.style.color='var(--red)'; hint.textContent='Invalid JSON: '+err.message; return; }
    try{ App.buildIndices(data); }
    catch(err){ hint.style.color='var(--red)'; hint.textContent='Failed to index policy: '+err.message; return; }
    hint.textContent='';
    App.renderTabs();
    document.getElementById('view-loader').classList.remove('active');
    document.getElementById('view-container').classList.remove('hidden');
    var meta = data.meta || {};
    var permCount = App.state.permissiveDomains.size;
    var metaText = (meta.source||'policy')+' -- '+App.fmtNum(App.state.domains.length)+' domains / '+App.fmtNum(App.state.types.length)+' types / '+App.fmtNum((data.rules||[]).length)+' rules';
    if(permCount > 0) metaText += ' / '+permCount+' PERMISSIVE';
    document.getElementById('meta-info').textContent = metaText;
    document.getElementById('search-input').disabled = false;
    document.getElementById('btn-load-new').classList.remove('hidden');
    var vmBtn = document.getElementById('btn-views-menu');
    if (vmBtn) vmBtn.classList.remove('hidden');
    var vOrder = (typeof VIEW_FILES !== 'undefined') ? VIEW_FILES : App._viewOrder;
    var first = vOrder.filter(function(n){ return App.views[n] && App.isViewEnabled(n); })[0] || vOrder[0];
    App.showView(first);
  };
  reader.readAsText(file);
}

/* ============================================================
   Demoscene flourishes -- copper bars, matrix rain
   ============================================================ */
function startCopperBars(){
  var canvas = document.getElementById('copper-canvas');
  if(!canvas) return;
  function resize(){
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.max(1,Math.round(canvas.clientWidth*dpr));
    canvas.height = Math.max(1,Math.round(canvas.clientHeight*dpr));
  }
  resize();
  window.addEventListener('resize', App.debounce(resize,200));
  var ctx = canvas.getContext('2d');
  function frame(t){
    var w=canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    for(var i=0;i<5;i++){
      var phase = t*0.00035 + i*0.7;
      var y = h*0.5 + Math.sin(phase)*h*0.4;
      var hue = 185 + Math.sin(phase*0.6+i)*45;
      var grad = ctx.createLinearGradient(0,y-8,0,y+8);
      grad.addColorStop(0,'hsla('+hue+',100%,60%,0)');
      grad.addColorStop(0.5,'hsla('+hue+',100%,60%,0.5)');
      grad.addColorStop(1,'hsla('+hue+',100%,60%,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,y-8,w,16);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/* Raster glow — two bar sets at slightly different periods, beating against each other */
function startRasterGlow(){
  var canvas = document.getElementById('raster-glow');
  if(!canvas) return;
  function resize(){
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.max(1,Math.round(canvas.clientWidth*dpr));
    canvas.height = Math.max(1,Math.round(canvas.clientHeight*dpr));
  }
  resize();
  window.addEventListener('resize', App.debounce(resize,200));
  var ctx = canvas.getContext('2d');
  function frame(t){
    var w=canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    for(var y=0;y<h;y+=2){
      var a1 = Math.sin(y*0.025 + t*0.0008)*0.5+0.5;
      var a2 = Math.sin(y*0.031 - t*0.0006)*0.5+0.5;
      var beat = a1*a2;
      var hue = 185 + Math.sin(y*0.01+t*0.0003)*20;
      ctx.fillStyle = 'hsla('+hue+',100%,55%,'+(beat*0.12)+')';
      ctx.fillRect(0,y,w,2);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

var matrixRainState = null;
function startMatrixRain(){
  if(matrixRainState) return;
  var canvas = document.getElementById('matrix-rain');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var fontSize = 14;
  var drops = [];
  function resize(){
    var dpr = window.devicePixelRatio||1;
    var w = canvas.clientWidth||window.innerWidth, h = canvas.clientHeight||window.innerHeight;
    canvas.width = Math.max(1,Math.round(w*dpr));
    canvas.height = Math.max(1,Math.round(h*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    var cols = Math.max(1,Math.floor(w/fontSize));
    drops = new Array(cols).fill(0).map(function(){ return Math.random()*-40; });
  }
  resize();
  var onResize = App.debounce(resize,200);
  window.addEventListener('resize', onResize);
  var glyphs = '01ABCDEFXZ:;{}[]#$%SELINUXTYPEDOMAINALLOW';
  var raf;
  function frame(){
    var w = canvas.clientWidth||window.innerWidth, h = canvas.clientHeight||window.innerHeight;
    ctx.fillStyle = 'rgba(10,10,26,0.10)';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(0,255,242,0.55)';
    ctx.font = fontSize+'px monospace';
    for(var i=0;i<drops.length;i++){
      var ch = glyphs[Math.floor(Math.random()*glyphs.length)];
      ctx.fillText(ch, i*fontSize, drops[i]*fontSize);
      if(drops[i]*fontSize>h && Math.random()>0.975) drops[i]=0;
      drops[i]++;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  matrixRainState = {
    stop:function(){
      if(raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      matrixRainState=null;
    }
  };
}

/* ============================================================
   Reset to loader
   ============================================================ */
App.resetToLoader = function() {
  if (App.activeView && App.views[App.activeView] && App.views[App.activeView].destroy) {
    try { App.views[App.activeView].destroy(); } catch(e) {}
  }
  App.activeView = null;
  App.data = null;
  App.state = {};
  document.getElementById('view-container').innerHTML = '';
  document.getElementById('view-tabs').classList.add('hidden');
  document.getElementById('view-loader').classList.add('active');
  document.getElementById('meta-info').textContent = '';
  document.getElementById('search-input').disabled = true;
  document.getElementById('search-input').value = '';
  document.getElementById('btn-load-new').classList.add('hidden');
  var vmBtn = document.getElementById('btn-views-menu');
  if (vmBtn) vmBtn.classList.add('hidden');
  var vmPanel = document.getElementById('views-menu-panel');
  if (vmPanel) vmPanel.classList.add('hidden');
  startMatrixRain();
};

/* ============================================================
   Init
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  /* Wire drop zone */
  var dropZone = document.getElementById('drop-zone');
  var fileInput = document.getElementById('file-input');
  dropZone.addEventListener('click', function() { fileInput.click(); });
  dropZone.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); });
  ['dragenter','dragover'].forEach(function(evName){
    dropZone.addEventListener(evName, function(e){ e.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(function(evName){
    dropZone.addEventListener(evName, function(e){ e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });
  dropZone.addEventListener('drop', function(e){
    var f = e.dataTransfer && e.dataTransfer.files[0];
    if(f) handleFile(f);
  });

  /* Wire theme menu */
  var themeBtn = document.getElementById('btn-theme-menu');
  if (themeBtn) themeBtn.addEventListener('click', toggleThemeMenu);
  document.addEventListener('click', function(e) {
    var panel = document.getElementById('theme-menu-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    var btn = document.getElementById('btn-theme-menu');
    if (panel.contains(e.target)) return;
    if (btn && btn.contains(e.target)) return;
    panel.classList.add('hidden');
  });
  var bgPicker = document.getElementById('theme-bg-picker');
  var bgHex = document.getElementById('theme-bg-hex');
  if (bgPicker) {
    bgPicker.addEventListener('input', function() {
      bgOverride = bgPicker.value;
      document.documentElement.style.setProperty('--bg', bgOverride);
      if (bgHex) bgHex.textContent = bgOverride;
    });
  }
  var bgSave = document.getElementById('theme-bg-save');
  if (bgSave) bgSave.addEventListener('click', function() {
    if (bgOverride) saveBgOverride(bgOverride);
    bgSave.textContent = 'SAVED';
    setTimeout(function(){ bgSave.textContent = 'SAVE'; }, 1200);
  });
  var bgClear = document.getElementById('theme-bg-clear');
  if (bgClear) bgClear.addEventListener('click', function() {
    bgOverride = null;
    localStorage.removeItem('sepolicy-viz-bg-override');
    applyTheme(currentTheme);
  });
  loadThemeSettings();

  /* Wire effects toggle */
  var fxBtn = document.getElementById('btn-effects-toggle');
  var fxOn = localStorage.getItem('sepolicy-viz-fx') !== 'off';
  function applyFx() {
    document.body.classList.toggle('fx-off', !fxOn);
    fxBtn.textContent = fxOn ? '✨ FX ON' : '✨ FX OFF';
  }
  applyFx();
  fxBtn.addEventListener('click', function() {
    fxOn = !fxOn;
    localStorage.setItem('sepolicy-viz-fx', fxOn ? 'on' : 'off');
    applyFx();
  });

  /* Wire load-new button */
  document.getElementById('btn-load-new').addEventListener('click', function() { App.resetToLoader(); });

  /* Wire views menu toggle */
  var vmBtn = document.getElementById('btn-views-menu');
  if (vmBtn) vmBtn.addEventListener('click', toggleViewsMenu);
  document.addEventListener('click', function(e) {
    var panel = document.getElementById('views-menu-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    var btn = document.getElementById('btn-views-menu');
    if (panel.contains(e.target)) return;
    if (btn && btn.contains(e.target)) return;
    panel.classList.add('hidden');
  });

  /* Wire search */
  var searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeydown);

  /* Start animations */
  startCopperBars();
  startMatrixRain();
  startRasterGlow();

  /* Load view scripts from manifest */
  App.loadViews();
});
