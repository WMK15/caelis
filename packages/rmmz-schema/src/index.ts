import { z } from "zod";

/**
 * Fixture-driven RPG Maker MZ schemas. These intentionally preserve unknown
 * fields while coverage grows from real projects and fixtures.
 */
export const rmmzProjectDetectionSchema = z.object({
  hasProjectFile: z.boolean(),
  hasDataDirectory: z.boolean(),
  hasJsDirectory: z.boolean()
});

const namedRecord = z
  .object({
    id: z.number().int().nonnegative().optional(),
    name: z.string().optional(),
    note: z.string().optional()
  })
  .passthrough();

/** Generic RPG Maker database record schema. */
export const databaseRecordSchema = namedRecord;
export const actorSchema = namedRecord;
export const classSchema = namedRecord;
export const skillSchema = namedRecord;
export const itemSchema = namedRecord;
export const weaponSchema = namedRecord;
export const armorSchema = namedRecord;
export const stateSchema = namedRecord;

/** RPG Maker event command schema preserving command parameters. */
export const eventCommandSchema = z
  .object({
    code: z.number().int(),
    indent: z.number().int().nonnegative().default(0),
    parameters: z.array(z.unknown()).default([])
  })
  .passthrough();

/** RPG Maker event page schema. */
export const eventPageSchema = z
  .object({
    conditions: z.record(z.string(), z.unknown()).optional(),
    image: z.record(z.string(), z.unknown()).optional(),
    list: z.array(eventCommandSchema).default([])
  })
  .passthrough();

/** Common event schema. */
export const commonEventSchema = namedRecord
  .extend({
    trigger: z.number().int().optional(),
    switchId: z.number().int().optional(),
    list: z.array(eventCommandSchema).default([])
  })
  .passthrough();

/** Map event schema. */
export const mapEventSchema = namedRecord
  .extend({
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    pages: z.array(eventPageSchema).default([])
  })
  .passthrough();

/** Map data schema. */
export const mapSchema = z
  .object({
    displayName: z.string().optional(),
    events: z.array(mapEventSchema.nullable()).default([]),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
  })
  .passthrough();

/** System.json schema. */
export const systemSchema = z
  .object({
    gameTitle: z.string().optional(),
    switches: z.array(z.string().nullable()).optional(),
    variables: z.array(z.string().nullable()).optional()
  })
  .passthrough();

/** MapInfos.json entry schema. */
export const mapInfoSchema = z
  .object({
    id: z.number().int().optional(),
    name: z.string().optional(),
    parentId: z.number().int().optional(),
    order: z.number().int().optional()
  })
  .passthrough();

export const mapInfosSchema = z.array(mapInfoSchema.nullable());

export type RmmzEventCommand = z.infer<typeof eventCommandSchema>;
export type RmmzCommonEvent = z.infer<typeof commonEventSchema>;
export type RmmzMap = z.infer<typeof mapSchema>;
export type RmmzMapEvent = z.infer<typeof mapEventSchema>;
