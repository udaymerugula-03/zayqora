# ZAYQORA
## Complete Release 1 Functional and Technical Guide

**Version 2 | 17 November 2026**

**Status: Release 1 implementation / operational launch sign-off pending**

**Prepared for:** Restaurant business owners, platform operations, client acceptance reviewers and technical maintainers.

**Market:** Pakistan | **Currency:** PKR | **Business timezone:** Asia/Karachi

One restaurant platform: public restaurant websites, cash ordering, reservations, owner operations and platform administration.

This handover describes the implemented Release 1 scope and the remaining conditions for real customer use. It is not approval to launch, a guarantee of production readiness, a legal opinion or completion of the full three-release blueprint.

**Application address**

https://zayqora-restaurants.vercel.app

**Shared owner and platform administrator sign-in**

https://zayqora-restaurants.vercel.app/login

**Evidence disclosure:** The 39 interface images in this edition were captured on 17 November 2026 in a controlled, isolated contract-fixture environment. Restaurant identities, accounts, orders, bookings and amounts shown are synthetic. They are not public live restaurants, fulfilled food transactions, collected commercial revenue or proof of email delivery. Address bars and private tracking links are excluded. The public application intentionally has no restaurant listings until approved real restaurants are configured and published.

Existing fictional restaurant records are preserved privately for authorised workspace access. This guide contains no account passwords, fictional account email addresses, infrastructure secrets or usable private tracking URLs. Earlier Word and Markdown deliverables remain historical snapshots; their former public restaurant examples and status statements must not be used as current operating instructions.

[[PAGEBREAK]]

## Contents

1. Delivery scope, identity and public visibility
2. Roles and screen responsibilities
3. Owner onboarding and website publication
4. Menu, cart and cash-order journey
5. Order operations, cash receipt and kitchen
6. Reservations, tables and customer enquiries
7. Dashboard, reports, settings and notifications
8. Architecture, technology and data model
9. API contract and implementation map
10. Windows installation, configuration and testing
11. Deployment and operational runbook
12. Requirements traceability and release boundaries
13. Launch acceptance and handover checklist
14. Illustrated screen reference

## 1. Delivery scope, identity and public visibility

Release 1 connects a configurable restaurant website to a tenant-aware owner workspace. A guest can browse an eligible restaurant, customise food, confirm a server-calculated cash order, follow private order status, request a reservation or send an enquiry. Owners manage their own business; platform administrators manage tenants and menu-capacity plans.

The homepage is owner-first: **“Your food. Your website.”**, with one **Create Your Restaurant Website** hero action. **Browse Restaurants**, **Restaurant plans** and **Owner & admin sign in** have separate navigation responsibilities. The optional directory is not a mandated marketplace. Customer ordering and booking belong on the individual restaurant website.

### 1.1 One product, appropriate layouts

ZAYQORA is the shared product identity. VIRELEO identifies the platform operator in the specification, not a second customer-facing product. Navy provides structure, teal identifies primary actions and gold is a restrained accent. Restaurant names, logos and approved imagery identify each tenant.

Section 6.3 permits restaurant-level customisation: one responsive template with controlled navy, emerald or terracotta palettes, editorial or sans typography, configurable content and section order. This does not require every tenant to use an identical colour treatment. Section 10.1 separately requires task-appropriate layouts: warm, photographic storefronts and information-dense operational workspaces remain visually related without becoming the same screen.

### 1.2 Private fictional records

Public eligibility requires an active, published restaurant with the read-only `is_demo` marker false. Fictional records are excluded from listing results/counts, direct restaurant/menu URLs, quotes, checkout, availability, bookings, enquiries and public order tracking. Their old checkout responses are not publicly replayed. A stored historical publication flag does not override the exclusion.

Authorised owners can continue private editing and authenticated responsive preview; platform administrators retain their permitted tenant-management access. Owners cannot clear the marker, publish these records or bypass the gate with a URL or request payload. Use a separate real business account with approved details, not a relabelled fictional restaurant. Public image assets are not confidential simply because a restaurant record is private.

## 2. Roles and screen responsibilities

| Capability | Guest | Restaurant owner | Platform administrator |
|---|---|---|---|
| Browse an eligible public restaurant | Yes | Public flow | Public flow |
| Place cash order / request table / send enquiry | Contact details and consent | Public flow | Public flow |
| View private tracking | Possession of confidential link | Link if known | No general tenant-order access |
| Configure website, menu and service rules | No | Own tenant | Not through owner APIs |
| Process orders, record cash, manage bookings/inbox | No | Own tenant | Not through owner APIs |
| View restaurant reports and outbox | No | Own tenant | Not through owner APIs |
| Manage tenant status, plan assignment and plans | No | No | Yes; reasons/audit where required |

![Roles and connected screens; the kitchen board is owner-operated](technical-guide-assets\00-role-screen-map.jpg)

| Navigation group | Screen routes and purpose |
|---|---|
| Platform and account | `/`, `/pricing`, `/register`, `/verify-email`, `/login`, `/privacy`, `/terms` |
| Restaurant website | `/r/[slug]` plus `/menu`, `/about`, `/contact`, conditional `/gallery` and `/faqs`, `/policies` |
| Customer transactions | Restaurant `/cart`, `/checkout`, `/reservations`; `/track/[private-token]` |
| Owner workspace | `/app/dashboard`, `/app/setup`, `/app/website`, `/app/orders`, `/app/kitchen`, `/app/menu` |
| Owner service and administration | `/app/reservations` including tables, `/app/inquiries`, `/app/reports`, `/app/settings`, `/app/notifications` |
| Platform administration | `/platform/overview`, `/platform/tenants`, `/platform/plans` |

All authenticated roles use **“Sign in to ZAYQORA.”** Successful sign-in routes the user to the correct workspace. A hidden button or client route is not an authorisation control: the API derives membership from the session and checks tenant ownership. Public registration never grants platform administration. There are no separate staff, waiter, rider or customer-account roles in this release.

## 3. Owner onboarding and website publication

### 3.1 Register, verify and sign in

1. From the platform homepage select **Create Your Restaurant Website**. Review Restaurant plans if needed; a plan controls menu capacity, not an online subscription charge.
2. Register with owner name, email, password, restaurant name and a valid unique slug. The API creates an unverified owner and an unpublished restaurant workspace.
3. Read the registration delivery status. Without configured SMTP, the result is pending verification with `provider_not_configured`, not “email delivered”.
4. Once an approved sender and independent worker are operational, use the verification link delivered to the owner's inbox. Verification tokens are one-time, hashed in the verification table and expire after 24 hours.
5. If required, request another link through sign-in/verification recovery. Resending invalidates earlier links and does not expose a token or confirm whether an account exists.
6. Sign in after verification. An invalid, expired or unverified account must not be treated as a successful login. Logout revokes the server session.

