# Handoff notes — Seva Trust Suite

This is a status snapshot for continuing this project in a new chat.
Paste this whole file (or attach the zip) and say "continue from this
handoff" — a fresh Claude can pick up from here without re-reading the
whole conversation.

## What this project is

A React + Vite + TypeScript internal-tools app for a Trust, structured as
one app with feature "modules" under `src/features/`. Modules so far:
**Equipment Register** (token-based lending), **Finance** (donations and
expenses), and **Settings** (users, own login, backup/restore). Data is
stored client-side in `localStorage` (namespaced per module, see
`src/shared/lib/storage.ts`) — there is still no real backend.

## Done so far

### Earlier sessions
1. Equipment Register module ported from the original
   `equipment-register.html` prototype (kept as reference at
   `reference/equipment-register.original.html`).
2. Build plumbing fixes (`@` path alias, `ToastProvider` moved to survive
   route changes).
3. Rebrand to the Trust's blue/white logo theme — `tokens.css` repainted,
   logo watermark on `.main`, `Sidebar.tsx` shows the real logo.
4. Password protection, multi-user logins, deposit-vs-payment relabelling,
   edit/delete on issue records, new Finance module, mandatory fields on
   Issue Equipment, mobile-responsive tables, PDF deposit receipt +
   WhatsApp share, backup/restore. (Full detail on these lives in git
   history / earlier chat — see "This session" below for what changed
   since.)

### This session — merged nav, self-service password, PDF logo, PWA icons
1. **Merged the double-nav layout.** The Sidebar (`app/layout/Sidebar.tsx`)
   is now the single source of navigation: each module (Equipment
   Register / Finance / Settings) is a top-level entry, and its sub-pages
   nest directly underneath it in the same sidebar once you're inside
   that module. Removed the old horizontal tab-strip components
   (`ModuleTabs.tsx`, `FinanceTabs.tsx`, `SettingsTabs.tsx`) and flattened
   `App.tsx`'s routes to match — there's no more wrapper-route indirection,
   just one `<Route>` per page under `<AppShell>`. Mobile CSS updated so
   the nested items still work in the horizontal-strip sidebar under
   800px (each module becomes its own scrollable column, sub-pages stack
   underneath the active one).
2. **Self-service "change my own password."** New
   `Settings → My Login` page (`src/features/settings/pages/ProfilePage.tsx`,
   route `/settings/profile`) lets any signed-in user change their own
   password after confirming their current one. Added
   `verifyPassword(userId, password)` to `auth.ts` for this (checks a
   plain-text password against the stored hash without changing session
   state).
3. **Found and fixed a real CSS bug while building the above:**
   `input[type=password]` was never included in the shared input-styling
   selector in `tokens.css`, so every password field in the app (login
   screen, Add User form, and the new change-password form) was rendering
   at the browser's tiny default width instead of full-width. Added
   `input[type=password]` (and `input[type=email]` while in there) to the
   selector — fixes it everywhere at once, not just the new page.
