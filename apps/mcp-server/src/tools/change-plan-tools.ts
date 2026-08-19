import {
  applyChangePlan,
  createActorCreatePlan,
  getChangePlan
} from "@caelis/project-write";
import { z } from "zod";

export const actorCreatePlanSchema = z.object({
  projectRoot: z.string().min(1),
  actor: z.object({
    name: z.string().min(1),
    nickname: z.string().optional(),
    profile: z.string().optional(),
    classId: z.number().int().positive().optional(),
    initialLevel: z.number().int().positive().optional(),
    maxLevel: z.number().int().positive().optional(),
    characterName: z.string().optional(),
    characterIndex: z.number().int().min(0).max(7).optional(),
    faceName: z.string().optional(),
    faceIndex: z.number().int().min(0).max(7).optional(),
    battlerName: z.string().optional()
  })
});

export const changePlanGetSchema = z.object({
  projectRoot: z.string().min(1),
  planId: z.string().min(1)
});

export const changeApplySchema = z.object({
  projectRoot: z.string().min(1),
  planId: z.string().min(1),
  confirm: z.literal(true)
});

export const actorCreatePlanShape = actorCreatePlanSchema.shape;
export const changePlanGetShape = changePlanGetSchema.shape;
export const changeApplyShape = changeApplySchema.shape;

export async function actorCreatePlanTool(input: unknown): Promise<unknown> {
  return createActorCreatePlan(actorCreatePlanSchema.parse(input));
}

export async function changePlanGetTool(input: unknown): Promise<unknown> {
  return getChangePlan(changePlanGetSchema.parse(input));
}

export async function changeApplyTool(input: unknown): Promise<unknown> {
  return applyChangePlan(changeApplySchema.parse(input));
}

export function toJsonToolResponse(result: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
