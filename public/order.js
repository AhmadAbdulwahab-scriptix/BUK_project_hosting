// Get URL parameters
const params = new URLSearchParams(window.location.search);
const reference = params.get('reference');
const lead = document.getElementById('statusLead');
const note = document.getElementById('statusNote');
const details = document.getElementById('orderDetails');
const studentInfo = document.getElementById('studentInfo');
const studentNameEl = document.getElementById('studentName');
const studentRegEl = document.getElementById('studentReg');
const refreshButton = document.getElementById('refreshStatus');
const newAttemptLink = document.getElementById('newAttemptLink');

// Status explanations
const explanations = {
  paid: 'Payment confirmed. Your order has been recorded. Keep your Paystack receipt.',
  pending:
    'Payment is not confirmed yet. Paystack may still be processing it. Refresh later; do not pay again until the status is clear.',
  initializing: 'Your checkout is being prepared. Please wait and refresh shortly.',
  initialization_unknown:
    'Checkout initialization could not be confirmed. The team can reconcile this reference; do not create another payment yet.',
  initialization_failed:
    'Checkout could not be started. You can start a new attempt after confirming no debit occurred.',
  verification_pending:
    'Payment is awaiting confirmation from Paystack. You can close this page and return using this reference.',
  failed:
    'Paystack reports that this payment failed. If your bank shows a debit, contact support before trying again.',
  abandoned:
    'Checkout was abandoned before payment was completed. If you were debited, contact support with this reference.',
  expired:
    'This checkout expired. If you were debited, contact support and provide the reference before trying again.',
  review_required:
    'Payment details need manual review. Do not make another payment until the coordinator has checked this reference.',
  refund_pending: 'A refund is being processed. Keep this reference for follow-up.',
  refunded:
    'The refund has been recorded. Keep this reference and your Paystack refund confirmation.',
};

function showUnavailable(message) {
  lead.textContent = message;
  note.textContent =
    'If you believe you were charged, contact the project coordinator and include your payment reference.';
}

async function loadStatus() {
  if (!reference) return showUnavailable('No payment reference was provided.');

  refreshButton.disabled = true;
  lead.textContent = 'Checking the saved order…';

  try {
    const response = await fetch(
      `${API_URL}/orders/${encodeURIComponent(reference)}/status`,
      { cache: 'no-store' }
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Could not retrieve this order.');
    }

    const order = data.order;
    details.hidden = false;
    document.getElementById('reference').textContent = order.reference;
    document.getElementById('domain').textContent = `.${order.selectedDomain}`;
    document.getElementById('amount').textContent = `₦${Number(
      order.amountNaira
    ).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    document.getElementById('status').textContent = order.status.replaceAll(
      '_',
      ' '
    );
    document.getElementById('updated').textContent = new Date(
      order.updatedAt
    ).toLocaleString();

    // Display student information if available
    if (order.student) {
      studentInfo.hidden = false;
      studentNameEl.textContent = order.student.name;
      studentRegEl.textContent = order.student.registrationNumber;

      // Add paid badge if status is paid (only if not already added)
      if (order.status === 'paid') {
        const statusPill = document.querySelector('#status .status-pill');
        if (statusPill && !statusPill.querySelector('.paid-badge')) {
          const badge = document.createElement('span');
          badge.className = 'paid-badge';
          badge.textContent = 'Paid';
          statusPill.appendChild(badge);
        }
      }
    } else {
      studentInfo.hidden = true;
    }

    lead.textContent =
      explanations[order.status] ||
      'Your order has been saved. Contact support if you need assistance.';
    note.textContent =
      order.status === 'review_required'
        ? 'This record requires a human review. Visiting this page cannot approve or change a payment.'
        : '';

    if (
      ['failed', 'abandoned', 'expired', 'initialization_failed'].includes(
        order.status
      )
    ) {
      newAttemptLink.hidden = false;
      sessionStorage.removeItem('externalDefencePaymentAttemptKey');
    }

    if (['paid', 'refunded'].includes(order.status)) {
      sessionStorage.removeItem('externalDefencePaymentAttemptKey');
    }
  } catch (error) {
    showUnavailable(error.message);
  } finally {
    refreshButton.disabled = false;
  }
}

// Refresh button listener
refreshButton.addEventListener('click', loadStatus);

// Load status on page load
loadStatus();

// Auto-poll pending pages, but stop after final state
const pollTimer = setInterval(async () => {
  const current = document.getElementById('status').textContent;
  if (
    !reference ||
    [
      'paid',
      'failed',
      'abandoned',
      'expired',
      'review required',
      'refunded',
      'initialization failed',
    ].includes(current)
  ) {
    clearInterval(pollTimer);
    return;
  }
  await loadStatus();
}, 10000);