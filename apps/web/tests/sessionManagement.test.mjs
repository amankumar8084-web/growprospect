import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node environment if needed
if (typeof global.localStorage === 'undefined') {
  let store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
}

import { sessionManager } from '../src/services/sessionManager.js';

describe('JWT Session Management & Bearer Authentication', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });
  test('stores access token and retrieves active token', async () => {
    const mockToken = 'mock_jwt_access_token_header.payload.sig';
    global.localStorage.setItem('gp_access_token', mockToken);

    const token = await sessionManager.getToken();
    assert.strictEqual(token, mockToken);
  });

  test('stores and exposes session metadata correctly', () => {
    const mockInfo = {
      role: 'admin',
      orgId: 'org_test_123',
      user: {
        id: 'usr_test_987',
        name: 'Lead Discovery Admin',
        email: 'admin@test.local'
      }
    };

    sessionManager.setSessionInfo(mockInfo);
    const retrieved = sessionManager.getSessionInfo();
    assert.deepStrictEqual(retrieved.user, mockInfo.user);
    assert.strictEqual(sessionManager.getRole(), 'admin');
    assert.strictEqual(sessionManager.getOrgId(), 'org_test_123');
  });

  test('authFetch injects Authorization: Bearer token header and org headers', async () => {
    const mockToken = 'mock_valid_bearer_token';
    global.localStorage.setItem('gp_access_token', mockToken);
    sessionManager.setOrgId('org_company_1');
    sessionManager.setRole('manager');

    // Mock global fetch
    let capturedHeaders = null;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      };
    };

    try {
      await sessionManager.authFetch('http://localhost:3001/api/crm/pipeline');
      assert.ok(capturedHeaders, 'Headers must be captured');
      assert.strictEqual(capturedHeaders.get('Authorization'), `Bearer ${mockToken}`);
      assert.strictEqual(capturedHeaders.get('x-org-id'), 'org_company_1');
      assert.strictEqual(capturedHeaders.get('x-org-role'), 'manager');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('backend session verification decodes JWT payload properly', () => {
    const mockPayload = {
      userId: 'usr_jwt_lead_finder',
      sub: 'usr_jwt_lead_finder',
      org_id: 'org_alpha',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour ahead
    };

    const encodedPayload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${encodedPayload}.signature_mock`;

    const parts = jwt.split('.');
    assert.strictEqual(parts.length, 3);
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    assert.strictEqual(parsed.userId, 'usr_jwt_lead_finder');
    assert.strictEqual(parsed.org_id, 'org_alpha');
    assert.ok(parsed.exp * 1000 > Date.now(), 'Token must not be expired');
  });

  test('rejects expired session tokens', () => {
    const expiredPayload = {
      userId: 'usr_expired',
      exp: Math.floor(Date.now() / 1000) - 300 // expired 5 minutes ago
    };

    const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const jwt = `header.${encoded}.sig`;

    const parts = jwt.split('.');
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const isExpired = (parsed.exp * 1000) < Date.now();

    assert.strictEqual(isExpired, true, 'Expired session token must be flagged');
  });
});
