/** Search query over indexed Codex documents. */
export interface CodexSearchQuery {
  projectId?: string;
  query: string;
  documentTypes?: string[];
  limit?: number;
}

/** Storage-neutral Codex search result. */
export interface CodexSearchResult {
  documentId: string;
  documentType: string;
  title: string;
  snippet: string;
  score: number;
  entityId?: string;
  sourceId?: string;
}
