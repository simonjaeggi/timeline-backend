import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // No .env file present, rely on the process environment.
}

export default defineConfig({
  out: './drizzle',
  schema: './src/data/postgres/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations need a direct connection. Neon's Vercel integration sets
    // DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED (direct).
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
});
