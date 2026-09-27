(() => {
  'use strict';
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  const depth = document.querySelector('.dollar-depth');
  const toggle = document.querySelector('.motion-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const links = [...document.querySelectorAll('.section-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll('main section')];
  const linkedSections = links.map(link => ({link, section: document.getElementById(link.hash.slice(1))})).filter(item => item.section);
  let override = null;
  try { override = localStorage.getItem('edfaa-zain-motion'); } catch { /* Storage is optional. */ }
  let enabled = false;
  let scrollFrame = 0;
  let pointerFrame = 0;
  let pointer = {x: 0, y: 0};

  function resetDepth() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    for (const name of ['--tilt-x','--tilt-y','--pointer-x','--pointer-y']) depth.style.removeProperty(name);
  }

  function applyPreference() {
    enabled = override === 'on' || (override !== 'off' && !reduceMotion.matches);
    root.classList.toggle('motion-on', enabled);
    root.classList.toggle('motion-paused', !enabled);
    toggle.setAttribute('aria-pressed', String(!enabled));
    toggle.querySelector('.motion-label').textContent = enabled ? 'Motion on' : 'Motion off';
    toggle.title = enabled ? 'Pause animations' : 'Enable animations';
    if (!enabled) resetDepth();
  }

  // Register observers before enabling hidden entrance states.
  const revealTargets = [...document.querySelectorAll('main .eyebrow,main h2,main .lede,main .statement,main .card,main .ar-card,main .layer,main .agent,main .step,main .tbl-wrap,main .mini,main .note,main .closing p,.hero-line > div,footer .row')];
  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      revealObserver.unobserve(entry.target);
    }
  }, {threshold: 0, rootMargin: '0px 0px -32px 0px'}) : null;
  for (const target of revealTargets) {
    target.classList.add('reveal');
    const siblings = [...target.parentElement.children].filter(el => revealTargets.includes(el));
    target.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(target) * 75, 300)}ms`);
    if (revealObserver) revealObserver.observe(target);
    else target.classList.add('is-revealed');
  }

  const sceneObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.classList.toggle('scene-active', entry.isIntersecting);
      if (entry.isIntersecting) entry.target.classList.add('section-revealed');
      if (entry.target === hero && !entry.isIntersecting) resetDepth();
    }
  }, {threshold: 0}) : null;
  sections.forEach(section => {
    if (sceneObserver) sceneObserver.observe(section);
    else section.classList.add('scene-active','section-revealed');
  });
  document.querySelectorAll('.hero-line > div').forEach((node, index) => {
    const signal = document.createElement('span');
    signal.className = 'flow-signal';
    signal.setAttribute('aria-hidden','true');
    signal.style.setProperty('--signal-delay', `${index * .8}s`);
    node.appendChild(signal);
  });
  document.querySelectorAll('.arrow').forEach((arrow, index) => arrow.style.setProperty('--signal-delay', `${index * .35}s`));

  function updateScroll() {
    scrollFrame = 0;
    const threshold = nav.getBoundingClientRect().height + 100;
    let active = null;
    for (const item of linkedSections) {
      if (item.section.getBoundingClientRect().top <= threshold) active = item.link;
    }
    for (const link of links) {
      const current = link === active;
      link.classList.toggle('on', current);
      if (current) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
    const range = document.documentElement.scrollHeight - innerHeight;
    nav.style.setProperty('--read-progress', range > 0 ? String(Math.min(1, Math.max(0, scrollY / range))) : '0');
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', scheduleScroll, {passive: true});
  window.addEventListener('resize', scheduleScroll);
  window.addEventListener('hashchange', scheduleScroll);
  // Reveal a hash target immediately even when a long smooth scroll passes it quickly.
  links.forEach(link => link.addEventListener('click', () => {
    const section = document.getElementById(link.hash.slice(1));
    section.classList.add('section-revealed');
    section.querySelectorAll('.reveal').forEach(el => el.classList.add('is-revealed'));
  }));

  hero.addEventListener('pointermove', event => {
    if (!enabled || !finePointer.matches || !hero.classList.contains('scene-active')) return;
    const rect = hero.getBoundingClientRect();
    pointer = {x: (event.clientX - rect.left) / rect.width - .5, y: (event.clientY - rect.top) / rect.height - .5};
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      depth.style.setProperty('--tilt-x', `${-pointer.y * 12}deg`);
      depth.style.setProperty('--tilt-y', `${pointer.x * 18}deg`);
      depth.style.setProperty('--pointer-x', `${pointer.x * 9}px`);
      depth.style.setProperty('--pointer-y', `${pointer.y * 6}px`);
    });
  }, {passive: true});
  hero.addEventListener('pointerleave', resetDepth);
  finePointer.addEventListener('change', resetDepth);
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('page-away', document.hidden);
    if (document.hidden) resetDepth();
  });
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    override = enabled ? 'off' : 'on';
    try { localStorage.setItem('edfaa-zain-motion', override); } catch { /* Nonpersistent control still works. */ }
    applyPreference();
  });
  reduceMotion.addEventListener('change', applyPreference);
  applyPreference();
  updateScroll();
})();
