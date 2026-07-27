import { CodexConflictError, CodexNotFoundError } from "../errors.js";
import {
  assertionStatusSchema,
  type AssertionStatus,
  type CodexAssertion,
  type CreateAssertionInput
} from "../models/assertion.js";
import type { CodexDecision, RecordDecisionInput } from "../models/decision.js";
import type {
  CodexEntity,
  CreateAliasInput,
  CreateEntityInput,
  EntityAlias,
  EntitySearchQuery,
  UpdateEntityInput
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
import { createCodexId, normalizeAlias, nowMs } from "../utils.js";
import type { CodexRepository } from "./codex-repository.js";

/** In-memory Codex repository for fast unit tests and interface parity checks. */
export class InMemoryCodexRepository implements CodexRepository {
  private readonly entities = new Map<string, CodexEntity>();
  private readonly aliases = new Map<string, EntityAlias>();
  private readonly relationships = new Map<string, CodexRelationship>();
  private readonly assertions = new Map<string, CodexAssertion>();
  private readonly sources = new Map<string, CodexSource>();
  private readonly chunks = new Map<string, CodexSourceChunk>();
  private readonly decisions = new Map<string, CodexDecision>();
  private readonly sessions = new Map<string, CodexSession>();

  public initialize(): Promise<void> {
    return Promise.resolve();
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  public createEntity(input: CreateEntityInput): Promise<CodexEntity> {
    if (
      [...this.entities.values()].some(
        (entity) =>
          entity.projectId === input.projectId &&
          entity.canonicalKey === input.canonicalKey
      )
    ) {
      return Promise.reject(
        new CodexConflictError("Codex entity canonical key already exists.")
      );
    }

    const timestamp = nowMs();
    const entity: CodexEntity = {
      id: input.id ?? createCodexId("ent"),
      projectId: input.projectId,
      entityType: input.entityType,
      canonicalKey: input.canonicalKey,
      name: input.name,
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
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.entities.set(entity.id, entity);
    return Promise.resolve(entity);
  }

  public updateEntity(
    id: string,
    input: UpdateEntityInput
  ): Promise<CodexEntity> {
    const existing = this.entities.get(id);
    if (!existing) {
      return Promise.reject(
        new CodexNotFoundError("Codex entity was not found.", { id })
      );
    }

    const updated: CodexEntity = {
      ...existing,
      ...(input.entityType !== undefined
        ? { entityType: input.entityType }
        : {}),
      ...(input.canonicalKey !== undefined
        ? { canonicalKey: input.canonicalKey }
        : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? nullableField("description", input.description)
        : {}),
      ...(input.sourceKind !== undefined
        ? nullableField("sourceKind", input.sourceKind)
        : {}),
      ...(input.sourcePath !== undefined
        ? nullableField("sourcePath", input.sourcePath)
        : {}),
      ...(input.externalId !== undefined
        ? nullableField("externalId", input.externalId)
        : {}),
      ...(input.metadata !== undefined
        ? nullableField("metadata", input.metadata)
        : {}),
      updatedAt: nowMs()
    };
    this.entities.set(id, updated);
    return Promise.resolve(updated);
  }

  public getEntity(id: string): Promise<CodexEntity | undefined> {
    return Promise.resolve(this.entities.get(id));
  }

  public getEntityByKey(
    projectId: string,
    canonicalKey: string
  ): Promise<CodexEntity | undefined> {
    return Promise.resolve(
      [...this.entities.values()].find(
        (entity) =>
          entity.projectId === projectId && entity.canonicalKey === canonicalKey
      )
    );
  }

  public findEntities(query: EntitySearchQuery): Promise<CodexEntity[]> {
    const limit = query.limit ?? 25;
    return Promise.resolve(
      [...this.entities.values()]
        .filter((entity) =>
          query.projectId ? entity.projectId === query.projectId : true
        )
        .filter((entity) =>
          query.entityType ? entity.entityType === query.entityType : true
        )
        .filter((entity) =>
          query.text
            ? entity.name.includes(query.text) ||
              (entity.description?.includes(query.text) ?? false)
            : true
        )
        .slice(0, limit)
    );
  }

  public createAlias(input: CreateAliasInput): Promise<EntityAlias> {
    const normalizedAlias = normalizeAlias(input.alias);
    const key = `${input.projectId}:${normalizedAlias}`;
    if (this.aliases.has(key)) {
      return Promise.reject(
        new CodexConflictError("Codex alias already exists.")
      );
    }
    const alias: EntityAlias = {
      id: input.id ?? createCodexId("alias"),
      projectId: input.projectId,
      entityId: input.entityId,
      alias: input.alias,
      normalizedAlias,
      createdAt: nowMs()
    };
    this.aliases.set(key, alias);
    return Promise.resolve(alias);
  }

  public resolveAlias(
    projectId: string,
    alias: string
  ): Promise<CodexEntity | undefined> {
    const entityAlias = this.aliases.get(
      `${projectId}:${normalizeAlias(alias)}`
    );
    return Promise.resolve(
      entityAlias ? this.entities.get(entityAlias.entityId) : undefined
    );
  }

  public createRelationship(
    input: CreateRelationshipInput
  ): Promise<CodexRelationship> {
    const timestamp = nowMs();
    const relationship: CodexRelationship = {
      id: input.id ?? createCodexId("rel"),
      projectId: input.projectId,
      fromEntityId: input.fromEntityId,
      relationType: input.relationType,
      toEntityId: input.toEntityId,
      status: input.status ?? "observed",
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.relationships.set(relationship.id, relationship);
    return Promise.resolve(relationship);
  }

  public getRelationships(entityId: string): Promise<CodexRelationship[]> {
    return Promise.resolve(
      [...this.relationships.values()].filter(
        (relationship) =>
          relationship.fromEntityId === entityId ||
          relationship.toEntityId === entityId
      )
    );
  }

  public createAssertion(input: CreateAssertionInput): Promise<CodexAssertion> {
    const status = assertionStatusSchema.parse(input.status);
    const timestamp = nowMs();
    const assertion: CodexAssertion = {
      id: input.id ?? createCodexId("assert"),
      projectId: input.projectId,
      subjectEntityId: input.subjectEntityId,
      predicate: input.predicate,
      value: input.value,
      status,
      ...(input.confidence !== undefined
        ? { confidence: input.confidence }
        : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.approvedBy !== undefined
        ? { approvedBy: input.approvedBy }
        : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.assertions.set(assertion.id, assertion);
    return Promise.resolve(assertion);
  }

  public updateAssertionStatus(
    assertionId: string,
    status: AssertionStatus
  ): Promise<CodexAssertion> {
    const existing = this.assertions.get(assertionId);
    if (!existing) {
      return Promise.reject(
        new CodexNotFoundError("Codex assertion was not found.", {
          assertionId
        })
      );
    }
    const updated = {
      ...existing,
      status: assertionStatusSchema.parse(status),
      updatedAt: nowMs()
    };
    this.assertions.set(assertionId, updated);
    return Promise.resolve(updated);
  }

  public getAssertionsForEntity(entityId: string): Promise<CodexAssertion[]> {
    return Promise.resolve(
      [...this.assertions.values()].filter(
        (assertion) => assertion.subjectEntityId === entityId
      )
    );
  }

  public createSource(input: CreateSourceInput): Promise<CodexSource> {
    const timestamp = nowMs();
    const source: CodexSource = {
      id: input.id ?? createCodexId("src"),
      projectId: input.projectId,
      sourceType: input.sourceType,
      title: input.title,
      ...(input.path !== undefined ? { path: input.path } : {}),
      ...(input.contentHash !== undefined
        ? { contentHash: input.contentHash }
        : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.sources.set(source.id, source);
    return Promise.resolve(source);
  }

  public createSourceChunk(
    input: CreateSourceChunkInput
  ): Promise<CodexSourceChunk> {
    const chunk: CodexSourceChunk = {
      id: input.id ?? createCodexId("chunk"),
      sourceId: input.sourceId,
      sequence: input.sequence,
      content: input.content,
      ...(input.tokenCount !== undefined
        ? { tokenCount: input.tokenCount }
        : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      createdAt: nowMs()
    };
    this.chunks.set(chunk.id, chunk);
    return Promise.resolve(chunk);
  }

  public recordDecision(input: RecordDecisionInput): Promise<CodexDecision> {
    const timestamp = nowMs();
    const decision: CodexDecision = {
      id: input.id ?? createCodexId("decision"),
      projectId: input.projectId,
      title: input.title,
      decision: input.decision,
      status: input.status ?? "approved",
      ...(input.reasoning !== undefined ? { reasoning: input.reasoning } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.decisions.set(decision.id, decision);
    return Promise.resolve(decision);
  }

  public createSession(input: CreateSessionInput): Promise<CodexSession> {
    const session: CodexSession = {
      id: input.id ?? createCodexId("session"),
      projectId: input.projectId,
      status: "active",
      startedAt: nowMs(),
      ...(input.objective !== undefined ? { objective: input.objective } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    };
    this.sessions.set(session.id, session);
    return Promise.resolve(session);
  }

  public endSession(sessionId: string): Promise<CodexSession> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return Promise.reject(
        new CodexNotFoundError("Codex session was not found.", { sessionId })
      );
    }
    const ended = { ...existing, status: "ended", endedAt: nowMs() };
    this.sessions.set(sessionId, ended);
    return Promise.resolve(ended);
  }

  public search(query: CodexSearchQuery): Promise<CodexSearchResult[]> {
    const needle = query.query.toLocaleLowerCase();
    const results: CodexSearchResult[] = [];
    for (const entity of this.entities.values()) {
      const content = `${entity.name} ${entity.description ?? ""}`;
      if (content.toLocaleLowerCase().includes(needle)) {
        results.push({
          documentId: entity.id,
          documentType: "entity",
          title: entity.name,
          snippet: content,
          score: 0,
          entityId: entity.id
        });
      }
    }
    return Promise.resolve(results.slice(0, query.limit ?? 10));
  }
}

function nullableField<K extends string, T>(
  key: K,
  value: T | null
): Record<K, T> | Record<string, never> {
  return value === null ? {} : ({ [key]: value } as Record<K, T>);
}
