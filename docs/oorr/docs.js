/* OORR AI docs — copy buttons, language tabs, compact mobile nav, scroll-spy,
   a deliberately small syntax highlighter, and the console's motion layer:
   the constellation stage, scroll-reveal, the reading bar and the status-legend
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

  /* ------------------------------------------------------------- constellation
     The neural field behind the page: slow-drifting nodes that link up when
     they pass near one another. Decorative, so it is skipped entirely on
     narrow screens, under reduced motion, and while the tab is hidden. */

  var canvas = $('#stagenet');
  if (canvas && MOTION_OK && window.innerWidth >= 760) {
    try {
      var ctx = canvas.getContext('2d');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var nodes = [];
      var w = 0, h = 0, raf = 0;
      var LINK = 132;

      var seed = function () {
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var count = Math.min(72, Math.round((w * h) / 26000));
        nodes = [];
        for (var i = 0; i < count; i++) {
          nodes.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.16,
            vy: (Math.random() - 0.5) * 0.16,
            r: Math.random() * 1.3 + 0.5,
            violet: Math.random() > 0.62
          });
        }
      };

      var frame = function () {
        ctx.clearRect(0, 0, w, h);

        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          n.x += n.vx;
          n.y += n.vy;
          // Wrap rather than bounce: no node ever piles up against an edge.
          if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
          if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;

          for (var j = i + 1; j < nodes.length; j++) {
            var m = nodes[j];
            var dx = n.x - m.x, dy = n.y - m.y;
            var d2 = dx * dx + dy * dy;
            if (d2 > LINK * LINK) continue;
            var a = (1 - Math.sqrt(d2) / LINK) * 0.17;
            ctx.strokeStyle = 'rgba(122,164,255,' + a.toFixed(3) + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }

          ctx.fillStyle = n.violet ? 'rgba(157,123,255,.55)' : 'rgba(120,175,255,.5)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fill();
        }

        raf = requestAnimationFrame(frame);
      };

      var start = function () { if (!raf) raf = requestAnimationFrame(frame); };
      var stop = function () { cancelAnimationFrame(raf); raf = 0; };

      seed();
      start();

      var resizeQueued = false;
      window.addEventListener('resize', function () {
        if (resizeQueued) return;
        resizeQueued = true;
        setTimeout(function () { resizeQueued = false; seed(); }, 220);
      });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });
    } catch (e) {
      // A decorative layer is never worth a broken page.
      canvas.style.display = 'none';
    }
  }

})();
