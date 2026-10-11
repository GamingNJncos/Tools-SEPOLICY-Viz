/* upset-attributes.js -- attribute UpSet plot (combination matrix of
   SELinux attribute co-membership across domains), ported from
   sepolicy_viz/views/upset-attributes.html standalone monolith */
(function() {

  /* ============================================================
     View-specific CSS (injected in create, removed in destroy)
     source: monolith lines 9-159. The standalone monolith's :root
     vars / *{box-sizing} / html,body reset are dropped here -- v2's
     shell theme.css (css/theme.css) already defines the same --bg/
     --surface/--cyan/etc custom properties globally and the global
     box-sizing/body reset, so redeclaring them would be redundant.
     The standalone #app{display:none;...} toggle is replaced by a
     single .upset-root rule sized to the view area (matching the
     treemap-root/graph-root/*-root convention other v2 view modules
     use for their outermost element). Dropzone/.dz-* rules are
     dropped entirely (file-drop removed, see load section below).
     #tooltip's own rules are dropped -- this view now uses the
     shared #tooltip element/.tooltip class already styled by
     theme.css; only the tooltip *content* classes theme.css does not
     already know about (.tt-sub/.tt-domains/.tt-domain-row/.tt-more)
     are carried over, scoped under .tooltip to match theme.css's own
     .tooltip .tt-title/.tooltip .tt-class convention (NOT under
     .upset-root -- the shared #tooltip element lives outside this
     view's root in the DOM).
     ============================================================ */
  var CSS = `
  .upset-root{ display:flex; flex-direction:column; height:calc(100vh - var(--topbar-h)); }

  .upset-root #toolbar{
    display:flex; flex-wrap:wrap; align-items:center; gap:18px;
    background:var(--surface); border-bottom:1px solid var(--border);
    padding:10px 16px; flex:0 0 auto;
  }
  .upset-root .tb-group{ display:flex; align-items:center; gap:8px; }
  .upset-root .tb-group label{
    font-size:10px; letter-spacing:1.5px; color:var(--text2); text-transform:uppercase;
  }
  .upset-root #min-size-slider{ width:140px; accent-color:#00fff2; cursor:pointer; }
  .upset-root #min-size-value{
    font-size:11px; color:var(--cyan); min-width:18px; text-align:center;
  }
  .upset-root .tb-sep{ width:1px; align-self:stretch; background:var(--border); }
  .upset-root #tier-legend{ display:flex; align-items:center; gap:12px; }
  .upset-root .tier-item{ display:flex; align-items:center; gap:5px; font-size:9px; letter-spacing:1px; color:var(--text2); }
  .upset-root .tier-dot{ width:8px; height:8px; border-radius:50%; }
  .upset-root #hl-chip{
    display:none; align-items:center; gap:8px; padding:4px 10px; border-radius:20px;
    border:1px solid var(--cyan); background:rgba(0,255,242,0.08); color:var(--cyan);
    font-size:10px; letter-spacing:1px;
  }
  .upset-root #hl-chip button{
    background:none; border:none; color:var(--cyan); cursor:pointer; font-family:inherit;
    font-size:12px; line-height:1; padding:0;
  }
  .upset-root #tb-stats{
    margin-left:auto; font-size:11px; color:var(--text2); letter-spacing:1px;
    white-space:nowrap;
  }

  .upset-root #more-note{
    display:none; flex:0 0 auto; padding:6px 16px; font-size:11px; letter-spacing:1px;
    color:var(--amber); background:rgba(255,170,0,0.06); border-bottom:1px solid var(--border);
  }

  .upset-root #upset-wrap{ flex:1 1 auto; min-height:0; }
  .upset-root #upset-grid{ display:flex; flex-direction:row; width:100%; height:100%; }

  .upset-root #left-col{ flex:0 0 300px; width:300px; display:flex; flex-direction:column; border-right:1px solid var(--border); }
  .upset-root #corner-panel-wrap{ flex:0 0 auto; position:relative; }
  .upset-root .corner-caption{
    position:absolute; left:8px; bottom:4px; font-size:9px; letter-spacing:1px;
    color:var(--text2); pointer-events:none;
  }
  .upset-root #left-scroll{ flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; }
  .upset-root #left-scroll::-webkit-scrollbar, .upset-root #matrix-scroll::-webkit-scrollbar, .upset-root #top-scroll::-webkit-scrollbar{ width:8px; height:8px; }
  .upset-root #left-scroll::-webkit-scrollbar-thumb, .upset-root #matrix-scroll::-webkit-scrollbar-thumb, .upset-root #top-scroll::-webkit-scrollbar-thumb{
    background:var(--border); border-radius:4px;
  }

  .upset-root #right-col{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
  .upset-root #top-scroll{ flex:0 0 auto; overflow-x:auto; overflow-y:hidden; border-bottom:1px solid var(--border); }
  .upset-root #matrix-scroll{ flex:1 1 auto; min-height:0; overflow:auto; }

  .upset-root .attr-label{ fill:var(--text2); font-size:10px; font-family:inherit; cursor:pointer; }
  .upset-root .attr-label:hover{ fill:var(--cyan); }
  .upset-root .attr-label.hl{ fill:var(--cyan); font-weight:700; }
  .upset-root .attr-count{ fill:var(--text2); font-size:9px; font-family:inherit; }
  .upset-root .bar-val{ fill:var(--text2); font-family:inherit; }
  .upset-root .unique-mark{ font-family:inherit; }
  .upset-root .unique-name{ font-family:inherit; }

  .tooltip .tt-sub{ font-size:10px; letter-spacing:1px; color:var(--amber); margin-bottom:8px; word-break:break-word; }
  .tooltip .tt-domains{ color:var(--text2); max-height:180px; overflow:hidden; }
  .tooltip .tt-domain-row{ color:var(--text); }
  .tooltip .tt-more{ color:var(--text2); font-style:italic; margin-top:4px; }

  .upset-root #detail-drawer{
    display:none; flex:0 0 auto; max-height:26vh; overflow-y:auto;
    background:var(--surface); border-top:1px solid var(--cyan); padding:12px 18px;
  }
  .upset-root #drawer-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .upset-root #drawer-title{ font-size:12px; letter-spacing:1px; color:var(--cyan); word-break:break-word; padding-right:16px; }
  .upset-root #drawer-close{
    background:none; border:1px solid var(--border); color:var(--text2); cursor:pointer;
    font-family:inherit; font-size:11px; padding:4px 10px; border-radius:4px; flex:0 0 auto;
  }
  .upset-root #drawer-close:hover{ border-color:var(--red); color:var(--red); }
  .upset-root #drawer-body{ display:flex; flex-wrap:wrap; gap:6px; }
  .upset-root .domain-chip{
    display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:14px;
    border:1px solid var(--border); background:var(--surface2); font-size:10px; color:var(--text);
  }
  .upset-root .chip-dot{ width:7px; height:7px; border-radius:50%; flex:0 0 auto; }
  `;
  var styleEl = null;

  /* ============================================================
     DOM template (adapted from monolith markup lines 174-227).
     Dropzone/#app-visibility-toggle/#tooltip are dropped (file-drop
     removed -- see load section; tooltip is the shared shell one).
     reset-btn ("Load New File") is dropped along with it since there
     is no per-view file to reload -- data now arrives via App.data,
     loaded once at the shell level.
     ============================================================ */
  var TEMPLATE = ''
    + '<div id="toolbar">'
    +   '<div class="tb-group">'
    +     '<label for="min-size-slider">Min Combo Size</label>'
    +     '<input type="range" id="min-size-slider" min="1" max="1" value="1" step="1">'
    +     '<span id="min-size-value">1</span>'
    +   '</div>'
    +   '<div class="tb-sep"></div>'
    +   '<div id="tier-legend">'
    +     '<div class="tier-item"><span class="tier-dot" style="background:#00fff2;box-shadow:0 0 5px #00fff2;"></span>HIGH</div>'
    +     '<div class="tier-item"><span class="tier-dot" style="background:#ffaa00;box-shadow:0 0 5px #ffaa00;"></span>MED</div>'
    +     '<div class="tier-item"><span class="tier-dot" style="background:#8888aa;"></span>LOW</div>'
    +     '<div class="tier-item"><span class="tier-dot" style="background:#ff00ff;box-shadow:0 0 5px #ff00ff;"></span>UNIQUE</div>'
    +   '</div>'
    +   '<div class="tb-sep"></div>'
    +   '<div id="hl-chip">'
    +     '<span id="hl-chip-label"></span>'
    +     '<button id="hl-chip-clear" type="button">&times;</button>'
    +   '</div>'
    +   '<div id="tb-stats"></div>'
    + '</div>'
    + '<div id="more-note"></div>'
    + '<div id="upset-wrap">'
    +   '<div id="upset-grid">'
    +     '<div id="left-col">'
    +       '<div id="corner-panel-wrap">'
    +         '<svg id="corner-panel"></svg>'
    +         '<div class="corner-caption">FILLED = MEMBER</div>'
    +       '</div>'
    +       '<div id="left-scroll">'
    +         '<svg id="left-panel"></svg>'
    +       '</div>'
    +     '</div>'
    +     '<div id="right-col">'
    +       '<div id="top-scroll">'
    +         '<svg id="top-panel"></svg>'
    +       '</div>'
    +       '<div id="matrix-scroll">'
    +         '<svg id="matrix-panel"></svg>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div id="detail-drawer">'
    +   '<div id="drawer-header">'
    +     '<div id="drawer-title"></div>'
    +     '<button id="drawer-close" type="button">CLOSE</button>'
    +   '</div>'
    +   '<div id="drawer-body"></div>'
    + '</div>';

  /* ============================================================
     Local state (module scope -- reset in destroy(), matching
     treemap.js's tmState reset convention). Layout constants and
     the local CATEGORY_ORDER/CATEGORY_COLORS palette are the
     monolith's own (source lines 232-254) and are intentionally
     NOT swapped for App.CATS/App.CAT_COLORS -- this view's category
     coloring was authored independently of the shared data.js
     palette and swapping it would change rendered behavior.
     ============================================================ */
  var TOP_HEIGHT = 240;
  var TOP_MARGIN = { top:70, right:8, bottom:6, left:8 };
  var LEFT_WIDTH = 300;
  var LEFT_LABEL_WIDTH = 170;
  var LEFT_COUNT_PAD = 40;
  var MIN_COL_WIDTH = 18;
  var MIN_ROW_HEIGHT = 18;
  var MAX_COMBOS = 40;
  var MAX_ATTR_ROWS = 30;

  var COLOR_CYAN = '#00fff2';
  var COLOR_AMBER = '#ffaa00';
  var COLOR_GRAY = '#8888aa';
  var COLOR_MAGENTA = '#ff00ff';
  var COLOR_GREEN = '#39ff88';
  var COLOR_TEXT = '#e0e0ff';
  var COLOR_BORDER = '#1a1a3a';

  var CATEGORY_ORDER = ['hal','app','vendor','system','shell','core','other'];
  var CATEGORY_COLORS = {
    hal:'#00fff2', app:'#ff00ff', vendor:'#ffaa00', system:'#39ff88',
    shell:'#b967ff', core:'#ff3355', other:'#8888aa'
  };

  var domains = [];
  var domainSet = new Set();
  var catLookup = {};
  var attrDomains = {};     // filtered attr -> [domain,...]
  var domainAttrs = {};     // domain -> [attr,...]
  var combosAll = [];       // [{key, attrs:[...], domains:[...], size}]
  var attrTotals = [];      // [{name, count}]
  var topAttributes = [];   // slice of attrTotals

  var minSizeFilter = 1;
  var highlightedAttr = null;
  var selectedComboKey = null;
  var isSyncingScroll = false;

  var colWidthCache = MIN_COL_WIDTH;
  var rowHeightCache = MIN_ROW_HEIGHT;

  /* ============================================================
     DOM element references (created in create(), null after destroy())
     ============================================================ */
  var els = {};

  /* resize debounce handle (removed in destroy, matching
     scatterplot.js's resizeHandler/resizeTimer convention) */
  var resizeHandler = null;
  var resizeTimer = null;

  // ---------- data processing ----------
  // source: monolith lines 272-329 (computeModel), unchanged except
  // the parameter now comes from App.data instead of a dropped file.

  function computeModel(data){
    domains = Array.isArray(data.domains) ? data.domains.slice() : [];
    domainSet = new Set(domains);

    var categories = data.categories || {};
    catLookup = {};
    Object.keys(categories).forEach(function(cat){
      (categories[cat] || []).forEach(function(d){ catLookup[d] = cat; });
    });

    var rawAttrs = data.attributes || {};
    attrDomains = {};
    Object.keys(rawAttrs).forEach(function(attr){
      var members = Array.isArray(rawAttrs[attr]) ? rawAttrs[attr] : [];
      var filtered = members.filter(function(m){ return domainSet.has(m); });
      if (filtered.length){
        attrDomains[attr] = filtered.slice().sort();
      }
    });

    domainAttrs = {};
    domains.forEach(function(d){ domainAttrs[d] = []; });
    Object.keys(attrDomains).forEach(function(attr){
      attrDomains[attr].forEach(function(d){
        if (domainAttrs[d]) domainAttrs[d].push(attr);
      });
    });

    var comboMap = new Map();
    domains.forEach(function(d){
      var attrs = domainAttrs[d].slice().sort();
      var key = attrs.join(',');
      if (!comboMap.has(key)){
        comboMap.set(key, { key:key, attrs:attrs, domains:[] });
      }
      comboMap.get(key).domains.push(d);
    });

    combosAll = Array.from(comboMap.values());
    combosAll.forEach(function(c){
      c.domains.sort();
      c.size = c.domains.length;
    });
    combosAll.sort(function(a,b){
      if (b.size !== a.size) return b.size - a.size;
      if (b.attrs.length !== a.attrs.length) return b.attrs.length - a.attrs.length;
      return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
    });

    attrTotals = Object.keys(attrDomains).map(function(a){
      return { name:a, count:attrDomains[a].length };
    });
    attrTotals.sort(function(a,b){
      if (b.count !== a.count) return b.count - a.count;
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
    topAttributes = attrTotals.slice(0, MAX_ATTR_ROWS);
  }

  // ---------- helpers ----------
  // source: monolith lines 333-357, unchanged.

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(ch){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch];
    });
  }

  function truncateLabel(str, maxChars){
    if (str.length <= maxChars) return str;
    return str.slice(0, Math.max(1, maxChars - 1)) + '…';
  }

  function tierColor(i, n){
    var third = n / 3;
    if (i < third) return COLOR_CYAN;
    if (i < third * 2) return COLOR_AMBER;
    return COLOR_GRAY;
  }

  function comboOpacity(combo){
    if (highlightedAttr){
      return combo.attrs.indexOf(highlightedAttr) !== -1 ? 1 : 0.15;
    }
    if (selectedComboKey && selectedComboKey !== combo.key) return 0.45;
    return 1;
  }

  // ---------- tooltip ----------
  // source: monolith lines 361-405 (showComboTooltip/showAttrTooltip/
  // positionTooltip/hideTooltip). Adapted to use the shared
  // App.tooltip.show(x,y,html)/App.tooltip.hide() from ui.js instead
  // of poking a local #tooltip div directly -- the standalone
  // monolith's own #tooltip element is dropped (id collides with the
  // shell's persistent one), and App.tooltip already owns viewport
  // clamping, so the monolith's own positionTooltip() is dropped too.
  // Content-building logic (tt-title/tt-sub/tt-domains markup) is
  // unchanged.

  function showComboTooltip(event, combo){
    var attrsLabel = combo.attrs.length ? combo.attrs.join(' + ') : '(no attributes)';
    var shown = combo.domains.slice(0, 20);
    var rows = shown.map(function(d){
      var cat = catLookup[d] || 'other';
      var color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
      return '<div class="tt-domain-row"><span style="color:' + color + '">&#9679;</span> ' + escapeHtml(d) + '</div>';
    }).join('');
    var moreCount = combo.domains.length - shown.length;
    var moreLine = moreCount > 0 ? '<div class="tt-more">+' + moreCount + ' more</div>' : '';
    var uniqueTag = combo.size === 1 ? ' &mdash; UNIQUE' : '';
    var html =
      '<div class="tt-title">' + combo.size + ' DOMAIN' + (combo.size === 1 ? '' : 'S') + uniqueTag + '</div>' +
      '<div class="tt-sub">' + escapeHtml(attrsLabel) + '</div>' +
      '<div class="tt-domains">' + rows + moreLine + '</div>';
    App.tooltip.show(event.clientX, event.clientY, html);
  }

  function showAttrTooltip(event, attr){
    var html =
      '<div class="tt-title">' + escapeHtml(attr.name) + '</div>' +
      '<div class="tt-sub">' + attr.count + ' DOMAIN' + (attr.count === 1 ? '' : 'S') + ' &bull; CLICK TO HIGHLIGHT</div>';
    App.tooltip.show(event.clientX, event.clientY, html);
  }

  function hideTooltip(){
    App.tooltip.hide();
  }

  // ---------- stats / notes ----------
  // source: monolith lines 409-426, unchanged apart from DOM lookups.

  function updateStats(displayedCount, filteredTotal){
    var el = els.tbStats;
    var totalAttrs = Object.keys(attrDomains).length;
    var text = domains.length + ' DOMAINS • ' + totalAttrs + ' ATTRIBUTES (TOP ' + topAttributes.length + ' SHOWN) • ' +
      displayedCount + '/' + combosAll.length + ' COMBINATIONS';
    if (minSizeFilter > 1) text += ' • MIN SIZE ' + minSizeFilter;
    el.textContent = text;

    var note = els.moreNote;
    var remaining = filteredTotal - displayedCount;
    if (remaining > 0){
      note.style.display = 'block';
      note.textContent = '...and ' + remaining + ' more combination' + (remaining === 1 ? '' : 's') +
        ' not shown (top ' + MAX_COMBOS + ' by frequency displayed — raise the min size filter to narrow the field)';
    } else {
      note.style.display = 'none';
    }
  }

  // ---------- drawer ----------
  // source: monolith lines 430-461, unchanged apart from DOM lookups.

  function renderDrawer(displayed){
    var drawer = els.detailDrawer;
    if (!selectedComboKey){
      drawer.style.display = 'none';
      return;
    }
    var combo = null;
    for (var i = 0; i < displayed.length; i++){
      if (displayed[i].key === selectedComboKey){ combo = displayed[i]; break; }
    }
    if (!combo){
      for (var j = 0; j < combosAll.length; j++){
        if (combosAll[j].key === selectedComboKey){ combo = combosAll[j]; break; }
      }
    }
    if (!combo){
      selectedComboKey = null;
      drawer.style.display = 'none';
      return;
    }
    drawer.style.display = 'block';
    var attrsLabel = combo.attrs.length ? combo.attrs.join(' + ') : '(no attributes)';
    els.drawerTitle.textContent =
      combo.size + ' DOMAIN' + (combo.size === 1 ? '' : 'S') + ' — ' + attrsLabel;
    var body = els.drawerBody;
    body.innerHTML = combo.domains.map(function(d){
      var cat = catLookup[d] || 'other';
      var color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
      return '<span class="domain-chip"><span class="chip-dot" style="background:' + color +
        ';box-shadow:0 0 5px ' + color + ';"></span>' + escapeHtml(d) + '</span>';
    }).join('');
  }

  // ---------- panels ----------
  // source: monolith lines 465-729. Unchanged apart from d3.select()
  // now targeting stored element refs (els.*) instead of global '#id'
  // selectors, and mousemove handlers re-invoking the tooltip-show
  // function (see tooltip section above) instead of the dropped
  // positionTooltip().

  function renderCornerAxis(maxSize){
    var svg = d3.select(els.cornerPanel);
    svg.selectAll('*').remove();
    svg.attr('width', LEFT_WIDTH).attr('height', TOP_HEIGHT);

    var innerH = TOP_HEIGHT - TOP_MARGIN.top - TOP_MARGIN.bottom;
    var yScale = d3.scaleLinear().domain([0, maxSize]).nice().range([innerH, 0]);
    var g = svg.append('g').attr('transform', 'translate(0,' + TOP_MARGIN.top + ')');

    g.append('line')
      .attr('x1', LEFT_WIDTH - 6).attr('x2', LEFT_WIDTH - 6)
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', COLOR_BORDER);

    var ticks = yScale.ticks(4);
    ticks.forEach(function(t){
      var y = yScale(t);
      g.append('line')
        .attr('x1', LEFT_WIDTH - 12).attr('x2', LEFT_WIDTH - 6)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', COLOR_BORDER);
      g.append('text')
        .attr('x', LEFT_WIDTH - 16).attr('y', y)
        .attr('dy', '0.32em').attr('text-anchor', 'end')
        .style('font-size', '9px').attr('fill', COLOR_GRAY)
        .text(t);
    });

    g.append('text')
      .attr('transform', 'translate(14,' + (innerH / 2) + ') rotate(-90)')
      .attr('text-anchor', 'middle')
      .style('font-size', '9px').attr('fill', COLOR_GRAY)
      .text('COMBO SIZE');
  }

  function renderTopPanel(displayed, colWidth){
    var svg = d3.select(els.topPanel);
    svg.selectAll('*').remove();
    var n = displayed.length;
    var width = Math.max(colWidth * n, 10);
    svg.attr('width', width).attr('height', TOP_HEIGHT);

    var innerH = TOP_HEIGHT - TOP_MARGIN.top - TOP_MARGIN.bottom;
    var maxSize = d3.max(displayed, function(d){ return d.size; }) || 1;
    var yScale = d3.scaleLinear().domain([0, maxSize]).nice().range([innerH, 0]);
    var g = svg.append('g').attr('transform', 'translate(0,' + TOP_MARGIN.top + ')');

    var barW = Math.max(colWidth * 0.6, 4);

    g.selectAll('rect.bar')
      .data(displayed, function(d){ return d.key; })
      .join('rect')
      .attr('class', 'bar')
      .attr('x', function(d, i){ return i * colWidth + (colWidth - barW) / 2; })
      .attr('width', barW)
      .attr('y', function(d){ return yScale(d.size); })
      .attr('height', function(d){ return innerH - yScale(d.size); })
      .attr('fill', function(d, i){ return tierColor(i, n); })
      .attr('fill-opacity', function(d){ return comboOpacity(d); })
      .attr('stroke', 'none')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d){
        d3.select(this).attr('stroke', COLOR_TEXT).attr('stroke-width', 1.5);
        highlightMatrixColumn(d.key, true);
        showComboTooltip(event, d);
      })
      .on('mousemove', function(event, d){ showComboTooltip(event, d); })
      .on('mouseleave', function(event, d){
        d3.select(this).attr('stroke', 'none');
        highlightMatrixColumn(d.key, false);
        hideTooltip();
      })
      .on('click', function(event, d){ onComboClick(d.key); });

    if (colWidth >= 20){
      g.selectAll('text.bar-val')
        .data(displayed, function(d){ return d.key; })
        .join('text')
        .attr('class', 'bar-val')
        .attr('x', function(d, i){ return i * colWidth + colWidth / 2; })
        .attr('y', function(d){ return yScale(d.size) - 4; })
        .attr('text-anchor', 'middle')
        .style('font-size', '9px')
        .text(function(d){ return d.size; });
    }

    var uniques = displayed.filter(function(d){ return d.size === 1; });
    g.selectAll('text.unique-mark')
      .data(uniques, function(d){ return d.key; })
      .join('text')
      .attr('class', 'unique-mark')
      .attr('x', function(d){ return displayed.indexOf(d) * colWidth + colWidth / 2; })
      .attr('y', -44)
      .attr('text-anchor', 'middle')
      .attr('fill', COLOR_MAGENTA)
      .style('font-size', '10px')
      .text('★');

    g.selectAll('text.unique-name')
      .data(uniques, function(d){ return d.key; })
      .join('text')
      .attr('class', 'unique-name')
      .attr('transform', function(d){
        var i = displayed.indexOf(d);
        var x = i * colWidth + colWidth / 2;
        return 'translate(' + x + ',-48) rotate(-55)';
      })
      .attr('text-anchor', 'start')
      .style('font-size', '9px')
      .attr('fill', COLOR_MAGENTA)
      .text(function(d){ return truncateLabel(d.domains[0], 22); })
      .append('title')
      .text(function(d){ return d.domains[0]; });
  }

  function renderLeftPanel(rows, rowHeight){
    var svg = d3.select(els.leftPanel);
    svg.selectAll('*').remove();
    var m = rows.length;
    var height = Math.max(rowHeight * m, 10);
    svg.attr('width', LEFT_WIDTH).attr('height', height);

    var barAreaWidth = Math.max(LEFT_WIDTH - LEFT_LABEL_WIDTH - LEFT_COUNT_PAD, 10);
    var maxCount = d3.max(rows, function(d){ return d.count; }) || 1;
    var xScale = d3.scaleLinear().domain([0, maxCount]).range([0, barAreaWidth]);
    var barThickness = Math.max(Math.min(rowHeight * 0.55, 14), 4);
    var maxChars = Math.floor((LEFT_LABEL_WIDTH - 10) / 6.2);

    var rowG = svg.selectAll('g.attr-row')
      .data(rows, function(d){ return d.name; })
      .join('g')
      .attr('class', 'attr-row')
      .attr('transform', function(d, i){ return 'translate(0,' + (i * rowHeight) + ')'; });

    rowG.append('text')
      .attr('class', function(d){ return 'attr-label' + (d.name === highlightedAttr ? ' hl' : ''); })
      .attr('x', LEFT_LABEL_WIDTH - 8)
      .attr('y', rowHeight / 2)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .text(function(d){ return truncateLabel(d.name, maxChars); })
      .on('mouseenter', function(event, d){
        highlightMatrixRow(d.name, true);
        showAttrTooltip(event, d);
      })
      .on('mousemove', function(event, d){ showAttrTooltip(event, d); })
      .on('mouseleave', function(event, d){
        highlightMatrixRow(d.name, false);
        hideTooltip();
      })
      .on('click', function(event, d){ onAttrClick(d.name); });

    rowG.append('rect')
      .attr('class', 'attr-bar')
      .attr('x', LEFT_LABEL_WIDTH)
      .attr('y', (rowHeight - barThickness) / 2)
      .attr('width', function(d){ return xScale(d.count); })
      .attr('height', barThickness)
      .attr('fill', function(d){ return d.name === highlightedAttr ? COLOR_CYAN : COLOR_GREEN; })
      .attr('opacity', function(d){ return (!highlightedAttr || d.name === highlightedAttr) ? 0.85 : 0.3; });

    rowG.append('text')
      .attr('class', 'attr-count')
      .attr('x', function(d){ return LEFT_LABEL_WIDTH + xScale(d.count) + 6; })
      .attr('y', rowHeight / 2)
      .attr('dy', '0.32em')
      .text(function(d){ return d.count; });
  }

  function renderMatrixPanel(displayed, rows, colWidth, rowHeight){
    var svg = d3.select(els.matrixPanel);
    svg.selectAll('*').remove();
    var n = displayed.length;
    var m = rows.length;
    var width = Math.max(colWidth * n, 10);
    var height = Math.max(rowHeight * m, 10);
    svg.attr('width', width).attr('height', height);

    svg.selectAll('rect.row-bg')
      .data(rows, function(d){ return d.name; })
      .join('rect')
      .attr('class', 'row-bg')
      .attr('x', 0)
      .attr('y', function(d, i){ return i * rowHeight; })
      .attr('width', width)
      .attr('height', rowHeight)
      .attr('fill', function(d, i){ return i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent'; });

    var connectors = [];
    displayed.forEach(function(d, ci){
      var filledIdx = [];
      rows.forEach(function(a, ri){
        if (d.attrs.indexOf(a.name) !== -1) filledIdx.push(ri);
      });
      if (filledIdx.length >= 2){
        connectors.push({
          key: d.key, ci: ci,
          y1: Math.min.apply(null, filledIdx),
          y2: Math.max.apply(null, filledIdx),
          combo: d
        });
      }
    });

    svg.selectAll('line.connector')
      .data(connectors, function(d){ return d.key; })
      .join('line')
      .attr('class', 'connector')
      .attr('x1', function(d){ return d.ci * colWidth + colWidth / 2; })
      .attr('x2', function(d){ return d.ci * colWidth + colWidth / 2; })
      .attr('y1', function(d){ return d.y1 * rowHeight + rowHeight / 2; })
      .attr('y2', function(d){ return d.y2 * rowHeight + rowHeight / 2; })
      .attr('stroke', function(d){ return d.key === selectedComboKey ? COLOR_CYAN : COLOR_TEXT; })
      .attr('stroke-width', 2)
      .attr('opacity', function(d){ return comboOpacity(d.combo); });

    var dotR = Math.max(Math.min(colWidth, rowHeight) * 0.28, 2.5);
    var dotsData = [];
    displayed.forEach(function(d, ci){
      rows.forEach(function(a, ri){
        dotsData.push({
          comboKey: d.key, ci: ci, ri: ri,
          filled: d.attrs.indexOf(a.name) !== -1,
          attrName: a.name, combo: d
        });
      });
    });

    svg.selectAll('circle.dot')
      .data(dotsData, function(d){ return d.comboKey + '|' + d.attrName; })
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', function(d){ return d.ci * colWidth + colWidth / 2; })
      .attr('cy', function(d){ return d.ri * rowHeight + rowHeight / 2; })
      .attr('r', dotR)
      .attr('fill', function(d){
        if (!d.filled) return 'transparent';
        return (highlightedAttr && d.attrName === highlightedAttr) ? COLOR_CYAN : COLOR_TEXT;
      })
      .attr('stroke', function(d){ return d.filled ? 'none' : COLOR_BORDER; })
      .attr('stroke-width', 1)
      .attr('opacity', function(d){ return comboOpacity(d.combo); })
      .style('pointer-events', 'none');

    svg.selectAll('rect.col-bg')
      .data(displayed, function(d){ return d.key; })
      .join('rect')
      .attr('class', 'col-bg')
      .attr('x', function(d, i){ return i * colWidth; })
      .attr('y', 0)
      .attr('width', colWidth)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d){
        highlightMatrixColumn(d.key, true);
        showComboTooltip(event, d);
      })
      .on('mousemove', function(event, d){ showComboTooltip(event, d); })
      .on('mouseleave', function(event, d){
        highlightMatrixColumn(d.key, false);
        hideTooltip();
      })
      .on('click', function(event, d){ onComboClick(d.key); });
  }

  function highlightMatrixColumn(key, on){
    d3.select(els.topPanel).selectAll('rect.bar')
      .filter(function(d){ return d.key === key; })
      .attr('stroke', on ? COLOR_TEXT : 'none')
      .attr('stroke-width', on ? 1.5 : 0);
  }

  function highlightMatrixRow(name, on){
    d3.select(els.matrixPanel).selectAll('circle.dot')
      .filter(function(d){ return d.attrName === name && d.filled; })
      .attr('r', function(d){
        var base = Math.max(Math.min(colWidthCache, rowHeightCache) * 0.28, 2.5);
        return on ? base * 1.4 : base;
      });
  }

  // ---------- event handlers ----------
  // source: monolith lines 752-760, unchanged.

  function onComboClick(key){
    selectedComboKey = (selectedComboKey === key) ? null : key;
    render();
  }

  function onAttrClick(name){
    highlightedAttr = (highlightedAttr === name) ? null : name;
    render();
  }

  // ---------- main render ----------
  // source: monolith lines 764-801, unchanged apart from DOM lookups.

  function render(){
    if (!combosAll.length){ return; }

    var filteredCombos = combosAll.filter(function(c){ return c.size >= minSizeFilter; });
    var displayed = filteredCombos.slice(0, MAX_COMBOS);

    if (selectedComboKey){
      var stillVisible = displayed.some(function(d){ return d.key === selectedComboKey; });
      if (!stillVisible) selectedComboKey = null;
    }

    var matrixScrollEl = els.matrixScroll;
    var n = Math.max(displayed.length, 1);
    var m = Math.max(topAttributes.length, 1);
    var availW = Math.max(matrixScrollEl.clientWidth, 10);
    var availH = Math.max(matrixScrollEl.clientHeight, 10);
    var colWidth = Math.max(availW / n, MIN_COL_WIDTH);
    var rowHeight = Math.max(availH / m, MIN_ROW_HEIGHT);
    colWidthCache = colWidth;
    rowHeightCache = rowHeight;

    var maxSize = d3.max(displayed, function(d){ return d.size; }) || 1;

    renderCornerAxis(maxSize);
    renderTopPanel(displayed, colWidth);
    renderLeftPanel(topAttributes, rowHeight);
    renderMatrixPanel(displayed, topAttributes, colWidth, rowHeight);
    renderDrawer(displayed);
    updateStats(displayed.length, filteredCombos.length);

    var hlChip = els.hlChip;
    if (highlightedAttr){
      hlChip.style.display = 'flex';
      els.hlChipLabel.textContent = highlightedAttr;
    } else {
      hlChip.style.display = 'none';
    }
  }

  // ---------- load ----------
  // source: monolith lines 803-841 (loadPolicy). File-drop parsing
  // (handleFile/FileReader/JSON.parse/showError/clearError, monolith
  // lines 805-863) is removed entirely -- data now comes pre-loaded
  // from App.data (populated by the shell's own loader) rather than
  // a per-view dropped file, so there is no invalid-JSON path left
  // to guard here.

  function loadFromAppData(){
    var data = App.data;
    if (!data || !Array.isArray(data.domains) || !data.attributes) return;

    computeModel(data);

    minSizeFilter = 1;
    highlightedAttr = null;
    selectedComboKey = null;

    var maxSize = combosAll.length ? combosAll[0].size : 1;
    els.minSizeSlider.min = 1;
    els.minSizeSlider.max = Math.max(maxSize, 1);
    els.minSizeSlider.value = 1;
    els.minSizeValue.textContent = '1';

    render();
  }

  // ============================================================
  // View lifecycle
  // ============================================================

  function createUpset(container){
    /* 1. Inject CSS */
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* 2. Build DOM (toolbar, upset grid, drawer) inside container */
    var root = App.el('div', 'upset-root');
    root.innerHTML = TEMPLATE;
    container.appendChild(root);
    els.root = root;

    els.minSizeSlider = root.querySelector('#min-size-slider');
    els.minSizeValue = root.querySelector('#min-size-value');
    els.hlChip = root.querySelector('#hl-chip');
    els.hlChipLabel = root.querySelector('#hl-chip-label');
    els.hlChipClear = root.querySelector('#hl-chip-clear');
    els.tbStats = root.querySelector('#tb-stats');
    els.moreNote = root.querySelector('#more-note');
    els.cornerPanel = root.querySelector('#corner-panel');
    els.leftScroll = root.querySelector('#left-scroll');
    els.leftPanel = root.querySelector('#left-panel');
    els.topScroll = root.querySelector('#top-scroll');
    els.topPanel = root.querySelector('#top-panel');
    els.matrixScroll = root.querySelector('#matrix-scroll');
    els.matrixPanel = root.querySelector('#matrix-panel');
    els.detailDrawer = root.querySelector('#detail-drawer');
    els.drawerTitle = root.querySelector('#drawer-title');
    els.drawerClose = root.querySelector('#drawer-close');
    els.drawerBody = root.querySelector('#drawer-body');

    /* 3. Wire event listeners (source: monolith lines 900-946,
       minus dropzone/file-input/reset-btn wiring which no longer
       exists) */
    els.minSizeSlider.addEventListener('input', function(event){
      minSizeFilter = parseInt(event.target.value, 10) || 1;
      els.minSizeValue.textContent = minSizeFilter;
      render();
    });

    els.hlChipClear.addEventListener('click', function(){
      highlightedAttr = null;
      render();
    });

    els.drawerClose.addEventListener('click', function(){
      selectedComboKey = null;
      render();
    });

    els.topScroll.addEventListener('scroll', function(){
      if (isSyncingScroll) return;
      isSyncingScroll = true;
      els.matrixScroll.scrollLeft = els.topScroll.scrollLeft;
      isSyncingScroll = false;
    });
    els.matrixScroll.addEventListener('scroll', function(){
      if (isSyncingScroll) return;
      isSyncingScroll = true;
      els.topScroll.scrollLeft = els.matrixScroll.scrollLeft;
      els.leftScroll.scrollTop = els.matrixScroll.scrollTop;
      isSyncingScroll = false;
    });
    els.leftScroll.addEventListener('scroll', function(){
      if (isSyncingScroll) return;
      isSyncingScroll = true;
      els.matrixScroll.scrollTop = els.leftScroll.scrollTop;
      isSyncingScroll = false;
    });

    resizeHandler = function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        if (combosAll.length) render();
      }, 150);
    };
    window.addEventListener('resize', resizeHandler);

    /* 4. Load data (App.data, populated by the shell) and draw */
    loadFromAppData();
  }

  function destroyUpset(){
    if (resizeHandler){
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    clearTimeout(resizeTimer);
    resizeTimer = null;

    App.tooltip.hide();

    if (els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);

    /* Remove CSS */
    if (styleEl){ styleEl.remove(); styleEl = null; }

    /* Clear DOM refs */
    els = {};

    /* Clear local state */
    domains = [];
    domainSet = new Set();
    catLookup = {};
    attrDomains = {};
    domainAttrs = {};
    combosAll = [];
    attrTotals = [];
    topAttributes = [];
    minSizeFilter = 1;
    highlightedAttr = null;
    selectedComboKey = null;
    isSyncingScroll = false;
    colWidthCache = MIN_COL_WIDTH;
    rowHeightCache = MIN_ROW_HEIGHT;
  }

  App.registerView('upset-attributes', { label: 'UPSET', icon: '∩', create: createUpset, destroy: destroyUpset });
})();
