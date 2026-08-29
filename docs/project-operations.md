# Project Operations

Caelis exposes the same guarded editing model through the CLI and MCP:

1. Inspect the current record, map, event, system data, or plugin.
2. Create a persisted plan. Planning never changes RPG Maker project data.
3. Review the plan with `caelis plan get` or `change_plan_get`.
4. Apply it with explicit confirmation. Apply checks for stale files, creates backups, writes atomically, validates the project, and rolls back on failure.

Plans expire after 24 hours. Backups and plans live below `.caelis/` in the RPG Maker project.

## Database Coverage

The `database` CLI group and generic MCP database tools support every array-backed RPG Maker MZ database section:

- actors
- animations
- armors
- classes
- commonEvents
- enemies
- items
- skills
- states
- tilesets
- troops, including troop battle-event pages
- weapons

`System.json` has separate `system` tools. Those cover System, Types, Terms, switches, and variables.

Creating with a `templateId` clones a complete existing record and recursively applies supplied fields before assigning a new ID. This is the safest way to preserve the project's RPG Maker and plugin-specific record shape. Updates recursively merge by default; use `replace` only when supplying a complete record.

## CLI Examples

````bash
# Inspect
caelis database list skills /path/to/game
caelis database get troops 4 /path/to/game
caelis system get /path/to/game
caelis map event-get 3 7 /path/to/game

# Plan a skill cloned from skill 10
caelis database create-plan skills /path/to/game \
  --template 10 \
  --json '{"name":"Greater Heal","mpCost":18}'

# Plan a multi-page event from a file
caelis map event-upsert-plan 3 /path/to/game --json @door-event.json

# Review and apply
caelis plan get plan_UUID /path/to/game
caelis plan apply plan_UUID /path/to/game --confirm

# Compile event AST to MZ command objects
caelis event-compile --json @event-nodes.json

# Plugins

Inspect any installed RPG Maker MZ plugin through a source-free exact-version
profile:

```sh
caelis plugin inventory /path/to/game
caelis plugin inspect MyPlugin /path/to/game
caelis plugin validate /path/to/game
caelis plugin usage /path/to/game --name MyPlugin
caelis plugin graph /path/to/game
caelis plugin params get MyPlugin /path/to/game
caelis plugin commands list MyPlugin /path/to/game
caelis plugin docs discover MyPlugin /path/to/game
````

Plan typed parameter changes or compile a declared plugin command:

```sh
caelis plugin params plan MyPlugin /path/to/game --values @parameters.json
caelis plugin commands compile MyPlugin DoThing /path/to/game --args @arguments.json
```

caelis plugin list /path/to/game
caelis plugin configure-plan MyPlugin /path/to/game \
--enable --parameters '{"Debug":"true"}'
caelis plugin create-plan QuestTools /path/to/game --spec @plugin-spec.json

# Locate or open the built-in Character Generator

caelis generator status /path/to/game --editor /path/to/RPGMZ.exe
caelis generator open /path/to/game --editor /path/to/RPGMZ.exe --confirm

```

Any `--json` option accepts inline JSON or `@path/to/file.json`. Plugin source uses `--source @path/to/plugin.js`.

## MCP Tools

Inspection:

- `database_list`, `database_get`
- `system_get`
- `map_get`, `map_event_get`
- `plugin_list`, `plugin_get`
- `plugin_inventory`, `plugin_inspect`, `plugin_validate`
- `plugin_usage_scan`, `plugin_dependency_graph`
- `plugin_parameter_get`, `plugin_parameter_update_plan`
- `plugin_command_list`, `plugin_command_describe`, `plugin_command_compile`
- `plugin_documentation_sources`
- `character_generator_status`

Planning and compilation:

- `database_record_create_plan`, `database_record_update_plan`
- `system_update_plan`
- `map_event_upsert_plan`
- `event_compile`
- `plugin_configure_plan`, `plugin_create_plan`
- `change_plan_get`, `change_apply`
- `character_generator_launch`

## Event Data

Map event input accepts an entire RPG Maker event object and any number of pages. Missing standard page fields receive RPG Maker MZ defaults, and each page command list receives a terminating command (`code: 0`) if necessary.

The event AST compiler supports dialogue, choices and choice bodies, script-based conditional branches, switches, constant variable assignment, common-event calls, player transfers, comments, waits, exit processing, script commands, and MZ plugin commands. Raw RPG Maker command objects remain available in map events, common events, and troop pages for commands not represented by the AST.

## Character Generator Boundary

RPG Maker MZ provides Character Generator as a built-in editor window, not as a documented command-line renderer. Caelis locates the editor and its generator assets and can launch the selected project with explicit confirmation. After launch, choose **Tools → Character Generator**. It does not reproduce the editor's generator or silently composite its bundled assets.
```
