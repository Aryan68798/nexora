import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, apiRequest, getBackendUrl, getApiIndex, getApiBaseUrl, buildApiUrl } from '../api/client';

describe('ApiError class', () => {
  it('constructs an ApiError with code, message, details, and status', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Validation failed', [{ field: 'email', message: 'Required' }], 400);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.details).toEqual([{ field: 'email', message: 'Required' }]);
    expect(error.status).toBe(400);
  });

  it('provides default values when optional parameters are omitted', () => {
    const error = new ApiError();
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('An unexpected error occurred');
    expect(error.details).toBeNull();
    expect(error.status).toBe(500);
  });
});

describe('apiRequest fetch wrapper', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('unwraps success envelope and returns data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: { id: 'user-123', name: 'Aarav' },
      }),
    });

    const data = await apiRequest('/api/auth/me');
    expect(data).toEqual({ id: 'user-123', name: 'Aarav' });
  });

  it('returns both data and meta if meta is provided in the envelope', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: [{ id: 1 }, { id: 2 }],
        meta: { total: 2, page: 1, limit: 10 },
      }),
    });

    const result = await apiRequest('/api/spaces');
    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: { total: 2, page: 1, limit: 10 },
    });
  });

  it('throws ApiError with error envelope payload when response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account is deactivated',
          details: null,
        },
      }),
    });

    await expect(apiRequest('/api/auth/me')).rejects.toThrow('Account is deactivated');
  });

  it('dispatches nexora:unauthorized event on 401', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session expired',
        },
      }),
    });

    await expect(apiRequest('/api/auth/me')).rejects.toThrow('Session expired');
    expect(dispatchSpy).toHaveBeenCalled();
  });
});

describe('API URL Configuration Helpers', () => {
  it('returns configured backend URL from environment variables', () => {
    const backendUrl = getBackendUrl();
    expect(backendUrl).toBe('http://localhost:8000');
  });

  it('returns configured API index from environment variables', () => {
    const apiIndex = getApiIndex();
    expect(apiIndex).toBe('/api');
  });

  it('combines backend URL and API index in getApiBaseUrl()', () => {
    const base = getApiBaseUrl();
    expect(base).toBe('http://localhost:8000/api');
  });

  it('buildApiUrl builds normalized full URL with backend URL and API index', () => {
    // Calling with endpoint without index prefix
    const url1 = buildApiUrl('/spaces');
    expect(url1.toString()).toBe('http://localhost:8000/api/spaces');

    // Calling with endpoint with index prefix
    const url2 = buildApiUrl('/api/spaces');
    expect(url2.toString()).toBe('http://localhost:8000/api/spaces');

    // Calling with query params
    const url3 = buildApiUrl('/spaces', { city: 'Mumbai', pageSize: 10 });
    expect(url3.toString()).toBe('http://localhost:8000/api/spaces?city=Mumbai&pageSize=10');
  });
});
