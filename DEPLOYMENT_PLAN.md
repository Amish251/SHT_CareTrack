# Going live: CareTrack on Supabase + Vercel

This is the concrete, in-order runbook for turning this codebase into a
real, shared, multi-device app for your 10-15 users. Everything code-side
is already done (see "What changed in the code" below) — what's left is
account setup and a handful of copy-paste steps, roughly 30-45 minutes.

You'll need: a Supabase account (free tier is plenty to start) and a
Vercel account (free tier is plenty). Both sign up with GitHub in under a
minute if you don't have accounts already.

---

## Part 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick an organization, name it (e.g. `caretrack`), set a strong
   **database password** (save it somewhere — you likely won't need it
   day-to-day, but you will if you ever connect a database tool directly).
   Choose a region close to where your team actually is (e.g. Mumbai for
   India).
3. Wait ~2 minutes for provisioning.

## Part 2 — Run the schema

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this project, copy the whole file,
   paste it in, click **Run**.
3. You should see "Success. No rows returned." That one file creates
   every table, every security rule, and seeds the two starter data rows
   the app expects.

## Part 3 — Get your API keys

1. **Project Settings → API**. Copy two values:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon / public** key (long string starting `eyJ...`)
2. You'll paste these into Vercel in Part 6, and optionally into a local
   `.env` file if you want to run this on your own laptop first.

## Part 4 — Deploy the Edge Function (user management)

This function is what lets an admin add/remove/reset staff logins from
inside the app. It needs the Supabase CLI, run once from your computer:

```bash
npm install -g supabase
supabase login
cd caretrack
supabase link --project-ref your-project-ref   # find this in your project's URL
supabase functions deploy manage-user
```

That's it — Supabase automatically gives this function the service-role
key as a secret; you never copy or paste that key anywhere yourself.

## Part 5 — Create your first two logins

The app no longer creates a default admin automatically (that was fine
for a local demo, not for something with real logins on the internet).
Create these two accounts once, manually, in the Supabase dashboard:

1. **Authentication → Users → Add user.**
   - Email: `admin@caretrack.internal` (the app maps usernames to emails
     under this fixed fake domain — see `EMAIL_DOMAIN` in `auth.ts`/the
     Edge Function if you ever want to change it)
   - Password: pick a real one, tell your admin what it is
   - Tick **Auto Confirm User**
2. **Table Editor → profiles → Insert row.**
   - `id`: paste the UUID of the user you just created (visible in the
     Authentication → Users list)
   - `username`: `admin`
   - `role`: `admin`
3. Repeat for the super admin:
   - Email: `amish_251@caretrack.internal`, password `Amish@2003` (or
     change it — see note below), Auto Confirm User ticked
   - Profile row: `username = amish_251`, `role = superadmin`

From here on, adding *more* staff/admin logins is done from inside the
app (Settings → Users) — only these first two need the manual dashboard
steps, because there's nobody signed in yet to click "Add user."

> **Change the super admin password before real use.** `Amish@2003` was
> a placeholder chosen during development. Set whatever you actually
> want at account-creation time in step 3 above — it doesn't need to
> match what's in old chat history.

## Part 6 — Deploy to Vercel

1. Push this project to a GitHub repo (private is fine).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import
   that repo. Vercel auto-detects Vite; defaults are correct
   (`npm run build`, output directory `dist`).
3. Before the first deploy, open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | from Part 3 |
   | `VITE_SUPABASE_ANON_KEY` | from Part 3 |

   Add both for Production, Preview, and Development.
4. **Deploy.** Takes about a minute.
5. Open the `.vercel.app` URL Vercel gives you, sign in with the admin
   login from Part 5. You're live.

## Part 7 — Optional: a real domain

Vercel → your project → **Settings → Domains** → add e.g.
`app.showhumanitytrust.org`, point your DNS at Vercel per the
instructions it shows you. Free, and Vercel handles HTTPS automatically.

## Part 8 — Add your remaining staff/admin logins

Sign in as the admin account from Part 5 → **Settings → Users → Add a
user**. Repeat for everyone — this is the same flow whether they'll use
it from a phone, tablet, or laptop; nothing device-specific to configure.

---

## What changed in the code, and why

The app used to keep everything in the browser's `localStorage` — fast
and simple, but invisible to anyone else and lost the moment someone
cleared their browser. None of that works for 10-15 real people on
different devices, so this pass replaced the storage layer:

- **`src/shared/lib/auth.ts`** — was a hand-rolled username/password
  system that hashed passwords with unsalted client-side SHA-256 and
  kept the whole password-hash list in `localStorage`. That was never
  safe to put on the open internet — anyone could read every password
  hash from their browser's dev tools, and unsalted SHA-256 is
  crackable at scale. Now backed by real Supabase Auth (bcrypt,
  server-side, industry-standard sessions). Usernames are mapped to a
  synthetic email under `@caretrack.internal` so your team still just
  types a username, not an email address.
