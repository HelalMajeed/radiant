/* Radiant AI — agent graph.

   Layout is recomputed from the stage box on every resize, then relaxed so
   node boxes (disc + label) can never overlap each other, the root mark, or
   the stage edges. Everything else — drift, sonar dispatch, agent-to-agent
   traffic, pointer field — is simulation drawn on top of those anchors,
   driven from a single rAF loop. */

(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*<>/\\';

  var stage = document.getElementById('stage');
  var rootEl = document.getElementById('root');
  var rootCore = rootEl.querySelector('.core');
  var markWrap = document.getElementById('markWrap');

  var gMotes = document.getElementById('gMotes');
  var gSonar = document.getElementById('gSonar');
  var gEdges = document.getElementById('gEdges');
  var gPings = document.getElementById('gPings');
  var gPackets = document.getElementById('gPackets');

  var W = 0, H = 0, narrow = false;
  var root = { x: 0, y: 0, hw: 0, hh: 0, bx: 0, by: 0 };
  var ready = false;

  function el(name, cls, parent) {
    var e = document.createElementNS(SVG_NS, name);
    if (cls) e.setAttribute('class', cls);
    parent.appendChild(e);
    return e;
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- agents ---------- */

  var agents = [].map.call(document.querySelectorAll('.node--agent'), function (node, i) {
    var line = el('line', 'edge', gEdges);
    line.setAttribute('pathLength', '1');
    line.style.transitionDelay = (300 + i * 70) + 'ms';

    var label = node.querySelector('.label');

    node.setAttribute('tabindex', '0');
    node.querySelector('.core').style.transitionDelay = (320 + i * 70) + 'ms';

    return {
      el: node, core: node.querySelector('.core'), disc: node.querySelector('.disc'),
      label: label, name: label.textContent,
      line: line, pulse: el('circle', 'pulse', gEdges), ping: el('circle', 'ping', gPings),
      i: i, bx: 0, by: 0, x: 0, y: 0, hw: 0, hh: 0, discR: 0,
      near: 0, pingT0: -1, active: false,
      // drift signature — every node breathes on its own clock
      ampX: 2.4 + (i % 3) * 0.6, ampY: 2.4 + ((i + 1) % 3) * 0.6,
      freqX: 0.00021 + i * 0.000017, freqY: 0.00026 + i * 0.000013,
      phaseX: i * 1.19, phaseY: i * 0.73,
      flow: 0.10 + (i % 4) * 0.018, offset: i / 8
    };
  });

  agents.forEach(function (n) {
    n.pulse.setAttribute('r', '1.9');
    n.ping.style.opacity = '0';
  });

  /* ---------- ambient motes ---------- */

  var motes = [];
  for (var mi = 0; mi < 18; mi++) {
    var m = el('circle', 'mote', gMotes);
    m.setAttribute('r', rand(0.7, 1.9).toFixed(2));
    motes.push({
      el: m, fx: Math.random(), fy: Math.random(),
      sp: rand(0.000012, 0.00004), amp: rand(0.008, 0.035),
      ph: rand(0, 6.28), o: rand(0.12, 0.5)
    });
  }

  /* ---------- sonar rings + packet pool ---------- */

  var sonars = [], packets = [];
  for (var si = 0; si < 3; si++) sonars.push({ el: el('circle', 'sonar', gSonar), t0: -1, hit: null });
  var TRAIL = [
    { lag: 0,     r: 3.0, o: 1    },
    { lag: 0.035, r: 1.9, o: 0.55 },
    { lag: 0.07,  r: 1.4, o: 0.32 },
    { lag: 0.105, r: 1.0, o: 0.18 }
  ];
  for (var pi = 0; pi < 12; pi++) {
    var slot = { route: el('path', 'route', gPackets), dots: [], t0: -1, a: null, b: null, dur: 0, bend: 0.18 };
    for (var di = 0; di < TRAIL.length; di++) {
      var dot = el('circle', 'packet', gPackets);
      dot.setAttribute('r', TRAIL[di].r);
      slot.dots.push(dot);
    }
    packets.push(slot);
  }
  sonars.forEach(function (s) { s.el.style.opacity = '0'; });
  packets.forEach(function (p) {
    p.route.style.opacity = '0';
    p.dots.forEach(function (d) { d.style.opacity = '0'; });
  });

  /* ---------- layout ---------- */

  function measure() {
    var r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    narrow = W < 560;

    root.hw = rootCore.offsetWidth / 2;
    root.hh = rootCore.offsetHeight / 2;

    agents.forEach(function (n) {
      n.discR = n.disc.offsetWidth / 2;
      n.hw = n.core.offsetWidth / 2;
      n.hh = n.core.offsetHeight / 2;
    });
  }

  function place() {
    var pad = narrow ? 10 : 16;
    var cx = W / 2;
    var last = agents.length - 1;

    root.bx = cx;
    root.by = Math.min(root.hh + H * 0.045, H * 0.34);

    var tallest = 0, widest = 0;
    agents.forEach(function (n) {
      tallest = Math.max(tallest, n.hh);
      widest = Math.max(widest, n.hw);
    });

    var availY = Math.max(H - root.by - pad - tallest, 170);
    var availX = Math.max(W / 2 - pad - widest, 90);

    // Portrait shapes get the ladder; the radial fan needs width to breathe.
    if (narrow || H > W * 1.12) {
      // A symmetric ladder — four mirrored rows converging under the mark.
      // Rows are evenly pitched, so nothing can crowd or collide.
      var rows = agents.length / 2;
      // phones get a tighter, lighter graph; portrait tablets keep the full spread
      var top = narrow ? root.hh + 18 : 26;   // phones: clear the mark before the first row
      var span = availY * (narrow ? 0.90 : 0.97);
      var nearCol = narrow ? 0.34 : 0.40;
      var farCol = narrow ? 0.52 : 0.60;

      agents.forEach(function (n, i) {
        var side = i < rows ? -1 : 1;
        var depth = (i < rows ? i : last - i) / (rows - 1);   // 0 = beside mark
        n.bx = cx + side * availX * (nearCol + farCol * (1 - depth));
        n.by = root.by + top + depth * (span - top);
      });
    } else {
      // Wide screens: a fan opening downward from the mark. `near` pulls
      // alternate nodes inward so the ring reads with depth, not as one arc.
      var spec = W < 900 ? { a0: 172, a1: 8,  near: 0.86, fillY: 0.96, fillX: 0.99 }
                         : { a0: 168, a1: 12, near: 0.88, fillY: 0.94, fillX: 0.98 };

      var dx = [], dy = [], maxX = 1, maxY = 1;

      agents.forEach(function (n, i) {
        var phi = (spec.a0 + (spec.a1 - spec.a0) * (i / last)) * Math.PI / 180;
        var c = Math.cos(phi), s = Math.sin(phi);
        // polar form of the ellipse: even angular spacing as seen from the root
        var mir = Math.min(i, last - i);               // mirrored -> symmetric fan
        var f = (mir % 2) ? spec.near : 1;
        var r = f / Math.hypot(c / availX, s / availY);
        dx[i] = c * r; dy[i] = s * r;
        maxX = Math.max(maxX, Math.abs(dx[i]));
        maxY = Math.max(maxY, dy[i]);
      });

      // normalise so the fan fills the stage at any aspect ratio
      var kx = clamp(availX * spec.fillX / maxX, 0.5, 1.6);
      var ky = clamp(availY * spec.fillY / maxY, 0.5, 1.6);

      agents.forEach(function (n, i) {
        n.bx = cx + dx[i] * kx;
        n.by = root.by + dy[i] * ky;
      });
    }

    relax(pad);

    agents.forEach(function (n) { n.x = n.bx; n.y = n.by; });
    root.x = root.bx; root.y = root.by;
    draw(0);
  }

  // Axis-aligned separation: nodes are pushed apart on their shallowest axis
  // until no two boxes intersect, then clamped back inside the stage. Gaps are
  // wider than drift + pointer pull combined, so motion can never cause overlap.
  function relax(pad) {
    var gapX = narrow ? 14 : 20, gapY = narrow ? 16 : 22;
    var obstacle = { bx: root.bx, by: root.by, hw: root.hw * 0.84, hh: root.hh * 0.92, fixed: true };

    for (var pass = 0; pass < 220; pass++) {
      var settled = true;

      for (var i = 0; i < agents.length; i++) {
        if (separate(agents[i], obstacle, gapX, gapY)) settled = false;
        for (var j = i + 1; j < agents.length; j++) {
          if (separate(agents[i], agents[j], gapX, gapY)) settled = false;
        }
      }

      agents.forEach(function (n) {
        var minX = pad + n.hw, maxX = W - pad - n.hw;
        var minY = pad + n.hh, maxY = H - pad - n.hh;
        n.bx = maxX < minX ? W / 2 : clamp(n.bx, minX, maxX);
        n.by = maxY < minY ? H / 2 : clamp(n.by, minY, maxY);
      });

      if (settled) break;
    }
  }

  function separate(a, b, gapX, gapY) {
    var dx = b.bx - a.bx, dy = b.by - a.by;
    var ox = (a.hw + b.hw + gapX) - Math.abs(dx);
    var oy = (a.hh + b.hh + gapY) - Math.abs(dy);
    if (ox <= 0 || oy <= 0) return false;

    var shareA = b.fixed ? 1 : 0.5;
    var shareB = b.fixed ? 0 : 0.5;

    if (ox < oy) {
      var sx = (dx === 0 ? (a.i % 2 ? 1 : -1) : (dx > 0 ? 1 : -1));
      a.bx -= sx * ox * shareA;
      b.bx += sx * ox * shareB;
    } else {
      var sy = (dy === 0 ? 1 : (dy > 0 ? 1 : -1));
      a.by -= sy * oy * shareA;
      b.by += sy * oy * shareB;
    }
    return true;
  }

  /* ---------- decrypting text ---------- */

  function scramble(node, text, dur) {
    // remember the true text, so a re-entrant call can never latch onto
    // a half-decrypted string as its target
    if (node._text === undefined) node._text = text;
    text = node._text;

    if (reduced) { node.textContent = text; return; }
    if (node._raf) cancelAnimationFrame(node._raf);
    var t0 = -1;

    node._raf = requestAnimationFrame(function step(now) {
      if (t0 < 0 || now < t0) t0 = now;     // same clock the render loop uses
      var p = Math.min((now - t0) / dur, 1);
      var shown = p * text.length * 1.3;
      var out = '';
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (!/[a-z0-9]/i.test(ch)) { out += ch; continue; }
        out += i < shown ? ch : GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
      }
      node.textContent = out;
      if (p < 1) node._raf = requestAnimationFrame(step);
      else { node.textContent = text; node._raf = 0; }
    });
  }

  /* ---------- traffic ---------- */

  var nextPacket = 0, nextSonar = 0, nextGlitch = 0;
  var clockNow = 0;            // latest render-loop timestamp, for timer-driven sends

  function ping(n, t) { n.pingT0 = t; }

  function flashEdge(n) {
    n.line.classList.add('is-busy');
    setTimeout(function () { n.line.classList.remove('is-busy'); }, 420);
  }

  function sendPacket(t, from, to) {
    var p = null;
    for (var i = 0; i < packets.length; i++) if (packets[i].t0 < 0) { p = packets[i]; break; }
    if (!p) return;

    var a = from || agents[(Math.random() * agents.length) | 0];
    var b = to;
    if (!b) { do { b = agents[(Math.random() * agents.length) | 0]; } while (b === a); }

    p.a = a; p.b = b; p.t0 = t; p.dur = rand(620, 1350);
    // most work is relayed through the hub; some agents talk peer-to-peer
    p.bend = Math.random() < 0.72 ? rand(0.12, 0.26) : rand(0.6, 0.95);
    ping(a, t); flashEdge(a);
  }

  function sonarPing(t) {
    for (var i = 0; i < sonars.length; i++) {
      if (sonars[i].t0 < 0) { sonars[i].t0 = t; sonars[i].hit = {}; return; }
    }
  }

  /* ---------- pointer field ---------- */

  var ptr = { x: 0, y: 0, on: false };

  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = stage.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true;
  });
  stage.addEventListener('pointerleave', function () { ptr.on = false; });

  /* ---------- drawing ---------- */

  function bez(u, x0, y0, cx, cy, x1, y1) {
    var v = 1 - u;
    return [v * v * x0 + 2 * v * u * cx + u * u * x1,
            v * v * y0 + 2 * v * u * cy + u * u * y1];
  }

  function draw(t) {
    rootEl.style.transform = 'translate3d(' + root.x + 'px,' + root.y + 'px,0) translate(-50%,-50%)';

    var erx = Math.max(root.hw * 0.46, 40);
    var ery = Math.max(root.hh * 0.42, 40);

    agents.forEach(function (n) {
      n.el.style.transform = 'translate3d(' + n.x + 'px,' + n.y + 'px,0) translate(-50%,-50%)';

      var dx = n.x - root.x, dy = n.y - root.y;
      var len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len;

      // start on the ellipse hugging the mark, end at the rim of the disc
      var k = 1 / Math.hypot(ux / erx, uy / ery);
      var x1 = root.x + ux * k, y1 = root.y + uy * k;
      var trim = n.discR + 7;
      var x2 = n.x - ux * trim, y2 = n.y - uy * trim;

      n.line.setAttribute('x1', x1); n.line.setAttribute('y1', y1);
      n.line.setAttribute('x2', x2); n.line.setAttribute('y2', y2);

      if (reduced) { n.pulse.style.opacity = '0'; return; }

      var speed = n.active ? n.flow * 2.4 : n.flow;
      var p = ((t * 0.001 * speed) + n.offset) % 1;
      n.pulse.setAttribute('cx', x1 + (x2 - x1) * p);
      n.pulse.setAttribute('cy', y1 + (y2 - y1) * p);
      n.pulse.style.opacity = (ready ? 1 : 0) * Math.sin(Math.PI * p) * (n.active ? 1 : 0.62);

      // expanding ring when this agent is addressed
      if (n.pingT0 >= 0) {
        var q = (t - n.pingT0) / 760;
        if (q >= 1) { n.pingT0 = -1; n.ping.style.opacity = '0'; }
        else {
          n.ping.setAttribute('cx', n.x); n.ping.setAttribute('cy', n.y);
          n.ping.setAttribute('r', n.discR + 2 + q * 26);
          n.ping.style.opacity = (1 - q) * 0.75;
        }
      }
    });
  }

  function tick(t) {
    clockNow = t;
    var pull = narrow ? 4 : 6;

    // root drifts, and leans a little toward the pointer
    var leanX = ptr.on ? clamp((ptr.x - W / 2) * 0.014, -8, 8) : 0;
    var leanY = ptr.on ? clamp((ptr.y - root.by) * 0.008, -6, 6) : 0;
    root.x = root.bx + Math.sin(t * 0.00013) * 2.5 + leanX;
    root.y = root.by + Math.cos(t * 0.00017) * 2.5 + leanY;

    agents.forEach(function (n) {
      var x = n.bx + Math.sin(t * n.freqX + n.phaseX) * n.ampX;
      var y = n.by + Math.cos(t * n.freqY + n.phaseY) * n.ampY;

      // proximity: agents notice the cursor and lean in
      var target = 0, ux = 0, uy = 0;
      if (ptr.on) {
        var dx = ptr.x - x, dy = ptr.y - y;
        var d = Math.hypot(dx, dy) || 1;
        target = clamp(1 - d / 260, 0, 1);
        ux = dx / d; uy = dy / d;
      }
      n.near += (target - n.near) * 0.12;
      if (n.near > 0.004 || target > 0) {
        x += ux * n.near * pull;
        y += uy * n.near * pull;
      }
      n.disc.style.setProperty('--near', n.near.toFixed(3));

      n.x = x; n.y = y;
    });

    draw(t);

    // ambient motes
    for (var i = 0; i < motes.length; i++) {
      var mo = motes[i];
      var fy = (mo.fy - t * mo.sp) % 1;
      if (fy < 0) fy += 1;
      mo.el.setAttribute('cx', (mo.fx + Math.sin(t * mo.sp * 9 + mo.ph) * mo.amp) * W);
      mo.el.setAttribute('cy', fy * H);
      mo.el.style.opacity = mo.o * (0.55 + 0.45 * Math.sin(t * 0.0007 + mo.ph));
    }

    // sonar dispatch — the root sweeps the network and each agent answers
    if (t > nextSonar) { sonarPing(t); nextSonar = t + rand(5200, 8000); }
    var maxR = Math.hypot(W, H) * 0.62;
    for (var s = 0; s < sonars.length; s++) {
      var so = sonars[s];
      if (so.t0 < 0) continue;
      var q = (t - so.t0) / 3400;
      if (q >= 1) { so.t0 = -1; so.el.style.opacity = '0'; continue; }
      var r = (1 - (1 - q) * (1 - q)) * maxR;
      so.el.setAttribute('cx', root.x); so.el.setAttribute('cy', root.y);
      so.el.setAttribute('r', r);
      so.el.style.opacity = (1 - q) * 0.4;
      for (var a = 0; a < agents.length; a++) {
        if (so.hit[a]) continue;
        var n2 = agents[a];
        if (Math.hypot(n2.x - root.x, n2.y - root.y) <= r) {
          so.hit[a] = 1; ping(n2, t); flashEdge(n2);
        }
      }
    }

    // agent-to-agent handoffs, routed through the root
    if (ready && t > nextPacket) { sendPacket(t); nextPacket = t + rand(160, 560); }
    for (var k = 0; k < packets.length; k++) {
      var pk = packets[k];
      if (pk.t0 < 0) continue;
      var u = (t - pk.t0) / pk.dur;
      if (u >= 1) {
        pk.t0 = -1;
        pk.route.style.opacity = '0';
        pk.dots.forEach(function (d) { d.style.opacity = '0'; });
        ping(pk.b, t); flashEdge(pk.b);
        if (Math.random() < 0.12) scramble(pk.b.label, pk.b.name, 260);
        // an agent that receives work often passes some of it on
        if (Math.random() < 0.5) {
          (function (from) {
            setTimeout(function () { sendPacket(clockNow, from); }, rand(90, 260));
          })(pk.b);
        }
        continue;
      }
      var mx = (pk.a.x + pk.b.x) / 2, my = (pk.a.y + pk.b.y) / 2;
      var ccx = root.x + (mx - root.x) * pk.bend, ccy = root.y + (my - root.y) * pk.bend;
      pk.route.setAttribute('d', 'M' + pk.a.x + ' ' + pk.a.y + 'Q' + ccx + ' ' + ccy + ' ' + pk.b.x + ' ' + pk.b.y);
      pk.route.style.opacity = Math.sin(Math.PI * u) * 0.4;

      for (var d = 0; d < TRAIL.length; d++) {
        var pt = bez(Math.max(u - TRAIL[d].lag, 0), pk.a.x, pk.a.y, ccx, ccy, pk.b.x, pk.b.y);
        pk.dots[d].setAttribute('cx', pt[0]);
        pk.dots[d].setAttribute('cy', pt[1]);
        pk.dots[d].style.opacity = TRAIL[d].o;
      }
    }

    // the mark drops frames now and then
    if (t > nextGlitch) {
      if (nextGlitch > 0) glitch();
      nextGlitch = t + rand(6000, 13000);
    }

    requestAnimationFrame(tick);
  }

  function glitch() {
    markWrap.classList.add('is-glitch');
    setTimeout(function () { markWrap.classList.remove('is-glitch'); }, 260);
  }

  /* ---------- interaction ---------- */

  function setActive(target) {
    agents.forEach(function (n) {
      var on = n === target;
      if (on && !n.active) scramble(n.label, n.name, 380);
      n.active = on;
      n.el.classList.toggle('is-active', on);
      n.line.classList.toggle('is-lit', on);
    });
    stage.classList.toggle('is-focused', !!target);
  }

  agents.forEach(function (n) {
    n.el.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'touch') setActive(n);
    });
    n.el.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'touch' && n.active) setActive(null);
    });
    n.el.addEventListener('click', function () {
      setActive(n.active ? null : n);
      // a poked agent fans work out to its peers
      ping(n, clockNow);
      sendPacket(clockNow, n);
      setTimeout(function () { sendPacket(clockNow, n); }, 180);
    });
    n.el.addEventListener('focus', function () { setActive(n); });
    n.el.addEventListener('blur', function () { if (n.active) setActive(null); });
  });

  rootEl.addEventListener('pointerenter', function () {
    if (reduced) return;
    glitch();
    sonarPing(clockNow);
  });

  stage.addEventListener('pointerdown', function (e) {
    if (!e.target.closest('.node--agent')) setActive(null);
  });

  /* ---------- boot ---------- */

  var queued = false;

  function relayout() {
    queued = false;
    measure();
    place();
  }

  function onResize() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(relayout);
  }

  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);

  function start() {
    relayout();

    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
      stage.classList.add('is-ready');
      ready = true;

      var word = rootEl.querySelector('.wordmark');
      scramble(word, word.textContent, 900);
      agents.forEach(function (n, i) {
        setTimeout(function () { scramble(n.label, n.name, 520); }, 420 + i * 90);
      });

      // drop the entrance stagger so hover transitions stay instant
      setTimeout(function () {
        agents.forEach(function (n) {
          n.core.style.transitionDelay = '';
          n.line.style.transitionDelay = '';
        });
        sonarPing(clockNow);
      }, 1600);
    });

    if (!reduced) requestAnimationFrame(tick);
  }

  var mark = rootEl.querySelector('.mark');
  if (mark.complete) start();
  else { mark.addEventListener('load', start); mark.addEventListener('error', start); }
})();
