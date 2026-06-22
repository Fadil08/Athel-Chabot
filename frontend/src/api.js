// Central API base URL helper
// In development, Vite proxy will forward /api/* to localhost:3000
// In production (Vercel), VITE_API_URL points to the deployed backend
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Makes a fetch call with the correct base URL.
 * Usage: apiFetch('/api/auth/login', { method: 'POST', ... })
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  return fetch(url, options);
}

export default API_BASE;
