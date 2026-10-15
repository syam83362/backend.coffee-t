# Coffee-T API

The NestJS API owns authentication, authorization, validation, and future store business rules. It uses PostgreSQL and tracked TypeORM migrations; automatic schema synchronization is disabled. The current store scope excludes café workflows and deployment/DevOps.

`GET /health` performs a database query and returns `200` only when PostgreSQL is reachable. Unexpected API errors are returned in a consistent JSON shape and logged server-side without exposing internal details.

## Authentication Slice

The API uses Argon2id password hashes, 10-minute JWT access cookies, and rotating opaque refresh tokens. Refresh tokens are stored only as SHA-256 hashes and expire after 7 days, with a 30-day maximum session-family lifetime.

The browser receives authentication only through `HttpOnly` cookies. The API uses exact-origin credentialed CORS and signed double-submit CSRF tokens. Call `GET /auth/csrf` before registration, login, refresh, and logout; send the returned token in `X-CSRF-Token` and use `credentials: 'include'` for browser fetches. Keep the CSRF token in memory, not local storage. Production cookies require HTTPS and are host-only.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/auth/csrf` | Set CSRF cookies and return a request token |
| POST | `/auth/register` | Create a customer and start a session |
| POST | `/auth/login` | Verify credentials and start a session |
| POST | `/auth/refresh` | Rotate the refresh token and issue a new access token |
| POST | `/auth/logout` | Revoke the current refresh token and clear cookies |
| GET | `/auth/me` | Return the authenticated account |
| GET | `/health` | Check API and database readiness |

Public registration always assigns the `customer` role. `RolesGuard` and the `admin` role are available for protected admin routes; no public role-promotion endpoint exists. Email verification and password recovery are not included in this slice because an email-delivery approach has not been selected.

## Local Setup

Use Node.js 20 or newer and PostgreSQL. From this directory, run:

```sh
npm install
```

Copy `.env.example` to `.env`, set `DATABASE_URL`, and replace both secrets with separate random values of at least 32 characters. The PostgreSQL database and role must already exist. Then apply the tracked migration and start the API:

```sh
npm run migration:run
npm run start:dev
```

## Checks

```sh
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

The health endpoint's unit and HTTP tests use a mocked database, so they do not require PostgreSQL. The API itself requires PostgreSQL at startup.