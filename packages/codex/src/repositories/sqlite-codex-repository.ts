import { and, eq, like, or } from "drizzle-orm";

import { createLogger } from "@caelis/shared";

import {
  CodexConflictError,
  CodexConnectionError,
  CodexNotFoundError,
  CodexPersistenceError
} from "../errors.js";
import {
  assertionStatusSchema,
  type AssertionStatus,
  type CodexAssertion,
  type CreateAssertionInput
} from "../models/assertion.js";
import type { CodexDecision, RecordDecisionInput } from "../models/decision.js";
import {
  jsonValueSchema,
  type CodexEntity,
  type CreateAliasInput,
  type CreateEntityInput,
  type EntityAlias,
  type EntitySearchQuery,
  type JsonValue,
  type UpdateEntityInput
} from "../models/entity.js";
import type {
  CodexRelationship,
  CreateRelationshipInput
} from "../models/relationship.js";
import type { CodexSession, CreateSessionInput } from "../models/session.js";
import type {
  CodexSource,
  CodexSourceChunk,
  CreateSourceChunkInput,
  CreateSourceInput
} from "../models/source.js";
import type {
  CodexSearchQuery,
  CodexSearchResult
} from "../search/codex-search.js";
import {
  countSearchDocuments,
  indexSearchDocument,
  rebuildCodexSearchIndex,
  searchCodexIndex,
  verifySearchDocuments
} from "../search/fts-index.js";
import { createCodexId, normalizeAlias, nowMs } from "../utils.js";
import {
  getCodexDatabasePath,
  openCodexConnection,
  type CodexConnection
} from "../database/connection.js";
import { parseJson, serializeJson } from "../database/json.js";
import {
  createCodexBackup,
  runCodexMigrations
} from "../database/migrations.js";
import {
  assertions,
  decisions,
  entities,
  entityAliases,
  relationships,
  sessions,
  sourceChunks,
  sources,
  projects,
  type AssertionRow,
  type DecisionRow,
  type EntityAliasRow,
  type EntityRow,
  type RelationshipRow,
  type SessionRow,
  type SourceChunkRow,
  type SourceRow
} from "../database/schema.js";
import type { CodexRepository } from "./codex-repository.js";

const log = createLogger("codex:sqlite");

export interface SqliteCodexRepositoryOptions {
  projectRoot: string;
  projectName?: string;
  engine?: "RPG_MAKER_MZ";
}

export interface CodexStatus {
  databasePath: string;
  databaseSize: number;
  schemaVersion: number;
  entityCount: number;
  assertionCount: number;
  relationshipCount: number;
  sourceCount: number;
  searchDocumentCount: number;
}

export interface CodexVerificationReport {
  valid: boolean;
  integrity: string[];
  foreignKeys: string[];
  migrationVersion: string;
  search: string[];
}

/** SQLite-backed production Codex repository. */
export class SqliteCodexRepository implements CodexRepository {
  private connection: CodexConnection | undefined;

  public constructor(private readonly options: SqliteCodexRepositoryOptions) {}

  public async initialize(): Promise<void> {
    log.info(
      { databasePath: getCodexDatabasePath(this.options.projectRoot) },
      "Initializing Codex database"
    );
    this.connection = openCodexConnection(this.options.projectRoot);
    await runCodexMigrations(this.connection);
  }

  public close(): Promise<void> {
    if (this.connection?.sqlite.open) {
      this.connection.sqlite.close();
      log.info({ databasePath: this.connection.path }, "Closed Codex database");
    }
    this.connection = undefined;
    return Promise.resolve();
  }

