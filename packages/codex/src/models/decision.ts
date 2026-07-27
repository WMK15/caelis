/** Project or canon decision recorded in Codex. */
export interface CodexDecision {
  id: string;
  projectId: string;
  title: string;
  decision: string;
  reasoning?: string;
  status: string;
  sourceId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecordDecisionInput {
  id?: string;
  projectId: string;
  title: string;
  decision: string;
  reasoning?: string;
  status?: string;
  sourceId?: string;
}
