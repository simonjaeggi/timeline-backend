import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { createApiRouter } from './api/api.routes.ts';
import { getAuth } from './auth/better-auth.ts';
import { env } from './env-validation.ts';
import { errorHandler, notFoundHandler } from './middleware/error-handler.ts';
import {
  defaultAllowedOrigins,
  requireAllowedOrigin,
} from './middleware/origin-check.middleware.ts';

export const OPENAPI_PATH = '/api/openapi.json';
export const DOCS_PATH = '/api/docs';

export const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Timeline API',
    version: '0.2.0',
    description: [
      'Family timeline backend.',
      '',
      '**Auth flow:** 1. `POST /api/access-codes/check` with the code (sets a short-lived cookie). ',
      '2. Sign in with Google through Better Auth (`/api/auth/sign-in/social`, use the `better-auth` client). ',
      '3. Call the API with credentials included. Existing users skip step 1.',
      '',
      'Errors always use the `Error` schema.',
    ].join('\n'),
  },
  security: [{ session: [] }],
  servers: [{ url: env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT}` }],
};

/**
 * Builds the Hono application. Kept separate from the server start so tests
 * can call `app.request()` without opening a port.
 */
export function createApp() {
  const app = new OpenAPIHono();

  app.use(requestId());
  if (env.NODE_ENV !== 'test') {
    app.use(logger());
  }
  app.use(
    '*',
    secureHeaders({
      // The API docs page loads Scalar from a CDN.
      contentSecurityPolicy: undefined,
    }),
  );
  app.use(
    '/api/*',
    cors({
      origin: env.CORS_ORIGINS,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Request-Id'],
      credentials: true,
    }),
  );
  app.use('/api/*', requireAllowedOrigin(defaultAllowedOrigins()));
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: env.BODY_LIMIT_BYTES,
      onError: (c) =>
        c.json({ message: 'Request body too large.', status: 413 }, 413),
    }),
  );

  // Better Auth handles its own routes (sign-in, callback, session, sign-out).
  if (env.AUTH_MODE === 'better-auth') {
    app.on(['GET', 'POST'], '/api/auth/*', (c) => getAuth().handler(c.req.raw));
  }

  // Public docs. Registered before the API router, whose auth middleware
  // would otherwise also match these paths.
  app.doc31(OPENAPI_PATH, openApiConfig);
  app.get(DOCS_PATH, Scalar({ url: OPENAPI_PATH, pageTitle: 'Timeline API' }));

  app.route('/api', createApiRouter());
  app.get('/', (c) => c.text('Timeline API running. Docs: /api/docs'));

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  return app;
}
