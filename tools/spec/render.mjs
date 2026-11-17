// Wraps the generated body in a print-ready HTML page (cover, contents, page
// styles) and prints it to PDF with headless Chrome or Edge. Diagrams arrive as
// inline SysML v2 SVG; the page sizes them (rotating very wide ones onto their
// own page), then Paged.js paginates (page numbers, running headers, contents).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { esc } from './document.mjs';

const STYLE = String.raw`
@page {
  size: A4;
  margin: 22mm 18mm 20mm 18mm;
  @top-left { content: string(docTitle); font-size: 8pt; color: #5b6b7b; }
  @top-right { content: string(chapter); font-size: 8pt; color: #5b6b7b; }
  @bottom-left { content: string(docNumber); font-size: 8pt; color: #5b6b7b; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #5b6b7b; }
}
@page cover { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }

:root { --ink: #1b2733; --muted: #5b6b7b; --accent: #1f4e79; --rule: #c9d3dd; --band: #eef3f8; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 9.5pt; color: var(--ink); line-height: 1.42; }
body { margin: 0; }
.doc-meta { string-set: docTitle content(text); display: none; }
.doc-number { string-set: docNumber content(text); display: none; }

/* Cover */
.cover { page: cover; height: calc(297mm - 2px); box-sizing: border-box; padding: 36mm 22mm 24mm; display: flex; flex-direction: column;
  background: linear-gradient(160deg, #0b2545 0%, #1f4e79 55%, #2f6ea5 100%); color: #fff; break-after: page; }
.cover .kicker { text-transform: uppercase; letter-spacing: .18em; font-size: 9pt; opacity: .8; }
.cover .title { font-size: 27pt; line-height: 1.15; margin: 6mm 0 4mm; font-weight: 600; string-set: none; break-before: auto; border: 0; padding: 0; color: #fff; }
.cover .subtitle { font-size: 15pt; font-weight: 300; opacity: .95; }
.cover .spacer { flex: 1; }
.cover table { border-collapse: collapse; font-size: 9pt; color: #fff; width: 100%; }
.cover td { padding: 1.6mm 3mm 1.6mm 0; border-top: 1px solid rgba(255,255,255,.25); vertical-align: top; }
.cover td:first-child { width: 42mm; opacity: .75; }
.cover tbody tr td, .cover tbody tr:nth-child(even) td { background: transparent; border-bottom: 0; }
.cover .disclaimer { margin-top: 6mm; font-size: 8pt; opacity: .75; }

/* Contents */
.toc { }
.toc h2 { font-size: 16pt; color: var(--accent); border: 0; margin-top: 0; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 0; }
.toc li.l1 { font-weight: 600; margin-top: 2.4mm; }
.toc li.l2 { padding-left: 9mm; font-size: 9pt; }
.toc a { color: var(--ink); text-decoration: none; display: flex; }
.toc a .t { flex: 1; }
.toc a .n { display: inline-block; min-width: 11mm; padding-right: 2mm; }
.toc a::after { content: target-counter(attr(href), page); margin-left: 3mm; }

/* Headings */
h1 { font-size: 17pt; color: var(--accent); break-before: page; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid var(--accent); string-set: chapter content(text); }
h2 { font-size: 12.5pt; color: var(--accent); margin: 7mm 0 2.5mm; break-after: avoid; }
h3 { font-size: 10.5pt; margin: 5.5mm 0 2mm; break-after: avoid; }
h4 { font-size: 9.8pt; margin: 4.5mm 0 1.5mm; break-after: avoid; color: #34495e; }
h1 .num, h2 .num, h3 .num, h4 .num { color: var(--muted); font-weight: 400; margin-right: 2.5mm; }
p { margin: 0 0 2.2mm; orphans: 3; widows: 3; }
ul { margin: 0 0 2.5mm; padding-left: 6mm; }
code { font-family: "Cascadia Mono", Consolas, "Courier New", monospace; font-size: .86em; background: #f2f5f8; padding: 0 .6mm; border-radius: 1mm; overflow-wrap: anywhere; }
pre.docblock { font-family: "Cascadia Mono", Consolas, monospace; font-size: 8pt; background: var(--band); border-left: 3px solid var(--accent); padding: 2mm 3mm; white-space: pre-wrap; break-inside: avoid; }
.element { color: var(--muted); margin-top: -1mm; }
.note { background: #fff8e6; border-left: 3px solid #d39e00; padding: 2mm 3mm; margin: 2mm 0 3mm; font-size: 9pt; }
.muted { color: var(--muted); }
.ok { color: #1b7a3a; font-weight: 600; }
.bad { color: #b3261e; font-weight: 600; }
.dir { display: inline-block; min-width: 7mm; font-size: 7.5pt; color: #fff; background: #5b6b7b; border-radius: 1mm; text-align: center; padding: 0 .8mm; margin-right: .8mm; }

/* Tables */
table { width: 100%; border-collapse: collapse; margin: 1.5mm 0 4mm; font-size: 8.6pt; table-layout: fixed; }
p.caption { font-size: 8.5pt; color: var(--muted); margin: 3mm 0 0; break-after: avoid; }
p.caption + table { margin-top: 1.2mm; }
th { background: var(--accent); color: #fff; text-align: left; font-weight: 600; padding: 1.4mm 2mm; }
td { padding: 1.2mm 2mm; border-bottom: 1px solid var(--rule); vertical-align: top; overflow-wrap: anywhere; }
tbody tr:nth-child(even) td { background: #f7f9fb; }
table.small { font-size: 7.9pt; }
table.reqs td:first-child { white-space: nowrap; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
table.kv { width: auto; min-width: 60%; }
table.kv th { background: var(--band); color: var(--ink); width: 32mm; font-weight: 600; }

/* Figures */
figure.diagram { margin: 3mm 0 5mm; break-inside: avoid; text-align: center; }
figure.diagram svg { max-width: 100%; height: auto; }
figure.rotated { break-before: page; break-after: page; position: relative; width: 174mm; height: 238mm; margin: 0; }
figure.rotated .rot { position: absolute; top: 0; left: 0; width: 238mm; height: 174mm; transform-origin: top left;
  transform: translateY(238mm) rotate(-90deg); display: flex; flex-direction: column; align-items: center; justify-content: center; }
figure.rotated .rot svg { flex: 1 1 auto; min-height: 0; width: 100%; height: 100%; }
figure.rotated .rot figcaption { flex: 0 0 auto; }
figcaption { font-size: 8.5pt; color: var(--muted); margin-top: 2mm; }
.diagram-error { border: 1px solid #b3261e; color: #b3261e; padding: 3mm; font-size: 8.5pt; text-align: left; white-space: pre-wrap; }
`;

