# SysML v2 Language Guide

A working reference for writing SysML v2 textual notation in this repo. Every syntax form below was checked against the official grammar (`SysML-textual-bnf.kebnf`) and the official example models in the [SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release) repo (release 2026-09.1).

Rules for *how* we model (conventions, file layout, workflow) live in [`CLAUDE.md`](../CLAUDE.md). This file covers *what the language is*.

---

## 1. What SysML v2 is

- **SysML v2.0** is the OMG Systems Modeling Language, formally adopted in July 2025 together with **KerML 1.0** (the Kernel Modeling Language it is built on) and the **Systems Modeling API & Services 1.0**. The specs were updated editorially in March 2026 for submission to ISO.
- Unlike SysML v1 (a UML profile drawn as diagrams), v2 has its **own metamodel** and a **standard textual notation**. The text *is* the model; diagrams are views generated from it.
- Semantics come from KerML: everything is a **type** (classifier or feature), and every model element ultimately specializes something in the standard library (`Parts::Part`, `Actions::Action`, `Requirements::RequirementCheck`, …).
- Source files use the `.sysml` extension (`.kerml` for pure KerML).

### The core idea: definition vs usage

Almost every concept comes as a pair:

| Definition (a type, reusable) | Usage (a feature, used in context) |
| --- | --- |
| `part def Engine { … }` | `part engine : Engine;` |
| `port def FuelPort { … }` | `port fuelIn : FuelPort;` |
| `action def Drive { … }` | `action drive : Drive;` |
| `requirement def MassReq { … }` | `requirement vehicleMass : MassReq;` |

- A **definition** (`… def`) says what something *is*. It's like a class.
- A **usage** is a definition used in a particular context: a part inside an assembly, an action step inside a process. It's like a typed property or role.
- Usages can nest and can be refined in context (redefinition, binding values) without changing the definition.

---

## 2. Lexical basics

```sysml
// Line note: ignored by the model (not saved as an element)
/* Block note: also ignored */

/* A comment element is a block comment that is a real model element
   when written as a member (not inside an expression). */
comment Rationale /* Why we chose this. */

doc /* Documentation attached to the enclosing element. */
```

- **Names**: plain identifiers (`Engine`, `fuelTank`) or quoted unrestricted names (`'Operate System'`, `'Front Wheel'`).
- **Short names / IDs**: `<'R1.2'>` or `<kg>` before the name. Used for requirement IDs and unit symbols:
  `requirement def <'SYS-001'> MaxMass { … }`
- **Qualified names** use `::` for *namespace* membership: `ISQ::mass`, `Vehicle::engine`.
- **Feature chains** use `.` to navigate *usages*: `vehicle.engine.fuelIn`.
- Statements end with `;`. Bodies use `{ … }`. A declaration with no body ends with `;`.

---

## 3. Relationship operators

| Symbol | Keyword | Meaning | Example |
| --- | --- | --- | --- |
| `:` | `defined by` | Usage is typed by a definition | `part engine : Engine;` |
| `:>` | `specializes` | Definition specializes a definition | `part def SportsCar :> Car;` |
| `:>` | `subsets` | Usage subsets another usage | `part frontWheels :> wheels;` |
| `:>>` | `redefines` | Usage redefines an inherited usage | `part :>> engine : V8Engine;` |
| `::>` | `references` | Reference subsetting (ends, refs) | `end ::> d1;` |
| `~` | — | Conjugated port type (flips in/out) | `port fuelIn : ~FuelPort;` |

`:>` means specialization in both cases. On a definition it is a *specialization*. On a usage it is *subsetting*.

Shorthand redefinition: `:>> mass = 1200 [kg];` redefines the inherited `mass` and binds a value.

---

## 4. Multiplicity and modifiers

```sysml
part wheels : Wheel[4];
part spare : Wheel[0..1];
part passengers : Person[*];          // 0..*
part seats : Seat[1..*] ordered nonunique;
```

Modifiers on usages: `abstract`, `ref` (reference, not owned/composite), `readonly`, `derived`, `constant`, `variation`/`variant`, `individual`, `snapshot`/`timeslice`.

Direction (on ports, action/calc parameters): `in`, `out`, `inout`.

---

## 5. Packages, visibility and imports

```sysml
package VehicleModel {
    doc /* Root package for the vehicle model. */

    private import ScalarValues::*;     // Real, Integer, Boolean, String, Natural
    private import ISQ::*;              // quantity types: MassValue, mass, speed, power …
    private import SI::*;               // units: kg, m, s, W, N, V, A …

    package Definitions { … }
    package Usages { … }
}
```

