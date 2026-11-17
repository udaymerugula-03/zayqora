# ZAYQORA

ZAYQORA is an internship demonstration of a multi-tenant restaurant platform,
based on the Release 1 scope in `project_02(Web).docx`. It is a separate project
from AqarFlow. Saffron Table is a fictional demonstration restaurant; the bundled
photographs are stock examples, not evidence of an actual restaurant or its food.

## Product scope

The Release 1 implementation covers a public restaurant website and menu,
guest cart and cash checkout, private order tracking, reservations, a restaurant
owner workspace, and basic platform administration. One ZAYQORA visual identity
is used throughout the public and authenticated interfaces.

The platform homepage is owner-focused, with one registration action in its
hero. Customer browsing remains a separate navigation link to published
restaurant websites, where menu, ordering and reservation actions belong.
The directory is a convenience, not a document-mandated marketplace. Owners
and platform administrators share the explicitly labelled sign-in screen.
VIRELEO is the platform operator specified by the document, not a second product
brand. Shared navy/teal/gold tokens and the ZAYQORA logo remain consistent;
restaurant theme presets remain configurable as required by section 6.3.
Storefront and operational layouts stay task-specific, following section 10.1.

Release alignment follows the supplied document's sections 20.2 and 22.1.
The owner workspace includes a setup guide, configurable website content,
contact enquiries and a basic owner-operated kitchen order board. The latter
reuses the order lifecycle; it is not the Release 2 staff KDS or station router.
Gallery and FAQ navigation are conditional on the owner's published content.
Offers, coupons, review management and customer CRM are Release 2, not empty
MVP tabs.

The initial market is Pakistan, prices are in PKR, and restaurant schedules use
Asia/Karachi time. Delivery and pickup are cash-only. Cash collection is an
explicit owner action, not an automatic consequence of placing an order.
Reservation requests hold capacity while awaiting the owner's decision.

Restaurant owners manage their own restaurant, menu, orders, tables,
reservations and reports. Platform administrators manage tenants and plans;
public registration must never grant platform administration.

Release 2/3 features are not included: full staff KDS, POS, QR table ordering,
rider management, coupons, CRM, inventory, multi-branch operations, subscription
charging, loyalty, custom domains and advanced analytics. Online payment
providers are deliberately disabled pending merchant/provider approval.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| API | Python, FastAPI, Pydantic |
| Database access | SQLAlchemy and Alembic |
| Runtime database | PostgreSQL |
| Browser workflows | Playwright |
| Hosting configuration | Next.js and FastAPI services in one Vercel project |
| Uploaded public restaurant images | Dedicated Vercel Blob store |
| Email processing | Transactional outbox and SMTP delivery worker |

`contracts\api-contract.json` documents the shared API contract. Monetary amounts
are decimal strings; the API calculates authoritative prices. Tenant access is
derived from the authenticated user, not a restaurant identifier supplied by
the browser.

## Configuration and private data

Copy `.env.example` to `.env` and supply your own PostgreSQL connection and a
cryptographically random secret. Never use example credentials for a deployed
application. The API reads server configuration; database credentials and mail
or storage tokens must never use a `NEXT_PUBLIC_` prefix.

The existing local demonstration uses a dedicated PostgreSQL database and
application role, separate from AqarFlow's data. Its credentials are in the
ignored `.env`, not in this repository. Local and hosted demonstration
instances may share demonstration data; this is not environment isolation for
real customers. Use independent development, preview and production databases
before accepting real business data.

Generated demonstration login details belong in the ignored
`.demo-credentials.json`. Do not put that file in Git, screenshots, support
messages or client documentation.

The supplied photographs and their sources are in `frontend\public\food`.
See `sources.json` for attribution and demonstration-use information.

## Run locally on Windows

Prerequisites: Node.js 22.12 or later, Python 3.12-3.14 and PostgreSQL. From the
project root, install dependencies once:

