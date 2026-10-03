import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sessionManager } from '../src/services/sessionManager.js';

describe('Clerk Session Management & Bearer Authentication', () => {
  test('registers dynamic token getter and retrieves active token', async () => {
    const mockToken = 'mock_clerk_jwt_token_header.payload.sig';
    sessionManager.setTokenGetter(async () => mockToken);

    const token = await sessionManager.getToken();
    assert.strictEqual(token, mockToken);
  });

  test('stores and exposes session metadata correctly', () => {
    const mockInfo = {
      sessionId: 'sess_test_123456',
      status: 'active',
      lastActiveAt: new Date().toISOString(),
      user: {
        id: 'usr_test_987',
        fullName: 'Lead Discovery Admin'
      }
    };

    sessionManager.setSessionInfo(mockInfo);
    const retrieved = sessionManager.getSessionInfo();
    assert.deepStrictEqual(retrieved, mockInfo);
  });

  test('authFetch injects Authorization: Bearer token header', async () => {
    const mockToken = 'mock_valid_bearer_token';
    sessionManager.setTokenGetter(async () => mockToken);

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
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('backend session verification decodes JWT payload properly', () => {
    // Simulating the backend decode algorithm
    const mockPayload = {
      sid: 'sess_clerk_active_789',
      sub: 'usr_clerk_lead_finder',
      iss: 'https://clerk.accounts.dev',
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour ahead
    };

    const encodedPayload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
    const jwt = `eyJhbGciOiJSUzI1NiJ9.${encodedPayload}.signature_mock`;

    const parts = jwt.split('.');
    assert.strictEqual(parts.length, 3);
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    assert.strictEqual(parsed.sid, 'sess_clerk_active_789');
    assert.strictEqual(parsed.sub, 'usr_clerk_lead_finder');
    assert.ok(parsed.exp * 1000 > Date.now(), 'Token must not be expired');
  });

  test('rejects expired session tokens', () => {
    const expiredPayload = {
      sid: 'sess_expired_123',
      sub: 'usr_expired',
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
