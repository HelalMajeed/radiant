/* Decorative motion only. Navigation, code tabs and copying stay in docs.js. */
(() => {
  'use strict';
  const scene = document.querySelector('.cinema-scene');
  if (!scene) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let motionReduced = reduced.matches;
  const canvas = scene.querySelector('.scene-particles');
  const ctx = canvas.getContext('2d');
  const art = scene.querySelector('.cinema-art');
  const crystal = window.OorrCrystal && window.OorrCrystal.create(art);
  const pointer = {x:0,y:0}, target = {x:0,y:0};
  let quality = 1, slowFrames = 0;
  const cards = [...document.querySelectorAll('.entry-card')];
  let width = 0, height = 0, raf = 0, lastFrame = 0, clock = 0;
  const seed = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const particles = Array.from({length: innerWidth < 821 ? 240 : 620}, (_, i) => ({
    x: seed(i), y: seed(i + 71), depth: .3 + seed(i + 51) * .7,
    r: i % 29 === 0 ? 1.1 : .32 + seed(i + 4) * .48,
    speed: 2 + seed(i + 16) * 6, phase: seed(i + 8) * Math.PI * 2
  }));
  const strands = Array.from({length: innerWidth < 821 ? 8 : 16}, (_, i) => ({
    angle: (seed(i + 94) - .5) * 2.5,
    radius: .47 + seed(i + 31) * .32,
    flatten: .18 + seed(i + 24) * .29,
    phase: seed(i + 59) * Math.PI * 2,
    speed: .035 + seed(i + 68) * .055
  }));

  document.querySelectorAll('.sb-list li').forEach((item, i) => item.style.setProperty('--nav-index', i));
  if (!motionReduced) document.documentElement.classList.add('cinema-ready');

  if (!motionReduced && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });
    cards.forEach((card, i) => {
      card.classList.add('cinema-reveal');
      card.style.setProperty('--entry-index', i);
      observer.observe(card);
    });
  }

  // Quiet, decorative call and agent motifs. They share the scene's clock,
  // so reduced motion and background-tab pausing apply to every new detail.
  function paintSignals(time) {
    const compact = width < 1100;
    const mobile = width < 821;
    const left = mobile ? 0 : 244;
    const span = width - left;
    const scale = mobile ? .4 : compact ? .62 : .9;
    const tau = Math.PI * 2;
    const dot = (x, y, radius = 1.4) => {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, tau); ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = mobile ? .5 : .78;
    ctx.lineWidth = .8;

    // An abstract voice screen: breathing rings and gently changing audio bars.
    // No call state or interactive controls are implied by this background art.
    ctx.save();
    ctx.translate(left + span * (mobile ? .3 : .135), mobile ? 114 : height * .405);
    ctx.translate(pointer.x * 4, Math.sin(time * .32) * 5);
    ctx.scale(scale, scale);
    ctx.strokeStyle = 'rgba(167,192,219,.25)';
    ctx.beginPath(); ctx.roundRect(-65, -76, 130, 152, 12); ctx.stroke();
    ctx.strokeStyle = 'rgba(187,209,237,.56)';
    for (const [x, y, dx, dy] of [[-65,-76,1,1],[65,-76,-1,1],[-65,76,1,-1],[65,76,-1,-1]]) {
      ctx.beginPath(); ctx.moveTo(x,y + dy * 13); ctx.lineTo(x,y); ctx.lineTo(x + dx * 13,y); ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const pulse = (time * .16 + i / 3) % 1;
      ctx.strokeStyle = `rgba(170,194,228,${(1 - pulse) * .3})`;
      ctx.beginPath(); ctx.arc(0,-22,15 + pulse * 20,0,tau); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(195,186,232,.66)';
    ctx.beginPath(); ctx.arc(0,-22,11,time * .24,time * .24 + tau * .76); ctx.stroke();
    ctx.fillStyle = 'rgba(205,219,241,.58)';
    for (let i = 0; i < 21; i++) {
      const envelope = Math.pow(Math.sin((i + 1) / 22 * Math.PI), 1.5);
      const wave = .35 + .65 * Math.pow(Math.sin(time * 1.8 - i * .43), 2);
      const bar = 3 + envelope * wave * 23;
      ctx.fillRect((i - 10) * 4.1 - .7, 26 - bar / 2, 1.4, bar);
    }
    ctx.strokeStyle = 'rgba(171,190,214,.18)';
    ctx.beginPath(); ctx.moveTo(-34,53); ctx.lineTo(34,53); ctx.stroke();
    ctx.restore();

    // One small graph, with slow packets flowing along a fixed set of edges.
    ctx.save();
    ctx.translate(left + span * (mobile ? .74 : .875), mobile ? 115 : height * .34);
    ctx.scale(scale, scale);
    const nodes = [[-58,5],[-25,-40],[27,-48],[62,-6],[29,43],[-21,51],[0,0]]
      .map(([x,y],i) => [x + Math.sin(time * .25 + i) * 3, y + Math.cos(time * .3 + i) * 4]);
    const edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[2,6],[4,6]];
    edges.forEach(([a,b],i) => {
      const from = nodes[a], to = nodes[b];
      ctx.strokeStyle = 'rgba(174,192,218,.24)';
      ctx.beginPath(); ctx.moveTo(...from); ctx.lineTo(...to); ctx.stroke();
      if (i % 3 !== 0) return;
      const progress = (time * .13 + i * .19) % 1;
      const px = from[0] + (to[0] - from[0]) * progress;
      const py = from[1] + (to[1] - from[1]) * progress;
      ctx.fillStyle = 'rgba(212,220,244,.75)'; dot(px,py,1.5);
    });
    nodes.forEach(([x,y],i) => {
      ctx.strokeStyle = 'rgba(184,169,225,.52)';
      ctx.strokeRect(x - 3,y - 3,6,6);
      ctx.fillStyle = 'rgba(197,214,237,.65)'; dot(x,y,.8);
      if (i === 6) {
        ctx.strokeStyle = 'rgba(179,196,228,.22)';
        ctx.beginPath(); ctx.arc(x,y,12 + Math.sin(time * .7) * 2,0,tau); ctx.stroke();
      }
    });
    ctx.restore();

    // Two small wireframe robotic cubes; no extra moving panels or overlays.
    const cubes = mobile ? [[.92, .78, 12]] : [[.17, .65, 23],[.88, .63, 29]];
    cubes.forEach(([x,y,r],index) => {
      ctx.save();
      ctx.translate(left + span * x + Math.sin(time * .19 + index) * 5, height * y + Math.sin(time * .27 + index * 3) * 7);
      ctx.rotate(Math.sin(time * .16 + index) * .13);
      const skew = 7 + Math.sin(time * .22 + index) * 4;
      const size = r * (compact && !mobile ? .75 : 1);
      const corners = [[-size,-size],[size,-size],[size,size],[-size,size]];
      ctx.strokeStyle = 'rgba(162,186,216,.25)';
      ctx.strokeRect(-size,-size,size * 2,size * 2);
      ctx.strokeRect(-size + skew,-size - 10,size * 2,size * 2);
      for (const [px,py] of corners) {
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px + skew,py - 10); ctx.stroke();
      }
      const scan = Math.sin(time * .6 + index) * size;
      ctx.strokeStyle = 'rgba(195,178,230,.36)';
      ctx.beginPath(); ctx.moveTo(-size,scan); ctx.lineTo(size,scan); ctx.stroke();
      ctx.fillStyle = 'rgba(208,220,243,.55)'; dot(-size,-size,1.3); dot(size + skew,size - 10,1.3);
      ctx.restore();
    });
    ctx.restore();
  }

  function paint() {
    const time = clock / 1000;
    if (crystal) crystal.render(time + 6, pointer);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const cx = width * (width < 821 ? .5 : .585), cy = height * .46;
    // Wide, fine field lines. Short luminous segments travel along each curve.
    for (const [index, s] of strands.entries()) {
      const angle = s.angle + Math.sin(time * .018 + s.phase) * .075;
      const c = Math.cos(angle), sn = Math.sin(angle), radius = Math.max(width, height) * s.radius;
      const point = a => {
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius * s.flatten + Math.sin(a * 3 + s.phase + time * .045) * 18;
        return [cx + x * c - y * sn + pointer.x * s.flatten * 12, cy + x * sn + y * c];
      };
      ctx.lineWidth = .45;
      ctx.strokeStyle = index % 3 === 0 ? 'rgba(164,146,198,.12)' : 'rgba(138,181,210,.1)';
      ctx.beginPath();
      for (let j = 0; j <= 100; j++) {const p = point(j / 100 * Math.PI * 2); if (j) ctx.lineTo(...p); else ctx.moveTo(...p);}
      ctx.stroke();
      const tip = time * s.speed + s.phase;
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {const p = point(tip - .21 + j / 20 * .21); if (j) ctx.lineTo(...p); else ctx.moveTo(...p);}
      ctx.strokeStyle = index % 3 === 0 ? 'rgba(192,171,222,.42)' : 'rgba(174,216,235,.46)';
      ctx.lineWidth = .8; ctx.stroke();
      const head = point(tip);ctx.fillStyle = 'rgba(221,234,247,.7)';ctx.beginPath();ctx.arc(...head,1,0,Math.PI * 2);ctx.fill();
    }
    const cells = new Map();
    for (const [i, p] of particles.entries()) {
      const x = ((p.x * width + Math.sin(time * .07 + p.phase) * 21 + time * p.speed * .28) % width + width) % width;
      const y = ((p.y * height - time * p.speed * p.depth) % height + height) % height;
      const pulse = .7 + Math.sin(time * .7 + p.phase) * .3;
      const alpha = (.22 + p.depth * .5) * pulse;
      const cell = `${Math.floor(x / 105)},${Math.floor(y / 105)}`;
      const neighbor = cells.get(cell);
      if (neighbor && i % 3 === 0) {
        const distance = Math.hypot(x - neighbor.x, y - neighbor.y);
        if (distance < 85) {
          ctx.strokeStyle = `rgba(150,184,217,${.1 * (1 - distance / 85)})`;ctx.lineWidth = .45;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(neighbor.x,neighbor.y);ctx.stroke();
        }
      }
      cells.set(cell, {x,y});
      ctx.fillStyle = `rgba(194,215,238,${alpha})`;
      ctx.beginPath();ctx.arc(x, y, p.r, 0, Math.PI * 2);ctx.fill();
      if (i % 29 === 0) {
        ctx.fillStyle = `rgba(150,194,233,${alpha * .075})`;ctx.beginPath();ctx.arc(x,y,p.r * 3.5,0,Math.PI * 2);ctx.fill();
      }
    }
    paintSignals(time);
  }
  function resize() {
    width = innerWidth; height = innerHeight;
    if (crystal) crystal.resize(width, height, quality);
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint();
  }
  function frame(now) {
    raf = 0;
    if (motionReduced || document.hidden) return;
    if (now - lastFrame >= 1000 / 30) {
      const elapsed = now - lastFrame;
      clock += Math.min(elapsed, 80); lastFrame = now;
      pointer.x += (target.x - pointer.x) * .035;
      pointer.y += (target.y - pointer.y) * .035;
      // Bound GPU work on slower devices; never grow an unbounded retina buffer.
      slowFrames = elapsed > 70 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 80 && quality > .7) {
        quality *= .82; slowFrames = 0;
        if (crystal) crystal.resize(width, height, quality);
      }
      paint();
    }
    raf = requestAnimationFrame(frame);
  }
  function syncMotion() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    scene.classList.toggle('scene-sleeping', document.hidden || motionReduced);
    document.documentElement.classList.toggle('scene-sleeping', document.hidden);
    if (motionReduced) {
      document.documentElement.classList.remove('cinema-ready');
      cards.forEach(card => card.classList.add('is-visible'));
    }
    if (!document.hidden && !motionReduced) {
      lastFrame = performance.now(); raf = requestAnimationFrame(frame);
    }
    paint();
  }
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', event => {
      if (motionReduced) return;
      target.x = event.clientX / innerWidth * 2 - 1;
      target.y = event.clientY / innerHeight * 2 - 1;
    }, {passive:true});
    document.addEventListener('pointerleave', () => {target.x = 0; target.y = 0;});
  }
  art.addEventListener('crystalrestore', () => {resize(); syncMotion();});
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  reduced.addEventListener('change', event => {
    motionReduced = event.matches;
    syncMotion();
  });
  resize(); syncMotion();
})();
