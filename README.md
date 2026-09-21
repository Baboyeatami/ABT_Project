# ABT Hotel & Restaurant Management Platform

A classroom platform for Hotel & Hospitality Management students to practice
real hotel and restaurant operations. Each student gets their own **mini-hotel**
(isolated by Row-Level Security). The instructor is the **platform admin** and
can oversee every hotel, assign roles, and view global reports.

## Stack

- **Frontend:** React (Vite) + Bootstrap 5
- **Backend:** Node.js / Express — thin serverless API on Vercel (admin + reports)
- **Database:** Supabase (Postgres + Auth + Row-Level Security)
- **Auth:** Google sign-in, restricted to the school domain (`@g.cjc.edu.ph`)
- **Deploy:** Vercel (Hobby) + Supabase Free

## Repo layout

```
api/            Express serverless functions (Vercel /api)
src/            React frontend (Vite)
supabase/       SQL schema, migrations, seed
```

## Roles

| Role             | Who       | Access                                            |
|------------------|-----------|---------------------------------------------------|
| `platform_admin` | Instructor| All hotels, assign roles, global reports          |
| `owner`          | Student   | Full control of their own hotel                   |
| `front_desk`     | Staff     | Rooms, guests, reservations, reports               |
| `kitchen`        | Staff     | Menu, tables, POS, kitchen                         |
| `cashier`        | Staff     | POS, billing, reports                              |

Module access per role is enforced in the UI (`src/lib/auth.js` → `MODULES`) and
routes. Every tenant table is also protected by Row-Level Security.

## First-time setup

### 1. Supabase project

1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run `supabase/migrations/0001_init.sql`.
3. Optionally run `supabase/migrations/0002_seed.sql` to give every hotel
   starter rooms, a menu, and dining tables.
4. Set up **Google OAuth**:
   - **Auth → Providers → Google** → enable, add your OAuth client ID/secret.
   - In **Auth → URL Configuration**, add your site URL.
   - In **Auth → Settings**, set **Allowed email domains** to `g.cjc.edu.ph`.
5. Copy your project keys: **Settings → API** → `Project URL`, `anon key`,
   `service_role key`.

### 2. Make yourself the instructor

The `platform_settings.admin_emails` array controls who becomes `platform_admin`.
Run in the SQL Editor, replacing with your Google account email:

```sql
update public.platform_settings
set admin_emails = array['you@your-school-domain.edu.ph']
where id = 1;
```

Then sign in with that Google account. You'll be `platform_admin`; everyone else
with an allowed school email gets a blank hotel automatically.

### 3. Environment variables

Copy `.env.example` to `.env` and fill in the values (local dev only):

```bash
VITE_DEMO_MODE=0
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Run locally

```bash
npm install
npm run dev        # frontend at http://localhost:5173
```

The Express API runs as Vercel serverless functions. To test `/api` locally you
can run `vercel dev`.

## Demo mode (no Supabase / Docker)

With `VITE_DEMO_MODE=1` (the default in the generated `.env`), the app runs
entirely in your browser against a seeded in-memory dataset — no Supabase
project, Docker, or Google OAuth needed. Seeded login accounts (password
`demo1234`):

| Email                | Role              |
|----------------------|-------------------|
| `instructor@abt.demo`| `platform_admin`  |
| `owner@abt.demo`     | `owner`           |
| `frontdesk@abt.demo` | `front_desk`      |
| `kitchen@abt.demo`   | `kitchen`         |
| `cashier@abt.demo`   | `cashier`         |

Demo data includes 2 hotels, rooms, a full menu, dining tables, guests,
reservations, an active stay, orders, an invoice, and a payment. Changes are
persisted to `localStorage` and reset by clearing site data or setting
`VITE_DEMO_MODE=0` and restarting.

To switch to real Supabase, set `VITE_DEMO_MODE=0` and fill in the keys.

## Deploy to Vercel (Hobby)

1. Push this repo to GitHub.
2. In Vercel, import the repo (framework preset: Vite is auto-detected;
   `vercel.json` sets the build and API rewrites).
3. Add environment variables in Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `VITE_DEMO_MODE=0` (never deploy with demo mode on)
4. In Supabase → Authentication → URL Configuration, add the Vercel URL to
   **Site URL** and `http://localhost:5173` to **Additional Redirect URLs**.