- `import X::*;` imports the members of `X`. `import X::**;` imports them recursively. `import X::Y;` imports one member.
- Visibility: `public` (default for members), `private`, `protected`. **Always write `private import`.** A public import re-exports names to everyone who imports your package.
- Imports are not transitive unless they are `public`.
- `alias Short for Some::Long::Name;` creates an alternate name.
- `library package` / `standard library package` mark library content.

### Commonly used standard library packages

| Package | Gives you |
| --- | --- |
| `ScalarValues` | `Real`, `Integer`, `Natural`, `Boolean`, `String`, `Rational`, `Complex` |
| `ISQ` | ISO 80000 quantities: `MassValue`/`mass`, `LengthValue`/`length`, `DurationValue`/`duration`, `SpeedValue`/`speed`, `PowerValue`/`power`, `TemperatureValue`, `torque`, `ElectricCurrentValue`, `ElectricPotentialValue` … |
| `SI` | SI units by short name: `kg`, `m`, `s`, `A`, `K`, `N`, `W`, `V`, `J`, `Pa` … |
| `USCustomaryUnits` | `lb`, `ft`, `mi`, `gal` … |
| `Time` | `DateTime`, `Iso8601DateTime`, time functions |
| `NumericalFunctions` | `sum`, `product`, `max`, `min` … |
| `ModelingMetadata` | `StatusInfo`, `Rationale`, `Issue`, `Refinement` metadata |
| `RiskMetadata` | `Risk`, `RiskLevelEnum` |
| `StandardViewDefinitions` | `GeneralView`, `InterconnectionView`, `ActionFlowView`, `StateTransitionView`, `SequenceView`, `GeometryView`, `GridView`, `BrowserView` |
| `Views` | Renderings: `asTreeDiagram`, `asInterconnectionDiagram`, `asElementTable`, `asTextualNotation` |
| `ShapeItems`, `SpatialItems` | Geometry |
| `TradeStudies`, `AnalysisTooling` | Analysis support |
| `RequirementDerivation`, `CauseAndEffect` | Derivation and causal connections |

---

## 6. Structure

### Parts and attributes

```sysml
part def Vehicle {
    attribute mass :> ISQ::mass;               // quantity-typed (subsets the ISQ feature)
    attribute maxSpeed : SpeedValue;            // typed by a quantity value type
    attribute colour : Colour;
    attribute isElectric : Boolean = false;     // bound value (always equal)
    attribute serial : String default = "TBD"; // default, may be overridden

    part engine : Engine;
    part wheels : Wheel[4];
    ref part driver : Person[0..1];             // referenced, not owned
}

part myCar : Vehicle {
    :>> mass = 1450 [kg];
    :>> wheels[4];
}
```

- `part`: a composite structural element (hardware, software, people, facilities).
- `attribute`: a value with no identity (numbers, strings, quantities, data structures). `attribute def` defines a data type.
- `item`: something that flows or is stored (fuel, signals, data packets). Items can be passed through ports and flows.
- `occurrence`: something with a lifetime (base of parts, items and actions). Rarely used directly.
- Value forms (from the grammar): `= expr` (bound), `:= expr` (initial), `default = expr`, `default := expr`.
- Quantities with units: `1450 [kg]`, `9.81 [m/s^2]`, `500 [W]`. Units resolve from `SI`, so import `SI::*` or qualify the unit, as in `[SI::kg]`.

### Enumerations

```sysml
enum def Colour {
    enum red;       // 'enum' keyword is optional in an enum def body
    green;
    blue;
}
attribute c : Colour = Colour::red;
```

### Ports

```sysml
port def FuelPort {
    out item fuel : Fuel;
    in attribute pressure : PressureValue;
}

part def FuelTank  { port fuelOut : FuelPort; }
part def Engine    { port fuelIn  : ~FuelPort; }   // conjugated: fuel is now 'in'
```

- A port is a connection point. Its directed features (`in`, `out`, `inout`) say what crosses the boundary.
- Use `~PortDef` on the receiving side rather than writing a second, mirrored port def.
- Ports can nest (`port p { port sub; }`).

### Connections, interfaces and binding

