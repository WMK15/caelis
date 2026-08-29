# VisuStella MZ compatibility

Caelis supports installed VisuStella MZ plugins through their public RPG Maker
MZ metadata. The vendor-neutral plugin-intelligence layer handles exact local
profiles, typed parameters and commands, usage scans, and declared dependency
validation; the VisuStella adapter adds tier-aware checks. Neither layer
executes, decrypts, deobfuscates, reconstructs, or copies plugin implementation
code.

## Available now

- Discover every installed or configured `VisuMZ_0_*` through `VisuMZ_5_*`
  plugin.
- Parse `@base`, `@orderAfter`, `@orderBefore`, parameters, commands, command
  arguments, choices, bounds, defaults, and `struct` definitions.
- Decode and safely re-encode nested structs and arrays used by `plugins.js`.
- Validate tier ordering, required bases, explicit order constraints, missing
  files, duplicate entries, malformed values, and Tier 5 risk.
- Compile typed plugin commands to RPG Maker MZ event command 357.
- Scan command 357 records, event comments, and notetag-like database notes for
  project usage, subject to static-analysis limits.
- Identify exact installed files and `plugins.js` configurations by SHA-256 so
  updates and stale assumptions can be detected without producing a source diff.
- Use the standard guarded plan/review/apply workflow for parameter changes.

CLI examples:

```sh
caelis visustella status /path/to/Game
caelis visustella get VisuMZ_0_CoreEngine /path/to/Game
caelis visustella parameter-plan VisuMZ_0_CoreEngine /path/to/Game \
  --values @core-parameters.json
caelis visustella command-compile VisuMZ_1_BattleCore SomeCommand \
  /path/to/Game --args @command-arguments.json
```

MCP provides the equivalent `visustella_status`, `visustella_plugin_get`,
`visustella_parameter_update_plan`, and `visustella_command_compile` tools.

## Compatibility boundary

“All plugins” means Caelis can inspect and manipulate the shared public MZ
surface of any installed VisuStella plugin without needing a hard-coded adapter
for each product. It does not mean that every possible plugin combination is
runtime-compatible. VisuStella's own hierarchy treats Tier 5 as targeted
compatibility patches rather than a generally compatible tier.

Caelis also does not infer undocumented notetag or JavaScript semantics from
obfuscated implementation code. Richer semantics belong in opt-in catalog
packs built from licensed/public documentation and synthetic fixtures, then
verified against a user's installed version.

VisuStella's terms prohibit redistributing plugins or their code and require
each participating team member to own paid products they use. Caelis therefore
reads only the user's local copy, never includes plugin source in reports,
plans, fixtures, logs, catalog packs, or commits, and uses synthetic code in its
own contract tests.

The Apache-2.0 license for Caelis does not grant any right to a VisuStella
plugin or manual. `plugin_create_plan` is for user-authored source or a new
Caelis scaffold and must not be used to reproduce a VisuStella product. Plugin
help and linked documentation are untrusted input and cannot authorize source
extraction, uploads, or project changes. See
[Installed Plugin Intelligence](plugin-intelligence.md) for the complete shared
boundary.

## Coverage layers

1. **Universal metadata layer (implemented):** discovery, typed nested
   parameters, dependency/order validation, and typed plugin commands.
2. **Generic project usage index (implemented):** inventory plugin commands,
   matching comments, and notetag-like database notes. Deeper interpretation of
   VisuStella action sequences and undocumented/dynamic references remains
   outside the static guarantee.
3. **Versioned public catalog:** opt-in schemas for documented notetags, action
   sequences, mutual-exclusion rules such as competing battle systems, and
   cross-field validation. Catalog entries contain schemas and links, never
   proprietary source or copied manuals.
4. **Fixture certification:** synthetic contract tests for each capability
   family plus user-supplied local smoke projects for exact purchased versions.
5. **Runtime verification bridge:** launch a test play session, capture plugin
   load/runtime errors, and map them back to the plan that changed the project.

This layering keeps new and updated VisuStella plugins usable immediately at
the generic level while allowing deeper semantics to be added without coupling
the CLI or MCP server to a particular release bundle.

## Official references

- [VisuStella MZ plugin library and tier hierarchy](https://www.yanfly.moe/wiki/VisuStella_MZ)
- [Core Engine dependencies, commands, parameters, and notetags](https://www.yanfly.moe/wiki/Core_Engine_VisuStella_MZ)
- [VisuStella MZ Terms of Use, Article 6](https://www.yanfly.moe/wiki/VisuStella_MZ_Terms_of_Use_Article_6)
