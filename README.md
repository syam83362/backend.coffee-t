# Coffee-T API

The NestJS API owns authentication, authorization, validation, catalogue, ordering, café, reservation, and administration rules. It uses PostgreSQL and tracked TypeORM migrations; automatic schema synchronization is disabled.

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
| GET | `/categories`, `/products`, `/products/:slug` | Shared catalogue with channel-specific availability |
| GET/POST | `/cart`, `/cart/items/:variantId` | Authenticated customer cart |
| GET/POST | `/addresses` | Customer delivery addresses |
| POST/GET | `/orders/checkout`, `/orders` | Delivery checkout and order history |
| POST/GET | `/orders/:orderId/payments` | Development-only payment attempt workflow |
| GET/POST | `/cafes`, `/table/:tableCode/...` | Café discovery and table-token ordering |
| GET/POST/PATCH | `/staff/...` | Assigned-café waiter and manager operations |
| GET/POST/PATCH | `/reservations/...` | Café-local table reservations |
| GET/POST/PATCH | `/admin/...` | Platform and café management |

All unsafe browser requests require a CSRF token. Table endpoints additionally require the table's `X-Cafe-Table-Token`. Public registration always creates a customer. Use the one-time CLI bootstrap below to provision the first platform administrator; no public role-promotion endpoint exists.

Public registration always assigns the `customer` role. `RolesGuard` and the `admin` role are available for protected admin routes; no public role-promotion endpoint exists. Email verification and password recovery are not included in this slice because an email-delivery approach has not been selected.

## Local Setup

Use Node.js 20 or newer and PostgreSQL. From this directory, run:

```sh
npm install
```

Copy `.env.example` to `.env`, set `DATABASE_URL`, and replace both secrets with separate random values of at least 32 characters. The PostgreSQL database and role must already exist. Then apply tracked migrations and optionally seed development-only catalogue/café data:

```sh
npm run migration:run
npm run seed:dev
npm run start:dev
```

Never run `seed:dev` with `NODE_ENV=production`. It refuses production mode. It creates the demo café and table code `bengaluru-demo-t1`; its local-only table token is `coffee-t-demo-table-token`.

To provision the first platform administrator, set `ADMIN_BOOTSTRAP_ENABLED=true`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in the backend environment for one command, then run `npm run admin:bootstrap`. Use a unique password of at least 12 characters. The command refuses to run once an administrator exists; unset the bootstrap flag afterward. Public registration cannot create staff or admin roles.

## Reservation Defaults

Provisional defaults are a 90-minute reservation, 30-minute start intervals, a 30-day booking window, and cancellation at least 120 minutes before the booking. They can be changed using `BOOKING_DURATION_MINUTES`, `BOOKING_SLOT_MINUTES`, `BOOKING_ADVANCE_DAYS`, and `BOOKING_CANCELLATION_CUTOFF_MINUTES`. Café hours and IANA timezone are stored per café. Confirmed overlaps are serialized by a row-locking PostgreSQL trigger. These defaults need business approval before launch.

## Payments and Stock

No production payment provider is selected. The `development` adapter is explicitly labelled, refuses all simulation in production, and production checkout/payment-attempt creation remains disabled until a real provider is configured. Pending orders hold stock for at most 30 minutes; payment attempts expire after 15 minutes. Failed/expired attempts release stock. Online fulfillment uses global stock; café fulfillment uses café-specific stock and optional price overrides.

## Local Containers

With Docker Engine and the Compose plugin installed, start local PostgreSQL and API with `docker compose up --build -d`. Apply migrations with `docker compose run --rm backend npm run migration:run:prod`, then seed only if needed with `docker compose run --rm backend npm run seed:dev`. Compose credentials are local-only placeholders; do not reuse them outside local development.

## Checks

```sh
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm audit --omit=dev
```

Most service tests use mocks. The API requires PostgreSQL at startup. The development payment adapter is not a provider integration; real sandbox/webhook verification, refunds, abandoned-attempt provider callbacks, and deployment remain unimplemented pending provider and infrastructure decisions.