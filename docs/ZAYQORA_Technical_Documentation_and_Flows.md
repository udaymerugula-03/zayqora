# ZAYQORA
## Technical Documentation and Illustrated Application Flows

**Release:** Release 1 internship demonstration

**Market:** Pakistan | **Currency:** Pakistani rupee (PKR) | **Business timezone:** Asia/Karachi

**Issued:** 16 November 2026

**Audience:** Client reviewers, restaurant owners, platform administrators and technical maintainers.

**Status:** An implemented demonstration, not a production-readiness, payment-certification or legal-compliance claim. Saffron Table and Garden Cafe are fictional restaurants. Stock food photographs are illustrative.

**Live application**

https://zayqora-restaurants.vercel.app

**Shared owner / platform administrator sign-in**

https://zayqora-restaurants.vercel.app/login

Passwords, database connection strings, session tokens and private order-tracking URLs are intentionally excluded from this document.

[[PAGEBREAK]]

## Contents

1. Product scope and delivery boundaries
2. User roles and screen map
3. Technical architecture and technology stack
4. Data model and API responsibilities
5. Cash ordering and order-processing flow
6. Reservation and restaurant-management flow
7. Pakistani currency, pricing and reporting
8. Authentication, tenant isolation and operational safeguards
9. Local setup, deployment and configuration
10. Operations, known limitations and handover
11. Illustrated application flows

[[PAGEBREAK]]

## 1. Product scope and delivery boundaries

ZAYQORA provides a public restaurant website and digital menu connected to a tenant-aware restaurant workspace. A guest can discover a published restaurant, customise menu items, request a current server-calculated quote, place a cash order, follow private status updates and request a table.

The restaurant owner manages the business profile, menu, food photographs, order processing, cash receipt, reservations, dining tables and sales reports. Platform administrators manage restaurant tenants and menu-capacity plans without receiving arbitrary access to individual restaurant customer orders.

The redesigned interface uses one ZAYQORA product identity across the public website, restaurant storefront, sign-in, owner workspace and platform administration. Restaurant names identify individual businesses; they do not replace the platform brand.

| Area | Implemented Release 1 scope |
|---|---|
| Public website | Platform discovery, restaurant home/about/contact, digital menu, cart, checkout and reservation screens |
| Menu | Categories, publication, availability, photographs, variants, optional extras and server-authoritative prices |
| Orders | Cash pickup/delivery, signed quotes, retry-safe order creation, status history and private tracking |
| Owner workspace | Dashboard, orders, menu, reservations/tables, reports, settings and notification outbox |
| Platform administration | Aggregate overview, tenant activation/suspension, plan assignment and plan management |
| Media | Validated owner image uploads to a dedicated public Vercel Blob store |
| Email | Database outbox and SMTP delivery worker implemented; real sender/worker configuration remains required |
| Access | Verified demonstration accounts, registration/verification endpoints, revocable sessions and role/tenant checks |

Online payments are deliberately disabled. No card numbers are requested. The application does not implement subscription charging, automated cash refunds, full staff KDS, POS, QR table ordering, coupons, CRM, riders, inventory, loyalty, multiple branches or custom domains. Those are later-release capabilities in the supplied blueprint, not hidden features of this MVP.

## 2. User roles and screen map

All authenticated roles use the same sign-in screen. After successful authentication, owners go to their restaurant dashboard and platform administrators go to the platform overview.

| Capability | Guest | Restaurant owner | Platform administrator |
|---|---|---|---|
| View published restaurant/menu | Yes | Yes | Yes |
| Place cash order / request table | Yes, with contact details and consent | Through public flow | Through public flow |
| View private tracking result | Possession of private tracking link | Public tracking if link is known | No general tenant-order access |
| Manage restaurant/menu/images | No | Own restaurant only | Not through owner APIs |
| Process orders / record cash | No | Own restaurant only | Not through owner APIs |
| Manage reservations/tables/reports | No | Own restaurant only | Not through owner APIs |
| Manage tenants and plans | No | No | Yes, with recorded reasons where required |

