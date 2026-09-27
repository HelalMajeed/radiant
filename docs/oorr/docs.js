/* OORR AI docs — copy buttons, language tabs, compact mobile nav, scroll-spy,
   a deliberately small syntax highlighter, and the terminal's motion layer:
   the wireframe globe, scroll-reveal, the reading bar and the status-legend
   trace. No dependencies, no network.

   Every moving part is optional. If scripting fails or motion is reduced, the
   page still renders complete and static — nothing here is load-bearing for
   reading the documentation. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var MOTION_OK = !(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------------------------------------------------------- highlight
     One pass over the raw source. Each match is escaped as it is wrapped, and
     the gaps between matches are escaped too, so nothing can inject markup. */

  var KEYWORDS = /^(const|let|var|async|await|function|return|new|class|import|from|export|if|else|for|while|try|catch|throw|typeof|type|def|raise|with|as|in|not|None|True|False|print|lambda|elif)$/;

  function esc(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var TOKEN = new RegExp(
    [
      // A bare URL is matched FIRST so the "//" in "https://" can never fall
      // through to the line-comment rule below.
      '(https?://[^\\s"\'`,)]+)',               // 1 url
      '(#[^\\n]*|//[^\\n]*)',                   // 2 comment
      '("(?:[^"\\\\\\n]|\\\\.)*")(\\s*:)?',     // 3 string, 4 optional trailing colon
      '(\\b\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)', // 5 number
      '([A-Za-z_][A-Za-z0-9_]*)'                // 6 word
    ].join('|'),
    'g'
  );

  function highlight(source) {
    var out = '';
    var last = 0;
    var m;

    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(source)) !== null) {
      out += esc(source.slice(last, m.index));
      last = TOKEN.lastIndex;

      if (m[1]) {
        out += esc(m[1]);
      } else if (m[2]) {
        out += '<span class="t-com">' + esc(m[2]) + '</span>';
      } else if (m[3]) {
        // A string immediately followed by ':' reads as an object key.
        var cls = m[4] ? 't-key' : 't-str';
        out += '<span class="' + cls + '">' + esc(m[3]) + '</span>';
        if (m[4]) out += esc(m[4]);
      } else if (m[5]) {
        out += '<span class="t-num">' + esc(m[5]) + '</span>';
      } else if (m[6]) {
        out += KEYWORDS.test(m[6])
          ? '<span class="t-kw">' + esc(m[6]) + '</span>'
          : esc(m[6]);
      }
    }
    return out + esc(source.slice(last));
  }

  /* ------------------------------------------------------------------- copy */

  var COPY_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="9" y="9" width="12" height="12" rx="2"/>' +
    '<path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';
  var DONE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';

  function visiblePre(wrap) {
    var panes = $$('pre', wrap);
    for (var i = 0; i < panes.length; i++) {
      if (!panes[i].hidden) return panes[i];
    }
    return panes[0];
  }

  function attachCopy(wrap) {
    var head = $('.codehead', wrap);
    if (!head) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.innerHTML = COPY_ICON + '<span>Copy</span>';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    head.appendChild(btn);

    var reset;
    btn.addEventListener('click', function () {
      var pre = visiblePre(wrap);
      if (!pre) return;
      // `data-source` is the pristine text captured before highlighting.
      var text = pre.getAttribute('data-source') || pre.textContent;

      var settle = function (ok) {
        btn.innerHTML = (ok ? DONE_ICON : COPY_ICON) +
          '<span>' + (ok ? 'Copied' : 'Press ⌘C') + '</span>';
        btn.classList.toggle('is-done', ok);
        clearTimeout(reset);
        reset = setTimeout(function () {
          btn.innerHTML = COPY_ICON + '<span>Copy</span>';
          btn.classList.remove('is-done');
        }, 1900);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { settle(true); },
          function () { selectFallback(pre); settle(false); }
        );
      } else {
        selectFallback(pre);
        settle(false);
      }
    });
  }

  // Clipboard unavailable (insecure origin, denied permission): select the code
  // so the reader can copy it manually rather than leaving the button inert.
  function selectFallback(pre) {
    try {
      var range = document.createRange();
      range.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* selection is a nicety, never a failure path */ }
  }

  /* ------------------------------------------------------------------- tabs */

  function attachTabs(wrap) {
    var tabs = $$('.tab', wrap);
    var panes = $$('pre', wrap);
    if (tabs.length === 0 || tabs.length !== panes.length) return;

    function select(index) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.setAttribute('tabindex', on ? '0' : '-1');
        panes[i].hidden = !on;
      });
    }

    tabs.forEach(function (tab, i) {
      var pane = panes[i];
      var id = 'pane-' + Math.random().toString(36).slice(2, 9);
      pane.id = id;
      tab.setAttribute('aria-controls', id);
      pane.setAttribute('aria-labelledby', id + '-tab');
      tab.id = id + '-tab';

      tab.addEventListener('click', function () { select(i); });
      tab.addEventListener('keydown', function (e) {
        var next = e.key === 'ArrowRight' ? i + 1
          : e.key === 'ArrowLeft' ? i - 1
            : null;
        if (next === null) return;
        e.preventDefault();
        var target = (next + tabs.length) % tabs.length;
        select(target);
        tabs[target].focus();
      });
    });

    select(0);
  }

  /* ------------------------------------------------------------- code blocks */

  $$('.codewrap').forEach(function (wrap) {
    $$('pre', wrap).forEach(function (pre) {
      var code = $('code', pre) || pre;
      var source = code.textContent;
      pre.setAttribute('data-source', source);
      code.innerHTML = highlight(source);
    });
    if (wrap.hasAttribute('data-tabs')) attachTabs(wrap);
    attachCopy(wrap);
  });

  /* ----------------------------------------------------------- mobile drawer */

  var toggle = $('#navtoggle');
  var sidebar = $('#sidebar');
  var COMPACT = '(max-width: 820px)';

  function isCompact() { return window.matchMedia(COMPACT).matches; }

  if (toggle && sidebar) {
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    document.body.appendChild(scrim);

    var setNav = function (open) {
      sidebar.classList.toggle('is-open', open);
      scrim.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      // Stop the page behind the drawer from scrolling under the finger.
      document.body.style.overflow = open ? 'hidden' : '';
    };

    // Leaving the compact breakpoint must not strand the page in the drawer's
    // state: the sidebar is permanent on desktop, so everything is reset.
    var syncNav = function () {
      if (!isCompact()) setNav(false);
    };

    toggle.addEventListener('click', function () {
      setNav(!sidebar.classList.contains('is-open'));
    });

    scrim.addEventListener('click', function () { setNav(false); });

    // A link navigates to a real page, so the drawer closing is incidental —
    // but it matters for the current page's own link.
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a') && isCompact()) setNav(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        setNav(false);
        toggle.focus();
      }
    });

    var mq = window.matchMedia(COMPACT);
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(syncNav);
    syncNav();
  }

  /* ------------------------------------------------------------ on this page
     Each sidebar entry is now its own page, so the sidebar's current item is
     rendered server-side. What remains useful is a rail for the headings
     WITHIN a page, built here from the article's own h3s. */

  var toc = $('#toc');
  var headings = $$('.prose h3').filter(function (h) { return h.textContent.trim() !== ''; });

  // A heading may carry a status pill; the rail wants the words, not the badge.
  function headingLabel(h) {
    var clone = h.cloneNode(true);
    $$('.pill', clone).forEach(function (pill) { pill.remove(); });
    return clone.textContent.trim();
  }

  function slugify(text, index) {
    var base = text
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'section-' + index;
  }

  // Two entries is the point at which a contents rail earns its space.
  if (toc && headings.length >= 2) {
    var seen = Object.create(null);
    var list = document.createElement('ul');

    headings.forEach(function (h, i) {
      if (!h.id) {
        var slug = slugify(headingLabel(h), i);
        while (seen[slug]) slug += '-' + i;   // ids must stay unique
        seen[slug] = true;
        h.id = slug;
      }
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = headingLabel(h);
      li.appendChild(a);
      list.appendChild(li);
    });

    var title = document.createElement('p');
    title.className = 'toc-title';
    title.textContent = 'On this page';
    toc.appendChild(title);
    toc.appendChild(list);

    // The light that rides the rail alongside the active entry.
    var dot = document.createElement('i');
    dot.className = 'toc-dot';
    dot.setAttribute('aria-hidden', 'true');
    toc.appendChild(dot);
    toc.classList.add('is-active');

    var links = $$('a', toc);
    var readingLine = function () { return Math.max(110, window.innerHeight * 0.3); };

    var mark = function () {
      var current = headings[0];
      var line = readingLine();
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= line) current = headings[i];
      }
      var atBottom = window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) current = headings[headings.length - 1];

      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + current.id;
        a.classList.toggle('is-current', on);
        if (on) toc.style.setProperty('--y', (a.offsetTop + a.offsetHeight / 2) + 'px');
      });
    };

    var queued = false;
    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; mark(); });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    links.forEach(function (a) {
      a.addEventListener('click', function () { setTimeout(mark, 700); });
    });
    mark();
  }

  /* --------------------------------------------------------------- reading bar
     Progress through the article, drawn on the underside of the top bar. */

  var readbar = $('#readbar i');
  if (readbar) {
    var ticking = false;
    var drawBar = function () {
      var doc = document.documentElement;
      var span = doc.scrollHeight - window.innerHeight;
      var pct = span > 0 ? (window.scrollY / span) * 100 : 0;
      readbar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    };
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; drawBar(); });
    }, { passive: true });
    window.addEventListener('resize', drawBar);
    drawBar();
  }

  /* ------------------------------------------------------------ legend trace
     Pointing at a legend entry traces that status through the whole page:
     matching pills light up, the rest recede. Clicking pins the trace, so it
     survives the pointer leaving the sidebar; Escape or a second click clears
     it. Keyboard focus does the same as hover. */

  var legendBtns = $$('.lg');
  if (legendBtns.length) {
    var pinned = null;

    var applyTrace = function (status) {
      if (status) document.body.setAttribute('data-trace', status);
      else document.body.removeAttribute('data-trace');
    };

    var pin = function (btn, status) {
      pinned = status;
      legendBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn && status ? 'true' : 'false');
      });
      applyTrace(status);
    };

    legendBtns.forEach(function (btn) {
      var status = btn.getAttribute('data-status');

      var enter = function () { if (!pinned) applyTrace(status); };
      var leave = function () { applyTrace(pinned); };

      btn.addEventListener('mouseenter', enter);
      btn.addEventListener('mouseleave', leave);
      btn.addEventListener('focus', enter);
      btn.addEventListener('blur', leave);
      btn.addEventListener('click', function () {
        pin(btn, pinned === status ? null : status);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pinned) pin(null, null);
    });
  }

  /* --------------------------------------------------------- idle stat tiles
     A tile whose figure is an em dash has no data source behind it. Say so
     visually rather than printing a bare dash. */

  $$('.stat').forEach(function (stat) {
    var dd = $('dd', stat);
    if (!dd) return;
    var lead = (dd.firstChild && dd.firstChild.nodeType === 3)
      ? dd.firstChild.textContent.trim() : '';
    if (lead === '—' || lead === '-') stat.classList.add('is-idle');
  });

  /* ------------------------------------------------------- pointer spotlight
     Cards track the pointer with a soft light. One delegated listener, one
     rAF per frame, and nothing at all when motion is reduced. */

  if (MOTION_OK && window.matchMedia('(pointer: fine)').matches) {
    var LIT = '.stat,.price,.panel,.pager-link,.keyrow';
    var pending = null;
    var lightQueued = false;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest(LIT) : null;
      if (!card) return;
      pending = { card: card, x: e.clientX, y: e.clientY };
      if (lightQueued) return;
      lightQueued = true;
      requestAnimationFrame(function () {
        lightQueued = false;
        if (!pending) return;
        var r = pending.card.getBoundingClientRect();
        pending.card.style.setProperty('--mx', (pending.x - r.left) + 'px');
        pending.card.style.setProperty('--my', (pending.y - r.top) + 'px');
        pending = null;
      });
    }, { passive: true });
  }

  /* --------------------------------------------------------- reveal on scroll
     Blocks arrive with a short focus pull, staggered within whatever batch
     enters together. Code blocks and price cards also fire their one-shot
     flourish here. `.rv` is only ever added from script, so with JS off — or
     motion reduced — the article is simply already there. */

  var revealables = $$([
    '.prose > h2', '.prose > h3', '.prose > h4', '.prose > p',
    '.prose > ul', '.prose > ol', '.prose > .note', '.prose > .codewrap',
    '.prose > .tablewrap', '.prose > .grid', '.prose > .panel',
    '.prose > .keys', '.prose > .empty', '.prose > .pager'
  ].join(','));

  function flourish(el) {
    if (el.classList.contains('codewrap')) el.classList.add('is-lit');
    if (el.classList.contains('price')) el.classList.add('is-lit');
    $$('.price', el).forEach(function (p) { p.classList.add('is-lit'); });
    $$('.codewrap', el).forEach(function (c) { c.classList.add('is-lit'); });
  }

  if (MOTION_OK && 'IntersectionObserver' in window && revealables.length) {
    var inView = function (el) {
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };

    revealables.forEach(function (el) { el.classList.add('rv'); });

    // Everything already on screen animates in as one opening sequence.
    var opening = revealables.filter(inView);
    opening.forEach(function (el, i) {
      el.style.setProperty('--d', Math.min(i, 6));
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        opening.forEach(function (el) { el.classList.add('rv-in'); flourish(el); });
      });
    });

    var io = new IntersectionObserver(function (entries) {
      var step = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.setProperty('--d', Math.min(step, 4));
        step += 1;
        el.classList.add('rv-in');
        flourish(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    revealables.forEach(function (el) {
      if (opening.indexOf(el) === -1) io.observe(el);
    });
  } else {
    revealables.forEach(flourish);
  }

  /* -------------------------------------------------------------------- globe
     The one instrument on the page: a wireframe Earth. Coastlines are drawn as
     outlines over a lat/long cage, with relay hubs, their yellow spokes, and
     dotted long-haul links between them. Everything is projected by hand from
     spherical coordinates — no data files, no dependencies.

     The coastlines are coarse on purpose: at this size the silhouette is what
     reads, so each landmass is a short ordered ring rather than real geometry. */

  var LAND = [
    // North America, down the Atlantic and back up the Pacific
    [[-168,66],[-162,70],[-145,70],[-128,70],[-115,69],[-100,69],[-88,68],[-80,63],
     [-65,60],[-55,52],[-60,47],[-66,45],[-70,42],[-75,37],[-81,31],[-80,26],
     [-84,30],[-90,29],[-97,26],[-97,21],[-91,18],[-88,21],[-87,16],[-84,10],
     [-78,8],[-83,13],[-95,16],[-105,21],[-110,24],[-114,28],[-117,33],[-122,38],
     [-124,45],[-130,54],[-138,59],[-150,60],[-160,56],[-165,60]],
    // South America
    [[-78,8],[-72,11],[-62,10],[-52,5],[-50,0],[-44,-2],[-38,-5],[-35,-8],[-39,-15],
     [-45,-23],[-48,-25],[-53,-33],[-58,-38],[-62,-40],[-65,-45],[-68,-52],[-70,-55],
     [-75,-52],[-74,-45],[-73,-37],[-71,-30],[-70,-23],[-71,-18],[-77,-12],[-81,-6],[-80,0]],
    // Africa
    [[-17,15],[-16,20],[-13,28],[-10,35],[0,36],[10,37],[20,32],[30,31],[34,28],
     [37,22],[39,15],[43,11],[51,12],[48,5],[42,-2],[40,-10],[40,-17],[35,-24],
     [32,-29],[25,-34],[18,-34],[15,-27],[12,-18],[13,-8],[9,4],[3,6],[-5,5],[-13,9]],
    // Eurasia
    [[-10,36],[-9,42],[-2,44],[3,43],[12,45],[18,42],[24,41],[28,41],[36,36],[36,31],
     [34,29],[43,29],[48,29],[56,25],[60,25],[66,25],[72,20],[73,16],[77,8],[80,13],
     [83,18],[87,21],[92,21],[95,16],[98,10],[100,5],[104,2],[105,10],[108,15],
     [110,21],[117,23],[122,30],[121,38],[126,40],[128,43],[135,45],[140,50],
     [143,54],[150,59],[158,61],[163,60],[170,66],[179,66],[179,71],[160,70],
     [140,73],[120,74],[100,76],[80,73],[70,72],[60,70],[50,69],[40,67],[33,70],
     [28,70],[20,69],[12,65],[5,60],[8,57],[4,52],[-2,48],[-9,43]],
    // Greenland
    [[-45,60],[-42,64],[-32,68],[-22,70],[-20,76],[-30,82],[-45,83],[-58,82],[-62,76],[-55,68],[-50,62]],
    // Australia
    [[113,-22],[114,-26],[115,-32],[118,-35],[125,-32],[132,-32],[137,-35],[140,-38],
     [146,-39],[150,-37],[153,-30],[153,-25],[146,-19],[142,-11],[136,-12],[130,-12],
     [126,-14],[122,-17],[117,-20]],
    // and the islands that keep the silhouette honest
    [[-5,50],[-4,53],[-3,55],[-2,57],[-3,58],[0,57],[1,53],[-1,51]],
    [[-10,52],[-9,55],[-6,55],[-6,52]],
    [[-24,64],[-22,66],[-15,66],[-14,64],[-19,63]],
    [[130,31],[132,34],[136,35],[139,35],[141,39],[142,42],[145,44],[143,43],[140,38],[137,35],[133,33],[131,32]],
    [[43,-25],[45,-25],[48,-20],[50,-16],[49,-13],[46,-16],[44,-21]],
    [[166,-46],[168,-47],[172,-44],[174,-41],[176,-38],[178,-37],[175,-40],[171,-43]],
    [[109,2],[117,4],[119,-2],[114,-4],[110,-2]],
    [[95,5],[100,0],[106,-6],[104,-6],[98,1]],
    [[-85,22],[-80,23],[-75,20],[-80,21]]
  ];

  /* Relay hubs, each with short spokes out to the endpoints it serves, and the
     long-haul links that run between hubs. Positions are chosen to sit over
     land, so the network reads as sited rather than scattered. */
  var HUBS = [
    { lat:  54, lon: -104, spokes: [[7,-15],[-5,-19],[9,5]] },
    { lat:  49, lon:    9, spokes: [[6,-11],[-5,11],[7,15]] },
    { lat:   8, lon:  -62, spokes: [[9,-9],[-7,-11],[-11,7],[6,10]] },
    { lat: -20, lon:  -45, spokes: [[7,-8]] },
    { lat:   6, lon:   21, spokes: [[9,11],[-8,6]] },
    { lat:  35, lon:  -95, spokes: [] }
  ];
  var LINKS = [[0,1],[0,2],[2,3],[2,4],[1,4],[5,2],[0,5]];

  var globeEl = $('#globe');
  if (globeEl && globeEl.getContext) {
    try {
      (function () {
        var ctx = globeEl.getContext('2d');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var W = 0, H = 0, R = 0, CX = 0, CY = 0;
        var rot = 20, raf = 0;
        var TILT = -0.30;                     // seen slightly from above
        var sinT = Math.sin(TILT), cosT = Math.cos(TILT);
        var ACCENT = '#e8f55e';

        function project(lat, lon) {
          var la = lat * Math.PI / 180;
          var lo = (lon + rot) * Math.PI / 180;
          var cl = Math.cos(la);
          var x = cl * Math.sin(lo);
          var y = Math.sin(la);
          var z = cl * Math.cos(lo);
          var y2 = y * cosT - z * sinT;
          var z2 = y * sinT + z * cosT;
          return { x: CX + x * R, y: CY - y2 * R, front: z2 > 0.02, z: z2 };
        }

        function size() {
          W = globeEl.clientWidth;
          H = globeEl.clientHeight;
          if (!W || !H) return false;
          globeEl.width = Math.round(W * dpr);
          globeEl.height = Math.round(H * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          R = Math.min(W, H) * 0.44;
          CX = W / 2;
          CY = H / 2;
          return true;
        }

        // One pass of the lat/long cage. `front` picks which hemisphere to ink.
        function cage(front) {
          var lat, lon, p, started;
          ctx.lineWidth = 1;
          ctx.strokeStyle = front ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)';
          ctx.beginPath();
          for (lat = -75; lat <= 75; lat += 15) {
            started = false;
            for (lon = -180; lon <= 180; lon += 4) {
              p = project(lat, lon);
              if (p.front !== front) { started = false; continue; }
              if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
            }
          }
          // meridians stop short of the poles: drawn all the way in, they
          // converge into a knot wherever a pole faces the viewer
          for (lon = -180; lon < 180; lon += 15) {
            started = false;
            for (lat = -68; lat <= 68; lat += 4) {
              p = project(lat, lon);
              if (p.front !== front) { started = false; continue; }
              if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
        }

        // Coastlines, drawn only where both ends of a segment face us.
        function coast(front) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = front ? 'rgba(255,255,255,.78)' : 'rgba(255,255,255,.1)';
          ctx.beginPath();
          for (var i = 0; i < LAND.length; i++) {
            var ring = LAND[i];
            for (var j = 0; j < ring.length; j++) {
              var a = project(ring[j][1], ring[j][0]);
              var k = (j + 1) % ring.length;
              var b = project(ring[k][1], ring[k][0]);
              if (a.front !== front || b.front !== front) continue;
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
            }
          }
          ctx.stroke();
        }

        function dottedLink(a, b) {
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          for (var t = 0; t <= 1.0001; t += 1 / 30) {
            var p = project(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t);
            if (!p.front) continue;
            ctx.globalAlpha = 0.25 + p.z * 0.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.15, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        function hubs() {
          for (var i = 0; i < HUBS.length; i++) {
            var h = HUBS[i];
            var p = project(h.lat, h.lon);
            if (!p.front) continue;
            var a = 0.35 + p.z * 0.65;

            // yellow spokes out to the endpoints this hub serves
            for (var sIdx = 0; sIdx < h.spokes.length; sIdx++) {
              var e = project(h.lat + h.spokes[sIdx][0], h.lon + h.spokes[sIdx][1]);
              if (!e.front) continue;
              ctx.globalAlpha = a * 0.85;
              ctx.strokeStyle = ACCENT;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(e.x, e.y);
              ctx.stroke();
              ctx.fillStyle = ACCENT;
              ctx.beginPath();
              ctx.arc(e.x, e.y, 2.4, 0, Math.PI * 2);
              ctx.fill();
            }

            // the hub itself: a ringed marker with a bar through it
            ctx.globalAlpha = a;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.92)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x - 3.4, p.y + 1.2);
            ctx.lineTo(p.x + 3.4, p.y - 1.2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Two shallow rings and a survey line, sitting off the sphere.
        function orbits() {
          ctx.strokeStyle = 'rgba(255,255,255,.13)';
          ctx.lineWidth = 1;
          var rings = [[-0.46, 1.2, 0.24], [0.42, 1.28, 0.17]];
          for (var i = 0; i < rings.length; i++) {
            ctx.save();
            ctx.translate(CX, CY);
            ctx.rotate(rings[i][0]);
            ctx.beginPath();
            ctx.ellipse(0, 0, R * rings[i][1], R * rings[i][2], 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          ctx.strokeStyle = 'rgba(255,255,255,.07)';
          ctx.beginPath();
          ctx.moveTo(CX + R * 1.5, CY - R * 1.25);
          ctx.lineTo(CX - R * 0.9, CY + R * 1.4);
          ctx.stroke();
        }

        function frame() {
          ctx.clearRect(0, 0, W, H);
          orbits();
          cage(false);
          coast(false);
          cage(true);
          coast(true);
          for (var l = 0; l < LINKS.length; l++) dottedLink(HUBS[LINKS[l][0]], HUBS[LINKS[l][1]]);
          hubs();
          if (MOTION_OK) {
            rot += 0.07;
            if (rot > 360) rot -= 360;
            raf = requestAnimationFrame(frame);
          }
        }

        if (!size()) return;
        frame();
        globeEl.classList.add('is-on');

        var resizeQueued = false;
        window.addEventListener('resize', function () {
          if (resizeQueued) return;
          resizeQueued = true;
          setTimeout(function () {
            resizeQueued = false;
            if (size() && !MOTION_OK) frame();
          }, 220);
        });

        document.addEventListener('visibilitychange', function () {
          if (!MOTION_OK) return;
          if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
          else if (!raf) raf = requestAnimationFrame(frame);
        });
      })();
    } catch (e) {
      // An instrument is never worth a broken page.
      globeEl.style.display = 'none';
    }
  }

})();
