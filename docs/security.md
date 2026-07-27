# Security

## Local-First Operation

Caelis is designed to operate on local project files. Networked behavior is limited to explicitly configured development tooling.

## No Plugin Execution During Indexing

The project indexer lists plugin JavaScript files but never imports, evaluates, or executes them.

## Preview Before Write

Initial tooling is read-only. Future mutation paths must produce change sets, previews, and validation reports before applying writes.

## Backups And Change Sets

Future apply operations should record change-set metadata, source hashes, and backup or revert data before changing project files.

## Project Path Restrictions

Guarded operations must reject absolute paths, parent directory traversal, empty paths, and files outside the approved project root.

## Bridge Security

The runtime bridge is development-only. It should require an enabled flag, a local port, a session token, read-only mode by default, and clear warnings against shipping it in production builds.

## Proprietary Plugin Boundaries

Caelis may inspect public plugin commands, parameters, and notetags exposed in a user's project. It must not copy proprietary plugin code or private documentation into this repository.
