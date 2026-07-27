import type { JsonValue } from "./entity.js";

/** Directed semantic relationship between two Codex entities. */
export interface CodexRelationship {
  id: string;
  projectId: string;
  fromEntityId: string;
  relationType: string;
  toEntityId: string;
  status: string;
  sourceId?: string;
  metadata?: JsonValue;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRelationshipInput {
  id?: string;
  projectId: string;
  fromEntityId: string;
  relationType: string;
  toEntityId: string;
  status?: string;
  sourceId?: string;
  metadata?: JsonValue;
}
