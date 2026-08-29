# Caelis plugin workflows

## Tool map

| Goal                              | Prefer MCP                                                                 | CLI fallback                                            |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Inventory/profile                 | `plugin_inventory`, `plugin_inspect`                                       | `caelis plugin inventory`, `caelis plugin inspect`      |
| Validation/graph                  | `plugin_validate`, `plugin_dependency_graph`                               | `caelis plugin validate`, `caelis plugin graph`         |
| Usage impact                      | `plugin_usage_scan`                                                        | `caelis plugin usage`                                   |
| Parameter inspection/plan         | `plugin_parameter_get`, `plugin_parameter_update_plan`                     | `caelis plugin params get`, `caelis plugin params plan` |
| Command inspection/compile        | `plugin_command_list`, `plugin_command_describe`, `plugin_command_compile` | `caelis plugin commands list`, `describe`, `compile`    |
| Documentation discovery           | `plugin_documentation_sources`                                             | `caelis plugin docs discover`                           |
| VisuStella overlay                | `visustella_status`                                                        | `caelis visustella status`                              |
| Generic enable/order plan         | `plugin_configure_plan`                                                    | `caelis plugin configure-plan`                          |
| Generic event command compilation | `event_compile`                                                            | `caelis event-compile`                                  |
| Review/apply                      | `change_plan_get`, `change_apply`                                          | `caelis plan get`, `caelis plan apply --confirm`        |

Run `caelis <group> --help` before using an unfamiliar CLI form. Do not invent flags.

## Inventory and inspection

1. Run the project summary, scan, and validation once.
2. Inventory plugins, inspect the selected exact name and hashes, then validate configuration and dependency order.
3. Scan usage and re-read only candidate maps/records with Caelis read tools. Report unscanned paths and dynamic/script references.
4. For VisuStella, add its tier-specific status findings without replacing the generic profile.

## Parameter and command work

1. Identify the exact profiled plugin and public field/command. Reject an ambiguous name or changed hash.
2. Decode and validate structures with the generic typed parameter tools. Do not hand-encode nested arrays or structs.
3. Describe and compile a command before proposing the containing event. Retain exact declared argument names and do not infer undocumented semantics.
4. Check the compiled result against its planned event context, switch/variable conventions, and prior usage. Request explicit acceptance before introducing plugin commands or script-adjacent runtime risk.

## Guarded configuration workflow

1. Create the narrowest configuration or typed-parameter plan; planning must not write project data.
2. Retrieve the persisted plan and compare its target/profile with the inspection record. Discard a stale plan or a plan whose target changed.
3. Review the planned files, position/order changes, typed encoded values, affected usage, backup/rollback behavior, and static-validation limits.
4. Obtain explicit approval, apply with `confirm: true`, run validation, re-read the plugin configuration, and recommend a focused playtest.

## Version update diff and compatibility diagnosis

1. Capture the prior profile and bounded usage inventory before a user performs an external plugin-file update. Never replace a third-party plugin source through Caelis.
2. Capture the new profile afterward. Compare hashes, public header identity, parameter and command names/types/defaults, dependency/order declarations, enabled state/position, configured values, and observed project uses. Do not create or report a source-code diff.
3. Classify changes as declared, observed, documented, or inferred. Flag parameters or commands removed from the public surface but still observed in project use.
4. Diagnose with generic validation and dependency evidence; add `visustella_status` only where applicable. Distinguish a confirmed invalid configuration from a plausible conflict and an unproven runtime interaction.
5. Recommend a minimal playtest path and a rollback decision point. Do not claim compatibility solely because static checks pass.
