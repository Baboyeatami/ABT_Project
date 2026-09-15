# ABT Hotel Platform — Agent Notes

Reference for AI agents / developers working on this repo. Summarizes the
current state, infrastructure, and work completed as of Sep 2026.

## What this is

Classroom hotel & restaurant management platform (React + Vite frontend,
Express API, Supabase backend). Students get their own hotel workspace;
the instructor is a platform admin.

- **GitHub:** https://github.com/Baboyeatami/ABT_Project (branch `main`)
- **Production:** https://abt-hotel-platform.vercel.app (Vercel, auto-deploys on push to `main`)
- **Supabase project:** `jnbnwhpgrdhcyeuprdox` (https://supabase.com/dashboard/project/jnbnwhpgrdhcyeuprdox)

## Architecture

- `src/` — React app. `src/lib/supabase.js` exports the browser client;
  `src/lib/auth.js` wraps auth/role helpers. `VITE_DEMO_MODE=1` swaps the
  Supabase client for an in-browser demo client (`src/lib/demoData.js`).
- `api/` — Express serverless functions (Vercel). `api/index.js` exports the
  app; rewrites map `/api/(.*)` → it (see `vercel.json`).
  - `api/admin.js` — platform-admin routes (stats, hotels, user assign/enable/disable).
  - `api/_lib/supabase-admin.js` — `adminClient()` service-role Supabase client.
    Reads env lazily inside the function; requires `SUPABASE_URL` +
    `SUPABASE_SERVICE_ROLE_KEY`.
- `supabase/migrations/` — SQL schema + seed:
  - `0001_init.sql` — tables, RLS, and the `handle_new_user` trigger that
    auto-provisions profiles on signup: emails in `platform_settings.admin_emails`
    become `platform_admin`; `@g.cjc.edu.ph` signups become `owner` + get a blank hotel.
  - `0002_seed.sql` — per-hotel demo data (rooms, menu, dining tables).
  - `0003_core_integrity.sql` — constraints.
- `supabase/seed-admin.mjs` — idempotent admin-login seed (creates auth user
  via Admin API, ensures `admin_emails` entry, fixes profile role).
  Run: `node supabase/seed-admin.mjs [email] [password]`.
- `vite.config.js` — dev proxy: `/api` → `http://localhost:3001`.

## What was completed

1. **Supabase connection** — API uses a service-role client; env vars set in
   `.env` (local) and Vercel (all environments).
2. **Admin seed** — `supabase/seed-admin.mjs`; credentials are stored in
   `seed-accounts.txt` (local only, git-ignored — never commit or print them).
3. **Email/password login** — added to `src/pages/Login.jsx` for non-demo mode
   (`signInWithPassword` in `src/lib/auth.js`), alongside Google OAuth button.
4. **Local dev setup** — `node api/dev.mjs` (API on :3001, loads `.env`) +
   `npm run dev` (Vite on :5173, proxies `/api`).
5. **Vercel deploy** — project `abt-hotel-platform`, GitHub connected;
   pushes to `main` auto-deploy. Env vars configured via CLI.
6. **Security** — `seed-accounts.txt` and `.env*` are git-ignored.
7. **Hotel performance monitoring** — instructor-facing: `api/admin.js` computes
   per-hotel metrics (`rooms` occupancy, `reservations` by status, `stays`,
   `restaurant` sales, `billing` collected/outstanding/collection %, `activity`
   last-activity + action counts, optional time window `?days=7|30|all`).
   Routes: `GET /api/admin/performance` (all hotels), `GET /api/admin/hotels/:id/performance`
   (+14-day activity series). `Admin.jsx` has a sortable Performance tab and a
   detail modal; Hotels/Students tabs link into it. Demo mode implements the
   same logic in `demoData.js` (`demoPerformance`, `demoActivitySeries`).

## Pending / known issues

- **Rotate the Supabase service role key** (`sb_secret_…`) — it was exposed in
  chat during setup. Rotate in Supabase → Settings → API Keys, then update
  `.env` + Vercel env vars and redeploy.
- **Google OAuth** — provider was disabled on the Supabase project
  (`google: false` at `/auth/v1/settings`). User was setting up a Google Cloud
  OAuth client with redirect
  `https://jnbnwhpgrdhcyeuprdox.supabase.co/auth/v1/callback` and adding the
  Vercel domain to Supabase Redirect URLs. Verify it's enabled before
  debugging the Google button.
- **ESLint can't parse JSX** — `.eslintrc.cjs` has no JSX parser config, so
  `npm run lint` errors on every `.jsx` file (pre-existing). Verify changes
  with `npm run build` instead.
- **No admin user-creation UI** — students self-register (Google); the admin
  only assigns roles/hotels afterward. A "create user" feature was proposed
  but not built.

## Conventions

- Keep secrets out of the repo: service keys and passwords live in `.env`
  (server) / `VITE_*` vars (browser-safe only) — never commit, never put the
  service key in a `VITE_` variable.
- Comments in code are avoided; keep additions minimal and consistent.
- Commit messages: short imperative summaries (see `git log`).
