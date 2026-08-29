# Fixtures

Fixtures are small RPG Maker MZ-style projects used for schema and scanner development.

- `vanilla-minimal` is a tiny valid project skeleton.
- `broken-references` is reserved for future validation cases.

Fixture source files are committed. Local copies created by tests should be placed under ignored `.local` or `copy-*` paths.

Plugin fixtures must be synthetic and authored for Caelis tests. Do not add a
third-party plugin, extracted implementation fragment, obfuscated commercial
bundle, or private/paid manual to this directory. Tests may model a public MZ
header, parameter encoding, command declaration, dependency, or documented
behavior with original minimal fixture code.
