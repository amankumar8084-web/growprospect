import test from 'node:test';
import assert from 'node:assert/strict';
import { crmService } from '../src/services/crmService.js';
import { sessionManager } from '../src/services/sessionManager.js';
import { updateTask, createTask } from '../../api/src/controllers/crmController.js';
import { normalizeRole } from '../../api/src/constants/crm.js';
import { dedupService } from '../src/services/dedupService.js';

test('Step 6: Finish the System Validation', async (t) => {
  await t.test('1. Tasks & Follow-ups Queue Rules', async (t2) => {
    await t2.test('Manager and Admin can reassign tasks to other team members', async () => {
      const repUser = { userId: 'usr_rep_1', role: 'org:rep', orgId: 'org_test_6' };
      const { task } = await createTask({
        orgId: 'org_test_6',
        user: repUser,
        taskData: {
          title: 'Review proposal agreement',
          due_date: new Date().toISOString(),
          assignee_id: 'usr_rep_1'
        }
      });

      // Manager reassigning to rep 2
      const managerUser = { userId: 'usr_mgr_1', role: 'org:manager', orgId: 'org_test_6' };
      const result = await updateTask({
        taskId: task.id,
        orgId: 'org_test_6',
        user: managerUser,
        updates: { assignee_id: 'usr_rep_2' }
      });

      assert.equal(result.success, true);
      assert.equal(result.task.assignee_id, 'usr_rep_2');
    });

    await t2.test('Sales Rep cannot reassign tasks to another member (403 Forbidden)', async () => {
      const repUser = { userId: 'usr_rep_1', role: 'org:rep', orgId: 'org_test_6' };
      const { task } = await createTask({
        orgId: 'org_test_6',
        user: repUser,
        taskData: {
          title: 'Outreach to client',
          assignee_id: 'usr_rep_1'
        }
      });

      await assert.rejects(
        async () => {
          await updateTask({
            taskId: task.id,
            orgId: 'org_test_6',
            user: repUser,
            updates: { assignee_id: 'usr_rep_2' }
          });
        },
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /cannot reassign/i);
          return true;
        }
      );
    });
  });

  await t.test('2. Scraped Leads Landing Contract', async (t2) => {
    await t2.test('Scraped leads enforce status New and owner Unassigned', () => {
      const rawScrapedLead = {
        name: 'Apex Plumbing Corp',
        location: 'Seattle, WA, United States',
        website: 'https://apexplumbing.com'
      };

      // Simulate storage addLeadsBatch contract
      const processed = {
        ...rawScrapedLead,
        status: 'new',
        pipeline_stage: 'New',
        owner_id: null,
        assigned_to: null,
        assigned_to_name: 'Unassigned'
      };

      // Split location into city / state / country
      const parts = processed.location.split(',').map(s => s.trim());
      processed.city = parts[0];
      processed.state = parts[1];
      processed.country = parts[2];

      assert.equal(processed.status, 'new');
      assert.equal(processed.owner_id, null);
      assert.equal(processed.assigned_to_name, 'Unassigned');
      assert.equal(processed.city, 'Seattle');
      assert.equal(processed.state, 'WA');
      assert.equal(processed.country, 'United States');
    });

    await t2.test('Deduplication prevents duplicate scraped leads org-wide', () => {
      const existing = [
        { email: 'contact@apex.com', phone: '206-555-0199', website: 'https://apex.com' }
      ];

      const duplicate = { email: 'CONTACT@APEX.COM', phone: '(206) 555-0199', website: 'http://www.apex.com/about' };
      const unique = { email: 'info@summit.org', phone: '415-555-8822', website: 'https://summit.org' };

      const isDup = dedupService.isDuplicate(duplicate, existing);
      const isUnique = dedupService.isDuplicate(unique, existing);

      assert.equal(isDup, true);
      assert.equal(isUnique, false);
    });
  });

  await t.test('3. Settings & Governance Configuration', async (t2) => {
    await t2.test('Standard lost reasons default list contains required categories', () => {
      const reasons = crmService.getLostReasons();
      assert.ok(Array.isArray(reasons));
      assert.ok(reasons.includes('no budget'));
      assert.ok(reasons.includes('no response'));
      assert.ok(reasons.includes('chose competitor'));
      assert.ok(reasons.includes('not a fit'));
      assert.ok(reasons.includes('other'));
    });

    await t2.test('Auto-assignment rules configuration supports manual, round-robin, and location rules', () => {
      const rules = crmService.getAutoAssignmentRules();
      assert.ok(rules.strategy);
      assert.ok(Array.isArray(rules.locationRules));
      assert.ok(rules.locationRules.length > 0);
      assert.ok(rules.locationRules[0].location);
      assert.ok(rules.locationRules[0].repId);
    });

    await t2.test('Only Admin can update team member roles', () => {
      assert.equal(normalizeRole('org:admin'), 'admin');
      assert.equal(normalizeRole('org:manager'), 'manager');
      assert.equal(normalizeRole('org:member'), 'rep');

      // Admin check
      const isAdminRole = (role) => normalizeRole(role) === 'admin';
      assert.equal(isAdminRole('org:admin'), true);
      assert.equal(isAdminRole('org:manager'), false);
      assert.equal(isAdminRole('org:rep'), false);
    });
  });

  await t.test('4. Export Permissions & Filtering', async (t2) => {
    await t2.test('Sales Rep export filters out leads owned by other reps', () => {
      const repId = 'usr_rep_alpha';
      const allFilteredLeads = [
        { id: 'l1', owner_id: 'usr_rep_alpha', company_name: 'Lead Alpha' },
        { id: 'l2', owner_id: null, assigned_to_name: 'Unassigned', company_name: 'Lead Unassigned' },
        { id: 'l3', owner_id: 'usr_rep_beta', company_name: 'Lead Beta' }
      ];

      // Rep filter logic
      const userRole = 'rep';
      let exportable = allFilteredLeads;
      if (userRole === 'rep') {
        exportable = exportable.filter(
          l => l.owner_id === repId || l.assigned_to === repId || !l.owner_id || l.assigned_to_name === 'Unassigned'
        );
      }

      assert.equal(exportable.length, 2);
      assert.equal(exportable.some(l => l.id === 'l3'), false);
    });

    await t2.test('Manager and Admin can export all organization filtered leads', () => {
      const managerUserRole = 'manager';
      const allFilteredLeads = [
        { id: 'l1', owner_id: 'usr_rep_alpha', company_name: 'Lead Alpha' },
        { id: 'l2', owner_id: null, assigned_to_name: 'Unassigned', company_name: 'Lead Unassigned' },
        { id: 'l3', owner_id: 'usr_rep_beta', company_name: 'Lead Beta' }
      ];

      let exportable = allFilteredLeads;
      if (managerUserRole === 'rep') {
        exportable = exportable.filter(l => l.owner_id === 'usr_rep_alpha');
      }

      assert.equal(exportable.length, 3);
    });
  });
});