```powershell
npm.cmd ci --prefix frontend
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Configure the ignored root `.env`, then apply migrations. For a demonstration
database only, create the optional fictional restaurants and generated accounts:

```powershell
backend\.venv\Scripts\python -m alembic -c backend\alembic.ini upgrade head
$env:PYTHONPATH = 'backend'
backend\.venv\Scripts\python -m app.seed
```

Start the API in one terminal:

```powershell
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8086 --no-access-log
```

Start the frontend in a second terminal:

```powershell
npm.cmd run dev --prefix frontend
```

Open http://127.0.0.1:3000. The API readiness endpoint is
http://127.0.0.1:8086/health. Port 8086 is intentional; do not terminate another
application to reclaim port 8085. If you choose a different API port, set
`API_ORIGIN` in the frontend terminal before launching Next.js.

Both owner and platform administrator accounts use `/login`; successful login
routes each role to the correct workspace. Demonstration accounts are
`owner@zayqora.demo`, `garden@zayqora.demo`, and `admin@zayqora.demo`.
Their passwords are only in the ignored `.demo-credentials.json`. The hosted
fictional demo uses user-requested simplified passwords; never reuse these
credentials for a real restaurant. Fresh database seeding still generates
random passwords rather than embedding shared credentials in source.

| Screen | Path |
| --- | --- |
| Platform home | `/` |
| Demonstration restaurant | `/r/saffron-table` |
| Digital menu | `/r/saffron-table/menu` |
| Cart and cash checkout | `/r/saffron-table/cart`, `/r/saffron-table/checkout` |
| Reservation requests | `/r/saffron-table/reservations` |
| Owner dashboard | `/app/dashboard` |
| Orders, menu, reservations | `/app/orders`, `/app/menu`, `/app/reservations` |
| Owner setup and website builder | `/app/setup`, `/app/website` |
| Basic kitchen board and contact enquiries | `/app/kitchen`, `/app/inquiries` |
| Owner reports, settings, outbox | `/app/reports`, `/app/settings`, `/app/notifications` |
| Platform administration | `/platform/overview`, `/platform/tenants`, `/platform/plans` |

Private tracking links are returned after checkout; never publish them in
documentation or analytics. For mail configuration, delivery-worker commands,
PostgreSQL test schemas and operational details, see `backend\README.md`.

Restaurant pages use `/r/[slug]`. Gallery (`/gallery`) and FAQs (`/faqs`) appear
when enabled and populated; `/policies` exposes the configured cancellation
information. The contact form saves an enquiry in the owner's inbox before
acknowledging receipt. An acknowledgement does not mean an email was delivered
or a booking/order was accepted.

Saffron Table and Garden Cafe are private development seed data, not names
mandated by the product specification. Restaurants with the read-only `is_demo`
marker are excluded from public listings, direct website/API access and public
ordering, booking, enquiry and tracking flows. Their records remain available
to authorised owners and platform administrators. Owners cannot clear this
marker or publish these records. Create a separate account with approved real
business details instead of relabelling fictional data. An empty public
directory is intentional until a real restaurant is configured and published.

## Development checks

```powershell
npm.cmd ci
npm.cmd run test:frontend
npm.cmd run build
backend\.venv\Scripts\python -m pytest backend\tests -q
npm.cmd run test:e2e
```

Browser workflows require the running API/frontend and an installed Google
Chrome browser. Private seeded accounts support workspace and public-exclusion
checks. Public order/reservation workflows require an explicitly configured
restaurant in an isolated test environment: set `E2E_PUBLIC_RESTAURANT_SLUG`,
`E2E_PUBLIC_OWNER_EMAIL` and its entry in `E2E_CREDENTIALS_FILE`. Without these,
those two mutating flows are explicitly skipped; private seed tenants are not
relabelled or republished. Never target a real restaurant database. Use
`E2E_BASE_URL` to select the isolated environment. The backend guide explains
`TEST_DATABASE_URL` and its disposable PostgreSQL schemas. Isolated frontend
browser fixtures cover public screens without publishing test businesses.

## Hosting

Hosted internship demonstration: https://zayqora-restaurants.vercel.app

`vercel.json` declares the two services and their shared public routing. Requests
under `/api/` go to FastAPI; other application routes go to Next.js. The
`API_ORIGIN` service binding lets server-rendered frontend pages call the backend
without exposing server secrets. Local development uses port 3000 for Next.js
and port 8086 for FastAPI.

Apply database migrations explicitly before a release. Do not initialize,
reseed or reset a database on application imports or serverless cold starts.
Use durable object storage for production uploads, never a serverless instance's
temporary filesystem.

The notification outbox requires a separately operated delivery worker and
approved SMTP credentials. A serverless HTTP deployment is not a continuous
worker. Account verification and customer email delivery must not be described
as working until a real sender and worker have been configured.

The public health endpoint is a readiness baseline, not a configured monitoring
and alerting service. Provider-managed database backups, an independently tested
restore, external monitoring/alerts and separated staging/production resources
still require operator configuration. The current demonstration must not be
presented as satisfying those production acceptance items.

## Before commercial use

This is a demonstration, not a production-readiness or legal-compliance claim.
Confirm brand/trademark/domain availability, customer-facing policies, delivery
areas, opening hours, tax rules, email sender approval, database recovery,
monitoring, worker operation, capacity and provider limits before real customer
onboarding. Plan assignment is configuration only, not subscription billing.

## Client technical documentation

The client handover is in
`docs\ZAYQORA_Release1_Illustrated_Technical_Documentation_17_Nov_2026.docx`.
It covers the implemented screens, architecture, technology stack, Pakistan/PKR
pricing, cash-order and reservation flows, deployment and release limitations,
with actual workflow screenshots and original architecture, role and order-flow
diagrams. The editable source is
`docs\ZAYQORA_Technical_Documentation_and_Flows.md`; screenshot assets and their
sanitized capture manifest are alongside it. Passwords and private tracking
links are intentionally excluded.
The earlier dated Word report is retained as a historical snapshot.
