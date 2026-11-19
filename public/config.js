// API URL configuration - reads from BASE_URL env or auto-detects localhost
// Works in both development (localhost) and production (Render domain)
const API_URL =
  window.location.hostname === 'localhost'
    ? `http://localhost:${window.location.port}/api`
    : window.location.origin.replace(/\/$/, '') + '/api';

// Export for potential use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_URL };
}