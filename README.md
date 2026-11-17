# sysml-v2-demo

A SysML v2 model written in the standard textual notation.

## Tooling

Open this folder in VS Code and install the recommended extension, **SysML v2** (`JamieD.sysml-v2-support`, [source](https://github.com/daltskin/VSCode_SysML_Extension)). It gives you validation, navigation, the Model Explorer, the Model Workbench and interactive diagrams. Open any `.sysml` file and click **Show Model Visualizer**.

## Layout

| Path | Contents |
| --- | --- |
| `model/` | The model (`.sysml`), split by concern: requirements, structure, behaviour, configurations, verification, views |
| `docs/sysml-v2-language-guide.md` | SysML v2 language reference |
| `CLAUDE.md` | Modelling rules and conventions followed in this repo |
| `.mcp.json`, `tools/sysml-mcp.mjs` | Registers the extension's SysML MCP server (validation, symbols, diagrams) for Claude Code |

## System Design Specification

Generate a PDF System Design Specification from the model (diagrams, requirements, traceability, compliance):

```bash
npm install
npm run spec
```

The PDF is written to `build/spec/`. See [docs/spec-generator.md](docs/spec-generator.md).