export function renderHtml({ body, toc }, meta, { pagedSrc }) {
  const tocHtml = toc
    .map((e) => `<li class="l${e.level}"><a href="#${e.id}"><span class="n">${esc(e.num)}</span><span class="t">${esc(e.title)}</span></a></li>`)
    .join('\n');
  const rows = meta.coverRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(meta.title)}: ${esc(meta.subtitle)}</title>
<style>${STYLE}</style>
<script>window.PagedConfig = { auto: false };</script>
<script src="${pagedSrc}"></script>
</head>
<body>
<section class="cover">
  <div class="doc-meta">${esc(meta.title)}: ${esc(meta.subtitle)}</div>
  <div class="doc-number">${esc(meta.documentNumber)} ${esc(meta.revision)}</div>
  <div class="kicker">${esc(meta.subtitle)}</div>
  <div class="title">${esc(meta.title)}</div>
  <div class="subtitle">${esc(meta.systemName ? `System of interest: ${meta.systemName}` : '')}</div>
  <div class="spacer"></div>
  <table>${rows}</table>
  <div class="disclaimer">Generated automatically from the SysML v2 model. Do not edit this document: change the model and regenerate it.</div>
</section>
<nav class="toc"><h2>Contents</h2><ol>${tocHtml}</ol></nav>
<main>
${body}
</main>
<script>
// Size a rendered SVG for an A4 portrait page: never upscale; rotate a wide
// diagram onto its own page when it would otherwise shrink too far.
const MM = 96 / 25.4;
const AVAIL_W = 174 * MM, AVAIL_H = 215 * MM, ROT_W = 238 * MM, ROT_H = 160 * MM, SCALE = 0.85;
function fitDiagram(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (!vb || !vb.width) return;
  const w = vb.width * SCALE, h = vb.height * SCALE;
  svg.removeAttribute('style');
  svg.removeAttribute('height');
  const fig = svg.closest('figure');
  const portraitScale = Math.min(1, AVAIL_W / w, AVAIL_H / h);
  const rotatedScale = Math.min(1, ROT_W / w, ROT_H / h);
  if (fig && w / h > 1.3 && rotatedScale > portraitScale * 1.35) {
    fig.classList.add('rotated');
    const rot = document.createElement('div');
    rot.className = 'rot';
    while (fig.firstChild) rot.appendChild(fig.firstChild);
    fig.appendChild(rot);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.maxWidth = (w * rotatedScale) + 'px';
    svg.style.maxHeight = (h * rotatedScale) + 'px';
  } else {
    svg.setAttribute('width', (w * portraitScale) + 'px');
    svg.setAttribute('height', (h * portraitScale) + 'px');
  }
}
// Diagrams arrive as inline SysML v2 SVG (rendered by sysml-svg.mjs); only page fitting happens here.
window.renderDiagrams = async function () {
  const failures = [];
  document.querySelectorAll('figure.diagram > svg').forEach((svg, i) => {
    try {
      fitDiagram(svg);
    } catch (e) {
      failures.push({ index: i, error: String((e && e.message) || e) });
    }
  });
  return failures;
};
window.paginate = async function () {
  const previewer = new Paged.Previewer();
  const flow = await previewer.preview();
  return flow.total;
};
</script>
</body>
</html>`;
}

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
];

export function findBrowser(explicit) {
  const hit = [explicit, ...BROWSERS].filter(Boolean).find((p) => existsSync(p));
  if (!hit) throw new Error('No Chrome, Chromium or Edge found. Pass --browser <path> or set CHROME_PATH.');
  return hit;
}

export async function printPdf(htmlPath, pdfPath, { browserPath, log = () => {} }) {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--allow-file-access-from-files', '--disable-gpu', '--no-first-run'],
  });
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    await page.setViewport({ width: 1240, height: 1754 });
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: 'load', timeout: 120000 });
    log('Rendering diagrams...');
    const failures = await page.evaluate(() => window.renderDiagrams());
    log('Paginating...');
    const pages = await page.evaluate(() => window.paginate());
    log(`Printing ${pages} pages...`);
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, timeout: 180000 });
    return { pages, failures, consoleErrors };
  } finally {
    await browser.close();
  }
}
