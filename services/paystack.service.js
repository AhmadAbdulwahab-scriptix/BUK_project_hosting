// The only file that talks to Paystack over HTTP. Everything else calls these functions.
const config = require('../config');
const { RATE } = require('../helpers/payments');

class PaystackError extends Error {
  /**
   * @param {object} opts
   * @param {number} [opts.statusCode] HTTP status from Paystack (absent for network failures)
   * @param {boolean} opts.ambiguous  true when Paystack MAY have processed the request anyway
   */
  constructor(message, { statusCode, ambiguous }) {
    super(message);
    this.name = 'PaystackError';
    this.statusCode = statusCode;
    this.ambiguous = ambiguous;
  }
  get isNotFound() { return this.statusCode === 404; }
  get isDuplicateReference() { return /duplicate transaction reference/i.test(this.message); }
}

async function request(endpoint, { timeoutMs = config.paystack.timeoutMs, ...options } = {}) {
  if (!config.paystack.secretKey) throw new PaystackError('PAYSTACK_SECRET_KEY is not configured.', { ambiguous: false });

  let response;
  try {
    response = await fetch(`${config.paystack.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.paystack.secretKey}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    // Timeouts and dropped connections: we do not know whether Paystack acted on the request.
    throw new PaystackError(`Paystack request failed: ${error.message}`, { ambiguous: true });
  }

  // A gateway error page is HTML, not JSON, so parsing can fail.
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.status) {
    throw new PaystackError(result.message || `Paystack request failed (${response.status}).`, {
      statusCode: response.status,
      ambiguous: response.status >= 500
    });
  }
  return result.data;
}

function verifyTransaction(reference, options) {
  return request(`/transaction/verify/${encodeURIComponent(reference)}`, options);
}

function initializeTransaction(order) {
  return request('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: order.email,
      amount: order.amountKobo,
      currency: order.currency,
      reference: order.reference,
      callback_url: `${config.baseUrl}/payment/callback`,
      metadata: {
        project: 'Student External Defence Hosting Portal',
        customer_name: order.customerName,
        selected_domain: order.selectedDomain,
        total_usd: order.totalUsd,
        fixed_exchange_rate: RATE
      }
    })
  });
}

module.exports = { PaystackError, verifyTransaction, initializeTransaction };