| Screen group | Application routes |
|---|---|
| Platform website | `/`, `/pricing`, `/privacy`, `/terms` |
| Restaurant website | `/r/[slug]`, `/r/[slug]/menu`, `/r/[slug]/about`, `/r/[slug]/contact` |
| Ordering | `/r/[slug]/cart`, `/r/[slug]/checkout`, `/track/[private-token]` |
| Reservations | `/r/[slug]/reservations` |
| Account access | `/login`, `/register`, `/verify-email` |
| Owner operations | `/app/dashboard`, `/app/orders`, `/app/menu`, `/app/reservations` |
| Owner administration | `/app/reports`, `/app/settings`, `/app/notifications` |
| Platform administration | `/platform/overview`, `/platform/tenants`, `/platform/plans` |

The existing fictional demonstration uses `owner@zayqora.demo`, `garden@zayqora.demo` and `admin@zayqora.demo`. Passwords are supplied separately and kept in the ignored local credential file. Simplified demonstration passwords must never be reused for a real restaurant.

[[PAGEBREAK]]

## 3. Technical architecture and technology stack

### 3.1 Application architecture

```text
Browser: public pages, owner workspace or platform administration
    |
    | Same-origin HTTPS requests
    v
Vercel project routing
    |-- Website routes --> Next.js / React frontend
    |                       |
    |                       | Server-side API_ORIGIN service binding
    |                       v
    |-- /api/v1/* -------> FastAPI backend
                            |-- SQLAlchemy --> PostgreSQL
                            |-- Validated public images --> Vercel Blob
                            |-- Transactional notification outbox
                                                      |
                                           Independent SMTP worker
                                                      |
                                           Approved SMTP provider
```

The frontend and API are separate services deployed together in one Vercel project. Public API routes are forwarded to FastAPI; website routes go to Next.js. Browser requests use the same public origin. Server-rendered restaurant pages read through the server-only API binding.

PostgreSQL is the runtime database. The ZAYQORA demonstration has a dedicated database and application role, separate from other applications. Development and the hosted demonstration currently share demonstration data; separate environment databases are required before real customer use.

### 3.2 Technology responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Web framework | Next.js 16 / React 19 | Routes, server-rendered restaurant content and interactive screens |
| Frontend language | TypeScript | Typed API entities, components and commerce state |
| Styling | Tailwind CSS and application CSS | Shared design system, layouts, responsive controls and states |
| Typography | Locally bundled DM Sans and Cormorant Garamond | Licensed sans-serif controls and editorial headings; no visitor-time Google Fonts request |
| API state | TanStack React Query | Data fetching, invalidation, loading/error states and periodic order refresh |
| Forms | React Hook Form and Zod | Client validation and structured forms; server validation remains authoritative |
| Backend | Python / FastAPI | Authentication, tenant authorisation, transactions and business rules |
| Schemas/settings | Pydantic / pydantic-settings | Request validation and server-side configuration |
| Persistence | SQLAlchemy 2 / psycopg | Relational models, queries, PostgreSQL transactions and row locking |
| Migrations | Alembic | Explicit versioned database schema changes |
| Passwords | Argon2id | Adaptive password hashing; no plaintext password storage in the user table |
| Image processing | Pillow | Decode validation, metadata stripping, resizing and JPEG output |
| Durable images | Vercel Blob | Public restaurant branding/food assets, not customer documents |
| Email | PostgreSQL outbox / smtplib | Durable queue, retry state and real SMTP delivery worker |
| Automated checks | pytest / Playwright / Node tests | API/business/concurrency checks and browser workflows |

Exact JavaScript dependency versions are recorded in the lockfiles. Python dependency ranges are recorded in `backend\requirements.txt`. Refer to these files rather than assuming this document is a dependency lock.

