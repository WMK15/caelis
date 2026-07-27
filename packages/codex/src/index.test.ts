import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  CodexConflictError,
  CodexPersistenceError,
  getCodexDatabasePath,
  InMemoryCodexRepository,
  SqliteCodexRepository,
  type AssertionStatus,
  type CodexRepository
} from "./index.js";

const projectId = "default";

describe("Codex repositories", () => {
  it("keeps interface parity between in-memory and SQLite implementations", async () => {
    await withRepositories(async (repository) => {
      const entity = await repository.createEntity({
        projectId,
        entityType: "actor",
        canonicalKey: "actor:1",
        name: "Hero",
        description: "The starting actor"
      });
      await repository.createAlias({
        projectId,
        entityId: entity.id,
        alias: "The Hero"
      });
      await repository.createAssertion({
        projectId,
        subjectEntityId: entity.id,
        predicate: "role",
        value: "protagonist",
        status: "observed"
      });

      expect(await repository.getEntity(entity.id)).toMatchObject({
        name: "Hero"
      });
      expect(
        await repository.getEntityByKey(projectId, "actor:1")
      ).toMatchObject({ id: entity.id });
      expect(
        await repository.resolveAlias(projectId, "the   hero")
      ).toMatchObject({ id: entity.id });
      expect(await repository.getAssertionsForEntity(entity.id)).toHaveLength(
        1
      );
      expect(
        await repository.search({ query: "Hero", limit: 5 })
      ).not.toHaveLength(0);
    });
  });

  it("initializes SQLite, creates directories, applies migrations, PRAGMAs, and reopens", async () => {
    const root = await createTempProject();
    try {
      const repository = new SqliteCodexRepository({ projectRoot: root });
      await repository.initialize();
      await repository.close();

      const databasePath = getCodexDatabasePath(root);
      expect(await stat(databasePath)).toBeDefined();

      const sqlite = new Database(databasePath);
      try {
        expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
        expect(sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
        expect(
          sqlite
            .prepare("SELECT name FROM sqlite_master WHERE name = 'entities'")
            .get()
        ).toBeDefined();
      } finally {
        sqlite.close();
      }

      const reopened = new SqliteCodexRepository({ projectRoot: root });
      await reopened.initialize();
      await reopened.close();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("creates entities, enforces canonical-key uniqueness, and rolls back failed writes", async () => {
    await withSqliteRepository(async (repository) => {
      await repository.createEntity({
        projectId,
        entityType: "actor",
        canonicalKey: "actor:1",
        name: "Hero"
      });
      await expect(
        repository.createEntity({
          projectId,
          entityType: "actor",
          canonicalKey: "actor:1",
          name: "Duplicate"
        })
      ).rejects.toThrow(CodexConflictError);

      const status = await repository.getStatus();
      expect(status.entityCount).toBe(1);
      expect(status.searchDocumentCount).toBe(1);
    });
  });

  it("creates aliases, relationships, assertions, sources, chunks, decisions, and sessions", async () => {
    await withSqliteRepository(async (repository) => {
      const hero = await repository.createEntity({
        projectId,
        entityType: "actor",
        canonicalKey: "actor:1",
        name: "Hero"
      });
      const rival = await repository.createEntity({
        projectId,
        entityType: "actor",
        canonicalKey: "actor:2",
        name: "Rival"
      });
      await repository.createAlias({
        projectId,
        entityId: hero.id,
        alias: "Protagonist"
      });
      const relationship = await repository.createRelationship({
        projectId,
        fromEntityId: hero.id,
        relationType: "rivals",
        toEntityId: rival.id
      });
      const assertion = await repository.createAssertion({
        projectId,
        subjectEntityId: hero.id,
        predicate: "home",
        value: { map: "Start" },
        status: "proposed"
      });
      const approved = await repository.updateAssertionStatus(
        assertion.id,
        "approved"
      );
      const source = await repository.createSource({
        projectId,
        sourceType: "project-file",
        title: "Actors",
        path: "data/Actors.json"
      });
      const chunk = await repository.createSourceChunk({
        sourceId: source.id,
        sequence: 0,
        content: "Hero begins in Start."
      });
      const decision = await repository.recordDecision({
        projectId,
        title: "Hero Name",
        decision: "Keep Hero as default name."
      });
      const session = await repository.createSession({
        projectId,
        objective: "Audit actors"
      });
      const ended = await repository.endSession(session.id);

      expect(
        await repository.resolveAlias(projectId, "protagonist")
      ).toMatchObject({ id: hero.id });
      expect(await repository.getRelationships(hero.id)).toEqual([
        relationship
      ]);
      expect(approved.status).toBe("approved");
      expect(chunk.content).toContain("Hero");
      expect(decision.status).toBe("approved");
      expect(ended.status).toBe("ended");
    });
  });

  it("validates assertion statuses and enforces foreign keys", async () => {
    await withSqliteRepository(async (repository) => {
      await expect(
        repository.createAssertion({
          projectId,
          subjectEntityId: "missing",
          predicate: "bad",
          value: true,
          status: "invalid" as AssertionStatus
        })
      ).rejects.toThrow();

      await expect(
        repository.createAlias({
          projectId,
          entityId: "missing",
          alias: "Ghost"
        })
      ).rejects.toThrow(CodexPersistenceError);
    });
  });

  it("indexes FTS documents, handles punctuation searches, rebuilds, verifies, and backs up", async () => {
    await withSqliteRepository(async (repository) => {
      const entity = await repository.createEntity({
        projectId,
        entityType: "location",
        canonicalKey: "map:1",
        name: "Moon Cave",
        description: "A cave with silver doors."
      });
      const source = await repository.createSource({
        projectId,
        sourceType: "note",
        title: "Moon Notes"
      });
      await repository.createSourceChunk({
        sourceId: source.id,
        sequence: 0,
        content: "Silver-key opens the Moon Cave."
      });
      await repository.createAssertion({
        projectId,
        subjectEntityId: entity.id,
        predicate: "requires",
        value: "silver key",
        status: "observed"
      });
      await repository.recordDecision({
        projectId,
        title: "Moon Rule",
        decision: "Silver key opens the cave."
      });

      expect(
        await repository.search({ query: "silver", limit: 10 })
      ).not.toHaveLength(0);
      expect(
        await repository.search({ query: "silver-key!!! (", limit: 10 })
      ).not.toHaveLength(0);

      await repository.rebuildIndex();
      expect(
        (await repository.getStatus()).searchDocumentCount
      ).toBeGreaterThan(0);

      const report = await repository.verify();
      expect(report.valid).toBe(true);

      const backupPath = await repository.backup("test");
      expect(await stat(backupPath)).toBeDefined();
    });
  });
});

async function withRepositories(
  run: (repository: CodexRepository) => Promise<void>
): Promise<void> {
  const memory = new InMemoryCodexRepository();
  await memory.initialize();
  await run(memory);
  await memory.close();

  await withSqliteRepository(run);
}

async function withSqliteRepository(
  run: (repository: SqliteCodexRepository) => Promise<void>
): Promise<void> {
  const root = await createTempProject();
  const repository = new SqliteCodexRepository({ projectRoot: root });
  try {
    await repository.initialize();
    await run(repository);
  } finally {
    await repository.close();
    await rm(root, { force: true, recursive: true });
  }
}

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "caelis-codex-"));
  await mkdir(path.join(root, "data"), { recursive: true });
  return root;
}
