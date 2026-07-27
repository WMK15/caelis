import { z } from "zod";

const baseMessageSchema = z.object({
  id: z.string(),
  timestamp: z.string()
});

export const bridgeRequestSchema = z.discriminatedUnion("type", [
  baseMessageSchema.extend({ type: z.literal("handshake"), token: z.string() }),
  baseMessageSchema.extend({ type: z.literal("runtime-status") }),
  baseMessageSchema.extend({ type: z.literal("active-map") }),
  baseMessageSchema.extend({
    type: z.literal("switches"),
    ids: z.array(z.number().int()).optional()
  }),
  baseMessageSchema.extend({
    type: z.literal("variables"),
    ids: z.array(z.number().int()).optional()
  }),
  baseMessageSchema.extend({
    type: z.literal("teleport"),
    mapId: z.number().int(),
    x: z.number().int(),
    y: z.number().int()
  }),
  baseMessageSchema.extend({
    type: z.literal("run-common-event"),
    commonEventId: z.number().int()
  }),
  baseMessageSchema.extend({ type: z.literal("capture-screenshot") })
]);

export const bridgeResponseSchema = z.discriminatedUnion("type", [
  baseMessageSchema.extend({
    type: z.literal("handshake-ok"),
    engine: z.literal("RPG_MAKER_MZ"),
    readOnly: z.boolean()
  }),
  baseMessageSchema.extend({
    type: z.literal("runtime-status"),
    running: z.boolean(),
    playtest: z.boolean()
  }),
  baseMessageSchema.extend({
    type: z.literal("active-map"),
    mapId: z.number().int(),
    name: z.string().optional()
  }),
  baseMessageSchema.extend({
    type: z.literal("switches"),
    values: z.record(z.string(), z.boolean())
  }),
  baseMessageSchema.extend({
    type: z.literal("variables"),
    values: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
  }),
  baseMessageSchema.extend({ type: z.literal("teleport-ok") }),
  baseMessageSchema.extend({ type: z.literal("run-common-event-ok") }),
  baseMessageSchema.extend({
    type: z.literal("screenshot"),
    mimeType: z.literal("image/png"),
    dataBase64: z.string()
  }),
  baseMessageSchema.extend({
    type: z.literal("runtime-error"),
    message: z.string(),
    stack: z.string().optional()
  })
]);

/** Typed WebSocket request messages for the future runtime bridge. */
export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

/** Typed WebSocket response messages for the future runtime bridge. */
export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;
