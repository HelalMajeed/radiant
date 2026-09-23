/* OORR AI docs — copy buttons, language tabs, compact mobile nav, scroll-spy
   and a deliberately small syntax highlighter. No dependencies, no network. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

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
        var slug = slugify(h.textContent, i);
        while (seen[slug]) slug += '-' + i;   // ids must stay unique
        seen[slug] = true;
        h.id = slug;
      }
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      list.appendChild(li);
    });

    var title = document.createElement('p');
    title.className = 'toc-title';
    title.textContent = 'On this page';
    toc.appendChild(title);
    toc.appendChild(list);
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
        a.classList.toggle('is-current', a.getAttribute('href') === '#' + current.id);
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

})();
