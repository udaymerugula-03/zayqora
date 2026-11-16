# ZAYQORA Release 1 API

FastAPI modular monolith; PostgreSQL is the only supported runtime database. Cash delivery/pickup only. Demo restaurants are clearly labelled demonstrations. No reviews, revenues or payments are fabricated.

## Windows launch (from project root)

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
# Set these in your shell or ignored root .env; never commit credentials:
$env:DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
$env:SECRET_KEY = '<at least 32 cryptographically random characters>'
$env:PUBLIC_ORIGIN = 'http://localhost:3000'
backend\.venv\Scripts\python -m alembic -c backend\alembic.ini upgrade head
$env:PYTHONPATH = 'backend'
backend\.venv\Scripts\python -m app.seed
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8085
```

Seed writes randomly generated passwords **only** to root `.demo-credentials.json` (must be gitignored). It does not print passwords, overwrite existing accounts, or create orders/revenue. Optional `--credentials-output .demo-credentials-private.json` must name an ignored hidden JSON file inside the root; the CLI checks Git ignore rules and refuses non-ignored output. Keep this file private and delete it when no longer needed; Windows operators must restrict its ACL to the service account. Accounts: `owner@saffrontable.demo`, `owner@gardencafe.demo`, `admin@zayqora.demo`. Seeded owner accounts are explicitly pre-verified demo exceptions. Restaurants: `saffron-table`, `garden-cafe`.

API: `http://127.0.0.1:8085/api/v1`; OpenAPI `/docs`; readiness `/api/v1/health`. Frontend bundled `/food/*.jpg` assets are not copied by the backend. Requests authenticate with `Authorization: Bearer <access_token>`. Set frontend API origin to the actual API URL. All monetary values are two-decimal PKR strings. Restaurant timezone is Asia/Karachi; stored timestamps are UTC. Default demo hours 00:00–23:59 local, editable by owner.

If another application already owns port 8085, do not stop it: use `--port 8086` and have the parent/operator point the frontend API origin at `http://127.0.0.1:8086`.

## Configuration and email

Set `BLOB_READ_WRITE_TOKEN` server-side for a **dedicated public Vercel Blob store** owned by this project, never a shared/AqarFlow store. The token automatically enables durable Blob uploads in both development and production; there is no additional SDK dependency. Owner uploads are validated with Pillow (JPEG/PNG/WebP input, maximum 4 MB and 20 megapixels), stripped of metadata by JPEG re-encoding, resized to at most 2400 pixels, and uploaded with a generated `restaurants/<server-derived-tenant-id>/<uuid>.jpg` pathname. The response is `{url: "https://<store>.public.blob.vercel-storage.com/..."}` and can be saved as the restaurant/menu image URL. Token values, upstream response bodies and provider exception messages are never returned or logged.

The adapter uses the Vercel Blob REST PUT endpoint with API version 13, public access, overwrite disabled, TLS verification, bounded timeouts and redirects disabled. A private store, invalid token, timeout or provider failure returns an explicit 503; there is **no** fallback to ephemeral files. Health reports `media: "vercel_blob"` when configured (configuration status, not a claim that the provider was successfully contacted). Keep the token out of `NEXT_PUBLIC_*`, frontend bundles and source control. Media is public food/branding imagery only, not customer documents.

