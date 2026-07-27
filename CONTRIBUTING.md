# Contributing

Caelis is in early development. Contributions should keep the foundation small,
typed, tested, and safe for local RPG Maker MZ projects.

Before opening a pull request:

1. Run `pnpm check`.
2. Add or update tests for changed behavior.
3. Avoid direct mutation of RPG Maker project files unless the change is part of
   an approved guarded write path.
4. Do not copy proprietary plugin code or documentation into this repository.

Use Changesets for package-facing changes with `pnpm changeset`.
