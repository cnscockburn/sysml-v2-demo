// SysML v2 diagram builders. Each returns a diagram description for
// sysml-svg.mjs (or undefined when there is nothing to draw). Element
// selection is generic: everything comes from the model's symbols.

import {
  actionFlow,
  connectEnds,
  initialState,
  isAbstract,
  isConjugated,
  multiplicity,
  stateBehaviours,
  transitionDetails,
} from './extract.mjs';

const short = (t) => (t ?? '').replace(/^~/, '').split('::').pop();

/** Usage label: [<id>] name : Type [mult]. */
function usageLabel(model, u, typeName) {
  const mult = multiplicity(model, u);
  const t = typeName ?? short(u.type ?? model.typeOf(u)?.name);
  return `${u.shortName ? `<${u.shortName}> ` : ''}${u.name}${t ? ` : ${t}` : ''}${mult ? ` [${mult}]` : ''}`;
}

const defBox = (model, d, extra = {}) => ({
  usage: false,
  keyword: d.kind,
  name: `${d.shortName ? `<${d.shortName}> ` : ''}${d.name}`,
  bold: true,
  italic: isAbstract(model, d),
  ...extra,
});

const usageBox = (model, u, keyword, extra = {}) => ({ usage: true, keyword, name: usageLabel(model, u), ...extra });

const featureLine = (m) => `${m.name} : ${short(m.type ?? m.specializes)}`;

// ---------------------------------------------------------------------------
// General view: part decomposition
// ---------------------------------------------------------------------------

export function decompositionDiagram(model, def, { depth = 3, collapseAbove = 8 } = {}) {
  // Each owner has one hidden port, so its composition lines share one diamond (tree style).
  const owner = (id, box) => ({ id, box, ports: [{ id: `${id}#own`, hidden: true, side: 'EAST' }] });
  const nodes = [owner('root', defBox(model, def))];
  const edges = [];
  const visit = (ownerId, d, level, seen) => {
    if (!d || level >= depth || seen.has(d.symbolId)) return;
    for (const p of model.members(d, 'part')) {
      const t = model.typeOf(p);
      const id = `${ownerId}.${p.name}`;
      const sub = t ? model.members(t, 'part') : [];
      const collapsed = sub.length > collapseAbove || (level === depth - 1 && sub.length > 0);
      const compartments = collapsed ? [{ title: 'parts', lines: sub.map((s) => usageLabel(model, s)) }] : [];
      const box = usageBox(model, p, 'part', { compartments });
      nodes.push(sub.length && !collapsed ? owner(id, box) : { id, box });
      edges.push({ id: `e${edges.length}`, from: `${ownerId}#own`, to: id, type: 'composition' });
      if (!collapsed) visit(id, t, level + 1, new Set([...seen, d.symbolId]));
    }
  };
  visit('root', def, 0, new Set());
  if (edges.length === 0) return undefined;
  return { title: `General View: decomposition of ${def.name}`, direction: 'RIGHT', nodes, edges };
}

// ---------------------------------------------------------------------------
// Interconnection view
// ---------------------------------------------------------------------------

/**
 * Interconnection view of a part definition: its parts as nested usages, with
 * the ports that take part in connections drawn on their owners' boundaries.
 */
