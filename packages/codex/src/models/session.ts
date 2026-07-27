import type { JsonValue } from "./entity.js";

/** Agent or user working session tracked by Codex. */
export interface CodexSession {
  id: string;
  projectId: string;
  objective?: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  metadata?: JsonValue;
}

export interface CreateSessionInput {
  id?: string;
  projectId: string;
  objective?: string;
  metadata?: JsonValue;
}

/** Short-lived memory attached to a session. */
export interface SessionMemory {
  id: string;
  sessionId: string;
  memoryType: string;
  content: string;
  promoted: boolean;
  createdAt: number;
}
