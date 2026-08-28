# Architecture

## System Diagram

```text
MCP agent
  -> @caelis/mcp-server
  -> project-index / project-write / rmmz-schema / project-graph / codex / guard
  -> local RPG Maker MZ project files

RPG Maker MZ playtest
  -> CaelisBridge plugin (future WebSocket)
  -> bridge-protocol
  -> local Caelis tooling
```

## Package Responsibilities

- `@caelis/core`: foundational types and typed errors.
- `@caelis/shared`: reusable hashing, JSON, path, and result utilities.
- `@caelis/config`: `.caelis/config.yaml` schema and loading.
- `@caelis/rmmz-schema`: fixture-driven RPG Maker MZ Zod schemas.
- `@caelis/project-index`: read-only project scanning and validation.
- `@caelis/project-write`: persisted write plans and guarded apply operations for RPG Maker project files.
- `@caelis/project-graph`: in-memory entity relationship graph.
- `@caelis/database`: semantic database operation types.
- `@caelis/events`: event AST compiler/parser for common MZ commands.
- `@caelis/codex`: SQLite-backed local memory, canon interfaces, migrations, and FTS5 search.
- `@caelis/guard`: change-set planning and validation boundary.
- `@caelis/adapter-sdk`: plugin adapter contracts.
- `@caelis/adapter-rmmz-native`: native RPG Maker MZ capabilities.
- `@caelis/bridge-protocol`: future runtime bridge message types.
- `@caelis/testing`: fixture and temporary project helpers.
- `@caelis/cli`: human CLI commands.
- `@caelis/mcp-server`: stdio MCP tools and resources.
- `@caelis/rmmz-bridge`: development-only RPG Maker plugin scaffold.

## Data Flow

Project files are scanned read-only. JSON data is parsed through schemas where available. Codex memory is stored locally in `.caelis/caelis.sqlite3` using SQLite and Drizzle migrations. Write operations are split into persisted plans and explicit applies: planning records proposed file content and source hashes without modifying RPG Maker data, while apply requires confirmation, creates backups, atomically replaces files, validates, and rolls back on failed validation.

## MCP Architecture

The MCP server keeps inspection, planning, and mutation separate. Read-only tools inspect the project, every database section, maps, events, system data, plugins, and Codex. Planning tools persist proposed database, system, multi-page map-event, and plugin changes without touching project data; `change_plan_get` retrieves a plan for review; `change_apply` is the only project-file mutating step and requires `confirm: true` plus a valid, non-stale plan. Multi-file plugin plans are backed up and rolled back as one operation.

## Future Runtime Bridge

The bridge will be development-only and token-protected. It will communicate with a running playtest for status, active map, switches, variables, screenshots, teleportation, and common event execution.

## Source-of-Truth Rules

RPG Maker project files are the technical source of truth. Codex memory can store observations, proposals, relationships, sources, sessions, and decisions, but unapproved AI-generated lore is not canonical.

## Codex Storage

SQLite was chosen because Codex is local-first, project-scoped, embeddable, easy to back up, and available without a server. Drizzle was chosen because it provides typed schema definitions and migration tooling without requiring a long-running service. Prisma is intentionally not used because Caelis needs a small local SQLite layer, explicit migration control, and no generated client runtime.

Application code depends on the `CodexRepository` interface. `InMemoryCodexRepository` remains available for fast tests, while `SqliteCodexRepository` is the production implementation. Drizzle rows and SQLite handles are not part of public application APIs.
