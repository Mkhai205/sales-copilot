import { envSchema, type EnvConfig } from './env.schema';

export type RawEnv = Record<string, unknown>;

export function validateEnv(config: RawEnv): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Configuration validation failed! Please check your environment variables:\n${errorMessages}\n`,
    );
  }

  return parsed.data;
}