The existing private development accounts are pre-verified exceptions, not evidence that a new real owner can currently receive email. Password reset and MFA are not implemented capabilities; agree an approved account-recovery and access-control procedure before commercial onboarding.

### 3.2 Complete the setup guide

The Setup page derives eight checks from saved data: email verification; restaurant details; logo/cover; weekly opening hours; an available published menu; service/table configuration; website/SEO review; publication. These are not manually ticked completion claims. Some branding/content checks are recommendations; the API independently enforces its publication rules.

1. In Settings enter accurate name, cuisine, city, address, phone, email and description. Upload rights-cleared logo and cover imagery.
2. Set every weekday to valid opening/closing times or closed. Review pickup/delivery, fee, minimum order, tax treatment and reservation duration/buffer/window.
3. Create and publish menu content. If accepting reservations, create suitable active tables.
4. In Website configure the story, palette, typography, SEO title/description, optional content and cancellation policy. Review desktop, tablet and mobile content previews.
5. Save, resolve validation errors and explicitly publish from Setup or the available publication control. Saving a draft does not publish it.
6. Check the real public URL and enabled services. Unpublish when necessary; new guest activity stops. Existing genuine-order tracking and matching committed checkout retries remain recoverable after unpublication. Fictional records remain publicly excluded in all cases.

### 3.3 Website builder, preview and content pages

Website settings are a validated **full replacement**, with defaults, not a shallow JSON merge. The UI submits the complete settings object. The introduction remains first; supported homepage sections are featured menu, about, gallery and hours. Owners can show/hide and reorder these supported sections.

Gallery and FAQ navigation require both enablement and nonempty content. Up to 30 gallery images require meaningful alternative text; up to 30 FAQs use bounded question/answer fields. Disabling reservations hides its entry points and blocks new public availability/submission while preserving existing bookings and owner actions.

Preview uses authorised restaurant/menu data and can show unsaved homepage settings before publication. It is a content preview, not a second public website or executable checkout/booking session. Private workspaces show a private-development notice.

About, Contact, Gallery, FAQs and Policies present configured business information. The contact form creates a consented inbox enquiry; it does not automatically book a table. Restaurant cancellation text supplements rather than replaces platform privacy/terms. Empty policy text must not be represented as an approved legal policy. Custom domains, an expanded template catalogue and advanced social-share controls are not claimed as completed Release 1 functionality.

## 4. Menu, cart and cash-order journey

### 4.1 Manage categories and food items

1. Open Menu. Create a category with name, position and publication state; category publication controls its public contents.
2. Create/edit an item with category, name, description, photograph, PKR base price, featured state, publication and availability.
3. Add variants with price deltas; mark variant selection required where appropriate. Add optional extras/modifiers with their price deltas. Existing option identifiers are retained when editing rather than silently changing the meaning of current selections.
4. Save and review the public menu or authenticated preview. Plan limits are enforced by the API, not bypassed by a browser edit.
5. Mark an item unavailable when sold out. This differs from unpublishing it: an unavailable published item may remain visible but cannot be quoted/ordered. Unpublishing its category removes its public category context. Earlier order snapshots remain unchanged.

Uploads accept JPEG/PNG/WebP input within 4 MB and 20 megapixels. The API verifies decoded content, strips metadata by JPEG re-encoding, resizes to at most 2400 pixels and creates a tenant-scoped object name. Dedicated durable Blob storage is required for hosted operation; there is no production fallback to an ephemeral filesystem.

### 4.2 Customer journey and authoritative pricing

1. Open an eligible restaurant; browse categories, published items, prices and availability.
2. Open customisation, choose a valid variant/extras, quantity and optional preparation notes, then add to the bag.
3. Review quantities and selections in Cart. Select an enabled pickup/delivery service.
4. Request the current quote. The API checks opening hours, tenant/service state, current item/category publication, availability, valid options, minimum order and price rules.
5. Checkout requires customer name/phone, optional email, delivery address when applicable, consent and explicit confirmation of the displayed current total.
6. Submit a cash order. The API revalidates the signed quote and saves one transactional order. Preserve the private tracking link shown after success.

Money uses server-side Decimal arithmetic and two-decimal PKR strings. For example, PKR 650.00 base + PKR 200.00 variant + PKR 50.00 extra is PKR 900.00 before applicable delivery/tax. This is arithmetic, not commercial revenue. Inclusive/exclusive tax follows the restaurant's configured rule; the software does not certify a statutory rate.

### 4.3 Reconfirmation and uncertain network outcomes

A quote binds exact selections, fulfilment, prices and totals and expires after the configured period (default ten minutes). A changed price, unavailable item, service change or expired quote requires a refreshed quote and explicit total confirmation again. Client-supplied prices and paid flags are not authoritative.

Order creation requires an `Idempotency-Key`. The browser retains the original payload/key after an uncertain network result; a matching retry recovers the original committed response rather than intentionally creating another order. Network failures and HTTP 408/429 do not justify inventing a new attempt. Reusing the key with a different payload is rejected. Restaurant/key uniqueness, payload binding and PostgreSQL transactional locking enforce this beyond disabling a submit button.

Cash ordering does not request card information, charge a provider, mark cash received or confirm food fulfilment. Online payment providers and subscription billing remain disabled/out of scope.

## 5. Order operations, cash receipt and kitchen

![Server-authoritative cash ordering, explicit receipt and completion](technical-guide-assets\00-cash-order-flow.jpg)

### 5.1 Process an incoming order

Open Orders; filter by status, reference/customer search, fulfilment, payment state and inclusive Karachi dates. Active-only filtering excludes completed, rejected and cancelled orders. Open detail to review line snapshots, options, preparation notes, delivery/contact details, totals and recorded status history.

| Current state | Permitted next states | Important restriction |
|---|---|---|
| PENDING | CONFIRMED, REJECTED, CANCELLED | Reject/cancel requires a reason |
| CONFIRMED | PREPARING, CANCELLED | Paid cancellation prohibited |
| PREPARING | READY, CANCELLED | Paid cancellation prohibited |
| READY | COMPLETED for pickup; OUT_FOR_DELIVERY for delivery | Completion requires cash paid |
| OUT_FOR_DELIVERY | COMPLETED | Delivery only; cash must be paid |
| COMPLETED / REJECTED / CANCELLED | None | Terminal states cannot be reopened |

