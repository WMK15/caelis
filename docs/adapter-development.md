# Adapter Development

Adapters describe engine or plugin capabilities without embedding proprietary implementation details.

Use `@caelis/plugin-intelligence` for the universal installed-plugin surface
before creating a vendor- or plugin-specific adapter. It already profiles exact
local versions, parses public RPG Maker MZ headers and nested types, validates
declared dependencies and order, compiles public commands, and scans bounded
project usage without evaluating JavaScript. An adapter is appropriate when
licensed/public documentation supports additional semantics that cannot be
expressed by the generic metadata layer.

An adapter should:

- Detect whether it applies to a project using public project metadata.
- Declare capabilities such as switches, variables, database records, plugin commands, script commands, and notetags.
- Describe plugin commands with argument names, types, and requirements.
- Describe notetags through public syntax and project-observed usage.
- Report dependencies and validation issues.
- Never execute plugin JavaScript during detection or indexing.
- Record whether a claim is declared, observed, documented, or inferred.
- Link to official public documentation instead of copying a manual.
- Use synthetic fixtures; never commit a third-party plugin or paid manual as a test fixture.

The initial SDK exposes `PluginAdapter`, `AdapterDetectionContext`, `PluginCapability`, plugin command definitions, notetag definitions, dependencies, and validation issue types.

Future adapters can provide richer validators, templates, event AST helpers, and guarded operation generators while keeping writes behind Caelis Guard.

Adapters must not decrypt, deobfuscate, reconstruct, mirror, upload, or generate
a replacement for third-party plugin source. Catalogs and reports may contain
schemas, identifiers, hashes, concise findings, and links, but not copied
implementation code or private/paid documentation. See
[Installed Plugin Intelligence](plugin-intelligence.md) for the shared
non-reproduction and evidence boundary.