4. **PDF receipt now has the Trust's logo in the header.**
   `buildDepositReceiptPdf()` in `src/shared/lib/receipt.ts` is now
   `async`: it fetches `/logo.png`, embeds it top-left of the PDF, and
   fails gracefully (skips the logo, doesn't throw) if the fetch fails.
   The one caller (`ActiveLoansPage.tsx`) was already in an async handler,
   just added the `await`.
5. **Real PWA icons.** Generated `public/icons/icon-192.png`,
   `icon-512.png`, and `-maskable` variants from `public/logo.png` (Pillow,
   white background, ~6% padding for the regular set and ~18% for
   maskable so Android's mask doesn't crop the artwork). Wired both
   purposes into the manifest in `vite.config.ts`.

Verified with `npm install && npm run build` (tsc + vite) — no type
errors, no build errors. Also visually checked with a headless-Chrome
screenshot pass (login screen, dashboard, finance, profile, users, and a
390px mobile viewport) to confirm the nav merge and the password-field
fix actually rendered correctly, not just compiled.

### This session (part 2) — real bug fixes reported from live use
Picking up directly from a person's screenshot report after the nav-merge
session above. Four separate issues, all found, reproduced, fixed, and
verified with headless-Chrome screenshots (not just "should work now"):

1. **Removed the background logo watermark.** `.main` in `tokens.css` had
   a large `background-image: url('/logo-watermark.png')` — this is gone
   now, plain white content area.
2. **Fixed: "can't issue equipment."** This was a real, reproducible race
   condition, not a one-off glitch. Both `useEquipmentData()` and
   `useFinanceData()` (in `store.ts` for each module) persisted to
   `localStorage` *inside* a React `setState` functional updater. Several
   pages (`IssuePage`, `AddEntryPage`, `EditAllocationPage`) call
   `update(...)` and then immediately `navigate(...)` in the same
   synchronous handler — and that immediate route change unmounts the
   page before React ever gets around to running the queued updater, so
   the write to `localStorage` silently never happened. Confirmed this by
   instrumenting `localStorage.setItem` in a headless-browser repro:
   zero calls recorded during a full "issue equipment" submit. Fixed by
   rewriting both `update()` functions to save via a `ref` synchronously,
   as a plain function call outside of React's scheduling — so the write
   happens unconditionally before `navigate()` can ever run. Re-ran the
   same instrumented repro afterward: the write now happens and Active
   Loans correctly shows the new record.
3. **Fixed: staff could reach admin-only screens.** `Settings → Backup &
   Restore` (`BackupPage.tsx`) had *no* role check at all — any signed-in
   staff user could export a full backup (which includes every user's
   password hash) or wipe/overwrite all data via restore. Added the same
   `session.role !== 'admin'` guard `UsersPage.tsx` already had. Also
   updated `Sidebar.tsx` so staff never even see the "Users" or "Backup &
   Restore" links (only "My Login"), and changed the `/settings` index
   redirect to send staff to their own profile instead of the admin-only
   Users page. Verified with a full login-as-staff pass: sidebar hides
   both links, and force-navigating to `/settings/users` or
   `/settings/backup` directly by URL shows an "Admins only" message
   instead of the real page.
4. **Fixed the overlapping hint text.** `.field-hint` ("Refundable — not
   a payment to the Trust.") had `margin-top: -8px`, which pulled it up
   into the input's bottom border — visible as real overlap at column
   widths around 700–900px (common on a maximized laptop window, not just
   mobile). Changed to `margin-top: 4px` so it sits cleanly below the
   field at every width tested (390 / 700 / 900 / 1150px).

Also fixed while investigating: `node_modules` had been excluded from
zip packaging in the previous handoff, and the local dev container's
preview server does not survive between separate tool invocations —
noting this here only because it cost real time re-diagnosing; not
something the person needs to do anything about.

Verified with `npm run build` (tsc + vite, no errors) and a full
headless-Chrome pass: admin creates a staff user → staff logs in → staff
sidebar correctly shows only "My Login" under Settings → staff is blocked
from `/settings/users` and `/settings/backup` by direct URL → staff
successfully issues a piece of equipment end-to-end and it shows up
correctly on Active Loans.

### This session (part 3) — code-split the PDF receipt bundle
Only open item left worth doing quickly before wrapping up:

1. **Fixed the bundle-size warning.** `ActiveLoansPage.tsx` imported
   `buildDepositReceiptPdf` / `shareReceiptOnWhatsApp` from
   `@/shared/lib/receipt` at the top of the file, so `jspdf` and its
   `html2canvas` dependency (~360 kB) were bundled into the main chunk
   that loads on every page, even for staff who never click "Receipt."
   Changed `handleSendReceipt` to `await import('@/shared/lib/receipt')`
   at call time instead of a static top-level import. Verified with
   `npm run build`: main app chunk went from ~567 kB to ~210 kB
   (gzip 64.9 kB), `receipt.js` (~359 kB) now loads as its own chunk
   only when "Receipt" is actually clicked, and the size warning is
   gone. No behavior change — added a "Preparing receipt…" toast so the
   brief extra load feels intentional rather than like a stall.

Verified with a clean `npm install && npm run build` — no type errors,
no build errors, no size warnings.

### This session (part 4) — deposit accountability, receipt viewing, button-styling bug
Six items from a person's numbered list:

1. **View receipt in-app.** New `src/shared/components/PdfPreviewModal.tsx`
   — a simple overlay with an `<iframe>` pointing at a blob URL. Active
   Loans now has a "View" button next to "Share" (only shown once the
   deposit is marked Received) that generates the PDF and opens it in
   this in-app modal instead of only downloading/sharing it.
2. **Capture who received the deposit.** Added `depositReceivedBy` to
   the `Allocation` type. It's captured two ways: on the Issue Equipment
   form, ticking "Deposit received" now reveals a required "Deposit
   received by" field (defaults to the logged-in username); on Active
   Loans, clicking the Pending→Received pill now prompts
   `window.prompt('Who received the deposit?', session.username)`
   instead of just flipping a boolean. Turning it back to Pending clears
   the name. Also editable later from Edit Record. The row now shows
   "by &lt;name&gt;" under the pill as a quick glance-check.
3. **Receipt now states who allocated it.** `buildDepositReceiptPdf()`
   in `receipt.ts` prints a "Received & allocated by:" row using
   `allocation.depositReceivedBy` — same name captured in #2, reused
   for both meanings as asked, no separate "allocated by" field.
4/5/6. **Fixed the real bug behind the "doesn't match the theme" and
   "make buttons good UI" reports.** `tokens.css` styled buttons with
   the selector `button.btn`, which only ever matches actual `<button>`
   elements. Every `Link`-based button in the app — Edit (Active
   Loans/History), + Add entry (Finance Overview) — is rendered as an
   `<a class="btn ...">`, so `a.btn` was never matched by any rule and
   those links were rendering as bare unstyled blue underlined text.
   Changed every `button.btn` rule to plain `.btn` so it matches both
   elements, added `text-decoration: none` and flex alignment so anchor
   buttons look identical to real buttons, and added a `.btn.ghost`
   variant (used by the new modal's close button) and a `.row-actions`
   helper class (flex row, wraps on mobile) — swapped in everywhere a
   page was hand-rolling `style={{ display: 'flex', gap: ... }}` for a
   button row (Active Loans, History, Dashboard's per-type actions,
   Edit Record's save/cancel), so all action-button rows now share one
   consistent spacing rule instead of three slightly different ones.

Verified with a clean `npm install && npm run build` — no type errors,
no build errors. (No headless-browser screenshot pass this round — see
open items below, worth a quick visual check next session since this
directly touches how every button on every page renders.)

### This session (part 5) — issue multiple equipment items in one visit
1. **`Allocation` now carries a `groupId`.** Added to
   `features/equipment-register/types.ts`. Every item issued in the same
   visit shares one `groupId` (`uid('grp')`), generated once per submit
   in `IssuePage.tsx`. Records saved before this change have no
   `groupId` in storage — handled by a `groupKey()` helper (new, in
   `helpers.ts`) that falls back to the allocation's own `id` when
   `groupId` is missing, so old single-item records still behave as a
   "group of one" with no migration step needed.
2. **`IssuePage.tsx` rewritten for multiple line items.** The equipment
   type/unit/deposit row is now a repeatable line (`+ Add another
   equipment` / `Remove`, minimum one line). Patient name/phone, issue
   date, expected return, deposit-received, and notes stay shared across
   all lines — only equipment + per-item deposit amount varies per line.
   Guards added: the same unit can't be picked twice across lines, and
   every line's unit is re-checked as still-free at submit time (handles
   two lines briefly pointing at the same freshly-freed unit). Shows a
   running "Total deposit: ₹NNN" once there's more than one line, and
   the submit button reads "Issue N items" when N > 1.
3. **Receipt now itemizes the whole batch.** `buildDepositReceiptPdf()`
   in `receipt.ts` changed signature — takes `(allocations: Allocation[],
   data: EquipmentRegisterData)` instead of a single allocation + type +
   unit. Lists every item on one receipt with its own amount and a
   "Total deposit" line; falls back to the exact same single-line look
   as before when the array has one item (verified — see below). New
   helper `allocationsInGroup(data, allocation)` in `helpers.ts` (sorted
   by `id` for a stable item order) is what `ActiveLoansPage.tsx` now
   passes in for both "View" and "Share" — it gathers every allocation
   with the same `groupKey()`, active or returned, since the deposit
   receipt reflects what was collected at issue time regardless of
   current return status.
4. **Small "N items" badge** added next to the patient name in both
   Active Loans and History whenever `allocationsInGroup(...).length >
   1`, so it's clear at a glance why one row's receipt contains more
   than that row's own item.

Verified end-to-end with a headless-Chrome pass, not just a build check:
logged in, added two equipment types, issued a Wheelchair + a Walking
Stick to the same patient in one submit, confirmed both rows appear in
Active Loans tagged "2 items", downloaded the actual generated PDF bytes
(not just a screenshot of the modal) and rendered it with `pdftoppm` —
both items are itemized with correct individual amounts and a correct
₹600 total. Also re-ran the same check issuing a single item to confirm
the receipt still renders exactly as it did before this change (no
"batch" language, no stray "Equipment issued (this visit)" heading —
that heading only appears when there's more than one item).

## Known limitations / open items

- **Security is client-side only.** Password hashing happens in the
  browser and the "database" is `localStorage` — anyone with browser dev
  tools access on the same device can read the raw data or bypass the
  login. This is fine for a small trusted team on trusted devices, not
  for anything more adversarial. The in-app note (`Settings → Backup &
  Restore`) recommends **Supabase** (Postgres + built-in auth, easiest
  fit for this React app) as the next real step once more than one or
  two people use this day-to-day.
- **No data sync across devices** — each device's `localStorage` is
  independent; Backup/Restore is the only way to move data between
  devices right now.
- **Source logo is fairly low-res (221×228)** — the generated PWA icons
  are correctly proportioned but a little soft at 512px. If a
  higher-resolution logo file becomes available, regenerate
  `public/icons/*.png` from it for crisper results.
- The `.gitignore` / repo has never been checked into actual git — it's
  just a plain folder structure zipped up each time.
- **Editing a multi-item visit is still per-line.** `EditAllocationPage`
  edits one `Allocation` record at a time (equipment type/unit still
  can't be changed there, same as before this session). If a patient's
  contact number needs correcting on a 3-item visit, right now that
  means opening Edit on each of the 3 rows separately — it works, just
  not efficient. Worth a "bulk edit whole visit" pass if this comes up
  in practice.
- **History page has no receipt buttons** (View/Share only exist on
  Active Loans). Wasn't asked for and the receipt is only really needed
  while the deposit is outstanding, but flagging in case a patient later
  wants a duplicate receipt for a fully-returned visit.

## How to resume

```bash
cd seva-trust-suite
npm install
npm run dev
```

Default login: `admin` / `admin123` — change or replace this from
Settings → Users, or use the new Settings → My Login page once signed in.
There is also a fixed super admin account (see part 7 below) not shown
anywhere in the UI's Users list.

Then `npm run build` to type-check + produce `dist/` when ready to ship.

### This session (part 7) — login page cleanup, unit removal, Donation rename, super admin + Activity Log
1. **Removed the on-screen default credentials.** `AuthGate.tsx` no longer
   shows "Default login is admin/admin123" under the sign-in form. The
   seeded `admin`/`admin123` account still exists underneath (needed so a
   fresh install isn't locked out) — this was purely a UI change, not a
   security change. If this account isn't wanted long-term, delete it or
   change its password from Settings → Users once signed in as the
   super admin (see part 7 below for why an admin alone can't do this).
2. **Remove a unit, not just add one.** Each *free* unit chip on the
   Dashboard now has a small "×" (new `.unit-chip-remove` button, styled
   in `tokens.css`). Engaged units can't be removed — same guard pattern
   as "can't delete a type while units are engaged" — clicking one shows
   a toast explaining why instead. Removing a unit doesn't touch its past
   loan history (allocations reference the unit by id, not by living in
   the type's unit list, so old records still resolve their equipment
   name/label correctly even after the unit itself is gone).
3. **"Finance" renamed to "Donation" throughout the UI** — sidebar label
   and tag (`FI` → `DN`), the Overview page heading, and the "Admins
   only" gate messages in `App.tsx`. Left the internal code as-is
   (`FinanceEntry`, `useFinanceData()`, `/finance` routes, `finance/`
   folder name) since renaming those is a pure refactor with no user-
   facing effect and higher risk of breaking an import somewhere for no
   visible benefit — worth doing later in a dedicated pass if it ever
   causes confusion for whoever maintains this code next.
4. **Login page now has a full illustration**, not a plain background
   color. New `public/login-art.svg` — an original flat-design vector
   (not a stock photo, so zero copyright risk) in the Trust's blue
   palette: a wheelchair, two simple figures, and a heart passing between
   them, with "Show Humanity Trust" captioned underneath. `AuthGate.tsx`
   and `tokens.css`'s login-screen rules were restructured into a
   two-column layout (illustration panel + card) on desktop, collapsing
   to just the card on narrow/mobile viewports where the art would only
   get in the way.
5. **Super admin account** — a new `superadmin` role
   (`shared/lib/auth.ts`), seeded automatically as `amish_251` /
   `Amish@2003` the moment the app first loads (via a broadened
   `ensureSeedUsers()` — renamed from `ensureDefaultAdmin()` — that now
   checks unconditionally for a super admin, not just "if there are zero
   users yet", so it also gets re-seeded after restoring an old backup
   that predates this feature). Two enforcement points, both load-bearing:
   - `listVisibleUsers()` (new) filters out any `role === 'superadmin'`
     row — `UsersPage.tsx` now calls this instead of the old `listUsers()`
     (which still exists, unfiltered, for internal checks like username-
     uniqueness). The super admin is invisible in the Users table to
     every other account, including other admins.
   - `deleteUser()` in `auth.ts` now refuses to delete any account with
     `role === 'superadmin'`, returning `{ ok: false, error }` instead of
     silently doing it — regardless of who's asking. Combined with #1,
     no admin can even find the row to try, but the guard exists at the
     data layer too, not just the UI layer.
   The super admin sees everything a regular admin sees (Dashboard,
   Donation, Users, Backup) plus one thing nobody else can reach:
6. **Activity Log, super-admin-only.** New `shared/lib/activityLog.ts` —
   a simple append-only log (`logActivity(action, details)`, capped at
   1000 entries, tagged with whoever's signed in via `getSession()`) and
   a matching `/settings/log` route + `LogPage.tsx` (search, "Clear log").
   Gated by a new `SuperAdminOnly` wrapper (sibling to the existing
   `AdminOnly`) — checked at the *route* level in `App.tsx`, not just
   hidden from the sidebar, so typing the URL doesn't get around it
   (verified this directly: logged in as a regular admin, navigated to
   `/settings/log` by URL, got the "Super admin only" panel). `logActivity()`
   calls are wired into every meaningful mutation across the app: sign
   in/out, add/remove equipment type, add/remove unit, issue equipment,
   mark returned, edit/delete a loan record, add/delete a donation or
   expense, add/remove a user, and backup export/restore.
7. **Broadened admin-level access checks to treat `superadmin` as a
   superset of `admin`**, not a separate track — `AdminOnly.tsx`,
   `Sidebar.tsx`'s `isAdmin` flag, `App.tsx`'s `HomeRedirect` /
   `SettingsIndexRedirect`, `BackupPage.tsx`, and `UsersPage.tsx`'s inline
   role check all now read `role === 'admin' || role === 'superadmin'`
   instead of just `role === 'admin'`. Without this the super admin
   would've been *more* locked out than a regular admin, which is
   backwards.

Verified all of the above with real headless-browser runs across three
separate logins (regular admin, staff, and the super admin) — not just a
clean build. Specifically checked: the login page renders the new
illustration with no credentials hint visible; unit removal actually
drops the unit and updates the counts; the super admin's Users page
shows `admin` but not `amish_251`; a regular admin's sidebar has no
Activity Log entry at all; a regular admin hitting `/settings/log`
directly by URL gets blocked; and the Activity Log itself, viewed as the
super admin, correctly shows actions taken by the `admin` account
(sign in/out, add equipment type, add donation) with accurate
timestamps, usernames, roles, and human-readable details.

## Known limitations / open items (carried over + new)

- Everything listed in earlier parts of this file still applies (client-
  side-only security, no cross-device sync, low-res source logo, no git
  history, per-line editing of multi-item visits, no receipt buttons on
  the History page, donation receipt numbers can shift if an earlier
  donation is deleted, no tax-exemption claim on donation receipts,
  expenses don't get a printed voucher).
- **The Activity Log has no pagination or date filtering** — just a text
  search box and a hard 1000-entry cap (oldest entries silently drop off
  once exceeded). Fine for how much a small trust logs day-to-day; worth
  revisiting if it ever fills up faster than expected.
- **The super admin's own password can be changed from Settings → My
  Login** (that page has no role restriction, by design, so nobody gets
  locked out of their own account) — meaning the super admin isn't
  "un-editable", just un-deletable and invisible to others. That's a
  deliberate choice: the login itself (`amish_251` / `Amish@2003`) is a
  fixed secret shared outside the app; the account it protects shouldn't
  be permanently frozen if that password ever needs rotating.
- **Backup restore can silently reintroduce an old, weaker password** for
  the super admin if restoring a very old backup — expected behavior for
  a "full state restore" tool, just worth knowing: after restoring,
  double-check Settings → My Login still has the password you expect.
- **`FinanceEntry`/`useFinanceData`/the `/finance` URL and folder name
  still say "finance" internally** even though the UI now says
  "Donation" everywhere a person sees it — see point 3 above.
- **The login illustration is a simple flat-design SVG I made from
  scratch**, not commissioned art — good enough to not look like a bare
  color field, but if the Trust wants something more polished/on-brand
  later, swapping `public/login-art.svg` for a designed asset is a
  one-file change (`AuthGate.tsx` just points an `<img>` at it).

### This session (part 6) — receipt formatting, donation receipts, staff role limits
1. **Deposit receipt redesigned.** `receipt.ts` now has a shared `Receipt`
   class (outer bordered card, logo + Trust name header, a receipt-number
   / date strip, a `row()` helper for label/value lines, a shaded
   section-bar helper, and a signature block helper) so both receipt
   types share one look instead of hand-placing text twice. The equipment
   deposit receipt now has: a proper bordered item table with a header
   row, a receipt number (`SHT/EQ/<last 6 of the group id>`), and the
   total spelled out in words under the figure (new
   `shared/lib/numberWords.ts` — Indian lakh/crore numbering, e.g.
   "Rupees One Lakh Fifty Thousand Only") in addition to the existing
   itemized list + signature.
2. **Donation receipts, from scratch.** New `buildDonationReceiptPdf()`
   in `receipt.ts` — same bordered shell, plus a highlighted amount box
   (figures + words), payment mode, purpose/category, and "received by".
   No tax-exemption language is printed — the Trust's 80G status isn't
   tracked anywhere in this app, so claiming one would be guessing.
   `FinanceEntry` gained `partyPhone`, `paymentMode`, and `receivedBy`
   fields (`types.ts`) to have enough on record for a receipt worth
   handing to a donor. `AddEntryPage.tsx` now asks for all three
   (`receivedBy` defaults to the signed-in user, same pattern as the
   deposit-received-by field in Issue Equipment). New
   `features/finance/helpers.ts` → `donationReceiptNumber()` assigns a
   stable `SHT/DON/0001`-style number based on creation order among
   donations (only shifts if an earlier donation is deleted — no
   separate counter to maintain). `RecordsPage.tsx` gained the same
   View/Share receipt buttons (and `PdfPreviewModal`) that Active Loans
   already had, shown only on donation rows — expenses don't get a
   receipt, since nothing is "received" on those.
3. **Staff accounts locked down to exactly: Issue Equipment, Active
   Loans, Full History.** Two layers, both changed:
   - `Sidebar.tsx` — `NavItem` can now carry `adminOnly` at the
     top level (Finance is hidden entirely for staff), and the Dashboard
     child under Equipment Register is now `adminOnly` too (staff never
     sees "Add equipment type" in the nav).
   - `App.tsx` — new `<AdminOnly>` wrapper (`shared/components/AdminOnly.tsx`)
     around the *routes* for Dashboard and all three Finance pages, not
     just the sidebar links — so a staff account typing the URL directly
     still hits an "Admins only" panel instead of the real page. Verified
     this with Playwright, not just by reading the code: created a staff
     login, confirmed the sidebar only shows Equipment Register (Issue/
     Active/History) and Settings → My Login, then navigated straight to
     `/equipment-register` and `/finance` by URL and confirmed both are
     blocked with the explanatory panel. The root `/` redirect also now
     depends on role — staff land on Issue Equipment, admins still land
     on the Dashboard — via a new `HomeRedirect` component (same pattern
     as the existing `SettingsIndexRedirect`).
4. **Backup & Restore** — this turned out to already exist in full
   (`features/settings/pages/BackupPage.tsx`, wired into `App.tsx` and
   `Sidebar.tsx`, admin-only) from an earlier session that predates this
   handoff file. Nothing to build here; verified it end-to-end this
   round anyway — downloaded a real backup file via Playwright and
   confirmed it contains the expected `seva:auth`/`seva:session` (and,
   with data present, equipment/finance) keys as one JSON file.

Verified everything above with real headless-browser runs, not just a
clean build: generated both receipt PDFs for real (not just screenshots
of the preview modal — pulled the actual blob bytes and rendered them
with `pdftoppm` to inspect the finished layout), and exercised the staff
role restrictions as a genuinely separate login rather than reasoning
about the code in the abstract.

## Known limitations / open items (carried over + new)

- Everything listed in earlier parts of this file still applies
  (client-side-only security, no cross-device sync, low-res source logo,
  no git history, per-line editing of multi-item visits, no receipt
  buttons on the History page).
- **Donation receipt numbers can shift if an earlier donation is
  deleted** (since the number is derived from sort order, not stored).
  Fine for how this app is used today; if that becomes a problem, store
  the receipt number on the `FinanceEntry` at creation time instead of
  deriving it.
- **No tax-exemption / 80G claim on donation receipts, on purpose** — if
  the Trust does have 80G registration and wants that referenced on the
  receipt, that's a real piece of information to add deliberately (a
  registration number, typically), not something to infer.
- **Expenses don't get a printed voucher/receipt** — only donations do.
  If expense vouchers (e.g. "paid to X for transport") become useful,
  `buildDonationReceiptPdf`'s shell is generic enough to adapt quickly.
- **Role model is still just `admin` / `staff`**, two fixed levels — if
  a third tier shows up later (e.g. a "view-only" auditor role), the
  `AdminOnly` component and the `adminOnly` flags in `Sidebar.tsx` would
  need to become a more general role-list check rather than a boolean.

### This session (part 8) — verified every handoff claim, redesigned the login page
1. **Verified every point in this handoff against the actual code, not
   just re-read the text.** Ran a full `npm install && npm run build`
   (clean, tsc + vite) and then grepped/read the source for each specific
   claim across all 7 earlier parts — super admin seeding in `auth.ts`,
   `SuperAdminOnly`/`AdminOnly` route wrappers in `App.tsx`, the Donation
   rename in `Sidebar.tsx`, `unit-chip-remove`, the `.btn` selector fix,
   `groupId`/`allocationsInGroup` for multi-item issuing,
   `PdfPreviewModal`, `depositReceivedBy`, `buildDonationReceiptPdf`,
   `numberWords.ts`, and the code-split `receipt-*.js` chunk in the build
   output. Everything claimed is genuinely there.
2. **Fixed the login page being scrollable.** `.login-screen` was
   `min-height: 100vh` with a flex two-column layout (illustration panel
   + card) that could grow taller than the viewport on some window
   sizes. Changed to `height: 100vh; overflow: hidden`, with the
   background as an absolutely-positioned `object-fit: cover` image
   instead of a flex sibling — verified with
   `document.documentElement.scrollHeight === clientHeight` (no
   scrollbar) at four different viewport sizes (1366×651, 1280×800,
   390×844, 1024×600), not just eyeballing one screenshot.
3. **Redesigned the login page to match a reference screenshot** (a
   glassmorphism card over a winter night scene). New
   `public/login-bg.svg` — an original full-bleed illustration I built
   (gradient purple night sky, moon with a glow, stars, layered
   mountains, snow-dusted pine trees, a cabin with lit windows and
   chimney smoke), not a stock photo, so no copyright risk. `AuthGate.tsx`
   and the login CSS in `tokens.css` were rewritten for a centered,
   blurred glass card (`backdrop-filter`), underline-style inputs (no
   boxes — just a bottom border, per the reference), and a white
   pill-shaped submit button. Old `public/login-art.svg` and the
   two-column layout it powered were removed since nothing references
   them anymore.
4. **"Remember Me" and "Forgot Password" are real, not decorative.**
   `login()` in `auth.ts` now takes a `remember` flag: checked (default)
   keeps storing the session in `localStorage` exactly as before;
   unchecked stores it in `sessionStorage` instead, so it clears as soon
   as the browser/tab closes — for a shared device where someone
   deliberately unchecks it. `getSession()`/`logout()` now check/clear
   both storages. "Forgot Password" shows a real toast pointing to
   Settings → Users (there's no self-service email/SMS reset possible
   without a backend) rather than being a dead link. Deliberately left
   out "Don't have an account? Register" from the reference — this app's
   accounts are admin-created, not self-registered, so a fake register
   link would be misleading; said so explicitly rather than silently
   adding a broken flow.
5. **Found and fixed a CSS specificity bug while building this**: the
   new `.login-submit` button rule and the app-wide `.btn` rule are both
   single-class selectors, and `.btn` happened to be defined later in
   the stylesheet — so the login button was rendering with the app's
   blue instead of the intended white pill, silently overridden by
   selector order rather than anything visibly wrong in the login-page
   rule itself. Fixed by qualifying the selector as
   `.login-card .login-submit` for higher specificity. Caught this by
   checking the actual computed `background-color` in a headless
   browser, not just glancing at a screenshot — the first screenshot
   taken looked wrong, the fix was verified by re-checking computed
   styles afterward, not assumed from the CSS diff alone.

Verified end-to-end with headless-Chrome, not just a build check: wrong
password shows the inline error; clicking Forgot Password shows the real
toast; unchecking Remember Me and logging in puts the session in
`sessionStorage` (confirmed via `page.evaluate` reading both storages
directly) instead of `localStorage`; logging in successfully lands on
the Dashboard as before. Screenshotted the login screen at four viewport
sizes to confirm no scrollbar and correct layout at each.

## Known limitations / open items (carried over + new)

- Everything listed in earlier parts of this file still applies.
- **The login background is a single flat SVG scene**, not adjustable —
  if the Trust wants their own art/photo here later, swapping
  `public/login-bg.svg` for another image is a one-file change (just
  update the `src` in `AuthGate.tsx`'s `<img className="login-bg">`).
- **"Remember Me" changes where the session is stored, not how long a
  session lasts** — there's still no absolute expiry on either storage;
  an unattended device with "Remember Me" checked stays signed in
  indefinitely, same as this app's behavior before this session. If
  session timeouts become a concern, that's a separate feature (e.g.
  storing a timestamp and checking it in `getSession()`).

### This session — responsive off-canvas sidebar + credits line

1. **Mobile sidebar rebuilt.** The old mobile layout squashed the
   sidebar into a horizontal scrolling strip at the top of the screen —
   cramped and easy to mis-tap. Replaced it with a standard off-canvas
   pattern: `AppShell.tsx` now renders a fixed `.mobile-header` (hamburger
   icon + logo) under 800px, holding `navOpen` state; `Sidebar.tsx` takes
   `open`/`onClose` props and slides in from the left
   (`transform: translateX(...)`, CSS transition) as a fixed panel over a
   dark backdrop. A ✕ close button sits at the top of the panel on
   mobile, and picking any nav link also closes it (`onClick={onClose}`
   on every `NavLink`) — plus `AppShell` closes it automatically on any
   route change via a `useEffect` on `location.pathname`, so it can't be
   left open by, say, the browser back button. Desktop (>800px) is
   untouched — same always-visible 220px sidebar as before, mobile
   header/backdrop are `display: none` outside the media query.
2. **Credits line added to the sidebar footer** (both desktop and
   mobile): "Created by Amish Patel" plus "for help & query" and a
   small circular call-icon button — an inline SVG phone icon, not text
   — with `href="tel:+917359354515"`. The number itself is never
   rendered as visible text, only as the `tel:` link target (present in
   the page source/`title` attribute, same as it would need to be for
   the link to work at all, but not shown on screen).

Verified with a clean `npm install && npm run build` — no type or build
errors. **Could not get a visual/headless-browser check this round** —
`playwright install chromium` failed because this session's network
sandbox blocks `deb.nodesource.com` (needed for its system
dependencies), so unlike the login-page session above, this one is
build-verified only, not screenshot-verified. The off-canvas CSS
pattern (fixed position + transform + backdrop + media query) is a
standard, low-risk approach, but flagging clearly that it hasn't been
visually confirmed — worth a real device/browser check before treating
this as fully done.

## Known limitations / open items (carried over + new)

- Everything listed in earlier parts of this file still applies.
- **This session's sidebar/hamburger change is unverified visually** —
  see note directly above. Check on an actual phone or a browser's
  device-emulation mode: does it slide in smoothly, does the backdrop
  close it on tap, does content behind it stay non-interactive/non-
  scrolling while open (no explicit `overflow: hidden` was added to
  `body` when the menu is open — worth adding if background scroll
  turns out to be an issue).
- **Multi-item issuing was pending as of the last HANDOFF note above,
  but has since been implemented** (in a session not reflected in this
  file's earlier text) — `Allocation` now has `groupId`,
  `IssuePage.tsx` supports multiple items in one issue transaction, and
  `buildDepositReceiptPdf()` already accepts an array and prints every
  item on one combined receipt with a total. Correcting the stale note
  from before rather than leaving it — this is done, not pending.

### This session — PDF receipts silently failing to generate (donation + deposit)

Reported during a local demo: clicking "View"/"Share" on either a
donation receipt or an equipment deposit receipt did nothing visible
after the "Preparing receipt…" toast — no PDF, no error.

**Root cause found and fixed:** in `receipt.ts`, `drawHeader()` calls
`doc.addImage(logo, ...)` to embed `/logo.png` in the PDF header. The
logo *fetch* right above it was already wrapped in a try/catch (falls
back to no logo if the fetch fails), but the `addImage()` call itself
was not — if jsPDF can't embed that specific image for any reason, the
exception was unhandled and silently killed PDF generation, for both
receipt types, since both share this exact header code. Wrapped
`addImage()` in its own try/catch so a logo failure degrades to
"receipt without a logo" instead of "no receipt at all."

**Verification done:** `npm run build` is clean. Also reproduced
`jsPDF.addImage()` directly against the actual `public/logo.png` file
in a standalone Node script — **it succeeded**, which means the logo
embed itself isn't confirmed as the actual failure in the person's
browser; it's the most plausible shared cause (identified from reading
the code, since both broken receipt types share this one code path)
and a legitimate defensive gap regardless, but not a confirmed
root-cause match. Could not test in a real browser this session —
`playwright install chromium` fails in this sandbox (blocked by the
network allowlist, same issue as an earlier session).

**Also added:** try/catch with a visible error toast
("Could not generate the receipt…") around all four receipt handlers
(`ActiveLoansPage` View/Share, `RecordsPage` View/Share) plus
`console.error(err)` logging the real exception. Previously a failure
here was completely silent — the person would see nothing happen at
all. Even if the logo fix above isn't the actual cause, the next
failure will now surface a real error message and a console stack
trace instead of nothing, which is what's needed to diagnose it for
certain.

**If it's still broken after this:** ask the person to open the
browser's dev console (F12 → Console tab) when it fails and share
whatever red error text appears there — that will point at the real
cause directly instead of more guessing. Also worth having them do a
hard refresh / clear site data once, in case an old service worker
from a previous `npm run build && npm run preview` session on the same
port is serving stale cached files (unlikely here since dev/preview
default to different ports — 5173 vs 4173 — but worth ruling out if
they've customized ports).

## Known limitations / open items (this session, new)

- **PDF receipt failure not fully root-caused** — see above. Fixed the
  most plausible shared cause and added error surfacing, but this
  needs the person to retest and report back (ideally with the actual
  console error) before calling it closed.

### This session (follow-up) — Edit added to Add New Equipment Type

Straightforward addition: `DashboardPage.tsx`'s "By Equipment Type"
list only had Add unit / Delete type per card — no way to edit an
existing type's name or deposit amount once created. Added an "Edit"
button that swaps the card into an inline form (same field-row/panel
style as the Add form above it), with Save/Cancel. Renaming a type
also updates its auto-generated unit labels (`"OldName #3"` →
`"NewName #3"`) so they stay in sync, but does **not** retroactively
change the deposit amount on allocations already issued under the old
amount — only affects new issues going forward, which is called out
in the field hint. Logged to the activity log same as the other
equipment-type actions. Verified with a clean `npm run build`.

### This session (follow-up 2) — Excel import/export + PDF export on the three "add new" pages

Added on Dashboard (Add New Equipment Type), Issue Equipment, and
Finance's Add Entry (donation/expense entries) — the three pages
matching the person's request:

1. **New reusable component**: `src/shared/components/ImportExportBar.tsx`.
   Renders "Import Excel" / "Export Excel" / "Export PDF" buttons.
   Clicking Import Excel expands a small panel with a file picker, an
   "Import" button, and a "Download sample file" button, as asked —
   one consistent UI reused on all three pages rather than three
   separate implementations.
2. **New shared helpers**: `src/shared/lib/tableExport.ts` —
   `exportRowsToExcel`/`downloadSampleExcel` (via the `xlsx` package),
   `parseExcelFile` (reads an uploaded file into row objects keyed by
   column header), `pickField` (case/whitespace-insensitive column
   lookup, so "Token Amount", "TokenAmount", "token amount" all match),
   and `exportRowsToPdf` (via `jspdf` + `jspdf-autotable`, landscape
   A4 table with the Trust's header styling).
3. **Dashboard**: Import creates equipment types in bulk (columns:
   Name, TokenAmount, Quantity). Export (Excel/PDF) lists every
   equipment type with unit/free/engaged counts.
4. **Issue Equipment**: Import bulk-creates issue records (columns:
   PatientName, Phone, EquipmentType, TokenAmount, IssueDate,
   ExpectedReturn, DepositGiven, ReceivedBy, Notes) — matches
   equipment by name, auto-assigns the first free unit, skips rows
   with no matching type/free unit. **Simplification worth knowing:**
   each imported row becomes its own single-item issue (its own
   `groupId`) — the multi-item-per-visit grouping (added a few
   sessions back) only applies to the manual form, not bulk import.
   Export lists all *currently active* issues (not full history).
5. **Finance Add Entry**: Import bulk-creates donation/expense entries
   (columns: Kind, Category, Amount, PartyName, PartyPhone, Date,
   PaymentMode, ReceivedBy, Notes — Kind defaults to "donation" if
   blank/unrecognized). Export lists every donation and expense ever
   recorded (not just what's on this page).
6. **Bundle size discipline maintained** — `xlsx` is a large library
   (~430 kB). Same pattern as the `jspdf`/receipt fix from an earlier
   session: every Excel/PDF function does `await import('xlsx')` /
   `await import('jspdf-autotable')` inside the function body, not a
   top-level import, so none of it loads until someone actually clicks
   Import/Export. Caught and fixed a first draft that imported `xlsx`
   statically and bloated the main chunk to 663 kB before fixing it —
   confirmed with `npm run build` that the main chunk is back to ~238 kB
   and the size warning is gone.

Verified with a clean `npm install && npm run build` — no type errors,
no build errors, no size warnings. **Not tested in a real browser**
(same sandbox limitation noted in earlier sessions — no headless
browser available here) — the Excel round-trip (export a file, then
re-import it) and the PDF table layout are the two things most worth
a real check before fully trusting this.

## Known limitations / open items (this session, new)

- **Excel import/export and PDF export are build-verified only, not
  browser-tested.** Worth specifically checking: does a file exported
  from the app re-import cleanly (round-trip), do the PDF tables read
  well when there are many columns/rows (Issue Equipment's export has
  8 columns — may be tight on a phone-sized PDF viewer, though the
  page itself is landscape A4 sized so should be fine on a laptop/
  print), and does the sample-file format genuinely match what real
  Trust staff would find intuitive to fill in.
- **Bulk-imported issue records don't support multiple items per visit**
  — see point 4 above. If that turns out to matter in practice, the
  Excel column format would need a batch/group identifier column.

### This session (follow-up) — renamed the app to CareTrack

The person didn't want "Seva Trust Suite" as the name. Went with
**"CareTrack"** (full form "CareTrack — Show Humanity Trust" where
there's room, just "CareTrack" where space is tight — sidebar, mobile
header, PWA short name). Renamed everywhere it appeared:

- Login screen (now shows "CareTrack" / "Show Humanity Trust — sign in
  to continue" instead of a bare "Login")
- Sidebar brand, mobile header brand
- Browser tab title (`index.html`)
- PWA manifest `name`/`short_name`/`description` (`vite.config.ts`)
- Backup file naming (`caretrack-backup-<date>.json`) and the
  "is this a CareTrack backup?" error message
- PDF receipt header subtitle ("CareTrack — Equipment & Donation
  Records")
- `package.json` name (`caretrack`), README title
- **The project folder itself** was renamed from `seva-trust-suite/`
  to `caretrack/` — so this zip's top-level folder is now `caretrack/`,
  not `seva-trust-suite/`. Worth knowing if any external notes/scripts
  reference the old folder path.

Ran a full confirm-everything-still-works pass: `npm install` hit a
transient stale-cache 404 on an unrelated transitive dependency
(`electron-to-chromium`, pulled in via browserslist/autoprefixer) —
not caused by anything in this session's changes, resolved by clearing
the npm cache and reinstalling. `package-lock.json` was regenerated
fresh as part of that. `npm run build` is clean after the rename, same
chunk sizes as before (renaming didn't touch any of the code-splitting
work from earlier sessions).

Grepped the whole codebase afterward for any leftover
"Seva Trust Suite" / "seva-trust-suite" text — none found outside
`package-lock.json`'s own internal package-name field, which isn't
user-facing and regenerates automatically.


### This session — Supabase + Vercel migration (localStorage → real shared database)

The person wants this live for 10-15 real users across different
devices. `localStorage` can't do that (invisible across devices, lost
on browser clear, and the old auth was client-side unsalted SHA-256 —
never safe on the open internet). This session replaced the entire
storage and auth layer with Supabase, while deliberately preserving the
external shape of `storage.ts` (`loadNamespaced`/`saveNamespaced`,
`[data, update]` hook contract) so the actual feature pages — Dashboard,
Issue Equipment, Active Loans, History, Donations — needed almost no
changes. Full step-by-step deployment runbook is in the new
**`DEPLOYMENT_PLAN.md`** at the repo root; this entry is the "what and
why" for whoever picks up the code next.

**New files:**
- `supabase/schema.sql` — the whole database: `profiles` (username/role,
  RLS hides the super admin's row from everyone but themselves — the
  actual enforcement, not just a UI filter), `app_data` (one JSON row
  each for `equipment-register` and `finance`, RLS matching the app's
  existing staff-vs-admin access rules), `activity_log` as a **real
  table**, not a JSON blob (see rationale below), Realtime enabled on
  `app_data`. Idempotent — safe to re-run.
- `supabase/functions/manage-user/index.ts` — Edge Function for
  create/delete/reset-password on user logins. Has to exist server-side
  because those operations need Supabase's service-role key, which must
  never reach the browser. Checks the caller is admin/superadmin (via
  their own JWT) before doing anything, and independently re-checks
  "can't delete a superadmin" server-side even though RLS already hides
  that row client-side — defense in depth, not redundant.
- `src/shared/lib/supabaseClient.ts` — the one shared connection. Throws
  a clear, actionable error at runtime if `VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY` aren't set (verified this fires correctly,
  not just written and assumed). Includes a custom storage adapter
  (`dualStorage`) so the existing "Remember Me" checkbox UX still works
  on top of Supabase's session storage — a flag set right before
  `signInWithPassword` decides whether the session token lands in
  `localStorage` (survives closing the tab) or `sessionStorage`
  (doesn't).
- `.env.example`, `vercel.json` (SPA rewrites + no-cache on
  `index.html` so deploys roll out immediately), `src/vite-env.d.ts`
  (was missing — `import.meta.env` typing needs this; the build
  actually failed on `ImportMeta.env` not existing until this was
  added, so this wasn't a hypothetical gap).

**Rewritten files:**
- `src/shared/lib/auth.ts` — was hand-rolled (SHA-256, `localStorage`
  user list). Now real Supabase Auth. Usernames map to
  `${username}@caretrack.internal` (Supabase Auth is email-based; this
  keeps the app's plain-username login UX). Kept a small
  module-level `cachedSession` populated by a new `initAuth()` (called
  once by `AuthGate` on mount) so `getSession()` can stay a *synchronous*
  read for callers like `activityLog.ts` and `storage.ts` that don't
  want to await a network round trip just to know who's signed in —
  deliberately did **not** add a background `onAuthStateChange`
  listener on top of this (documented in the file: this app's session
  only changes on explicit login/logout, both of which already update
  the cache directly, so a listener would add complexity without
  fixing a real gap).
  `listVisibleUsers` is now just an alias for `listUsers()` — RLS on
  `profiles` does the superadmin-hiding now, so there's no separate
  "visible vs all" query to maintain client-side anymore (this is
  slightly *more* correct than before: it's enforced at the database).
  Added `resetUserPassword()` (new capability — the login page's
  existing "ask your Trust admin to reset your password" copy wasn't
  actually backed by anything before this).
- `src/shared/lib/storage.ts` — `loadNamespaced`/`saveNamespaced` are
  now `async` and hit Supabase's `app_data` table instead of
  `localStorage`, same function signatures otherwise. New
  `useNamespacedData<T>(namespace, empty)` generic hook replaces what
  used to be duplicated per-module logic in each feature's `store.ts`
  — loads once on mount, subscribes to Realtime changes on that row,
  and `update()` applies changes to a `ref` + local state immediately
  (so a page that calls `update()` then immediately navigates away,
  like Issue Equipment redirecting to Active Loans, is safe — the
  write is in flight against a ref, not trapped in a state updater an
  unmount could abandon) while saving in the background. Save failures
  are currently only `console.error`'d, not surfaced in the UI — see
  "Known limitations" in `DEPLOYMENT_PLAN.md`.
- `src/features/equipment-register/store.ts` and
  `src/features/finance/store.ts` — both collapsed to ~10-line thin
  wrappers around `useNamespacedData`. All the actual CRUD logic that
  used to live in each of these now lives once, generically, in
  `storage.ts`.
- `src/shared/lib/activityLog.ts` — was a JSON array in one
  `localStorage` key. Deliberately **not** kept as a JSON blob in
  `app_data` like the other two modules — a log is fundamentally
  "append rows," and appending to a JSON array requires reading the
  current array first, which would force every writer (everyone) to
  also have read access, defeating "only the super admin can read
  this." So `activity_log` is a real table instead: `INSERT` is open
  to any authenticated user, `SELECT`/`DELETE` are superadmin-only via
  RLS, no read-before-write needed for a normal log entry.
- `src/shared/components/AuthGate.tsx` — swapped `ensureSeedUsers()`
  (which used to auto-create a default admin on first load — worked
  fine for a local-only demo, wrong for a real shared backend where
  "first load" happens on every new device, not once ever) for
  `initAuth()`. **Behavior change worth flagging clearly**: the app no
  longer creates any account automatically. The first admin and the
  fixed super admin (`amish_251`) now have to be created once, manually,
  in the Supabase dashboard — full copy-paste steps in
  `DEPLOYMENT_PLAN.md` Part 5. Every login *after* those first two is
  still created normally, from inside the app (Settings → Users).
- `src/features/settings/pages/UsersPage.tsx` — `listUsers`/`deleteUser`
  are now `async` (were sync before), call sites updated to `await`.
  Added a "Reset password" action/button per user, wired to the new
  `resetUserPassword()`.
- `src/features/settings/pages/LogPage.tsx` — `listActivity`/
  `clearActivity` are now `async`; the page's initial `useState(() =>
  listActivity())` (which assumed a synchronous return) is now a
  proper `useEffect` + loading state.
- `src/features/settings/pages/BackupPage.tsx` — full rewrite. Export
  now pulls a fresh snapshot straight from Supabase instead of reading
  `localStorage`; restore now `saveNamespaced()`s into Supabase instead
  of writing `localStorage` keys directly. The old "About this data —
  moving to a real database" explainer panel (which was written when
  that move was still a future recommendation) is replaced with one
  explaining what's actually true now: data is shared and live,
  Supabase takes its own automatic backups, and this page's export is
  a convenience extra, not the primary safety net anymore.
- `package.json` — added `@supabase/supabase-js`.

**Explicitly not changed:** `ProfilePage.tsx` needed zero changes — it
already called `await verifyPassword(...)` / `await changePassword(...)`
from a previous session, so the underlying functions becoming
Supabase-backed instead of localStorage-backed was invisible to it.
Same for every equipment-register/finance *page* component (Dashboard,
Issue Equipment, Active Loans, History, Donations' Overview/Add
Entry/Records) — none of them call `storage.ts` directly, only through
`useEquipmentData()`/`useFinanceData()`, so keeping those hooks'
external shape identical meant the migration's blast radius stayed
almost entirely inside `shared/lib/`.

**Verification this session:** `npm install` + `npm run build` clean,
no type errors (one real bug caught and fixed in the process — a
missing `src/vite-env.d.ts`, without which `import.meta.env` doesn't
type-check at all; this wasn't a pre-existing gap, it only started
mattering once `supabaseClient.ts` started reading `import.meta.env`).
Grepped for every removed/renamed symbol
(`loadEquipmentData`/`ensureSeedUsers`/`passwordHash`/etc.) across the
whole `src/` tree to confirm no stale references were left behind.
Also ran the built app in a headless browser twice: once with **no**
env vars set, to confirm the intentional startup error fires with its
actual intended message instead of some unrelated crash; once with
placeholder (fake but present) env vars, to confirm the app renders
its full login screen and fails *gracefully* against an unreachable
backend (a 403 on the fake Supabase URL, no uncaught JS errors) rather
than a blank page. **What this verification does not cover**: nothing
has run against a real Supabase project — no real login, no real data
read/write, no real Realtime sync between two clients, no real Edge
Function invocation. That's the literal next step, laid out as Parts
1-8 in `DEPLOYMENT_PLAN.md`.

## Known limitations / open items (this session, new)

- **RLS on `app_data` is per-row (per-module), not per-field.** Staff
  can technically write anywhere inside the `equipment-register` JSON
  blob via a direct API call, even though the app's own UI only lets
  them issue/return equipment, not add/delete types. Documented in
  detail, with the fix (normalize into real tables), in
  `DEPLOYMENT_PLAN.md`'s "Known limitations" and "Suggested Phase 2"
  sections.
- **Concurrent-edit races are reduced (via Realtime), not eliminated**
  — same root cause as above: whole-blob overwrites, not per-row
  updates. Low probability for a small team, but real. Also detailed
  in `DEPLOYMENT_PLAN.md`.
- **Background save failures in `useNamespacedData`'s `update()` are
  only logged to the console**, not surfaced to the person as a toast
  or retried. If this turns out to matter in practice (patchy
  connectivity in the field, say), worth wiring `update()` to accept
  an optional error callback, or having pages that call it check for
  a rejected promise.
- **This migration is code-complete but has never touched a real
  Supabase project.** Everything above about "verified" is build- and
  headless-browser-level, not a real end-to-end data-layer test. Doing
  Parts 1-6 of `DEPLOYMENT_PLAN.md` and then genuinely clicking around
  (add equipment, issue something, add a donation, add a staff login,
  check the activity log as superadmin) is the real remaining
  verification step, and it needs actual Supabase/Vercel accounts this
  sandbox doesn't have.

### This session — 6 fixes/features on the live app, no database/schema changes

All changes are frontend-only (React/TypeScript code) — nothing in
`supabase/schema.sql` changed, so this update is a pure code deploy with
zero risk to existing live data. See "How to deploy this update" below.

1. **"free" → "Available" wording on Issue Equipment.** Changed the two
   spots in `IssuePage.tsx` where unit counts show next to equipment
   names in the dropdowns (`{n} free` → `{n} available`, and "No free
   units" → "No units available"), plus the matching validation toast.
   Scoped narrowly to Issue Equipment only, per the request — left
   Dashboard's "Currently Free" stat card and unit-chip wording alone
   since those weren't mentioned and changing wording elsewhere risked
   inconsistency with no benefit.

2. **Search + filter on Active Loans.** `ActiveLoansPage.tsx` gained the
   same toolbar pattern History already had: free-text search (matches
   patient name, phone, equipment type, and unit label) plus an
   equipment-type filter and a deposit-status filter (Received/Pending).
   Empty state now distinguishes "nothing out right now" from "no
   matches for this search/filter."

3. **New "Token Overview" tab** under Equipment Register (admin-only,
   same access level as Donation) — `TokenOverviewPage.tsx`, new route
   `/equipment-register/tokens`, new sidebar entry. Three summary
   numbers: **Currently Held** (deposit collected, equipment still on
   loan), **Pending Collection** (equipment issued, deposit not yet
   taken), **Returned** (equipment came back, deposit given back to the
   patient) — plus a recent-activity table. Worth knowing: "Returned"
   only counts allocations where `depositGiven` was `true` at some
   point; there's no explicit "deposit refunded" event tracked
   separately from "equipment marked returned," so this treats every
   returned-with-deposit-collected record as refunded. If the Trust
   ever keeps a deposit instead of refunding it (damage, etc.), that
   distinction isn't captured anywhere yet — flagging this as a
   modeling gap, not a bug.

4. **Dashboard now shows Token + Donation totals at a glance.**
   `DashboardPage.tsx` now also reads `useFinanceData()` (safe — this
   whole page is already wrapped in `<AdminOnly>` in `App.tsx`, so no
   staff session ever renders it) and shows a compact 4-card row (Token
   Held, Token Pending, Total Donations, Donation Balance) with links
   through to the full Token Overview and Donation Overview pages,
   sitting between the existing unit-count cards and the "Add new
   equipment type" panel.

5. **Receipt View/Share on Full History, including returned records.**
   `HistoryPage.tsx` gained the same `handleViewReceipt`/
   `handleSendReceipt`/`PdfPreviewModal` setup Active Loans already had
   — shown on any row (active or returned) where a deposit was actually
   collected. Previously the only way to see a receipt again after
   equipment was returned was to have saved the PDF at issue time.

6. **Fixed the real bug behind "editing a record doesn't show up on its
   receipt — but only for one record."** Root cause, confirmed by
   reading the code rather than guessing: `buildDepositReceiptPdf()`
   built the receipt's header (patient name, phone, issue date,
   "received by") from `allocations[0]` of the multi-item group, where
   that array is sorted by database id — **not** from the specific
   allocation the person actually clicked "View"/"Edit" on. For a
   single-item issue this is invisible (there's only one record, so
   "the group's first item" and "the record you're looking at" are
   always the same thing) — which is exactly why it only showed up on
   one record and looked fine everywhere else. For a multi-item visit
   (2+ pieces of equipment issued together), editing the *second* line
   item's patient name updated that allocation correctly in the
   database, but its receipt kept showing the *first* line item's
   (unedited) name, because the header always read from whichever
   allocation happened to sort first, not from the one that was edited.
   **Fix**: `buildDepositReceiptPdf()`'s signature changed from
   `(allocations, data)` to `(primary, group, data)` — `primary` is
   now explicitly the exact allocation the person clicked from, driving
   every header field; `group` still drives the itemized table and
   total, unchanged. All four call sites (`ActiveLoansPage.tsx` ×2,
   `HistoryPage.tsx` ×2) updated to pass the specific `allocation` as
   `primary`. Grepped the whole codebase afterward to confirm no call
   site was still using the old 2-argument form — and since this
   project builds with `strict: true`, a stale 2-arg call would have
   been a compile error anyway, not just a missed grep hit.

**Verification this session:** `npm run build` clean, no TypeScript
errors (`tsc -b --noEmit` also run explicitly as a second pass). **Not
tested against a live Supabase project or in a real browser** — this
sandbox has no credentials for the actual deployed project, so nothing
here has been clicked through for real. The fix for #6 in particular is
verified by *reading* the exact mechanism of the bug and confirming the
data flow after the fix is correct (every header field now reads from
the clicked-on record, not a sorted array's first element) — not by
reproducing the bug live and watching it disappear. Recommend
specifically re-testing #6 with a real multi-item issue once deployed:
issue 2+ items to one patient in one visit, edit the second item's name
from Active Loans, then view that second item's receipt and confirm the
new name appears.

## How to deploy this update (code only — data is untouched)

This matters because it surprises people the first time: **your Trust's
actual data (equipment, loans, donations) lives entirely in Supabase,
completely separate from this code.** Pushing new frontend code to
GitHub → Vercel redeploys the *app*, not the *database*. Nothing in this
session touched `supabase/schema.sql`, so there is no SQL to re-run and
no risk to existing records — a code deploy and a data change are two
completely independent things in this architecture.

1. Replace the contents of your local `caretrack` folder with this
   updated version (unzip over the top, or copy files in).
2. Open a terminal in that folder and run:
   ```bash
   git add .
   git commit -m "Add token overview, active-loan search, history receipts, fix receipt bug"
   git push
   ```
3. That's it — Vercel is already connected to this GitHub repo from the
   original deploy, so it picks up the push automatically and rebuilds
   within about a minute. No dashboard clicks needed, no environment
   variables to touch, no Supabase steps.
4. Once Vercel shows the new deployment as "Ready," refresh the live
   site (a hard refresh — Ctrl+Shift+R / Cmd+Shift+R — avoids seeing a
   cached old version) and confirm the new Token Overview tab and
   Active Loans search box are there.

If `git push` asks for credentials again, same as before: use a GitHub
Personal Access Token as the password, generated fresh (Settings →
Developer settings → Personal access tokens), never pasted anywhere
except directly into the terminal prompt when asked.

### This session — two new account ledgers: Ambaji Account & SEOC Account

**This one needs a database step, not just a code deploy — see below
before pushing.**

Added two new top-level modules, each its own credit/debit
(income/expense) bookkeeping ledger, deliberately built as one generic
implementation instantiated twice rather than two separate copies of
the same code:

- `src/features/accounts/types.ts` — `AccountEntry` (kind: 'credit' |
  'debit', category, amount, party, date, payment mode, handledBy,
  notes), generic credit/debit categories.
- `src/features/accounts/config.ts` — the *only* place the two
  accounts actually differ: `ACCOUNTS.ambaji` and `ACCOUNTS.seoc`, each
  with its own Supabase namespace, route slug, and display title.
- `src/features/accounts/store.ts` — `useAccountData(namespace)`,
  thin wrapper over the existing `useNamespacedData`.
- `src/features/accounts/components/{AccountOverview,AccountAddEntry,
  AccountRecords}.tsx` — the actual generic pages, each taking a
  `config` prop. This is what makes "both pages look the same" literal
  — Ambaji and SEOC render the exact same component tree, styled
  identically, differing only in which data namespace they read/write.
- `src/features/accounts/{ambaji,seoc}/{OverviewPage,AddEntryPage,
  RecordsPage}.tsx` — six tiny wrapper files (three per account) that
  just plug the right config into the generic components, so
  `App.tsx`'s routing style (one component per route, no route-level
  props) didn't need to change.
- Add Entry for both accounts has the same Excel import/export bar as
  Donation's Add Entry (bulk-add via spreadsheet, sample-file
  download, Excel/PDF export of the full ledger) — consistent with
  the rest of the app's "add new X" pages. **Deliberately left out:**
  PDF receipts / WhatsApp sharing (like Donation has) — wasn't asked
  for here, and would have meant designing what a "credit receipt"
  even means for a generic ledger entry. Easy to add later using
  `receipt.ts`'s existing pattern if wanted.

**Isolation, as asked ("its dashboard to its respective page not in
other page"):** Ambaji's Overview only ever reads the `ambaji-account`
namespace, SEOC's only ever reads `seoc-account` — there is no shared
"all accounts" view anywhere, and neither was added to the Equipment
Dashboard's existing Token/Donation summary cards. Each is its own
isolated ledger, full stop.

**Access level:** gated `AdminOnly` in `App.tsx`, same as Donation —
treated as sensitive accountancy data, matching the existing pattern
rather than introducing a new access tier. Both also got their own
sidebar entries (Overview/Add Entry/All Records sub-tabs, `AM`/`SO`
tags), positioned right after Donation.

**⚠️ Required database step before this works live:** each namespace
needs its own RLS policies — Supabase denies reads/writes to a
namespace with no matching policy, so without this step the two new
pages would just show empty/broken data once deployed, not because of
a code bug. Added six new policies (`app_data_ambaji_*`,
`app_data_seoc_*`, admin/superadmin only, same shape as the existing
`app_data_finance_*` ones) plus two new seed rows to
`supabase/schema.sql`. **Before or right after deploying this code,
open Supabase → SQL Editor and either re-run the entire
`schema.sql` file (safe — every statement is guarded with
`IF NOT EXISTS`/`DROP POLICY IF EXISTS`/`ON CONFLICT DO NOTHING`, so
re-running it doesn't touch existing equipment/donation data) or just
run the new policy block and the updated seed `insert` statement on
their own.** This is the one part of this session's change that isn't
"just a `git push`" — flagging it clearly so it doesn't get missed.

**Verification this session:** `npm run build` clean, `tsc -b` clean.
**Not tested against a live Supabase project** (same sandbox
limitation as every session before this one — no real credentials
here). The real verification, once both the SQL step and the code
deploy are done: log in as an admin, open Ambaji Account, add a credit
and a debit, confirm the Overview totals match, confirm SEOC Account
still shows zero/unaffected, and confirm a staff-role login can't see
either in the sidebar or by typing the URL directly.

Main JS chunk grew to ~485 kB (gzip 135 kB) with six new pages added —
still under Vite's default 500 kB warning threshold, no size warning
printed, but noting the number here since it's noticeably higher than
the ~238 kB baseline from a few sessions back and closer to that
ceiling than is comfortable. Worth watching if more modules are added
the same way (one more sizeable feature could tip it over) — the fix
if it comes up is route-level code-splitting (`React.lazy` per page in
`App.tsx`), not something done yet since the app has never actually
hit the warning.

### This session (follow-up) — fixed a real bug in schema.sql itself

The person hit an actual SQL error re-running `schema.sql` in the
Supabase SQL Editor to add the Ambaji/SEOC policies above. Root cause
found: **the earlier claim that "every statement in this file is safe
to re-run" was wrong for one line.**

```sql
alter publication supabase_realtime add table public.app_data;
```

Unlike every other statement in the file, `ALTER PUBLICATION ... ADD
TABLE` has no `IF NOT EXISTS` equivalent in Postgres. Since the
person's Supabase project already had this run once during initial
setup, re-running the whole file threw:

```
ERROR: 42710: relation "app_data" is already member of publication "supabase_realtime"
```

Because the Supabase SQL Editor runs a pasted multi-statement script
as one transaction, an error on this near-the-end line most likely
rolled back everything earlier in that same run too — including the
new Ambaji/SEOC policies the person was actually trying to add. So the
fix isn't just "skip that line next time," it's "the whole script
needs re-running now that it's actually fixed."

**Fix applied:** wrapped that line in a existence check against
`pg_publication_tables` before running it:

```sql
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_data'
  ) then
    alter publication supabase_realtime add table public.app_data;
  end if;
end $$;
```

`schema.sql`'s opening comment ("safe to re-run") is now actually true
for the whole file, not just everything except this one line. Gave
the person the corrected file directly to paste and re-run.

**Lesson for future sessions touching `schema.sql`:** don't assume a
SQL statement is idempotent just because the surrounding ones are —
check each one specifically. `CREATE ... IF NOT EXISTS`, `DROP ... IF
EXISTS`, `CREATE OR REPLACE`, and `ON CONFLICT DO NOTHING` all have
that safety built in; plain `ALTER PUBLICATION`, among others, does
not.

### This session (follow-up 2) — PDF receipts + a custom "Other" category field, both scoped to Ambaji/SEOC only

Two asks, both scoped explicitly to the two account ledgers (not
Donation, which the person didn't mention this time):

1. **PDF receipts for credit entries.** Added
   `buildAccountReceiptPdf(entry, data, config)` to `receipt.ts` —
   same visual style as the existing donation receipt (logo header,
   amount in figures and words, signature block), but generic over
   `AccountConfig` so it works for either account. Each account gets
   its own receipt-number series (`SHT/AMB/0001…`, `SHT/SEOC/0001…`
   — see `accountReceiptNumber` in the new `accounts/helpers.ts`) so
   the two never collide or share a counter. **Only credit entries get
   a receipt** — debits (expenses) don't, matching exactly how the
   Donation module already only receipts `kind === 'donation'` and not
   `'expense'`. Wired into `AccountRecords.tsx` with the same
   View/Share-on-WhatsApp buttons and `PdfPreviewModal` the Donation
   records table already uses — visually and behaviorally identical
   pattern, just pointed at the new function.
2. **Custom text field when "Other" is selected.** Added
   `categoryNote: string` to `AccountEntry`. In `AccountAddEntry.tsx`,
   selecting "Other" in the category dropdown reveals a required
   "Please specify" text field immediately after it (and hides again,
   clearing itself, if the person picks a different category or
   switches Credit/Debit). That note is what actually gets shown
   everywhere "Other" would otherwise appear as a meaningless bare
   word: the Overview's recent-entries table, the Records table, the
   Excel/PDF ledger export, and the individual credit receipt PDF —
   all via one shared `categoryDisplay()` helper (`accounts/helpers.ts`)
   so there's exactly one place that formatting rule lives, not four
   copies of `category === 'Other' ? ... : ...`. Shows as
   `"Other — <what they typed>"`. Also added a `CategoryNote` column to
   the Excel import/sample-file format for bulk-adding entries with a
   custom "Other" category.

**Deliberately NOT touched:** the Donation module. The person's
request named "Ambaji and SEOC screen" specifically; Donation's
category dropdown also has an "Other" option today with no custom-note
field, which is now visibly inconsistent with the two newer modules.
Left as-is rather than assumed — worth asking the person directly
whether they want the same "Other" note field added to Donation for
consistency, since that would touch a module they didn't ask about
this time.

**Verification:** `npm run build` clean, `tsc -b` clean, main JS chunk
unchanged (~487 kB, still under the warning threshold — `receipt.ts`'s
new function added negligible weight since the whole file is already
one dynamically-imported chunk, separate from the `jspdf`/`xlsx`
chunks it pulls in on demand). **Not tested against a live Supabase
project or in a real browser** — same standing limitation as every
session before this one. Real verification once deployed: add a
credit entry to Ambaji Account with category "Other" and a note,
confirm the note shows correctly in Overview/Records/exported
Excel+PDF and on the generated receipt PDF; confirm a debit entry
never shows a receipt button regardless of category.

### This session — glassmorphism UI theme (CSS-only)

The request was a glassmorphism visual pass across the whole app with no
functional changes. **Exactly one file changed: `src/shared/styles/tokens.css`.**
Verified by diffing the delivered folder against the uploaded one — no
`.tsx`, no config, no Supabase files touched. Nothing to run in the
database; this is a pure code deploy.

**How the effect is built.** `body::before` paints a fixed, full-viewport
gradient mesh (blue / green / violet / amber blooms over a pale base).
Every surface above it — `.panel`, `.card`, `.page-head`, `.table-wrap`,
inputs, `.sidebar`, `.modal-card`, `.toast`, `.ie-tab`, `.empty`,
`.check-row`, `.dropzone`, `.unit-chip` — is semi-transparent with
`backdrop-filter: blur() saturate()`, so that mesh diffuses through.
Glass primitives live as CSS variables at the top of the file
(`--glass-bg`, `--glass-bg-strong`, `--glass-bg-soft`, `--glass-border`,
`--glass-blur`, `--glass-blur-sm`) so the whole theme can be retuned from
one place rather than hunting through rules.

**The one rule to remember when editing this file later:** surfaces must
stay translucent. Giving any of the elements above a solid `background`
switches the glass off for that element and it'll look flat and out of
place against its neighbours. Two elements are opaque *on purpose* and
should stay that way — `.modal-pdf-frame` (the embedded receipt PDF is
content, not chrome, and must stay fully legible) and the
`prefers-reduced-transparency` fallback block at the bottom.

**Preserved exactly.** Every one of the 204 selectors from the previous
theme still exists — checked programmatically, zero dropped — and all 8
CSS custom properties referenced from inline `style={{}}` props in the
components still resolve (`--sage-deep`, `--marigold-deep`,
`--primary-deep`, `--slate`, `--rust`, `--ink`, `--ink-soft`,
`--primary`). Four selectors were *added*, all additive: `body::before`
(the gradient mesh), `.panel.table-wrap` (stops a panel-wrapped table
double-stacking two glass layers, which read as a muddy grey box), and
hover states for the two login inputs.

**Accessibility fallbacks added.** A `prefers-reduced-transparency:
reduce` block returns every glass surface to solid white with the old
borders — iOS/macOS expose this as a real user setting, and heavy blur
genuinely hurts legibility for some people. A `prefers-reduced-motion`
block drops the hover lift transforms.

**Verification.** `npm run build` clean. Visually checked by screenshot
at three viewports: the real login page (1400px), and a static harness
page (`dist/__preview.html`, deleted before packaging) built from the
compiled CSS plus markup copied out of the real components, at desktop
1440px, scrolled desktop, and mobile 390px. The harness exists because
every page behind the login needs a live Supabase session this sandbox
doesn't have — so the *inner* app screenshots are of faithful
reproduction markup, not the running app. Worth a click-through after
deploying.

**Known caveat — performance.** `backdrop-filter` is GPU-composited and
this theme uses a lot of it. It's smooth on modern hardware, but on
older budget Android phones a long table (100+ rows, each cell a
translucent surface) could feel less responsive than the old flat theme.
If that shows up in practice, the cheapest fix is dropping the blur on
`tbody td` / `thead th` only (keep the `.table-wrap` pane) — that
removes most of the per-row compositing cost while keeping the frosted
look of the table as a whole.
