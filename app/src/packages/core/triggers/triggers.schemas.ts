import { z } from "zod";

export const createTriggerInputSchema = z.object({
  naturalLanguage: z.string().optional(),
  draftJson: z.string().optional(),
});

export const listTriggersInputSchema = z.object({});

export const triggerIdInputSchema = z.object({
  triggerId: z.string().min(1),
});

export const triggerNameHintInputSchema = z.object({
  nameHint: z.string().min(1),
});

export const executeDueTriggerInputSchema = z.object({
  triggerId: z.string().min(1),
});

export type CreateTriggerInput = z.infer<typeof createTriggerInputSchema>;