The owner confirms physical collection separately using **cash received** confirmation. Order placement and status advancement do not collect money. Repeat cash recording is safe and does not queue duplicate receipt notices. Reject/cancel reasons require at least three trimmed characters; failed validation must not change history or status. Paid orders cannot be rejected/cancelled because real cash refunds are not implemented.

### 5.2 Kitchen and customer tracking

Kitchen presents active orders for the owner and opens the same authorised order workflow. It is a basic operational board, not Release 2 staff KDS, station routing, printer integration or a POS cash session.

Private tracking shows the guest-safe status/timestamps and order information. It excludes customer contacts, address, internal notes, line preparation notes and staff reasons. Keep the link confidential: possession authorises viewing; it is not a customer account, public search result, proof of payment, GPS rider location or delivery-time guarantee.

## 6. Reservations, tables and customer enquiries

### 6.1 Request and allocate a reservation

1. On the restaurant reservation page select a restaurant-local date and party size. Request availability within configured booking days, hours, duration and buffer.
2. Select a start time; provide customer name, phone, optional email/notes and consent. The slot list is advisory, not a held booking.
3. Submit. The API locks the restaurant context, rechecks overlapping reservations and allocates one suitable active table transactionally.
4. The acknowledgement is **REQUESTED**, not automatically confirmed. Keep the reference and contact the restaurant if needed.
5. The owner reviews Reservations, confirms or declines, then seats/completes a confirmed visit or records a valid cancellation/no-show.

| Current state | Permitted next states | Capacity effect |
|---|---|---|
| REQUESTED | CONFIRMED, DECLINED, CANCELLED | Holds capacity |
| CONFIRMED | SEATED, CANCELLED, NO_SHOW | Holds capacity |
| SEATED | COMPLETED | Holds capacity until completed |
| COMPLETED / DECLINED / CANCELLED / NO_SHOW | None | No active hold |

Decline/cancellation requires a nonblank reason of at least three trimmed characters. Under simultaneous requests for the last table, PostgreSQL row locking makes the committed capacity decision authoritative; a stale availability display cannot override it. The model allocates one table, not a combination of tables or multi-branch floor plan. Unconfirmed requests hold capacity until a valid owner decision; operators must review them promptly rather than assuming an automatic expiry process.

### 6.2 Manage dining tables

Use the table section within Reservations to create/edit the name, capacity and active state. Active tables provide reservable capacity. The API rejects deactivation or capacity reduction where active future reservations hold the table; resolve affected bookings through valid owner decisions first. Check duration/buffer and future booking horizon in Settings. Disabling online reservations blocks new public requests without erasing existing allocations or owner status actions.

### 6.3 Contact and enquiry handling

The Contact screen presents approved restaurant contact details and a form requiring name, email, single-line subject, message and consent. A successful response means a persisted enquiry with a reference, not a reservation, order acceptance or delivered email.

The owner's Inquiries page is a paginated, tenant-scoped inbox. Read the private message/contact, mark **new**, **read** or **resolved**, and handle follow-up using approved business channels. State changes are audited; this is not CRM automation or a public thread exposing other customers. The system can queue an owner notice when restaurant email is configured. A queued/provider-not-configured status must remain distinct from delivery.

## 7. Dashboard, reports, settings and notifications

### 7.1 Dashboard and financial definitions

Dashboard summarises today's orders, pending orders, eligible sales, upcoming reservations, recent orders and top items. Reports selects an inclusive restaurant-local date range of at most 367 days. Stored timestamps are UTC; Asia/Karachi defines business dates. Results use **order-created date**, not the time cash was collected or the order completed. Upcoming reservations counts all future requested, confirmed or seated reservations, independently of the sales date range.

| Metric | Definition and interpretation |
|---|---|
| Orders today / order count | Created orders in the applicable local period; not automatically paid sales |
| Gross sales | Stored total including tax and delivery, only COMPLETED and cash-paid orders |
| Net sales | Eligible gross less stored tax; delivery remains included; not profit |
| Average order value | Eligible gross divided by eligible completed paid order count |
| Top-item quantity/revenue | Eligible stored line snapshots; pre-tax item revenue, not current menu prices |
| Inclusive-tax item allocation | Stored checkout totals and cent-consistent tax allocation, not current tax configuration |
| Pending/upcoming counts | Operational state/window counts; not confirmed income or guaranteed attendance |

Pending, unpaid, rejected or cancelled orders are not presented as collected sales. Reports are basic restaurant operational reports, not audited accounts, profit calculation, VAT filing, settlement reconciliation, refund accounting or an export suite. Fixture screenshot totals are synthetic.

### 7.2 Settings and outbox

Settings maintains identity/contact, logo/cover, weekly hours, pickup/delivery flags, delivery fee, minimum order, inclusive/exclusive tax, reservation policy and publication. Website manages controlled presentation/content. Verify edits carefully: saving a published restaurant's content can affect customers immediately; there is no separate multi-stage editorial approval system.

Notifications displays outbox subjects/kinds/status/timestamps. Business transactions queue appropriate verification, order, reservation and enquiry notices. Customer notices require a supplied customer email; owner order/reservation notices use restaurant email independently. Valid order changes and the first cash receipt queue notices atomically; failed/invalid transitions do not.

The outbox is durable, but a queued record is not proof of sending. An **independent SMTP worker** must run continuously with an approved sender. Missing SMTP is reported honestly. Delivery retries with backoff and eventually marks failure after ten attempts. Delivery is at-least-once: a crash after provider acceptance may cause a duplicate despite stable Message-ID. Successful delivery redacts the stored message body. Provider acceptance still does not prove recipient inbox placement.

### 7.3 Platform administration

Overview shows aggregate tenant/status/publication/order counts, not arbitrary tenant customer records. Tenants supports search, activation/suspension and plan assignment. Status and plan changes require reasons and create audit records. Suspension blocks new public business activity and protected mutations according to API rules.

Plans supports creation/editing of name, description, menu-item capacity and active state. Assignment is configuration, not subscription billing, a provider charge or a commercial price commitment. There is no general audit-browser screen or unrestricted customer-data impersonation tool: authorised operators inspect persisted audit records through controlled administrative procedures.

## 8. Architecture, technology and data model

![System architecture with independent SMTP delivery dependency](release1-client-guide-assets\00-system-architecture-v2.jpg)

Browser requests use same-origin HTTPS when hosted. `vercel.json` routes `/api/` to FastAPI and website routes to Next.js. Server-rendered frontend pages use the server-only `API_ORIGIN` binding. PostgreSQL is the runtime database. HTTP hosting does not run the continuous email worker.

