/**
 * Plain Node.js server for local development and self-hosting.
 * On Vercel, index.ts is the entry point instead.
 */
import { serve } from '@hono/node-server';
import { createApp } from './create-app.ts';
import { getRepositories } from './data/index.ts';
import { env } from './env-validation.ts';
import { runStartupTasks } from './startup.ts';

await runStartupTasks();

const app = createApp();

const server = serve(
  { fetch: app.fetch, port: env.PORT, hostname: env.HOST },
  (info) => {
    console.info(`Listening on http://${info.address}:${info.port}`);
    console.info(`API docs on http://${info.address}:${info.port}/api/docs`);
  },
);

/** Stops accepting requests and closes the database connection. */
function shutdown(signal: string): void {
  console.info(`${signal} received, shutting down.`);

  server.close(async () => {
    try {
      await getRepositories().close();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
