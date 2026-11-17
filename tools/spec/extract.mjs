// Source-text extractors for facts the language server's symbol table does not
// expose. Each works on the text inside a symbol's own range, so it stays local
// to the element and does not depend on file layout.

import { stripComments } from './model.mjs';

// ---------------------------------------------------------------------------
// Small text utilities
// ---------------------------------------------------------------------------

/** Split a body into top-level statements (ignores nested `{ ... }` bodies). */
export function topLevelStatements(body) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '{') {
      depth++;
      if (depth === 1) {
        // a nested body ends the statement header
        out.push(cur.trim() + ' {…}');
        cur = '';
      }
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (ch === ';') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Text between the first `{` and its matching `}`. */
export function bodyOf(text) {
  const start = text.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start + 1, i);
  }
  return text.slice(start + 1);
}

// ---------------------------------------------------------------------------
// Feature details
// ---------------------------------------------------------------------------

/** Bound value of a feature declaration (`= expr`, `:= expr`, `default = expr`). */
export function boundValue(model, s) {
  const t = stripComments(model.text(s)).split(/[;{]/)[0];
  const m = t.match(/(?<![<>=!])(?::)?=(?!=)\s*([\s\S]+)$/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : undefined;
}

/** Trailing `// note` on the line where the symbol starts. */
export function lineNote(model, s) {
  const m = model.line(s).match(/\/\/\s*(.+)$/);
  return m ? m[1].trim() : undefined;
}

/** Multiplicity written after the type, e.g. `[1..*]`. */
export function multiplicity(model, s) {
  const t = model.text(s, { clean: true }).split(/[;{]/)[0];
  const m = t.match(/:\s*~?[\w:']+\s*\[\s*([\d*]+(?:\s*\.\.\s*[\d*]+)?)\s*\]/);
  return m ? m[1].replace(/\s+/g, '') : undefined;
}

export function isConjugated(model, s) {
  return /:\s*~/.test(model.text(s, { clean: true }).split(/[;{]/)[0]);
}

export function direction(model, s) {
  const m = model.line(s, { clean: true }).match(/^\s*(in|out|inout)\b/);
  return m ? m[1] : undefined;
}

export function isAbstract(model, s) {
  return /^\s*abstract\b/.test(model.line(s, { clean: true }));
}

/** `connect a to b` ends of a connection or interface usage. */
export function connectEnds(model, s) {
  const src = s.declaration ?? model.text(s, { clean: true });
  const m = src.match(/connect\s+([\w.]+)\s+to\s+([\w.]+)/);
  return m ? { from: m[1], to: m[2] } : undefined;
}

/** `flow [of T] from a to b` / `flow a to b`. */
export function flowEnds(model, s) {
  const src = s.declaration ?? model.text(s, { clean: true });
  const m = src.match(/flow\s+(?:of\s+([\w:]+)\s+)?(?:from\s+)?([\w.]+)\s+to\s+([\w.]+)/);
  return m ? { itemType: m[1], from: m[2], to: m[3] } : undefined;
}

/** Text of the first `objective { doc /* … *\/ }`. */
export function objectiveDoc(model, s) {
  const m = model.text(s).match(/objective\s*\{\s*doc\s*\/\*([\s\S]*?)\*\//);
  return m ? cleanDoc(m[1]) : undefined;
}

export function cleanDoc(d) {
  return (d ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trimEnd())
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Requirements, verification
// ---------------------------------------------------------------------------

export function requireConstraints(model, s) {
  const t = model.text(s, { clean: true });
  return [...t.matchAll(/require\s+constraint\s*\{([\s\S]*?)\}/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
}

export function assumeConstraints(model, s) {
  const t = model.text(s, { clean: true });
  return [...t.matchAll(/assume\s+constraint\s*\{([\s\S]*?)\}/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
}

/** All `satisfy R by X;` statements in the model. */
export function satisfyLinks(model) {
  const out = [];
  for (const f of model.files) {
    for (const m of f.clean.matchAll(/\bsatisfy\s+([\w.:]+)\s+by\s+([\w.:]+)\s*;/g)) {
      out.push({ requirement: m[1], by: m[2], file: f.rel });
    }
  }
  return out;
}

/** `verify X;` statements inside a verification definition. */
export function verifiedPaths(model, s) {
  return [...model.text(s, { clean: true }).matchAll(/\bverify\s+([\w.:]+)\s*;/g)].map((m) => m[1]);
}

/** Acceptance expression of `verdict = PassIf(expr)`. */
export function passIf(model, s) {
  const t = model.text(s, { clean: true });
  const i = t.search(/PassIf\s*\(/);
  if (i < 0) return undefined;
  let depth = 0;
  const start = t.indexOf('(', i);
  for (let j = start; j < t.length; j++) {
    if (t[j] === '(') depth++;
    else if (t[j] === ')' && --depth === 0) return t.slice(start + 1, j).replace(/\s+/g, ' ').trim();
  }
  return undefined;
}

/** `subject :>> x = path;` binding inside a case usage. */
export function subjectBinding(model, s) {
  const m = model.text(s, { clean: true }).match(/subject\s*(?::>>\s*)?\w*\s*=\s*([\w.]+)/);
  return m ? m[1] : undefined;
}

/** Return expression of a calc / analysis definition. */
export function returnExpression(model, s) {
  const m = model.text(s, { clean: true }).match(/return\s+(?::>>\s*)?(\w+)[^=;]*=\s*([^;]+);/);
  return m ? { name: m[1], expr: m[2].replace(/\s+/g, ' ').trim() } : undefined;
}

/** Boolean expression of a constraint definition (the last statement without `;`). */
export function constraintExpression(model, s) {
  const body = bodyOf(model.text(s, { clean: true }));
  const stmts = body.split(';').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const last = stmts[stmts.length - 1];
  return last && !/^(in|out|inout|attribute|doc)\b/.test(last) ? last : undefined;
}

// ---------------------------------------------------------------------------
// Behaviour: successions, decisions, states
// ---------------------------------------------------------------------------

/**
 * Control flow of an action definition as a list of nodes and edges, built from
 * `first`, `then`, `decide`, `if … then`, `else`, `merge`/`fork`/`join` statements.
 */
export function actionFlow(model, def) {
  const stmts = topLevelStatements(bodyOf(model.text(def, { clean: true })));
  const nodes = new Map(); // name -> { name, kind, type }
  const edges = [];
  const add = (name, kind = 'action', type) => {
    if (!nodes.has(name)) nodes.set(name, { name, kind, type });
    return name;
  };
  for (const a of model.children(def, /^(action|perform action|send action|accept action|assign action|calc)$/)) {
    add(a.name, 'action', a.type);
  }
  for (const d of model.children(def, ['decide', 'merge', 'fork', 'join'])) add(d.name, d.kind);

  let prev;
  const target = (t) => {
    t = t.trim();
    if (t === 'done' || t === 'start') return add(t, t);
    const m = t.match(/^(?:action\s+)?(\w+)/);
    return m ? add(m[1]) : undefined;
  };
  for (const st of stmts) {
    let m;
    if ((m = st.match(/^first\s+(\w+)\s+then\s+(.+)$/))) {
      const a = target(m[1]);
      const b = target(m[2]);
      if (a && b) edges.push({ from: a, to: b });
      prev = b;
    } else if ((m = st.match(/^first\s+(\w+)$/))) {
      prev = target(m[1]);
    } else if ((m = st.match(/^then\s+(decide|merge|fork|join)\s*(\w*)/))) {
      const name = add(m[2] || `${m[1]}${nodes.size}`, m[1]);
      if (prev) edges.push({ from: prev, to: name });
      prev = name;
    } else if ((m = st.match(/^(decide|merge|fork|join)\s*(\w*)$/))) {
      prev = add(m[2] || `${m[1]}${nodes.size}`, m[1]);
    } else if ((m = st.match(/^then\s+(.+)$/))) {
      const b = target(m[1]);
      if (prev && b) edges.push({ from: prev, to: b });
      prev = b;
    } else if ((m = st.match(/^if\s+(.+?)\s+then\s+(.+)$/))) {
      const b = target(m[2]);
      if (prev && b) edges.push({ from: prev, to: b, guard: m[1] });
    } else if ((m = st.match(/^else\s+(.+)$/))) {
      const b = target(m[1]);
      if (prev && b) edges.push({ from: prev, to: b, guard: 'else' });
    } else if ((m = st.match(/^succession\s+(?:\w+\s+)?first\s+(\w+)\s+then\s+(\w+)$/))) {
      const a = target(m[1]);
      const b = target(m[2]);
      if (a && b) edges.push({ from: a, to: b });
    }
  }
  const flows = model
    .children(def, 'flow')
    .map((f) => flowEnds(model, f))
    .filter(Boolean);
  return { nodes: [...nodes.values()], edges, flows };
}

/** Initial state from `entry; then s;`. */
export function initialState(model, def) {
  const m = model.text(def, { clean: true }).match(/\bentry\s*;\s*then\s+(\w+)\s*;/);
  return m ? m[1] : undefined;
}

export function transitionDetails(model, t) {
  const txt = model.text(t, { clean: true }).replace(/\s+/g, ' ');
  const guard = txt.match(/\bif\s+(.+?)\s+(?:do|then)\s/);
  const effect = txt.match(/\bdo\s+(.+?)\s+then\s/);
  return { guard: guard?.[1], effect: effect?.[1] };
}

/** entry/do/exit behaviours declared in a state body. */
export function stateBehaviours(model, st) {
  const t = model.text(st, { clean: true });
  const out = [];
  for (const m of t.matchAll(/\b(entry|do|exit)\s+action\s+(\w+)(?:\s*:\s*([\w:]+))?/g)) {
    out.push({ when: m[1], name: m[2], type: m[3] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Values and compliance
// ---------------------------------------------------------------------------

const UNIT_SCALE = {
  m: 1, km: 1000, mm: 0.001, cm: 0.01,
  s: 1, min: 60, h: 3600, d: 86400,
  'm/s': 1, 'km/h': 1 / 3.6,
  '°': Math.PI / 180, rad: 1,
  kg: 1, t: 1000, N: 1, kN: 1000, W: 1, kW: 1000, MW: 1e6, Hz: 1,
};
const UNIT_DIM = {
  m: 'L', km: 'L', mm: 'L', cm: 'L', s: 'T', min: 'T', h: 'T', d: 'T', 'm/s': 'V', 'km/h': 'V',
  '°': 'A', rad: 'A', kg: 'M', t: 'M', N: 'F', kN: 'F', W: 'P', kW: 'P', MW: 'P', Hz: 'f',
};

/** Parse `12 [m]`, `360 ['°']`, `0.5`, `Enum::literal`, `true`. */
export function parseValue(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  let m = s.match(/^(-?[\d.]+(?:[eE][-+]?\d+)?)\s*\[\s*'?([^\]']+?)'?\s*\]$/);
  if (m) {
    const unit = m[2].trim();
    const scale = UNIT_SCALE[unit];
    return { kind: 'quantity', num: Number(m[1]), unit, base: scale != null ? Number(m[1]) * scale : undefined, dim: UNIT_DIM[unit] };
  }
  if ((m = s.match(/^-?[\d.]+(?:[eE][-+]?\d+)?$/))) return { kind: 'number', num: Number(s), base: Number(s), dim: '1' };
  if (/^(true|false)$/.test(s)) return { kind: 'boolean', value: s === 'true' };
  if ((m = s.match(/^([\w]+::)*(\w+)$/))) return { kind: 'symbol', value: m[2] };
  return { kind: 'expr', value: s };
}

/** Compare two parsed values with a relational operator. Returns true/false/undefined. */
export function compare(a, op, b) {
  if (!a || !b) return undefined;
  if (a.kind === 'symbol' || b.kind === 'symbol' || a.kind === 'boolean' || b.kind === 'boolean') {
    const x = a.value;
    const y = b.value;
    if (op === '==') return x === y;
    if (op === '!=') return x !== y;
    return undefined;
  }
  if (a.base == null || b.base == null || a.dim !== b.dim) return undefined;
  const x = a.base;
  const y = b.base;
  const eps = 1e-9 * Math.max(Math.abs(x), Math.abs(y), 1);
  switch (op) {
    case '<=': return x <= y + eps;
    case '>=': return x >= y - eps;
    case '<': return x < y;
    case '>': return x > y;
    case '==': return Math.abs(x - y) <= eps;
    case '!=': return Math.abs(x - y) > eps;
    default: return undefined;
  }
}

/** Parse a simple requirement constraint `subject.attr OP param` (either order). */
export function simpleComparison(expr, subjectName) {
  const m = expr.match(/^\s*([\w.]+)\s*(<=|>=|==|!=|<|>)\s*([\w.]+)\s*$/);
  if (!m) return undefined;
  const [, l, op, r] = m;
  const flip = { '<=': '>=', '>=': '<=', '<': '>', '>': '<', '==': '==', '!=': '!=' };
  const isSubj = (x) => x.startsWith(subjectName + '.');
  if (isSubj(l) && !isSubj(r)) return { feature: l.slice(subjectName.length + 1), op, param: r };
  if (isSubj(r) && !isSubj(l)) return { feature: r.slice(subjectName.length + 1), op: flip[op], param: l };
  return undefined;
}
