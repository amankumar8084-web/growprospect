import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { getTestKeyPair, createTestToken } from '../../apps/api/src/middlewares/authMiddleware.js';

describe('Step 2: Extended Data Model & CRM API Integration Tests', () => {
  let serverProcess;
  const API_URL = 'http://localhost:3097';
  const keyPair = getTestKeyPair();

  // Test Tokens for Org A and Org B
  const orgA_Manager = createTestToken({ userId: 'usr_mgr_alpha', orgId: 'org_alpha', role: 'manager' });
  const orgA_Rep1 = createTestToken({ userId: 'usr_rep1_alpha', orgId: 'org_alpha', role: 'rep' });
  const orgA_Rep2 = createTestToken({ userId: 'usr_rep2_alpha', orgId: 'org_alpha', role: 'rep' });

  const orgB_Manager = createTestToken({ userId: 'usr_mgr_beta', orgId: 'org_beta', role: 'manager' });
  const orgB_Rep = createTestToken({ userId: 'usr_rep_beta', orgId: 'org_beta', role: 'rep' });

  before(async () => {
    // Start API server on custom test port 3097 with test JWT public key
    serverProcess = spawn('node', ['apps/api/src/server.js'], {
      env: { ...process.env, PORT: '3097', NODE_ENV: 'test', CLERK_JWT_KEY: keyPair.publicKey },
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
  // 1. PATCH /api/leads/:id (Edit fields, status_change, lost_reason)
  // -------------------------------------------------------------
  describe('1. PATCH /api/leads/:id', () => {
    let testLeadId;

    before(async () => {
      // Create lead
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          company_name: 'Metro Cardiology Clinic',
          city: 'Chicago',
          state: 'IL',
          country: 'US',
          deal_value: 15000,
          status: 'new'
        })
      });
      const data = await res.json();
      testLeadId = data.lead.id;
    });

    test('Edits basic fields (deal_value, city, tags, notes)', async () => {
      const res = await fetch(`${API_URL}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          deal_value: 22000,
          city: 'Naperville',
          tags: ['Cardiology', 'High Priority'],
          notes: 'Spoke with office manager on Monday'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.lead.deal_value, 22000);
      assert.strictEqual(data.lead.city, 'Naperville');
      assert.deepStrictEqual(data.lead.tags, ['Cardiology', 'High Priority']);
      assert.strictEqual(data.lead.notes, 'Spoke with office manager on Monday');
    });

    test('Auto-creates status_change activity when status changes', async () => {
      const res = await fetch(`${API_URL}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ status: 'contacted' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.lead.status, 'contacted');

      // Fetch activities to confirm auto-created activity
      const actRes = await fetch(`${API_URL}/api/leads/${testLeadId}/activities`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(actRes.status, 200);
      const actData = await actRes.json();
      const statusAct = actData.activities.find((a) => a.type === 'status_change');
      assert.ok(statusAct, 'status_change activity must be created');
      assert.match(statusAct.body, /contacted/i);
    });

    test('Requires lost_reason when status is updated to lost', async () => {
      // Missing lost_reason -> 400
      const failRes = await fetch(`${API_URL}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ status: 'lost' })
      });
      assert.strictEqual(failRes.status, 400);
      const failData = await failRes.json();
      assert.match(failData.error, /lost_reason is required/i);

      // With lost_reason -> 200
      const okRes = await fetch(`${API_URL}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ status: 'lost', lost_reason: 'Budget cut for Q3' })
      });
      assert.strictEqual(okRes.status, 200);
      const okData = await okRes.json();
      assert.strictEqual(okData.lead.status, 'lost');
      assert.strictEqual(okData.lead.lost_reason, 'Budget cut for Q3');
    });

    test('Auto-creates assignment activity when owner is changed by manager', async () => {
      const res = await fetch(`${API_URL}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ owner_id: 'usr_rep1_alpha', assigned_to_name: 'Rep One' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.lead.owner_id, 'usr_rep1_alpha');

      // Check assignment activity
      const actRes = await fetch(`${API_URL}/api/leads/${testLeadId}/activities`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      const actData = await actRes.json();
      const assignAct = actData.activities.find((a) => a.type === 'assignment');
      assert.ok(assignAct, 'assignment activity must be created');
    });

    test('Rep cannot reassign lead to another rep (403 Forbidden)', async () => {
      const res = await fetch(`${API_URL}/api/leads/${testLeadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}` // rep 1 assigned to lead tries to assign to rep 2
        },
        body: JSON.stringify({ owner_id: 'usr_rep2_alpha' })
      });
      assert.strictEqual(res.status, 403);
    });
  });

  // -------------------------------------------------------------
  // 2. POST /api/leads/:id/claim (Rep claims unassigned lead)
  // -------------------------------------------------------------
  describe('2. POST /api/leads/:id/claim', () => {
    let unassignedLeadId;

    before(async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ company_name: 'Unassigned Pool Dentist' })
      });
      const data = await res.json();
      unassignedLeadId = data.lead.id;
    });

    test('Rep can claim an unassigned lead and becomes owner', async () => {
      const res = await fetch(`${API_URL}/api/leads/${unassignedLeadId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${orgA_Rep1}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.lead.owner_id, 'usr_rep1_alpha');
      assert.strictEqual(data.activity.type, 'assignment');
    });

    test('Rep cannot claim a lead that is already claimed (409 Conflict)', async () => {
      const res = await fetch(`${API_URL}/api/leads/${unassignedLeadId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${orgA_Rep2}` }
      });
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.match(data.error, /already claimed/i);
    });
  });

  // -------------------------------------------------------------
  // 3. POST /api/leads/bulk (status, assign, tag, delete)
  // -------------------------------------------------------------
  describe('3. POST /api/leads/bulk', () => {
    let leadIds = [];

    before(async () => {
      for (let i = 1; i <= 3; i++) {
        const res = await fetch(`${API_URL}/api/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${orgA_Manager}`
          },
          body: JSON.stringify({ company_name: `Bulk Candidate ${i}`, status: 'new' })
        });
        const data = await res.json();
        leadIds.push(data.lead.id);
      }
    });

    test('Bulk tag adds tags to multiple leads', async () => {
      const res = await fetch(`${API_URL}/api/leads/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          action: 'tag',
          lead_ids: leadIds,
          tags: ['Q3 Campaign', 'High Value']
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.affected, 3);

      // Verify lead tags
      const getRes = await fetch(`${API_URL}/api/leads?tag=Q3 Campaign`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      const getData = await getRes.json();
      assert.ok(getData.leads.length >= 3);
    });

    test('Bulk status updates status on leads', async () => {
      const res = await fetch(`${API_URL}/api/leads/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          action: 'status',
          lead_ids: leadIds.slice(0, 2),
          status: 'meeting'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.affected, 2);
    });

    test('Bulk assign requires manager role (Rep is 403 Forbidden)', async () => {
      const repRes = await fetch(`${API_URL}/api/leads/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({
          action: 'assign',
          lead_ids: leadIds,
          owner_id: 'usr_rep1_alpha'
        })
      });
      assert.strictEqual(repRes.status, 403);
    });

    test('Bulk delete removes leads', async () => {
      const toDelete = leadIds[2];
      const res = await fetch(`${API_URL}/api/leads/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          action: 'delete',
          lead_ids: [toDelete]
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.affected, 1);
    });
  });

  // -------------------------------------------------------------
  // 4. GET/POST /api/leads/:id/activities
  // -------------------------------------------------------------
  describe('4. Activities API (GET/POST /api/leads/:id/activities)', () => {
    let leadId;

    before(async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({ company_name: 'Activity Test Co' })
      });
      const data = await res.json();
      leadId = data.lead.id;
    });

    test('Creates call, whatsapp, and note activities', async () => {
      const types = ['call', 'whatsapp', 'note'];
      for (const type of types) {
        const res = await fetch(`${API_URL}/api/leads/${leadId}/activities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${orgA_Manager}`
          },
          body: JSON.stringify({
            type,
            body: `Completed ${type} with client`
          })
        });
        assert.strictEqual(res.status, 201);
        const data = await res.json();
        assert.strictEqual(data.activity.type, type);
        assert.strictEqual(data.activity.body, `Completed ${type} with client`);
      }

      // GET activities
      const getRes = await fetch(`${API_URL}/api/leads/${leadId}/activities`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(getRes.status, 200);
      const getData = await getRes.json();
      assert.ok(getData.activities.length >= 3);
    });

    test('Org B cannot access Org A lead activities (404)', async () => {
      const res = await fetch(`${API_URL}/api/leads/${leadId}/activities`, {
        headers: { Authorization: `Bearer ${orgB_Manager}` }
      });
      assert.strictEqual(res.status, 404);
    });
  });

  // -------------------------------------------------------------
  // 5. Tasks API (GET/POST/PATCH /api/tasks)
  // -------------------------------------------------------------
  describe('5. Tasks API (GET/POST/PATCH /api/tasks)', () => {
    let todayTaskId;
    let overdueTaskId;
    let upcomingTaskId;

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    before(async () => {
      // 1. Task due today
      const res1 = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({
          title: 'Follow up on proposal',
          due_date: todayStr
        })
      });
      const data1 = await res1.json();
      todayTaskId = data1.task.id;

      // 2. Overdue task
      const res2 = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({
          title: 'Send brochure',
          due_date: yesterdayStr
        })
      });
      const data2 = await res2.json();
      overdueTaskId = data2.task.id;

      // 3. Upcoming task
      const res3 = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({
          title: 'Schedule demo',
          due_date: tomorrowStr
        })
      });
      const data3 = await res3.json();
      upcomingTaskId = data3.task.id;
    });

    test('Filters tasks by due=today', async () => {
      const res = await fetch(`${API_URL}/api/tasks?due=today`, {
        headers: { Authorization: `Bearer ${orgA_Rep1}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tasks.some((t) => t.id === todayTaskId));
      assert.ok(!data.tasks.some((t) => t.id === overdueTaskId));
    });

    test('Filters tasks by due=overdue', async () => {
      const res = await fetch(`${API_URL}/api/tasks?due=overdue`, {
        headers: { Authorization: `Bearer ${orgA_Rep1}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tasks.some((t) => t.id === overdueTaskId));
      assert.ok(!data.tasks.some((t) => t.id === upcomingTaskId));
    });

    test('Filters tasks by due=upcoming', async () => {
      const res = await fetch(`${API_URL}/api/tasks?due=upcoming`, {
        headers: { Authorization: `Bearer ${orgA_Rep1}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.tasks.some((t) => t.id === upcomingTaskId));
      assert.ok(!data.tasks.some((t) => t.id === overdueTaskId));
    });

    test('PATCH /api/tasks/:id marks task as done', async () => {
      const res = await fetch(`${API_URL}/api/tasks/${overdueTaskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Rep1}`
        },
        body: JSON.stringify({ done: true })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.task.done, true);

      // Overdue filter excludes completed tasks
      const overdueRes = await fetch(`${API_URL}/api/tasks?due=overdue`, {
        headers: { Authorization: `Bearer ${orgA_Rep1}` }
      });
      const overdueData = await overdueRes.json();
      assert.ok(!overdueData.tasks.some((t) => t.id === overdueTaskId));
    });

    test('Org B cannot view Org A tasks', async () => {
      const res = await fetch(`${API_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${orgB_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.tasks.length, 0);
    });
  });

  // -------------------------------------------------------------
  // 6. GET /api/leads filters & GET /api/locations
  // -------------------------------------------------------------
  describe('6. GET /api/leads filters and GET /api/locations', () => {
    before(async () => {
      // Create leads with distinct city, state, country, status, tag
      await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          company_name: 'Tokyo Robotics',
          city: 'Tokyo',
          state: 'Tokyo',
          country: 'Japan',
          status: 'proposal',
          tags: ['Robotics', 'Asia'],
          deal_value: 50000
        })
      });

      await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          company_name: 'London Finance Corp',
          city: 'London',
          country: 'UK',
          status: 'won',
          tags: ['Finance'],
          deal_value: 80000
        })
      });
    });

    test('Filters leads by status=proposal', async () => {
      const res = await fetch(`${API_URL}/api/leads?status=proposal`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.leads.length > 0);
      assert.ok(data.leads.every((l) => (l.status || '').toLowerCase() === 'proposal'));
    });

    test('Filters leads by country=Japan and tag=Robotics', async () => {
      const res = await fetch(`${API_URL}/api/leads?country=Japan&tag=Robotics`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.leads.length, 1);
      assert.strictEqual(data.leads[0].company_name, 'Tokyo Robotics');
    });

    test('Filters leads by tab=unassigned', async () => {
      const res = await fetch(`${API_URL}/api/leads?tab=unassigned`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.leads.every((l) => !l.owner_id && !l.assigned_to));
    });

    test('GET /api/locations aggregates leads by city/country', async () => {
      const res = await fetch(`${API_URL}/api/locations`, {
        headers: { Authorization: `Bearer ${orgA_Manager}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.locations));
      assert.ok(data.locations.length >= 2);

      const tokyo = data.locations.find((l) => l.city === 'Tokyo');
      assert.ok(tokyo);
      assert.strictEqual(tokyo.country, 'Japan');
      assert.ok(tokyo.lead_count >= 1);
      assert.ok(tokyo.pipeline_value >= 50000);
    });

    test('Migrates old opportunityType into tags', async () => {
      // Lead with opportunityType
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgA_Manager}`
        },
        body: JSON.stringify({
          company_name: 'Opportunity Migrated Lead',
          opportunityType: 'Website Audit'
        })
      });
      const data = await res.json();
      assert.ok(data.lead.tags.includes('Website Audit'), 'opportunityType must be migrated into tags array');
    });
  });
});
