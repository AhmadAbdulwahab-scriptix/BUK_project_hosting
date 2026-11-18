// API URL configuration - works for both localhost and production
// This file is loaded before app.js and order.js

// Check for a local API URL override via localStorage (useful for development)
const localApiUrl = localStorage.getItem('localApiUrl');
const API_URL = localApiUrl ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3050/api'
    : 'https://buk_project_hosting.onrender.com/api');