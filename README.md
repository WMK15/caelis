<h1 align="center">Caelis</h1>

<p align="center">
  <a href="https://github.com/WMK15/caelis/actions/workflows/ci.yml?query=branch%3Amain"><img alt="CI" src="https://github.com/WMK15/caelis/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://nodejs.org/"><img alt="Node.js 24 LTS" src="https://img.shields.io/badge/Node.js-24%20LTS-339933?logo=node.js&logoColor=white"></a>
  <a href="https://pnpm.io/workspaces"><img alt="pnpm workspace" src="https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white"></a>
  <a href="https://modelcontextprotocol.io/"><img alt="Model Context Protocol compatible" src="https://img.shields.io/badge/Model%20Context%20Protocol-compatible-000000"></a>
  <a href="https://www.rpgmakerweb.com/products/rpg-maker-mz"><img alt="RPG Maker MZ" src="https://img.shields.io/badge/RPG%20Maker-MZ-8A2BE2"></a>
  <a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache--2.0-blue.svg"></a>
  <a href="#project-status"><img alt="Project status" src="https://img.shields.io/badge/status-early%20development-yellow"></a>
</p>

Caelis is a local-first development intelligence and automation toolkit for RPG Maker MZ. It gives MCP-compatible coding agents a safe, structured understanding of a game project and provides tools for project inspection, event generation, database automation, plugin integration, memory, validation, and playtest communication.

<a id="project-status"></a>

## Status

Caelis is in early development. The current repository is a strict TypeScript monorepo scaffold with project inspection, validation foundations, CLI commands, MCP tools, schema boundaries, and the first explicit plan-review-apply write workflow.

## What Caelis Is

- A local-first toolkit for RPG Maker MZ development intelligence.
- A safe interface for MCP-compatible agents such as OpenCode and Claude Code.
- A foundation for project scanning, event generation, database automation, plugin adapters, local memory, validation, and playtest communication.
- A guardrail layer that will preview, validate, apply, and revert changes through explicit change sets.

## What Caelis Is Not

- Not a replacement for the RPG Maker MZ editor.
- Not an unsupervised writer of project JSON.
- Not a proprietary plugin decompiler or documentation mirror.
- Not a runtime mod loader.
- Not a production plugin that should ship with games.

## Planned Features

- Inspect RPG Maker MZ projects, database records, maps, events, switches, variables, assets, and plugins.
- Search project structure and semantic references.
- Create and update database records through guarded semantic operations.
- Generate map events, common events, and troop events through an event AST.
- Integrate with plugins through public plugin commands, parameters, and notetags.
- Maintain local memory and canon through Caelis Codex.
- Validate, preview, apply, and revert changes safely.
- Communicate with a running playtest through a development-only bridge plugin.

## Repository Structure

```text
apps/cli                 Human CLI entry point
apps/mcp-server          MCP stdio server for agents
packages/core            Foundational types and errors
packages/config          .caelis/config.yaml schema and loader
packages/rmmz-schema     RPG Maker MZ runtime schemas
packages/project-index   Read-only scanner and validation
packages/project-write   Safe persisted plans and guarded project writes
packages/project-graph   In-memory entity relationship graph
packages/database        Semantic database operation types
packages/events          Event AST compiler/parser for common MZ commands
packages/codex           Local memory and canon interfaces
packages/guard           Change-set planning and validation
packages/adapter-sdk     Plugin adapter interfaces
packages/adapter-rmmz-native Native RPG Maker MZ adapter
packages/adapter-visustella VisuStella metadata, typing, and load-order adapter
packages/bridge-protocol Runtime bridge message types
packages/testing         Fixture and temporary project helpers
packages/shared          Shared utilities
plugins/rmmz             Development-only RPG Maker bridge plugin
skills                   Agent skill instructions
fixtures                 Small RPG Maker MZ-style fixture projects
docs                     Architecture, security, roadmap, and adapter docs
```

## Requirements

- Node.js 24 LTS
- pnpm 10.33.0

## Installation

```bash
pnpm install
```

## Development Commands

```bash
pnpm build
pnpm test
pnpm test:watch
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm typecheck
pnpm check
```

## CLI Usage

### Repository development

Build the CLI explicitly, then run the package-declared `caelis` binary from the repository root. `pnpm caelis` uses the already-built workspace executable and does not rebuild automatically.

```bash
pnpm build:cli
pnpm caelis --help
pnpm caelis scan fixtures/vanilla-minimal
```

Run `pnpm build:cli` again after changing files under `apps/cli/src`; otherwise `pnpm caelis` and `pnpm exec caelis` continue to use the previous build output.

