/**
 * build.mjs — generate the OORR AI documentation as real, separate pages.
 *
 * Content is authored once in `_pages.html` (one <section id="..."> per page).
 * This script wraps each section in the shared shell and writes it to its own
 * directory, so every sidebar entry is a genuine URL:
 *
 *     /docs/oorr/            → Introduction
 *     /docs/oorr/quickstart/ → Quickstart
 *     ...
 *
 * Why real files rather than client-side routing: the site is static and has no
 * server rewrite rules, so a History-API app would 404 on a direct load or a
 * refresh of /docs/oorr/usage. Separate files work on any static host with zero
 * configuration, and back/forward comes free from the browser.
 *
 * The shell is the "academy console" chrome: the animated stage, the numbered
 * module rail, the DNA-strand divider, the status-legend diagnostics module and
 * the page-head reticle. Presentation lives in docs.css; behaviour in docs.js.
 *
 * Usage:  node docs/oorr/build.mjs
 *
 * The generated output is committed, so deployment stays pure-static — running
 * this is only needed after editing `_pages.html`.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The documentation outline. `dir` is the emitted directory ("" = the docs
 * root); `id` is the source section id in `_pages.html`.
 */
const PAGES = [
  { id: "introduction",   dir: "",               label: "Introduction",   title: "Introduction" },
  { id: "quickstart",     dir: "quickstart",     label: "Quickstart",     title: "Quickstart" },
  { id: "authentication", dir: "authentication", label: "Authentication", title: "Authentication" },
  { id: "models",         dir: "models",         label: "Models",         title: "Models" },
  { id: "chat",           dir: "chat",           label: "Chat",           title: "Chat" },
  { id: "vision",         dir: "vision",         label: "Vision",         title: "Vision" },
  { id: "reference",      dir: "api-reference",  label: "API Reference",  title: "API Reference" },
  { id: "pricing",        dir: "pricing",        label: "Pricing",        title: "Pricing" },
  { id: "usage",          dir: "usage",          label: "Usage",          title: "Usage" },
  { id: "keys",           dir: "api-keys",       label: "API Keys",       title: "API Keys" },
];

/** Per-page <meta name="description">. */
const DESCRIPTIONS = {
  introduction: "What OORR AI's Sargon 1.5 model does, its base URL, and the endpoints it exposes.",
  quickstart: "Make your first OORR AI request in cURL, TypeScript or Python.",
  authentication: "How OORR AI requests are identified today, and the planned API-key contract.",
  models: "Sargon 1.5 — OORR AI's production model — and its capability tiers.",
  chat: "The OORR AI chat endpoint, its response shape, and Server-Sent Event streaming.",
  vision: "Send an image with your request for educational image understanding.",
  reference: "Request parameters, response structure, token usage, error codes and rate limits.",
  pricing: "OORR AI token pricing: $3.66 per 1M input tokens, $8.35 per 1M output tokens.",
  usage: "Request, token and cost reporting for the OORR AI API.",
  keys: "Create, mask, rename and revoke OORR AI API keys.",
};

/** The three states the docs use, and what each one promises. */
const LEGEND = [
  { key: "live",    label: "Live",    note: "Deployed and callable" },
  { key: "pending", label: "Pending", note: "Specified, not shipped" },
  { key: "ui",      label: "UI only", note: "Interface shell, no backend" },
];

const bySourceId = new Map(PAGES.map((p) => [p.id, p]));

/** Relative prefix from a page's directory back to /docs/oorr/. */
const upToDocsRoot = (page) => (page.dir === "" ? "" : "../");
/** Relative prefix from a page's directory back to the site root. */
const upToSiteRoot = (page) => (page.dir === "" ? "../../" : "../../../");

