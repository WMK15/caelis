# Roadmap

This roadmap is incremental. “Available” means a tested foundation exists in
the CLI/MCP packages; it does not imply complete coverage of every RPG Maker MZ
command or third-party runtime behavior.

## 1. Foundation — Available

Create the monorepo, strict TypeScript packages, schemas, CLI, MCP server, tests, and CI.

## 2. Read-Only Project Intelligence — Available, Expanding

Project scanning, database indexing, validation, graph foundations, asset metadata, Codex search, and source-free plugin metadata extraction are available. Coverage and semantic reference analysis continue to expand. Plugin extraction never executes plugin JavaScript.

## 3. Safe Database Writes — Available, Expanding

Guarded create/update operations cover all array-backed RPG Maker MZ database sections plus System, Types, Terms, switches, and variables. Persisted plans, stale checks, backups, atomic apply, validation, and automatic rollback are available; richer human previews remain planned.

## 4. Event AST And Compiler — Available, Expanding

Multi-page map events, common events, troop battle-event pages, a typed event AST, raw-command escape hatches, and typed plugin command 357 compilation are available. Additional native event commands and parsers remain planned.

## 5. Codex Memory — Foundation Available

Project-local SQLite storage, migrations and backups, entities, aliases, assertions, relationships, sources, decisions, sessions, FTS5 search, and explicit canon states are available. Higher-level promotion and collaboration workflows remain planned.

## 6. Plugin Intelligence And Adapters — Generic Layer Available

The vendor-neutral layer inventories exact installed versions, parses public MZ headers and nested parameter types, compiles public commands, scans static project usage, validates declared dependencies/order, and discovers documentation descriptors without executing or reproducing plugins. Native RPG Maker and VisuStella adapters add specialized behavior. Future work may add opt-in public schemas and synthetic contract packs, never proprietary source or copied paid manuals. See [Installed Plugin Intelligence](plugin-intelligence.md).

## 7. Runtime Bridge — Scaffold/Future

Implement the development-only playtest bridge with status, inspection, screenshots, safe runtime actions, and error reporting.

## 8. Desktop Hub — Future

Provide a local desktop interface for scans, previews, approvals, Codex management, bridge sessions, and agent workflows.
