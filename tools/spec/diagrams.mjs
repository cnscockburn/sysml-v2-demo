// Mermaid diagram generators. Each takes the Model plus an element and returns
// Mermaid source, or undefined when there is nothing worth drawing.

import {
  actionFlow,
  connectEnds,
  direction,
  initialState,
  isAbstract,
  isConjugated,
  multiplicity,
  stateBehaviours,
  transitionDetails,
} from './extract.mjs';

const id = (s) => 'n_' + String(s).replace(/[^A-Za-z0-9_]/g, '_');
const q = (s) => String(s ?? '').replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
const short = (t) => (t ?? '').replace(/^~/, '').split('::').pop();

const STYLE = {
  system: 'fill:#dbe8f6,stroke:#1f4e79,stroke-width:2px,color:#0b2545',
  part: 'fill:#ffffff,stroke:#1f4e79,stroke-width:1.2px,color:#0b2545',
  external: 'fill:#f3f3f3,stroke:#6b6b6b,stroke-width:1.2px,color:#333333,stroke-dasharray:4 3',
  action: 'fill:#ffffff,stroke:#2e6b4f,stroke-width:1.2px,color:#16382a',
  control: 'fill:#fff4d6,stroke:#a77b06,stroke-width:1.2px,color:#4d3800',
  terminal: 'fill:#16382a,stroke:#16382a,color:#ffffff',
};

const classDefs = (names) => names.map((n) => `  classDef ${n} ${STYLE[n]}`).join('\n');

