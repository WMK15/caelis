CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `root_path` text NOT NULL,
  `engine` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_root_path_unique` ON `projects` (`root_path`);
--> statement-breakpoint
CREATE TABLE `entities` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `entity_type` text NOT NULL,
  `canonical_key` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `source_kind` text,
  `source_path` text,
  `external_id` text,
  `metadata_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entities_project_canonical_key_unique` ON `entities` (`project_id`, `canonical_key`);
--> statement-breakpoint
CREATE INDEX `entities_project_id_idx` ON `entities` (`project_id`);
--> statement-breakpoint
CREATE INDEX `entities_entity_type_idx` ON `entities` (`entity_type`);
--> statement-breakpoint
CREATE INDEX `entities_name_idx` ON `entities` (`name`);
--> statement-breakpoint
CREATE INDEX `entities_external_id_idx` ON `entities` (`external_id`);
--> statement-breakpoint
CREATE TABLE `entity_aliases` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `entity_id` text NOT NULL,
  `alias` text NOT NULL,
  `normalized_alias` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`entity_id`) REFERENCES `entities` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_aliases_project_normalized_alias_unique` ON `entity_aliases` (`project_id`, `normalized_alias`);
--> statement-breakpoint
CREATE TABLE `relationships` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `from_entity_id` text NOT NULL,
  `relation_type` text NOT NULL,
  `to_entity_id` text NOT NULL,
  `status` text NOT NULL,
  `source_id` text,
  `metadata_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`from_entity_id`) REFERENCES `entities` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`to_entity_id`) REFERENCES `entities` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `relationships_from_entity_id_idx` ON `relationships` (`from_entity_id`);
--> statement-breakpoint
CREATE INDEX `relationships_to_entity_id_idx` ON `relationships` (`to_entity_id`);
--> statement-breakpoint
CREATE INDEX `relationships_relation_type_idx` ON `relationships` (`relation_type`);
--> statement-breakpoint
CREATE TABLE `assertions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `subject_entity_id` text NOT NULL,
  `predicate` text NOT NULL,
  `value_json` text NOT NULL,
  `status` text NOT NULL,
  `confidence` real,
  `source_id` text,
  `approved_by` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`subject_entity_id`) REFERENCES `entities` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sources` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `source_type` text NOT NULL,
  `title` text NOT NULL,
  `path` text,
  `content_hash` text,
  `metadata_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `source_chunks` (
  `id` text PRIMARY KEY NOT NULL,
  `source_id` text NOT NULL,
  `sequence` integer NOT NULL,
  `content` text NOT NULL,
  `token_count` integer,
  `metadata_json` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_chunks_source_sequence_unique` ON `source_chunks` (`source_id`, `sequence`);
--> statement-breakpoint
CREATE TABLE `decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL,
  `decision` text NOT NULL,
  `reasoning` text,
  `status` text NOT NULL,
  `source_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `objective` text,
  `status` text NOT NULL,
  `started_at` integer NOT NULL,
  `ended_at` integer,
  `metadata_json` text,
  FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_memories` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `memory_type` text NOT NULL,
  `content` text NOT NULL,
  `promoted` integer DEFAULT false NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `codex_search` USING fts5(
  `document_id` UNINDEXED,
  `project_id` UNINDEXED,
  `document_type` UNINDEXED,
  `title`,
  `content`,
  `tags`,
  tokenize = 'unicode61'
);
