import z from "zod";

export const configSchema = z.object({
  hideNoUserMessageSession: z.boolean().optional().default(true),
});

export type Config = z.infer<typeof configSchema>;