| Layer | Technologies and responsibility |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS; shared components and responsive route layouts |
| Client state/forms | TanStack React Query, React Hook Form and Zod; validation assists but does not replace API checks |
| Typography | Locally bundled DM Sans and Cormorant Garamond; no visitor-time Google Fonts request |
| Backend | Python/FastAPI, Pydantic settings/schemas, SQLAlchemy 2, psycopg, Alembic migrations |
| Identity | Argon2id passwords; random opaque, hashed, expiring and revocable server sessions |
| Persistence/media/mail | PostgreSQL, Pillow-validated public Vercel Blob images, transactional outbox and SMTP worker |
| Verification tooling | Existing Node tests, pytest and Playwright; dependency manifests/lockfiles are authoritative |

### 8.1 Data relationships and safeguards

Restaurant is the tenant root: profile, status/publication, hours, service/tax rules, website-settings JSON, read-only fictional-data flag and optional Plan foreign key. Users have owner membership or platform-admin role; Sessions and Verifications store token hashes, expiry and lifecycle state.

Categories and MenuItems belong to a restaurant; the category/item composite foreign key prevents cross-tenant association. Menu variants/modifiers are structured JSON. Orders store immutable item/price snapshots, monetary totals, contact/fulfilment, state/history, tracking hash, payload hash and idempotent creation response. The unique restaurant/idempotency-key pair prevents duplicate committed attempts. The original creation response contains a tracking credential and is confidential database content.

DiningTables and Reservations are tenant-linked with constrained table membership, times, party size and status. ContactInquiries hold consented private messages and inbox state. Audit events record actor/context/action/reason. Outbox records hold delivery state and temporarily contain sensitive verification email content. Restrict and encrypt database/backups; hashed verification storage alone does not remove outbox sensitivity.

The frontend stores the current access token in tab session storage. Tenant IDs from a browser are not trusted. Tracking strips private fields. Website content is bounded plain text, not executable HTML. These controls do not replace distributed rate limiting, XSS/deployment review, recovery/MFA decisions or external operational security sign-off.

## 9. API contract and implementation map

`contracts\api-contract.json` is the shared contract; FastAPI `/docs` exposes the interactive schema. Business routes use `/api/v1`. Money is a two-decimal string; timestamps use ISO UTC. Protected requests use the issued bearer session. Lists generally contain `items`, `total`, `page`, `page_size`; errors contain `detail`, sometimes `code`, or validation-detail arrays.

| API group | Representative operations | Authority / source |
|---|---|---|
| Authentication | POST `/auth/register`, `/login`, `/verify-email`, `/resend-verification`, `/logout`; GET `/auth/me` | `backend\app\auth.py`, `security.py` |
| Public catalogue | GET `/public/restaurants`, `/{slug}`, `/{slug}/menu`, `/public/plans` | `public.py`, `services.py`; active/public/nonfictional gate |
| Cash checkout | POST `/public/restaurants/{slug}/quote`, `/orders` with idempotency header | `public.py`, `services.py`; signed quote, lock and transaction |
| Tracking | GET `/public/orders/{private-token}` | `public.py`; guest-safe response; confidential input |
| Reservations | GET restaurant `/availability`; POST `/reservations` | `public.py`, `services.py`; table allocation under lock |
| Restaurant/content | GET/PATCH `/restaurant` | `owner.py`, `schemas.py`; read-only marker cannot be patched |
| Menu/media | `/menu/categories`, `/menu/items`; POST `/media` | `owner.py`, `media.py`; own-tenant validation and plan capacity |
| Orders/cash | GET `/orders`, `/{id}`; PATCH `/{id}/status`; POST `/{id}/cash-payment` | `owner.py`, `services.py`; valid transitions and explicit payment |
| Tables/bookings | `/tables`, `/reservations`, reservation `/{id}/status` | `owner.py`; own-tenant membership and state rules |
| Contact/inbox | Public restaurant `/inquiries`; owner GET `/inquiries`, PATCH `/{id}` | `public.py`, `owner.py`; consent and private inbox |
| Reports/outbox | `/reports/dashboard`, `/reports/sales`, `/notifications` | `owner.py`; defined metrics and delivery-state view |
| Platform | `/platform/overview`, `/tenants`, tenant status/plan; `/platform/plans` | `platform.py`; platform role, reasons and audit |

Readiness is `/health` (also available under the API health route); it checks database connectivity and configured modes. A successful response is not a backup, restore, monitoring or SMTP-delivery certificate.

### 9.1 Frontend and repository map

Routes live in `frontend\src\app`; interactive screens in `frontend\src\components`. `auth.tsx`, `setup.tsx`, `website.tsx`, `menu.tsx`, `checkout.tsx`, `tracking.tsx`, `orders.tsx`, `reservations.tsx`, `reservations-admin.tsx`, `inquiries.tsx`, `reports.tsx`, `settings.tsx` and `platform.tsx` implement their corresponding flows. `frontend\src\lib` holds API/types/commerce and website visibility helpers.

`backend\app\models.py` defines persistence; `schemas.py` validates input; `services.py` centralises pricing/state/tenant helpers; `worker.py` delivers mail; `config.py` loads settings. `backend\migrations` contains additive schema upgrades, including `0002_website_inquiries` for website settings, private fictional-data metadata and contact enquiries. `backend\tests`, `frontend\tests`, `frontend\browser` and `e2e` contain existing checks.

No example in this handover includes actual authorisation values, connection strings or tracking tokens. Do not copy private values into API screenshots, shell transcripts, tickets or document attachments.

## 10. Windows installation, configuration and testing

### 10.1 Prerequisites and first setup

Use Node.js 22.12+, Python 3.12–3.14, Git and a dedicated PostgreSQL database. Run these commands from the repository root in PowerShell. Do not reuse another application's database or terminate its processes to reclaim a port.

```powershell
npm.cmd ci --prefix frontend
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Copy the template only for a new installation; **do not overwrite an existing `.env`**. Populate it privately with approved values before starting the API. The backend resolves the root `.env` from its source location, and process environment overrides file values.

| Configuration | Required interpretation |
|---|---|
| `DATABASE_URL` | Dedicated PostgreSQL URL; server-only; verify provider TLS and trusted CA |
| `SECRET_KEY` | Stable cryptographically random secret, at least 32 bytes; no shared example secret |
| `ENVIRONMENT` / `APP_ENV` | Development or production; production enforces HTTPS origins |
| `PUBLIC_ORIGIN` | Frontend origin; aliases `PUBLIC_WEB_URL` and `CORS_ORIGINS` unless primary names supplied |
| `API_ORIGIN` | Next.js server-to-API URL; local `http://127.0.0.1:8086`; hosted service binding |
| `BLOB_READ_WRITE_TOKEN` | Private token for this project's dedicated public image store |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Approved provider/port/sender, not provisioned by this guide |
| `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_STARTTLS` | Provider authentication and TLS; never frontend variables |
| `SESSION_HOURS`, `QUOTE_MINUTES` | Defaults 24 hours and 10 minutes; review operating policy |
| `MEDIA_STORAGE` | Local development only without Blob; production requires durable storage |
| `TEST_DATABASE_URL` | Explicit isolated PostgreSQL test target; never customer production data |

