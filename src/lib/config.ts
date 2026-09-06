import { z } from 'zod';

export const configSchema = z.object({
  WARDYN_AI_API_KEY: z.string().optional(),
  WARDYN_AI_MODEL: z.string().optional(),
});

export function readConfig(input: Record<string, string | undefined>) {
  return configSchema.parse(input);
}
