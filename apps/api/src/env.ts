import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3001'),
  ANTHROPIC_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default('notifications@oias.dev'),

  // Azure AI Foundry — Reasoning Agents track
  AZURE_AI_FOUNDRY_ENDPOINT: z.string().url().optional(),
  AZURE_AI_FOUNDRY_API_KEY: z.string().optional(),
  // Either an agent id (asst_xxx) or a display name; resolved at runtime.
  AZURE_AI_FOUNDRY_AGENT: z.string().optional(),
  AZURE_AI_FOUNDRY_API_VERSION: z.string().default('2025-05-01'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid environment variables:\n${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}

export const env = loadEnv();
