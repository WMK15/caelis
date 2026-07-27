# Architecture

## System Diagram

```text
MCP agent
  -> @caelis/mcp-server
  -> project-index / rmmz-schema / project-graph / codex / guard
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
- `@caelis/project-graph`: in-memory entity relationship graph.
- `@caelis/database`: semantic database operation types.
- `@caelis/events`: event AST and initial compiler/parser.
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

Project files are scanned read-only. JSON data is parsed through schemas where available. Codex memory is stored locally in `.caelis/caelis.sqlite3` using SQLite and Drizzle migrations. Future write operations will become semantic operations, then guarded change sets, then previews, then approved file changes.

## MCP Architecture

The initial MCP server exposes only read-only tools: `project_scan`, `project_summary`, and `validation_report`. Mutation tools are intentionally absent until guard previews and revert workflows are implemented.

## Future Runtime Bridge

The bridge will be development-only and token-protected. It will communicate with a running playtest for status, active map, switches, variables, screenshots, teleportation, and common event execution.

## Source-of-Truth Rules

RPG Maker project files are the technical source of truth. Codex memory can store observations, proposals, relationships, sources, sessions, and decisions, but unapproved AI-generated lore is not canonical.

## Codex Storage

SQLite was chosen because Codex is local-first, project-scoped, embeddable, easy to back up, and available without a server. Drizzle was chosen because it provides typed schema definitions and migration tooling without requiring a long-running service. Prisma is intentionally not used because Caelis needs a small local SQLite layer, explicit migration control, and no generated client runtime.

Application code depends on the `CodexRepository` interface. `InMemoryCodexRepository` remains available for fast tests, while `SqliteCodexRepository` is the production implementation. Drizzle rows and SQLite handles are not part of public application APIs.
