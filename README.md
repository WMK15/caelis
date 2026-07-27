# Caelis

Caelis is a local-first development intelligence and automation toolkit for RPG Maker MZ. It gives MCP-compatible coding agents a safe, structured understanding of a game project and provides tools for project inspection, event generation, database automation, plugin integration, memory, validation, and playtest communication.

## Status

Caelis is in early development. The current repository is a strict TypeScript monorepo scaffold with read-only project inspection, validation foundations, CLI commands, MCP tools, schema boundaries, and future write-safety interfaces.

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
packages/project-graph   In-memory entity relationship graph
packages/database        Semantic database operation types
packages/events          Event AST and initial compiler/parser
packages/codex           Local memory and canon interfaces
packages/guard           Change-set planning and validation
packages/adapter-sdk     Plugin adapter interfaces
packages/adapter-rmmz-native Native RPG Maker MZ adapter
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

## CLI Examples

```bash
pnpm --filter @caelis/cli dev -- fixtures/vanilla-minimal scan
pnpm --filter @caelis/cli dev -- fixtures/vanilla-minimal validate
pnpm --filter @caelis/cli dev -- fixtures/vanilla-minimal doctor --json
pnpm --filter @caelis/cli dev -- fixtures/vanilla-minimal init
pnpm --filter @caelis/cli dev -- codex status fixtures/vanilla-minimal
pnpm --filter @caelis/cli dev -- codex search "hero" fixtures/vanilla-minimal
```

After building, the CLI binary is named `caelis`.

## MCP Server Example

Start the stdio MCP server with:

```bash
pnpm --filter @caelis/mcp-server dev
```

Initial read-only tools:

- `project_scan`
- `project_summary`
- `validation_report`
- `codex_status`
- `codex_search`
- `codex_get_entity`

Initial resources:

- `caelis://about`
- `caelis://product/architecture`

## Security Principles

- Local-first operation by default.
- No RPG Maker plugin execution during indexing.
- No mutation tools exposed in the initial MCP server.
- Preview-before-write for future changes.
- Change sets and revert paths before direct project writes.
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

## Contributing

Read `CONTRIBUTING.md`, keep APIs typed and documented, add tests for behavior, and run `pnpm check` before opening a pull request.

## License

Apache License 2.0. See `LICENSE`.
