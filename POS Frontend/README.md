# POS Management — Frontend

Tablet-optimized React UI for the Restaurant POS backend. Built to
match the supplied mockups: deep navy chrome with **blue** (Dine-In) /
**orange** (Takeaway, Send to Kitchen) / **green** (Generate Bill,
Available) / **red** (Clear, Occupied) accents.

Stack: **Vite + React 18**, **TailwindCSS 3**, **Zustand**, **TanStack
Query**, **socket.io-client**, **react-router-dom 6**, **lucide-react**,
**react-hot-toast**.

---

## 1. Layout

```
POS Frontend/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── .env.example
└── src/
    ├── main.jsx                  # React bootstrap
    ├── App.jsx                   # Router + socket lifecycle
    ├── index.css                 # Tailwind + base chrome
    ├── api/                      # axios modules, one per backend resource
    │   ├── client.js             # interceptors, token storage
    │   ├── auth.js  tables.js  sessions.js  menu.js  reports.js
    │   ├── orders.js  parcel.js  bills.js  kots.js
    ├── components/               # reusable UI
    │   ├── Button.jsx  Modal.jsx  Header.jsx  Loader.jsx
    │   ├── ConnectionBanner.jsx  ProtectedRoute.jsx
    │   ├── ModeCard.jsx  TableCard.jsx  CategorySidebar.jsx
    │   ├── MenuItemList.jsx  OrderSummary.jsx  QuantityControl.jsx
    │   ├── PaymentModal.jsx  EmptyState.jsx
    │   └── admin/
    │       ├── StatCard.jsx  DataTable.jsx  PageHeader.jsx  FormField.jsx
    ├── layouts/
    │   └── AdminLayout.jsx            # Sidebar + topbar shell for /admin/*
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── ModeSelectionPage.jsx      # Dine-In | Takeaway  (+ Admin btn for admins)
    │   ├── TablesPage.jsx             # Table management grid
    │   ├── OrderEntryPage.jsx         # Dine-In ordering
    │   ├── ParcelOrderPage.jsx        # Takeaway ordering
    │   ├── KitchenDisplayPage.jsx     # Live KOT board
    │   ├── NotFoundPage.jsx
    │   └── admin/                     # Back-office (role=admin)
    │       ├── DashboardPage.jsx      #   KPIs, top items, recent bills/KOTs
    │       ├── MenuPage.jsx           #   Categories + items CRUD
    │       ├── TablesPage.jsx         #   Tables + sections CRUD
    │       ├── StaffPage.jsx          #   Users CRUD + password reset
    │       ├── BillsPage.jsx          #   Bill history, filters, reprint, cancel
    │       └── ReportsPage.jsx        #   Daily sales + kitchen activity
    ├── services/
    │   └── socket.js                  # socket.io-client wrapper
    ├── store/
    │   ├── authStore.js               # Zustand
    │   └── socketStore.js
    └── utils/
        ├── format.js  constants.js
```

---

## 2. Screens (match the mockups)

### 2.1 Main Mode Selection
Two oversized cards: `Dine-In · Manage Tables` (blue gradient) and
`Takeaway · Parcel Orders` (orange gradient). Top right shows
role/username, live socket indicator, kitchen-display shortcut (for
kitchen/admin), logout.

### 2.2 Table Management
Grid of color-coded `TableCard`s — **green** = Available, **red** =
Occupied. Tapping a free table opens a new dining session (with a
linked order) and navigates to the Order Entry screen. Tapping an
occupied table jumps straight into its existing order. Footer shows
`Back` + floor switcher (← Floor N →). Invalidates on
`session_opened/closed`, `bill_settled`, `order_updated` via socket.

### 2.3 Order Entry (Dine-In)
Three-column tablet layout:

* **Left**: `Menu` header + scrollable category list.
* **Center**: searchable menu items list. One tap = add to cart.
* **Right**: white `OrderSummary` panel.
  * `NEW` items show qty ±/trash controls.
  * Already-SENT items are locked and display their status
    (Sent / Preparing / Ready / Served).
  * CTAs: **Send to Kitchen** (orange, disabled unless NEW>0) and
    **Generate Bill** (green, disabled while NEW>0).
  * Incremental dispatch enforced by the UI + server together.

Live sync: `order_updated`, `new_kot`, `bill_generated` update the view
the instant another device (or the kitchen) changes state.

### 2.4 Parcel / Takeaway
Similar layout with orange accent sidebar. CTAs are **Place Order**
(orange — creates KOT + bill in one call via `/parcel/:id/place-and-bill`)
and **Clear** (red — removes all items and starts a fresh parcel
order). Customer name/phone dialog attached to the header button.

### 2.5 Kitchen Display (bonus)
Live grid of KOT cards:
* **Blue** — initial KOT
* **Orange** — `ADDITIONAL ORDER` (batch > 1) — loud, so kitchen doesn't
  re-cook the whole order
* **Amber** — `REPRINT`

Each card lists items with a big `qty×name` and optional notes. Each
KOT has `Reprint` and `Mark Ready` buttons. Audible beep + toast on
every `new_kot` event.