export function interconnectionDiagram(model, def, { title, collapseAbove = 8, maxDepth = 1 } = {}) {
  const conns = [...model.children(def, 'connection'), ...model.children(def, 'interface')];
  const parts = model.members(def, 'part');
  if (!parts.length || !conns.length) return undefined;

  const root = { id: 'root', box: defBox(model, def), children: [], def };
  const byPath = new Map([['', root]]);

  const partNode = (path) => {
    if (byPath.has(path)) return byPath.get(path);
    const segs = path.split('.');
    const parent = partNode(segs.slice(0, -1).join('.'));
    const sym = model.members(parent.def).find((m) => m.name === segs[segs.length - 1]);
    const t = model.typeOf(sym);
    const sub = t ? model.members(t, 'part') : [];
    const compartments = sub.length > collapseAbove ? [{ title: 'parts', lines: sub.map((s) => usageLabel(model, s)) }] : [];
    const node = { id: `n:${path}`, box: usageBox(model, sym, 'part', { compartments }), children: [], ports: [], def: t };
    parent.children.push(node);
    byPath.set(path, node);
    return node;
  };
  for (const p of parts) partNode(p.name);

  // Resolve a connection end path to a node or port id, creating nested parts on the way.
  // Parts are not opened up beyond maxDepth levels, nor when they have many
  // sub-parts: connections to ports inside them end on a port on their boundary,
  // labelled with the inner path (or "*.port" when aggregated over many parts).
  const endpoint = (path) => {
    const segs = path.split('.');
    let ctx = root;
    let walked = '';
    for (let i = 0; i < segs.length; i++) {
      const many = ctx !== root && ctx.def && model.members(ctx.def, 'part').length > collapseAbove;
      const deep = i >= maxDepth;
      if ((many || deep) && i < segs.length - 1) {
        const last = segs[segs.length - 1];
        const owner = model.resolvePath(ctx.def, segs.slice(i, -1).join('.'));
        const port = owner && model.members(model.typeOf(owner) ?? {}).find((x) => x.name === last);
        const inner = many ? `*.${last}` : segs.slice(i).join('.');
        const id = `p:${walked}.${inner}`;
        // Long inner paths keep their last two segments; the connections table has the full path.
        const shown = inner.split('.').length > 2 ? `…${inner.split('.').slice(-2).join('.')}` : inner;
        if (!ctx.ports.some((p) => p.id === id)) {
          ctx.ports.push({ id, label: `${shown} : ${port && isConjugated(model, port) ? '~' : ''}${short(port?.type)}` });
        }
        return id;
      }
      const m = model.members(ctx.def).find((x) => x.name === segs[i]);
      if (!m) return undefined;
      if (m.kind === 'port') {
        const portPath = `${walked ? walked + '.' : ''}${segs[i]}`;
        const id = `p:${portPath}`;
        if (!ctx.ports.some((p) => p.id === id)) {
          ctx.ports.push({ id, label: `${m.name} : ${isConjugated(model, m) ? '~' : ''}${short(m.type)}` });
        }
        return id;
      }
      walked = walked ? `${walked}.${segs[i]}` : segs[i];
      ctx = partNode(walked);
    }
    return ctx.id;
  };

  const edges = [];
  const seen = new Map();
  for (const c of conns) {
    const ends = connectEnds(model, c);
    if (!ends) continue;
    const from = endpoint(ends.from);
    const to = endpoint(ends.to);
    if (!from || !to) continue;
    const key = `${from}|${to}`;
    if (seen.has(key)) {
      // Parallel connections between aggregated ports: one line, with a count.
      const e = seen.get(key);
      e.count = (e.count ?? 1) + 1;
      e.label = `${e.base ? `${e.base} ` : ''}×${e.count}`;
      continue;
    }
    const label = c.kind === 'interface' ? `${c.name ?? ''} : ${short(c.type)}` : c.name || undefined;
    const e = { id: `e${edges.length}`, from, to, type: 'connection', label, base: label };
    seen.set(key, e);
    edges.push(e);
  }
  for (const e of edges) delete e.base;
  const strip = (n) => {
    if (!n.children?.length) delete n.children;
    else n.children.forEach(strip);
    if (!n.ports?.length) delete n.ports;
  };
  strip(root);
  return { title: title ?? `Interconnection View: ${def.name}`, direction: 'RIGHT', flexibleDirection: true, nodes: [root], edges };
}

// ---------------------------------------------------------------------------
// General view: specialization hierarchy
// ---------------------------------------------------------------------------

export function taxonomyDiagram(model, root) {
  const all = [root, ...model.specializations(root)];
  if (all.length < 2) return undefined;
  const large = all.length > 10;
  const nodes = all.map((d) => {
    const feats = model.children(d).filter((c) => ['attribute', 'port', 'item'].includes(c.kind) && c.name);
    const compartments = large
      ? []
      : [
          { title: 'attributes', lines: feats.filter((f) => f.kind === 'attribute').map(featureLine) },
          { title: 'ports', lines: feats.filter((f) => f.kind === 'port').map(featureLine) },
          { title: 'items', lines: feats.filter((f) => f.kind === 'item').map(featureLine) },
        ].filter((c) => c.lines.length);
    return { id: `d:${d.name}`, box: defBox(model, d, { compartments }) };
  });
  const edges = all
    .slice(1)
    .map((d, i) => ({ id: `s${i}`, from: `d:${d.name}`, to: `d:${model.general(d)?.name}`, type: 'specialization' }))
    .filter((e) => all.some((d) => `d:${d.name}` === e.to));
  return { title: `General View: ${root.name} specializations`, direction: large ? 'LEFT' : 'UP', flexibleDirection: true, nodes, edges };
}