Never prefix secrets with `NEXT_PUBLIC_`. Keep `.env`, provider state, private credentials, backup files and tracking links out of Git and handover media. `sslmode=verify-full` uses the maintained Certifi bundle unless an explicit trusted root is supplied; private-CA providers need their own trusted root. Do not weaken TLS to work around certificate errors.

### 10.2 Migrate and start

```powershell
backend\.venv\Scripts\python -m alembic -c backend\alembic.ini upgrade head
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8086 --no-access-log
```

In a second terminal:

```powershell
$env:API_ORIGIN = 'http://127.0.0.1:8086'
npm.cmd run dev --prefix frontend
```

Open `http://127.0.0.1:3000`; check `http://127.0.0.1:8086/health` and `/docs`. Use consistent localhost/origin settings when exercising CORS-sensitive direct calls. Port 8086 avoids an existing application's 8085. Optional fictional seed creation is for an isolated development database only; it is not needed to migrate or configure a real business. It generates private credentials and must never be run as a customer-environment startup hook.

### 10.3 SMTP worker and existing verification commands

After approved SMTP values are privately configured, start the worker in its own supervised process:

```powershell
$env:PYTHONPATH = 'backend'
backend\.venv\Scripts\python -m app.worker
```

Validate a real permitted recipient, delivery failure/retry, verification expiry/resend and service restart before approval. A Vercel HTTP deployment alone is not a worker supervisor.

Existing project checks:

```powershell
npm.cmd ci
npm.cmd run test:frontend
npm.cmd run build
backend\.venv\Scripts\python -m pytest backend\tests -q
npm.cmd run test:browser --prefix frontend
npm.cmd run test:e2e
```

Run the smallest relevant selector first. Frontend browser fixtures are isolated and do not publish fictional restaurants. Real-service E2E requires running frontend/API and Google Chrome. Public mutating flows require an explicitly configured isolated restaurant via `E2E_PUBLIC_RESTAURANT_SLUG`, `E2E_PUBLIC_OWNER_EMAIL`, `E2E_CREDENTIALS_FILE` and, where needed, `E2E_BASE_URL`; missing configuration produces explicit skips. Never point those flows at live customer operations.

```powershell
$env:TEST_DATABASE_URL = '<isolated PostgreSQL test URL>'
backend\.venv\Scripts\python -m pytest backend\tests -q -m postgres
```

PostgreSQL fixtures create/drop uniquely named test schemas; do not casually grant these rights against business data. Without that URL, SQLite HTTP/business checks do not prove row-lock semantics. A skipped concurrency test is not certification. This document does not assert a final all-suite pass count; acceptance must attach results for the reviewed build and target environment.

## 11. Deployment and operational runbook

### 11.1 Controlled deployment

1. Select the reviewed source version; preserve prior deliverables. Review the migration and configuration changes.
2. Provision independent development, staging/preview and production databases/roles. Existing shared development/hosted data is not production environment isolation.
3. Configure HTTPS, least-privilege database access, server-only secrets and dedicated durable image storage. Confirm regions, quotas and provider capacity without assuming an account/tier exists.
4. Configure an approved SMTP sender plus a separately hosted/supervised worker. Configure external monitoring and named alert recipients.
5. Arrange provider backups, retention/access controls and an independently tested restore to an isolated target. Record evidence before migrations/customer use.
6. Apply compatible Alembic upgrades explicitly, then deploy the Next.js/FastAPI services using `vercel.json` and the `API_ORIGIN` binding.
7. Exercise stage smoke/UAT scenarios, fictional-data exclusion and cross-tenant denial. Approve real restaurant/legal/tax/brand content before publication.
8. Record go/no-go and rollback responsibility. Prefer a reviewed forward fix; do not destructively downgrade a schema after new business data exists without a recovery plan.

Migrations and seeding must never run on module import, cold start or every request. Do not create real business operations merely to populate screenshots.

### 11.2 Routine operations and incident handling

| When / symptom | Operator action and evidence |
|---|---|
| Start of service | Check real public restaurant content, hours/services, API/database readiness, worker health and pending order/reservation queues |
| No verification email | Inspect configuration and outbox state; check supervised worker/provider rejection without sharing message links; resend only through supported flow |
| Repeated pending/failed mail | Investigate SMTP authentication/TLS/limits and worker restart; do not mark sent manually or promise inbox delivery |
| Uncertain checkout | Recover using the original idempotent attempt; reconcile reference before any new order; never blindly repeat cash receipt |
| Price/sold-out conflict | Update cart/availability, fetch a new quote and require customer reconfirmation |
| Reservation conflict | Refresh alternatives and review table/hold state; do not force overlapping bookings or delete records to clear capacity |
| Wrong cash status | Stop processing, preserve audit/context and escalate; no invented refund or paid-order cancellation |
| Public restaurant unavailable | Check active/public state and approved setup; fictional-data exclusion is intentional, not solved by clearing `is_demo` |
| Upload failure | Check validated input and dedicated Blob configuration/provider health; no production disk fallback |
| API/DB outage | Use named incident owner, preserve redacted logs, stop risky writes, restore service or approved backup; verify order/payment consistency |
| Security/access incident | Revoke affected sessions, protect evidence, rotate compromised secrets via controlled process and assess affected customer data |
| Routine recovery review | Review alerts, restore evidence, backup access/retention, account access, dependencies and capacity against agreed policy |

Do not log authorisation headers, customer request bodies, passwords, private tracking URLs or verification links. Public image URLs may be shared for restaurant content but are not suitable for confidential documents. Do not promise backup retention, recovery point/time or service availability until the operator approves and proves those measures.

### 11.3 Privacy, terms and operational limitations

Platform privacy/terms pages describe product behaviour; restaurant policies are tenant-provided content. Neither is legal approval. Confirm the responsible legal entity, lawful processing/consent, contact channel, retention/deletion procedure, image rights, cancellation rules and tax/invoice obligations with the client and appropriate advisers.