/** Escape a string for use in an HTML attribute or text node. */
function esc(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Two-digit module number: pages read as a numbered course. */
const pad = (n) => String(n).padStart(2, "0");

/** Pull one `<section id="...">…</section>` out of the source document. */
function extractSection(source, id) {
  const open = source.indexOf(`<section id="${id}">`);
  if (open === -1) throw new Error(`section "${id}" not found in _pages.html`);
  const close = source.indexOf("</section>", open);
  if (close === -1) throw new Error(`section "${id}" is unterminated`);
  return source.slice(open + `<section id="${id}">`.length, close).trim();
}

/**
 * Split a section into its heading and body. The section's <h2> becomes the
 * page <h1>, carrying its status pill across unchanged.
 */
function splitHeading(html) {
  const match = /^\s*<h2>([\s\S]*?)<\/h2>/.exec(html);
  if (!match) return { heading: null, body: html };
  return { heading: match[1].trim(), body: html.slice(match[0].length).trim() };
}

/**
 * Rewrite in-document anchors onto the page that now owns them.
 * `href="#vision"` becomes `href="../vision/"` (depth-aware).
 */
function rewriteCrossLinks(html, page) {
  return html.replace(/href="#([a-z-]+)"/g, (whole, id) => {
    const target = bySourceId.get(id);
    if (!target) return whole; // a real within-page anchor — leave it alone
    const up = upToDocsRoot(page);
    return `href="${target.dir === "" ? up || "./" : `${up}${target.dir}/`}"`;
  });
}

/**
 * The strand divider between the module list and the legend: two sine strands
 * sampled into polylines, with rungs drawn between them at matching x. Both are
 * generated from one formula so the rungs always land exactly on the strands.
 * The animation lives in docs.css — here we only emit geometry, plus an index
 * per rung so the wave can be staggered.
 */
function helixSvg() {
  const W = 240, MID = 22, AMP = 15, PERIOD = 120;
  const at = (x) => Math.sin((x / PERIOD) * Math.PI * 2) * AMP;

  const a = [];
  const b = [];
  for (let x = 0; x <= W; x += 4) {
    const y = at(x);
    a.push(`${x},${(MID - y).toFixed(1)}`);
    b.push(`${x},${(MID + y).toFixed(1)}`);
  }

  const rungs = [];
  let i = 0;
  for (let x = 6; x <= W - 6; x += 9, i += 1) {
    const y = at(x);
    rungs.push(
      `<line x1="${x}" y1="${(MID - y).toFixed(1)}" x2="${x}" y2="${(MID + y).toFixed(1)}" ` +
      `style="--i:${i};transform-origin:${x}px ${MID}px"/>`
    );
  }

  return `    <div class="helix" aria-hidden="true">
      <svg viewBox="0 0 ${W} 44" preserveAspectRatio="none" role="presentation">
        <g class="rungs">${rungs.join("")}</g>
        <polyline class="strand strand--a" points="${a.join(" ")}"/>
        <polyline class="strand strand--b" points="${b.join(" ")}"/>
      </svg>
    </div>`;
}

/**
 * The status legend, as a diagnostics module rather than a row of swatches.
 * Each entry is a real control: docs.js uses `data-status` to trace every pill
 * of that status through the page while the entry is hovered, focused or
 * pinned, which is what makes the legend worth its space on every page.
 */
function legend() {
  const glyphs = {
    live: '<i class="g-core"></i><i class="g-ring"></i><i class="g-ring g-ring--2"></i>',
    pending: '<i class="g-orbit"></i><i class="g-sat"></i>',
    ui: '<i class="g-wire"></i><i class="g-wire g-wire--2"></i>',
  };

  const rows = LEGEND.map((s) => `        <li>
          <button class="lg lg--${s.key}" type="button" data-status="${s.key}" aria-pressed="false">
            <span class="lg-glyph" aria-hidden="true">${glyphs[s.key]}</span>
            <span class="lg-text"><b>${s.label}</b><em>${s.note}</em></span>
            <span class="lg-track" aria-hidden="true"><i></i></span>
          </button>
        </li>`).join("\n");

  return `    <section class="legend" aria-labelledby="legend-title">
      <div class="legend-frame" aria-hidden="true"></div>
      <header class="legend-head">
        <span class="legend-title" id="legend-title">Status legend</span>
        <span class="legend-led" aria-hidden="true"></span>
      </header>
      <ul class="legend-list">
${rows}
      </ul>
      <p class="legend-foot"><span class="kbd">hover</span> to trace on this page</p>
    </section>`;
}

/** The shared sidebar, with the current page marked. */
function sidebar(current) {
  const up = upToDocsRoot(current);
  const items = PAGES.map((p, i) => {
    const href = p.dir === "" ? up || "./" : `${up}${p.dir}/`;
    const isCurrent = p.id === current.id;
    return `        <li><a href="${href}"${isCurrent ? ' class="is-current" aria-current="page"' : ""}>` +
      `<i class="sb-idx">${pad(i + 1)}</i>` +
      `<span class="sb-label">${p.label}</span>` +
      `<span class="sb-mark" aria-hidden="true"></span></a></li>`;
  }).join("\n");

  return `    <p class="sb-title"><span>Curriculum</span><b>${PAGES.length} modules</b></p>
    <ol class="sb-list">
${items}
    </ol>

${helixSvg()}

${legend()}`;
}

/** The page head's orbital instrument. Decorative; hidden on narrow screens. */
function reticle() {
  return `        <svg class="reticle" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="r-outer" cx="60" cy="60" r="56"/>
          <circle class="r-mid" cx="60" cy="60" r="44"/>
          <circle class="r-inner" cx="60" cy="60" r="30"/>
          <line class="r-cross" x1="60" y1="0" x2="60" y2="14"/>
          <line class="r-cross" x1="60" y1="106" x2="60" y2="120"/>
          <line class="r-cross" x1="0" y1="60" x2="14" y2="60"/>
          <line class="r-cross" x1="106" y1="60" x2="120" y2="60"/>
          <circle class="r-core" cx="60" cy="60" r="3.4"/>
          <g class="r-sat"><circle cx="60" cy="16" r="2.6"/></g>
        </svg>`;
}

/** Previous / next links, so the reading order survives the page split. */
function pager(index) {
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  if (!prev && !next) return "";
  const current = PAGES[index];
  const up = upToDocsRoot(current);
  const href = (p) => (p.dir === "" ? up || "./" : `${up}${p.dir}/`);

  const arrowL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>';
  const arrowR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>';

  const left = prev
    ? `<a class="pager-link pager-prev" href="${href(prev)}"><span>${arrowL}Previous</span><b>${prev.label}</b></a>`
    : `<span></span>`;
  const right = next
    ? `<a class="pager-link pager-next" href="${href(next)}"><span>Next${arrowR}</span><b>${next.label}</b></a>`
    : `<span></span>`;
  return `\n      <nav class="pager" aria-label="Documentation pages">\n        ${left}\n        ${right}\n      </nav>\n`;
}

function render(page, index, lede) {
  const site = upToSiteRoot(page);
  const docs = upToDocsRoot(page);
  const section = extractSection(SOURCE, page.id);
  const { heading, body } = splitHeading(section);
  const content = rewriteCrossLinks(body, page);
  const headingHtml = rewriteCrossLinks(heading ?? esc(page.title), page);

  // The docs landing page keeps the product lede under its title.
  const ledeHtml = page.dir === "" ? `\n        <p class="lede">${lede}</p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)} — OORR AI · Radiant</title>
<meta name="description" content="${esc(DESCRIPTIONS[page.id] ?? "")}">
<meta name="theme-color" content="#04050a">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/png" href="${site}assets/favicon.png">
<link rel="stylesheet" href="${docs}docs.css">
</head>
<body data-page="${page.id}">

<div class="stage" aria-hidden="true">
  <div class="stage-grid"></div>
  <div class="stage-aurora"></div>
  <canvas class="stage-net" id="stagenet"></canvas>
  <div class="stage-vignette"></div>
</div>

<a class="skip" href="#main">Skip to content</a>

<header class="topbar">
  <a class="brand" href="${site}">
    <span class="brand-orb" aria-hidden="true"><img src="${site}assets/radiant-mark.png" alt="" draggable="false"></span>
    <b>Radiant</b>
  </a>
  <span class="crumb">Docs<i aria-hidden="true"></i><em>OORR AI</em></span>
  <div class="topbar-end">
    <span class="uplink" title="api.oorr.ai is live">
      <i class="uplink-dot" aria-hidden="true"></i>Uplink
      <em class="uplink-bars" aria-hidden="true"><s></s><s></s><s></s><s></s></em>
    </span>
    <a class="ghost-link" href="https://oorr.ai" target="_blank" rel="noopener">oorr.ai</a>
    <button class="navtoggle" id="navtoggle" aria-expanded="false" aria-controls="sidebar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      Menu
    </button>
  </div>
  <div class="readbar" id="readbar" aria-hidden="true"><i></i></div>
</header>

<div class="layout">

  <nav class="sidebar" id="sidebar" aria-label="Documentation">
${sidebar(page)}
  </nav>

  <main class="content" id="main">
    <article class="prose">
      <div class="page-head">
        <div class="ph-top">
          <p class="eyebrow"><i aria-hidden="true"></i>OORR AI</p>
          <span class="ph-index" aria-label="Module ${index + 1} of ${PAGES.length}">
            <b>${pad(index + 1)}</b><i>/</i>${pad(PAGES.length)}
          </span>
        </div>
        <h1>${headingHtml}</h1>${ledeHtml}
        <div class="ph-rule" aria-hidden="true"><i></i></div>
${reticle()}
      </div>

${content}
${pager(index)}    </article>

    <aside class="toc" id="toc" aria-label="On this page"></aside>
  </main>
</div>

<footer class="docfoot">
  <span>OORR AI API</span>
  <span class="dot" aria-hidden="true"></span>
  <a href="${site}">Radiant</a>
  <span class="dot" aria-hidden="true"></span>
  <a href="https://radiant-iraq.com" target="_blank" rel="noopener">radiant-iraq.com</a>
  <span class="dot" aria-hidden="true"></span>
  <a href="https://oorr.ai" target="_blank" rel="noopener">oorr.ai</a>
</footer>

<script src="${docs}docs.js"></script>
</body>
</html>
`;
}

const SOURCE = await readFile(join(HERE, "_pages.html"), "utf8");

// The product lede lives once in the source and belongs to the landing page.
const LEDE = (/<p class="lede">([\s\S]*?)<\/p>/.exec(SOURCE)?.[1] ?? "").trim();

let written = 0;
for (const [index, page] of PAGES.entries()) {
  const outDir = join(HERE, page.dir);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), render(page, index, LEDE), "utf8");
  written += 1;
  console.log(`  /docs/oorr/${page.dir ? `${page.dir}/` : ""}`.padEnd(34) + page.title);
}
console.log(`\n${written} pages written.`);
