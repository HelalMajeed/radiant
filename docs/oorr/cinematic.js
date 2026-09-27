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
  const strands = Array.from({length: innerWidth < 821 ? 10 : 20}, (_, i) => ({
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
    // A continuous, loose network between the existing drifting particles.
    // Nearby grid cells bound the search; each selected dot gets at most two links.
    const reach = width < 821 ? 112 : 145;
    const cells = new Map();
    const positions = particles.map((p, i) => {
      const x = ((p.x * width + Math.sin(time * .07 + p.phase) * 21 + time * p.speed * .28) % width + width) % width;
      const y = ((p.y * height - time * p.speed * p.depth) % height + height) % height;
      const col = Math.floor(x / reach), row = Math.floor(y / reach);
      const key = `${col},${row}`;
      const point = {x,y,col,row,i};
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(point);
      return point;
    });
    for (const [i, p] of particles.entries()) {
      const {x,y,col,row} = positions[i];
      const pulse = .7 + Math.sin(time * .7 + p.phase) * .3;
      const alpha = (.22 + p.depth * .5) * pulse;
      if (i % 4 === 0) {
        const neighbors = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          for (const neighbor of cells.get(`${col + dx},${row + dy}`) || []) {
            if (neighbor.i <= i) continue;
            const distance = Math.hypot(x - neighbor.x, y - neighbor.y);
            if (distance > 22 && distance < reach) neighbors.push({neighbor,distance});
          }
        }
        neighbors.sort((a,b) => a.distance - b.distance);
        for (const [link, {neighbor,distance}] of neighbors.slice(0,2).entries()) {
          const mx = (x + neighbor.x) / 2, my = (y + neighbor.y) / 2;
          const radial = Math.hypot((mx - cx) / (height * .42), (my - cy) / (height * .38));
          // Give the outer field more definition, keeping the text area quiet.
          const edge = Math.min(1, Math.max(.25, (radial - .4) / .7));
          const fade = (1 - distance / reach) * Math.min(1, (distance - 22) / 18) * edge;
          ctx.strokeStyle = `rgba(158,190,223,${.22 * fade * (.8 + pulse * .2)})`;
          ctx.lineWidth = .55;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(neighbor.x,neighbor.y); ctx.stroke();
          if (link === 0 && i % 28 === 0) {
            const progress = (time * .12 + p.phase / (Math.PI * 2)) % 1;
            const light = Math.sin(progress * Math.PI) * fade;
            ctx.fillStyle = `rgba(209,224,248,${light * .8})`;
            ctx.beginPath(); ctx.arc(x + (neighbor.x - x) * progress, y + (neighbor.y - y) * progress, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.fillStyle = `rgba(194,215,238,${alpha})`;
      ctx.beginPath();ctx.arc(x, y, p.r, 0, Math.PI * 2);ctx.fill();
      if (i % 29 === 0) {
        ctx.fillStyle = `rgba(150,194,233,${alpha * .075})`;ctx.beginPath();ctx.arc(x,y,p.r * 3.5,0,Math.PI * 2);ctx.fill();
      }
    }
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