Current process-local throttling is not distributed/edge protection. External monitoring/alerts, tested backups/restores, isolated production resources, recovery/MFA decisions, provider mail operation, deployment-specific security and load/capacity acceptance remain outstanding sign-offs. Health/configuration flags and synthetic UI screenshots cannot close these items.

## 12. Requirements traceability and release boundaries

### 12.1 Original section 20.2: MVP acceptance mapping

The supplied `project_02(Web).docx` is the requirements authority. “Implemented” below identifies code/screen coverage, not completed live operational acceptance.

| Acceptance area | Screen / implementation evidence | Acceptance boundary |
|---|---|---|
| Register, verify, create workspace | Account screens 03–05; `auth.py`, `auth.tsx` | Implemented; actual sender/worker and delivered verification still require proof |
| Branding, hours and publish website | Setup/Website/Settings 19–21, 31; `owner.py`, `website.tsx`, `settings.tsx` | Implemented controlled template; approved real tenant/content required |
| Categories, items, variants, availability | Menu 25–26 and public 07–08; `owner.py`, `menu-admin.tsx` | Implemented; own-tenant and plan constraints apply |
| Browse/customise/server total/create order | 06–11; `public.py`, `services.py`, `checkout.tsx` | Implemented cash-only; no card/provider payment claim |
| One order and safe duplicate retries | 09–11; idempotency constraint/transaction in `models.py`, `public.py` | Matching payload/key replay; target PostgreSQL evidence required |
| Receive order / valid status updates | 18, 22–24; `owner.py`, `orders.tsx` | Owner-operated board; staff-role suite deferred |
| Customer-safe private status | 11; `public.py`, guest-safe order serialisation | Confidential link; no customer contact/address/internal reasons exposed |
| Request booking / prevent conflicts | 12, 27–28; `services.py`, `public.py`, `owner.py` | Holding states/table locks; isolated PostgreSQL concurrency validation |
| Defined basic reports | 18, 30; `owner.py`, `reports.tsx` | Completed paid orders; created-date period; not audited accounts |
| Operator tenant/plan management and audit | 33–35; `platform.py`, Audit model | Reasons and audit; no broad owner-data bypass |
| Tenant isolation | Owner APIs, composite references, scoped helpers and `backend\tests` | Cross-tenant/role cases must pass on reviewed build |
| Critical logging / secret hygiene | Audit/session/outbox controls; server-only config | No secrets in guide; deployment/log/access review remains necessary |
| Tests, HTTPS, backup and monitoring | Existing runners, `vercel.json`, readiness | **Not closed:** final evidence, restore proof and external alerts outstanding |

### 12.2 Original section 22.1: Release 1 coverage

| Release 1 requirement | Delivered functional location | Remaining operational condition |
|---|---|---|
| Public website and digital menu | Home/About/Contact/Gallery/FAQs/Policies/Menu | Real approved published restaurant |
| Registration and tenant workspace | Register/Verify/Login/Setup | Working delivered verification |
| Owner dashboard and menu | Dashboard/Menu/Settings/Website | Real menus, services, hours and approved imagery |
| Cart, checkout and online order creation | Cart/Checkout/Tracking | Cash-only operational UAT; not online payment processing |
| Order dashboard and status updates | Orders/detail/basic Kitchen | Restaurant procedures and cash-handling training |
| Reservations/basic availability | Public reservations and owner tables/bookings | Approved capacity/buffer and simultaneous-request evidence |
| Basic notifications | Transactional outbox/SMTP worker | Approved sender, supervised worker and delivery evidence |
| Basic sales/order reports | Dashboard/Reports with definitions | Financial interpretation accepted by client |
| VIRELEO tenant/plan administration | Platform overview/tenants/plans | Named operator access and audited procedures |
| Testing/deployment/monitoring baseline | Existing tests, HTTPS routing, health | External alerts, backups/restore and final acceptance evidence |

### 12.3 Scope interpretation: sections 6.3 and 10.1

The controlled website editor, responsive content preview, owner setup guide, enquiry inbox and basic kitchen board complete the Release 1 journey. They do not turn Release 1 into the full blueprint. The current single-template presets implement a bounded subset of the broader website-builder specification; expanded catalogues, custom-domain mapping and advanced integrations are not silently included. Shared branding coexists with tenant themes and distinct storefront/administration layouts.

### 12.4 Explicitly later releases

| Release 2: operations, not this handover | Release 3: growth/enterprise, not this handover |
|---|---|
| Staff KDS/station routing; QR table ordering; advanced floor management | Multi-branch operations and consolidated analytics |
| POS-lite/cash sessions; staff invitations and branch permissions | Supplier/purchase orders; loyalty/membership |
| CRM/review management; coupons/offers; rider assignment | Advanced financial reconciliation/reporting |
| Ingredient inventory/low-stock operations | Custom domains, expanded templates, multiple languages/currencies and advanced customer integrations |

Online payment/provider approval, subscription charging and a real refund workflow are not enabled. No provider account, cost, schedule or completion guarantee is created by this document.

## 13. Launch acceptance and handover checklist

**Decision state: operational launch sign-off pending.** Client review of the software is separate from permission to accept real customer data/orders.

| Acceptance item | Required completion evidence | Responsibility |
|---|---|---|
| Approved real restaurant | Valid legal/business/contact/menu/hours/services/tables/imagery and publication review | Restaurant owner + client |
| Brand and policies | Brand/domain/trademark review, privacy/terms/cancellation approval, tax/invoice interpretation | Client + advisers |
| Environment separation | Independent development, staging and production DB/resources/access | Operator |
| Email | Approved sender, supervised independent worker, delivered verification and failure/retry tests | Operator |
| Recovery | Provider backup configuration and isolated successful restore with recorded evidence | Operator |
| Monitoring | External uptime/error/worker/queue checks, routed alerts and tested response ownership | Operator |
| Security | Secret/access review, distributed rate limiting, recovery/MFA decision, deployment hardening | Operator + reviewer |
| Business UAT | Cash pickup/delivery, status/cash rules, retry recovery, sold-out/requote and reservation conflicts | Client + technical team |
| Isolation/privacy | Role/tenant denial, fictional-data public exclusion and redacted tracking/logs | Technical reviewer |
| Validation/release | Reviewed build results, migration record, HTTPS smoke check and rollback responsibility | Technical maintainer |
| Handover | Source, manifests, migrations, API contract, guide/assets, separately secured access and named support owner | Client + maintainer |

The application source, contract, migrations, existing checks and this guide support handover. Private credentials and provider access must be transferred through an approved secure channel, not embedded here. Older documents and images remain preserved as historical evidence, not statements of present public availability.

