# POS Management — Backend

Production-grade Restaurant POS backend: table sessions, incremental
Kitchen Order Tickets (KOTs), dual-printer routing (kitchen + counter),
real-time updates via Socket.IO, role-based access, and daily reports.

Built on Node.js + Express + MongoDB + Socket.IO. Printer layer speaks
raw ESC/POS over LAN (port 9100) or USB, with a `file` mode for local
development.

---

## 1. Stack

| Layer     | Tech                                     |
| --------- | ---------------------------------------- |
| Runtime   | Node 18+                                 |
| Web       | Express 4                                |
| Realtime  | Socket.IO 4                              |
| DB        | MongoDB 6 (Mongoose 8)                   |
| Auth      | JWT (Bearer)                             |
| Printers  | Raw ESC/POS — network / USB / file       |
| Validation| Joi                                      |
| Logging   | Winston                                  |

---

## 2. Project layout

```
POS Backend/
├── server.js                  # Entry
├── src/
│   ├── app.js                 # Express app factory
│   ├── config/                # env, db
│   ├── models/                # Mongoose schemas (+ enums)
│   ├── services/              # Core business logic
│   ├── controllers/           # HTTP handlers
│   ├── routes/                # Route tables + validators
│   ├── middleware/            # auth, validate, errorHandler
│   ├── sockets/               # Socket.IO server + room routing
│   ├── printer/               # ESC/POS + transports + templates
│   ├── utils/                 # logger, AppError, calculations
│   └── scripts/seed.js        # Demo data
├── .env.example
└── package.json
```

The **service layer** is the single source of truth for mutations. HTTP
and Socket handlers are thin wrappers. This is what makes the
incremental-KOT invariants hold no matter how the mutation arrives.

---

## 3. Setup

```bash
cd "POS Backend"
cp .env.example .env
npm install                      # USB printer deps are optional — see below
npm run seed                     # creates admin/cashier/kitchen/waiter + demo menu
npm run dev                      # nodemon
# or: npm start
```

Mongo must be reachable at `MONGODB_URI`. Default: `mongodb://127.0.0.1:27017/pos_management`.

### Printer mode

`PRINTER_MODE=file` (default) writes ESC/POS buffers to `./print-queue/`
as `.bin` (raw) + `.txt` (human trace). Perfect for dev — open the
`.txt` to see exactly what the kitchen/counter would receive.

For real printers set:

```
PRINTER_MODE=network
KITCHEN_PRINTER_HOST=192.168.1.100
COUNTER_PRINTER_HOST=192.168.1.101
```

For USB, set `PRINTER_MODE=usb` and provide `VENDOR_ID` / `PRODUCT_ID`
(run `lsusb` or check the printer manual). USB requires the optional
`escpos` + `escpos-usb` packages (installed via `optionalDependencies`).

### Seeded credentials

| role    | username  | password     |
| ------- | --------- | ------------ |
| admin   | admin     | admin123     |
| cashier | cashier   | cashier123   |
| kitchen | kitchen   | kitchen123   |
| waiter  | waiter    | waiter123    |

---

## 4. Data model

```
User ───────── (admin | cashier | kitchen | waiter)

Table ◀──── TableSession ◀──── Order ──── items[] (subdocs, status=NEW→…→SERVED)
                                 │
                                 ├── KOT (one per "Send to Kitchen" click,
                                 │        snapshots items shipped in that batch)
                                 │
                                 └── Bill (snapshot of billable items + totals
                                           + payments[] — final record)
```

The critical invariant: an `OrderItem.status` tells you whether the
kitchen already knows about it. Only items with `status=NEW` are
eligible for the next KOT. Each dispatch bumps `Order.kotSequence` and
stamps items with `kotBatch = sequence`. The KOT record holds the
frozen snapshot. Duplicate dispatches are structurally impossible.

See [`src/models/constants.js`](src/models/constants.js) for status enums.

---

## 5. Workflow

### 5.1 Dining flow

```
POST   /sessions                   { tableId }             → create session + order
POST   /orders/:id/items           { menuItemId, qty }     → item status=NEW
POST   /orders/:id/items …                                 → (repeat)
POST   /orders/:id/send-to-kitchen                         → NEW → SENT_TO_KITCHEN,
                                                             KOT record created,
                                                             kitchen printer fires,
                                                             socket emits `new_kot`
POST   /orders/:id/items           { menuItemId, qty }     → another NEW item
POST   /orders/:id/send-to-kitchen                         → ONLY the new item ships
                                                             (batch #2, marked
                                                             "ADDITIONAL ORDER")
POST   /bills/from-order/:orderId                          → freeze bill, close order,
                                                             counter printer fires,
                                                             socket emits `bill_generated`
POST   /bills/:id/settle           { payments: [...] }     → mark paid, close session,
                                                             free the table
```

