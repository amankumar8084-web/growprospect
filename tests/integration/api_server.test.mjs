import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';

describe('Node.js Backend API Server Integration', () => {
  let serverProcess;
  const API_URL = 'http://localhost:3099';

  before(async () => {
    // Start API server on custom test port 3099
    serverProcess = spawn('node', ['apps/api/src/server.js'], {
      env: { ...process.env, PORT: '3099' },
      stdio: 'pipe'
    });

    // Wait 1200ms for server to bind
    await new Promise((resolve) => setTimeout(resolve, 1200));
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('GET /api/health returns healthy status', async () => {
    const res = await fetch(`${API_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
  });

  test('POST /api/auth/login validates credentials from environment', async () => {
    // 1. Success case
    const successRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'leadscrape2026' })
    });
    assert.strictEqual(successRes.status, 200);
    const successData = await successRes.json();
    assert.strictEqual(successData.success, true);
    assert.ok(successData.token !== undefined);

    // 2. Failure case
    const failRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert.strictEqual(failRes.status, 401);
    const failData = await failRes.json();
    assert.strictEqual(failData.success, false);
  });

  test('GET /api/scrapers lists all 4 scraper engines', async () => {
    const res = await fetch(`${API_URL}/api/scrapers`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.scrapers.length, 4);
  });

  test('POST /api/runs dispatches a background scraper run', async () => {
    const res = await fetch(`${API_URL}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scraperId: 'no-website-biz',
        filters: { city: 'Austin, TX', country: 'US', maxResults: 10 }
      })
    });

    assert.strictEqual(res.status, 202);
    const data = await res.json();
    assert.ok(data.run.id.startsWith('RUN-'));
    assert.strictEqual(data.run.status, 'running');
  });

  test('POST /api/enrich performs Crawlee domain audit', async () => {
    const res = await fetch(`${API_URL}/api/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://chicago-apex-dental.com' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.enrichment.audit !== undefined);
  });
});
