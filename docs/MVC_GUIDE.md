# MVC guide (new to the pattern? start here)

MVC splits code by **job**, so each file has one reason to change.

| Layer | Folder | Its one job | Knows about |
|---|---|---|---|
| **Model** | `models/` | Shape of data in MongoDB (schemas, indexes) | nothing else |
| **View** | `public/` | What the user sees (HTML/CSS/JS). Here the "view" is a static frontend that calls JSON APIs | the API only |
| **Controller** | `controllers/` | Read `req`, call a service, send `res`. No business rules | services, validators |
| **Routes** | `routes/` | Map URL + method → middleware → controller | controllers, middleware |

Real projects add a few more folders. These are the ones used here:

| Folder | Job | Example |
|---|---|---|
| `services/` | Business logic and external calls (the "brain"). No `req`/`res` | `order.service.js` (idempotent initialize), `paystack.service.js` (HTTP to Paystack) |
| `middleware/` | Code that runs *before* controllers | `requireAdmin`, `rateLimit`, `requireDatabase`, `errorHandler` |
| `validators/` | Check and clean incoming input | `payment.validator.js` |
| `helpers/` | **Domain-specific pure functions** (no DB, no network): easy to unit-test | `payments.js` (price, HMAC, backoff), `orderTransitions.js` (what a Paystack result means for an order) |
| `utils/` | **Generic tools** that would work in any project | `logger`, `AppError`, `asyncHandler`, `concurrency`, `rateCounter` |
| `config/` | Environment variables and tunable numbers in one place | `config/index.js` |
| `constants/` | Named values so no file hard-codes strings | `orderStatus.js` |
| `jobs/` | Background work on a timer | `jobs/index.js` |

Rule of thumb: **helpers know your business, utils don't.**

## Follow one request

`POST /api/paystack/initialize`

```
app.js ─► routes/payment.routes.js ─► rateLimit ─► requireDatabase
        ─► controllers/payment.controller.initialize
              ├─ validators/payment.validator   (clean the input)
              └─ services/order.service         (idempotency, save order, price)
                    ├─ models/Order             (MongoDB)
                    └─ services/paystack.service (HTTP)
        ◄─ JSON ◄─ (any thrown AppError → middleware/errorHandler)
```

`server.js` only boots things (connect DB, listen, start jobs, shut down cleanly). `app.js` only builds the Express app, so tests can import it without a database.

## Bottlenecks found and fixed

| # | Problem in the old `server.js` | Fix |
|---|---|---|
| 1 | **Starvation:** the reconciler re-checked `failed/abandoned/expired` orders every cycle forever (their `updatedAt` never changed). With 50+ of those, new pending orders were never reached. | Each order has `nextReconcileAt` with exponential backoff + jitter. Closed orders are checked rarely and stop after 7 days. Sweep sorts by due time. |
| 2 | **Serial Paystack calls:** 50 orders × up to 15 s one after another could take 12 min, longer than the 5 min interval. | Bounded parallelism (5 at a time). |
| 3 | **Overlapping runs:** `setInterval` started a new sweep while the old one was still running. | `jobs/createJob.js` schedules the next run only after the previous one finishes. |
| 4 | **Slow webhook response:** the handler waited for Paystack verification (up to 15 s) before answering 200. | Save the receipt, answer 200 at once, verify in a background queue (max 5 concurrent). A webhook sweep retries anything unfinished, so nothing is lost. |
| 5 | **Endless webhook retries / unbounded growth:** failing receipts retried forever; receipts never deleted. | Backoff, `dead` state after 10 attempts, and a 90-day TTL on processed receipts. |
| 6 | **Stuck `initializing` orders** were never reconciled and held the email lock forever, blocking that student. | They are swept; if Paystack has never heard of the reference, the order is closed and the lock released. |
| 7 | **Duplicate-reference dead end:** retrying after an ambiguous timeout hit "duplicate reference" every time. | The checkout link never reached the customer, so the order gets a fresh reference and one more try. |
| 8 | **Retry race:** two simultaneous retries could both call Paystack (read-modify-write). | Atomic `findOneAndUpdate` claim. |
| 9 | **Single-instance limit:** the old in-process timer could not be scaled out. | Per-order compare-and-set lease, so several instances never verify the same order. |
| 10 | **Slow callback:** the browser could wait 15 s on Paystack. | 8 s timeout, then "pending" page; the sweeper finishes. |
| 11 | **Flapping state:** a closed (`expired`) order that Paystack still reported pending flipped to `verification_pending` and back, and could crash on the email-lock unique index. | Closed orders stay closed (`helpers/orderTransitions.js`). |
| 12 | **Index waste / slow queries:** `unique` + `index: true` duplicates, unused indexes, no index for admin list or sweeper. | Clean schema; compound indexes for the sweeper and admin list. |
| 13 | **Junk lookups:** malformed references hit the database; no rate limits; admin token could be guessed quickly. | Reference format check before any query; per-IP rate limits. |
| 14 | **Price drift:** `public/app.js` hard-coded `$250`/rate separately from the server. | Frontend reads `/api/config`. |
| 15 | **Ungraceful deploys:** no SIGTERM handling on Render. | Graceful shutdown. |

Also: Paystack `reversed` transactions now go to `review_required` instead of looping as "pending".
