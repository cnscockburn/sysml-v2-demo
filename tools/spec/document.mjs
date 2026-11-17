// Builds the System Design Specification as HTML from the Model. Element
// selection is generic (by kind, folder and relationship), so the document
// follows the model as it changes. Narrative comes from the model's `doc`
// comments; the generator adds only section framing.

import {
  boundValue,
  cleanDoc,
  compare,
  connectEnds,
  constraintExpression,
  direction,
  flowEnds,
  initialState,
  isAbstract,
  isConjugated,
  lineNote,
  multiplicity,
  objectiveDoc,
  parseValue,
  passIf,
  requireConstraints,
  assumeConstraints,
  returnExpression,
  satisfyLinks,
  simpleComparison,
  stateBehaviours,
  subjectBinding,
  transitionDetails,
  verifiedPaths,
  actionFlow,
} from './extract.mjs';
import {
  activityDiagram,
  decompositionDiagram,
  interconnectionDiagram,
  stateDiagram,
  taxonomyDiagram,
  useCaseDiagram,
} from './diagrams.mjs';
import { renderDiagram } from './sysml-svg.mjs';

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = (s) => (s ? `<code>${esc(s)}</code>` : '');
const short = (t) => (t ?? '').replace(/^~/, '').split('::').pop();
const firstSentence = (d) => {
  const t = (d ?? '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : t;
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pretty = (expr) =>
  esc(expr).replace(/&lt;=/g, '≤').replace(/&gt;=/g, '≥').replace(/!=/g, '≠').replace(/==/g, '=');

/** "AutonomousVoyageRequirement" -> "Autonomous voyage requirement". */
export function humanize(name) {
  const words = String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : /^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

/** Render a doc comment: paragraphs, bullet lists and preformatted blocks. */
export function docHtml(text) {
  const d = cleanDoc(text);
  if (!d) return '';
  return d
    .split(/\n\s*\n/)
    .map((para) => {
      const lines = para.split('\n');
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      if (lines.length > 1 && lines.some((l) => /^\s{2,}\S/.test(l) || /\S\s{3,}\S/.test(l))) {
        return `<pre class="docblock">${esc(para)}</pre>`;
      }
      return `<p>${esc(lines.map((l) => l.trim()).join(' '))}</p>`;
    })
    .join('\n');
}

class DocBuilder {
  constructor() {
    this.out = [];
    this.toc = [];
    this.counters = [0, 0, 0, 0, 0];
    this.appendix = false;
    this.fig = 0;
    this.tab = 0;
    this.figures = [];
  }

  add(html) {
    if (html) this.out.push(html);
  }

  heading(level, title, anchor) {
    const c = this.counters;
    c[level - 1]++;
    for (let i = level; i < c.length; i++) c[i] = 0;
    const first = this.appendix ? String.fromCharCode(64 + c[0]) : String(c[0]);
    const num = [first, ...c.slice(1, level)].join('.');
    const label = level === 1 && this.appendix ? `Appendix ${num}` : num;
    const hid = anchor ?? `s-${slug(num)}-${slug(title)}`;
    if (level <= 2) this.toc.push({ level, num: label, title, id: hid });
    this.add(`<h${level} id="${hid}"${level === 1 ? ` data-title="${esc(title)}"` : ''}><span class="num">${esc(label)}</span> ${esc(title)}</h${level}>`);
    return hid;
  }

  startAppendices() {
    this.appendix = true;
    this.counters = [0, 0, 0, 0, 0];
  }

  p(html) {
    if (html) this.add(`<p>${html}</p>`);
  }

  /** Queue a SysML v2 diagram description; it is rendered to SVG in html(). */
  figure(spec, caption, { wide = false } = {}) {
    if (!spec) return;
    const n = ++this.fig;
    this.figures.push(spec);
    const fig = `<figure class="diagram${wide ? ' wide' : ''}"><!--FIGURE:${this.figures.length - 1}--><figcaption><b>Figure ${n}.</b> ${esc(caption)}</figcaption></figure>`;
    this.add(fig);
  }

  table(headers, rows, caption, { cls = '', widths } = {}) {
    if (!rows.length) return;
    const n = ++this.tab;
    // Widths go on every cell so a table split across pages keeps its columns.
    const w = (i) => (widths?.[i] ? ` style="width:${widths[i]}"` : '');
    this.add(
      (caption ? `<p class="caption"><b>Table ${n}.</b> ${esc(caption)}</p>` : '') +
        `<table class="${cls}"><thead><tr>${headers.map((h, i) => `<th${w(i)}>${esc(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${w(i)}>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    );
  }

  kv(pairs) {
    const rows = pairs.filter(([, v]) => v);
    if (!rows.length) return;
    this.add(`<table class="kv"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</tbody></table>`);
  }

  /** Final HTML with every queued diagram rendered to inline SysML v2 SVG. */
  async html() {
    // Structural diagrams may be laid out either way; keep the direction whose
    // drawing fits an A4 portrait text block (≈174 × 215 mm) at the larger scale.
    const fit = (svg) => {
      const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
      return Math.min(1, 640 / w, 800 / h);
    };
    const ALT = { RIGHT: 'DOWN', DOWN: 'RIGHT', LEFT: 'UP', UP: 'LEFT' };
    const svgs = [];
    for (const spec of this.figures) {
      let svg = await renderDiagram(spec);
      if (spec.flexibleDirection && fit(svg) < 1) {
        const alt = await renderDiagram({ ...spec, direction: ALT[spec.direction ?? 'RIGHT'] });
        if (fit(alt) > fit(svg) * 1.15) svg = alt;
      }
      svgs.push(svg);
    }
    return this.out.join('\n').replace(/<!--FIGURE:(\d+)-->/g, (_, i) => svgs[Number(i)]);
  }
}

// ---------------------------------------------------------------------------
// Model analysis shared by the sections
// ---------------------------------------------------------------------------

function analyse(model, config) {
  const root = model.packages().find((p) => model.folder(p) === '') ?? model.packages()[0];
  const inFolder = (s, f) => model.folder(s) === f;

  // System of interest: the most common requirement subject type.
  const reqDefs = model.ofKind('requirement def');
  const subjectCounts = new Map();
  for (const r of reqDefs) {
    const s = model.children(r, 'subject')[0];
    const t = s && model.typeOf(s);
    if (t) subjectCounts.set(t, (subjectCounts.get(t) ?? 0) + 1);
  }
  let system = [...subjectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (config.systemDefinition) system = model.findDef(config.systemDefinition) ?? system;
  if (!system) {
    system = model
      .ofKind('part def')
      .filter((d) => inFolder(d, 'structure'))
      .sort((a, b) => model.children(b, 'part').length - model.children(a, 'part').length)[0];
  }

  // Configurations: top-level part usages in configurations/.
  const configurations = model.ofKind('part').filter((p) => inFolder(p, 'configurations') && model.parent(p)?.kind === 'package');

  // Instance paths of the system inside each configuration (e.g. massOperation.ship).
  const systemInstances = [];
  for (const c of configurations) {
    const ct = model.typeOf(c);
    if (ct === system) systemInstances.push(c.name);
    for (const m of ct ? model.members(ct, 'part') : []) if (model.typeOf(m) === system) systemInstances.push(`${c.name}.${m.name}`);
  }

  // Bound values in configurations, keyed by dotted path from the configuration usage.
  const designValues = new Map();
  const collect = (s, path) => {
    for (const c of model.children(s)) {
      if (!c.name) continue;
      const p = `${path}.${c.name}`;
      const v = boundValue(model, c);
      if (v !== undefined && !['part', 'item', 'port'].includes(c.kind)) designValues.set(p, { value: v, note: lineNote(model, c), symbol: c });
      collect(c, p);
    }
  };
  for (const c of configurations) collect(c, c.name);

  // Requirement specifications: requirement usages that group requirement usages.
  const reqUsages = model.ofKind('requirement');
  const specs = reqUsages.filter((r) => model.parent(r)?.kind === 'package');
  const usagesOfDef = new Map(); // def -> [usage]
  for (const u of reqUsages) {
    const d = model.typeOf(u);
    if (d && / def$/.test(d.kind)) {
      if (!usagesOfDef.has(d)) usagesOfDef.set(d, []);
      usagesOfDef.get(d).push(u);
    }
  }
  const usagePath = (u) => {
    const parts = [];
    for (let s = u; s && s.kind !== 'package'; s = model.parent(s)) parts.unshift(s.name);
    return parts.join('.');
  };
  const nestedReqs = (u) => [u, ...model.children(u, 'requirement').flatMap(nestedReqs)];

  // Parameter values bound on requirement usages.
  const paramValue = (usage, param) => {
    const own = model.children(usage).find((c) => c.name === param || c.specializes === param);
    if (own) {
      const v = boundValue(model, own);
      if (v !== undefined) return { value: v, note: lineNote(model, own) };
    }
    const def = model.typeOf(usage);
    const attr = def && model.members(def).find((m) => m.name === param);
    const v = attr && boundValue(model, attr);
    return v !== undefined ? { value: v } : undefined;
  };

  // Satisfy links: requirement def -> Set of satisfier paths.
  const satisfiedBy = new Map();
  const addSat = (def, by) => {
    if (!satisfiedBy.has(def)) satisfiedBy.set(def, new Set());
    satisfiedBy.get(def).add(by);
  };
  for (const link of satisfyLinks(model)) {
    const u = model.resolveUsagePath(link.requirement.replace(/::/g, '.')) ?? model.findDef(link.requirement);
    if (!u) continue;
    if (/ def$/.test(u.kind)) addSat(u, link.by);
    else for (const n of nestedReqs(u)) { const d = model.typeOf(n); if (d && / def$/.test(d.kind)) addSat(d, link.by); }
  }

  // Verify links: requirement def -> Set of verification case defs.
  const verifiedBy = new Map();
  const verificationDefs = model.ofKind('verification case def');
  for (const v of verificationDefs) {
    for (const path of verifiedPaths(model, v)) {
      const u = model.resolveUsagePath(path.replace(/::/g, '.')) ?? model.findDef(path);
      if (!u) continue;
      const targets = / def$/.test(u.kind) ? [u] : nestedReqs(u).map((n) => model.typeOf(n)).filter((d) => d && / def$/.test(d.kind));
      for (const d of targets) {
        if (!verifiedBy.has(d)) verifiedBy.set(d, new Set());
        verifiedBy.get(d).add(v);
      }
    }
  }

  // Functional allocation: `perform x.y` inside part usages of the system.
  const allocations = []; // { functionPath, part (path), symbol }
  const walkParts = (def, path, depth) => {
    if (!def || depth > 6) return;
    for (const p of model.members(def, 'part')) {
      const ppath = path ? `${path}.${p.name}` : p.name;
      for (const pa of model.children(p, 'perform action')) {
        const m = model.text(pa, { clean: true }).match(/perform\s+(?:action\s+)?([\w.]+)/);
        allocations.push({ functionPath: m && m[1] !== pa.name ? m[1] : pa.name, part: ppath, symbol: pa });
      }
      walkParts(model.typeOf(p), ppath, depth + 1);
    }
  };
  walkParts(system, '', 0);
  for (const pa of model.children(system, 'perform action')) allocations.push({ functionPath: pa.name, part: system.name, symbol: pa, top: true });

  const reqId = (d) => d.shortName ?? d.name;
  return {
    root, system, configurations, systemInstances, designValues, specs, usagesOfDef, usagePath, nestedReqs,
    paramValue, satisfiedBy, verifiedBy, verificationDefs, allocations, reqDefs, reqId, inFolder,
  };
}

// ---------------------------------------------------------------------------
// Reusable element descriptions
// ---------------------------------------------------------------------------

function attributeRows(model, A, def, instancePath) {
  return model.members(def, ['attribute', 'ref']).filter((a) => a.name).map((a) => {
    const dv = instancePath && A.designValues.get(`${instancePath}.${a.name}`);
    const own = boundValue(model, a);
    const value = dv?.value ?? own;
    return [code(a.name), esc(short(a.type ?? a.specializes)), value ? code(value) : '<span class="muted">—</span>'];
  });
}

function portRows(model, def) {
  return model.members(def, 'port').map((p) => {
    const pdef = model.typeOf(p);
    const conj = isConjugated(model, p);
    const items = pdef
      ? model.members(pdef).filter((m) => ['item', 'attribute'].includes(m.kind)).map((m) => {
          let dir = direction(model, m) ?? '';
          if (conj && dir) dir = dir === 'in' ? 'out' : dir === 'out' ? 'in' : dir;
          return `${dir ? `<span class="dir">${dir}</span> ` : ''}${esc(short(m.type) || m.name)}`;
        })
      : [];
    return [code(p.name), `${conj ? '~' : ''}${esc(short(p.type))}`, items.join('<br/>')];
  });
}

function describePart(doc, model, A, usage, def, path, level) {
  const instance = A.systemInstances[0] ? `${A.systemInstances[0]}.${path}` : undefined;
  const title = `${usage.name} : ${def?.name ?? short(usage.type)}`;
  doc.heading(level, humanize(usage.name), `part-${slug(path)}`);
  doc.add(`<p class="element">${code(title)}${multiplicity(model, usage) ? ` [${esc(multiplicity(model, usage))}]` : ''}</p>`);
  doc.add(docHtml(usage.documentation));
  doc.add(docHtml(def?.documentation));
  if (!def) return;

  const g = model.general(def);
  if (g) doc.p(`Specializes ${code(g.name)}: ${esc(firstSentence(g.documentation))}`);

  const attrs = attributeRows(model, A, def, instance);
  if (attrs.length) doc.table(['Characteristic', 'Type', 'Value'], attrs, `Characteristics of ${usage.name}`, { cls: 'compact', widths: ['35%', '35%', '30%'] });
  const ports = portRows(model, def);
  if (ports.length) doc.table(['Port', 'Port definition', 'Items (direction)'], ports, `Ports of ${usage.name}`, { cls: 'compact', widths: ['25%', '35%', '40%'] });

  const funcs = A.allocations.filter((a) => a.part === path);
  if (funcs.length) doc.p(`<b>Functions performed:</b> ${funcs.map((f) => code(f.functionPath)).join(', ')}.`);
  const states = model.members(def, 'exhibit state');
  if (states.length) doc.p(`<b>Exhibits state machine:</b> ${states.map((s) => `${code(s.name)} : ${esc(short(s.type))}`).join(', ')}.`);

  const parts = model.members(def, 'part');
  if (!parts.length) return;
  if (model.children(def, ['connection', 'interface']).length) {
    doc.figure(interconnectionDiagram(model, def), `Internal structure of ${def.name}`, { wide: parts.length > 6 });
  }
  if (parts.length > 6 || level >= 4) {
    doc.table(
      ['Part', 'Definition', 'Mult.', 'Description'],
      parts.map((p) => {
        const t = model.typeOf(p);
        return [code(p.name), esc(short(p.type ?? t?.name)), esc(multiplicity(model, p) ?? '1'), esc(firstSentence(t?.documentation))];
      }),
      `Parts of ${usage.name}`,
      { cls: 'compact', widths: ['20%', '24%', '8%', '48%'] },
    );
  } else {
    for (const p of parts) describePart(doc, model, A, p, model.typeOf(p), `${path}.${p.name}`, level + 1);
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function introduction(doc, model, A, meta) {
  doc.heading(1, 'Introduction');
  doc.heading(2, 'Purpose');
  doc.p(
    `This System Design Specification (SDS) describes the design of the ${esc(meta.title)}: its operational context, ` +
      `requirements, architecture, interfaces, behaviour, verification approach and reference configuration.`,
  );
  doc.p(
    `The document is generated from the SysML v2 model in ${code(model.modelDir + '/')}. Every table, diagram and description ` +
      `is derived from model elements, and the narrative text is taken from the model's documentation comments. ` +
      `To change this document, change the model and regenerate it.`,
  );
  doc.heading(2, 'System overview');
  doc.add(docHtml(A.root?.documentation));
  doc.heading(2, 'Document structure');
  doc.add(`<ul>
    <li><b>Operational concept</b>: the system in its operating context and its use cases.</li>
    <li><b>Requirements</b>: the requirement set with acceptance criteria and parameter values.</li>
    <li><b>System architecture</b>: decomposition, internal interconnection and subsystem descriptions.</li>
    <li><b>Interfaces</b>: ports, interfaces, exchanged items, value types and enumerations.</li>
    <li><b>Behaviour</b>: functional flows, functional allocation, state machines and calculations.</li>
    <li><b>Verification</b>: verification cases, analysis cases and the traceability matrix.</li>
    <li><b>Reference configuration</b>: design values and the requirement compliance check.</li>
  </ul>`);
  doc.heading(2, 'Model organisation');
  const pkgs = model.packages().sort((a, b) => model.rel(a).localeCompare(model.rel(b)));
  doc.table(
    ['Package', 'File', 'Contents'],
    pkgs.map((p) => [code(p.name), esc(model.rel(p)), esc(firstSentence(p.documentation))]),
    'Model packages',
    { cls: 'compact', widths: ['24%', '36%', '40%'] },
  );
  doc.heading(2, 'Diagram notation');
  doc.p(
    'All diagrams use the SysML v2 standard graphical notation and are framed as the standard views ' +
      '(General, Interconnection, Action Flow, State Transition and Use Case views), with the view name in the frame tab.',
  );
  doc.add(`<ul>
    <li><b>Definitions</b> are square-cornered boxes headed <code>«kind def» Name</code> (italic if abstract). <b>Usages</b> are round-cornered boxes headed <code>«kind» name : Definition [multiplicity]</code>.</li>
    <li>Compartments (<i>parts</i>, <i>attributes</i>, <i>state actions</i>) list features beneath the header.</li>
    <li><b>Composition</b> is a line with a filled diamond at the owner. <b>Specialization</b> is a line with a hollow triangle at the general definition.</li>
    <li><b>Ports</b> are small squares on the owner's boundary, labelled <code>name : PortDef</code>; <code>~PortDef</code> is the conjugate. Connections are solid lines between ports, labelled <code>name : InterfaceDef</code> for interfaces. A part with many sub-parts is shown closed, with one aggregated port <code>*.port</code> and a <code>×n</code> count.</li>
    <li><b>Action flow</b>: a filled circle is <i>start</i>, a bullseye is <i>done</i>, a diamond is a decision or merge. Dashed open arrows are successions (guards in brackets); solid open arrows between parameter squares are item flows.</li>
    <li><b>State transition</b>: the filled circle marks the initial state; transitions are labelled <code>trigger [guard] / effect</code>.</li>
    <li><b>Use cases</b>: actors are stick figures; <code>«include»</code> arrows point to included use cases.</li>
  </ul>`);
}

function operationalConcept(doc, model, A) {
  doc.heading(1, 'Operational concept');
  for (const c of A.configurations) {
    const ct = model.typeOf(c);
    if (!ct || ct === A.system) continue;
    doc.heading(2, `Operational context: ${humanize(ct.name)}`);
    doc.add(docHtml(ct.documentation));
    doc.add(docHtml(c.documentation));
    doc.figure(interconnectionDiagram(model, ct), `Operational context (${ct.name})`, { wide: true });
    doc.table(
      ['Participant', 'Definition', 'Mult.', 'Role'],
      model.members(ct, 'part').map((p) => {
        const t = model.typeOf(p);
        return [code(p.name), esc(short(p.type)), esc(multiplicity(model, p) ?? '1'), esc(firstSentence(t?.documentation))];
      }),
      'Participants in the operational context',
      { cls: 'compact', widths: ['20%', '22%', '8%', '50%'] },
    );
    const links = model.children(ct, ['connection', 'interface']).map((l) => {
      const e = connectEnds(model, l);
      const it = l.type ? model.findDef(l.type) : undefined;
      const flows = it ? model.children(it, 'flow').map((f) => short(flowEnds(model, f)?.itemType)).filter(Boolean) : [];
      return [code(e?.from), code(e?.to), esc(l.kind === 'interface' ? short(l.type) : 'connection'), esc(flows.join(', ') || firstSentence(it?.documentation))];
    });
    doc.table(['From', 'To', 'Link', 'Exchange'], links, 'External links', { cls: 'compact' });
  }

  const ucs = model.ofKind('use case def');
  if (ucs.length) {
    doc.heading(2, 'Use cases');
    doc.p(`The ${esc(A.system?.name ?? 'system')} supports ${ucs.length} use cases.`);
    doc.figure(useCaseDiagram(model, ucs, A.system?.name), 'Use cases and actors');
    doc.table(
      ['Use case', 'Description', 'Actors', 'Objective', 'Includes'],
      ucs.map((u) => [
        `<b>${esc(humanize(u.name))}</b><br/>${code(u.name)}`,
        esc(u.documentation),
        model.children(u, 'actor').map((a) => esc(short(a.type))).join('<br/>'),
        esc(objectiveDoc(model, u)),
        model.children(u, 'include use case').map((i) => esc(short(i.type))).join('<br/>'),
      ]),
      'Use case summary',
      { cls: 'compact', widths: ['17%', '27%', '16%', '25%', '15%'] },
    );
  }
}

function requirementCriterion(model, A, def, usage) {
  const subjectName = model.children(def, 'subject')[0]?.name ?? 'subject';
  const parts = [];
  for (const c of assumeConstraints(model, def)) parts.push(`<span class="muted">assume</span> ${pretty(c)}`);
  for (const c of requireConstraints(model, def)) {
    let s = pretty(c);
    const cmp = simpleComparison(c, subjectName);
    if (cmp && usage) {
      const pv = A.paramValue(usage, cmp.param);
      if (pv) s += ` <span class="muted">where</span> ${code(cmp.param)} = ${code(pv.value)}`;
    }
    parts.push(s);
  }
  return parts.join('<br/>');
}

function requirementsSection(doc, model, A) {
  doc.heading(1, 'Requirements');
  const reqPkgs = model.packages().filter((p) => A.inFolder(p, 'requirements'));
  for (const p of reqPkgs) doc.add(docHtml(p.documentation));
  for (const s of A.specs) {
    doc.add(`<div class="note"><b>${esc(humanize(s.name))}</b> (${code(s.name)}): ${esc(cleanDoc(s.documentation)).replace(/\n/g, ' ')}</div>`);
  }
  doc.p(
    `Each requirement has an identifier, a "shall" statement and, where measurable, an acceptance criterion written as a ` +
      `constraint on the subject. Threshold parameters are bound in the specification usage.`,
  );

  const groups = new Map();
  for (const d of A.reqDefs) {
    const g = (d.shortName ?? 'OTHER').split('-')[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(d);
  }
  doc.heading(2, 'Requirement set');
  for (const [g, defs] of groups) {
    doc.table(
      ['ID', 'Requirement', 'Statement', 'Acceptance criterion'],
      defs.map((d) => {
        const usage = A.usagesOfDef.get(d)?.[0];
        return [
          `<b>${esc(A.reqId(d))}</b>`,
          `${esc(humanize(d.name.replace(/Requirement$/, '')))}`,
          esc(cleanDoc(d.documentation)).replace(/\n/g, ' '),
          requirementCriterion(model, A, d, usage) || '<span class="muted">Qualitative: verified by inspection, demonstration or test.</span>',
        ];
      }),
      `${g} requirements`,
      { cls: 'reqs', widths: ['9%', '17%', '42%', '32%'] },
    );
  }

  const paramRows = [];
  for (const spec of A.specs) {
    for (const u of A.nestedReqs(spec).slice(1)) {
      const d = model.typeOf(u);
      for (const c of model.children(u)) {
        const v = boundValue(model, c);
        if (v === undefined) continue;
        paramRows.push([esc(d ? A.reqId(d) : ''), code(A.usagePath(u)), code(c.name || c.specializes), code(v), esc(lineNote(model, c) ?? '')]);
      }
    }
  }
  if (paramRows.length) {
    doc.heading(2, 'Specification parameters');
    doc.table(['ID', 'Requirement usage', 'Parameter', 'Value', 'Note'], paramRows, 'Requirement threshold values', { cls: 'compact', widths: ['10%', '38%', '22%', '14%', '16%'] });
  }
}

function architectureSection(doc, model, A) {
  const sys = A.system;
  doc.heading(1, 'System architecture');
  if (!sys) {
    doc.p('No system definition was found in the model.');
    return;
  }
  doc.heading(2, `System definition: ${sys.name}`);
  doc.add(docHtml(sys.documentation));
  const inst = A.systemInstances[0];
  const attrs = attributeRows(model, A, sys, inst);
  if (attrs.length) {
    doc.table(['Characteristic', 'Type', inst ? `Value (${inst})` : 'Value'], attrs, `System characteristics of ${sys.name}`, { cls: 'compact', widths: ['40%', '30%', '30%'] });
  }
  const perf = model.children(sys, 'perform action');
  if (perf.length) doc.p(`<b>Top-level functions:</b> ${perf.map((p) => `${code(p.name)} : ${esc(short(p.type))}`).join(', ')}.`);
  const states = model.members(sys, 'exhibit state');
  if (states.length) doc.p(`<b>State machines:</b> ${states.map((s) => `${code(s.name)} : ${esc(short(s.type))}`).join(', ')}.`);

  doc.heading(2, 'Decomposition');
  doc.p(`The ${esc(sys.name)} breaks down into ${model.members(sys, 'part').length} top-level subsystems. Figure ${doc.fig + 1} shows the part hierarchy to three levels.`);
  doc.figure(decompositionDiagram(model, sys, { depth: 3 }), `Part decomposition of ${sys.name}`, { wide: true });

  const conns = model.children(sys, ['connection', 'interface']);
  if (conns.length) {
    doc.heading(2, 'Internal interconnection');
    doc.p(`Figure ${doc.fig + 1} shows how the subsystems connect through their ports. Parallel connections between the same subsystems are merged.`);
    doc.figure(interconnectionDiagram(model, sys), `Internal interconnection of ${sys.name}`, { wide: true });
    doc.table(
      ['From (port)', 'To (port)', 'Items'],
      conns.map((c) => {
        const e = connectEnds(model, c);
        const port = e && model.resolvePath(sys, e.from);
        const pdef = port && model.typeOf(port);
        const items = pdef ? model.members(pdef).filter((m) => m.kind === 'item').map((m) => short(m.type)) : [];
        return [code(e?.from), code(e?.to), esc([...new Set(items)].join(', '))];
      }),
      `Connections within ${sys.name}`,
      { cls: 'compact small', widths: ['40%', '40%', '20%'] },
    );
  }

  doc.heading(2, 'Subsystems');
  for (const p of model.members(sys, 'part')) describePart(doc, model, A, p, model.typeOf(p), p.name, 3);

  const roots = model
    .ofKind('part def')
    .filter((d) => A.inFolder(d, 'structure') && !model.general(d) && model.specializations(d).length >= 3);
  if (roots.length) {
    doc.heading(2, 'Definition taxonomies');
    for (const r of roots) {
      doc.add(docHtml(r.documentation));
      const all = [r, ...model.specializations(r)];
      doc.figure(taxonomyDiagram(model, r), `Specialization hierarchy of ${r.name}`, { wide: all.length > 8 });
      doc.table(
        ['Definition', 'Specializes', 'Description'],
        all.map((d) => [`${code(d.name)}${isAbstract(model, d) ? ' <span class="muted">(abstract)</span>' : ''}`, esc(short(d.specializes)), esc(cleanDoc(d.documentation)).replace(/\n/g, ' ')]),
        `${r.name} definitions`,
        { cls: 'compact', widths: ['26%', '20%', '54%'] },
      );
    }
  }
}

function interfacesSection(doc, model, A) {
  doc.heading(1, 'Interfaces');
  const portDefs = model.ofKind('port def');
  if (portDefs.length) {
    doc.heading(2, 'Port definitions');
    doc.p('Port directions are given from the providing side. A receiving port uses the conjugate (<code>~Port</code>), which reverses every direction.');
    doc.table(
      ['Port definition', 'Out', 'In', 'Description'],
      portDefs.map((p) => {
        const items = model.children(p).filter((m) => ['item', 'attribute'].includes(m.kind));
        const by = (d) => items.filter((m) => direction(model, m) === d || direction(model, m) === 'inout').map((m) => `${esc(m.name)} : ${esc(short(m.type))}`).join('<br/>');
        return [code(p.name), by('out'), by('in'), esc(cleanDoc(p.documentation))];
      }),
      'Port definitions',
      { cls: 'compact', widths: ['22%', '24%', '22%', '32%'] },
    );
  }
  const ifDefs = model.ofKind('interface def');
  if (ifDefs.length) {
    doc.heading(2, 'Interface definitions');
    doc.table(
      ['Interface', 'Ends', 'Flows', 'Description'],
      ifDefs.map((i) => {
        const ends = [...model.text(i, { clean: true }).matchAll(/\bend\s+(?:port\s+|part\s+|item\s+)?(\w+)\s*:\s*(~?)([\w:]+)/g)].map((m) => ({ name: m[1], conj: m[2] === '~', type: m[3] }));
        const flows = model.children(i, 'flow').map((f) => flowEnds(model, f)).filter(Boolean);
        return [
          code(i.name),
          ends.map((e) => `${esc(e.name)} : ${e.conj ? '~' : ''}${esc(short(e.type))}`).join('<br/>'),
          flows.map((f) => `${esc(short(f.itemType))}: ${esc(f.from)} → ${esc(f.to)}`).join('<br/>'),
          esc(cleanDoc(i.documentation)),
        ];
      }),
      'Interface definitions',
      { cls: 'compact', widths: ['20%', '25%', '30%', '25%'] },
    );
  }

  const folderRank = (d) => ({ structure: 0, behaviour: 1 })[model.folder(d)] ?? 2;
  const items = model
    .ofKind('item def')
    .map((d, i) => [d, i])
    .sort((a, b) => folderRank(a[0]) - folderRank(b[0]) || a[1] - b[1])
    .map(([d]) => d);
  if (items.length) {
    doc.heading(2, 'Items and signals');
    doc.p('Items are the things that flow through ports and between actions: data, commands, physical effort and signals.');
    const roots = items.filter((d) => !model.general(d) && model.specializations(d).length >= 3);
    for (const r of roots) doc.figure(taxonomyDiagram(model, r), `${r.name} specializations`);
    doc.table(
      ['Item', 'Specializes', 'Features', 'Description'],
      items.map((d) => [
        code(d.name),
        esc(short(d.specializes)),
        model.children(d).filter((m) => ['attribute', 'item'].includes(m.kind)).map((m) => `${esc(m.name)} : ${esc(short(m.type ?? m.specializes))}${multiplicity(model, m) ? `[${esc(multiplicity(model, m))}]` : ''}`).join('<br/>'),
        esc(cleanDoc(d.documentation)),
      ]),
      'Item definitions',
      { cls: 'compact small', widths: ['20%', '13%', '30%', '37%'] },
    );
  }

  const values = model.ofKind('attribute def');
  const enums = model.ofKind('enum def');
  if (values.length || enums.length) {
    doc.heading(2, 'Value types and enumerations');
    doc.table(
      ['Value type', 'Features', 'Description'],
      values.map((d) => [code(d.name), model.children(d, 'attribute').map((m) => `${esc(m.name)} : ${esc(short(m.type ?? m.specializes))}`).join('<br/>'), esc(cleanDoc(d.documentation))]),
      'Value types',
      { cls: 'compact', widths: ['20%', '40%', '40%'] },
    );
    doc.table(
      ['Enumeration', 'Literals', 'Description'],
      enums.map((d) => [code(d.name), model.children(d, 'enum').map((e) => esc(e.name)).join(', '), esc(cleanDoc(d.documentation)).replace(/\n/g, ' ')]),
      'Enumerations',
      { cls: 'compact', widths: ['22%', '33%', '45%'] },
    );
  }
}

function behaviourSection(doc, model, A) {
  doc.heading(1, 'Behaviour');
  const sys = A.system;
  const performed = sys ? model.children(sys, 'perform action') : [];
  const actionDefs = model.ofKind('action def');
  const withFlow = actionDefs.filter((d) => actionFlow(model, d).edges.length > 0);
  // Order: functions the system performs first, in declaration order, then the rest.
  const order = (d) => {
    const i = performed.findIndex((p) => model.typeOf(p) === d);
    return i >= 0 ? i : 100 + actionDefs.indexOf(d);
  };
  withFlow.sort((a, b) => order(a) - order(b));

  if (withFlow.length) {
    doc.heading(2, 'Functional flows');
    for (const d of withFlow) {
      doc.heading(3, humanize(d.name), `act-${slug(d.name)}`);
      doc.add(docHtml(d.documentation));
      const perf = performed.find((p) => model.typeOf(p) === d);
      const flow = actionFlow(model, d);
      const steps = flow.nodes.filter((n) => n.kind === 'action');
      doc.figure(activityDiagram(model, d), `Activity: ${d.name}`, { wide: steps.length > 7 });
      doc.table(
        ['Step', 'Definition', 'Description', 'Performed by'],
        steps.map((n) => {
          const t = n.type ? model.findDef(n.type) : model.children(d).find((c) => c.name === n.name);
          const by = perf ? A.allocations.filter((a) => a.functionPath === `${perf.name}.${n.name}`).map((a) => code(a.part)).join(', ') : '';
          return [code(n.name), esc(short(n.type)), esc(cleanDoc(t?.documentation)), by];
        }),
        `Steps of ${d.name}`,
        { cls: 'compact', widths: ['22%', '22%', '38%', '18%'] },
      );
      const decisions = flow.edges.filter((e) => e.guard);
      if (decisions.length) {
        doc.table(
          ['Decision', 'Guard', 'Next'],
          decisions.map((e) => [code(e.from), e.guard === 'else' ? '<i>else</i>' : code(e.guard), code(e.to)]),
          `Decisions in ${d.name}`,
          { cls: 'compact', widths: ['30%', '45%', '25%'] },
        );
      }
    }
  }

  const leaf = actionDefs.filter((d) => !withFlow.includes(d));
  if (leaf.length) {
    doc.heading(2, 'Function catalogue');
    doc.table(
      ['Function', 'Inputs', 'Outputs', 'Description'],
      leaf.map((d) => {
        const params = model.members(d).filter((m) => ['item', 'attribute'].includes(m.kind));
        const fmt = (dir) => params.filter((p) => direction(model, p) === dir || direction(model, p) === 'inout').map((p) => `${esc(p.name)} : ${esc(short(p.type))}`).join('<br/>');
        return [`${code(d.name)}${d.specializes ? `<br/><span class="muted">:&gt; ${esc(short(d.specializes))}</span>` : ''}`, fmt('in'), fmt('out'), esc(cleanDoc(d.documentation))];
      }),
      'Atomic functions',
      { cls: 'compact small', widths: ['24%', '22%', '20%', '34%'] },
    );
  }

  const alloc = A.allocations.filter((a) => !a.top);
  if (alloc.length) {
    doc.heading(2, 'Functional allocation');
    doc.p(`Functions of the ${esc(sys?.name)} are allocated to subsystems with <code>perform</code>.`);
    doc.table(
      ['Function', 'Allocated to'],
      alloc.map((a) => [code(a.functionPath), code(a.part)]),
      'Function-to-subsystem allocation',
      { cls: 'compact', widths: ['55%', '45%'] },
    );
  }

  const stateDefs = model.ofKind('state def');
  if (stateDefs.length) {
    doc.heading(2, 'State machines');
    const exhibitors = model.ofKind('exhibit state');
    for (const sd of stateDefs) {
      doc.heading(3, humanize(sd.name), `stm-${slug(sd.name)}`);
      doc.add(docHtml(sd.documentation));
      const by = exhibitors.filter((e) => model.typeOf(e) === sd).map((e) => code(model.parent(e)?.name));
      if (by.length) doc.p(`<b>Exhibited by:</b> ${by.join(', ')}. <b>Initial state:</b> ${code(initialState(model, sd) ?? '—')}.`);
      const states = model.children(sd, 'state');
      doc.figure(stateDiagram(model, sd), `State machine: ${sd.name}`, { wide: states.length > 5 });
      const behav = states.flatMap((s) => stateBehaviours(model, s).map((b) => [code(s.name), esc(b.when), `${code(b.name)}${b.type ? ` : ${esc(short(b.type))}` : ''}`]));
      if (behav.length) doc.table(['State', 'When', 'Behaviour'], behav, `State behaviours of ${sd.name}`, { cls: 'compact' });
      doc.table(
        ['Transition', 'From', 'Trigger', 'Guard', 'To'],
        model.children(sd, 'transition').map((t) => {
          const det = transitionDetails(model, t);
          return [code(t.name), code(t.source), esc(short(t.trigger)), det.guard ? code(det.guard) : '', code(t.target)];
        }),
        `Transitions of ${sd.name}`,
        { cls: 'compact small', widths: ['24%', '18%', '22%', '18%', '18%'] },
      );
    }
  }

  const calcs = model.ofKind('calc def');
  const constraints = model.ofKind('constraint def');
  if (calcs.length || constraints.length) {
    doc.heading(2, 'Calculations and constraints');
    const params = (d) => model.children(d).filter((c) => direction(model, c) === 'in').map((c) => `${esc(c.name)} : ${esc(short(c.type ?? c.specializes))}`).join('<br/>');
    doc.table(
      ['Calculation', 'Inputs', 'Result', 'Description'],
      calcs.map((d) => {
        const r = returnExpression(model, d);
        return [code(d.name), params(d), r ? `${code(r.name)} = ${pretty(r.expr)}` : '', esc(cleanDoc(d.documentation))];
      }),
      'Calculation definitions',
      { cls: 'compact', widths: ['20%', '22%', '28%', '30%'] },
    );
    doc.table(
      ['Constraint', 'Parameters', 'Expression', 'Description'],
      constraints.map((d) => [code(d.name), params(d), pretty(constraintExpression(model, d) ?? ''), esc(cleanDoc(d.documentation))]),
      'Constraint definitions',
      { cls: 'compact', widths: ['22%', '26%', '22%', '30%'] },
    );
  }
}

function verificationSection(doc, model, A) {
  doc.heading(1, 'Verification');
  const vPkgs = model.packages().filter((p) => A.inFolder(p, 'verification'));
  for (const p of vPkgs) doc.add(docHtml(p.documentation));
  const reqIdOf = (path) => {
    const u = model.resolveUsagePath(path.replace(/::/g, '.'));
    if (u && model.children(u, 'requirement').length) return `All of ${u.name} (${A.nestedReqs(u).length - 1})`;
    const d = u && model.typeOf(u);
    return d && d.kind === 'requirement def' ? A.reqId(d) : path.split('.').pop();
  };
  // Replace requirement parameter references (spec.req.param) with their bound values.
  const criterion = (expr) =>
    expr.replace(/\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*){2,})\b/g, (m) => {
      const parts = m.split('.');
      const u = model.resolveUsagePath(parts.slice(0, -1).join('.'));
      if (!u || u.kind !== 'requirement') return m;
      const v = A.paramValue(u, parts[parts.length - 1]);
      return v ? v.value : m;
    });

  if (A.verificationDefs.length) {
    doc.heading(2, 'Verification cases');
    doc.table(
      ['Verification case', 'Method', 'Verifies', 'Pass criterion'],
      A.verificationDefs.map((v) => [
        code(v.name),
        esc(cleanDoc(v.documentation)).replace(/\n/g, ' '),
        verifiedPaths(model, v).map((p) => esc(reqIdOf(p))).join(', '),
        passIf(model, v) ? pretty(criterion(passIf(model, v))).replace(/ and /g, ' and<br/>') :'<span class="muted">By assessment of the verification evidence.</span>',
      ]),
      'Verification case definitions',
      { cls: 'compact small', widths: ['18%', '30%', '17%', '35%'] },
    );
    const usages = model.ofKind('verification case');
    if (usages.length) {
      doc.table(
        ['Verification', 'Case', 'Subject'],
        usages.map((u) => [code(u.name), esc(short(u.type)), code(subjectBinding(model, u) ?? '')]),
        'Planned verifications of the reference configuration',
        { cls: 'compact', widths: ['35%', '35%', '30%'] },
      );
    }
  }

  const analyses = model.ofKind('analysis case def');
  if (analyses.length) {
    doc.heading(2, 'Analysis cases');
    for (const a of analyses) {
      const r = returnExpression(model, a);
      const ins = model.children(a).filter((c) => direction(model, c) === 'in');
      doc.add(`<p><b>${esc(humanize(a.name))}</b> (${code(a.name)}). ${esc(cleanDoc(a.documentation))}</p>`);
      doc.kv([
        ['Subject', esc(short(model.children(a, 'subject')[0]?.type))],
        ['Inputs', ins.map((c) => `${esc(c.name)} : ${esc(short(c.type ?? c.specializes))}`).join(', ')],
        ['Objective', esc(objectiveDoc(model, a))],
        ['Result', r ? `${code(r.name)} = ${pretty(r.expr)}` : ''],
      ]);
      const runs = model.ofKind('analysis case').filter((u) => model.typeOf(u) === a);
      for (const u of runs) {
        const bindings = [...model.text(u, { clean: true }).matchAll(/\bin\s+(\w+)\s*=\s*([^;]+);/g)].map((m) => `${esc(m[1])} = ${code(m[2].trim())}`);
        doc.p(`Analysis ${code(u.name)} on ${code(subjectBinding(model, u) ?? '')}: ${bindings.join(', ')}.`);
      }
    }
  }

  doc.heading(2, 'Requirements traceability');
  doc.p('Each requirement should be satisfied by a design element and verified by a verification case. Gaps are flagged.');
  let gaps = 0;
  const rows = A.reqDefs.map((d) => {
    const sat = [...(A.satisfiedBy.get(d) ?? [])];
    const ver = [...(A.verifiedBy.get(d) ?? [])].map((v) => v.name);
    const ok = sat.length && ver.length;
    if (!ok) gaps++;
    return [
      `<b>${esc(A.reqId(d))}</b>`,
      esc(humanize(d.name.replace(/Requirement$/, ''))),
      sat.map(code).join('<br/>') || '<span class="bad">not satisfied</span>',
      ver.map(code).join('<br/>') || '<span class="bad">not verified</span>',
      ok ? '<span class="ok">✔</span>' : '<span class="bad">gap</span>',
    ];
  });
  doc.table(['ID', 'Requirement', 'Satisfied by', 'Verified by', 'Status'], rows, 'Requirements traceability matrix', { cls: 'compact', widths: ['10%', '30%', '24%', '28%', '8%'] });
  doc.p(gaps ? `<span class="bad">${gaps} requirement(s) have traceability gaps.</span>` : 'All requirements are satisfied and verified.');
}

function configurationSection(doc, model, A) {
  if (!A.configurations.length) return;
  doc.heading(1, 'Reference configuration');
  for (const p of model.packages().filter((p) => A.inFolder(p, 'configurations'))) doc.add(docHtml(p.documentation));
  doc.heading(2, 'Design values');
  doc.table(
    ['Element', 'Value', 'Note'],
    [...A.designValues.entries()].map(([path, v]) => [code(path), code(v.value), esc(v.note ?? '')]),
    'Values bound in the reference configuration',
    { cls: 'compact', widths: ['60%', '25%', '15%'] },
  );

  doc.heading(2, 'Requirement compliance');
  doc.p('For each requirement with a simple comparison criterion, the bound design value is checked against the threshold.');
  const rows = [];
  for (const spec of A.specs) {
    for (const u of A.nestedReqs(spec).slice(1)) {
      const d = model.typeOf(u);
      if (!d) continue;
      const subjectName = model.children(d, 'subject')[0]?.name ?? 'subject';
      for (const c of requireConstraints(model, d)) {
        const cmp = simpleComparison(c, subjectName);
        if (!cmp) continue;
        const th = A.paramValue(u, cmp.param);
        for (const by of A.satisfiedBy.get(d) ?? []) {
          const dv = A.designValues.get(`${by}.${cmp.feature}`);
          const sysAttr = A.system && model.members(A.system).find((m) => m.name === cmp.feature);
          const design = dv?.value ?? (sysAttr && boundValue(model, sysAttr));
          const res = compare(parseValue(design), cmp.op, parseValue(th?.value));
          rows.push([
            `<b>${esc(A.reqId(d))}</b>`,
            `${code(cmp.feature)} ${pretty(cmp.op)} ${code(cmp.param)}`,
            code(th?.value ?? '—'),
            code(design ?? '—'),
            res === true ? '<span class="ok">PASS</span>' : res === false ? '<span class="bad">FAIL</span>' : '<span class="muted">n/a</span>',
          ]);
        }
      }
    }
  }
  doc.table(['ID', 'Criterion', 'Threshold', 'Design value', 'Result'], rows, 'Requirement compliance of the reference configuration', { cls: 'compact', widths: ['10%', '42%', '17%', '17%', '14%'] });
}

function appendices(doc, model, A) {
  doc.startAppendices();
  const views = model.ofKind('view');
  if (views.length) {
    doc.heading(1, 'Model views');
    doc.p('Named views in the model, for interactive exploration in the SysML v2 VS Code extension.');
    doc.table(
      ['View', 'Kind', 'Title', 'Exposes'],
      views.map((v) => [code(v.name), esc(short(v.type)), esc(cleanDoc(v.documentation)), [...model.text(v, { clean: true }).matchAll(/expose\s+([^;]+);/g)].map((m) => code(m[1].trim())).join('<br/>')]),
      'Model views',
      { cls: 'compact small', widths: ['24%', '18%', '30%', '28%'] },
    );
  }
  doc.heading(1, 'Model inventory');
  doc.table(
    ['File', 'Lines', 'Elements'],
    model.files.map((f) => [code(f.rel), String(f.lines.length), String(model.symbols.filter((s) => s.key === f.key).length)]),
    'Model files',
    { cls: 'compact', widths: ['70%', '15%', '15%'] },
  );
  const kinds = new Map();
  for (const s of model.symbols) kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
  doc.table(
    ['Element kind', 'Count'],
    [...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [esc(k), String(n)]),
    'Model elements by kind',
    { cls: 'compact', widths: ['70%', '30%'] },
  );
  const diags = model.diagnostics;
  doc.p(
    diags.length
      ? `<span class="bad">The language server reported ${diags.length} error(s) when this document was generated:</span>`
      : 'The language server reported no syntax errors or unresolved types when this document was generated.',
  );
  if (diags.length) doc.table(['File', 'Line', 'Issue'], diags.map((d) => [code(d.file), String(d.line ?? ''), esc(d.message)]), 'Model diagnostics', { cls: 'compact small' });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function buildDocument(model, config, meta) {
  const A = analyse(model, config);
  const rootDoc = cleanDoc(A.root?.documentation);
  const derivedTitle = (rootDoc.split('\n')[0] ?? '').split(/[:.]/)[0].trim() || A.root?.name || 'System';
  meta.title = config.title ?? derivedTitle;
  meta.subtitle = config.subtitle ?? 'System Design Specification';
  meta.systemName = A.system?.name;

  const doc = new DocBuilder();
  introduction(doc, model, A, meta);
  operationalConcept(doc, model, A);
  requirementsSection(doc, model, A);
  architectureSection(doc, model, A);
  interfacesSection(doc, model, A);
  behaviourSection(doc, model, A);
  verificationSection(doc, model, A);
  configurationSection(doc, model, A);
  appendices(doc, model, A);

  return {
    body: await doc.html(),
    toc: doc.toc,
    stats: {
      requirements: A.reqDefs.length,
      figures: doc.fig,
      tables: doc.tab,
      gaps: A.reqDefs.filter((d) => !(A.satisfiedBy.get(d)?.size && A.verifiedBy.get(d)?.size)).length,
    },
  };
}
