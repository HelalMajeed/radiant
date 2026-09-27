/* Decorative motion only. Navigation, code tabs and copying stay in docs.js. */
(() => {
  'use strict';
  const scene = document.querySelector('.cinema-scene');
  if (!scene) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = scene.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const video = scene.querySelector('video');
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
  if (!reduced.matches) document.documentElement.classList.add('cinema-ready');

  if (!reduced.matches && 'IntersectionObserver' in window) {
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
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint();
  }
  function frame(now) {
    raf = 0;
    if (reduced.matches || document.hidden || !ctx) return;
    if (now - lastFrame >= 1000 / 30) {
      clock += Math.min(now - lastFrame, 50); lastFrame = now; paint();
    }
    raf = requestAnimationFrame(frame);
  }
  function syncMotion() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    scene.classList.toggle('scene-sleeping', document.hidden || reduced.matches);
    document.documentElement.classList.toggle('scene-sleeping', document.hidden);
    if (reduced.matches) {
      document.documentElement.classList.remove('cinema-ready');
      cards.forEach(card => card.classList.add('is-visible'));
    }
    if (!document.hidden && !reduced.matches) {
      lastFrame = performance.now(); raf = requestAnimationFrame(frame);
      if (video) video.play().catch(() => scene.classList.remove('has-video'));
    } else if (video) { video.pause(); scene.classList.remove('has-video'); }
    paint();
  }
  if (video) {
    video.muted = true;
    video.addEventListener('playing', () => scene.classList.add('has-video'));
    video.addEventListener('error', () => scene.classList.remove('has-video'));
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  reduced.addEventListener('change', syncMotion);
  resize(); syncMotion();
})();