### 2.6 Login
Navy split-screen login with quick-login chips for the four seeded
roles (dev convenience — remove for production).

---

## 3. Real-time contract

The frontend subscribes to every event the backend emits (see
`src/services/socket.js` + the README in `POS Backend/`):

| Event                | Used by                     | Effect in UI                                     |
| -------------------- | --------------------------- | ------------------------------------------------ |
| `new_kot`            | Kitchen, Order Entry, Tables| KOT card appears, cart status refreshes, beep    |
| `order_updated`      | Order Entry, Tables, Kitchen| Cart / table list re-render                      |
| `bill_generated`     | Order Entry                 | Payment modal opens                              |
| `bill_settled`       | Tables                      | Table flips back to green (`free`)               |
| `session_*`          | Tables                      | Grid refetch                                     |
| `kot_print_failed`   | Kitchen, Counter            | Error toast                                      |
| `kot_ack` (client→)  | From Kitchen Display        | ACK sent back to counter on new_kot receipt      |

Auth: the socket handshake includes the JWT from `localStorage`; the
backend auto-joins the correct rooms for the role. Kitchen clients also
announce their station list.

---

## 4. Setup

```bash
cd "POS Frontend"
cp .env.example .env
npm install
npm run dev           # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to
`VITE_API_PROXY_TARGET` (default `http://localhost:4000`) so
same-origin auth + websocket upgrades just work.

For production builds:

```bash
npm run build         # outputs to dist/
npm run preview       # local smoke test
```

Environment:

| Var                       | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `VITE_API_URL`            | Absolute backend origin (leave empty to use proxy)    |
| `VITE_API_PREFIX`         | API version prefix (default `/api/v1`)                |
| `VITE_API_PROXY_TARGET`   | Vite dev proxy target                                 |
| `VITE_DEFAULT_TAX_RATE`   | Percent used for the in-cart total preview (matches backend default) |
| `VITE_CURRENCY_SYMBOL`    | Symbol rendered in totals / money columns             |

---

## 5. Tablet ergonomics

* `body { overflow: hidden }` + full-viewport chrome — behaves like a
  kiosk app.
* Every tappable surface uses the `.tap-btn` class → instant
  `translate-y` feedback even on slow tablets.
* Quantity buttons and CTAs are oversized for fingertips.
* No scroll-on-viewport-resize thrash, no hover-only affordances.
* A connection banner appears at the top as soon as the socket drops.

---

## 6. Role-based routing

Enforced client-side (for UX) and re-checked server-side (for security):

| Route               | Allowed roles                 |
| ------------------- | ----------------------------- |
| `/`                 | any authenticated user        |
| `/tables`           | admin, cashier, waiter        |
| `/order/:orderId`   | admin, cashier, waiter        |
| `/parcel`           | admin, cashier                |
| `/kitchen`          | admin, kitchen                |
| `/admin/*`          | admin only                    |

### Admin back-office (`/admin/*`)

Sidebar-layout back-office for administrators. Visible from the top-right
**Admin** button on the Mode Selection page when logged in as `admin`.

| Section       | Route              | What it does                                                                 |
| ------------- | ------------------ | ---------------------------------------------------------------------------- |
| Dashboard     | `/admin`           | Revenue / occupancy / open-order KPIs, payment split, top items, recent bills & KOTs — auto-refreshes on every `bill_*`, `new_kot`, `session_*` socket event. |
| Menu          | `/admin/menu`      | Category sidebar + items grid. Add / edit / delete categories. Add / edit / delete / toggle-availability items. Search inside category. |
| Tables        | `/admin/tables`    | Grouped by section. Add / edit / remove tables. Can flip status + active flag. Blocks deletion of occupied tables. |
| Staff         | `/admin/staff`     | Users list with role & status chips. Add new users, edit role/status, reset password, deactivate / reactivate. Prevents deactivating yourself. |
| Bills         | `/admin/bills`     | Paginated bill history. Filter by date range / status / order type. Row click opens a detail modal with full itemization, payments, reprint and cancel actions. |
| Reports       | `/admin/reports`   | Any day's sales breakdown — revenue, tax, discounts, by payment method, by order type, top items, kitchen activity. |

Unauthorized visits redirect to `/403`.

---

## 7. Demo flow

1. `npm run dev` (frontend) + backend up at `:4000` and seeded.
2. Login as `cashier / cashier123`.
3. Dine-In → pick a green Table → add 2× Chicken Biryani, 1× Coke.
4. **Send to Kitchen** → orange flash + KOT printed to
   `POS Backend/print-queue/*.txt`. Kitchen window (`kitchen / kitchen123`)
   beeps and shows the card.
5. Add 1× Gulab Jamun → status = NEW; Generate Bill is disabled.
6. **Send to Kitchen** again → ships only the new item, tagged
   `ADDITIONAL ORDER` on the ticket.
7. **Generate Bill** → Payment modal → pick Cash, confirm → table turns
   green, session closes.
8. Takeaway → add items → **Place Order** → bill + KOT go out together.

Every transition is mirrored live on every open tablet.
