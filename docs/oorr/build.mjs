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
 * The shell is the terminal chrome, laid out as a horizontal deck: the
 * numbered index now runs as a rail under the top bar, the article flows into
 * columns that read left to right, and the last column hands over to the next
 * page. Presentation lives in docs.css; behaviour — the wheel-to-deck mapping,
 * the page hand-over and the globe — in docs.js.
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
 * The hand-over connector drawn in the last column: a dotted trace running
 * down to a diamond carrying the next page's number — the join the reference
 * draws between one numbered section and the next.
 */
function handover(nextIndex) {
  return `        <div class="endcap-link" aria-hidden="true">
          <svg viewBox="0 0 200 74" role="presentation">
            <path d="M8 0 V26 H92 V30"/>
            <path d="M92 52 V58 H192 V74"/>
            <path class="dia" d="M92 33 L109 46 L92 59 L75 46 Z"/>
            <text x="92" y="49" text-anchor="middle">${pad(nextIndex + 1)}</text>
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

  const rows = LEGEND.map((s) => `      <button class="lg lg--${s.key}" type="button" data-status="${s.key}" ` +
    `aria-pressed="false" title="${s.label} — ${s.note}">
        <span class="lg-glyph" aria-hidden="true">${glyphs[s.key]}</span>
        <span class="lg-text"><b>${s.label}</b></span>
      </button>`).join("\n");

  return `    <div class="legend" role="group" aria-label="Status legend — point at one to trace it through the page">
${rows}
    </div>`;
}

/** The module rail: the index, moved out of the sidebar into the top bar. */
function rail(current) {
  const up = upToDocsRoot(current);
  const items = PAGES.map((p, i) => {
    const href = p.dir === "" ? up || "./" : `${up}${p.dir}/`;
    const isCurrent = p.id === current.id;
    return `      <li><a class="rail-item${isCurrent ? " is-current" : ""}" href="${href}"` +
      `${isCurrent ? ' aria-current="page"' : ""}>` +
      `<i>${pad(i + 1)}</i>${p.label}</a></li>`;
  }).join("\n");

  return `  <nav class="rail" aria-label="Documentation">
    <ol class="rail-list">
${items}
    </ol>
  </nav>`;
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

/**
 * The last column of every page. Scrolling past it is what carries the reader
 * on, so it states where "on" goes and gives a link for anyone who would
 * rather click than scroll.
 */
function endcap(index) {
  const current = PAGES[index];
  const next = PAGES[index + 1];
  const up = upToDocsRoot(current);
  if (!next) {
    return `      <div class="endcap">
        <p class="end-kicker">End of reference</p>
        <h2 class="end-title">${PAGES[0].label}</h2>
        <p class="end-hint">back to the start <i aria-hidden="true">&rsaquo;</i></p>
        <a class="bracket" href="${up || "./"}">.open&nbsp;<em>{${PAGES[0].label.toUpperCase()}}</em></a>
      </div>`;
  }
  const href = next.dir === "" ? up || "./" : `${up}${next.dir}/`;
  return `      <div class="endcap">
${handover(index + 1)}
        <p class="end-kicker">Next &mdash; ${pad(index + 2)}</p>
        <h2 class="end-title">${next.label}</h2>
        <p class="end-hint">keep scrolling <i aria-hidden="true">&rsaquo;</i></p>
        <a class="bracket" href="${href}">.open&nbsp;<em>{${next.label.toUpperCase()}}</em></a>
      </div>`;
}

function render(page, index, lede) {
  const site = upToSiteRoot(page);
  const docs = upToDocsRoot(page);
  // The deck hands over to these when the reader scrolls past either end.
  const href = (p) => (p.dir === "" ? docs || "./" : `${docs}${p.dir}/`);
  const prevHref = PAGES[index - 1] ? href(PAGES[index - 1]) : "";
  const nextHref = PAGES[index + 1] ? href(PAGES[index + 1]) : "";
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
<body data-page="${page.id}"${prevHref ? ` data-prev="${prevHref}"` : ""}${nextHref ? ` data-next="${nextHref}"` : ""}>

<a class="skip" href="#main">Skip to content</a>

<div class="shell">

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
    </div>
    <div class="readbar" id="readbar" aria-hidden="true"><i></i></div>
  </header>

${rail(page)}

${ticker()}

  <main class="deck" id="deck" tabindex="-1">
    <div class="track" id="track">
      <article class="reader prose" id="main">

        <div class="cover">
          <p class="ph-num"><b>${pad(index + 1)}</b><i>&nbsp;/&nbsp;${pad(PAGES.length)}</i></p>
          <h1>${headingHtml}</h1>${ledeHtml}
          <p class="cover-hint">scroll to read <i aria-hidden="true">&rsaquo;</i></p>
        </div>

        <div class="cover-figure" aria-hidden="true">
          <canvas class="globe" id="globe"></canvas>
        </div>

${content}

${endcap(index)}
      </article>
    </div>
  </main>

  <div class="footbar">
${legend()}
    <div class="chips" id="chips" aria-label="Sections on this page"></div>
    <div class="colcount">
      <span id="colcount"><b>01</b> / 01</span>
      <span class="stepper">
        <button class="step" type="button" id="stepprev" aria-label="Previous column">&lsaquo;</button>
        <button class="step" type="button" id="stepnext" aria-label="Next column">&rsaquo;</button>
      </span>
    </div>
  </div>

</div>

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