Adding an already-present item while still NEW merges quantity — no
duplicate cart lines. Sent items cannot be silently edited; cancel and
re-add if needed. Bills can't be generated while any NEW items remain
(“send all new items to the kitchen before billing”).

### 5.2 Parcel flow

```
POST   /parcel                                             → create parcel order
POST   /parcel/:id/items                                   → add (merge) items
POST   /parcel/:id/place-and-bill                          → dispatch KOT + generate bill
POST   /bills/:id/settle           { payments: [...] }
```

### 5.3 Kitchen flow

Kitchen tablet connects via Socket.IO (`role: kitchen`) and listens:

* `new_kot` — incremental KOT arrived. Includes `isIncremental: true` when `batchNumber > 1`.
* `order_updated` — generic order mutation (add/cancel/status).
* `kot_print_failed` — the kitchen printer rejected the ticket.

The kitchen can mark items as PREPARING / READY / SERVED via:

```
POST /orders/:id/items/:itemId/status    { status: "PREPARING" }
```

That emits an `order_updated` event so counters/waiters see it live.

---

## 6. REST API overview

Base: `/api/v1`

### Auth
```
POST   /auth/login                  { username, password }
GET    /auth/me
POST   /auth/users                  admin only — create staff
GET    /auth/users                  admin only
PATCH  /auth/users/:id              admin only — update name/role/isActive/password
DELETE /auth/users/:id              admin only — deactivate
```

### Tables
```
GET    /tables
POST   /tables                      admin
PATCH  /tables/:id                  admin
DELETE /tables/:id                  admin (soft delete)
```

### Sessions
```
GET    /sessions                    list active
GET    /sessions/:id
POST   /sessions                    { tableId, guests, notes }
POST   /sessions/:id/close
POST   /sessions/:id/reopen
```

### Menu
```
GET    /menu/categories
POST   /menu/categories             admin
PATCH  /menu/categories/:id         admin
DELETE /menu/categories/:id         admin

GET    /menu/items                  ?category=&search=&available=
POST   /menu/items                  admin
PATCH  /menu/items/:id              admin
POST   /menu/items/:id/toggle-availability
DELETE /menu/items/:id              admin (soft delete)
```

### Orders (dining)
```
GET    /orders                      open orders
GET    /orders/:id
GET    /orders/:id/pending-kot      preview NEW items
POST   /orders/:id/items            { menuItemId, quantity, notes }
PATCH  /orders/:id/items/:itemId/quantity   { quantity }
DELETE /orders/:id/items/:itemId            (only NEW items)
POST   /orders/:id/items/:itemId/cancel     { reason }   (already-sent items)
POST   /orders/:id/items/:itemId/status     { status }   (PREPARING|READY|SERVED)
POST   /orders/:id/send-to-kitchen
```

### Parcel
```
POST   /parcel                      { customer? }
POST   /parcel/:id/items            { menuItemId, quantity, notes }
PATCH  /parcel/:id/items/:itemId/quantity
DELETE /parcel/:id/items/:itemId
POST   /parcel/:id/place-and-bill   { discount?, taxRate?, serviceCharge? }
```

### KOT
```
GET    /kots/today
GET    /kots/pending
GET    /kots/order/:orderId
GET    /kots/:id
POST   /kots/:id/reprint
```

### Bills
```
GET    /bills                       ?from=&to=&status=&orderType=&page=&limit=
GET    /bills/:id
POST   /bills/from-order/:orderId   { discount?, taxRate?, serviceCharge? }
POST   /bills/:id/settle            { payments: [{ method, amount, reference? }] }
POST   /bills/:id/cancel            admin
POST   /bills/:id/reprint
```

### Reports
```
GET    /reports/dashboard           # admin dashboard (KPIs, top items, recent bills/KOTs)
GET    /reports/daily-sales         ?date=YYYY-MM-DD
GET    /reports/kitchen-activity    ?date=YYYY-MM-DD
```

### Health
```
GET    /health
```

Every authenticated endpoint expects `Authorization: Bearer <jwt>`.

---

## 7. Socket.IO contract

Connect with:

