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
  pricing: "OORR AI token pricing: $1.80 per 1M input tokens, $3.60 per 1M output tokens.",
  usage: "Request, token and cost reporting for the OORR AI API.",
  keys: "Create, mask, rename and revoke OORR AI API keys.",
};

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

/** The shared sidebar, with the current page marked. */
function sidebar(current) {
  const up = upToDocsRoot(current);
  const items = PAGES.map((p) => {
    const href = p.dir === "" ? up || "./" : `${up}${p.dir}/`;
    const isCurrent = p.id === current.id;
    return `      <li><a href="${href}"${isCurrent ? ' class="is-current" aria-current="page"' : ""}>${p.label}</a></li>`;
  }).join("\n");

  return `    <p class="sb-title">OORR AI</p>
    <ul class="sb-list">
${items}
    </ul>
    <p class="sb-title">Status legend</p>
    <ul class="sb-legend">
      <li><span class="pill pill--live">Live</span></li>
      <li><span class="pill pill--pending">Pending</span></li>
      <li><span class="pill pill--ui">UI only</span></li>
    </ul>`;
}

/** Previous / next links, so the reading order survives the page split. */
function pager(index) {
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  if (!prev && !next) return "";
  const current = PAGES[index];
  const up = upToDocsRoot(current);
  const href = (p) => (p.dir === "" ? up || "./" : `${up}${p.dir}/`);

  const left = prev
    ? `<a class="pager-link pager-prev" href="${href(prev)}"><span>Previous</span><b>${prev.label}</b></a>`
    : `<span></span>`;
  const right = next
    ? `<a class="pager-link pager-next" href="${href(next)}"><span>Next</span><b>${next.label}</b></a>`
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
<link rel="icon" type="image/png" href="${site}assets/favicon.png">
<link rel="stylesheet" href="${docs}docs.css">
</head>
<body>

<div class="wash" aria-hidden="true"></div>

<a class="skip" href="#main">Skip to content</a>

<header class="topbar">
  <a class="brand" href="${site}">
    <img src="${site}assets/radiant-mark.png" alt="" draggable="false">
    <b>Radiant</b>
  </a>
  <span class="crumb">Docs&nbsp; / &nbsp;<em>OORR AI</em></span>
  <div class="topbar-end">
    <a class="ghost-link" href="https://oorr.ai" target="_blank" rel="noopener">oorr.ai</a>
    <button class="navtoggle" id="navtoggle" aria-expanded="false" aria-controls="sidebar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      Menu
    </button>
  </div>
</header>

<div class="layout">

  <nav class="sidebar" id="sidebar" aria-label="Documentation">
${sidebar(page)}
  </nav>

  <main class="content" id="main">
    <article class="prose">
      <div class="page-head">
        <p class="eyebrow">OORR AI</p>
        <h1>${headingHtml}</h1>${ledeHtml}
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
