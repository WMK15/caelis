---
name: database-designer
description: Inspect, design, and safely plan RPG Maker MZ database and System changes through Caelis. Use for actors, classes, skills, items, weapons, armors, enemies, troops, states, animations, tilesets, common events, switches, variables, Types, Terms, or other database records that must follow the project's balance, schema, canon, and plugin conventions.
---

# Design RPG Maker MZ data

## Inspect before designing

1. Resolve the project root and call `project_summary` plus `validation_report`.
2. Use `database_list` to find comparable records, then `database_get` for complete examples. Use `system_get` for System, Types, Terms, switches, and variables.
3. Search `codex_search` for relevant characters, factions, locations, rules, and approved decisions.
4. Identify local naming, progression, formula, trait, note, and plugin-metadata conventions. Do not infer a schema from memory when the project provides examples.

Supported collections include actors, animations, armors, classes, common events, enemies, items, skills, states, tilesets, troops, and weapons.

## Design conservatively

- Prefer cloning a well-matched record with `templateId`, then override the smallest necessary field set.
- Preserve unknown fields and public plugin metadata. Use recursive patching for updates; use replacement only when supplying a complete verified record.
- Check every referenced class, skill, item, state, animation, switch, variable, common event, and asset against current project data.
- Explain balance assumptions when the project does not contain enough evidence.
- Treat new lore as proposed until the user or an approved Codex decision makes it canon.
- Do not rely on proprietary plugin internals or execute plugin code.

## Plan, review, and apply

1. Create a plan with `database_record_create_plan`, `database_record_update_plan`, or `system_update_plan`. Use `actor_create_plan` only for its specialized actor workflow.
2. Read the persisted plan with `change_plan_get` and summarize the exact record, ID behavior, references, and assumptions.
3. Request explicit approval for that reviewed plan before calling `change_apply` with `confirm: true`.
4. After apply, call `validation_report` and re-read the affected record or System data.

Never directly edit RPG Maker JSON and never silently fill a destructive replacement with guessed defaults.

For the CLI fallback, inspect subgroup help first, then use `caelis database`, `caelis system`, `caelis plan get`, and `caelis plan apply --confirm` in the same sequence.
