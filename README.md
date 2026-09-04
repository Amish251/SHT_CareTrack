# CareTrack — Show Humanity Trust

Internal tools for the Trust. Built as one React + Vite app with a
**feature-module** structure — each area of trust work (equipment register,
and whatever comes next: donations, volunteers, beneficiaries, events...)
lives in its own folder under `src/features/`, and plugs into the shared
sidebar and router.

## Folder structure

```
seva-trust-suite/
├── index.html
├── package.json
├── vite.config.ts          # includes vite-plugin-pwa for offline support
├── tsconfig.json
├── public/
│   └── icons/               # PWA icons (add icon-192.png, icon-512.png)
└── src/
    ├── main.tsx              # entry point
    ├── App.tsx                # top-level router — each module adds its routes here
    ├── app/
    │   └── layout/
    │       ├── AppShell.tsx   # sidebar + page outlet
    │       └── Sidebar.tsx    # nav — each module adds an entry here
    ├── features/
    │   └── equipment-register/     # <- first module, ported from equipment-register.html
    │       ├── types.ts             # data model (EquipmentType, Unit, Allocation)
    │       ├── store.ts             # load/save + useEquipmentData() hook, via shared storage helper
    │       ├── helpers.ts           # date formatting + lookup helpers shared by all pages
    │       ├── components/
    │       │   └── ModuleTabs.tsx   # sub-nav between the module's four pages + <Outlet/>
    │       └── pages/
    │           ├── DashboardPage.tsx    # done — summary stats, add equipment type, unit chips
    │           ├── IssuePage.tsx        # done — issue form, redirects to Active Loans on submit
    │           ├── ActiveLoansPage.tsx  # done — active loans table + mark returned
    │           └── HistoryPage.tsx      # done — search/filter history table
    ├── shared/
    │   ├── lib/
    │   │   └── storage.ts     # generic namespaced storage — every module reuses this
    │   ├── components/ui/
    │   │   └── Toast.tsx      # ToastProvider + useToast(), mounted once in main.tsx
    │   ├── hooks/
    │   └── styles/
    │       └── tokens.css     # full design system, ported from equipment-register.html
    └── types/
```

## Adding a new module (e.g. "donations")

1. `src/features/donations/{types.ts, store.ts, pages/, components/}`
2. Add its routes to `src/App.tsx`
3. Add a nav entry to `src/app/layout/Sidebar.tsx`

Each module owns its own data namespace via `shared/lib/storage.ts`
(`seva:<namespace>` in localStorage), so modules never collide and can be
swapped to IndexedDB independently later.

## Modules

- **Equipment Register** — token-based lending of wheelchairs, walking
  stands, etc.
- **Finance** — donations received and expenses paid (transport, new
  equipment, etc.), with running totals.
- **Settings** — user accounts (multi-login, admin-managed) and
  backup/restore of all app data.

The whole app is behind a login screen. Default account on first run:
`admin` / `admin123` — change it from Settings → Users.

See `HANDOFF.md` for the full session-by-session history and open items.

## Status

- Folder structure and app shell: done
- Equipment Register: fully ported from `equipment-register.html` —
  Dashboard (type/unit management), Issue, Active Loans, and History all
  read and write real data, with a sub-nav (`ModuleTabs`) to move between
  them
- Toasts, tables, forms, and layout styling are all wired up in
  `tokens.css`
- PWA/offline support: wired via `vite-plugin-pwa`, needs real icons in
  `public/icons/`

## Getting started

```bash
npm install
npm run dev
```
