import { relations } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rootPath: text("root_path").notNull().unique(),
  engine: text("engine").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    canonicalKey: text("canonical_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sourceKind: text("source_kind"),
    sourcePath: text("source_path"),
    externalId: text("external_id"),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => [
    uniqueIndex("entities_project_canonical_key_unique").on(
      table.projectId,
      table.canonicalKey
    ),
    index("entities_project_id_idx").on(table.projectId),
    index("entities_entity_type_idx").on(table.entityType),
    index("entities_name_idx").on(table.name),
    index("entities_external_id_idx").on(table.externalId)
  ]
);

export const entityAliases = sqliteTable(
  "entity_aliases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    createdAt: integer("created_at").notNull()
  },
  (table) => [
    uniqueIndex("entity_aliases_project_normalized_alias_unique").on(
      table.projectId,
      table.normalizedAlias
    )
  ]
);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  title: text("title").notNull(),
  path: text("path"),
  contentHash: text("content_hash"),
  metadataJson: text("metadata_json"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const relationships = sqliteTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fromEntityId: text("from_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    toEntityId: text("to_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null"
    }),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => [
    index("relationships_from_entity_id_idx").on(table.fromEntityId),
    index("relationships_to_entity_id_idx").on(table.toEntityId),
    index("relationships_relation_type_idx").on(table.relationType)
  ]
);

export const assertions = sqliteTable("assertions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  subjectEntityId: text("subject_entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  predicate: text("predicate").notNull(),
  valueJson: text("value_json").notNull(),
  status: text("status").notNull(),
  confidence: real("confidence"),
  sourceId: text("source_id").references(() => sources.id, {
    onDelete: "set null"
  }),
  approvedBy: text("approved_by"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const sourceChunks = sqliteTable(
  "source_chunks",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at").notNull()
  },
  (table) => [
    uniqueIndex("source_chunks_source_sequence_unique").on(
      table.sourceId,
      table.sequence
    )
  ]
);

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  reasoning: text("reasoning"),
  status: text("status").notNull(),
  sourceId: text("source_id").references(() => sources.id, {
    onDelete: "set null"
  }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  objective: text("objective"),
  status: text("status").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  metadataJson: text("metadata_json")
});

export const sessionMemories = sqliteTable("session_memories", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  memoryType: text("memory_type").notNull(),
  content: text("content").notNull(),
  promoted: integer("promoted", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull()
});

export const projectRelations = relations(projects, ({ many }) => ({
  entities: many(entities),
  sources: many(sources)
}));

export const entityRelations = relations(entities, ({ one, many }) => ({
  project: one(projects, {
    fields: [entities.projectId],
    references: [projects.id]
  }),
  aliases: many(entityAliases),
  assertions: many(assertions)
}));

export type ProjectRow = typeof projects.$inferSelect;
export type EntityRow = typeof entities.$inferSelect;
export type EntityAliasRow = typeof entityAliases.$inferSelect;
export type RelationshipRow = typeof relationships.$inferSelect;
export type AssertionRow = typeof assertions.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;
export type SourceChunkRow = typeof sourceChunks.$inferSelect;
export type DecisionRow = typeof decisions.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
