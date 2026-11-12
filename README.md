# Timeline backend

Backend for a family timeline: people, their relationships, activities and milestones,
plus generated birthdays. Node.js + Hono + Zod, Postgres via Drizzle behind a
database-agnostic data layer, Google sign-in via Better Auth gated by access codes, and an
OpenAPI document generated from the same Zod schemas that validate requests.

- Data model: [DATA_MODEL.md](DATA_MODEL.md)
- API reference while running: <http://localhost:3000/api/docs> (Scalar UI)
- OpenAPI document: `GET /api/openapi.json`, or `npm run openapi:export` to write `openapi.json`

## Architecture

```text
HTTP ─▶ middleware ─▶ route definition ─▶ controller ─▶ service ─▶ repository interface ─▶ driver (postgres/)
        request id     *.openapi.ts         typed        business     src/data/repositories.ts   Drizzle + pg
        cors, limits   zod in + out,        handler      rules,
        auth, roles    validation, docs                  no SQL
```

Each feature folder in `src/api/` has the same files:

| File | Purpose |
| --- | --- |
| `zod/*.schema.ts` | Request and response schemas (`.openapi('Name')` makes them named components) |
| `*.openapi.ts` | Route definitions: path, params, body, responses, role middleware |
| `*.controller.ts` | Handlers typed from the route (`RouteHandler<typeof route>`), so responses must match the documented schema |
| `*.service.ts` | Business logic, uses only repository interfaces |
| `*.routes.ts` | Registers the routes on the router |

Request validation runs before the controller. Failures and every other error use one
format: `{ "message": "...", "status": 400, "issues": [{ "path": "end", "message": "..." }] }`.

```text
src/
├── api/
│   ├── access-codes/  check (public), redeem, admin management
│   ├── users/         /me and admin user management
│   ├── groups/        groups and members
│   ├── people/        people and relationships
│   ├── entries/       timeline entries
│   ├── timeline/      merged, chronological view incl. birthdays
│   ├── search/        search bar backend
│   ├── import/        parsing service: parsers/ produce one canonical format
│   └── api.routes.ts  public routes, then requireAuth, then everything else
├── auth/better-auth.ts  Better Auth config incl. the sign-up gate hooks
├── data/
│   ├── models.ts         domain types, enums
│   ├── repositories.ts   data access interfaces
│   ├── errors.ts         driver-independent data errors
│   ├── index.ts          picks the driver from DB_DRIVER
│   └── postgres/         Drizzle schema + repository implementations + Better Auth adapter
├── middleware/      auth, group roles, origin check, rate limit, error handler
├── shared/          errors, OpenAPI helpers, zod helpers, partial date logic
├── create-app.ts    Hono app (no server, used by tests and the OpenAPI export)
├── startup.ts       tasks on start (initial access code)
├── index.ts         Vercel entry point: default-exports the app
└── node-server.ts   plain Node server for local dev and self-hosting, graceful shutdown
```

## Setup

Requirements: Node.js 22.18 or newer, Docker (for the local database).

```bash
cp .env.example .env
npm install
npm run db:up          # start Postgres in Docker
npm run db:migrate     # apply migrations in ./drizzle
npm run dev            # http://localhost:3000, docs on /api/docs
```

With `AUTH_MODE=dev` (the default) every request is an admin dev user, so you can build the
frontend without Google credentials. Switch to `AUTH_MODE=better-auth` to test the real flow.

| Script | |
| --- | --- |
| `npm run dev` | Watch mode with tsx (`src/node-server.ts`) |
| `npm run build` / `npm start` | Compile to `dist/` and run it with plain Node |
| `npm test` | Vitest against an in-memory Postgres (PGlite), no Docker needed |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run openapi:export` | Write `openapi.json` (no database needed) |
| `npm run db:generate` | Create a migration after changing `src/data/postgres/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |

## Authentication and access

Nobody can create an account without an access code from an admin.

