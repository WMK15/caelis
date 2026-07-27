import type { JsonValue } from "./entity.js";

/** Source document or project file that supports Codex memory. */
export interface CodexSource {
  id: string;
  projectId: string;
  sourceType: string;
  title: string;
  path?: string;
  contentHash?: string;
  metadata?: JsonValue;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSourceInput {
  id?: string;
  projectId: string;
  sourceType: string;
  title: string;
  path?: string;
  contentHash?: string;
  metadata?: JsonValue;
}

/** Searchable chunk from a Codex source. */
export interface CodexSourceChunk {
  id: string;
  sourceId: string;
  sequence: number;
  content: string;
  tokenCount?: number;
  metadata?: JsonValue;
  createdAt: number;
}

export interface CreateSourceChunkInput {
  id?: string;
  sourceId: string;
  sequence: number;
  content: string;
  tokenCount?: number;
  metadata?: JsonValue;
}
