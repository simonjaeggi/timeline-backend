/**
 * Vercel entry point. Vercel detects Hono through a file at this path that
 * imports `hono`, and runs its default export as a Vercel Function (Fluid
 * compute). For a plain Node.js server (local dev, `npm start`) see
 * node-server.ts.
 */
import type { Hono } from 'hono';
import { createApp } from './create-app.ts';
import { runStartupTasks } from './startup.ts';

await runStartupTasks();

const app = createApp() satisfies Hono<any>;

export default app;