// ---------------------------------------------------------------------------
// Action flow view
// ---------------------------------------------------------------------------

export function activityDiagram(model, def) {
  const flow = actionFlow(model, def);
  if (flow.edges.length === 0) return undefined;
  const used = new Set(flow.edges.flatMap((e) => [e.from, e.to]));
  const container = { id: 'root', box: defBox(model, def), children: [], ports: [] };
  const nodeOf = new Map();
  for (const n of flow.nodes) {
    if (!used.has(n.name)) continue;
    let node;
    if (n.kind === 'start' || n.kind === 'done') node = { id: `a:${n.name}`, kind: n.kind };
    else if (n.kind === 'decide' || n.kind === 'merge') node = { id: `a:${n.name}`, kind: 'decision', label: n.name };
    else if (n.kind === 'fork' || n.kind === 'join') node = { id: `a:${n.name}`, kind: 'fork', label: n.name };
    else {
      const sym = model.children(def).find((c) => c.name === n.name);
      node = { id: `a:${n.name}`, box: { usage: true, keyword: 'action', name: sym ? usageLabel(model, sym) : n.name }, ports: [] };
    }
    container.children.push(node);
    nodeOf.set(n.name, node);
  }

  // Order nodes along the control flow (breadth-first from start), so the
  // layout follows execution order and loops render as back edges.
  const rank = new Map();
  const queue = ['start'];
  rank.set('start', 0);
  while (queue.length) {
    const cur = queue.shift();
    for (const e of flow.edges.filter((x) => x.from === cur)) {
      if (!rank.has(e.to)) {
        rank.set(e.to, rank.size);
        queue.push(e.to);
      }
    }
  }
  const r = (n) => (n.id === 'a:done' ? 1e9 : rank.get(n.id.slice(2)) ?? 1e8);
  container.children.sort((a, b) => r(a) - r(b));
  flow.edges.sort((a, b) => (rank.get(a.from) ?? 1e8) - (rank.get(b.from) ?? 1e8));

  const edges = flow.edges.map((e, i) => ({
    id: `s${i}`,
    from: `a:${e.from}`,
    to: `a:${e.to}`,
    type: 'succession',
    label: e.guard ? `[${e.guard}]` : undefined,
    // A succession back to an earlier step is a loop: lay it out reversed.
    back: e.to !== 'done' && (rank.get(e.to) ?? 1e8) <= (rank.get(e.from) ?? 0),
  }));
  const isBack = (from, to) => (rank.get(to) ?? 1e8) <= (rank.get(from) ?? 0);

  // Item flows connect parameters, drawn as small squares on the action boundaries.
  const paramPort = (path) => {
    const segs = path.split('.');
    if (segs.length === 1) {
      const id = `p:self.${segs[0]}`;
      if (!container.ports.some((p) => p.id === id)) container.ports.push({ id, label: segs[0] });
      return id;
    }
    const node = nodeOf.get(segs[0]);
    if (!node?.ports) return undefined;
    const id = `p:${path}`;
    if (!node.ports.some((p) => p.id === id)) node.ports.push({ id, label: segs[segs.length - 1] });
    return id;
  };
  flow.flows.forEach((f, i) => {
    const from = paramPort(f.from);
    const to = paramPort(f.to);
    const a = f.from.split('.')[0];
    const b = f.to.split('.')[0];
    if (from && to) edges.push({ id: `f${i}`, from, to, type: 'flow', back: a !== b && f.to.includes('.') && f.from.includes('.') && isBack(a, b) });
  });
  for (const n of container.children) if (!n.ports?.length) delete n.ports;
  if (!container.ports.length) delete container.ports;
  return { title: `Action Flow View: ${def.name}`, direction: 'DOWN', nodes: [container], edges };
}

