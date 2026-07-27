# Caelis Codex

Caelis Codex is the local memory and canon layer for each RPG Maker MZ project. It stores structured observations, proposed facts, approved canon decisions, source references, and session context in a project-local SQLite database at `.caelis/caelis.sqlite3`.

## Memory Scopes

- Project memory stores durable entities, aliases, assertions, relationships, sources, and decisions.
- Session memory stores temporary working context for an agent or user session.
- Approved canon remains explicit; AI-generated content starts as proposed unless a user or workflow approves it.

## Source-Of-Truth Hierarchy

RPG Maker project files remain authoritative for technical state such as IDs, maps, database records, events, switches, and variables. Codex records observations and decisions about those files, but it does not replace them as the mutable source of truth.

## Entities

Entities represent project concepts such as actors, maps, locations, factions, quests, items, or plugin-visible concepts. Each entity has a `project_id`, `entity_type`, stable `canonical_key`, display name, optional description, source references, external ID, and metadata JSON.

## Aliases

Aliases map alternate names to entities. Alias lookup uses normalized text so spacing and case differences resolve consistently.

## Assertions

Assertions are structured claims about entities. Status values are validated with Zod and can be:

- `observed`
- `inferred`
- `proposed`
- `approved`
- `deprecated`
- `contradicted`

Observed facts can come from project files. Inferred and proposed facts require caution. Approved facts are canon decisions. Deprecated and contradicted assertions remain visible for auditability.

## Relationships

Relationships connect entities with a typed edge such as `located-in`, `requires`, `rivals`, or `mentions`. They can include a source and metadata.

## Sources

Sources describe evidence such as project files, notes, user input, runtime observations, or agent outputs. Large source text is split into `source_chunks` for search.

## Decisions

Decisions record accepted design or canon choices, their reasoning, status, and optional source.

## Sessions

Sessions track an objective, status, start time, end time, and metadata. Session memories are intentionally scoped and can later be promoted through explicit workflows.

## Search

Codex uses SQLite FTS5 with an explicit `codex_search` virtual table. The repository indexes entity names and descriptions, aliases, assertion values, source chunks, and decisions inside the same transactions as writes. User search input is treated as ordinary text and tokenized before FTS queries so malformed syntax does not crash searches.

## Approval Workflow

Caelis does not automatically approve AI-generated lore. New memories can be proposed or inferred, while approval must be explicit. `autoApproveObservedFacts` exists as configuration but remains false by default.

## Retention Rules

The initial configuration retains session memory for 30 days. Automated retention cleanup is deferred until session memory promotion workflows are implemented.

## Database Recovery

Before migrations are applied to an existing database, Caelis creates a backup under `.caelis/backups/`. Manual backups use SQLite's backup API through `caelis codex backup`. `caelis codex verify` runs integrity checks, foreign-key checks, migration checks, and FTS consistency checks. `caelis codex rebuild-index` recreates search documents without deleting canonical memory data.
