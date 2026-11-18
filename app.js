// Builds the Express app (no listening, no database connection) so tests can import it.
const express = require('express');
const path = require('path');
const db = require('./config/database');
const routes = require('./routes');
const webhookRoutes = require('./routes/webhook.routes');
const { errorHandler, notFoundApi } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real client (needed for rate limits)
app.disable('x-powered-by');

// ORDER MATTERS: the webhook needs the raw body, so it must be mounted BEFORE express.json().
app.use('/api/paystack/webhook', webhookRoutes);
app.use(express.json({ limit: '32kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true, database: db.isReady() }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(routes);
app.use('/api', notFoundApi);
app.use(errorHandler);

module.exports = app;