  public createEntity(input: CreateEntityInput): Promise<CodexEntity> {
    return this.writeAsync(() => {
      this.ensureProject(input.projectId);
      const timestamp = nowMs();
      const row = {
        id: input.id ?? createCodexId("ent"),
        projectId: input.projectId,
        entityType: input.entityType,
        canonicalKey: input.canonicalKey,
        name: input.name,
        description: input.description ?? null,
        sourceKind: input.sourceKind ?? null,
        sourcePath: input.sourcePath ?? null,
        externalId: input.externalId ?? null,
        metadataJson:
          input.metadata === undefined ? null : serializeJson(input.metadata),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const created = this.conn.db
        .insert(entities)
        .values(row)
        .returning()
        .get();
      indexSearchDocument(this.conn.sqlite, {
        documentId: created.id,
        projectId: created.projectId,
        documentType: "entity",
        title: created.name,
        content: created.description ?? "",
        tags: created.entityType
      });
      return mapEntity(created);
    });
  }

  public updateEntity(
    id: string,
    input: UpdateEntityInput
  ): Promise<CodexEntity> {
    return this.writeAsync(() => {
      const existing = this.conn.db
        .select()
        .from(entities)
        .where(eq(entities.id, id))
        .get();
      if (!existing) {
        throw new CodexNotFoundError("Codex entity was not found.", { id });
      }
      const updated = this.conn.db
        .update(entities)
        .set({
          ...(input.entityType !== undefined
            ? { entityType: input.entityType }
            : {}),
          ...(input.canonicalKey !== undefined
            ? { canonicalKey: input.canonicalKey }
            : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.sourceKind !== undefined
            ? { sourceKind: input.sourceKind }
            : {}),
          ...(input.sourcePath !== undefined
            ? { sourcePath: input.sourcePath }
            : {}),
          ...(input.externalId !== undefined
            ? { externalId: input.externalId }
            : {}),
          ...(input.metadata !== undefined
            ? {
                metadataJson:
                  input.metadata === null ? null : serializeJson(input.metadata)
              }
            : {}),
          updatedAt: nowMs()
        })
        .where(eq(entities.id, id))
        .returning()
        .get();
      indexSearchDocument(this.conn.sqlite, {
        documentId: updated.id,
        projectId: updated.projectId,
        documentType: "entity",
        title: updated.name,
        content: updated.description ?? "",
        tags: updated.entityType
      });
      return mapEntity(updated);
    });
  }

  public getEntity(id: string): Promise<CodexEntity | undefined> {
    const row = this.conn.db
      .select()
      .from(entities)
      .where(eq(entities.id, id))
      .get();
    return Promise.resolve(row ? mapEntity(row) : undefined);
  }

  public getEntityByKey(
    projectId: string,
    canonicalKey: string
  ): Promise<CodexEntity | undefined> {
    const row = this.conn.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.projectId, projectId),
          eq(entities.canonicalKey, canonicalKey)
        )
      )
      .get();
    return Promise.resolve(row ? mapEntity(row) : undefined);
  }

  public findEntities(query: EntitySearchQuery): Promise<CodexEntity[]> {
    const conditions = [
      query.projectId ? eq(entities.projectId, query.projectId) : undefined,
      query.entityType ? eq(entities.entityType, query.entityType) : undefined,
      query.text
        ? or(
            like(entities.name, `%${query.text}%`),
            like(entities.description, `%${query.text}%`)
          )
        : undefined
    ].filter((condition) => condition !== undefined);
    const rows =
      conditions.length > 0
        ? this.conn.db
            .select()
            .from(entities)
            .where(and(...conditions))
            .limit(query.limit ?? 25)
            .all()
        : this.conn.db
            .select()
            .from(entities)
            .limit(query.limit ?? 25)
            .all();
    return Promise.resolve(rows.map(mapEntity));
  }

  public createAlias(input: CreateAliasInput): Promise<EntityAlias> {
    return this.writeAsync(() => {
      this.ensureProject(input.projectId);
      const row = {
        id: input.id ?? createCodexId("alias"),
        projectId: input.projectId,
        entityId: input.entityId,
        alias: input.alias,
        normalizedAlias: normalizeAlias(input.alias),
        createdAt: nowMs()
      };
      const created = this.conn.db
        .insert(entityAliases)
        .values(row)
        .returning()
        .get();
      indexSearchDocument(this.conn.sqlite, {
        documentId: created.entityId,
        projectId: created.projectId,
        documentType: "alias",
        title: created.alias,
        content: created.alias
      });
      return mapAlias(created);
    });
  }

  public resolveAlias(
    projectId: string,
    alias: string
  ): Promise<CodexEntity | undefined> {
    const found = this.conn.db
      .select({ entity: entities })
      .from(entityAliases)
      .innerJoin(entities, eq(entities.id, entityAliases.entityId))
      .where(
        and(
          eq(entityAliases.projectId, projectId),
          eq(entityAliases.normalizedAlias, normalizeAlias(alias))
        )
      )
      .get();
    return Promise.resolve(found ? mapEntity(found.entity) : undefined);
  }

  public createRelationship(
    input: CreateRelationshipInput
  ): Promise<CodexRelationship> {
    return this.writeAsync(() => {
      this.ensureProject(input.projectId);
      const timestamp = nowMs();
      const created = this.conn.db
        .insert(relationships)
        .values({
          id: input.id ?? createCodexId("rel"),
          projectId: input.projectId,
          fromEntityId: input.fromEntityId,
          relationType: input.relationType,
          toEntityId: input.toEntityId,
          status: input.status ?? "observed",
          sourceId: input.sourceId ?? null,
          metadataJson:
            input.metadata === undefined ? null : serializeJson(input.metadata),
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
      return mapRelationship(created);
    });
  }

  public getRelationships(entityId: string): Promise<CodexRelationship[]> {
    const rows = this.conn.db
      .select()
      .from(relationships)
      .where(
        or(
          eq(relationships.fromEntityId, entityId),
          eq(relationships.toEntityId, entityId)
        )
      )
      .all();
    return Promise.resolve(rows.map(mapRelationship));
  }

  public createAssertion(input: CreateAssertionInput): Promise<CodexAssertion> {
    return this.writeAsync(() => {
      const status = assertionStatusSchema.parse(input.status);
      this.ensureProject(input.projectId);
      const timestamp = nowMs();
      const created = this.conn.db
        .insert(assertions)
        .values({
          id: input.id ?? createCodexId("assert"),
          projectId: input.projectId,
          subjectEntityId: input.subjectEntityId,
          predicate: input.predicate,
          valueJson: serializeJson(input.value),
          status,
          confidence: input.confidence ?? null,
          sourceId: input.sourceId ?? null,
          approvedBy: input.approvedBy ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
      indexSearchDocument(this.conn.sqlite, {
        documentId: created.id,
        projectId: created.projectId,
        documentType: "assertion",
        title: created.predicate,
        content: created.valueJson,
        tags: created.status
      });
      return mapAssertion(created);
    });
  }

  public updateAssertionStatus(
    assertionId: string,
    status: AssertionStatus
  ): Promise<CodexAssertion> {
    return this.writeAsync(() => {
      const parsedStatus = assertionStatusSchema.parse(status);
      const updated = this.conn.db
        .update(assertions)
        .set({ status: parsedStatus, updatedAt: nowMs() })
        .where(eq(assertions.id, assertionId))
        .returning()
        .get() as AssertionRow | undefined;
      if (!updated) {
        throw new CodexNotFoundError("Codex assertion was not found.", {
          assertionId
        });
      }
      indexSearchDocument(this.conn.sqlite, {
        documentId: updated.id,
        projectId: updated.projectId,
        documentType: "assertion",
        title: updated.predicate,
        content: updated.valueJson,
        tags: updated.status
      });
      return mapAssertion(updated);
    });
  }

  public getAssertionsForEntity(entityId: string): Promise<CodexAssertion[]> {
    const rows = this.conn.db
      .select()
      .from(assertions)
      .where(eq(assertions.subjectEntityId, entityId))
      .all();
    return Promise.resolve(rows.map(mapAssertion));
  }

  public createSource(input: CreateSourceInput): Promise<CodexSource> {
    return this.writeAsync(() => {
      this.ensureProject(input.projectId);
      const timestamp = nowMs();
      const created = this.conn.db
        .insert(sources)
        .values({
          id: input.id ?? createCodexId("src"),
          projectId: input.projectId,
          sourceType: input.sourceType,
          title: input.title,
          path: input.path ?? null,
          contentHash: input.contentHash ?? null,
          metadataJson:
            input.metadata === undefined ? null : serializeJson(input.metadata),
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
      return mapSource(created);
    });
  }

  public createSourceChunk(
    input: CreateSourceChunkInput
  ): Promise<CodexSourceChunk> {
    return this.writeAsync(() => {
      const source = this.conn.db
        .select()
        .from(sources)
        .where(eq(sources.id, input.sourceId))
        .get();
      if (!source) {
        throw new CodexNotFoundError("Codex source was not found.", {
          sourceId: input.sourceId
        });
      }
      const created = this.conn.db
        .insert(sourceChunks)
        .values({
          id: input.id ?? createCodexId("chunk"),
          sourceId: input.sourceId,
          sequence: input.sequence,
          content: input.content,
          tokenCount: input.tokenCount ?? null,
          metadataJson:
            input.metadata === undefined ? null : serializeJson(input.metadata),
          createdAt: nowMs()
        })
        .returning()
        .get();
      indexSearchDocument(this.conn.sqlite, {
        documentId: `${source.id}:${created.id}`,
        projectId: source.projectId,
        documentType: "source_chunk",
        title: source.title,
        content: created.content
      });
      return mapSourceChunk(created);
    });
  }

  public recordDecision(input: RecordDecisionInput): Promise<CodexDecision> {
    return this.writeAsync(() => {
      this.ensureProject(input.projectId);
      const timestamp = nowMs();
      const created = this.conn.db
        .insert(decisions)
        .values({
          id: input.id ?? createCodexId("decision"),
          projectId: input.projectId,
          title: input.title,
          decision: input.decision,
          reasoning: input.reasoning ?? null,
          status: input.status ?? "approved",
          sourceId: input.sourceId ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
      indexSearchDocument(this.conn.sqlite, {
        documentId: created.id,
        projectId: created.projectId,
        documentType: "decision",
        title: created.title,
        content: `${created.decision}\n${created.reasoning ?? ""}`,
        tags: created.status
      });
      return mapDecision(created);
    });
  }

  public createSession(input: CreateSessionInput): Promise<CodexSession> {
    return this.writeAsync(() => {
      this.ensureProject(input.projectId);
      const created = this.conn.db
        .insert(sessions)
        .values({
          id: input.id ?? createCodexId("session"),
          projectId: input.projectId,
          objective: input.objective ?? null,
          status: "active",
          startedAt: nowMs(),
          endedAt: null,
          metadataJson:
            input.metadata === undefined ? null : serializeJson(input.metadata)
        })
        .returning()
        .get();
      return mapSession(created);
    });
  }

  public endSession(sessionId: string): Promise<CodexSession> {
    return this.writeAsync(() => {
      const updated = this.conn.db
        .update(sessions)
        .set({ status: "ended", endedAt: nowMs() })
        .where(eq(sessions.id, sessionId))
        .returning()
        .get() as SessionRow | undefined;
      if (!updated) {
        throw new CodexNotFoundError("Codex session was not found.", {
          sessionId
        });
      }
      return mapSession(updated);
    });
  }

  public search(query: CodexSearchQuery): Promise<CodexSearchResult[]> {
    return Promise.resolve(searchCodexIndex(this.conn.sqlite, query));
  }

  public getStatus(): Promise<CodexStatus> {
    const schemaVersion = this.conn.sqlite
      .prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
      .get() as { count: number };
    return Promise.resolve({
      databasePath: this.conn.path,
      databaseSize: this.conn.sqlite
        .prepare(
          "SELECT page_count * page_size AS size FROM pragma_page_count(), pragma_page_size()"
        )
        .pluck()
        .get() as number,
      schemaVersion: schemaVersion.count,
      entityCount: countTable(this.conn.sqlite, "entities"),
      assertionCount: countTable(this.conn.sqlite, "assertions"),
      relationshipCount: countTable(this.conn.sqlite, "relationships"),
      sourceCount: countTable(this.conn.sqlite, "sources"),
      searchDocumentCount: countSearchDocuments(this.conn.sqlite)
    });
  }

  public verify(): Promise<CodexVerificationReport> {
    const integrity = (
      this.conn.sqlite
        .prepare("PRAGMA integrity_check")
        .pluck()
        .all() as string[]
    ).filter((value) => value !== "ok");
    const foreignKeys = (
      this.conn.sqlite.prepare("PRAGMA foreign_key_check").all() as Record<
        string,
        unknown
      >[]
    ).map((row) => JSON.stringify(row));
    const migrationCount = this.conn.sqlite
      .prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
      .get() as { count: number };
    const search = verifySearchDocuments(this.conn.sqlite);

    return Promise.resolve({
      valid:
        integrity.length === 0 &&
        foreignKeys.length === 0 &&
        migrationCount.count > 0 &&
        search.length === 0,
      integrity,
      foreignKeys,
      migrationVersion: String(migrationCount.count),
      search
    });
  }

  public async backup(label = "manual"): Promise<string> {
    return createCodexBackup(this.conn, label);
  }

  public rebuildIndex(): Promise<void> {
    rebuildCodexSearchIndex(this.conn.sqlite);
    return Promise.resolve();
  }

  private get conn(): CodexConnection {
    if (!this.connection) {
      throw new CodexConnectionError(
        "Codex repository has not been initialized."
      );
    }
    return this.connection;
  }

  private ensureProject(projectId: string): void {
    const timestamp = nowMs();
    this.conn.db
      .insert(projects)
      .values({
        id: projectId,
        name: this.options.projectName ?? projectId,
        rootPath: this.conn.path,
        engine: this.options.engine ?? "RPG_MAKER_MZ",
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoNothing()
      .run();
  }

  private write<T>(operation: () => T): T {
    try {
      return this.conn.sqlite.transaction(operation)();
    } catch (cause) {
      throw mapSqliteError(cause);
    }
  }

  private writeAsync<T>(operation: () => T): Promise<T> {
    try {
      return Promise.resolve(this.write(operation));
    } catch (cause) {
      return Promise.reject(
        cause instanceof Error
          ? cause
          : new CodexPersistenceError("Codex persistence operation failed.")
      );
    }
  }
}

function countTable(
  sqlite: import("better-sqlite3").Database,
  table: string
): number {
  return sqlite
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .pluck()
    .get() as number;
}

function mapSqliteError(cause: unknown): Error {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message.includes("UNIQUE constraint failed")) {
    return new CodexConflictError(
      "Codex record conflicts with an existing unique value."
    );
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new CodexPersistenceError(
      "Codex record references missing related data."
    );
  }
  if (message.includes("SQLITE_BUSY")) {
    log.warn("SQLite busy while writing Codex data");
  }
  return cause instanceof Error
    ? cause
    : new CodexPersistenceError("Codex persistence operation failed.", {
        cause: message
      });
}

function mapEntity(row: EntityRow): CodexEntity {
  return {
    id: row.id,
    projectId: row.projectId,
    entityType: row.entityType,
    canonicalKey: row.canonicalKey,
    name: row.name,
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.sourceKind !== null ? { sourceKind: row.sourceKind } : {}),
    ...(row.sourcePath !== null ? { sourcePath: row.sourcePath } : {}),
    ...(row.externalId !== null ? { externalId: row.externalId } : {}),
    ...(row.metadataJson !== null
      ? { metadata: parseJson<JsonValue>(row.metadataJson, jsonValueSchema) }
      : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapAlias(row: EntityAliasRow): EntityAlias {
  return {
    id: row.id,
    projectId: row.projectId,
    entityId: row.entityId,
    alias: row.alias,
    normalizedAlias: row.normalizedAlias,
    createdAt: row.createdAt
  };
}

function mapRelationship(row: RelationshipRow): CodexRelationship {
  return {
    id: row.id,
    projectId: row.projectId,
    fromEntityId: row.fromEntityId,
    relationType: row.relationType,
    toEntityId: row.toEntityId,
    status: row.status,
    ...(row.sourceId !== null ? { sourceId: row.sourceId } : {}),
    ...(row.metadataJson !== null
      ? { metadata: parseJson<JsonValue>(row.metadataJson, jsonValueSchema) }
      : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapAssertion(row: AssertionRow): CodexAssertion {
  return {
    id: row.id,
    projectId: row.projectId,
    subjectEntityId: row.subjectEntityId,
    predicate: row.predicate,
    value: parseJson<JsonValue>(row.valueJson, jsonValueSchema),
    status: assertionStatusSchema.parse(row.status),
    ...(row.confidence !== null ? { confidence: row.confidence } : {}),
    ...(row.sourceId !== null ? { sourceId: row.sourceId } : {}),
    ...(row.approvedBy !== null ? { approvedBy: row.approvedBy } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapSource(row: SourceRow): CodexSource {
  return {
    id: row.id,
    projectId: row.projectId,
    sourceType: row.sourceType,
    title: row.title,
    ...(row.path !== null ? { path: row.path } : {}),
    ...(row.contentHash !== null ? { contentHash: row.contentHash } : {}),
    ...(row.metadataJson !== null
      ? { metadata: parseJson<JsonValue>(row.metadataJson, jsonValueSchema) }
      : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapSourceChunk(row: SourceChunkRow): CodexSourceChunk {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sequence: row.sequence,
    content: row.content,
    ...(row.tokenCount !== null ? { tokenCount: row.tokenCount } : {}),
    ...(row.metadataJson !== null
      ? { metadata: parseJson<JsonValue>(row.metadataJson, jsonValueSchema) }
      : {}),
    createdAt: row.createdAt
  };
}

function mapDecision(row: DecisionRow): CodexDecision {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    decision: row.decision,
    status: row.status,
    ...(row.reasoning !== null ? { reasoning: row.reasoning } : {}),
    ...(row.sourceId !== null ? { sourceId: row.sourceId } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapSession(row: SessionRow): CodexSession {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    startedAt: row.startedAt,
    ...(row.objective !== null ? { objective: row.objective } : {}),
    ...(row.endedAt !== null ? { endedAt: row.endedAt } : {}),
    ...(row.metadataJson !== null
      ? { metadata: parseJson<JsonValue>(row.metadataJson, jsonValueSchema) }
      : {})
  };
}
