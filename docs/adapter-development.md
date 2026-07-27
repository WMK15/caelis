# Adapter Development

Adapters describe engine or plugin capabilities without embedding proprietary implementation details.

An adapter should:

- Detect whether it applies to a project using public project metadata.
- Declare capabilities such as switches, variables, database records, plugin commands, script commands, and notetags.
- Describe plugin commands with argument names, types, and requirements.
- Describe notetags through public syntax and project-observed usage.
- Report dependencies and validation issues.
- Never execute plugin JavaScript during detection or indexing.

The initial SDK exposes `PluginAdapter`, `AdapterDetectionContext`, `PluginCapability`, plugin command definitions, notetag definitions, dependencies, and validation issue types.

Future adapters can provide richer validators, templates, event AST helpers, and guarded operation generators while keeping writes behind Caelis Guard.
