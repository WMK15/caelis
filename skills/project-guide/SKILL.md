---
name: project-guide
description: Orient and assist with an RPG Maker MZ project through Caelis. Use for broad project questions, initial project exploration, task routing, plugin and VisuStella inspection, Character Generator access, local Codex search, or any guarded Caelis workflow that spans database, map, event, plugin, and canon concerns.
---

# Guide a Caelis project

## Establish context

1. Resolve the RPG Maker MZ project root. Confirm it contains `Game.rmmzproject` and `data/` instead of guessing from the current working directory.
2. Prefer the Caelis MCP tools. If they are unavailable, use the equivalent `caelis` CLI commands.
3. Call `project_summary` first. Call `project_scan` when file-level inventory matters and `validation_report` before auditing or planning a change.
4. Search with `codex_search` when names, canon, prior decisions, or project-specific intent affect the answer. Treat project files as authoritative for mutable technical IDs and state.
5. Inspect the narrowest relevant target before proposing work: a database record, System data, map event, plugin, or Codex entity.

Avoid repeating broad scans when a current result is already available.

## Route specialist work

- Use `$project-auditor` for project health, broken references, convention drift, and risk reports.
- Use `$database-designer` for database records, switches, variables, Types, Terms, common events, and troop data.
- Use `$event-designer` for map events, common-event command lists, troop battle events, and event AST compilation.
- Use `$plugin-integrator` for unfamiliar installed RPG Maker plugins, updates, public command/parameter work, compatibility diagnosis, or any plugin workflow beyond a quick `plugin_list`/`plugin_get` lookup.

## Make guarded changes

1. Inspect the exact current value and relevant local conventions.
2. Create a persisted plan with the matching `*_plan` tool. Planning must not modify project data.
3. Retrieve the plan with `change_plan_get`. Explain the target files, intended effect, important assumptions, and validation implications.
4. Stop and request explicit approval for that reviewed plan. Do not treat the original feature request as approval to apply it.
5. After approval, call `change_apply` with the reviewed plan ID and `confirm: true`.
6. Run `validation_report` and re-read the changed target. Report any rollback or stale-plan failure plainly.

Never bypass this workflow by directly editing RPG Maker JSON. Never reuse a plan after the target file changes or after the 24-hour expiry window.

## Respect project boundaries

- Preserve existing naming, ID, balance, event-page, notetag, and plugin conventions.
- Treat unapproved generated lore as proposed. Do not present it as canon.
- Do not execute installed RPG Maker plugins while inspecting them.
- Introduce script commands or plugin commands only when the user accepts the added execution risk.
- Launch the RPG Maker Character Generator only after explicit confirmation; Caelis does not reproduce its renderer.

## Use the CLI fallback

Run `caelis --help` and the relevant subgroup help rather than inventing flags. The core fallback sequence is `caelis scan`, a targeted `caelis database|system|map|plugin` command, `caelis plan get`, `caelis plan apply --confirm`, and `caelis validate`.
