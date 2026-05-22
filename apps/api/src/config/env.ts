import { z } from 'zod';

const envSchema = z
  .object({
    APPLE_AUTH_MODE: z.enum(['mock', 'real']).optional(),
    APPLE_BUNDLE_ID: z.string().min(1).optional(),
    APPLE_JWKS_URL: z.url().default('https://appleid.apple.com/auth/keys'),
    DATABASE_URL: z.url().optional(),
    DB_SSL: z
      .enum(['0', '1', 'false', 'true', 'disable', 'require'])
      .default('false')
      .transform((value) => value === '1' || value === 'true' || value === 'require'),
    EXPO_PUSH_ACCESS_TOKEN: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(16).default('xiaotidu-dev-secret'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8787),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.APPLE_AUTH_MODE === 'mock') {
      context.addIssue({
        code: 'custom',
        message: 'APPLE_AUTH_MODE cannot be mock in production.',
        path: ['APPLE_AUTH_MODE'],
      });
    }

    if (value.NODE_ENV === 'production' && !value.APPLE_BUNDLE_ID) {
      context.addIssue({
        code: 'custom',
        message: 'APPLE_BUNDLE_ID is required in production.',
        path: ['APPLE_BUNDLE_ID'],
      });
    }

    if (value.NODE_ENV === 'production' && !value.DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required in production.',
        path: ['DATABASE_URL'],
      });
    }

    if (value.NODE_ENV === 'production' && value.JWT_SECRET === 'xiaotidu-dev-secret') {
      context.addIssue({
        code: 'custom',
        message: 'JWT_SECRET must be set in production.',
        path: ['JWT_SECRET'],
      });
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsedEnv = envSchema.parse(source);

  return {
    ...parsedEnv,
    APPLE_AUTH_MODE: parsedEnv.APPLE_AUTH_MODE ?? (parsedEnv.NODE_ENV === 'production' ? 'real' : 'mock'),
  };
}

export const env = loadEnv();
