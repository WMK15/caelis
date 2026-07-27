import type { EntityId } from "@caelis/core";

/** Supported RPG Maker database collections for semantic operations. */
export type DatabaseCollection =
  | "actors"
  | "classes"
  | "skills"
  | "items"
  | "weapons"
  | "armors"
  | "states"
  | "commonEvents";

/** JSON-compatible patch value for future guarded writes. */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Create a new database record. */
export interface CreateDatabaseRecordOperation {
  type: "create-database-record";
  collection: DatabaseCollection;
  record: JsonValue;
}

/** Update selected fields on an existing database record. */
export interface UpdateDatabaseRecordOperation {
  type: "update-database-record";
  collection: DatabaseCollection;
  id: EntityId;
  patch: JsonValue;
}

/** Clone an existing database record into a new semantic record. */
export interface CloneDatabaseRecordOperation {
  type: "clone-database-record";
  collection: DatabaseCollection;
  sourceId: EntityId;
  overrides?: JsonValue;
}

/** Mark a record as deprecated without deleting it. */
export interface DeprecateDatabaseRecordOperation {
  type: "deprecate-database-record";
  collection: DatabaseCollection;
  id: EntityId;
  reason: string;
}

/** Semantic database operation planned by future writers. */
export type DatabaseOperation =
  | CreateDatabaseRecordOperation
  | UpdateDatabaseRecordOperation
  | CloneDatabaseRecordOperation
  | DeprecateDatabaseRecordOperation;
