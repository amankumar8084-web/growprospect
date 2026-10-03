/**
 * Centralized JWT Session Manager for GrowProspect
 * Manages JWT Access Tokens, Refresh Tokens, bcrypt Authentication,
 * Authenticated API requests with auto-refresh on 401, and Role Isolation.
 */

import { normalizeRole } from '../constants/crm.js';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_API_URL) || 
  'http://localhost:3001';

const TOKEN_KEY = 'gp_access_token';
const REFRESH_TOKEN_KEY = 'gp_refresh_token';
const USER_KEY = 'gp_user_info';

let currentSessionInfo = null;
let activeOrgId = 'org_default';
let activeRole = 'admin';
let isRefreshing = false;
let refreshPromise = null;
const listeners = new Set();

export const sessionManager = {
  /**
   * Initialize session from localStorage on startup
   */
  async initSession() {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      const token = localStorage.getItem(TOKEN_KEY);

      if (storedUser && token) {
        const userObj = JSON.parse(storedUser);
        currentSessionInfo = {
          user: userObj,
          role: userObj.role || 'admin',
          orgId: userObj.orgId || userObj.org_id || 'org_default'
        };
        activeOrgId = currentSessionInfo.orgId;
        activeRole = currentSessionInfo.role;
        this.notify();
      }
    } catch {
      // Storage access fail safe
    }
  },

  /**
   * Set active organization ID for multi-tenant isolation
   */
  setOrgId(orgId) {
    activeOrgId = orgId || 'org_default';
    if (currentSessionInfo) {
      currentSessionInfo.orgId = activeOrgId;
      if (currentSessionInfo.user) currentSessionInfo.user.orgId = activeOrgId;
    }
    this.notify();
  },

  /**
   * Get active organization ID
   */
  getOrgId() {
    return activeOrgId || currentSessionInfo?.orgId || 'org_default';
  },

  /**
   * Set active organization role ('admin' | 'manager' | 'rep')
   */
  setRole(role) {
    activeRole = normalizeRole(role);
    if (currentSessionInfo) {
      currentSessionInfo.role = activeRole;
      if (currentSessionInfo.user) currentSessionInfo.user.role = activeRole;
    }
    this.notify();
  },

  /**
   * Get active organization role
   */
  getRole() {
    return activeRole || currentSessionInfo?.role || 'rep';
  },

  /**
   * Set session information
   */
  setSessionInfo(sessionInfo) {
    currentSessionInfo = sessionInfo;
    if (sessionInfo?.orgId) {
      activeOrgId = sessionInfo.orgId;
    }
    if (sessionInfo?.role) {
      activeRole = normalizeRole(sessionInfo.role);
    }
    if (sessionInfo?.user) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(sessionInfo.user));
      } catch {}
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
   * Check if user is authenticated
   */
  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY) && currentSessionInfo?.user);
  },

  /**
   * Fetch the current active Access Token
   */
  async getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Fetch the Refresh Token
   */
  getRefreshToken() {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Login with email & password via JWT API
   */
  async login(identifier, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, email: identifier, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to login');
    }

    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    if (data.user) {
      this.setSessionInfo({
        user: data.user,
        role: data.user.role || 'admin',
        orgId: data.user.orgId || 'org_default'
      });
    }

    this.notify({ event: 'login', user: data.user });
    return data;
  },

  /**
   * Register a new user with bcrypt & JWT
   */
  async register({ name, email, password, role = 'admin', orgName = 'My Organization' }) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, orgName })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register account');
    }

    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    if (data.user) {
      this.setSessionInfo({
        user: data.user,
        role: data.user.role || 'admin',
        orgId: data.user.orgId || 'org_default'
      });
    }

    this.notify({ event: 'register', user: data.user });
    return data;
  },

  /**
   * Log out user and clear tokens
   */
  async logout() {
    const refreshToken = this.getRefreshToken();
    try {
      if (refreshToken) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch {
      // Best effort
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    currentSessionInfo = null;
    this.notify({ event: 'logout' });
  },

  /**
   * Force refresh the Access Token using the Refresh Token flow
   */
  async refreshToken() {
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.accessToken) {
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
          }
          if (data.user) {
            this.setSessionInfo({
              user: data.user,
              role: data.user.role,
              orgId: data.user.orgId
            });
          }
          this.notify({ event: 'token_refreshed', token: data.accessToken });
          return data.accessToken;
        } else {
          // Token expired or invalid -> sign out
          this.logout();
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
      console.warn('[sessionManager] 401 detected. Attempting JWT Refresh Token cycle for:', url);
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
   */
  async verifySessionWithBackend(apiUrl = API_BASE) {
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

// Initialize stored session immediately
sessionManager.initSession();