### 3.3 Repository structure

```text
Zayqora
  backend
    app                 API, models, business services, seed and mail worker
    migrations          Alembic schema migration
    tests               API, reporting, media and PostgreSQL concurrency checks
  frontend
    src\app             Public, restaurant, account and workspace routes
    src\components      Interactive screens and shared controls
    src\lib             API client, types and commerce helpers
    public\food         Licensed demonstration images and source manifest
    browser             Isolated browser regression fixtures and tests
  contracts             Shared API contract
  e2e                   Real-service desktop/mobile workflow tests
  docs                  This guide, Word copy and screenshot assets
  vercel.json           Service bindings and public routing
  .env.example          Non-secret configuration template
```

[[PAGEBREAK]]

## 4. Data model and API responsibilities

### 4.1 Main data entities

| Entity | Purpose and relationships |
|---|---|
| Restaurant | Tenant identity, publication/status, business profile, PKR settings, hours, fulfilment and reservation policy |
| User | Verified owner membership or platform administrator role |
| Session | Hashed opaque access token, expiry and revocation state |
| Verification | Hashed email-verification token with expiry and one-time use |
| Plan | Active/inactive plan and menu-item capacity; not a billing record |
| Category / MenuItem | Tenant-scoped menu, variants/modifiers, publication, availability and photographs |
| Order | Contact/fulfilment data, immutable item/price snapshots, totals, status, payment state and history |
| DiningTable / Reservation | Table capacity, allocated reservation window, guest details and reservation status |
| Audit event | Actor, tenant context, action, recorded reason and non-secret action details |
| Outbox | Notification recipient, subject/body, delivery status and retry metadata |

Order variants/modifiers and history are represented in structured snapshots. Editing a menu does not rewrite previous order lines. Tracking tokens and the stored idempotent creation response are confidential even though guest tracking is a public endpoint.

### 4.2 API groups

All business endpoints are under `/api/v1`. Money is returned as decimal strings, such as `"900.00"`, alongside currency `"PKR"` where appropriate. Timestamps are stored in UTC; business dates and displays use Asia/Karachi.