// ---------------------------------------------------------------------------
// State transition view
// ---------------------------------------------------------------------------

export function stateDiagram(model, def) {
  const states = model.children(def, 'state');
  if (!states.length) return undefined;
  const container = { id: 'root', box: defBox(model, def), children: [] };
  for (const s of states) {
    const beh = stateBehaviours(model, s);
    const compartments = beh.length ? [{ title: 'state actions', lines: beh.map((b) => ({ kw: b.when, text: b.type ? `${b.name} : ${short(b.type)}` : b.name })) }] : [];
    container.children.push({ id: `s:${s.name}`, box: { usage: true, keyword: 'state', name: s.name, compartments } });
  }
  const edges = [];
  const init = initialState(model, def);
  if (init) {
    container.children.unshift({ id: 'initial', kind: 'initial' });
    edges.push({ id: 'init', from: 'initial', to: `s:${init}`, type: 'transition' });
  }
  // Rank states breadth-first from the initial state; transitions back to an
  // earlier state are laid out as loops so the machine reads in order.
  const transitions = model.children(def, 'transition').filter((t) => t.source && t.target);
  const rank = new Map();
  const queue = init ? [init] : [];
  if (init) rank.set(init, 0);
  while (queue.length) {
    const cur = queue.shift();
    for (const t of transitions.filter((x) => x.source === cur)) {
      if (!rank.has(t.target)) {
        rank.set(t.target, rank.size);
        queue.push(t.target);
      }
    }
  }
  const r = (n) => (n.id === 'initial' ? -1 : rank.get(n.id.slice(2)) ?? 1e8);
  container.children.sort((a, b) => r(a) - r(b));
  for (const t of transitions) {
    const det = transitionDetails(model, t);
    const label = [t.trigger ? short(t.trigger) : '', det.guard ? `[${det.guard}]` : '', det.effect ? `/ ${det.effect}` : ''].filter(Boolean).join(' ');
    edges.push({
      id: `t:${t.name}`,
      from: `s:${t.source}`,
      to: `s:${t.target}`,
      type: 'transition',
      label: label || undefined,
      back: (rank.get(t.target) ?? 1e8) <= (rank.get(t.source) ?? 0),
    });
  }
  return { title: `State Transition View: ${def.name}`, direction: 'DOWN', nodes: [container], edges };
}

// ---------------------------------------------------------------------------
// Use case view
// ---------------------------------------------------------------------------

export function useCaseDiagram(model, useCases) {
  if (!useCases.length) return undefined;
  const nodes = [];
  const edges = [];
  const included = new Set(useCases.flatMap((u) => model.children(u, 'include use case').map((i) => model.findDef(i.type))));

  // Subject: shared by the use cases; linked to the top-level ones.
  const subj = useCases.map((u) => model.children(u, 'subject')[0]).find(Boolean);
  if (subj) nodes.push({ id: 'subject', box: { usage: true, keyword: 'subject', name: usageLabel(model, subj) } });

  for (const u of useCases) {
    nodes.push({ id: `u:${u.name}`, box: defBox(model, u) });
    if (subj && !included.has(u)) edges.push({ id: `sub:${u.name}`, from: 'subject', to: `u:${u.name}`, type: 'association' });
  }
  const actors = new Map();
  for (const u of useCases) {
    for (const a of model.children(u, 'actor')) {
      const key = short(a.type) || a.name;
      if (!actors.has(key)) {
        actors.set(key, true);
        nodes.push({ id: `act:${key}`, kind: 'actor', caption: usageLabel(model, a) });
      }
      edges.push({ id: `a:${u.name}:${a.name}`, from: `act:${key}`, to: `u:${u.name}`, type: 'association' });
    }
    for (const inc of model.children(u, 'include use case')) {
      const target = model.findDef(inc.type);
      if (target && useCases.includes(target)) {
        edges.push({ id: `i:${u.name}:${inc.name}`, from: `u:${u.name}`, to: `u:${target.name}`, type: 'include', label: '«include»' });
      }
    }
  }
  return { title: 'Use Case View: use cases and actors', direction: 'RIGHT', flexibleDirection: true, nodes, edges };
}
