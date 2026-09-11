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
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_EMAIL_DOMAINS=g.cjc.edu.ph
```

### 4. Run locally

```bash
npm install
npm run dev        # frontend at http://localhost:5173
```

The Express API runs as Vercel serverless functions. To test `/api` locally you
can run `vercel dev`.

## Deploy to Vercel (Hobby)

1. Push this repo to GitHub.
2. In Vercel, import the repo (framework preset: Vite is auto-detected).
3. Add environment variables:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL_DOMAINS` (server)
4. Add `g.cjc.edu.ph` to your Supabase auth redirect allow-list for the Vercel
   URL.
5. Deploy. The `/api/*` routes are handled by the Express functions.

## Roadmap

- [x] Foundation: scaffold, schema, RLS, auth, admin API skeleton
- [x] Identity & instructor panel (assign students/hotels)
- [x] Owner core: rooms, guests, reservations, front desk
- [x] Restaurant: menu, tables, POS, kitchen
- [x] Billing/Reports: combined folio, invoices, payments, dashboards
- [x] Staff role views + seed data + docs
