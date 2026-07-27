import { z } from "zod";

/** Flexible JSON value stored as serialized metadata. */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

/** Canon or project memory entity stored in Codex. */
export interface CodexEntity {
  id: string;
  projectId: string;
  entityType: string;
  canonicalKey: string;
  name: string;
  description?: string;
  sourceKind?: string;
  sourcePath?: string;
  externalId?: string;
  metadata?: JsonValue;
  createdAt: number;
  updatedAt: number;
}

export interface CreateEntityInput {
  id?: string;
  projectId: string;
  entityType: string;
  canonicalKey: string;
  name: string;
  description?: string;
  sourceKind?: string;
  sourcePath?: string;
  externalId?: string;
  metadata?: JsonValue;
}

export interface UpdateEntityInput {
  entityType?: string;
  canonicalKey?: string;
  name?: string;
  description?: string | null;
  sourceKind?: string | null;
  sourcePath?: string | null;
  externalId?: string | null;
  metadata?: JsonValue | null;
}

export interface EntitySearchQuery {
  projectId?: string;
  text?: string;
  entityType?: string;
  limit?: number;
}

/** Alternate human-readable name for an entity. */
export interface EntityAlias {
  id: string;
  projectId: string;
  entityId: string;
  alias: string;
  normalizedAlias: string;
  createdAt: number;
}

export interface CreateAliasInput {
  id?: string;
  projectId: string;
  entityId: string;
  alias: string;
}
