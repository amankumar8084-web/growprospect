import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { getTestKeyPair, createTestToken } from '../../apps/api/src/middlewares/authMiddleware.js';
import { createTenantDb, validateOrgId, filterStoreByTenantAndRole } from '../../apps/api/src/db/tenantQuery.js';

describe('Tenant Isolation & Cryptographic Role Security Tests', () => {
  let serverProcess;
  const API_URL = 'http://localhost:3098';
  const keyPair = getTestKeyPair();

  // Test Tokens for multiple organizations and roles
  const orgA_Admin = createTestToken({ userId: 'usr_orgA_admin', orgId: 'org_alpha', role: 'admin' });
  const orgA_Manager = createTestToken({ userId: 'usr_orgA_mgr', orgId: 'org_alpha', role: 'manager' });
  const orgA_Rep1 = createTestToken({ userId: 'usr_orgA_rep1', orgId: 'org_alpha', role: 'rep' });
  const orgA_Rep2 = createTestToken({ userId: 'usr_orgA_rep2', orgId: 'org_alpha', role: 'rep' });

  const orgB_Admin = createTestToken({ userId: 'usr_orgB_admin', orgId: 'org_beta', role: 'admin' });
  const orgB_Manager = createTestToken({ userId: 'usr_orgB_mgr', orgId: 'org_beta', role: 'manager' });
  const orgB_Rep = createTestToken({ userId: 'usr_orgB_rep', orgId: 'org_beta', role: 'rep' });

  before(async () => {
    // Start API server on custom test port 3098 with test JWT public key
    serverProcess = spawn('node', ['apps/api/src/server.js'], {
      env: { ...process.env, PORT: '3098', NODE_ENV: 'test', CLERK_JWT_KEY: keyPair.publicKey },
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

  // -------------------------------------------------------------
  // 1. Mandatory Route Protection & Token Verification
  // -------------------------------------------------------------
  describe('1. Protection of all /api endpoints except /api/health', () => {
    test('GET /api/health is the ONLY public endpoint and responds 200', async () => {
      const res = await fetch(`${API_URL}/api/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'healthy');
    });

    test('All other /api endpoints reject unauthenticated requests with 401', async () => {
      const endpoints = [
        { path: '/api/leads', method: 'GET' },
        { path: '/api/analytics', method: 'GET' },
        { path: '/api/runs', method: 'GET' },
        { path: '/api/scrapers', method: 'GET' },
        { path: '/api/crm/pipeline', method: 'GET' },
        { path: '/api/crm/team', method: 'GET' }
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${API_URL}${ep.path}`, { method: ep.method });
        assert.strictEqual(
          res.status, 
          401, 
          `Expected 401 for unauthenticated ${ep.method} ${ep.path}, got ${res.status}`
        );
        const data = await res.json();
        assert.strictEqual(data.success, false);
      }
    });

    test('Rejects expired token with 401 Unauthorized', async () => {
      const expiredToken = createTestToken({ orgId: 'org_alpha', expiresInSeconds: -60 });
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /expired/i);
    });

    test('Rejects tampered signature token with 401 Unauthorized', async () => {
      const tamperedToken = createTestToken({ orgId: 'org_alpha', tamper: true });
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${tamperedToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /invalid|failed|unauthorized/i);
    });
  });

  // -------------------------------------------------------------
  // 2. Role-Based Access Control (Admin, Manager, Rep)
  // -------------------------------------------------------------
  describe('2. Role-Based Access Control (requireRole)', () => {
    test('Rep is forbidden from inviting team members (403)', async () => {
      const res = await fetch(`${API_URL}/api/crm/team/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({ name: 'New Rep', email: 'rep@org.local', role: 'rep' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Forbidden/i);
    });

    test('Rep is forbidden from dispatching scraper runs (403)', async () => {
      const res = await fetch(`${API_URL}/api/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({ scraperId: 'no-website-biz' })
      });
      assert.strictEqual(res.status, 403);
    });

    test('Manager CAN dispatch scraper runs (202)', async () => {
      const res = await fetch(`${API_URL}/api/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ scraperId: 'no-website-biz', filters: { city: 'Denver' } })
      });
      assert.strictEqual(res.status, 202);
      const data = await res.json();
      assert.strictEqual(data.run.org_id, 'org_alpha');
    });

    test('Admin CAN invite team members, Rep is forbidden', async () => {
      // Rep forbidden
      const repRes = await fetch(`${API_URL}/api/crm/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({ name: 'New Rep', email: 'rep@org.com', role: 'rep' })
      });
      assert.strictEqual(repRes.status, 403);

      // Admin allowed
      const adminRes = await fetch(`${API_URL}/api/crm/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Admin}`
        },
        body: JSON.stringify({ name: 'New Rep Added', email: 'rep2@org.com', role: 'rep' })
      });
      assert.strictEqual(adminRes.status, 201);
      const data = await adminRes.json();
      assert.strictEqual(data.member.org_id, 'org_alpha');
    });
  });

  // -------------------------------------------------------------
  // 3. Multi-Tenant Isolation: Org A cannot read Org B's leads
  // -------------------------------------------------------------
  describe('3. Multi-Tenant Isolation (Org A vs Org B)', () => {
    let orgALeadId;
    let orgBLeadId;

    test('Org A manager creates lead for Org A', async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          company_name: 'Apex Dental Org A',
          city: 'Chicago',
          deal_value: 12000,
          pipeline_stage: 'New'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.lead.org_id, 'org_alpha');
      orgALeadId = data.lead.id;
    });

    test('Org B manager creates lead for Org B', async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgB_Manager}`
        },
        body: JSON.stringify({
          company_name: 'Beta Solar Org B',
          city: 'Miami',
          deal_value: 25000,
          pipeline_stage: 'Contacted'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.lead.org_id, 'org_beta');
      orgBLeadId = data.lead.id;
    });

    test('Org A manager CAN read Org A lead, but CANNOT see Org B lead', async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      
      const foundOrgALead = data.leads.some((l) => l.id === orgALeadId);
      const foundOrgBLead = data.leads.some((l) => l.id === orgBLeadId);

      assert.strictEqual(foundOrgALead, true, 'Org A must see its own lead');
      assert.strictEqual(foundOrgBLead, false, 'PROVEN: Org A CANNOT read Org B leads');
    });

    test('Org B manager CAN read Org B lead, but CANNOT see Org A lead', async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${orgB_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      const foundOrgALead = data.leads.some((l) => l.id === orgALeadId);
      const foundOrgBLead = data.leads.some((l) => l.id === orgBLeadId);

      assert.strictEqual(foundOrgBLead, true, 'Org B must see its own lead');
      assert.strictEqual(foundOrgALead, false, 'PROVEN: Org B CANNOT read Org A leads');
    });

    test('Org B user cannot update stage of Org A lead (404 Not Found)', async () => {
      const res = await fetch(`${API_URL}/api/crm/leads/${orgALeadId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgB_Manager}`
        },
        body: JSON.stringify({ stage: 'Proposal' })
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /not found/i);
    });

    test('Org B user cannot delete Org A lead (404 Not Found)', async () => {
      const res = await fetch(`${API_URL}/api/leads/${orgALeadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${orgB_Manager}` }
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });
  });

  // -------------------------------------------------------------
  // 4. Sales Rep Visibility Rules (Own leads + Unassigned leads)
  // -------------------------------------------------------------
  describe('4. Sales Rep Scoped Visibility (rep sees own + unassigned only)', () => {
    let leadRep1Id;
    let leadRep2Id;
    let leadUnassignedId;

    before(async () => {
      // 1. Lead assigned to Rep 1
      const res1 = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}` // rep creation assigns to rep1
        },
        body: JSON.stringify({ company_name: 'Lead For Rep 1', pipeline_stage: 'New' })
      });
      const data1 = await res1.json();
      leadRep1Id = data1.lead.id;

      // 2. Lead assigned to Rep 2 by Manager
      const res2 = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          company_name: 'Lead For Rep 2',
          assigned_to: 'usr_orgA_rep2',
          pipeline_stage: 'Contacted'
        })
      });
      const data2 = await res2.json();
      leadRep2Id = data2.lead.id;

      // 3. Unassigned Lead created by Manager
      const res3 = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ company_name: 'Unassigned Pool Lead', pipeline_stage: 'New' })
      });
      const data3 = await res3.json();
      leadUnassignedId = data3.lead.id;
    });

    test('Rep 1 sees own lead and unassigned lead, but NOT Rep 2 lead', async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${orgA_Rep1}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      const ids = data.leads.map((l) => l.id);
      assert.ok(ids.includes(leadRep1Id), 'Rep 1 sees own lead');
      assert.ok(ids.includes(leadUnassignedId), 'Rep 1 sees unassigned lead');
      assert.ok(!ids.includes(leadRep2Id), 'Rep 1 CANNOT see Rep 2 lead');
    });

    test('Manager sees all leads across the organization', async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      const ids = data.leads.map((l) => l.id);
      assert.ok(ids.includes(leadRep1Id), 'Manager sees Rep 1 lead');
      assert.ok(ids.includes(leadRep2Id), 'Manager sees Rep 2 lead');
      assert.ok(ids.includes(leadUnassignedId), 'Manager sees unassigned lead');
    });

    test('Rep 1 cannot modify Rep 2 lead stage (403 Forbidden)', async () => {
      const res = await fetch(`${API_URL}/api/crm/leads/${leadRep2Id}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({ stage: 'Won' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Forbidden/i);
    });

    test('Rep 1 cannot reassign leads (403 Forbidden)', async () => {
      const res = await fetch(`${API_URL}/api/crm/leads/${leadRep1Id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({ assignedToUserId: 'usr_orgA_rep2' })
      });
      assert.strictEqual(res.status, 403);
    });

    test('Manager CAN reassign leads (200)', async () => {
      const res = await fetch(`${API_URL}/api/crm/leads/${leadRep1Id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ assignedToUserId: 'usr_orgA_rep2', assignedToName: 'Rep Two' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.lead.assigned_to, 'usr_orgA_rep2');
    });
  });

  // -------------------------------------------------------------
  // 5. Tenant Database Query Safety Helper Checks
  // -------------------------------------------------------------
  describe('5. Database Tenant Query Safety Helpers', () => {
    test('validateOrgId rejects empty or non-string orgId', () => {
      assert.throws(() => validateOrgId(null), /Tenant isolation violation: orgId is required/);
      assert.throws(() => validateOrgId(''), /Tenant isolation violation: orgId is required/);
      assert.strictEqual(validateOrgId('org_valid'), 'org_valid');
    });

    test('createTenantDb blocks queries omitting org_id', async () => {
      const mockClient = {
        query: async (sql, params) => ({ rows: [], rowCount: 0 })
      };
      const tenantDb = createTenantDb(mockClient, 'org_secure');

      // Query without org_id must throw error
      await assert.rejects(
        async () => {
          await tenantDb.query('SELECT * FROM leads WHERE id = $1', ['lead-123']);
        },
        /Security violation: Query executed without org_id tenant filter/
      );

      // Query WITH org_id passes
      const result = await tenantDb.query('SELECT * FROM leads WHERE org_id = $1', ['org_secure']);
      assert.strictEqual(result.rowCount, 0);
    });
  });
});