```sysml
part def Powertrain {
    part tank : FuelTank;
    part engine : Engine;

    // Simple connection
    connect tank.fuelOut to engine.fuelIn;

    // Named, typed connection
    connection fuelLine : FuelLine connect tank.fuelOut to engine.fuelIn;

    // Interface (a connection between ports, typed by an interface def)
    interface fuelIF : FuelInterface connect tank.fuelOut to engine.fuelIn;

    // Binding: two features are the same value
    bind engine.fuelIn.pressure = tank.fuelOut.pressure;
}

connection def FuelLine {
    end source : FuelTank;
    end target : Engine;
}

interface def FuelInterface {
    end supplierPort : FuelPort;
    end consumerPort : ~FuelPort;
    flow of Fuel from supplierPort.fuel to consumerPort.fuel;
}
```

- Connection/interface defs declare `end` features. Usages connect with `connect a to b;` or `connect (a, b, c);` for n-ary.
- Multiplicity on ends: `connect [1] a to [1] b;`.
- `interface` is preferred over plain `connection` when both ends are ports.

### Flows

```sysml
flow of Fuel from tank.fuelOut.fuel to engine.fuelIn.fuel;   // typed payload
flow tank.fuelOut.fuel to engine.fuelIn.fuel;                // untyped shorthand
succession flow pump.outlet to engine.inlet;                 // flow + ordering (note: 'in'/'out' are keywords, not names)
message of StartCmd from driver to controller;               // message (sequence diagrams)
```

### Allocation

```sysml
allocate logical.torqueGenerator to physical.engine;

allocation def LogicalToPhysical {
    end logical : LogicalArchitecture;
    end physical : PhysicalArchitecture;
}
allocation a1 : LogicalToPhysical allocate logicalArch to physicalArch;
```

### Dependency

```sysml
dependency from Controller to Sensor;
dependency Uses from 'UI Layer' to 'Service Layer';
```

---

## 7. Behaviour

### Actions (activity / functional flow)

```sysml
action def ProvidePower {
    in item pwrCmd : PwrCmd;
    out torque : TorqueValue;

    // Steps, ordered with successions
    first start;
    then action generateTorque : GenerateTorque;
    then action amplifyTorque : AmplifyTorque;
    then done;

    // Data flow between steps
    flow generateTorque.engineTorque to amplifyTorque.engineTorque;
}
```

- Parameters: `in`, `out`, `inout`. They can be typed by attributes or items.
- Sequencing: `first a then b;`, or inline `then action x;` after a step. `start` and `done` are the built-in begin/end.
- Named succession: `succession s1 first a then b;`.
- Control nodes: `fork f;`, `join j;`, `merge m;`, `decide d;`.
- Decisions (inside an action body):

  ```sysml
  action def Trip {
      attribute fuelLow : Boolean;
      first start;
      then decide;
          if fuelLow then refuel;
          else drive;
      action refuel;
      action drive;
  }
  ```

- Signals: `send new StartSignal() to controller;`, `accept s : StartSignal;`, `accept s : Sig via port;`, `accept after 10 [s];`, `accept when condition;`.
- Assignment: `assign x := x + 1;`.
- Structured control: `if … { } else { }`, `while … { }`, `for i in seq { }`.
- `terminate;` ends the enclosing occurrence.

**Performing:** a part does behaviour with `perform`:

```sysml
part def Vehicle {
    perform action providePower : ProvidePower;
}
part engine { perform vehicle.providePower.generateTorque; }  // reference into an action tree
```

### States

```sysml
state def EngineStates {
    entry; then off;                     // initial state

    state off;
    state starting;
    state on {
        entry action selfTest;
        do action run;
        exit action shutdownChecks;
    }

    transition off_to_starting
        first off
        accept ignitionOn : IgnitionCmd via ignitionPort
        if brakePedalDepressed
        do send new StartSignal() to controller
        then starting;

    transition first starting then on;   // completion transition
    transition first on accept Stop then off;
}

part def Engine {
    exhibit state engineStates : EngineStates;
}
```

- Short form after a state: `state S1; accept Sig then S2;`.
- Transitions: `first <source> [accept <trigger> [via <port>]] [if <guard>] [do <effect>] then <target>`.
- `state s parallel { state a; state b; }` gives orthogonal regions.
- Nested states are reached with `.`: `then S2.S3;`.
- `exhibit state` puts a state machine on a part (as `perform` does for actions).

### Calculations and constraints

```sysml
calc def KineticEnergy {
    in m : MassValue;
    in v : SpeedValue;
    return ke : EnergyValue = 0.5 * m * v ^ 2;
}

constraint def MassBudget {
    in total : MassValue;
    in limit : MassValue;
    total <= limit
}

part def Vehicle {
    attribute mass :> ISQ::mass;
    assert constraint massOK : MassBudget {
        in total = mass;
        in limit = 2000 [kg];
    }
}
```