Without a Blob token, `APP_ENV=development` with `MEDIA_STORAGE=local` permits local uploads in root `.uploads`, served at `/media/`. Production without durable storage returns 503. Set `ENVIRONMENT=production` and HTTPS `PUBLIC_ORIGIN` for hosted deployments. The cloud service entrypoint is **`app.main:app`** from service root `backend\`. Migrations and seeding are explicit CLI operations only, never module-import or cold-start hooks.

SMTP delivery is real and independent:

```powershell
$env:SMTP_HOST = 'smtp.example.com'
$env:SMTP_PORT = '587'
$env:SMTP_FROM = 'ZAYQORA <noreply@example.com>'
$env:SMTP_USERNAME = '<provider username>'
$env:SMTP_PASSWORD = '<provider password>'
$env:SMTP_STARTTLS = 'true'
$env:PYTHONPATH = 'backend'
backend\.venv\Scripts\python -m app.worker
```

Without SMTP host/from, registration remains **pending/unverified**, explicitly reports `provider_not_configured`, and queues a DB outbox record; it never claims an email was sent. Configure SMTP and run worker to deliver. Verification uses the frontend `/verify-email?token=...` route, which submits token to `POST /api/v1/auth/verify-email`. Tokens expire in 24 hours and are hashed in the verification table; SMTP outbox must temporarily contain the email link, so encrypt DB/backups and restrict DB access. Successful delivery redacts body. Outbox is at-least-once (a process crash after provider acceptance can cause a duplicate), with stable Message-ID, retry backoff and failed status after ten attempts. No fake delivery.

Additive recovery endpoint `POST /api/v1/auth/resend-verification` accepts `{email}`, invalidates previous verification links, and queues a fresh link without exposing tokens or account existence. It reports absent SMTP honestly; configure SMTP first if old links expired.

Settings explicitly read root `C:\Users\venkatasaiutm\Zayqora\.env` (resolved relative to the application source, not the current working directory), plus process environment overrides. The parent/operator owns this file; application and seed never overwrite it.

For PostgreSQL `sslmode=verify-full`, the engine uses the maintained Certifi CA bundle if no explicit `sslrootcert` URL parameter or `PGSSLROOTCERT` environment setting exists. This supports bundled libpq on Windows while preserving certificate-chain and hostname verification. Private-CA providers must supply their trusted root certificate explicitly; TLS is never silently downgraded.

Other settings: `SESSION_HOURS=24`, `QUOTE_MINUTES=10`, `MEDIA_STORAGE=local`. Infrastructure aliases `ENVIRONMENT` (for `APP_ENV`) and `PUBLIC_ORIGIN` (for both `PUBLIC_WEB_URL` and `CORS_ORIGINS`) are accepted; explicit primary names take precedence. `PUBLIC_ORIGIN` and CORS origins must use HTTPS in production; development accepts `http://localhost:3000`. `SECRET_KEY` requires at least 32 cryptographically random bytes, has no fallback and must remain stable across workers. Sessions are opaque, stored hashed, revocable and expire. Passwords use Argon2id.

## Tests

```powershell
backend\.venv\Scripts\python -m pytest backend\tests -q
# Optional disposable dedicated PostgreSQL database; NEVER point at live data:
$env:TEST_DATABASE_URL = '<isolated PostgreSQL URL>'
backend\.venv\Scripts\python -m pytest backend\tests -q -m postgres
```

Without `TEST_DATABASE_URL`, SQLite tests cover HTTP/business behavior only, not row-lock semantics. When supplied, the HTTP/business fixtures also use PostgreSQL. Every fixture creates and drops its own randomly named test schema; it never resets or drops the seeded application's public schema/data. PostgreSQL-marked tests validate concurrent reservation and idempotent-order serialization. A missing PostgreSQL test URL is an explicit skip, not a concurrency certification.

## Operational boundaries

- All tenant identity comes from authenticated membership or resolved public slug; owners cannot supply tenant IDs. Platform admins have aggregate/tenant/plan operations only, not arbitrary tenant orders/PII access. Plan/status changes require reasons and are audited.
- Public checkout requires a current HMAC quote binding exact selections, current prices, totals and fulfilment. Menu, publication, suspension, checkout and reservation writes take the tenant row lock. Idempotency is tenant/key scoped, payload bound, and replays the original response including the tracking token.
- Completed orders must be explicitly cash-paid with valid pickup/delivery transitions. Paid cancellation is refused because cash refunds are not implemented. Order line snapshots never change with menu edits.
- Reservations hold capacity while REQUESTED/CONFIRMED/SEATED, respect buffers and local hours, and allocate a suitable active table under a PostgreSQL restaurant row lock. Availability is advisory; commit is authoritative.
- Reports use actual stored completed, paid orders only. Sales are grouped by order-created date in the restaurant timezone; full metric definitions are returned.
- Production blockers: distributed/edge rate limiting (current limiter is process-local), a configured dedicated Blob store/token, configured and tested SMTP worker, managed TLS, backups/recovery testing, secret management, observability and deployment-specific capacity/load testing. Production upload correctly fails closed until storage exists.
- Require HTTPS. Do not log Authorization, verification links, request bodies with PII, or tracking URLs. Tracking responses exclude customer contacts, address, internal notes and history reasons. Treat tracking tokens and the stored idempotency creation response as confidential.
- No customer accounts, card handling, online payment providers, Redis/Celery, staff/KDS/POS suite or refund-state simulation.
