import type {
  AssertionStatus,
  CodexAssertion,
  CreateAssertionInput
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

/** Storage-neutral Codex persistence interface used by application code. */
export interface CodexRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;

  createEntity(input: CreateEntityInput): Promise<CodexEntity>;
  updateEntity(id: string, input: UpdateEntityInput): Promise<CodexEntity>;
  getEntity(id: string): Promise<CodexEntity | undefined>;
  getEntityByKey(
    projectId: string,
    canonicalKey: string
  ): Promise<CodexEntity | undefined>;
  findEntities(query: EntitySearchQuery): Promise<CodexEntity[]>;

  createAlias(input: CreateAliasInput): Promise<EntityAlias>;
  resolveAlias(
    projectId: string,
    alias: string
  ): Promise<CodexEntity | undefined>;

  createRelationship(
    input: CreateRelationshipInput
  ): Promise<CodexRelationship>;
  getRelationships(entityId: string): Promise<CodexRelationship[]>;

  createAssertion(input: CreateAssertionInput): Promise<CodexAssertion>;
  updateAssertionStatus(
    assertionId: string,
    status: AssertionStatus
  ): Promise<CodexAssertion>;
  getAssertionsForEntity(entityId: string): Promise<CodexAssertion[]>;

  createSource(input: CreateSourceInput): Promise<CodexSource>;
  createSourceChunk(input: CreateSourceChunkInput): Promise<CodexSourceChunk>;

  recordDecision(input: RecordDecisionInput): Promise<CodexDecision>;

  createSession(input: CreateSessionInput): Promise<CodexSession>;
  endSession(sessionId: string): Promise<CodexSession>;

  search(query: CodexSearchQuery): Promise<CodexSearchResult[]>;
}
