# POS Management — Restaurant Point of Sale

Production-grade restaurant POS built as three cooperating apps:

| Folder | What it is | Stack | Port |
|---|---|---|---|
| **[POS Backend/](POS%20Backend/)** | REST API + Socket.IO + ESC/POS printer integration | Node · Express · MongoDB · Mongoose | `:4000` |
| **[POS Frontend/](POS%20Frontend/)** | Tablet-optimized POS UI (Dine-In, Takeaway, Kitchen Display, Admin) | Vite · React 18 · Tailwind · Zustand · TanStack Query · socket.io-client | `:5173` |
| **[POS Reports/](POS%20Reports/)** | Standalone admin-only Reports editor | Vite · React 18 · Tailwind · TanStack Query | `:5174` |

Each folder has its own README with setup steps, API surface, and screen-by-screen walkthroughs.

## Core features

- **Dine-in** with split-table seating (A / B / C / D independent bills on one physical table), incremental KOTs, live kitchen display.
- **Takeaway** (parcel) single-order billing with KOT + receipt in one step.
- **Kitchen Order Tickets (KOT)** — one per *Send to Kitchen* press, never per item. Additional runs flagged as "ADDITIONAL ORDER" so the kitchen doesn't re-cook.
- **Dual printer routing** — kitchen vs counter (ESC/POS via LAN, USB, or file mode for dev).
- **Real-time** via Socket.IO — every cashier tablet, kitchen display, and admin dashboard stays in sync.
- **Role-based access** — admin / cashier / kitchen / waiter.
- **Editable DailyReport collection** — all report numbers live in Mongo and can be edited from the Reports site or directly via Mongo Compass, with a `locked` flag that prevents auto-recompute over manual edits.
- **Admin panel** — menu CRUD, tables CRUD, staff CRUD with password reset, bill history with filters and per-bill edit, reports.
- **Self-healing** — reconcile routine fixes stuck sessions / orphan state on server boot.

## Local setup

```bash
# 1. Clone
git clone https://github.com/ABHISHEK-J7/POS-Management.git
cd "POS-Management"

# 2. Backend
cd "POS Backend"
cp .env.example .env            # fill in MONGODB_URI + JWT_SECRET
npm install
npm run seed                    # demo users, tables, menu
npm run seed:menu               # real restaurant menu (83 items)
npm run dev                     # :4000

# 3. Main POS frontend
cd ../"POS Frontend"
cp .env.example .env
npm install
npm run dev                     # :5173

# 4. Reports editor
cd ../"POS Reports"
cp .env.example .env
npm install
npm run dev                     # :5174
```

## Seeded logins

| Role | Username | Password |
|---|---|---|
| admin | `admin` | `admin123` |
| cashier | `cashier` | `cashier123` |
| kitchen | `kitchen` | `kitchen123` |
| waiter | `waiter` | `waiter123` |

## Key endpoints (backend `/api/v1`)

```
POST   /auth/login
POST   /sessions/commit          # dining commit (whole or seat-labelled)
POST   /orders/:id/send-to-kitchen
POST   /bills/from-order/:orderId
POST   /bills/:id/settle
POST   /bills/:id/cancel
PATCH  /bills/:id                # admin-only full edit
GET    /reports/dashboard
GET    /reports/daily/:date
PATCH  /reports/daily/:date      # admin-only edit
```

Full reference in each app's README.