| Group | Representative endpoints | Responsibility |
|---|---|---|
| Authentication | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | Issue, inspect and revoke sessions |
| Onboarding | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification` | Tenant registration and real email-ownership verification |
| Public catalogue | `GET /public/restaurants`, `GET /public/restaurants/{slug}/menu` | Published active restaurants and menus |
| Checkout | `POST /public/restaurants/{slug}/quote`, `POST /public/restaurants/{slug}/orders` | Current authoritative quote and transactional idempotent order |
| Tracking | `GET /public/orders/{private-token}` | Customer-safe status view without contact/address/internal notes |
| Reservations | `GET /public/restaurants/{slug}/availability`, `POST /public/restaurants/{slug}/reservations` | Advisory slots and authoritative table allocation |
| Owner | `/restaurant`, `/menu/categories`, `/menu/items`, `/orders`, `/reservations`, `/tables` | Own-tenant configuration and operations |
| Reports/media | `/reports/dashboard`, `/reports/sales`, `POST /media`, `/notifications` | Eligible sales, image uploads and outbox state |
| Platform | `/platform/overview`, `/platform/tenants`, `/platform/plans` | Tenant status/plan control and plan definitions |

Interactive API reference is available at `/docs`; readiness is available at `/health`. Protected calls require the server-issued bearer token. Order creation additionally requires an `Idempotency-Key` header. Never put actual tokens or passwords in shared API examples.

## 5. Cash ordering and order-processing flow

### 5.1 Guest checkout

1. Open a published restaurant and browse its available menu.
2. Customise a dish using its valid variants and optional extras; select quantity and optional preparation notes.
3. Review the bag and choose pickup or delivery. The browser sends item identifiers, not authoritative prices.
4. The API validates the current menu and calculates subtotal, delivery charge, configured tax and final PKR total.
5. Enter guest contact details; delivery additionally requires an address. Accept the terms/privacy consent and explicitly confirm the current total.
6. Submit the cash order. The API checks the signed quote again and saves the order transactionally.
7. The guest receives a private tracking page. Order placement does not mark the cash as paid.

If price, availability or the quote changes, the application refreshes the quote and requires explicit confirmation again. An uncertain network result retains the original request body and idempotency key. Retrying recovers the original committed order instead of intentionally generating a new order. HTTP 408/429 and network failures do not discard this recovery attempt.

### 5.2 Owner processing

| Step | Pickup order | Delivery order |
|---|---|---|
| Received | PENDING | PENDING |
| Accepted | CONFIRMED | CONFIRMED |
| Preparing | PREPARING | PREPARING |
| Prepared | READY | READY |
| Dispatch | Not applicable | OUT_FOR_DELIVERY |
| Cash receipt | Owner explicitly confirms physical receipt | Owner explicitly records cash receipt |
| Finished | COMPLETED only after cash is paid | COMPLETED only after dispatch and cash is paid |

Recording cash requires a separate explicit confirmation. The UI does not claim that a bank/provider collected money. Rejection and cancellation require at least three trimmed characters of reason. Paid orders cannot be rejected or cancelled because the application does not implement a real cash-refund workflow.

Order history and applicable audit records preserve valid status changes. Public tracking excludes customer contact details, delivery addresses, internal notes and staff reasons. Customers must keep their private tracking link confidential; it is not a GPS/rider-location service.

[[PAGEBREAK]]

## 6. Reservation and restaurant-management flow

### 6.1 Reservation requests

1. Choose a restaurant-local date and party size.
2. Request current available start times. Availability respects the booking window, opening hours, duration, table capacity and buffer.
3. Select a slot, provide guest details and consent, then submit.
4. The API locks the restaurant context, rechecks overlapping capacity and allocates a suitable active table.
5. The initial result is REQUESTED, not an automatically confirmed table.
6. The owner reviews the queue and confirms, declines or cancels according to valid transitions.
7. Confirmed guests may be marked SEATED and then COMPLETED. Confirmed no-shows may be marked NO_SHOW.

REQUESTED, CONFIRMED and SEATED reservations hold capacity. Availability is advisory because another request may be committed before the guest submits. PostgreSQL transactional locking is the conflict-control mechanism; a browser-only slot display is not a booking guarantee.

Declining or cancelling requires a reason. The guest flow shows a reference and restaurant contact information, not a fabricated confirmation email. The basic model allocates one suitable table; combining multiple tables and multi-branch scheduling are outside this release.

### 6.2 Menu and website management

The owner can create/edit menu categories and items, control publication/availability, set base prices and variant/extra price deltas, and upload photographs. Existing option identifiers are preserved when editing prices so current selections do not silently become different options.

Restaurant settings control name, description, contact details, imagery, hours, delivery/pickup, delivery fee, minimum order, tax configuration and reservation rules. Publication requires valid basic setup; inactive or unpublished businesses are not discoverable and cannot accept new orders or reservations.

Uploaded images accept JPEG/PNG/WebP input within the configured 4 MB and 20-megapixel limits. The backend verifies the decoded content, strips metadata by JPEG re-encoding, resizes to a maximum dimension of 2400 pixels and stores the result under a generated tenant-scoped name. The owner form accepts the returned absolute HTTPS Blob URL unchanged.

### 6.3 Platform administration

The platform administrator can view aggregate counts, inspect tenant configuration, activate/suspend tenants, assign existing plans and maintain active/inactive menu-capacity plans. Status/plan changes require a recorded reason and are audited. Plan assignment does not create an invoice or charge a subscription.

## 7. Pakistani currency, pricing and reporting

The supported market in this release is Pakistan. All displayed prices and monetary reports use **PKR**, the ISO code for the Pakistani rupee. The backend's currency remains PKR; the interface is not a foreign-currency conversion system.

An illustrative menu calculation is PKR 650.00 base price + PKR 200.00 large variant + PKR 50.00 extra = PKR 900.00 before any configured delivery/tax. This is a calculation example, not a claim about actual revenue. The live server quote is authoritative.

| Rule | Implemented behaviour |
|---|---|
| Precision | Server-side Decimal arithmetic, two-decimal response strings and explicit PKR presentation |
| Delivery | Applied only according to the restaurant's configured fulfilment policy |
| Tax | Configurable inclusive/exclusive percentage; no statutory Pakistan tax-rate claim |
| Quote validity | Exact selections/current prices bound into a signed, expiring quote |
| Gross sales | Totals including tax and delivery, for completed and cash-paid orders only |
| Net sales | Gross sales less tax; still includes delivery fees |
| Average order value | Eligible gross sales divided by eligible completed cash-paid order count |
| Top items | Pre-tax item-snapshot revenue; included tax allocated using stored checkout totals and cent-consistent rounding |
| Reporting period | Order-created date within inclusive restaurant-local dates |

Historical reports use stored order amounts, not the restaurant's current tax settings. Pending orders and unpaid orders are not presented as collected sales. All demonstration sales visible in screenshots result from fictional walkthrough orders, not real commercial transactions.

[[PAGEBREAK]]

## 8. Authentication, tenant isolation and operational safeguards

### 8.1 Account and session controls

Passwords are hashed with Argon2id. Access sessions use random opaque tokens; hashes, expiry and revocation state are stored in the database. The frontend keeps the current token in tab session storage. Logout revokes the server session, not only the UI state.

New registrations create an unverified owner account and a tenant that is not publicly published. Email verification is required before login. Seeded fictional demonstration accounts are explicitly pre-verified exceptions. The SMTP provider is not configured in the demonstration, so the interface must report that delivery is not configured rather than claim that an email was sent.

Public registration never grants platform administration. Simplifying existing demonstration credentials does not weaken the application's general password-length validation. Account-recovery/MFA and stronger production authentication operations remain pre-production work, not completed features.

### 8.2 Data access and business safeguards

| Safeguard | Implementation boundary |
|---|---|
| Tenant context | Derived from authenticated membership or resolved public restaurant slug |
| Wrong role / wrong tenant | Server rejects access, even if a browser route or identifier is manually changed |
| Order pricing | Server-calculated values; client cannot set a paid flag or authoritative price |
| Retry safety | Tenant/key uniqueness, payload binding and original creation-response replay |
| Reservation conflicts | Tenant row lock and transactional suitable-table overlap/capacity checks |
| Cash/state integrity | Explicit receipt, terminal-state restrictions and fulfilment-aware completion |
| Image safety | Size/decode validation, generated names and JPEG re-encoding; no production disk fallback |
| Data minimisation | Public tracking omits customer contacts, addresses, internal notes and staff reasons |
| Secrets | Server-only environment configuration; no database/storage/mail secrets in public frontend variables |

Existing-order replay recovers a known committed creation result even when new checkout is throttled or the restaurant is no longer public. It does not create a new order for a suspended/unpublished restaurant.

The current request limiter is process-local, not a distributed edge defence. Production rate limiting, secure deployment-specific headers/policies, monitoring, recovery procedures and load/capacity testing must be reviewed before handling real customers.

## 9. Local setup, deployment and configuration

### 9.1 Windows development setup

Prerequisites: Node.js 22.12 or later, Python 3.12-3.14, Git and a PostgreSQL database. The following commands run from the project root.

```powershell
npm.cmd ci --prefix frontend
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Copy `.env.example` to the ignored root `.env` and provide real private values. Apply schema migrations explicitly:

```powershell
backend\.venv\Scripts\python -m alembic -c backend\alembic.ini upgrade head
```

For a fictional demonstration database only, optional seed data can be created with:

```powershell
$env:PYTHONPATH = 'backend'
backend\.venv\Scripts\python -m app.seed
```

Fresh seeding generates random passwords in the ignored `.demo-credentials.json`; it does not embed the existing hosted demonstration's simplified passwords in source.

Start the API in one terminal:

```powershell
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8086 --no-access-log
```

Start the frontend in a second terminal:

```powershell
npm.cmd run dev --prefix frontend
```

Open `http://127.0.0.1:3000`. Port 8086 is intentional; an unrelated service may already own 8085. Do not stop another application to reclaim that port. If changing the API port, set server-side `API_ORIGIN` for Next.js accordingly.

### 9.2 Configuration reference

| Variable | Purpose |
|---|---|
| DATABASE_URL | Private PostgreSQL SQLAlchemy/psycopg connection; verify-full TLS is used by this deployment |
| SECRET_KEY | Stable cryptographically random server secret; at least 32 bytes, never a demo password |
| ENVIRONMENT | Development or production mode |
| PUBLIC_ORIGIN | Frontend origin; production must use HTTPS |
| API_ORIGIN | Server-only frontend-to-backend URL; service binding on Vercel, local port 8086 in development |
| BLOB_READ_WRITE_TOKEN | Private token for this project's dedicated public restaurant-image store |
| SMTP_HOST / SMTP_PORT / SMTP_FROM | Approved mail server and sender |
| SMTP_USERNAME / SMTP_PASSWORD / SMTP_STARTTLS | Private SMTP authentication and TLS configuration |
| TEST_DATABASE_URL | Explicitly selected PostgreSQL target for disposable test schemas; never casually point at real business data |