- `constraint` is a Boolean expression. `assert constraint` says it must hold.
- `calc` returns one value via `return`. Invoke a calc like a function: `KineticEnergy(m, v)`.

### Expressions (quick reference)

- Arithmetic `+ - * / % ^`. Comparison `== != < <= > >=`. Logical `and or xor not implies`.
- Conditional `if c ? a else b`. Null coalescing `x ?? default`.
- Type test and cast: `x istype T` (also `x @ T`), `x hastype T`, `x as T`. `x @@ M` tests the metaclass.
- Sequences `(a, b, c)`, indexing `seq#(1)`, and `->` invocation on collections, as in `masses->sum()`. In practice, prefer `NumericalFunctions::sum(masses)`.
- Literals: `true`, `false`, `null`, `"string"`, `1.5E3`, quantities `10 [m]`.

---

## 8. Requirements

```sysml
requirement def <'REQ-001'> MassRequirement {
    doc /* The vehicle mass shall not exceed the required maximum. */
    subject vehicle : Vehicle;
    attribute massRequired :> ISQ::mass;
    require constraint { vehicle.mass <= massRequired }
}

requirement def <'REQ-002'> RangeRequirement {
    doc /* The vehicle shall achieve a range of at least 400 km on a full charge. */
    subject vehicle : Vehicle;
    assume constraint { vehicle.battery.stateOfCharge == 1.0 }
    require constraint { vehicle.range >= 400 [km] }
}

// A specification groups requirement usages
requirement vehicleSpecification {
    subject vehicle : Vehicle;
    requirement <'1'> vehicleMass : MassRequirement {
        :>> massRequired = 2000 [kg];
    }
    requirement <'2'> vehicleRange : RangeRequirement;
}

// Satisfaction: a design element claims to satisfy a requirement
satisfy vehicleSpecification by myCar;
satisfy vehicleSpecification.vehicleMass by myCar;
```

- `subject` is the thing the requirement constrains. A requirement def has at most one subject.
- `require constraint { … }` sets the condition. `assume constraint { … }` sets a precondition.
- `doc /* … */` is the human-readable "shall" text. Always include it.
- `<'ID'>` short names give stable requirement IDs.
- `satisfy R by X;` (also `assert satisfy`, `not satisfy`).
- `frame concernX;` links a requirement to a stakeholder `concern`.
- Derivation: `RequirementDerivation` library (`#derivation connection { … }`).

### Verification

```sysml
verification def MassTest {
    subject vehicle : Vehicle;
    objective {
        verify vehicleSpecification.vehicleMass;
    }
    action weigh { out measured : MassValue; }
    return verdict : VerdictKind = PassIf(weigh.measured <= 2000 [kg]);
}
```

Uses `VerificationCases::VerdictKind` and `PassIf`. Import `VerificationCases::*` for these.

### Use cases

```sysml
use case def 'Drive Vehicle' {
    subject vehicle : Vehicle;
    actor driver : Driver;
    actor passengers : Person[0..4];
    objective { doc /* Transport occupants safely to a destination. */ }

    include use case startVehicle : 'Start Vehicle';
}
use case def 'Start Vehicle';
```

Actors are `part` usages; give them a `part def` (e.g. `part def Driver;`).

### Analysis cases, concerns and viewpoints

```sysml
analysis def FuelEconomyAnalysis {
    subject vehicle : Vehicle;
    objective { doc /* Estimate fuel economy for the nominal scenario. */ }
    return fuelEconomy : Real;
}

concern 'Mass Budget' {
    doc /* Stakeholders need confidence the vehicle stays under mass limits. */
    stakeholder chiefEngineer : Engineer;
}
```

---

## 9. Metadata

```sysml
metadata def Safety {
    attribute isMandatory : Boolean;
}

part brakes : Brakes {
    @Safety { isMandatory = true; }      // inside body
}
#Safety part airbag : Airbag;           // prefix keyword form (no attributes)
metadata Safety about brakes, airbag;   // standalone form
```

Library metadata worth knowing:
- `ModelingMetadata::StatusInfo` (status, originator, owner, risk)
- `ModelingMetadata::Rationale`
- `ModelingMetadata::Issue`
- `RiskMetadata::Risk`

Metadata can be a filter target in views: `filter @Safety;`.

---

## 10. Variability and individuals

