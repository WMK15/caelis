---
name: project-auditor
description: Audit an RPG Maker MZ project with Caelis for structural health, malformed data, broken references, plugin risks, and convention drift. Use when asked to review, diagnose, validate, assess project quality, investigate a suspicious RPG Maker project, or produce an evidence-backed health report without changing project files.
---

# Audit an RPG Maker MZ project

Keep the audit read-only unless the user separately asks for fixes.

## Inspect systematically

1. Resolve and verify the project root.
2. Call `project_summary`, `project_scan`, and `validation_report` once each. Use their current outputs throughout the audit.
3. Follow findings with targeted reads through `database_get`, `system_get`, `map_get`, `map_event_get`, `plugin_get`, or the VisuStella inspection tools.
4. Use `codex_search` only when canon, naming, or earlier design decisions help distinguish a defect from an intentional convention.
5. With the CLI fallback, use `caelis doctor --json` in addition to `scan` and `validate` when environment health matters.

Use `$plugin-integrator` for a deep investigation of an unfamiliar plugin, its public configuration, local profile, update impact, or compatibility evidence.

Do not execute installed plugins or directly edit RPG Maker JSON while investigating.

## Classify evidence

- **Critical:** likely data loss, an unreadable required file, or a project-wide blocker.
- **High:** a broken reference or configuration likely to fail during normal play.
- **Medium:** inconsistent behavior, unsafe plugin usage, or material convention drift.
- **Low:** maintainability, naming, or cleanup concern with limited runtime impact.

Separate confirmed findings from plausible risks. Dynamic script and plugin references may not be statically provable; label those limits instead of reporting false certainty.

## Report usefully

For every finding, give the severity, affected object or path, observed evidence, likely impact, and a concrete next action. Group repeated instances under one root cause. End with:

1. overall project health;
2. the highest-priority fixes;
3. validation gaps or uncertainties;
4. the guarded Caelis plan tools that could address the issues, without creating or applying plans unless requested.