/** Items carried by the port at the end of a connection path, as a label. */
function portItems(model, ctxDef, path) {
  const port = model.resolvePath(ctxDef, path);
  if (!port) return { label: '', bidirectional: false };
  const pdef = model.typeOf(port);
  if (!pdef) return { label: short(port.type), bidirectional: false };
  const items = model.members(pdef).filter((m) => ['item', 'attribute', 'port'].includes(m.kind));
  const dirs = new Set(items.map((i) => direction(model, i)).filter(Boolean));
  const types = [...new Set(items.map((i) => short(i.type) || i.name))];
  return { label: types.join(', '), bidirectional: dirs.has('in') && dirs.has('out'), port, conjugated: isConjugated(model, port) };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/** Internal block diagram of a definition: its parts and their connections. */
export function interconnectionDiagram(model, def, { externalTest = () => false, direction: dir } = {}) {
  const parts = model.members(def, 'part');
  const conns = [...model.children(def, 'connection'), ...model.children(def, 'interface')];
  if (parts.length === 0 || conns.length === 0) return undefined;

  // Large assemblies read better top-down on a portrait page.
  const lines = [`flowchart ${dir ?? (parts.length > 7 ? 'TB' : 'LR')}`];
  const used = new Set();
  const edges = new Map();
  for (const c of conns) {
    const ends = connectEnds(model, c);
    if (!ends) continue;
    const a = ends.from.split('.')[0];
    const b = ends.to.split('.')[0];
    const src = portItems(model, def, ends.from);
    const tgt = portItems(model, def, ends.to);
    const label = src.label || tgt.label;
    const key = `${a}|${b}|${label}`;
    const e = edges.get(key) ?? { a, b, label, n: 0, bi: src.bidirectional && c.kind === 'interface', iface: c.kind === 'interface' ? short(c.type) : undefined };
    e.n++;
    edges.set(key, e);
    used.add(a).add(b);
  }
  for (const p of parts) {
    const t = model.typeOf(p);
    const mult = multiplicity(model, p);
    const ext = externalTest(p, t);
    lines.push(`  ${id(p.name)}["<b>${q(p.name)}</b><br/>: ${q(short(p.type ?? t?.name))}${mult ? ` [${mult}]` : ''}"]:::${ext ? 'external' : 'part'}`);
  }
  for (const e of edges.values()) {
    const label = [e.iface ? `«${e.iface}»` : '', `${e.label}${e.n > 1 ? ` ×${e.n}` : ''}`]
      .filter(Boolean)
      .map(q)
      .join('<br/>');
    const arrow = e.bi ? '<-->' : '-->';
    lines.push(`  ${id(e.a)} ${arrow}${label ? `|"${label}"|` : ''} ${id(e.b)}`);
  }
  lines.push(classDefs(['part', 'external']));
  return lines.join('\n');
}

/** Part decomposition tree of a definition. */
export function decompositionDiagram(model, def, { depth = 3, maxChildren = 30, collapseAbove = 8 } = {}) {
  const lines = ['flowchart LR'];
  let count = 0;
  const visit = (nodeId, d, level, seen) => {
    if (!d || level >= depth || seen.has(d.symbolId)) return;
    const parts = model.members(d, 'part').slice(0, maxChildren);
    for (const p of parts) {
      const t = model.typeOf(p);
      const childId = `${nodeId}_${p.name}`;
      const mult = multiplicity(model, p);
      // Large groups (e.g. a sensor suite) become one node; their parts are tabulated.
      const n = t ? model.members(t, 'part').length : 0;
      const collapsed = n > collapseAbove;
      const note = collapsed ? `<br/><i>${n} parts, see table</i>` : '';
      lines.push(`  ${id(childId)}["<b>${q(p.name)}</b><br/>: ${q(short(p.type ?? t?.name))}${mult ? ` [${mult}]` : ''}${note}"]:::part`);
      lines.push(`  ${id(nodeId)} --- ${id(childId)}`);
      count++;
      if (!collapsed) visit(childId, t, level + 1, new Set([...seen, d.symbolId]));
    }
  };
  lines.push(`  ${id(def.name)}["<b>${q(def.name)}</b>"]:::system`);
  visit(def.name, def, 0, new Set());
  if (count === 0) return undefined;
  lines.push(classDefs(['system', 'part']));
  return lines.join('\n');
}

/** Specialization tree rooted at a definition, as a class diagram. */
export function taxonomyDiagram(model, root, { showFeatures } = {}) {
  const all = [root, ...model.specializations(root)];
  if (all.length < 2) return undefined;
  // Large hierarchies: names only, laid out left-to-right so leaves stack down the page.
  const large = all.length > 10;
  showFeatures ??= !large;
  const lines = ['classDiagram', `  direction ${large ? 'LR' : 'TB'}`];
  for (const d of all) {
    lines.push(`  class ${id(d.name)}["${q(d.name)}"]`);
    if (isAbstract(model, d)) lines.push(`  <<abstract>> ${id(d.name)}`);
    if (showFeatures) {
      for (const m of model.children(d).filter((c) => ['attribute', 'port', 'item'].includes(c.kind) && c.name)) {
        const t = short(m.type ?? m.specializes).replace(/[^\w]/g, '');
        const pre = m.kind === 'port' ? '~' : '+';
        lines.push(`  ${id(d.name)} : ${pre}${m.name} ${t}`);
      }
    }
  }
  for (const d of all.slice(1)) {
    const g = model.general(d);
    if (g) lines.push(`  ${id(g.name)} <|-- ${id(d.name)}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

/** Activity diagram of an action definition, with control flow and item flows. */
export function activityDiagram(model, def, { showFlows = true } = {}) {
  const flow = actionFlow(model, def);
  if (flow.edges.length === 0) return undefined;
  const lines = ['flowchart TD'];
  const inEdges = new Set(flow.edges.flatMap((e) => [e.from, e.to]));
  for (const n of flow.nodes) {
    if (!inEdges.has(n.name)) continue;
    if (n.kind === 'start') lines.push(`  ${id('start')}(("start")):::terminal`);
    else if (n.kind === 'done') lines.push(`  ${id('done')}((("done"))):::terminal`);
    else if (['decide', 'merge'].includes(n.kind)) lines.push(`  ${id(n.name)}{"${q(n.name)}"}:::control`);
    else if (['fork', 'join'].includes(n.kind)) lines.push(`  ${id(n.name)}[["${q(n.name)}"]]:::control`);
    else lines.push(`  ${id(n.name)}("<b>${q(n.name)}</b>${n.type ? `<br/>: ${q(short(n.type))}` : ''}"):::action`);
  }
  for (const e of flow.edges) {
    const label = e.guard ? `|"${q(e.guard === 'else' ? '[else]' : `[${e.guard}]`)}"|` : '';
    lines.push(`  ${id(e.from)} -->${label} ${id(e.to)}`);
  }
  if (showFlows) {
    for (const f of flow.flows) {
      const a = f.from.split('.');
      const b = f.to.split('.');
      if (a.length < 2 || b.length < 2) continue; // skip parameter-to-step bindings
      if (!inEdges.has(a[0]) || !inEdges.has(b[0])) continue;
      lines.push(`  ${id(a[0])} -.->|"${q(a[a.length - 1])}"| ${id(b[0])}`);
    }
  }
  lines.push(classDefs(['action', 'control', 'terminal']));
  return lines.join('\n');
}

/** State machine diagram of a state definition. */
export function stateDiagram(model, def) {
  const states = model.children(def, 'state');
  const transitions = model.children(def, 'transition');
  if (states.length === 0) return undefined;
  const lines = ['stateDiagram-v2', '  direction LR'];
  for (const s of states) {
    lines.push(`  state "${q(s.name)}" as ${id(s.name)}`);
    for (const b of stateBehaviours(model, s)) lines.push(`  ${id(s.name)} : ${b.when} / ${b.name}`);
  }
  const init = initialState(model, def);
  if (init) lines.push(`  [*] --> ${id(init)}`);
  for (const t of transitions) {
    if (!t.source || !t.target) continue;
    const { guard } = transitionDetails(model, t);
    const label = [t.trigger ? short(t.trigger) : '', guard ? `[${guard}]` : ''].filter(Boolean).join(' ');
    lines.push(`  ${id(t.source)} --> ${id(t.target)}${label ? ` : ${label.replace(/:/g, ' ')}` : ''}`);
  }
  return lines.join('\n');
}

/** Use case diagram for a set of use case definitions. */
export function useCaseDiagram(model, useCases, subjectLabel = 'System') {
  if (useCases.length === 0) return undefined;
  const lines = ['flowchart LR'];
  const actors = new Map();
  for (const uc of useCases) {
    for (const a of model.children(uc, 'actor')) actors.set(short(a.type) || a.name, true);
  }
  for (const a of actors.keys()) lines.push(`  ${id('actor_' + a)}(["👤 ${q(a)}"]):::external`);
  lines.push(`  subgraph boundary["${q(subjectLabel)}"]`);
  lines.push('    direction TB');
  for (const uc of useCases) lines.push(`    ${id(uc.name)}(["${q(uc.name)}"]):::action`);
  lines.push('  end');
  for (const uc of useCases) {
    for (const a of model.children(uc, 'actor')) lines.push(`  ${id('actor_' + (short(a.type) || a.name))} --- ${id(uc.name)}`);
    for (const inc of model.children(uc, 'include use case')) {
      const target = model.findDef(inc.type);
      if (target && useCases.includes(target)) lines.push(`  ${id(uc.name)} -.->|"«include»"| ${id(target.name)}`);
    }
  }
  lines.push(classDefs(['external', 'action']));
  lines.push('  style boundary fill:#f7fbff,stroke:#1f4e79,stroke-width:1.5px');
  return lines.join('\n');
}
