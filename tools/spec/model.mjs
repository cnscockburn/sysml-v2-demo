// Loads the SysML v2 model through the repo's `sysml` MCP server (the language
// server bundled with the VS Code extension) and wraps the symbol table in a
// small query API. Facts the symbol table does not carry (bound values,
// successions, satisfy/verify links, constraint expressions) are read from the
// source text inside each symbol's range by extract.mjs.

import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Minimal MCP stdio client
// ---------------------------------------------------------------------------

class McpClient {
  static async start(repoRoot) {
    const c = new McpClient();
    c.child = spawn(process.execPath, [resolve(repoRoot, 'tools/sysml-mcp.mjs')], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    c.buf = '';
    c.pending = new Map();
    c.nextId = 1;
    c.stderr = '';
    c.child.stderr.on('data', (d) => (c.stderr += d));
    c.child.stdout.on('data', (d) => c.#onData(d));
    c.exited = new Promise((res) => c.child.on('exit', res));
    await c.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'generate-spec', version: '1.0.0' },
    });
    c.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return c;
  }

  #onData(d) {
    this.buf += d;
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    }
  }

  request(method, params) {
    const id = this.nextId++;
    const timeout = 60000;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} timed out. Server stderr:\n${this.stderr}`));
      }, timeout);
      this.pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolvePromise(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  async call(tool, args) {
    const r = await this.request('tools/call', { name: tool, arguments: args });
    if (r.structuredContent) return r.structuredContent;
    const text = (r.content ?? []).map((c) => c.text).join('');
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }

  close() {
    this.child.kill();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uriKey = (uri) => decodeURIComponent(uri).replace(/\\/g, '/').toLowerCase();

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.sysml') ? [p] : [];
    });
}

/** Replace comments with spaces (keeps offsets and line numbers stable). */
export function stripComments(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

const lastSeg = (name) => (name ?? '').replace(/^~/, '').split('::').pop();

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export class Model {
  constructor(repoRoot, modelDir, symbols, files, diagnostics) {
    this.repoRoot = repoRoot;
    this.modelDir = modelDir;
    this.symbols = symbols;
    this.diagnostics = diagnostics;
    this.files = files; // [{ path, rel, uri, key, text, clean, lines, cleanLines }]
    this.fileByKey = new Map(files.map((f) => [f.key, f]));
    this.byId = new Map();
    this.kids = new Map();
    for (const s of symbols) {
      s.key = uriKey(s.location.uri);
      this.byId.set(s.symbolId, s);
    }
    for (const s of symbols) {
      if (!s.parentId) continue;
      if (!this.kids.has(s.parentId)) this.kids.set(s.parentId, []);
      this.kids.get(s.parentId).push(s);
    }
    this._defCache = new Map();
  }

  // --- navigation ---------------------------------------------------------

  parent(s) {
    return s?.parentId ? this.byId.get(s.parentId) : undefined;
  }

  children(s, kind) {
    const list = this.kids.get(s?.symbolId) ?? [];
    return kind ? list.filter((c) => matchKind(c, kind)) : list;
  }

  ofKind(kind) {
    return this.symbols.filter((s) => matchKind(s, kind));
  }

  packages() {
    return this.ofKind('package');
  }

  /** Folder of the symbol's file relative to the model dir ('' for the root file). */
  folder(s) {
    const f = this.file(s);
    if (!f) return '';
    const parts = f.rel.split('/');
    return parts.length > 2 ? parts[1] : '';
  }

  file(s) {
    return this.fileByKey.get(s.key);
  }

  /** Find a definition (any `... def`) by simple or qualified name. */
  findDef(name) {
    if (!name) return undefined;
    const clean = name.replace(/^~/, '').trim();
    if (this._defCache.has(clean)) return this._defCache.get(clean);
    const isDef = (s) => / def$/.test(s.kind);
    let hit = this.symbols.find((s) => isDef(s) && s.qualifiedName === clean);
    if (!hit) hit = this.symbols.find((s) => isDef(s) && s.name === lastSeg(clean));
    this._defCache.set(clean, hit);
    return hit;
  }

  /** The definition a definition specializes, if it is part of this model. */
  general(def) {
    if (!def?.specializes) return undefined;
    const g = this.findDef(def.specializes);
    return g && g !== def ? g : undefined;
  }

  /** All model definitions that (transitively) specialize `def`. */
  specializations(def, transitive = true) {
    const direct = this.symbols.filter((s) => / def$/.test(s.kind) && this.general(s) === def);
    return transitive ? direct.flatMap((d) => [d, ...this.specializations(d, true)]) : direct;
  }

  /** Own and inherited members of a definition (own members win by name). */
  members(def, kind) {
    const seen = new Set();
    const out = [];
    for (let d = def, guard = 0; d && guard < 20; d = this.general(d), guard++) {
      for (const c of this.children(d, kind)) {
        if (c.name && seen.has(c.name)) continue;
        if (c.name) seen.add(c.name);
        out.push(c);
      }
    }
    return out;
  }

  /** Definition that types a usage, following redefinitions (`:>> x`) up the context. */
  typeOf(u, depth = 0) {
    if (!u || depth > 10) return undefined;
    if (/ def$/.test(u.kind)) return u;
    if (u.type) return this.findDef(u.type);
    if (u.specializes) {
      const ctxType = this.typeOf(this.parent(u), depth + 1);
      const redefined = ctxType && this.members(ctxType).find((m) => m.name === u.specializes);
      if (redefined && redefined !== u) return this.typeOf(redefined, depth + 1);
      return this.findDef(u.specializes);
    }
    return undefined;
  }

  /** Resolve a dotted feature path (`a.b.c`) starting from a definition. */
  resolvePath(def, path) {
    let ctx = def;
    let hit;
    for (const seg of path.split('.')) {
      if (!ctx) return undefined;
      hit = this.members(ctx).find((m) => m.name === seg);
      if (!hit) return undefined;
      ctx = this.typeOf(hit);
    }
    return hit;
  }

  /** Resolve a dotted path from a top-level usage name (e.g. `massOperation.ship`). */
  resolveUsagePath(path) {
    const [head, ...rest] = path.split('.');
    let hit = this.symbols.find((s) => s.name === head && !/ def$/.test(s.kind) && this.parent(s)?.kind === 'package');
    for (const seg of rest) {
      if (!hit) return undefined;
      const own = this.children(hit).find((c) => c.name === seg);
      hit = own ?? this.members(this.typeOf(hit) ?? {}).find((m) => m.name === seg);
    }
    return hit;
  }

  // --- source text ----------------------------------------------------------

  /** Raw source text of the symbol's range. */
  text(s, { clean = false } = {}) {
    const f = this.file(s);
    if (!f) return '';
    const lines = clean ? f.cleanLines : f.lines;
    const { start, end } = s.location.range;
    if (start.line === end.line) return lines[start.line].slice(start.character, end.character);
    const parts = [lines[start.line].slice(start.character)];
    for (let i = start.line + 1; i < end.line; i++) parts.push(lines[i]);
    parts.push(lines[end.line].slice(0, end.character));
    return parts.join('\n');
  }

  /** Raw full line(s) on which the symbol starts. */
  line(s, { clean = false } = {}) {
    const f = this.file(s);
    if (!f) return '';
    return (clean ? f.cleanLines : f.lines)[s.location.range.start.line] ?? '';
  }

  rel(s) {
    return this.file(s)?.rel ?? '';
  }
}

function matchKind(s, kind) {
  if (Array.isArray(kind)) return kind.includes(s.kind);
  if (kind instanceof RegExp) return kind.test(s.kind);
  return s.kind === kind;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadModel(repoRoot, modelDir = 'model', { log = () => {} } = {}) {
  const paths = walk(resolve(repoRoot, modelDir));
  if (paths.length === 0) throw new Error(`No .sysml files found under ${modelDir}/`);
  const files = paths.map((p) => {
    const text = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    const clean = stripComments(text);
    const uri = pathToFileURL(p).href;
    return {
      path: p,
      rel: relative(repoRoot, p).split(sep).join('/'),
      uri,
      key: uriKey(uri),
      text,
      clean,
      lines: text.split('\n'),
      cleanLines: clean.split('\n'),
    };
  });

  log(`Loading ${files.length} model files through the sysml MCP server...`);
  const client = await McpClient.start(repoRoot);
  try {
    for (const f of files) await client.call('parse', { code: f.text, uri: f.uri });
    // Second pass: every document is loaded, so cross-file references resolve.
    const diagnostics = [];
    for (const f of files) {
      const r = await client.call('validate', { code: f.text, uri: f.uri });
      for (const e of r.syntaxErrors ?? []) diagnostics.push({ file: f.rel, severity: 'error', code: 'syntax', ...e });
      for (const e of r.semanticIssues ?? []) {
        if (e.code === 'unresolved-type') diagnostics.push({ file: f.rel, ...e });
      }
    }
    const res = await client.call('getSymbols', {});
    const symbols = (res.symbols ?? []).filter((s) => files.some((f) => f.key === uriKey(s.location.uri)));
    log(`Loaded ${symbols.length} model elements.`);
    return new Model(repoRoot, modelDir, symbols, files, diagnostics);
  } finally {
    client.close();
  }
}
