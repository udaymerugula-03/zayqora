# ZAYQORA Release 1 API

FastAPI modular monolith; PostgreSQL is the only supported runtime database. Cash delivery/pickup only. Fictional restaurants are private development records, not publicly operating businesses. No reviews, revenues or payments are fabricated.

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
# Optional private development accounts only; do not seed a live customer environment.
backend\.venv\Scripts\python -m app.seed
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8086 --no-access-log
```

Seed writes randomly generated passwords **only** to root `.demo-credentials.json` (must be gitignored). It does not print passwords, overwrite existing accounts, or create orders/revenue. Optional `--credentials-output .demo-credentials-private.json` must name an ignored hidden JSON file inside the root; the CLI checks Git ignore rules and refuses non-ignored output. Keep this file private and delete it when no longer needed; Windows operators must restrict its ACL to the service account. Accounts: `owner@zayqora.demo`, `garden@zayqora.demo`, `admin@zayqora.demo`. Seeded owner accounts are explicitly pre-verified demo exceptions. Restaurants: `saffron-table`, `garden-cafe`.

API: `http://127.0.0.1:8086/api/v1`; OpenAPI `/docs`; readiness `/api/v1/health`. Frontend bundled `/food/*.jpg` assets are not copied by the backend. Requests authenticate with `Authorization: Bearer <access_token>`. Set frontend API origin to the actual API URL. All monetary values are two-decimal PKR strings. Restaurant timezone is Asia/Karachi; stored timestamps are UTC. Default demo hours 00:00–23:59 local, editable by owner.

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

Order and reservation creation queue a separate notice to the restaurant contact email, independently of whether the customer supplied an email. Valid owner status changes and the first explicit cash receipt queue customer notices when a customer email exists, in the same transaction. Invalid transitions and repeated cash recording do not queue duplicates. Notices contain references and truthful statuses, not internal reasons or private tracking tokens. The existing generic SMTP worker processes these kinds without additional configuration; a queued record is not proof of delivery.

## Configurable website and enquiries

Migration `0002_website_inquiries` adds restaurant `website_settings`, read-only `is_demo`, and the tenant-scoped contact inbox. Apply normal additive migrations before serving the new application; no seed/reset is required. Only known fictional slugs with an existing description containing “demonstration restaurant” are backfilled as demos; new fictional seeded restaurants set the flag explicitly.

Restaurants marked `is_demo` are excluded from public listing counts and results,
direct lookup/menu, quotes, checkout (including previous idempotent responses),
reservation availability/creation, contact enquiries and public order tracking.
They remain accessible through their authorised owner and platform administration
APIs. Explicit publication returns 422; other private edits and unpublication
remain supported, including for legacy seed records whose stored `published`
flag is still true. Fresh seeds start unpublished. No migration, database reset,
environment bypass or clearing of the marker is needed. Only approved real
restaurant accounts should be configured for customers. This does not make
public stock imagery or food/branding Blob URLs confidential.

Existing real-restaurant tracking links and matching checkout retries continue
to work after unpublication; hiding a website must not strand an already
committed real order. New activity still requires an active published business.

`PATCH /api/v1/restaurant` accepts `website_settings` as a validated **full replacement** with defaults, not a shallow merge. Restaurant responses expand missing settings to the complete defaults. Settings cover plain-text About/SEO/policy content, navy/emerald/terracotta themes, editorial/sans typography, optional gallery/FAQs, homepage section order and new-reservation availability. Gallery URLs accept HTTPS or bundled `/food/`/uploaded `/media/` paths. Gallery/FAQ navigation should appear only when enabled and nonempty. Setting `reservations_enabled` false blocks public availability and new reservations with `409 service_disabled`; existing capacity holds and owner status changes remain valid.

`POST /api/v1/public/restaurants/{slug}/inquiries` validates contact name, email, subject, message and explicit consent, persists only for active published tenants, and queues an owner notice when the restaurant has an email. Its `201` response contains only `reference`, `status: received`, and honest `notification_status: queued|provider_not_configured`. Owner `GET /api/v1/inquiries` is paginated; `PATCH /api/v1/inquiries/{id}` accepts `new|read|resolved`, is tenant-scoped, and audits each change.

Owner `GET /api/v1/orders` retains status/search/pagination and adds optional `fulfilment=pickup|delivery`, `payment_status=paid|unpaid`, inclusive Karachi `from_date`/`to_date`, and `active_only=true`. Dates use a half-open timestamp interval; reversed dates are rejected. Active orders exclude completed, rejected and cancelled states.

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
- Order rejection/cancellation and reservation decline/cancellation require a nonblank reason of at least three trimmed characters, enforced server-side with HTTP 422 `reason_required`. Successful changes and reasons are audited atomically; failed validation cannot mutate status/history. Paid orders cannot be rejected or cancelled even with a reason (HTTP 409; no cash refunds implemented).
- Reservations hold capacity while REQUESTED/CONFIRMED/SEATED, respect buffers and local hours, and allocate a suitable active table under a PostgreSQL restaurant row lock. Availability is advisory; commit is authoritative.
- Reports use actual stored completed, paid orders only. Sales are grouped by order-created date in the restaurant timezone; full metric definitions are returned.
- Production blockers: distributed/edge rate limiting (current limiter is process-local), a configured dedicated Blob store/token, configured and tested SMTP worker, managed TLS, backups/recovery testing, secret management, observability and deployment-specific capacity/load testing. Production upload correctly fails closed until storage exists.
- Require HTTPS. Do not log Authorization, verification links, request bodies with PII, or tracking URLs. Tracking responses exclude customer contacts, address, internal notes and history reasons. Treat tracking tokens and the stored idempotency creation response as confidential.
- No customer accounts, card handling, online payment providers, Redis/Celery, staff/KDS/POS suite or refund-state simulation.