```text
1. POST /api/access-codes/check { code }      public, rate limited (10 per IP per 15 min)
   ─▶ validates without using the code, sets an httpOnly cookie (15 min, path /api/auth)
2. Sign in with Google through Better Auth    POST /api/auth/sign-in/social
   ─▶ on account creation, a Better Auth hook redeems the code from the cookie
      atomically; no usable code, no account (error=ACCESS_CODE_REQUIRED / INVALID_ACCESS_CODE)
3. Use the API with the session cookie
```

Existing users skip step 1 and just sign in. Signed-in users can join another group with
`POST /api/access-codes/redeem`.

**Roles**

- App role `admin`: manages access codes and users, sees every group as owner. The first admin
  signs up with `INITIAL_ACCESS_CODE`, which is created once on startup.
- Group roles: `viewer` reads, `editor` also writes content, `owner` also renames or deletes the
  group and manages members. Non-members get a 404 for the group.

**Access codes** are one-time use, expire after at most 14 days, can be revoked, can be bound
to one email, and grant a group role and/or the admin role. Only a SHA-256 hash is stored; the
plain code is shown once when created.

**Google setup:** in Google Cloud Console create an OAuth client (Web application), add
`<BETTER_AUTH_URL>/api/auth/callback/google` as redirect URI and put the client id and secret
into `.env`.

**Cookies across origins:** sessions are cookies. Locally `localhost:5173` and `localhost:3000`
count as the same site, so this works out of the box. In production, serve frontend and API
under the same domain (e.g. Caddy routing `/api` to the backend); otherwise you need
`SameSite=None` cookies.

## Frontend integration

```bash
npm run openapi:export                                   # in this repo
npx openapi-typescript ../timeline-backend/openapi.json -o src/api/schema.d.ts   # in the frontend
```

`openapi-fetch` (or orval, hey-api) then gives a typed client. Always send credentials:

```ts
import createClient from 'openapi-fetch';
import type { paths } from './api/schema';

export const api = createClient<paths>({ baseUrl: 'http://localhost:3000', credentials: 'include' });
const { data } = await api.GET('/api/groups/{groupId}/timeline', {
  params: { path: { groupId: 1 }, query: { from: '2024-01-01', to: '2024-12-31' } },
});
```

Better Auth's own routes are not in the OpenAPI document; use its client for sign-in:

```ts
import { createAuthClient } from 'better-auth/client';

const auth = createAuthClient({ baseURL: 'http://localhost:3000' });

// After POST /api/access-codes/check succeeded (or for returning users):
await auth.signIn.social({
  provider: 'google',
  callbackURL: 'http://localhost:5173/',
  errorCallbackURL: 'http://localhost:5173/login', // receives ?error=ACCESS_CODE_REQUIRED etc.
});
```

## API overview

The full reference with schemas is on `/api/docs`.

| Area | Endpoints |
| --- | --- |
| Public | `GET /health`, `POST /access-codes/check` |
| Me | `GET /me`, `POST /access-codes/redeem` |
| Admin | `/admin/access-codes` (list, create, revoke), `/admin/users` (list, change role, delete) |
| Groups | `/groups`, `/groups/{groupId}`, `/groups/{groupId}/members` |
| People | `/groups/{groupId}/people`, `/people/{personId}`, `/people/{personId}/relationships` |
| Entries | `/groups/{groupId}/entries` (paginated, filters `from, to, personIds, kinds, categories, q`) |
| Timeline | `GET /groups/{groupId}/timeline` (`from, to, personIds, kinds, categories, includeBirthdays`) |
| Search | `GET /groups/{groupId}/search?q=` |
| Import | `POST /groups/{groupId}/import/preview`, `POST /groups/{groupId}/import` |

List filters take comma separated values: `?personIds=1,2&kinds=milestone`.

### Import format

Implemented source: `text`. One entry per line:

```text
# <date or range> | <title> | <description> | <tags>
2016-08..2020-07 | Apprenticeship at the cantonal administration | | milestone, education
2025-07-14 | Climbing trip to Ticino | Great weather | hobby
```

`linkedin` and `xing` are registered but answer `501` for now. Re-importing the same
content skips existing entries. An import with invalid lines is rejected unless
`"skipInvalid": true`.

## Deploying to Vercel with Neon

