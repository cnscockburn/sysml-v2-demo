#!/usr/bin/env node
// Generates a System Design Specification PDF from the SysML v2 model.
//
//   npm run spec                         -> build/<title>-SDS.pdf
//   node tools/generate-spec.mjs --out spec.pdf
//   node tools/generate-spec.mjs --html-only        (HTML only, no PDF)
//
// Options:
//   --out <file>       PDF path (default: build/spec/<slug>-SDS.pdf)
//   --config <file>    JSON overrides (default: tools/spec/spec.config.json)
//   --browser <path>   Chrome/Chromium/Edge executable (or set CHROME_PATH)
//   --html-only        Write the HTML and stop
//
// The model is read through the repo's `sysml` MCP server (tools/sysml-mcp.mjs),
// so the VS Code SysML v2 extension must be installed. See docs/spec-generator.md.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadModel } from './spec/model.mjs';
import { buildDocument } from './spec/document.mjs';
import { findBrowser, printPdf, renderHtml } from './spec/render.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => console.log(`[spec] ${m}`);

function parseArgs(argv) {
  const args = { htmlOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--config') args.config = argv[++i];
    else if (a === '--browser') args.browser = argv[++i];
    else if (a === '--html-only') args.htmlOnly = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown option ${a}`);
  }
  return args;
}

function git(...a) {
  try {
    return execFileSync('git', a, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }

  const configPath = resolve(repoRoot, args.config ?? 'tools/spec/spec.config.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};

  const model = await loadModel(repoRoot, config.modelDir ?? 'model', { log });
  if (model.diagnostics.length) {
    log(`WARNING: ${model.diagnostics.length} model error(s) reported by the language server; they are listed in the document appendix.`);
  }

  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', config.modelDir ?? 'model') ? ' (uncommitted model changes)' : '';
  const date = new Date().toISOString().slice(0, 10);
  const meta = {
    documentNumber: config.documentNumber ?? 'SDS-001',
    revision: commit ? `rev ${commit}${dirty}` : 'uncontrolled',
  };
  const doc = await buildDocument(model, config, meta);
  meta.coverRows = [
    ['Document number', meta.documentNumber],
    ['Revision', meta.revision],
    ['Date', date],
    ['Status', config.status ?? 'Draft, generated from model'],
    ['Model', `${model.files.length} files, ${model.symbols.length} elements (${config.modelDir ?? 'model'}/)`],
    ['Contents', `${doc.stats.requirements} requirements, ${doc.stats.figures} figures, ${doc.stats.tables} tables`],
    ...(config.classification ? [['Classification', config.classification]] : []),
  ];

  const slug = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pdfPath = resolve(repoRoot, args.out ?? `build/spec/${slug}-sds.pdf`);
  const htmlPath = pdfPath.replace(/\.pdf$/i, '') + '.html';
  mkdirSync(dirname(pdfPath), { recursive: true });

  const asset = (p) => {
    const abs = resolve(repoRoot, 'node_modules', p);
    if (!existsSync(abs)) throw new Error(`Missing ${p}. Run "npm install" in ${repoRoot} first.`);
    return pathToFileURL(abs).href;
  };
  const html = renderHtml(doc, meta, {
    pagedSrc: asset('pagedjs/dist/paged.js'),
  });
  writeFileSync(htmlPath, html);
  log(`HTML written to ${relative(repoRoot, htmlPath)}`);
  if (args.htmlOnly) return;

  const browserPath = findBrowser(args.browser);
  log(`Printing with ${browserPath}`);
  const r = await printPdf(htmlPath, pdfPath, { browserPath, log });
  for (const f of r.failures) log(`WARNING: diagram ${f.index + 1} failed to render: ${f.error}`);
  for (const e of r.consoleErrors) log(`WARNING: page error: ${e}`);
  log(`PDF written to ${relative(repoRoot, pdfPath)} (${r.pages} pages, ${doc.stats.figures} figures, ${doc.stats.tables} tables).`);
  if (doc.stats.gaps) log(`Note: ${doc.stats.gaps} requirement(s) have traceability gaps (see the traceability matrix).`);
}

main().catch((e) => {
  console.error(`[spec] ERROR: ${e.message}`);
  process.exit(1);
});
