import { z } from "zod";

import type { JsonValue } from "./entity.js";

/** Valid assertion lifecycle states. */
export const assertionStatusSchema = z.enum([
  "observed",
  "inferred",
  "proposed",
  "approved",
  "deprecated",
  "contradicted"
]);

export type AssertionStatus = z.infer<typeof assertionStatusSchema>;

/** Structured claim about a Codex entity. */
export interface CodexAssertion {
  id: string;
  projectId: string;
  subjectEntityId: string;
  predicate: string;
  value: JsonValue;
  status: AssertionStatus;
  confidence?: number;
  sourceId?: string;
  approvedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAssertionInput {
  id?: string;
  projectId: string;
  subjectEntityId: string;
  predicate: string;
  value: JsonValue;
  status: AssertionStatus;
  confidence?: number;
  sourceId?: string;
  approvedBy?: string;
}
