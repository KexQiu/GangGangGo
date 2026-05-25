import { defineConfig } from 'drizzle-kit';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return 'postgres://postgres:postgres@localhost:5432/xiaotidu';
  }

  const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m);

  return match?.[1]?.trim() || 'postgres://postgres:postgres@localhost:5432/xiaotidu';
}

export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/db/schema.ts',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: readDatabaseUrl(),
  },
});
