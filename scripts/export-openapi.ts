/**
 * Writes the OpenAPI document to openapi.json for frontend code generation,
 * e.g. `npx openapi-typescript openapi.json -o src/api/schema.d.ts`.
 * No database connection is needed.
 */
import { writeFileSync } from 'node:fs';

process.env.DATABASE_URL ??= 'postgresql://unused@localhost:5432/unused';

const { createApp, openApiConfig } = await import('../src/create-app.ts');

const document = createApp().getOpenAPI31Document(openApiConfig);
writeFileSync('openapi.json', `${JSON.stringify(document, null, 2)}\n`);

console.info(
  `Wrote openapi.json (${Object.keys(document.paths ?? {}).length} paths).`,
);