Do not use `NEXT_PUBLIC_` prefixes for private values. Do not include `.env`, `.vercel`, credential JSON, database backups or private tracking links in source commits or documents.

### 9.3 Hosted deployment

`vercel.json` declares the Next.js frontend and FastAPI backend as separate services in one project. The Python entrypoint is `app.main:app` relative to `backend`. The frontend receives `API_ORIGIN` from its backend service binding.

Configure cloud environment variables, apply compatible migrations and deploy the reviewed version. Do not run destructive migrations or demo reseeding during module import or serverless cold starts. Database schema changes must consider older deployments still sharing the same database.

Public restaurant images are durable Blob objects. Local filesystem media is a development option only; production without durable image storage fails explicitly. Move development, preview and production to independent databases before onboarding real customers.

[[PAGEBREAK]]

## 10. Operations, known limitations and handover

### 10.1 Notifications and readiness

The readiness endpoint checks database connectivity and reports configured email/media/payment modes. An SMTP-configured indicator is configuration state, not evidence that a specific message reached an inbox.

The outbox stores pending messages transactionally. A separately operated worker delivers through a real SMTP provider, retries with backoff and records sent/failed states. Successful delivery redacts the stored body. Delivery is at-least-once; a worker crash after provider acceptance can cause a duplicate.

```powershell
$env:PYTHONPATH = 'backend'
backend\.venv\Scripts\python -m app.worker
```

The worker requires approved SMTP settings. A Vercel HTTP deployment does not by itself run this continuous worker. Verification/customer email is not operational until a real sender and worker have been configured and exercised.

### 10.2 Development checks

```powershell
npm.cmd ci
npm.cmd run test:frontend
npm.cmd run build
backend\.venv\Scripts\python -m pytest backend\tests -q
npm.cmd run test:e2e
```

Real-service browser workflows require running API/frontend services, fictional seed accounts and Google Chrome. They create demonstration orders/reservations and must not target a real restaurant database. Screenshots in this guide are separate presentation captures of working flows.

