/**
 * Centralized Session Manager for GrowProspect
 * Manages Clerk session Access Tokens, Token Refresh mechanisms,
 * Authenticated API requests with auto-refresh on 401, and Session Diagnostics.
 */

import { normalizeRole } from '../constants/crm.js';

let tokenGetter = null;
let refreshTokenGetter = null;
let currentSessionInfo = null;
let activeOrgId = 'org_default';
let activeRole = 'rep';
let isRefreshing = false;
let refreshPromise = null;
const listeners = new Set();

export const sessionManager = {
  /**
   * Set active organization ID for multi-tenant isolation
   * @param {string} orgId 
   */
  setOrgId(orgId) {
    activeOrgId = orgId || 'org_default';
    this.notify();
  },

  /**
   * Get active organization ID
   */
  getOrgId() {
    return activeOrgId;
  },

  /**
   * Set active organization role ('admin' | 'manager' | 'rep')
   * @param {string} role 
   */
  setRole(role) {
    activeRole = normalizeRole(role);
    this.notify();
  },

  /**
   * Get active organization role
   */
  getRole() {
    return activeRole;
  },

  /**
   * Register Clerk's Access Token & Refresh Token suppliers
   * @param {Function} getterAsync Async function returning access token string
   * @param {Function} [refreshGetterAsync] Async function forcing fresh token (skipCache)
   */
  setTokenGetter(getterAsync, refreshGetterAsync = null) {
    tokenGetter = getterAsync;
    refreshTokenGetter = refreshGetterAsync || getterAsync;
    this.notify();
  },

  /**
   * Update cached session metadata for display and inspection
   * @param {Object} sessionInfo
   */
  setSessionInfo(sessionInfo) {
    currentSessionInfo = sessionInfo;
    if (sessionInfo?.orgId) {
      activeOrgId = sessionInfo.orgId;
    }
    if (sessionInfo?.role) {
      activeRole = sessionInfo.role;
    }
    this.notify();
  },

  /**
   * Retrieve current cached session info
   */
  getSessionInfo() {
    return currentSessionInfo;
  },

  /**
   * Fetch the current active Access Token
   * @returns {Promise<string|null>}
   */
  async getToken() {
    if (typeof tokenGetter === 'function') {
      try {
        const token = await tokenGetter();
        if (token) return token;
      } catch (err) {
        console.warn('[sessionManager] Failed to get Clerk access token:', err);
      }
    }

    // Fallback to local storage if available
    try {
      const fallback = localStorage.getItem('ms_auth_token');
      if (fallback) return fallback;
    } catch {
      // Storage access might fail in private mode
    }

    return null;
  },

  /**
   * Force refresh the Access Token using the Refresh Token flow
   * Deduplicates concurrent refresh calls
   * @returns {Promise<string|null>}
   */
  async refreshToken() {
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        if (typeof refreshTokenGetter === 'function') {
          const newToken = await refreshTokenGetter();
          if (newToken) {
            try {
              localStorage.setItem('ms_auth_token', newToken);
            } catch {}
            this.notify({ event: 'token_refreshed', token: newToken });
            return newToken;
          }
        }
      } catch (err) {
        console.warn('[sessionManager] Token refresh failed:', err);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
      return null;
    })();

    return refreshPromise;
  },

  /**
   * Perform an authenticated fetch request attaching Authorization: Bearer <token>.
   * If a 401 Unauthorized occurs, it automatically performs a Refresh Token cycle
   * and retries the request once before failing.
   * @param {string} url 
   * @param {RequestInit} [options={}] 
   * @returns {Promise<Response>}
   */
  async authFetch(url, options = {}) {
    let token = await this.getToken();
    const headers = new Headers(options.headers || {});

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('x-org-id') && activeOrgId) {
      headers.set('x-org-id', activeOrgId);
    }

    if (!headers.has('x-org-role') && activeRole) {
      headers.set('x-org-role', activeRole);
    }

    let modifiedOptions = {
      ...options,
      headers
    };

    let res = await fetch(url, modifiedOptions);

    // Auto-refresh token on 401 Unauthorized and retry once
    if (res.status === 401) {
      console.warn('[sessionManager] 401 detected for request. Attempting Refresh Token cycle for:', url);
      const freshToken = await this.refreshToken();

      if (freshToken) {
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${freshToken}`);
        if (!retryHeaders.has('x-org-id') && activeOrgId) {
          retryHeaders.set('x-org-id', activeOrgId);
        }
        if (!retryHeaders.has('x-org-role') && activeRole) {
          retryHeaders.set('x-org-role', activeRole);
        }

        res = await fetch(url, {
          ...options,
          headers: retryHeaders
        });
      }

      if (res.status === 401) {
        this.notify({ event: 'unauthorized', status: 401, url });
      }
    }

    return res;
  },

  /**
   * Verify session with the backend API /api/auth/session
   * @param {string} [apiUrl]
   */
  async verifySessionWithBackend(apiUrl = 'http://localhost:3001') {
    const startTime = performance.now();
    try {
      const token = await this.getToken();
      const res = await fetch(`${apiUrl}/api/auth/session`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => ({}));

      return {
        ok: res.ok,
        status: res.status,
        latencyMs,
        data,
        authenticated: data.authenticated || false,
        session: data.session || null
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        latencyMs: Math.round(performance.now() - startTime),
        error: err.message
      };
    }
  },

  /**
   * Subscribe to session state updates
   */
  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  notify(eventData) {
    listeners.forEach((cb) => {
      try {
        cb(eventData || currentSessionInfo);
      } catch (err) {
        console.error('[sessionManager] Listener error:', err);
      }
    });
  }
};
