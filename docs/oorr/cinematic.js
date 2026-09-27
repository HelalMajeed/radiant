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
  const particles = Array.from({ length: 46 }, (_, i) => ({
    x: ((i * 137.508) % 997) / 997,
    y: ((i * 89.327) % 991) / 991,
    r: i % 9 === 0 ? 1.15 : .55,
    speed: .3 + (i % 5) * .12,
    phase: i * 1.8
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
    if (crystal) crystal.render(clock / 1000 + 6, pointer);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      const x = p.x * width + Math.sin(clock * .00014 + p.phase) * 12;
      const y = ((p.y * height - clock * .002 * p.speed) % height + height) % height;
      const alpha = .12 + (Math.sin(clock * .0007 + p.phase) + 1) * .12;
      ctx.fillStyle = `rgba(180,200,236,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
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
