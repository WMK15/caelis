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

Caelis is local-first and development-focused. It is not a replacement RPG Maker editor, a runtime mod loader, a proprietary plugin decompiler, or an unsupervised writer of project files.

## Major Modules

- Project index: read-only project detection, file indexing, and validation.
- RMMZ schema: fixture-driven runtime schemas for project data.
- Event AST: typed event representation and compiler boundary.
- Guard: change planning, validation, preview, apply, and revert boundaries.
- Codex: local canon and memory model.
- Adapters: public plugin command, parameter, and notetag integrations.
- MCP server: agent-facing tools and resources.
- Runtime bridge: future development-only playtest communication.

## V1 Scope

V1 focuses on project inspection, validation, semantic planning, safe previews, initial database operations, event AST coverage, and a local Codex foundation.

## V2 Direction

V2 expands plugin adapters, runtime bridge capabilities, project graph intelligence, richer previews, Desktop Hub workflows, and collaborative local memory.
