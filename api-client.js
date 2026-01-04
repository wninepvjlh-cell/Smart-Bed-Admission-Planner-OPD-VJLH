(function initApiClient() {
  const DEFAULT_BASE_URL = 'http://localhost:4000/api';

  function resolveBaseUrl() {
    try {
      const stored = localStorage.getItem('sbp_api_base_url');
      if (stored && typeof stored === 'string') {
        return stored.replace(/\/$/, '');
      }
    } catch (error) {
      console.warn('Unable to read stored API base URL, using default', error);
    }
    return DEFAULT_BASE_URL;
  }

  function buildUrl(path) {
    const base = resolveBaseUrl();
    if (!path) {
      return base;
    }
    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  }

  function prepareRequestOptions(options = {}) {
    const finalOptions = { ...options };
    finalOptions.method = finalOptions.method || 'GET';

    const headers = new Headers(finalOptions.headers || {});
    const hasBody = finalOptions.body !== undefined && finalOptions.body !== null;

    if (hasBody) {
      if (!(finalOptions.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (headers.get('Content-Type') === 'application/json' && typeof finalOptions.body !== 'string') {
        finalOptions.body = JSON.stringify(finalOptions.body);
      }
    }

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    finalOptions.headers = headers;
    finalOptions.mode = finalOptions.mode || 'cors';

    return finalOptions;
  }

  async function request(path, options) {
    const url = buildUrl(path);
    const finalOptions = prepareRequestOptions(options);

    let response;
    try {
      response = await fetch(url, finalOptions);
    } catch (error) {
      const networkError = new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      networkError.cause = error;
      throw networkError;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const message = payload?.error?.message || `คำขอไม่สำเร็จ (รหัส ${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.details = payload?.error?.details;
      throw error;
    }

    return payload;
  }

  async function login(username, password) {
    return request('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
  }

  window.sbpApiClient = {
    login,
    request,
    getBaseUrl: resolveBaseUrl
  };
})();
