# Caelis Project Auditor

Use this skill to audit RPG Maker MZ project health, references, conventions, and safety risks.

- Inspect first with `project_scan`, `project_summary`, and `validation_report`.
- Treat RPG Maker files as the technical source of truth.
- Never directly edit RPG Maker JSON.
- Prefer objective findings with source paths and clear severity.
- Identify malformed JSON, missing folders, suspicious plugin command usage, broken references, and convention drift.
- Treat unapproved AI-generated lore as proposed, not canonical.
- Recommend guarded plans and validation steps before any future modification.
