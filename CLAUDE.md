# CLAUDE.md: SysML v2 modelling rules

This repo is a **SysML v2** model written in the standard textual notation (`.sysml`). The user views and edits it in VS Code with the **SysML v2 extension by daltskin** (`JamieD.sysml-v2-support`, language server `sysml-v2-lsp`). Every model change I make must parse cleanly in that extension and render sensibly in its diagrams.

- Language reference (syntax, semantics, library): [`docs/sysml-v2-language-guide.md`](docs/sysml-v2-language-guide.md). Read the relevant section before writing an unfamiliar construct.
- When the guide doesn't cover something, check the **official** sources, not the extension samples, which are loose in places:
  - Grammar: `bnf/SysML-textual-bnf.kebnf` in [Systems-Modeling/SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release)
  - Examples: `sysml/src/examples/` (especially `Simple Tests/` and `Vehicle Example/`)
  - Library: `sysml.library/`

---

## 1. Hard language rules (never break)

1. **`:` types a usage; `:>` specializes.** Definitions specialize with `:>` (`part def Car :> Vehicle;`). Usages are typed with `:` (`part car : Car;`). On a usage, `:>` means *subsets another usage*.
2. **Redefine inherited features with `:>>`**, never by redeclaring the same name: `:>> mass = 1450 [kg];`.
3. **`.` navigates usages, `::` qualifies namespaces.** Use `vehicle.engine.fuelIn` in connections, flows, binds, allocations and expressions. Use `Pkg::Def` only for names. (Some extension samples write `camera::power`. Don't copy that.)
4. **Explicit imports, always `private`.** Every top-level package declares what it uses: `private import ScalarValues::*;`, `private import ISQ::*;`, `private import SI::*;`, plus imports of our own packages. Never rely on implicit visibility of library types.
5. **Quantities carry units and quantity types.** A physical value is typed by an ISQ quantity (`attribute mass :> ISQ::mass;` or `: MassValue`) and valued with a unit (`= 1450 [kg]`). Use bare `Real` only for genuinely dimensionless values (ratios, efficiencies, counts as `Integer`).
6. **Every reference must resolve.** No undefined types (the extension samples use `PowerValue`, `Homeowner` and others without defining or importing them; that produces `unresolved-type` errors). Define it or import it.
7. **Transitions use the full form** when named or guarded: `transition name first S1 accept Trig if guard do effect then S2;`. The initial state is `entry; then S0;`.
8. **Port directions are declared on the port def. The receiving side uses the conjugate `~PortDef`**, never a second, mirrored port def.
9. **Statements end with `;`, bodies use `{}`.** A declaration with no body ends in `;`.
10. **No `GeometryView`.** The extension does not render it.

## 2. Repository layout

```
model/
  <System>.sysml            root package: imports + doc, nothing else
  requirements/             requirement defs, specifications, concerns
  structure/                part, port, interface, item, attribute, enum defs
  behaviour/                action defs, state defs, calc and constraint defs, use cases
  configurations/           system usages (the assembled system, instance values)
  verification/             verification and analysis cases
  views/                    view usages for the visualizer
docs/                       language guide and modelling notes
```

- **One top-level package per file.** The package name matches the file name (`structure/PowerSubsystem.sysml` → `package PowerSubsystem`).
- **Definitions and usages live apart.** Definitions in `structure/` and `behaviour/`. The assembled system (`part myVehicle : Vehicle { … }`) in `configurations/`.
- Files stay focused. Split one past ~300 lines.
- The extension pre-parses the whole workspace, so cross-file references resolve through imports. No build step is needed.

## 3. Naming

| Element | Convention | Example |
| --- | --- | --- |
| Packages | `UpperCamelCase` | `PowerSubsystem` |
| Definitions (`… def`) | `UpperCamelCase` noun | `part def BatteryPack` |
| Usages (parts, attributes, ports) | `lowerCamelCase` | `part batteryPack : BatteryPack;` |
| Action defs | `UpperCamelCase` verb phrase | `action def ChargeBattery` |
| Action usages | `lowerCamelCase` verb phrase | `action chargeBattery : ChargeBattery;` |
| States | `lowerCamelCase` | `state charging;` |
| Use cases, views, concerns | Quoted sentence-case names | `use case def 'Charge Vehicle'`, `view 'Power IBD'` |
| Requirement IDs | Short name `<'AREA-NNN'>` | `requirement def <'PWR-001'> BatteryCapacity` |
| Port defs | Suffix `Port` | `port def ChargePort` |
| Interface defs | Suffix `Interface` | `interface def ChargeInterface` |
| Enums | Def `UpperCamelCase`, literals `lowerCamelCase` | `enum def Mode { off; standby; active; }` |

Avoid quoted names for structural elements. They're harder to reference and the extension's `naming-convention` check flags them.

## 4. Documentation and traceability

- **Every definition and every requirement gets `doc /* … */`** as its first body member. The extension's `missing-doc` check and the Model Workbench both rely on a leading `doc`.
- **Requirements:** `doc` holds the "shall" statement. Add a `subject`, and a `require constraint { … }` whenever the requirement is measurable. Parameterise thresholds as attributes (`attribute massMax :> ISQ::mass;`) and bind values in the specification usage.
- **Trace everything:** each requirement should get a `satisfy … by …` (in `configurations/`) and a `verify` (in `verification/`). The extension flags `unsatisfied-requirement` and `unverified-requirement`. Treat those as a to-do list, not noise.
- Use `ModelingMetadata::Rationale` or a `comment` for design decisions that aren't obvious from the model.
- Use `//` notes for authoring remarks only. They are not model elements.

## 5. Visualizer-friendly modelling

The user looks at the model through the extension's diagrams, so model for the views:

- **General view:** keep definitions in focused packages so `expose Pkg::*` gives a readable diagram.
- **Interconnection view:** parts need typed **ports** and explicit **connect / interface / flow** statements between `part.port` ends. Unconnected parts render as boxes with no edges.
- **Action flow view:** actions need explicit sequencing (`first start; then …; then done;`) and `flow` between parameters.
- **State view:** give every state machine an initial state (`entry; then x;`) and named transitions with triggers.
- **Sequence view:** use `message of X from a to b;` (or `flow`) between part usages, with `event occurrence`s when ordering matters.
- **Case view:** use case defs with `subject`, `actor`s and `objective`.
- **Provide standard views.** For each subsystem, add view usages in `model/views/` typed by `GeneralView`, `InterconnectionView`, `ActionFlowView` or `StateTransitionView`, with `private import StandardViewDefinitions::*;`. That gives the user named, one-click diagrams.

### Keep the Model Workbench working

The user may edit requirements, docs, typing, multiplicity and satisfy/verify links through the extension's Model Workbench. It only edits **simple declarations with a leading `doc`**. So:

- Keep requirement and part declarations simple: one type, a leading `doc`, simple multiplicity.
- Write `satisfy R by X;` and `verify` links in the simple single-target form.
- **The user edits these files too.** Always re-read a file before editing it. Never overwrite from memory.

## 6. Workflow for any model change

1. Read the relevant guide section and the existing files the change touches.
2. Add or extend **definitions** first, then **usages** and **configuration**, then **traceability** (satisfy/verify), then **views**.
3. Check every new name resolves (imported or defined) and every `.` path exists.
4. **Validate:** run the parser before reporting work as done, and fix every error. Treat warnings (`missing-doc`, `unsatisfied-requirement`, …) as reportable gaps. If the parser can't run, say so plainly and ask the user to check the VS Code Problems panel.
5. Tell the user which view to open to see the change.
6. Commit with a message saying what changed in the model. Push only when asked.

## 7. When unsure

- Prefer the form used in the official `Simple Tests/` or `Vehicle Example/` models.
- Prefer a simpler, valid construct that renders over a clever one the extension may not draw.
- If a modelling choice is really the user's (system boundary, decomposition, which requirements), ask rather than invent.
