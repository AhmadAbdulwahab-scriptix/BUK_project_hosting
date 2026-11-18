# Reading this project: a practical Node.js learning guide

This guide explains the payment code in the order I recommend reading it. You do not need to understand every line at once. Follow the request from the browser to Express, then to MongoDB and Paystack, and finally back to the browser.

## 1. Start with the pure functions (`helpers/payments.js`)

A pure function depends only on its inputs and does not contact a database, browser, or payment service. Pure functions are easier to reason about and test.

### Price calculation

```js
function calculatePrice(domain) {
  if (!['com', 'ng'].includes(domain)) {
    throw new Error('Unsupported domain selection.');
  }

  const domainUsd = domain === 'com' ? 60 : 50;
  const totalUsd = 200 + 50 + domainUsd;
  const amountKobo = totalUsd * 1380 * 100;

  return { totalUsd, amountNaira: totalUsd * 1380, amountKobo };
}
```

The browser is allowed to tell the server which domain was selected. It is not allowed to tell the server what amount to charge. The server calculates the amount itself. That is an important security rule: never trust a price supplied by a browser.

Paystack expects an amount in the currency's smallest unit. For NGN, this application sends kobo, so ₦427,800 becomes `42,780,000` kobo.

## 2. Understand the order model (`models/Order.js`)

A Mongoose model describes how a document is stored in MongoDB. An order stores:

- The random payment reference.
- The idempotency key for this browser payment attempt.
- The customer's email and selected package.
- The amount calculated by the server, in naira and kobo.
- The current payment status.
- Paystack's transaction ID and payment channel after verification.
- Expiry and refund information.

The unique `idempotencyKey` prevents the same browser attempt from creating multiple orders. The unique sparse `activeCheckoutEmail` field prevents a second active checkout for the same email. Sparse indexes allow older records that pre-date these fields to remain readable.

## 3. Follow one payment request (`public/app.js` → routes → controller → `services/order.service.js`)

When the student submits the form:

1. `public/app.js` creates a random attempt key with `crypto.randomUUID()`.
2. The key is saved in `sessionStorage`, so a refresh or a repeated request in the same tab can reuse it.
3. The browser sends the selected domain, name, email, and the key in the `Idempotency-Key` HTTP header.
4. Express routes the request to `payment.controller.initialize`, which validates input and calls `order.service`.
5. The server validates the input and calculates the package price.
6. The server saves the order before calling Paystack.
7. Paystack returns a hosted checkout URL, which the browser opens.

Why save first? If Paystack later sends a webhook, the server already has a trusted order and expected amount to compare against.

Why use an idempotency key? A network request can time out even if the server completed its work. A retry with the same key should find the original order rather than create a second one.

## 4. Understand webhook signatures (`controllers/webhook.controller.js`)

Paystack signs each webhook body with HMAC-SHA512. The server must calculate the signature using the original bytes, not a parsed-and-reserialized JavaScript object.

That is why this route is registered before the JSON body parser:

```js
app.post(
  '/api/paystack/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  handlePaystackWebhook
);

app.use(express.json());
```

(In this project that ordering lives in `app.js`.)

The server compares signatures using `crypto.timingSafeEqual()`. A normal string comparison can reveal timing information; a timing-safe comparison is the better practice for secret-derived values.

## 5. Learn the webhook inbox state machine

A webhook is an incoming message from Paystack. It can arrive more than once, arrive late, or arrive while your server is temporarily unable to contact Paystack.

Each unique raw event is saved in `WebhookReceipt` and moves through these states:

```text
received → processing → processed
                 |
                 └── temporary problem → retryable → processing
```

A `processing` lease has an expiry time. If the server crashes while handling an event, a later retry can claim the event after the lease expires. A completed event is acknowledged without doing its completed work again.

This is called durable, retry-safe processing. A duplicate must not be confused with an event that failed halfway through.

## 6. The most important function: `commitVerifiedResult()` (in `services/reconciliation.service.js`)

The webhook body is not the final authority. The server calls Paystack's transaction verification endpoint and compares the result with the saved order.

`commitVerifiedResult()` then uses a MongoDB transaction to save two related changes together:

- The order's new payment state.
- The webhook receipt's `processed` state.

If either database write fails, the transaction is rolled back. That prevents a receipt from being marked complete while its order update was not saved.

This is **local database atomicity**. It does not make Paystack and MongoDB one shared transaction. They are independent services, so the application uses verification and reconciliation to make their states converge.

## 7. Learn eventual consistency (`sweepOrders()`)

Sometimes the browser closes. Sometimes a webhook is delayed. Sometimes Paystack is temporarily unavailable.

The scheduled reconciliation job checks older orders with Paystack. It does not guess that an order was paid or failed. It asks Paystack again and updates MongoDB only from the verified result.

This is an example of eventual consistency: two systems may briefly disagree, but repeated safe reconciliation should bring the local record into line with the payment provider.

## 8. Refreshing the order page (`public/order.js`)

The status page never decides that a payment succeeded. It only reads the saved order from `/api/orders/:reference/status`.

It refreshes periodically while the order is pending and stops polling when a final state is reached. Reloading the page is safe because the order is stored in MongoDB, not just in browser memory.

## 9. How to run the tests

```bash
npm test
```

The current automated tests cover price calculations, invalid package choices, Paystack signature validation, and reference generation. They are unit tests; they do not prove that a live MongoDB/Paystack deployment works.

After understanding the pure functions, useful next exercises are:

1. Add a test for the request fingerprint function.
2. Add integration tests using a MongoDB replica-set test database.
3. Mock Paystack's verification API and test successful, failed, abandoned, pending, and amount-mismatch responses.
4. Test a duplicate webhook arriving while the first copy is still processing.
5. Test a process restart while a webhook receipt is in `processing`.

## 10. Good coding habits demonstrated here

- Validate inputs at the server boundary.
- Calculate money on the server, not in browser JavaScript.
- Store money in integer kobo for payment operations.
- Keep secrets in environment variables.
- Keep pure business logic separate from HTTP handlers.
- Use unique database indexes for important uniqueness rules.
- Verify external payment state server-to-server.
- Use explicit states instead of vague booleans like `isPaid`.
- Make retries safe with idempotency keys.
- Treat network timeouts as uncertain, not automatically failed.
- Keep an audit record for privileged manual actions.
- Test small functions automatically and test integrations separately.

A good way to learn this code is to trace one request on paper: browser form → Express route → MongoDB order → Paystack initialize → webhook → Paystack verify → MongoDB transaction → order status page.