Without `TEST_DATABASE_URL`, limited business/API tests use SQLite and do not establish PostgreSQL locking semantics. With the explicit PostgreSQL test setting, fixtures create/drop uniquely named disposable schemas rather than resetting the seeded public dataset. Dedicated PostgreSQL tests exercise concurrent reservation and idempotent-order serialization.

### 10.3 Before real customer onboarding

| Area | Required follow-through |
|---|---|
| Branding/legal | Confirm brand/domain/trademark availability and approved terms/privacy/retention policies |
| Restaurant operations | Confirm real contact details, delivery areas, fulfilment promises, hours, table policies and menu accuracy |
| Finance | Confirm tax/invoice requirements; select approved payment/billing providers if later enabled |
| Accounts | Replace demo credentials, approve real accounts, configure mail and review recovery/MFA requirements |
| Infrastructure | Separate environments, review quotas/regions/cold-start latency and provision a supervised mail worker |
| Reliability | Define monitoring, alerting, backup retention, restore tests and incident responsibilities |
| Controls | Distributed rate limiting, secret rotation, access reviews and deployment/load-specific hardening |

**Handover contents:** application source, API contract, dependency manifests, migration, seed utility, automated checks, editable guide, Word document and local screenshot assets. Passwords and infrastructure secrets remain separate private operational material.

The following landscape appendix records the application screens and primary user journeys. All customer names/contact details used for the illustrated workflows are fictional. Browser address bars and private tracking tokens are not included.

[[LANDSCAPE]]

## 11. Illustrated application flows

### 11.1 Discover the platform

The public homepage introduces the platform and published demonstration restaurants using the same ZAYQORA identity as the workspaces.

![Public platform homepage - premium redesign](technical-guide-assets\01-platform-home.jpg)

[[PAGEBREAK]]

### 11.2 Open the restaurant

Select Saffron Table to view its own business information, imagery, menu and reservation entry points. This is a fictional restaurant.

![Saffron Table restaurant storefront](technical-guide-assets\02-restaurant-home.jpg)

[[PAGEBREAK]]

### 11.3 Browse the menu in Pakistani rupees

Browse categories, availability and current base prices. All monetary values are presented as PKR, not foreign currency.

![Restaurant digital menu with explicit PKR prices](technical-guide-assets\03-menu.jpg)

[[PAGEBREAK]]

### 11.4 Customise a dish

Choose a supported variant, optional extras, quantity and preparation note. Final monetary calculations remain server-authoritative.

![Actual menu customisation dialog](technical-guide-assets\04-customisation.jpg)

[[PAGEBREAK]]

### 11.5 Review the bag and current quote

Check selected items and fulfilment before continuing. Subtotal, delivery and tax come from the API.

![Bag and server-calculated PKR quote](technical-guide-assets\05-cart.jpg)

[[PAGEBREAK]]

### 11.6 Confirm a cash checkout

Supply fictional guest details for the demonstration, consent to the terms/privacy notice and explicitly confirm the current total. No card payment is requested.

![Checkout with guest details and explicit cash-total confirmation](technical-guide-assets\06-checkout.jpg)

[[PAGEBREAK]]

### 11.7 Receive the order reference

Successful submission opens private tracking. The initial order is pending and cash is unpaid; this is not a payment receipt.

![Newly created cash order on its tracking screen](technical-guide-assets\07-order-received.jpg)

[[PAGEBREAK]]

### 11.8 Use the shared sign-in screen

Owners and platform administrators use the same branded screen. Credentials are distributed separately; no password is visible in this guide.

![Shared owner and platform administrator sign-in](technical-guide-assets\08-sign-in.jpg)

[[PAGEBREAK]]

### 11.9 Review the owner dashboard

The owner sees restaurant-scoped operational data and eligible sales. Demonstration metrics reflect walkthrough records, not real commercial revenue.

![Owner dashboard and operational overview](technical-guide-assets\09-owner-dashboard.jpg)

[[PAGEBREAK]]

### 11.10 Process the incoming order

