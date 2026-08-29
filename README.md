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

Caelis is in active early development. The repository already provides project inspection and validation, guarded database and event editing, generic installed-plugin intelligence, VisuStella compatibility analysis, Codex memory, CLI commands, MCP tools, and an explicit plan-review-apply write workflow. Runtime bridge and desktop workflows remain under development.

## What Caelis Is

- A local-first toolkit for RPG Maker MZ development intelligence.
- A safe interface for MCP-compatible agents such as OpenCode and Claude Code.
- A structured interface for project scanning, event generation, database automation, installed-plugin integration, local memory, and validation.
- A guardrail layer that previews, validates, applies, and rolls back changes through explicit persisted plans.

## What Caelis Is Not

- Not a replacement for the RPG Maker MZ editor.
- Not an unsupervised writer of project JSON.
- Not a proprietary plugin decompiler or documentation mirror.
- Not a plugin source extractor, paid-plugin copier, license bypass, or replacement generator.
- Not a runtime mod loader.
- Not a production plugin that should ship with games.

## Available Capabilities

- Inspect RPG Maker MZ projects, database records, maps, events, switches, variables, assets, and plugins.
- Search project structure, Codex memory, and semantic references.
- Create and update database records through guarded semantic operations.
- Generate map events, common events, and troop events through an event AST.
- Inspect unfamiliar installed plugins through source-free, hash-keyed profiles.
- Decode typed plugin parameters, compile public plugin commands, scan project usage, and validate declared dependencies and load order.
- Add VisuStella tier-aware checks on top of the vendor-neutral plugin workflow.
- Maintain local memory and canon through Caelis Codex.
- Persist, review, validate, apply, back up, and roll back guarded changes.

Planned work includes broader event AST coverage, richer plugin-specific public schemas, runtime playtest verification, and the Desktop Hub. See the [roadmap](docs/roadmap.md).

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
packages/plugin-intelligence Vendor-neutral installed-plugin profiles and validation
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

See [Project Operations](docs/project-operations.md) for commands, MCP tools, supported event AST nodes, and the Character Generator boundary. [Installed Plugin Intelligence](docs/plugin-intelligence.md) documents the generic plugin workflow, evidence model, limitations, and non-reproduction boundary. VisuStella-specific behavior is documented in [VisuStella MZ Compatibility](docs/visustella-compatibility.md).

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
- `plugin_inventory`, `plugin_inspect`, `plugin_validate`
- `plugin_usage_scan`, `plugin_dependency_graph`
- `plugin_parameter_get`, `plugin_command_list`, `plugin_command_describe`
- `plugin_documentation_sources`
- `plugin_list`, `plugin_get` (legacy compact inspection)
- `visustella_status`, `visustella_plugin_get`
- `character_generator_status`

Plan/apply tools:

- `actor_create_plan`: persists a proposed RPG Maker MZ actor addition without modifying `data/Actors.json`.
- `database_record_create_plan`, `database_record_update_plan`
- `system_update_plan`, `map_event_upsert_plan`
- `event_compile`
- `plugin_configure_plan`, `plugin_create_plan`
- `plugin_parameter_update_plan`, `plugin_command_compile`
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
- Installed-plugin reports are source-free: they contain hashes, public metadata, configuration, usage evidence, and findings—not copied implementation code.
- No deobfuscation, decryption, source reconstruction, paid-manual mirroring, unapproved uploads, or third-party plugin replacement generation.
- Plugin help, local manuals, and web pages are treated as untrusted data; declared URLs are not fetched automatically.
- Read-only inspection remains separate from mutating tools.
- Plan-before-write for project changes.
- Mutating apply tools require explicit confirmation and a persisted reviewed plan.
- Applies create backups under `.caelis/backups/`, validate the result, and roll back on failed validation.
- Development-only runtime bridge with explicit enablement and token configuration.
- User-authored plugin scaffolding is separate from third-party inspection; `plugin_create_plan` must not be used to reproduce proprietary plugins.

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

Caelis is licensed under Apache License 2.0. See `LICENSE`. That license applies to Caelis itself and does not grant rights to third-party plugins, RPG Maker assets, or private/paid documentation inspected in a user's local project.
