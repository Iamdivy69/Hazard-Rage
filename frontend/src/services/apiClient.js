// apiClient — single place for HTTP per FRONTEND_ARCHITECTURE.md.
// Attaches Bearer from memory, requestId, 10s timeout, 401 redirect, GET retry 1x.
// No business logic. Components must use services/* which use this client.

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
export const API_BASE = BASE_URL;

let tokenMemory = null;
try {
  // Restore synchronously at module load so first-render fetches already carry auth.
  // (Effects in pages fire before AuthProvider's restore effect — that race caused 401s on reload.)
  tokenMemory = sessionStorage.getItem('hz_token');
} catch { tokenMemory = null; }
export function setToken(t) { tokenMemory = t || null; }
export function getToken() { return tokenMemory; }

function uid() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '';
}

async function request(path, { method = 'GET', body, headers = {}, timeoutMs = 10000, retry = method === 'GET', form = false } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(form ? {} : { 'Content-Type': 'application/json' }),
        'x-request-id': uid(),
        ...(tokenMemory ? { Authorization: `Bearer ${tokenMemory}` } : {}),
        ...headers,
      },
      body: body !== undefined ? (form ? body : JSON.stringify(body)) : undefined,
    });
    if (res.status === 401 && typeof window !== 'undefined') {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      if (!window.location.pathname.includes('/login')) window.location.href = `/login?redirect=${redirect}`;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(json?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = json?.error?.code;
      err.details = json?.error?.details;
      throw err;
    }
    return json;
  } catch (err) {
    if (retry && err?.name !== 'AbortError' && method === 'GET' && !err.status) {
      return request(path, { method, body, headers, timeoutMs, retry: false });
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

export const apiClient = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  postForm: (p, formData, opts) => request(p, { ...opts, method: 'POST', body: formData, form: true, timeoutMs: 30000, retry: false }),
  patchForm: (p, formData, opts) => request(p, { ...opts, method: 'PATCH', body: formData, form: true, timeoutMs: 30000, retry: false }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
};
