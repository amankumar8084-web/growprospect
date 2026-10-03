import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { getTestKeyPair, createTestToken } from '../../apps/api/src/middlewares/authMiddleware.js';

describe('Node.js Backend API Server Integration', () => {
  let serverProcess;
  const API_URL = 'http://localhost:3099';
  const keyPair = getTestKeyPair();
  const adminToken = createTestToken({ role: 'admin', orgId: 'org_test' });

  before(async () => {
    // Start API server on custom test port 3099 with test JWT public key
    serverProcess = spawn('node', ['apps/api/src/server.js'], {
      env: { ...process.env, PORT: '3099', NODE_ENV: 'test', CLERK_JWT_KEY: keyPair.publicKey },
      stdio: 'pipe'
    });

    // Wait for server to bind with health check polling
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        if (res.ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('GET /api/health returns healthy status without authentication', async () => {
    const res = await fetch(`${API_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
  });

  test('Protected routes reject requests without token with 401 Unauthorized', async () => {
    const res = await fetch(`${API_URL}/api/scrapers`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /Unauthorized/i);
  });

  test('Protected routes reject expired and tampered tokens with 401 Unauthorized', async () => {
    const expiredToken = createTestToken({ expiresInSeconds: -10 });
    const expiredRes = await fetch(`${API_URL}/api/scrapers`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(expiredRes.status, 401);

    const tamperedToken = createTestToken({ tamper: true });
    const tamperedRes = await fetch(`${API_URL}/api/scrapers`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    assert.strictEqual(tamperedRes.status, 401);
  });

  test('GET /api/scrapers succeeds with valid token', async () => {
    const res = await fetch(`${API_URL}/api/scrapers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.scrapers.length, 4);
  });

  test('POST /api/runs dispatches a background scraper run with valid token', async () => {
    const res = await fetch(`${API_URL}/api/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        scraperId: 'no-website-biz',
        filters: { city: 'Austin, TX', country: 'US', maxResults: 10 }
      })
    });

    assert.strictEqual(res.status, 202);
    const data = await res.json();
    assert.ok(data.run.id.startsWith('RUN-'));
    assert.strictEqual(data.run.status, 'running');
    assert.strictEqual(data.run.org_id, 'org_test');
  });

  test('POST /api/enrich performs Crawlee domain audit with valid token', async () => {
    const res = await fetch(`${API_URL}/api/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ url: 'http://chicago-apex-dental.com' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.enrichment.audit !== undefined);
  });
});
