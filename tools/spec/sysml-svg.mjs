// SysML v2 graphical-notation renderer: turns a diagram description (nodes,
// ports, edges) into an SVG string, laid out with ELK (elkjs).
//
// Notation follows the SysML v2 standard graphical notation as presented in
// "Intro to the SysML v2 Language - Graphical Notation" (Systems-Modeling/
// SysML-v2-Release, doc/):
//  - definitions: square-cornered boxes, header «kind def» Name
//  - usages: round-cornered boxes, header «kind» name : Type [mult]
//  - compartments separated by lines, with an italic compartment name
//  - ports: small squares on the owning part's boundary, labelled name : Type
//  - composition: line with a filled diamond at the owner end
//  - specialization: line with a hollow triangle at the general end
//  - successions: dashed lines with open arrowheads; item flows: solid lines
//  - start: filled circle; done: bullseye; decision/merge: diamond
//  - transitions: solid lines with open arrowheads, "trigger [guard] / effect"
//  - actors: stick figures

import ELKModule from 'elkjs/lib/elk.bundled.js';

const ELK = ELKModule.default ?? ELKModule;
const elk = new ELK();

export const FONT = 'Arial, Helvetica, sans-serif';
const INK = '#1b2733';
const MUTED = '#4a5868';
const FILL = '#ffffff';
const CONTAINER_FILL = '#f9fbfd';

// Helvetica/Arial advance widths (1/1000 em) for text measurement.
const WIDTHS = (() => {
  const w = {};
  const set = (chars, v) => { for (const c of chars) w[c] = v; };
  set(' !,./:;I[\\]ft', 278); set('ijl', 222); set('"', 355); set("'", 191); set('()-`r', 333);
  set('*', 389); set('+<=>~', 584); set('#$0123456789?L_abdeghnopqu', 556); set('%', 889);
  set('&ABEKPSVXY', 667); set('CDHNRUw', 722); set('FTZ', 611); set('GOQ', 778); set('J', 500);
  set('M', 833); set('W', 944); set('m', 833); set('@', 1015); set('^', 469); set('ckvsxyz', 500);
  set('{}', 334); set('|', 260); set('«»', 556); set('°', 400); set('×', 584); set('≤≥≠', 584);
  return w;
})();

export function textWidth(s, size = 11, bold = false) {
  let w = 0;
  for (const ch of String(s ?? '')) w += WIDTHS[ch] ?? 556;
  return (w / 1000) * size * (bold ? 1.07 : 1);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function text(x, y, s, { size = 11, anchor = 'middle', bold = false, italic = false, fill = INK } = {}) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}"${bold ? ' font-weight="bold"' : ''}${italic ? ' font-style="italic"' : ''} fill="${fill}">${esc(s)}</text>`;
}

/** Text line that may start with a bold keyword: { kw: 'entry', text: 'x' }. */
function richLine(x, y, line, size) {
  if (typeof line === 'string') return text(x, y, line, { size, anchor: 'start' });
  const kw = `<tspan font-weight="bold">${esc(line.kw)}</tspan> `;
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" fill="${INK}">${line.kw ? kw : ''}${esc(line.text)}</text>`;
}
const lineWidth = (line, size) => (typeof line === 'string' ? textWidth(line, size) : textWidth(`${line.kw ?? ''} ${line.text}`, size) + 2);

// ---------------------------------------------------------------------------
// Box shapes (definitions and usages)
// ---------------------------------------------------------------------------

const PAD = 8;
const KW_SIZE = 10;
const NAME_SIZE = 12;
const COMP_SIZE = 10.5;
const LINE_H = 13.5;

/**
 * Measure a box: { usage, keyword, name, italic, bold, compartments: [{ title, lines }] }.
 * Returns the box with w, h and headerH (height of the header band).
 */
export function measureBox(b) {
  const kw = b.keyword ? `«${b.keyword}»` : '';
  const names = [].concat(b.name ?? []);
  let w = Math.max(kw ? textWidth(kw, KW_SIZE) : 0, ...names.map((n) => textWidth(n, NAME_SIZE, b.bold)));
  let h = PAD + (kw ? 12 : 0) + names.length * 15 + PAD / 2;
  const headerH = h;
  for (const c of b.compartments ?? []) {
    if (!c.lines?.length) continue;
    w = Math.max(w, textWidth(c.title, KW_SIZE), ...c.lines.map((l) => lineWidth(l, COMP_SIZE)));
    h += 6 + 12 + c.lines.length * LINE_H + 4;
  }
  return { ...b, w: Math.ceil(Math.max(w + 2 * PAD, b.minW ?? 80)), h: Math.ceil(h + (b.compartments?.length ? 4 : 0)), headerH };
}