The following appendix records each current screen and its operational meaning. All 39 interface images use controlled isolated test data. Synthetic restaurant pages do not imply a public bypass: the separate unavailable-screen capture records fictional-data exclusion. The architecture and role/workflow diagrams explain implementation boundaries, not provisioned external services.

[[LANDSCAPE]]

## 14. Illustrated screen reference

### 14.1 Platform homepage

Owner-first entry with one restaurant-website registration action. Customer browsing, restaurant plans and shared owner/admin sign-in remain separate navigation choices. The public directory has no fictional listings; real entries require approved published restaurants.

![01 - Platform home; owner-first entry and shared ZAYQORA identity](release1-client-guide-assets\01-platform-home.jpg)

[[PAGEBREAK]]

### 14.2 Restaurant plans

Review available active plan descriptions and menu capacities before registration. Plan configuration is not subscription billing; this screen does not prove a provider account, charged price or paid entitlement.

![02 - Restaurant plans and menu-capacity information](release1-client-guide-assets\02-plans.jpg)

[[PAGEBREAK]]

### 14.3 Owner registration

Enter owner and restaurant information, choose a valid slug and submit. The result creates an unverified owner and unpublished workspace. Read the actual mail-configuration state; submission alone is not completed email verification.

![03 - New owner and restaurant registration](release1-client-guide-assets\03-registration.jpg)

[[PAGEBREAK]]

### 14.4 Shared sign-in

Owners and platform administrators use the same credentials form; the server role determines the destination. Verification recovery is available where needed. A private development account is not a public restaurant.

![04 - Sign in to ZAYQORA; shared owner and administrator access](release1-client-guide-assets\04-sign-in.jpg)

[[PAGEBREAK]]

### 14.5 Email verification and recovery

Open a valid delivered link to verify ownership. Missing/expired links require the supported resend flow. A provider-not-configured response is an operational action item, not confirmation of delivery.

![05 - Verification status and recovery actions](release1-client-guide-assets\05-verification.jpg)

[[PAGEBREAK]]

### 14.6 Restaurant homepage

Restaurant identity, imagery, service actions, featured content and hours use the tenant's controlled website configuration. This synthetic storefront is a fixture capture; it is not a publicly operating restaurant.

![06 - Restaurant home in a controlled test environment](release1-client-guide-assets\06-restaurant-home.jpg)

[[PAGEBREAK]]

### 14.7 Digital menu

Browse published categories, item details, PKR prices and availability. Unavailable food cannot be ordered even if an old cart still contains it; the server rechecks before quoting.

![07 - Published menu categories, items and PKR presentation](release1-client-guide-assets\07-menu.jpg)

[[PAGEBREAK]]

### 14.8 Item customisation

Select supported variants, optional extras, quantity and preparation notes. Required variants cannot be skipped; options must belong to the selected item. Final prices remain server-authoritative.

![08 - Menu item variants, extras and quantity controls](release1-client-guide-assets\08-customisation.jpg)

[[PAGEBREAK]]

### 14.9 Cart and quote

Review the bag and choose pickup/delivery. The API calculates subtotal, applicable delivery, tax and total. Changed selections or availability require a current quote, not a manually edited client total.

![09 - Cart review and authoritative quote summary](release1-client-guide-assets\09-cart.jpg)

[[PAGEBREAK]]

### 14.10 Cash checkout

Provide contact details and delivery address where required, consent and explicitly confirm the current total. A changed quote requires reconfirmation. Cash remains unpaid after creation; the idempotent attempt must be preserved through uncertain retries.

![10 - Cash checkout with consent and current-total confirmation](release1-client-guide-assets\10-checkout.jpg)

[[PAGEBREAK]]

### 14.11 Private tracking

The creation result provides a confidential tracking link. The view shows permitted order/status information without customer contacts, address or staff reasons. This synthetic status is not evidence of a fulfilled food transaction or collected cash.

![11 - Customer-safe private order-status view; no usable tracking URL shown](release1-client-guide-assets\11-tracking.jpg)

[[PAGEBREAK]]

### 14.12 Reservation request

Choose date/party size, fetch available slots, add guest information and submit with consent. The result is a request holding capacity pending owner decision, not an automatically confirmed visit.

![12 - Public reservation availability and guest request form](release1-client-guide-assets\12-reservations.jpg)

[[PAGEBREAK]]

### 14.13 About the restaurant

Read the configured story and business information. Owner-provided plain text and approved imagery should describe the real business accurately; the pictured synthetic identity is used only for interface evidence.

![13 - Restaurant About content](release1-client-guide-assets\13-about.jpg)

[[PAGEBREAK]]

### 14.14 Contact and enquiry

Use displayed contact information or submit the consented form. A receipt/reference means the enquiry is saved to the owner's inbox, not that an email arrived or an order/reservation was accepted.

![14 - Contact information and persisted enquiry form](release1-client-guide-assets\14-contact.jpg)

[[PAGEBREAK]]

### 14.15 Photo gallery

Gallery navigation appears only when enabled and populated. Each approved image needs descriptive alternative text. Stock/test photographs are not evidence of a restaurant's actual food or premises.

![15 - Optional enabled restaurant photo gallery](release1-client-guide-assets\15-gallery.jpg)

[[PAGEBREAK]]

### 14.16 Frequently asked questions

Owners maintain bounded question/answer entries in Website. The page and navigation require enabled nonempty content. Answers must match the restaurant's actual service rules.

![16 - Optional restaurant FAQs](release1-client-guide-assets\16-faqs.jpg)

[[PAGEBREAK]]

### 14.17 Restaurant policies

Restaurant-specific cancellation text appears here, distinct from platform terms/privacy. If absent, the page must not imply a policy has been approved. Software display does not provide legal approval.

![17 - Restaurant policy information and platform policy links](release1-client-guide-assets\17-policies.jpg)

[[PAGEBREAK]]

### 14.18 Owner dashboard

Review today's operational counts, eligible completed/paid sales, recent orders and upcoming reservations. Figures are interpreted using the definitions in section 7; screenshot amounts are synthetic.

![18 - Restaurant owner dashboard and operational summaries](release1-client-guide-assets\18-owner-dashboard.jpg)

[[PAGEBREAK]]

### 14.19 Setup checklist

Follow links to complete saved profile, imagery, hours, menu, services/tables and website checks. Publication is explicit and server-validated. Private fictional workspaces cannot publish even when their other checks are complete.

![19 - Data-derived restaurant setup and publication checklist](release1-client-guide-assets\19-setup.jpg)

[[PAGEBREAK]]

### 14.20 Website editor

