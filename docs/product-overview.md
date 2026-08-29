# Product Overview

## Product Vision

Caelis gives MCP-compatible agents a safe, structured understanding of RPG Maker MZ projects so they can inspect, reason, plan, validate, and eventually automate changes without treating project JSON as unstructured text.

## User Workflow

1. Initialize Caelis inside an RPG Maker MZ project.
2. Scan and validate the local project.
3. Ask an MCP-compatible agent to inspect maps, events, database records, plugins, assets, and canon notes.
4. Review generated plans and previews.
5. Approve guarded changes only after validation.

## Product Boundaries

Caelis is local-first and development-focused. It is not a replacement RPG Maker editor, a runtime mod loader, a proprietary plugin decompiler, documentation mirror, license bypass, replacement-plugin generator, or unsupervised writer of project files. Caelis can describe the public interface of the exact plugin copy installed by the user, but it does not reproduce implementation source or paid/private manuals.

## Major Modules

- Project index: read-only project detection, file indexing, and validation.
- RMMZ schema: fixture-driven runtime schemas for project data.
- Event AST: typed event representation and compiler boundary.
- Guard: change planning, validation, preview, apply, and revert boundaries.
- Codex: local canon and memory model.
- Adapters: public plugin command, parameter, and notetag integrations.
- Plugin intelligence: vendor-neutral, hash-keyed profiles, typed parameters and commands, dependency checks, documentation discovery, and static project-usage evidence without plugin execution.
- MCP server: agent-facing tools and resources.
- Runtime bridge: future development-only playtest communication.

## Implemented Foundation

The current foundation includes project inspection and validation; guarded operations across RPG Maker MZ database sections, System data, map events, common events, and troop event pages; event AST compilation; local Codex memory; generic installed-plugin intelligence; VisuStella tier checks; CLI and MCP surfaces; and agent skills for project, database, event, audit, and plugin workflows.

## Next Direction

Next work expands event coverage, public plugin-specific schemas, runtime bridge capabilities, project graph intelligence, richer previews, Desktop Hub workflows, and collaborative local memory. Static plugin validation will remain distinct from runtime certification.

See [Installed Plugin Intelligence](plugin-intelligence.md) for the evidence, licensing, non-reproduction, and runtime limitations of third-party plugin support.