function drawBox(b, x, y, w, h, { container = false } = {}) {
  const r = b.usage ? 10 : 0;
  const dash = b.dashed ? ' stroke-dasharray="5 3"' : '';
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${container ? CONTAINER_FILL : FILL}" stroke="${INK}" stroke-width="1.1"${dash}/>`];
  const cx = x + w / 2;
  let cy = y + PAD;
  if (b.keyword) {
    cy += 10;
    out.push(text(cx, cy, `«${b.keyword}»`, { size: KW_SIZE, fill: MUTED }));
  }
  for (const n of [].concat(b.name ?? [])) {
    cy += 14.5;
    out.push(text(cx, cy, n, { size: NAME_SIZE, bold: b.bold, italic: b.italic }));
  }
  cy = y + b.headerH;
  if (container) {
    out.push(`<line x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}" stroke="${INK}" stroke-width="0.8"/>`);
  }
  for (const c of b.compartments ?? []) {
    if (!c.lines?.length) continue;
    out.push(`<line x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}" stroke="${INK}" stroke-width="0.8"/>`);
    cy += 6 + 10;
    out.push(text(cx, cy, c.title, { size: KW_SIZE, italic: true, fill: MUTED }));
    cy += 2;
    for (const l of c.lines) {
      cy += LINE_H;
      out.push(richLine(x + PAD, cy - 3, l, COMP_SIZE));
    }
    cy += 4;
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// Special symbols
// ---------------------------------------------------------------------------

const SPECIAL = {
  start: { w: 36, h: 34 },
  done: { w: 36, h: 36 },
  initial: { w: 18, h: 18 },
  decision: { w: 30, h: 30 },
  fork: { w: 64, h: 7 },
  actor: { w: 30, h: 46 },
};

function drawSpecial(n, x, y, w, h) {
  const cx = x + w / 2;
  switch (n.kind) {
    case 'start':
      return `<circle cx="${cx}" cy="${y + 9}" r="8" fill="${INK}"/>` + text(cx, y + 31, n.label ?? 'start', { size: 10, fill: MUTED });
    case 'done':
      return `<circle cx="${cx}" cy="${y + 10}" r="9" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/><circle cx="${cx}" cy="${y + 10}" r="5.5" fill="${INK}"/>` +
        text(cx, y + 33, n.label ?? 'done', { size: 10, fill: MUTED });
    case 'initial':
      return `<circle cx="${cx}" cy="${y + h / 2}" r="8" fill="${INK}"/>`;
    case 'decision':
      return `<polygon points="${cx},${y} ${x + w},${y + h / 2} ${cx},${y + h} ${x},${y + h / 2}" fill="${FILL}" stroke="${INK}" stroke-width="1.1"/>` +
        (n.label ? text(x + w + 4, y - 2, n.label, { size: 9.5, anchor: 'start', fill: MUTED }) : '');
    case 'fork':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK}"/>` + (n.label ? text(x + w + 4, y + 6, n.label, { size: 9.5, anchor: 'start', fill: MUTED }) : '');
    case 'actor': {
      const top = y + 2;
      return `<g stroke="${INK}" stroke-width="1.2" fill="${FILL}"><circle cx="${cx}" cy="${top + 6}" r="6"/>` +
        `<line x1="${cx}" y1="${top + 12}" x2="${cx}" y2="${top + 28}"/><line x1="${cx - 10}" y1="${top + 18}" x2="${cx + 10}" y2="${top + 18}"/>` +
        `<line x1="${cx}" y1="${top + 28}" x2="${cx - 8}" y2="${top + 42}"/><line x1="${cx}" y1="${top + 28}" x2="${cx + 8}" y2="${top + 42}"/></g>`;
    }
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Edge markers
// ---------------------------------------------------------------------------

const MARKERS = `<defs>
<marker id="m-open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1,1 L11,6 L1,11" fill="none" stroke="${INK}" stroke-width="1.2"/></marker>
<marker id="m-triangle" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1,1 L13,7 L1,13 Z" fill="${FILL}" stroke="${INK}" stroke-width="1.1"/></marker>
<marker id="m-diamond" viewBox="0 0 18 10" refX="1" refY="5" markerWidth="18" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1,5 L9,1 L17,5 L9,9 Z" fill="${INK}" stroke="${INK}" stroke-width="1"/></marker>
<marker id="m-hdiamond" viewBox="0 0 18 10" refX="1" refY="5" markerWidth="18" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1,5 L9,1 L17,5 L9,9 Z" fill="${FILL}" stroke="${INK}" stroke-width="1"/></marker>
<marker id="m-filled" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1,1 L11,6 L1,11 Z" fill="${INK}"/></marker>
</defs>`;

const EDGE_STYLE = {
  composition: { start: 'm-diamond' },
  reference: { start: 'm-hdiamond' },
  specialization: { end: 'm-triangle' },
  succession: { end: 'm-open', dash: '6 4' },
  flow: { end: 'm-open' },
  connection: {},
  binding: {},
  transition: { end: 'm-open' },
  include: { end: 'm-open' },
  dependency: { end: 'm-open', dash: '6 4' },
  association: {},
};

// ---------------------------------------------------------------------------
// Layout and render
// ---------------------------------------------------------------------------

/**
 * Diagram description:
 *   { direction, title, nodes: [Node], edges: [Edge], options }
 *   Node: { id, box?: BoxSpec, kind?: 'start'|'done'|'initial'|'decision'|'fork'|'actor',
 *           label?, caption?, children?: [Node], ports?: [{ id, label }] }
 *   Edge: { id, from, to, type: keyof EDGE_STYLE, label? }
 * from/to are node or port ids.
 */
export async function renderDiagram(d) {
  const measured = new Map();
  const PORT = 10;

  const toElk = (n) => {
    const e = { id: n.id, layoutOptions: {} };
    let box;
    if (n.box) {
      box = measureBox(n.box);
      measured.set(n.id, box);
    }
    if (n.children?.length) {
      e.children = n.children.map(toElk);
      const headerH = box ? box.headerH + (box.h - box.headerH) : 30;
      e.layoutOptions['elk.padding'] = `[top=${headerH + 16},left=18,bottom=18,right=18]`;
      e.layoutOptions['elk.nodeSize.constraints'] = 'MINIMUM_SIZE';
      e.layoutOptions['elk.nodeSize.minimum'] = `(${box?.w ?? 80}, ${box?.h ?? 40})`;
    } else if (box) {
      e.width = box.w;
      e.height = box.h;
    } else {
      const s = SPECIAL[n.kind] ?? { w: 40, h: 30 };
      e.width = s.w;
      e.height = s.h;
      if (n.kind === 'actor' && n.caption) {
        e.labels = [{ text: n.caption, width: textWidth(n.caption, 10) + 4, height: 13 }];
        e.layoutOptions['elk.nodeLabels.placement'] = 'OUTSIDE V_BOTTOM H_CENTER';
      }
    }
    if (n.ports?.length) {
      e.ports = n.ports.map((p) => ({
        id: p.id,
        width: p.hidden ? 1 : PORT,
        height: p.hidden ? 1 : PORT,
        labels: p.label ? [{ text: p.label, width: textWidth(p.label, 9.5) + 4, height: 12 }] : [],
        layoutOptions: p.side ? { 'elk.port.side': p.side } : {},
        hidden: p.hidden,
      }));
      e.layoutOptions['elk.portConstraints'] = n.ports.some((p) => p.side) ? 'FIXED_SIDE' : 'FREE';
      if (n.ports.some((p) => p.label)) {
        // Let the block grow so that its port labels do not overlap.
        const min = n.children?.length ? e.layoutOptions['elk.nodeSize.minimum'] : `(${e.width}, ${e.height})`;
        e.layoutOptions['elk.nodeSize.constraints'] = '[PORTS, PORT_LABELS, MINIMUM_SIZE]';
        e.layoutOptions['elk.nodeSize.minimum'] = min;
        e.layoutOptions['elk.portLabels.placement'] = '[OUTSIDE, NEXT_TO_PORT_IF_POSSIBLE]';
      }
      e.layoutOptions['elk.portLabels.placement'] = 'OUTSIDE';
      e.layoutOptions['elk.spacing.portPort'] = '22';
    }
    return e;
  };

  const graph = {
    id: '__root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': d.direction ?? 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '48',
      'elk.spacing.nodeNode': '28',
      'elk.spacing.edgeNode': '16',
      'elk.spacing.edgeEdge': '12',
      'elk.spacing.edgeLabel': '4',
      'elk.spacing.labelNode': '6',
      'elk.edgeLabels.inline': 'false',
      'elk.layered.edgeLabels.sideSelection': 'ALWAYS_UP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
      'elk.padding': '[top=34,left=16,bottom=16,right=16]',
      ...(d.options ?? {}),
    },
    children: d.nodes.map(toElk),
    // Back edges (loops) are laid out reversed so the main flow stays in order;
    // their arrowheads are swapped when drawing.
    edges: d.edges.map((e) => ({
      id: e.id,
      sources: [e.back ? e.to : e.from],
      targets: [e.back ? e.from : e.to],
      labels: e.label ? [{ text: e.label, width: textWidth(e.label, 10) + 6, height: 13 }] : [],
    })),
  };

  const res = await elk.layout(graph);

  // Absolute offsets for every node and port.
  const abs = new Map([['__root', { x: 0, y: 0 }]]);
  const elkNodes = new Map();
  const walk = (n, ox, oy) => {
    const x = ox + (n.x ?? 0);
    const y = oy + (n.y ?? 0);
    abs.set(n.id, { x, y, w: n.width, h: n.height });
    elkNodes.set(n.id, n);
    for (const p of n.ports ?? []) abs.set(p.id, { x: x + p.x, y: y + p.y, w: p.width, h: p.height, port: p });
    for (const c of n.children ?? []) walk(c, x, y);
  };
  for (const c of res.children ?? []) walk(c, 0, 0);

  const parts = [];
  const hiddenPorts = new Set();
  const index = (n) => {
    for (const p of n.ports ?? []) if (p.hidden) hiddenPorts.add(p.id);
    (n.children ?? []).forEach(index);
  };
  d.nodes.forEach(index);

  // Nodes: containers first (outer to inner), then leaves.
  const drawNode = (n) => {
    const a = abs.get(n.id);
    if (!a) return;
    if (n.box) parts.push(drawBox(measured.get(n.id), a.x, a.y, a.w, a.h, { container: !!n.children?.length }));
    else parts.push(drawSpecial(n, a.x, a.y, a.w, a.h));
    if (n.kind === 'actor' && n.caption) {
      const lab = elkNodes.get(n.id).labels?.[0];
      if (lab) parts.push(text(a.x + lab.x + lab.width / 2, a.y + lab.y + 10, n.caption, { size: 10 }));
    }
    for (const c of n.children ?? []) drawNode(c);
  };
  d.nodes.forEach(drawNode);

  // Edges.
  for (const e of res.edges ?? []) {
    const spec = d.edges.find((x) => x.id === e.id);
    const base = EDGE_STYLE[spec.type] ?? {};
    const st = spec.back ? { ...base, start: base.end, end: base.start } : base;
    const off = abs.get(e.container) ?? { x: 0, y: 0 };
    for (const s of e.sections ?? []) {
      const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((p) => `${(p.x + off.x).toFixed(1)},${(p.y + off.y).toFixed(1)}`);
      parts.push(
        `<polyline points="${pts.join(' ')}" fill="none" stroke="${INK}" stroke-width="1.1"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}` +
          `${st.start ? ` marker-start="url(#${st.start})"` : ''}${st.end ? ` marker-end="url(#${st.end})"` : ''}/>`,
      );
    }
    for (const l of e.labels ?? []) {
      parts.push(`<rect x="${(l.x + off.x).toFixed(1)}" y="${(l.y + off.y).toFixed(1)}" width="${l.width}" height="${l.height}" fill="#ffffff" fill-opacity="0.85"/>`);
      parts.push(text(l.x + off.x + l.width / 2, l.y + off.y + 10, l.text, { size: 10 }));
    }
  }

  // Ports on top of everything, with their labels.
  for (const [, a] of abs) {
    if (!a.port || hiddenPorts.has(a.port.id)) continue;
    parts.push(`<rect x="${a.x.toFixed(1)}" y="${a.y.toFixed(1)}" width="${a.w}" height="${a.h}" fill="${FILL}" stroke="${INK}" stroke-width="1.1"/>`);
    for (const l of a.port.labels ?? []) {
      parts.push(text(a.x + l.x + 2, a.y + l.y + 9.5, l.text, { size: 9.5, anchor: 'start', fill: MUTED }));
    }
  }

  // View frame with name tab, as used for SysML v2 views.
  const W = Math.ceil(res.width);
  const H = Math.ceil(res.height);
  if (d.title) {
    const tw = textWidth(d.title, 10.5) + 16;
    parts.unshift(
      `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${INK}" stroke-width="0.9"/>` +
        `<path d="M1,1 H${tw} V14 L${tw - 8},22 H1 Z" fill="${FILL}" stroke="${INK}" stroke-width="0.9"/>` +
        text(7, 15, d.title, { size: 10.5, anchor: 'start' }),
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">${MARKERS}<rect width="${W}" height="${H}" fill="#ffffff"/>${parts.join('')}</svg>`;
}
