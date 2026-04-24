# POS Reports — Standalone editor

Independent Vite + React site whose only job is managing the
`DailyReport` collection in the POS MongoDB. Lives alongside
`POS Backend` and `POS Frontend` — deploys on its own origin, uses its
own login session, and only an **admin** user can sign in.

> Reports editing used to live inside the main POS app. It now has its
> own dedicated site so you can lock it down separately (different
> subdomain / tablet / hostname), and the cashier-facing POS stays
> focused on orders.

## Stack

- Vite 5 + React 18
- TailwindCSS 3
- TanStack Query + Zustand
- axios, react-router-dom, lucide-react, react-hot-toast
- **No sockets** — report editing is request/response only.

## Layout

```
POS Reports/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── api/
    │   ├── client.js       # axios + separate localStorage keys
    │   ├── auth.js
    │   └── reports.js
    ├── components/
    │   ├── Header.jsx  Button.jsx  FormField.jsx
    │   ├── Loader.jsx  ProtectedRoute.jsx
    ├── pages/
    │   ├── LoginPage.jsx        # admin-only sign-in
    │   ├── EditReportsPage.jsx  # the main page
    │   └── NotFoundPage.jsx
    ├── store/
    │   └── authStore.js
    └── utils/
        └── format.js
```

## Routes

| Route             | Role    | What it does                               |
| ----------------- | ------- | ------------------------------------------ |
| `/login`          | anyone  | Admin sign-in; cashiers/kitchen rejected   |
| `/`               | admin   | Editor for today's report                  |
| `/:YYYY-MM-DD`    | admin   | Editor for a specific day (deep-linkable)  |
| `/403`            | —       | Access denied                              |

## What the editor does

- **Left sidebar** — paginated list of recent `DailyReport` documents
  from the DB with a search box. Click a row to switch day.
- **Editor form** — Revenue, Bills paid, Subtotal, Tax, Discount,
  Service charge, Notes, Lock toggle.
- **Sanity warning** — if `subtotal − discount + service + tax ≠ revenue`
  (more than 1 cent off), an amber banner surfaces the gap so typos
  don't go unnoticed.
- **Save** — PATCHes the DailyReport doc. Editing any income field
  auto-locks it so the backend's auto-recompute won't blow away
  manual changes.
- **Regenerate from bills** — calls the backend's
  `POST /reports/daily/:date/regenerate`, which unlocks + recomputes
  from the Bills collection. Confirmation dialog if the report is
  currently locked or the form has unsaved changes.
- **Right panel** — live snapshot, payment-method split, top items
  (read-only context so the admin can see what they're overriding).

Every write hits the same backend endpoints the admin panel
previously used:

```
GET    /api/v1/reports/daily              — list
GET    /api/v1/reports/daily/:YYYY-MM-DD  — get (creates-on-demand)
POST   /api/v1/reports/daily/:date/regenerate — unlock + recompute
PATCH  /api/v1/reports/daily/:date        — edit + auto-lock on income
```

## Setup

```bash
cd "POS Reports"
cp .env.example .env
npm install
npm run dev        # http://localhost:5174
```

Runs on **:5174** so it can coexist with the main POS Frontend (:5173).
Vite proxies `/api` to `VITE_API_PROXY_TARGET` (default
`http://localhost:4000` — the POS backend). Log in with any admin user
(`admin / admin123` in the seed).

## Production

```bash
npm run build          # → dist/
npm run preview        # local smoke test
```

Deploy `dist/` behind any static host (Nginx, S3/CloudFront, Vercel,
Netlify). Configure:

1. `VITE_API_URL` — absolute URL of the backend, e.g. `https://api.example.com`.
2. The POS backend must include the Reports site's origin in its
   `CORS_ORIGIN` env (comma-separated list works), since the two live
   on separate hosts in production.

## Editing the DB directly

Since `DailyReport` is a first-class Mongo collection, you can also
manage reports from Mongo Compass or the shell:

```js
db.dailyreports.updateOne(
  { dateKey: '2026-04-20' },
  { $set: { revenue: 5500, notes: 'manual override', locked: true } }
);
```

Set `locked: true` so the next bill settlement doesn't recompute over
your change. The lock badge in this app will immediately reflect that
state on refresh.

## Security model

| Role     | Can sign in here? |
| -------- | ----------------- |
| admin    | ✅                |
| cashier  | ❌ (toast rejection after login) |
| kitchen  | ❌                |
| waiter   | ❌                |

Backend enforces the same check on every mutating endpoint — the
frontend gate is UX, not security.

## Auth isolation

The Reports site stores its JWT under
`localStorage['pos-reports.token']` — distinct from the main POS
frontend's `pos.token`. If both apps are opened on the same origin,
they don't clobber each other's sessions.