- **`src/shared/lib/storage.ts`** — the old `loadNamespaced`/
  `saveNamespaced` read/wrote `localStorage` directly. They now read
  and write a shared Postgres table (`app_data`) in Supabase instead,
  through the exact same function signatures — which is why almost
  none of the actual page code (Dashboard, Issue Equipment, Active
  Loans, Donations, etc.) had to change. Also added a live subscription
  (Supabase Realtime), so a change made on one phone shows up on
  another device within about a second, without a manual refresh.
- **`src/shared/lib/activityLog.ts`** — was a JSON array in
  `localStorage`. Now a real table (`activity_log`) with a database
  rule (RLS policy) that only the super admin can ever read it —
  enforced by Postgres itself, not just by the app choosing not to
  show it.
- **`supabase/schema.sql`** — new. The complete database setup: every
  table, and the access rules (Row Level Security) that encode this
  app's existing permission model — staff can issue/return equipment
  but not touch Donations; only the super admin can read the activity
  log; the super admin's own account is invisible to every other admin.
  These rules are enforced at the database level now, which is
  stronger than before: previously "staff can't see Donations" was
  only true because the app's UI didn't show it to them — now it's
  also true even if someone tried calling the API directly.
- **`supabase/functions/manage-user/`** — new. Creating, deleting, or
  resetting someone else's password requires Supabase's service-role
  key, which must never be sent to a browser. This is a small
  server-side function (an "Edge Function") that does those three
  things and nothing else, after checking the person calling it is
  actually an admin.
- **`src/features/settings/pages/BackupPage.tsx`** — export/restore now
  read and write the live Supabase data instead of `localStorage`.
  Supabase also takes its own automatic daily backups of the whole
  database independently of this page (see the in-app explanation on
  that page).

---

## Known limitations, worth knowing before you rely on this

- **RLS is per-module, not per-field.** Staff have write access to the
  whole `equipment-register` row (types + units + allocations together)
  because issuing/returning equipment genuinely needs to update a
  unit's status, which lives in that same JSON blob as equipment types.
  The app's UI never gives staff a way to add or delete equipment
  types — but a technically determined staff member calling the REST
  API directly (not through the app) could. Low realistic risk for a
  small trusted team; the fix if it ever matters is normalizing
  equipment types/units into their own tables with real per-column
  permissions (a real "Phase 2" — see below).
- **Concurrent-edit races are reduced, not eliminated.** Because each
  module is still one JSON blob per row (not one database row per
  equipment unit), two people editing the exact same module at the
  exact same second could have one write overwrite the other. The
  Realtime subscription added in this pass shrinks that window a lot
  (clients stay in sync within ~1 second) but doesn't remove it
  entirely. For a small trust where staff are usually issuing one
  piece of equipment at a time, this is a low-probability event — but
  if you ever see data "revert" after two people edited at once, this
  is why, and it's the reason to prioritize the Phase 2 normalization
  below.
- **No automated tests, and this specific migration hasn't run against
  a real Supabase project** (only checked: it builds with no type
  errors, and the compiled app loads and fails gracefully against a
  fake/unreachable backend — real end-to-end testing needs your actual
  project). **Do Parts 1-6 above, then click around yourself — add an
  equipment type, issue something, add a donation, add a staff login —
  before telling your team it's ready.**
- **The super admin's password can be changed from their own Settings
  → My Login** like anyone else's — it's un-deletable and hidden from
  other admins, but not permanently frozen. If that password is ever
  forgotten, reset it the same manual way as Part 5 (Supabase dashboard
  → Authentication → find the user → reset password).

## Suggested Phase 2 (not needed to go live, worth planning for later)

If this grows past ~15 people, or you start noticing the concurrent-edit
issue above in practice, the next real step is normalizing
`equipment-register`'s single JSON blob into proper tables:
`equipment_types`, `equipment_units`, `allocations` as real rows with
foreign keys — each unit's status updates as its own row instead of a
whole-module overwrite, which both fixes the race condition and allows
genuine per-column RLS (e.g. staff can `UPDATE` a unit's status but
can't `INSERT`/`DELETE` a type). This is a bigger, deliberate project —
worth doing as its own focused pass, not squeezed in alongside other
feature work.

## Costs

- **Supabase free tier**: 500MB database, 50,000 monthly active users,
  2 CPU-hour Edge Function budget. For 10-15 people doing equipment/
  donation record-keeping, you will not come close to any of these
  limits. $0/month.
- **Vercel free (Hobby) tier**: plenty for this app's traffic. $0/month.
- Total to go live: **$0/month**, until you outgrow the free tiers by a
  wide margin.