Vercel detects Hono through `src/index.ts` and runs the app as one Vercel Function (Node.js,
Fluid compute). `npm run build` (tsc) runs during the deployment and fails it on type errors.
`vercel.json` pins the function region to `fra1` (Frankfurt); set it to the region closest
to your Neon database (Neon `aws-eu-central-1` = `fra1`, `aws-us-east-1` = `iad1`).

### 1. Frontend and backend must share a site

Sessions are cookies. Two `*.vercel.app` projects are different sites, so browsers will not
send the backend's cookies from the frontend. Pick one:

- **Rewrite through the frontend (recommended, no custom domain needed).** In the frontend
  project's `vercel.json`:

  ```json
  { "rewrites": [{ "source": "/api/:path*", "destination": "https://<backend>.vercel.app/api/:path*" }] }
  ```

  The browser only talks to the frontend's domain and the frontend calls `/api/...` with a
  relative URL. Set `BETTER_AUTH_URL` and `CORS_ORIGINS` to the frontend URL.
- **Custom subdomains of one domain**, e.g. `timeline.example.ch` and `api.example.ch`. Set
  `BETTER_AUTH_URL=https://api.example.ch` and `CORS_ORIGINS=https://timeline.example.ch`.

### 2. Who can use the API

- Every data endpoint requires a Better Auth session, and accounts need an access code.
  This is the real protection.
- `CORS_ORIGINS` is the frontend allowlist. Browsers only expose responses to those origins,
  and requests that change data (POST, PATCH, DELETE, incl. sign-in) are rejected with 403
  unless their `Origin` is in the list or is `BETTER_AUTH_URL`. In production a missing
  `Origin` is rejected as well, so only a browser on the frontend can write.
- Origin headers can be faked by non-browser clients, so this stops other websites, not
  scripts. To also slow down scripts, add a Vercel Firewall rate limit rule for
  `/api/access-codes/check` and `/api/auth/*` in the backend project.
- Preview deployments of the frontend have their own URLs and are blocked unless you add
  them to the backend's `CORS_ORIGINS` (e.g. a fixed preview branch alias).

### 3. Setup

1. Create the backend project on Vercel from this repository (framework preset: Hono).
2. Add Neon from the Vercel Marketplace (Storage tab) and connect it to the project. It sets
   `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used for
   migrations). Without the integration, set both from the Neon console.
3. Set the environment variables (Production, and Preview if you use it):

   | Variable | Value |
   | --- | --- |
   | `AUTH_MODE` | `better-auth` (Vercel runs with `NODE_ENV=production`, where `dev` is refused) |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | public URL the browser uses for `/api` (see step 1) |
   | `CORS_ORIGINS` | the frontend origin(s), https only |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client |
   | `INITIAL_ACCESS_CODE` | first admin code, created on the first request after deploy |

   `HOST`, `PORT` and `TRUST_PROXY` are not used on Vercel.
4. In Google Cloud Console add `<BETTER_AUTH_URL>/api/auth/callback/google` as redirect URI
   and the frontend origin as JavaScript origin.
5. Run the migrations against Neon before the first deployment and after every schema change:

   ```bash
   vercel env pull .env.production.local --environment production
   node --env-file=.env.production.local node_modules/drizzle-kit/bin.cjs migrate
   ```

6. Deploy (push to the connected branch, or `vercel deploy --prod`) and check
   `<backend>/api/health`, which reports `{"ok":true,"db":"up"}`.

## Using another database

Services never import Drizzle or `pg`. To support another database, implement `DataLayer`
(`src/data/index.ts`): the `Repositories` interfaces plus a Better Auth adapter (Better Auth
ships adapters for Drizzle with pg, mysql and sqlite, Kysely, Prisma and MongoDB). Translate
constraint errors into `src/data/errors.ts`, then add the driver to `DB_DRIVER`. The tests go
through the HTTP API, so they can verify a new implementation unchanged.

## Notes

- The rate limiter is in memory, fine for one server instance. On Vercel every function
  instance has its own counter, so add a Vercel Firewall rate limit rule (see above).
- `better-auth` is pinned to an exact version; check its changelog before upgrading.
