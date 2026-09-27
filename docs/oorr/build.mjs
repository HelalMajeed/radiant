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
 * The shell is the terminal chrome: slash-prefixed nav, the numbered index
 * rail, a dotted routing connector, the status-legend diagnostics block, the
 * status ticker and the wireframe globe. Presentation lives in docs.css;
 * behaviour — including the globe — in docs.js.
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

/** The status strip that runs under every page head. Facts only. */
const TICKER = [
  { t: "Sargon 1.5 — production model", s: "live" },
  { t: "Chat + vision", s: "live" },
  { t: "SSE streaming", s: "live" },
  { t: "Base URL api.oorr.ai", s: "live" },
  { t: "API-key auth", s: "pending" },
  { t: "Billing", s: "pending" },
  { t: "Usage read-back", s: "not implemented" },
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
 * The routing connector that divides the index from the diagnostics block: a
 * dotted trace that leaves the rail, turns two corners and terminates on a
 * marked node, the way the reference routes a line between blocks. The trace
 * is broken either side of the node so the glyph sits on the wire rather than
 * on top of it.
 */
function routeSvg() {
  return `    <div class="route" aria-hidden="true">
      <svg viewBox="0 0 200 64" preserveAspectRatio="none" role="presentation">
        <path d="M10 0 V16 H104 V22"/>
        <path d="M104 40 V48 H190 V64"/>
        <circle class="node" cx="104" cy="31" r="9"/>
        <path class="bolt" d="M104 26.5 V35.5 M99.5 31 H108.5 M100.8 27.8 L107.2 34.2 M107.2 27.8 L100.8 34.2"/>
        <circle class="pip" cx="190" cy="56" r="1.7"/>
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
      `<span class="sb-label">${p.label}</span></a></li>`;
  }).join("\n");

  return `    <p class="sb-title"><span>Index</span><b>${pad(PAGES.length)}</b></p>
    <ol class="sb-list">
${items}
    </ol>

${routeSvg()}

${legend()}`;
}

/**
 * The status ticker. Two identical runs sit side by side so the strip can loop
 * on a -50% translate with no seam.
 */
function ticker() {
  const run = TICKER
    .map((i) => `<span>${i.t.toUpperCase()} — <b>${i.s.toUpperCase()}</b><em> ///////// </em></span>`)
    .join("");
  return `      <div class="ticker" aria-hidden="true">
        <div class="ticker-run">${run}${run}</div>
      </div>`;
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
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/png" href="${site}assets/favicon.png">
<link rel="stylesheet" href="${docs}docs.css">
</head>
<body data-page="${page.id}">

<a class="skip" href="#main">Skip to content</a>

<header class="topbar">
  <nav class="navset" aria-label="Site">
    <a class="navlink" href="${site}">Radiant</a>
    <a class="navlink is-here" href="${docs || "./"}">Docs</a>
    <a class="navlink" href="https://oorr.ai" target="_blank" rel="noopener">oorr.ai</a>
  </nav>
  <a class="brand" href="${site}">
    <img src="${site}assets/radiant-mark.png" alt="" draggable="false">
    <b>radiant<i>/oorr</i></b>
  </a>
  <div class="topbar-end">
    <a class="bracket" href="https://api.oorr.ai" target="_blank" rel="noopener">.open&nbsp;<em>{API}</em></a>
    <button class="navtoggle" id="navtoggle" aria-expanded="false" aria-controls="sidebar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      .index
    </button>
  </div>
  <div class="readbar" id="readbar" aria-hidden="true"><i></i></div>
</header>

<div class="layout">

  <nav class="sidebar" id="sidebar" aria-label="Documentation">
${sidebar(page)}
  </nav>

  <main class="content" id="main">

    <div class="page-head">
      <p class="ph-num"><b>${pad(index + 1)}</b><i>&nbsp;/&nbsp;${pad(PAGES.length)}</i></p>
      <h1>${headingHtml}</h1>${ledeHtml}
      <canvas class="globe" id="globe" aria-hidden="true"></canvas>
    </div>

${ticker()}

    <article class="prose">
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
