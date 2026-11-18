// Student data from official registration
const students = [
  { no: 1, name: "Abdulhalim Abdullahi Tukur", regNumber: "CST/22/SWE/00801" },
  { no: 2, name: "Imrana Zakari Abdullahi", regNumber: "CST/22/SWE/00802" },
  { no: 3, name: "Abdullahi Abdurrazaq Nakore", regNumber: "CST/22/SWE/00803" },
  { no: 4, name: "Ahmed Abdulwahab", regNumber: "CST/22/SWE/00807" },
  { no: 5, name: "Muhammad Auwal Anuhi", regNumber: "CST/22/SWE/00812" },
  { no: 6, name: "Abdulhafiz Bello Salisu", regNumber: "CST/22/SWE/00814" },
  { no: 7, name: "Hassan Hassan", regNumber: "CST/22/SWE/00821" },
  { no: 8, name: "Abdulhafeez Ibrahim Ahmad", regNumber: "CST/22/SWE/00822" },
  { no: 9, name: "Muhsin Ibrahim Ahmad", regNumber: "CST/22/SWE/00827" },
  { no: 10, name: "Ahmad Tijjani Imam", regNumber: "CST/22/SWE/00830" },
  { no: 11, name: "Jahv Idiongo", regNumber: "CST/22/SWE/00831" },
  { no: 12, name: "Muhammad Muhammad Lamido", regNumber: "CST/22/SWE/00832" },
  { no: 13, name: "Lawal Abdurrahim Idah", regNumber: "CST/22/SWE/00833" },
  { no: 14, name: "Mohammed Imran Baba", regNumber: "CST/22/SWE/00835" },
  { no: 15, name: "Umar Mohammed Bibi", regNumber: "CST/22/SWE/00836" },
  { no: 16, name: "Abdulrahman Muhammad", regNumber: "CST/22/SWE/00837" },
  { no: 17, name: "Abdulrahman Muhammad", regNumber: "CST/22/SWE/00838" },
  { no: 18, name: "Usman Aminu Muhammad", regNumber: "CST/22/SWE/00839" },
  { no: 19, name: "Maryam Musa", regNumber: "CST/22/SWE/00840" },
  { no: 20, name: "Tat Gerald Stephen", regNumber: "CST/22/SWE/00845" },
  { no: 21, name: "Ahmad Farouk Umar", regNumber: "CST/22/SWE/00848" },
  { no: 22, name: "Abbas Yakubu", regNumber: "CST/22/SWE/00850" },
  { no: 23, name: "Rukayya Faruk", regNumber: "CST/22/SWE/00854" },
  { no: 24, name: "Ahmad Rabiu", regNumber: "CST/22/SWE/00856" },
  { no: 25, name: "Abdullaziz Aliyu Abdullahi", regNumber: "CST/22/SWE/00857" },
  { no: 26, name: "Usman Lawan Yau", regNumber: "CST/22/SWE/00860" },
  { no: 27, name: "Muhammad Muhammad Nataala", regNumber: "CST/22/SWE/00861" },
  { no: 28, name: "Ummuaiman Sabo", regNumber: "CST/22/SWE/00862" },
  { no: 29, name: "Auwalu Muhammad Izziddin", regNumber: "CST/22/SWE/00864" },
  { no: 30, name: "Abdullahi Abdullahi Haruna", regNumber: "CST/22/SWE/00819" }
];

// Render student selection grid
function renderStudentGrid() {
  const grid = document.getElementById('studentGrid');

  students.forEach((student, i) => {
    const card = document.createElement('div');
    card.className = 'student-card';
    const initials = String(student.no).padStart(2, '0');
    card.innerHTML = `
      <input type="radio" name="selectedStudent" value="${i}" id="student${student.no}">
      <label for="student${student.no}">
        <span class="student-avatar">${initials}</span>
        <span>
          <b>${student.name}</b>
          <small>${student.regNumber}</small>
        </span>
      </label>
    `;
    grid.appendChild(card);
  });

  // Add event listeners to student cards
  grid.querySelectorAll('input[name="selectedStudent"]').forEach(radio => {
    radio.addEventListener('change', () => {
      sessionStorage.removeItem(ATTEMPT_KEY_STORAGE);
      const studentIndex = parseInt(radio.value);
      const selected = students[studentIndex];
      if (selected) {
        const nameEl = grid.querySelector('#student' + selected.no + ' label b');
        if (nameEl) grid.querySelector('.selected-student-info')?.remove();
        const infoEl = document.createElement('div');
        infoEl.className = 'selected-student-info';
        infoEl.innerHTML = `<small>Selected: <b>${selected.name}</b> (${selected.regNumber})</small>`;
        grid.querySelector('#student' + selected.no + ' label').appendChild(infoEl);
      }
    });
  });
}

// Prices come from the server (/api/config) so the page can never drift from what is charged.
let pricing = null;
const money = (value) =>
  new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
const ATTEMPT_KEY_STORAGE = 'externalDefencePaymentAttemptKey';

function selectedDomain() {
  return document.querySelector('input[name="domain"]:checked').value;
}