```sysml
variation part def EngineChoice :> Engine {
    variant part fourCyl : FourCylinderEngine;
    variant part sixCyl  : SixCylinderEngine;
}

individual def Vehicle_1 :> Vehicle;
individual part vehicle1 : Vehicle_1 {
    snapshot part atStart { :>> mass = 1450 [kg]; }
}
```

---

## 11. Views (what the VS Code extension renders)

Views are model elements. A view selects (`expose`, `filter`) and renders model content.

```sysml
package Views {
    private import StandardViewDefinitions::*;
    private import VehicleModel::**;

    view 'Vehicle Structure' : GeneralView {
        expose VehicleModel::Definitions::*;
    }
    view 'Powertrain IBD' : InterconnectionView {
        expose VehicleModel::Usages::myCar;
    }
    view 'Power Flow' : ActionFlowView {
        expose VehicleModel::Definitions::ProvidePower;
    }
    view 'Engine States' : StateTransitionView {
        expose VehicleModel::Definitions::EngineStates;
    }
    view 'Requirements' : GeneralView {
        expose VehicleModel::**;
        filter @SysML::RequirementUsage;
    }
    view 'Model Tree' : BrowserView {
        expose VehicleModel::**;
    }
}
```

- `expose X;` shows one element. `expose X::*;` shows its members. `expose X::**;` shows everything recursively.
- `filter @SysML::PartUsage;` filters by metaclass. `filter @Safety;` filters by metadata. Filters combine with `and`/`or`/`not`.
- `render Views::asTreeDiagram;` (also `asInterconnectionDiagram`, `asElementTable`, `asTextualNotation`).
- `view def` can hold a reusable filter/render, and view usages typed by it inherit both.
- `viewpoint` plus `satisfy` in a view links a view to stakeholder concerns.

---

## 12. Standard view → diagram mapping in the daltskin extension

| Standard view | Extension diagram | What to expose |
| --- | --- | --- |
| `GeneralView` | General (ELK graph, like a BDD) | Definitions, packages, requirements |
| `InterconnectionView` | Interconnection (IBD) | A part usage or def with internal parts, ports and connections. `expose X` is framed; `expose X::*` is unframed. |
| `ActionFlowView` | Action Flow (activity) | An `action def` / action usage with successions |
| `StateTransitionView` | State Transition | A `state def` / exhibited state |
| `SequenceView` | Sequence | Parts with `message`/`flow` between them and `event occurrence`s |
| `BrowserView` | Tree | `Pkg::**` |
| `GridView` | Table | Elements to tabulate |
| `GeometryView` | **Not supported** by the renderer | — |

The extension also has Case (use cases), Package, Graph, Tree and Hierarchy diagrams, available from the visualizer menu or as `view:` names in Markdown.

---

## 13. Common mistakes

| Wrong | Right | Why |
| --- | --- | --- |
| `connect camera::power to x;` | `connect camera.power to x;` | `::` is namespace qualification; `.` navigates usages |
| `attribute m : Real = 5 [kg];` | `attribute m : MassValue = 5 [kg];` | Unit-bearing values need a quantity type |
| Using `PowerValue`, `kg` without imports | `private import ISQ::*; private import SI::*;` | Library types are not auto-visible in every tool |
| `part def Car : Vehicle;` | `part def Car :> Vehicle;` | `:` types a *usage*; definitions specialize with `:>` |
| `part engine :> Engine;` (meaning "typed by") | `part engine : Engine;` | `:>` on a usage subsets another *usage* |
| Redeclaring an inherited feature by name | `:>> engine : V8;` | Use redefinition to refine inherited features |
| A second, mirrored port def | `~FuelPort` | Conjugation flips directions |
| `transition A then B;` with no `first` | `transition first A then B;` | Named/full transitions need `first` |
| `public import` everywhere | `private import` | Avoid leaking names |
| A requirement with only a name | Add `doc`, `subject`, `require constraint` | So it renders, traces and can be checked |

---

## Sources

- OMG SysML v2 / KerML adoption: [OMG press release, 21 July 2025](https://www.omg.org/news/releases/pr2025/07-21-25.htm)
- Official release (specs, BNF, library, examples, training decks): [Systems-Modeling/SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release) and its [releases page](https://github.com/Systems-Modeling/SysML-v2-Release/releases)
- Training: *Intro to the SysML v2 Language – Textual Notation* (`doc/` in the release repo)
- VS Code extension: [daltskin/VSCode_SysML_Extension](https://github.com/daltskin/VSCode_SysML_Extension), language server [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp)