### Workspace executable

After building the CLI package, pnpm can invoke the workspace binary directly.

```bash
pnpm build:cli
pnpm exec caelis --help
```

### Global development link

Expose the local CLI globally while developing from `apps/cli`.

```bash
cd apps/cli
pnpm link --global
caelis --help
```

If pnpm has not configured a global binary directory yet, run `pnpm setup`, restart the shell, then run `pnpm link --global` again.

Remove the global development link with:

```bash
pnpm uninstall --global @caelis/cli
```

### Command examples

```bash
pnpm caelis scan fixtures/vanilla-minimal
pnpm caelis validate fixtures/vanilla-minimal
pnpm caelis doctor fixtures/vanilla-minimal --json
pnpm caelis init fixtures/vanilla-minimal
pnpm caelis codex status fixtures/vanilla-minimal
pnpm caelis codex search "hero" fixtures/vanilla-minimal
```

## Project Editing

Caelis exposes guarded operations for all RPG Maker MZ database sections, System/Types/Terms, multi-page map events, common events, troop battle events, plugin configuration, and local plugin scaffolding. The CLI and MCP use the same plan-review-apply workflow with stale checks, backups, validation, and rollback.

See [Project Operations](docs/project-operations.md) for commands, MCP tools, supported event AST nodes, and the Character Generator boundary. VisuStella support and its safety boundary are documented in [VisuStella MZ Compatibility](docs/visustella-compatibility.md).

## MCP Server Example

Start the stdio MCP server with:

```bash
pnpm --filter @caelis/mcp-server dev
```

Inspection tools:

- `project_scan`
- `project_summary`
- `validation_report`
- `codex_status`
- `codex_search`
- `codex_get_entity`
- `database_list`, `database_get`
- `system_get`
- `map_get`, `map_event_get`
- `plugin_list`, `plugin_get`
- `visustella_status`, `visustella_plugin_get`
- `character_generator_status`

Plan/apply tools:

- `actor_create_plan`: persists a proposed RPG Maker MZ actor addition without modifying `data/Actors.json`.
- `database_record_create_plan`, `database_record_update_plan`
- `system_update_plan`, `map_event_upsert_plan`
- `event_compile`
- `plugin_configure_plan`, `plugin_create_plan`
- `visustella_parameter_update_plan`, `visustella_command_compile`
- `character_generator_launch`
- `change_plan_get`: reads a persisted plan for review.
- `change_apply`: applies a reviewed plan only when called with `confirm: true`, then backs up, atomically replaces, validates, and rolls back on validation failure.

Initial resources:

- `caelis://about`
- `caelis://product/architecture`

## Security Principles

- Local-first operation by default.
- No RPG Maker plugin execution during indexing.
- Read-only inspection remains separate from mutating tools.
- Plan-before-write for project changes.
- Mutating apply tools require explicit confirmation and a persisted reviewed plan.
- Applies create backups under `.caelis/backups/`, validate the result, and roll back on failed validation.
- Development-only runtime bridge with explicit enablement and token configuration.
- No copied proprietary plugin code or private documentation.

## Caelis Codex

Caelis Codex is the project-local memory and canon layer. It stores entities, aliases, assertions, relationships, sources, source chunks, decisions, sessions, and session memories in SQLite at `.caelis/caelis.sqlite3`.

SQLite was chosen because Caelis is local-first and each RPG Maker project should own a portable, serverless memory database. Drizzle was chosen for typed schema definitions and migration support. Prisma is not used because the initial Codex layer needs a small explicit SQLite implementation without a generated client or PostgreSQL assumptions.

Codex uses SQLite FTS5 for local full-text search over entity names and descriptions, aliases, assertions, source chunks, and decisions. Search input is treated as ordinary text by default, not raw FTS syntax. Backups are written under `.caelis/backups/`, and migrations create backups before changing an existing database.

Assertion states are `observed`, `inferred`, `proposed`, `approved`, `deprecated`, and `contradicted`. Caelis does not automatically approve AI-generated canon. RPG Maker files remain authoritative for technical project state and mutable RPG Maker IDs.

See `docs/codex.md` for the Codex architecture and recovery model.

## Roadmap

1. Foundation.
2. Read-only project intelligence.
3. Safe database writes.
4. Event AST and compiler.
5. Codex memory.
6. Plugin adapters.
7. Runtime bridge.
8. Desktop Hub.

See `docs/roadmap.md` for details.

## License

Apache License 2.0. See `LICENSE`.