5. In Supabase → Authentication → Settings, set **Allowed email domains** to
   `g.cjc.edu.ph` (domain restriction is enforced in the dashboard, not in code).
6. Deploy. The `/api/*` routes are handled by the Express serverless function
   (`api/index.js`).

## Live checklist before class starts

- [ ] `0001_init.sql`, `0003_core_integrity.sql` applied (optionally `0002_seed.sql`)
- [ ] `0004_ai_insights.sql` applied if AI insights are wanted, plus `AI_ENABLED`/`GEMINI_*` env vars
- [ ] Instructor email set in `platform_settings.admin_emails`
- [ ] Google OAuth client ID/secret configured in Supabase (Auth → Providers)
- [ ] Vercel env vars set; `VITE_DEMO_MODE=0`
- [ ] Supabase redirect allow-list includes the Vercel URL and localhost
- [ ] Test: first Google sign-in creates a hotel; instructor panel shows all hotels

> `ALLOWED_EMAIL_DOMAINS` is not used by the application; email-domain
> restrictions live in the Supabase dashboard and in `platform_settings`.

## AI insights (free-tier)

Hotel owners (and the instructor, per hotel) can generate an AI-assisted
performance summary from the dashboard or the admin performance modal. The
feature is on-demand, cached, and rate-limited so it fits inside free tiers:

- Metrics are computed in the database (`ai_hotel_snapshot`); only aggregate
  numbers are sent to the model — no guest contact details.
- Results are cached for 15 minutes per hotel + period + data snapshot; cached
  responses do not consume another model request.
- Limits enforced in Supabase (`ai_claim_request`): 5 new requests per person
  per day, 30 per classroom per day, 2 per minute across the platform. All
  counters persist in `ai_usage` and reset at midnight UTC.
- When the provider's free quota is exhausted, the UI shows a clear message.
  There is no automatic paid fallback.

### Enable AI insights

1. Apply `supabase/migrations/0004_ai_insights.sql` (creates the cache/usage
   tables and the two service-role RPCs; all other roles are revoked).
2. Create a free API key at https://aistudio.google.com/apikey and pick a
   model with a free quota in your project (for example a `gemini-…-flash`
   model). Model availability and quotas can change; verify in AI Studio.
3. Set environment variables (local `.env` and Vercel):

   ```
   AI_ENABLED=1
   GEMINI_API_KEY=your-free-tier-key
   GEMINI_MODEL=gemini-2.5-flash
   ```

With `AI_ENABLED` unset (or `0`) the endpoint answers `503` and the UI explains
that insights are not configured yet. In demo mode the panel shows a clearly
labeled rule-based sample instead of calling any model.

## Roadmap

### Core integrity migration

Apply `supabase/migrations/0003_core_integrity.sql` after the existing migrations.
It adds transactional invoice/payment/check-in operations, immutable invoice line
snapshots, departmental write policies, protected profile roles, and room booking
overlap constraints. Existing overlapping reservations or duplicate active
invoices must be reconciled before this migration can succeed; it runs in a
transaction and does not delete historical records.

The application requires this migration in real Supabase mode. Local demo mode
implements equivalent billing and stay operations in the browser. Verify with
`node --test src/lib/core.test.js`. Database migration execution and Google OAuth
still require a configured Supabase instance.

Previously issued invoices retain their original totals. The new calculation
applies to newly issued invoices and does not rewrite historical financial data.

- [x] Foundation: scaffold, schema, RLS, auth, admin API skeleton
- [x] Identity & instructor panel (assign students/hotels)
- [x] Owner core: rooms, guests, reservations, front desk
- [x] Restaurant: menu, tables, POS, kitchen
- [x] Billing/Reports: combined folio, invoices, payments, dashboards
- [x] Staff role views + seed data + docs