Open the order, verify its details and progress through the permitted preparation states. Tracking reflects the saved transitions.

![Owner order details and preparation workflow](technical-guide-assets\10-order-processing.jpg)

[[PAGEBREAK]]

### 11.11 Explicitly record cash receipt

The owner confirms physical receipt of the specified amount. Completion is not allowed while the order remains unpaid.

![Explicit owner cash-receipt confirmation](technical-guide-assets\11-cash-receipt.jpg)

[[PAGEBREAK]]

### 11.12 Complete the order and inspect tracking

After valid processing and recorded cash receipt, the pickup order can be completed. The guest sees status/history without staff-only contact data.

![Completed and cash-paid order tracking](technical-guide-assets\12-order-completed.jpg)

[[PAGEBREAK]]

### 11.13 Inspect the sales report

Reports use completed cash-paid orders and expose their metric definitions. All monetary results use PKR.

![Owner sales report and metric definitions](technical-guide-assets\13-reports.jpg)

[[PAGEBREAK]]

### 11.14 Choose an available reservation slot

Select date, guest count and an advisory start time in Asia/Karachi. The server rechecks allocation when the request is submitted.

![Public reservation availability and guest form](technical-guide-assets\14-reservation-form.jpg)

[[PAGEBREAK]]

### 11.15 Receive a reservation request reference

REQUESTED means the owner still needs to decide. The UI does not invent an email confirmation or imply a real booking at this fictional restaurant.

![Reservation request received, awaiting owner decision](technical-guide-assets\15-reservation-received.jpg)

[[PAGEBREAK]]

### 11.16 Review the reservation as owner

The owner can select only permitted next states. Decline/cancel requires a reason; the illustrated walkthrough releases its test capacity when finished.

![Owner reservation review and status selection](technical-guide-assets\16-owner-reservation.jpg)

[[PAGEBREAK]]

### 11.17 Manage dining-table capacity

Table capacity and activity affect reservation allocation. The API prevents unsafe capacity reductions where active future bookings exist.

![Owner dining-table management](technical-guide-assets\17-dining-tables.jpg)

[[PAGEBREAK]]

### 11.18 Maintain the restaurant menu

The owner manages categories/items, prices, variants, extras, publication and food images. Uploaded HTTPS image URLs are retained when saving.

![Owner menu-management screen](technical-guide-assets\18-menu-management.jpg)

[[PAGEBREAK]]

### 11.19 Configure the restaurant

Business profile, images, hours, fulfilment, PKR fees/tax and reservation settings are maintained in the owner workspace.

![Owner restaurant settings](technical-guide-assets\19-settings.jpg)

[[PAGEBREAK]]

### 11.20 Inspect notification delivery state

The outbox shows actual queue states. Pending is not sent; SMTP delivery requires the separately configured provider and worker.

![Owner notification outbox with real delivery states](technical-guide-assets\20-notifications.jpg)

[[PAGEBREAK]]

### 11.21 Enter platform administration

The administrator uses the same product branding while reviewing platform-wide aggregate information.

![Platform administrator overview](technical-guide-assets\21-platform-overview.jpg)

[[PAGEBREAK]]

### 11.22 Manage restaurant tenants

Tenant status and plan assignment are administrative actions with recorded reasons, not a way to bypass owner order permissions.

![Platform tenant administration](technical-guide-assets\22-platform-tenants.jpg)

[[PAGEBREAK]]

### 11.23 Maintain capacity plans

Plans configure menu capacity and activity. This screen does not implement subscription collection or payment billing.

![Platform plan administration](technical-guide-assets\23-platform-plans.jpg)

[[PAGEBREAK]]

### 11.24 Review the mobile experience

The same ZAYQORA identity, readable PKR amounts and role-specific workflows are retained on mobile. These are actual mobile-viewport captures.

![Mobile public menu and owner workspace](technical-guide-assets\24-mobile-experience.jpg)
