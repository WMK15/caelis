---
name: event-designer
description: Inspect, design, compile, and safely plan RPG Maker MZ map events, common events, and troop battle events through Caelis. Use for dialogue, choices, conditions, switches, variables, transfers, quest flows, event pages, plugin commands, event AST nodes, or debugging event behavior while preserving project conventions.
---

# Design RPG Maker MZ events

## Gather the event context

1. Resolve the project root and call `project_summary` plus `validation_report`.
2. For map events, call `map_get` and `map_event_get`. For common events and troop pages, use `database_get` on the relevant record.
3. Inspect the switches, variables, common events, maps, and database records referenced by the flow. Search `codex_search` for related story state and approved decisions.
4. Find a nearby project event with similar trigger, page, and command patterns. Preserve local conventions unless the user requests a deliberate redesign.

## Model the behavior

- State the trigger, page priority, conditions, state transitions, success path, cancellation path, and repeat behavior before compiling commands.
- Preserve page settings such as image, movement, priority, trigger, and conditions when updating an event.
- Prefer supported AST nodes for dialogue, choices, conditional branches, switches, constant variable assignment, common-event calls, transfers, comments, waits, exit processing, scripts, and MZ plugin commands.
- Use `event_compile` to inspect generated command objects before placing them into a planned event.
- Use raw command objects only for commands the AST cannot represent, and explain why.
- Introduce script or plugin commands only with explicit user acceptance. Use `visustella_command_compile` for commands supported by installed public VisuStella metadata.
- Treat new quest or lore content as proposed until approved.

## Plan, review, and apply

1. Create map-event plans with `map_event_upsert_plan`. Plan common-event and troop-page changes with `database_record_update_plan`.
2. Retrieve the persisted plan with `change_plan_get`. Summarize page conditions, important command branches, references, and runtime risks.
3. Request explicit approval for that reviewed plan before calling `change_apply` with `confirm: true`.
4. After apply, call `validation_report` and re-read the event. Recommend a focused playtest path for behavior that static validation cannot prove.

Never directly edit RPG Maker JSON. Never discard existing pages or commands unless the reviewed plan makes that replacement explicit.

For the CLI fallback, inspect subgroup help first, then use `caelis map`, `caelis event-compile`, `caelis database`, and `caelis plan` in the same guarded sequence.
