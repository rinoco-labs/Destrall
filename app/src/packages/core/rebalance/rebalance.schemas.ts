import { z } from "zod";

export const prepareRebalanceInputSchema = z.object({
  distributionText: z.string().min(1).max(2000),
});