Choose controlled palette/typography, story/SEO, section order, service visibility, gallery, FAQs and cancellation text. Save submits the complete validated settings object; an already published restaurant receives saved content changes.

![20 - Website builder for controlled tenant presentation and content](release1-client-guide-assets\20-website-builder.jpg)

[[PAGEBREAK]]

### 14.21 Authenticated responsive preview

Switch desktop/tablet/mobile preview widths before saving or publishing. Unsaved homepage content can be previewed privately. Preview navigation is non-transactional; it does not expose a public checkout route for excluded records.

![21 - Authenticated website content preview before publication](release1-client-guide-assets\21-website-preview.jpg)

[[PAGEBREAK]]

### 14.22 Orders queue

Search reference/customer and filter by status, service mode, payment state and local dates. Open a row/card to process the saved order. Filtering does not change order state.

![22 - Owner orders, search and server-side filters](release1-client-guide-assets\22-owner-orders.jpg)

[[PAGEBREAK]]

### 14.23 Order detail and cash controls

Review immutable line snapshots, customer/service details and history. Apply only valid transitions; record physical cash receipt explicitly. Reject/cancel requires a reason and is unavailable for paid orders.

![23 - Authorised order detail, lifecycle and cash-receipt controls](release1-client-guide-assets\23-order-detail.jpg)

[[PAGEBREAK]]

### 14.24 Basic kitchen board

Use the active-order view to prioritise preparation and open the shared order workflow. It uses the owner's existing permissions; no staff station routing, printer dispatch or POS cash session is implied.

![24 - Owner-operated kitchen order board](release1-client-guide-assets\24-kitchen.jpg)

[[PAGEBREAK]]

### 14.25 Owner menu management

Manage category order/publication and item availability, publication and featured state. Sold-out changes apply to new quotes while historical orders retain their recorded lines and totals.

![25 - Owner categories and menu-item controls](release1-client-guide-assets\25-owner-menu.jpg)

[[PAGEBREAK]]

### 14.26 Item editor

Edit item identity, category, photograph, base price, variants and extras. Review required variants, price deltas and option identifiers. Invalid cross-tenant category references or exceeded plan capacity are rejected by the API.

![26 - Menu item editor with pricing and option configuration](release1-client-guide-assets\26-menu-editor.jpg)

[[PAGEBREAK]]

### 14.27 Owner reservations

Review requests and assigned table/time, confirm/decline or apply valid seated/completed/cancelled/no-show transitions. Requested, confirmed and seated records hold capacity; resolve requests promptly.

![27 - Reservation queue, references and owner decisions](release1-client-guide-assets\27-owner-reservations.jpg)

[[PAGEBREAK]]

### 14.28 Dining tables

Create/edit table name, capacity and active state within Reservations. Tables drive suitable-capacity allocation, not a drag-and-drop floor plan. Review existing bookings before changing operating capacity.

![28 - Dining-table capacity and active-state management](release1-client-guide-assets\28-tables.jpg)

[[PAGEBREAK]]

### 14.29 Contact inbox

Read private enquiries and mark new/read/resolved. The paginated inbox is limited to the authenticated tenant; a public receipt cannot retrieve another customer's message.

![29 - Tenant-scoped customer enquiry inbox](release1-client-guide-assets\29-inquiries.jpg)

[[PAGEBREAK]]

### 14.30 Sales and order reports

Select the local period and interpret completed/paid gross, tax-adjusted net, average order value and item snapshots using section 7. Net sales is not profit; the synthetic totals are not actual business revenue.

![30 - Defined basic sales and order reports](release1-client-guide-assets\30-reports.jpg)

[[PAGEBREAK]]

### 14.31 Restaurant settings

Maintain accurate identity/contact, imagery, hours, fulfilment, pricing/tax and reservation policy. Saving valid settings is distinct from mail delivery, legal sign-off and publication approval.

![31 - Restaurant operational settings](release1-client-guide-assets\31-settings.jpg)

[[PAGEBREAK]]

### 14.32 Notification outbox

Inspect queued/sent/failed notification state. A queue record or configured-provider flag is not an inbox-delivery receipt; investigate the independent worker and approved SMTP provider for failures.

![32 - Notification outbox and truthful delivery states](release1-client-guide-assets\32-outbox.jpg)

[[PAGEBREAK]]

### 14.33 Platform overview

Platform administrators review aggregate tenant/publication/order counts. This screen does not grant arbitrary access to tenant customer records and does not equate aggregate order counts to collected sales.

![33 - Platform administration aggregate overview](release1-client-guide-assets\33-admin-overview.jpg)

[[PAGEBREAK]]

### 14.34 Restaurant tenants

Find tenants, review status/publication and manage activation/suspension or plan assignment. Sensitive changes require reasons and audit. Fictional records remain private regardless of any legacy publication flag.

![34 - Platform tenant management with status and plan controls](release1-client-guide-assets\34-tenants.jpg)

[[PAGEBREAK]]

### 14.35 Platform plans

Maintain active/inactive menu-capacity plans. Plan assignment does not collect a subscription or provision a payment account. Commercial pricing and provider arrangements require separate approval.

![35 - Platform plan definitions and menu-capacity management](release1-client-guide-assets\35-plans-admin.jpg)

[[PAGEBREAK]]

### 14.36 Mobile platform homepage

The owner-first entry and shared brand remain usable at a narrow viewport. Navigation collapses appropriately; registration remains separate from customer restaurant browsing.

![36 - Responsive platform homepage at mobile width](release1-client-guide-assets\36-mobile-home.jpg)

[[PAGEBREAK]]

### 14.37 Mobile restaurant menu

Category browsing, PKR prices and ordering controls adapt for touch/narrow screens. This fixture menu is not evidence of a public fictional restaurant; server availability checks remain identical.

![37 - Responsive restaurant menu at mobile width](release1-client-guide-assets\37-mobile-menu.jpg)

[[PAGEBREAK]]

### 14.38 Mobile owner workspace

Owner navigation and dashboard content adapt to narrow screens without changing tenant permissions. Operational review remains distinct from the photographic customer storefront.

![38 - Responsive owner dashboard at mobile width](release1-client-guide-assets\38-mobile-owner.jpg)

[[PAGEBREAK]]

### 14.39 Private restaurant unavailable publicly

Direct navigation to an excluded fictional restaurant returns an unavailable result rather than its public website. Data remains privately accessible to authorised accounts. This is the intended public exclusion, not missing business data or a request to republish it.

![39 - Public direct-link exclusion for a private fictional restaurant](release1-client-guide-assets\39-private-restaurant-unavailable.jpg)

**End of guide — Version 2, 17 November 2026. Operational launch sign-off remains pending.**