```js
const socket = io('http://localhost:4000', {
  auth: { token: jwt, stations: ['main', 'tandoor'] }  // stations optional, kitchen only
});
```

Rooms are auto-joined by role (`counter`, `kitchen`, `waiter`, `admin`).

### Events (server → client)
| event                | payload                                                   |
| -------------------- | --------------------------------------------------------- |
| `new_kot`            | `{ kot, order, isIncremental, isReprint? }`               |
| `order_updated`      | `{ order, reason }`                                       |
| `bill_generated`     | `{ bill, orderId, sessionId }`                            |
| `bill_settled`       | `{ billId, billNumber, status, balanceDue }`              |
| `bill_cancelled`     | `{ billId, billNumber }`                                  |
| `session_opened`     | `{ sessionId, tableId, tableNumber }`                     |
| `session_closed`     | `{ sessionId }`                                           |
| `session_reopened`   | `{ sessionId }`                                           |
| `kot_print_failed`   | `{ kotId, kotNumber, error }`                             |
| `bill_print_failed`  | `{ billId, billNumber, error }`                           |

### Events (client → server)
| event     | payload                                |
| --------- | -------------------------------------- |
| `kot_ack` | `{ kotId }` — kitchen confirms receipt |
| `ping:pos`| heartbeat (ack returns `{ ok, at }`)   |

---

## 8. Printer integration

`src/printer/printerService.js` exposes `printKOT(kot)` and `printBill(bill)`.
Both are:

* **Queued** — serialized per printer so concurrent jobs don't corrupt output.
* **Template-driven** — KOT and Bill have their own ESC/POS renderers.
* **Transport-agnostic** — `file`, `network`, or `usb`, chosen from env.
* **Station-aware** — a single KOT can print multi-station (main kitchen,
  tandoor, bar) copies from one call. See `renderKOTPerStation`.

To add a new station-specific printer (e.g. a separate bar printer),
extend `printerService` with a station → transport map and route slips
accordingly.

---

## 9. Edge cases (all handled)

1. **Same item added twice while NEW** — merges quantity.
2. **Partial sends, many times** — each press ships *only* NEW items.
3. **Reopen a closed session** — `POST /sessions/:id/reopen`. Creates a fresh
   order if the previous one was closed.
4. **Printer offline** — KOT/bill still persisted; `printStatus=FAILED`;
   socket emits `*_print_failed`. Use `/kots/:id/reprint` or
   `/bills/:id/reprint` once the printer is back.
5. **Duplicate KOT prevention** — enforced by the order service: the NEW →
   SENT transition happens **before** the KOT record is written.
6. **Bill while items still pending** — rejected with 422.
7. **Cancel a served item** — rejected with 409.
8. **Split payments** — `settle` accepts multiple payment lines. Status flips
   to PAID only when `paidAmount >= total`.

---

## 10. Local testing

```bash
# Start Mongo (docker is fine)
docker run -d -p 27017:27017 --name pos-mongo mongo:6

npm install
cp .env.example .env
npm run seed
npm run dev
```

Quick smoke test with `curl`:

```bash
API=http://localhost:4000/api/v1

# 1. login
TOKEN=$(curl -s -X POST $API/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"cashier","password":"cashier123"}' | jq -r .data.token)

# 2. pick a table + open session
TABLE_ID=$(curl -s $API/tables -H "Authorization: Bearer $TOKEN" | jq -r '.data[0]._id')
SESSION=$(curl -s -X POST $API/sessions -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d "{\"tableId\":\"$TABLE_ID\"}")
ORDER_ID=$(echo $SESSION | jq -r '.data.order._id')

# 3. add items
MI=$(curl -s "$API/menu/items" -H "Authorization: Bearer $TOKEN" | jq -r '.data[0]._id')
curl -s -X POST $API/orders/$ORDER_ID/items -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d "{\"menuItemId\":\"$MI\",\"quantity\":2}"

# 4. send to kitchen (check print-queue/ for the ESC/POS files)
curl -s -X POST $API/orders/$ORDER_ID/send-to-kitchen -H "Authorization: Bearer $TOKEN"

# 5. bill + settle
BILL=$(curl -s -X POST $API/bills/from-order/$ORDER_ID -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{}')
BILL_ID=$(echo $BILL | jq -r '.data._id')
curl -s -X POST $API/bills/$BILL_ID/settle -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"payments":[{"method":"CASH","amount":9999}]}'
```

`print-queue/*.txt` will show the KOT (incremental run marker if applicable)
and the final bill.
