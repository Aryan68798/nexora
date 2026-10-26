import { supabase } from '../lib/supabase';

/**
 * Custom error class for Nexora API responses
 */
export class ApiError extends Error {
  /**
   * @param {string} code - Error code (e.g. UNAUTHORIZED, NOT_FOUND)
   * @param {string} message - Human-readable message
   * @param {*} [details=null] - Validation error array or detail object
   * @param {number} [status=500] - HTTP status code
   */
  constructor(code, message, details = null, status = 500) {
    super(message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Retrieve the configured backend URL from environment variables.
 * First reads VITE_BACKEND_URL or VITE_API_BASE_URL before calling backend APIs.
 *
 * @returns {string} - e.g. "http://localhost:8000"
 */
export function getBackendUrl() {
  const envUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    try {
      const parsed = new URL(import.meta.env.VITE_API_URL);
      return parsed.origin;
    } catch {
      // ignore invalid URL
    }
  }
  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:8000';
}

/**
 * Retrieve the configured API index/prefix from environment variables (e.g. "/api" or "/api/v1").
 *
 * @returns {string} - e.g. "/api"
 */
export function getApiIndex() {
  const envIndex = import.meta.env.VITE_API_INDEX || import.meta.env.VITE_API_PREFIX;
  if (envIndex) {
    const trimmed = envIndex.trim().replace(/\/+$/, '');
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  if (import.meta.env.VITE_API_URL) {
    try {
      const parsed = new URL(import.meta.env.VITE_API_URL);
      return parsed.pathname.replace(/\/+$/, '') || '/api';
    } catch {
      // ignore invalid URL
    }
  }
  return '/api';
}

/**
 * Retrieve the combined backend URL and API index base URL.
 *
 * @returns {string} - e.g. "http://localhost:8000/api"
 */
export function getApiBaseUrl() {
  return `${getBackendUrl()}${getApiIndex()}`;
}

/**
 * Build the complete URL for an API request using the configured backend URL and API index.
 *
 * @param {string} endpoint - API route (with or without api index, e.g. "/spaces" or "/api/spaces")
 * @param {Object} [params] - Optional query parameters
 * @returns {URL}
 */
export function buildApiUrl(endpoint, params) {
  const backendUrl = getBackendUrl();
  const apiIndex = getApiIndex();

  let cleanEndpoint = (endpoint || '').trim();
  if (cleanEndpoint.startsWith(apiIndex)) {
    cleanEndpoint = cleanEndpoint.slice(apiIndex.length);
  } else if (cleanEndpoint.startsWith('/api')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }

  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = `/${cleanEndpoint}`;
  }

  const fullPath = `${apiIndex}${cleanEndpoint}`;
  const url = new URL(fullPath, backendUrl);

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, String(val));
      }
    });
  }

  return url;
}

/**
 * Fetch wrapper that attaches Supabase auth token, handles timeouts,
 * unwraps { success, data, meta } envelopes and formats errors.
 *
 * @param {string} endpoint - API route (e.g. '/api/auth/me')
 * @param {Object} [options={}] - Fetch options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object} [options.params] - URL search parameters
 * @param {*} [options.body] - Request body (JSON or FormData)
 * @param {Object} [options.headers] - Additional headers
 * @param {number} [options.timeout=15000] - Timeout in milliseconds
 * @param {AbortSignal} [options.signal] - External abort signal
 * @returns {Promise<*>}
 */
export async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    params,
    body,
    headers = {},
    token: explicitToken,
    skipUnauthorizedEvent = false,
    timeout = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
  } = options;

  // Build full URL by first obtaining the backend URL and API index from environment variables
  const url = buildApiUrl(endpoint, params);

  // Get active session token: prefer explicitToken, then check Authorization header, then fallback to Supabase session
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Authorization')) {
    if (explicitToken) {
      requestHeaders.set('Authorization', `Bearer ${explicitToken}`);
    } else if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || null;
      if (token) {
        requestHeaders.set('Authorization', `Bearer ${token}`);
      }
    }
  }

  // Setup abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Request timed out'));
  }, timeout);

  // Chain external signal if provided
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body && typeof body === 'object') {
    requestHeaders.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const json = isJson ? await response.json() : null;

    if (!response.ok || (json && json.success === false)) {
      const errPayload = json?.error || {};
      const code = errPayload.code || `HTTP_${response.status}`;
      const message = errPayload.message || response.statusText || 'Request failed';
      const details = errPayload.details || null;

      // When unauthorized 401, trigger global event unless explicitly suppressed
      if (response.status === 401 && !skipUnauthorizedEvent) {
        window.dispatchEvent(new CustomEvent('nexora:unauthorized'));
      }

      throw new ApiError(code, message, details, response.status);
    }

    // Return unpacked data (if meta exists, return { data, meta })
    if (json && json.meta !== undefined) {
      return { data: json.data, meta: json.meta };
    }

    return json ? json.data : null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'The request timed out. Please check your connection.', null, 408);
    }
    throw new ApiError('NETWORK_ERROR', error.message || 'Network request failed', null, 0);
  }
}

/**
 * API convenience helpers
 */
export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  put: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
  upload: (endpoint, formData, options) => apiRequest(endpoint, { ...options, method: 'POST', body: formData }),
};
