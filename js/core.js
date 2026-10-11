var App = App || {};
App.data = null;
App.state = {};
App.views = {};
App.activeView = null;
App._viewOrder = [];
App.enabledViews = null;

App._loadEnabledViews = function() {
  try {
    var stored = localStorage.getItem('sepolicy-viz-enabled-views');
    if (stored) { App.enabledViews = new Set(JSON.parse(stored)); return; }
  } catch(e) {}
  App.enabledViews = new Set(typeof DEFAULT_VIEWS !== 'undefined' ? DEFAULT_VIEWS : App._viewOrder.slice());
};

App._saveEnabledViews = function() {
  try { localStorage.setItem('sepolicy-viz-enabled-views', JSON.stringify(Array.from(App.enabledViews))); } catch(e) {}
};

App.isViewEnabled = function(name) {
  if (!App.enabledViews) App._loadEnabledViews();
  return App.enabledViews.has(name);
};

App.toggleView = function(name) {
  if (!App.enabledViews) App._loadEnabledViews();
  if (App.enabledViews.has(name)) {
    if (App.enabledViews.size <= 1) return;
    App.enabledViews.delete(name);
    if (App.activeView === name) {
      var first = App._viewOrder.filter(function(n){ return App.enabledViews.has(n); })[0];
      if (first) App.showView(first);
    }
  } else {
    App.enabledViews.add(name);
  }
  App._saveEnabledViews();
  if (App.data) App.renderTabs();
};

App.registerView = function(name, opts) {
  App.views[name] = opts;
  App._viewOrder.push(name);
  if (App._onViewRegistered) App._onViewRegistered(name, opts);
};

App.showView = function(name) {
  var container = document.getElementById('view-container');
  if (!container) return;
  if (App.activeView && App.views[App.activeView] && App.views[App.activeView].destroy) {
    try { App.views[App.activeView].destroy(); } catch(e) { console.error('destroy error:', App.activeView, e); }
  }
  container.innerHTML = '';
  App.activeView = name;
  var view = App.views[name];
  if (view && view.create) {
    try { view.create(container); } catch(e) { console.error('create error:', name, e); }
  }
  var tabs = document.querySelectorAll('#view-tabs .tab-btn');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.view === name);
  }
};

App.loadViews = function() {
  if (typeof VIEW_FILES === 'undefined') { console.error('VIEW_FILES not defined'); return; }
  for (var i = 0; i < VIEW_FILES.length; i++) {
    var s = document.createElement('script');
    s.src = 'js/views/' + VIEW_FILES[i] + '.js';
    s.onerror = (function(n) { return function() { console.warn('Failed to load view: ' + n); }; })(VIEW_FILES[i]);
    document.body.appendChild(s);
  }
};

window.addEventListener('resize', function() {
  if (App.activeView && App.views[App.activeView] && App.views[App.activeView].onResize) {
    App.views[App.activeView].onResize();
  }
});