function selectedStudent() {
  const checked = document.querySelector('input[name="selectedStudent"]:checked');
  return checked ? parseInt(checked.value) : null;
}

function newAttemptKey() {
  const key = crypto.randomUUID().replaceAll('-', '');
  sessionStorage.setItem(ATTEMPT_KEY_STORAGE, key);
  return key;
}

function updateTotal() {
  if (!pricing || !pricing.pricesNaira) return;
  const { pricesNaira } = pricing;
  const isCom = selectedDomain() === 'com';
  const totalNaira = isCom ? pricesNaira.totalCom : pricesNaira.totalNg;
  const domainNaira = isCom ? pricesNaira.domainCom : pricesNaira.domainNg;

  // Update displayed values (now showing Naira only)
  const domainEl = document.getElementById('domainUsd');
  const totalUsdEl = document.getElementById('totalUsd');
  const totalNairaEl = document.getElementById('totalNaira');

  if (domainEl) domainEl.textContent = `₦${money(domainNaira)}`;
  if (totalUsdEl) totalUsdEl.textContent = `₦${money(totalNaira)}`;
  if (totalNairaEl) totalNairaEl.textContent = `₦${money(totalNaira)}`;
}

async function loadPricing() {
  const submit = document.querySelector('#paymentForm button');
  if (!submit) {
    console.error('Payment form button not found');
    return;
  }
  submit.disabled = true;
  try {
    const response = await fetch(`${API_URL}/config`);
    if (!response.ok) throw new Error('config');
    const data = await response.json();
    console.log('Pricing data received:', data);
    pricing = data;
    updateTotal();
    submit.disabled = false;
  } catch (error) {
    console.error('Failed to load pricing:', error);
    const messageEl = document.getElementById('paymentMessage');
    if (messageEl) {
      messageEl.textContent = 'Could not load pricing. Please refresh the page.';
    }
  }
}

// Update total when domain selection changes
document.querySelectorAll('input[name="domain"]').forEach((input) =>
  input.addEventListener('change', () => {
    sessionStorage.removeItem(ATTEMPT_KEY_STORAGE);
    updateTotal();
  })
);

// Set footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Initialize student grid on page load
renderStudentGrid();

// Handle URL parameters
const params = new URLSearchParams(window.location.search);
if (params.get('newAttempt') === '1') {
  sessionStorage.removeItem(ATTEMPT_KEY_STORAGE);
}

const paymentStatus = params.get('payment');
const messages = {
  success: 'Payment verified successfully. Your order has been recorded. Keep your Paystack receipt.',
  'not-successful':
    'The payment was not completed. Check your order status before trying again.',
  unverified:
    'We could not verify this payment reference. Please check your order status or contact support.',
  'amount-check-failed':
    'The payment details need review. Do not pay again until support checks the reference.',
  'verification-error':
    'Payment verification is temporarily unavailable. Do not pay again until the order status is checked.',
};

if (paymentStatus && messages[paymentStatus]) {
  document.getElementById('paymentMessage').textContent =
    messages[paymentStatus];
  history.replaceState({}, '', '/');
}

// Toast notification functions
function showSelectionToast() {
  const toast = document.getElementById('selectionToast');
  if (!toast) return;

  toast.classList.remove('hidden');
  toast.classList.add('visible');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 350);
  }, 5000);
}

// Slide up to student section
function scrollToStudentSection() {
  const studentsSection = document.getElementById('students');
  if (studentsSection) {
    studentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Handle form submission
const form = document.getElementById('paymentForm');
['fullName', 'email'].forEach((id) =>
  document.getElementById(id).addEventListener('input', () =>
    sessionStorage.removeItem(ATTEMPT_KEY_STORAGE)
  )
);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.getElementById('paymentMessage');
  const button = form.querySelector('button');
  message.textContent = 'Preparing your secure Paystack checkout…';
  button.disabled = true;
  button.textContent = 'Please wait…';
  try {
    // Require student selection
    const studentIndex = selectedStudent();
    if (studentIndex === null) {
      // Show toast notification and scroll to student section
      showSelectionToast();
      scrollToStudentSection();
      throw new Error('Please select a student before proceeding with payment.');
    }
    const selectedStudentData = students[studentIndex];

    const attemptKey =
      sessionStorage.getItem(ATTEMPT_KEY_STORAGE) || newAttemptKey();
    const response = await fetch(`${API_URL}/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': attemptKey,
      },
      body: JSON.stringify({
        domain: selectedDomain(),
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        studentId: selectedStudentData.regNumber?.trim() || selectedStudentData.regNumber,  // Use registration number as identifier
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      // Provide clearer error message for already-paid students
      const errorMsg = data.message || 'Unable to initialize payment.';
      if (data.message && data.message.includes('already completed payment')) {
        message.textContent = errorMsg + ' Your payment record can be verified using the link in your email.';
      } else {
        message.textContent = errorMsg;
      }
      button.disabled = false;
      return;
    }
    window.location.assign(data.authorizationUrl);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.innerHTML = 'Continue to secure payment <span>→</span>';
  }
});

// Load pricing on page load
loadPricing();