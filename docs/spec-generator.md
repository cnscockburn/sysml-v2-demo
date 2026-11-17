# System Design Specification generator

`tools/generate-spec.mjs` builds a System Design Specification (SDS) PDF straight from the SysML v2 model in `model/`. Re-run it whenever the model changes. Don't edit the PDF.

## Run it

```bash
npm install
npm run spec
```

Output goes to `build/spec/<title>-sds.pdf`, with the intermediate `.html` beside it. Both are git-ignored.

Options (pass them after `--`, e.g. `npm run spec -- --out spec.pdf`):

| Option | Effect |
| --- | --- |
| `--out <file>` | PDF path |
| `--config <file>` | Settings file (default `tools/spec/spec.config.json`) |
| `--browser <path>` | Chrome, Chromium or Edge to print with (or set `CHROME_PATH`) |
| `--html-only` | Write the HTML and stop |

Requirements: Node 18+, the VS Code SysML v2 extension (the script reads the model through its language server via `tools/sysml-mcp.mjs`), and an installed Chrome or Edge.

## What it produces

| Section | Built from |
| --- | --- |
| Cover, document control | `spec.config.json`, git commit, model statistics |
| 1 Introduction | Root package `doc`, package list |
| 2 Operational concept | Context part def of each configuration (interconnection diagram), use case defs (diagram and table) |
| 3 Requirements | Requirement defs grouped by ID prefix; constraints with bound threshold values; specification parameters |
| 4 System architecture | System of interest (the most common requirement `subject` type): decomposition tree, internal interconnection, a subsection per subsystem (characteristics, ports, functions, nested structure), specialization taxonomies |
| 5 Interfaces | Port defs, interface defs, item defs (with taxonomies), attribute defs, enums |
| 6 Behaviour | Activity diagrams from action successions and decisions, function catalogue, `perform` allocation, state machines, calcs and constraints |
| 7 Verification | Verification case defs with pass criteria, analysis cases, traceability matrix (satisfy and verify), with gaps flagged |
| 8 Reference configuration | Bound design values, and a compliance check of design values against requirement thresholds |
| Appendices | Model views, file and element inventory, language server diagnostics |

### Diagram notation

Every figure is drawn in the **SysML v2 standard graphical notation**, following the OMG training deck *Intro to the SysML v2 Language: Graphical Notation* (`doc/` in [SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release)). The generator builds the diagrams itself (`tools/spec/sysml-svg.mjs`, laid out with [ELK](https://eclipse.dev/elk/)) rather than using the VS Code extension's renderer, so the PDF has no browser-side diagram step.

| View | Figures | Notation used |
| --- | --- | --- |
| General View | decomposition, specialization taxonomies | square-cornered `«kind def»` definitions, round-cornered `«kind» name : Type [mult]` usages, compartments (*parts*, *attributes*), composition with a filled diamond, specialization with a hollow triangle |
| Interconnection View | operational context, system and subsystem internals | nested part usages, ports as boundary squares labelled `name : PortDef` / `~PortDef`, connections and `name : InterfaceDef` interfaces |
| Action Flow View | every action def with successions | start (filled circle), done (bullseye), decision/merge (diamond), fork/join (bar), dashed open-arrow successions with `[guard]`, item flows between parameter squares |
| State Transition View | every state def | initial pseudo-state, `«state»` usages with a *state actions* compartment (`entry`/`do`/`exit`), transitions labelled `trigger [guard] / effect` |
| Use Case View | all use case defs | `«subject»`, stick-figure actors, `«include»` arrows |

Each diagram sits in a view frame whose name tab gives the view kind and the exposed element. For readability:

- Interconnection views open parts one level deep. A connection into a deeper part ends on a port on its boundary, labelled with the inner path (shortened to its last two segments). A part with more than eight sub-parts is shown closed, with its parts listed in a compartment and an aggregated `*.port` carrying a `×n` count. Full connection paths are always in the connections table.
- Loops in action flows and state machines are laid out as back edges, so the main flow reads top to bottom from `start` or the initial state.
- Structural diagrams try both layout directions and keep the one that fits an A4 page best. Anything still too wide is rotated onto its own page.

## How it stays reusable

Nothing is keyed to element names. The generator selects elements by kind, folder and relationship, following the layout in `CLAUDE.md`:

- `configurations/` top-level part usages give the reference configuration and its context.
- `requirements/` gives requirement defs (IDs from short names `<'XX-NNN'>`) and specification usages, whose nested requirement usages bind threshold parameters.
- `satisfy … by …;` and `verify …;` give traceability.
- `doc` comments give all narrative text, so keep them meaningful.

Compliance checking works for requirement constraints of the form `subject.feature OP parameter`, with quantities in common SI units (m, km, s, min, h, d, m/s, °, rad and others). Other constraints are listed but not evaluated.

Optional settings in `tools/spec/spec.config.json`: `title` (default: first line of the root package doc), `subtitle`, `documentNumber`, `status`, `classification`, `modelDir` and `systemDefinition` (overrides the system-of-interest detection).

## Code layout

| File | Role |
| --- | --- |
| `tools/generate-spec.mjs` | CLI entry point |
| `tools/spec/model.mjs` | MCP client, model loading, symbol query API |
| `tools/spec/extract.mjs` | Source-text extraction for facts the symbol table lacks (values, successions, satisfy/verify, constraints) |
| `tools/spec/diagrams.mjs` | Diagram builders: select model elements for each SysML v2 view |
| `tools/spec/sysml-svg.mjs` | SysML v2 graphical-notation renderer (ELK layout to SVG) |
| `tools/spec/document.mjs` | Section builders (HTML) |
| `tools/spec/render.mjs` | Page template, styles, headless-browser PDF printing (Paged.js) |
