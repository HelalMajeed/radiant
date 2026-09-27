(() => {
  'use strict';
  const root = document.documentElement;
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  const depth = document.querySelector('.dollar-depth');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const links = [...document.querySelectorAll('.section-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll('main section')];
  const workflows = [...document.querySelectorAll('.steps')];
  const linkedSections = links.map(link => ({link, section: document.getElementById(link.hash.slice(1))})).filter(item => item.section);
  let enabled = false;
  let scrollFrame = 0;
  let pointerFrame = 0;
  let spotlightFrame = 0;
  let spotlight = null;
  let pointer = {x: 0, y: 0};

  function resetDepth() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    for (const name of ['--tilt-x','--tilt-y','--pointer-x','--pointer-y']) depth.style.removeProperty(name);
  }

  function applyPreference() {
    enabled = !reduceMotion.matches;
    root.classList.toggle('motion-on', enabled);
    root.classList.toggle('motion-paused', !enabled);
    if (!enabled) resetDepth();
  }

  // Keep each heading's original text and spaces; only its visual entrance changes.
  document.querySelectorAll('main h2').forEach(heading => {
    const text = heading.textContent;
    const fragment = document.createDocumentFragment();
    let wordIndex = 0;
    for (const token of text.split(/(\s+)/)) {
      if (!token.trim()) { fragment.appendChild(document.createTextNode(token)); continue; }
      const word = document.createElement('span');
      word.className = 'heading-word';
      const inner = document.createElement('span');
      inner.className = 'heading-word-inner';
      inner.textContent = token;
      inner.style.setProperty('--word-delay', `${Math.min(wordIndex++ * 55, 440)}ms`);
      word.appendChild(inner);
      fragment.appendChild(word);
    }
    heading.replaceChildren(fragment);
  });

  // Register observers before enabling hidden entrance states.
  const revealTargets = [...document.querySelectorAll('main .eyebrow,main h2,main .lede,main .statement,main .card,main .ar-card,main .layer,main .agent,main .step,main .tbl-wrap,main .mini,main .note,main .closing p,.hero-line > div')];
  const tableRows = [...document.querySelectorAll('.tbl tbody tr')];
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
    if (target.matches('.card,.ar-card,.agent')) target.style.setProperty('--reveal-x', siblings.indexOf(target) % 2 ? '10px' : '-10px');
    if (revealObserver) revealObserver.observe(target);
    else target.classList.add('is-revealed');
  }
  tableRows.forEach(row => {
    row.classList.add('row-reveal');
    if (revealObserver) revealObserver.observe(row);
    else row.classList.add('is-revealed');
  });

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
  for (const group of document.querySelectorAll('.hero-line,.loop')) {
    [...group.children].forEach((node, index) => {
      const beam = document.createElement('span');
      beam.className = 'flow-beam';
      beam.setAttribute('aria-hidden','true');
      beam.style.setProperty('--signal-delay', `${index * .75}s`);
      node.appendChild(beam);
    });
  }
  workflows.forEach(workflow => {
    const rail = document.createElement('span');
    rail.className = 'workflow-progress';
    rail.setAttribute('aria-hidden','true');
    workflow.appendChild(rail);
  });

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
    if (enabled) for (const workflow of workflows) {
      const rect = workflow.getBoundingClientRect();
      workflow.style.setProperty('--workflow-progress', String(Math.min(1, Math.max(0, (innerHeight * .6 - rect.top) / rect.height))));
    }
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
    section.querySelectorAll('.reveal,.row-reveal').forEach(el => el.classList.add('is-revealed'));
  }));

  document.querySelector('main').addEventListener('pointermove', event => {
    if (!enabled || !finePointer.matches) return;
    const card = event.target.closest('.card,.ar-card');
    if (!card) return;
    spotlight = {card, x: event.clientX, y: event.clientY};
    if (spotlightFrame) return;
    spotlightFrame = requestAnimationFrame(() => {
      spotlightFrame = 0;
      if (!enabled) return;
      const rect = spotlight.card.getBoundingClientRect();
      spotlight.card.style.setProperty('--spotlight-x', `${spotlight.x - rect.left}px`);
      spotlight.card.style.setProperty('--spotlight-y', `${spotlight.y - rect.top}px`);
    });
  }, {passive: true});

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
  reduceMotion.addEventListener('change', applyPreference);
  applyPreference();
  updateScroll();
})();
