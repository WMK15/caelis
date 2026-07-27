import type Database from "better-sqlite3";

import { createLogger } from "@caelis/shared";

import { CodexSearchError } from "../errors.js";
import type { CodexSearchQuery, CodexSearchResult } from "./codex-search.js";

const log = createLogger("codex:fts");

export interface SearchDocumentInput {
  documentId: string;
  projectId: string;
  documentType: string;
  title: string;
  content: string;
  tags?: string;
}

/** Insert or replace a Codex FTS document. */
export function indexSearchDocument(
  sqlite: Database.Database,
  document: SearchDocumentInput
): void {
  removeSearchDocument(sqlite, document.documentId, document.documentType);
  sqlite
    .prepare(
      `INSERT INTO codex_search (document_id, project_id, document_type, title, content, tags)
       VALUES (@documentId, @projectId, @documentType, @title, @content, @tags)`
    )
    .run({ ...document, tags: document.tags ?? "" });
}

/** Remove a Codex FTS document by stable ID and type. */
export function removeSearchDocument(
  sqlite: Database.Database,
  documentId: string,
  documentType?: string
): void {
  if (documentType) {
    sqlite
      .prepare(
        "DELETE FROM codex_search WHERE document_id = ? AND document_type = ?"
      )
      .run(documentId, documentType);
    return;
  }

  sqlite
    .prepare("DELETE FROM codex_search WHERE document_id = ?")
    .run(documentId);
}

/** Search the FTS5 index using ordinary text, not raw FTS syntax. */
export function searchCodexIndex(
  sqlite: Database.Database,
  query: CodexSearchQuery
): CodexSearchResult[] {
  const ftsQuery = toSafeFtsQuery(query.query);
  if (!ftsQuery) {
    return [];
  }

  const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);
  const clauses = ["codex_search MATCH @ftsQuery"];
  const params: Record<string, string | number> = { ftsQuery, limit };

  if (query.projectId) {
    clauses.push("project_id = @projectId");
    params.projectId = query.projectId;
  }

  if (query.documentTypes && query.documentTypes.length > 0) {
    const placeholders = query.documentTypes
      .map((_, index) => `@type${String(index)}`)
      .join(", ");
    clauses.push(`document_type IN (${placeholders})`);
    query.documentTypes.forEach((documentType, index) => {
      params[`type${String(index)}`] = documentType;
    });
  }

  try {
    const rows = sqlite
      .prepare(
        `SELECT document_id AS documentId,
                document_type AS documentType,
                title,
                snippet(codex_search, 4, '[', ']', '...', 16) AS snippet,
                bm25(codex_search) AS score
           FROM codex_search
          WHERE ${clauses.join(" AND ")}
          ORDER BY score
          LIMIT @limit`
      )
      .all(params) as {
      documentId: string;
      documentType: string;
      title: string;
      snippet: string;
      score: number;
    }[];

    return rows.map((row) => ({
      documentId: row.documentId,
      documentType: row.documentType,
      title: row.title,
      snippet: row.snippet,
      score: row.score,
      ...(row.documentType === "entity" || row.documentType === "alias"
        ? { entityId: row.documentId }
        : {}),
      ...(row.documentType === "source_chunk"
        ? { sourceId: row.documentId.split(":")[0] }
        : {})
    }));
  } catch (cause) {
    throw new CodexSearchError("Codex search failed.", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

/** Remove all search documents and rebuild from canonical tables. */
export function rebuildCodexSearchIndex(sqlite: Database.Database): void {
  log.info("Rebuilding Codex FTS index");
  const transaction = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM codex_search").run();
    rebuildEntities(sqlite);
    rebuildAliases(sqlite);
    rebuildAssertions(sqlite);
    rebuildSourceChunks(sqlite);
    rebuildDecisions(sqlite);
  });
  transaction();
  log.info("Completed Codex FTS index rebuild");
}

/** Return the number of FTS rows. */
export function countSearchDocuments(sqlite: Database.Database): number {
  const row = sqlite
    .prepare("SELECT COUNT(*) AS count FROM codex_search")
    .get() as { count: number };
  return row.count;
}

/** Verify FTS document count can be read and is internally consistent enough for the initial scaffold. */
export function verifySearchDocuments(sqlite: Database.Database): string[] {
  try {
    countSearchDocuments(sqlite);
    return [];
  } catch (cause) {
    return [cause instanceof Error ? cause.message : String(cause)];
  }
}

function toSafeFtsQuery(input: string): string {
  const tokens = input.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(" OR ");
}

function rebuildEntities(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      "SELECT id, project_id AS projectId, name, COALESCE(description, '') AS description, entity_type AS entityType FROM entities"
    )
    .all() as {
    id: string;
    projectId: string;
    name: string;
    description: string;
    entityType: string;
  }[];
  for (const row of rows) {
    indexSearchDocument(sqlite, {
      documentId: row.id,
      projectId: row.projectId,
      documentType: "entity",
      title: row.name,
      content: row.description,
      tags: row.entityType
    });
  }
}

function rebuildAliases(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      "SELECT entity_id AS entityId, project_id AS projectId, alias FROM entity_aliases"
    )
    .all() as { entityId: string; projectId: string; alias: string }[];
  for (const row of rows) {
    indexSearchDocument(sqlite, {
      documentId: row.entityId,
      projectId: row.projectId,
      documentType: "alias",
      title: row.alias,
      content: row.alias
    });
  }
}

function rebuildAssertions(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      "SELECT id, project_id AS projectId, predicate, value_json AS valueJson, status FROM assertions"
    )
    .all() as {
    id: string;
    projectId: string;
    predicate: string;
    valueJson: string;
    status: string;
  }[];
  for (const row of rows) {
    indexSearchDocument(sqlite, {
      documentId: row.id,
      projectId: row.projectId,
      documentType: "assertion",
      title: row.predicate,
      content: row.valueJson,
      tags: row.status
    });
  }
}

function rebuildSourceChunks(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      `SELECT source_chunks.id,
              source_chunks.source_id AS sourceId,
              sources.project_id AS projectId,
              sources.title,
              source_chunks.content
         FROM source_chunks
         JOIN sources ON sources.id = source_chunks.source_id`
    )
    .all() as {
    id: string;
    sourceId: string;
    projectId: string;
    title: string;
    content: string;
  }[];
  for (const row of rows) {
    indexSearchDocument(sqlite, {
      documentId: `${row.sourceId}:${row.id}`,
      projectId: row.projectId,
      documentType: "source_chunk",
      title: row.title,
      content: row.content
    });
  }
}

function rebuildDecisions(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      "SELECT id, project_id AS projectId, title, decision, COALESCE(reasoning, '') AS reasoning, status FROM decisions"
    )
    .all() as {
    id: string;
    projectId: string;
    title: string;
    decision: string;
    reasoning: string;
    status: string;
  }[];
  for (const row of rows) {
    indexSearchDocument(sqlite, {
      documentId: row.id,
      projectId: row.projectId,
      documentType: "decision",
      title: row.title,
      content: `${row.decision}\n${row.reasoning}`,
      tags: row.status
    });
  }
}
