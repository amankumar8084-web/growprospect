import { test, describe } from 'node:test';
import assert from 'node:assert';
import { normalizeDomain, normalizePhone, normalizeEmail } from '../src/services/dedupService.js';
import { getCRMDashboard } from '../../api/src/controllers/crmController.js';

describe('Step 5: Import & CRM Dashboard Validation', () => {

  // -------------------------------------------------------------
  // 1. Cross-Organization Deduplication Logic (Step 5a)
  // -------------------------------------------------------------
  describe('1. Import Deduplication & Normalization', () => {
    test('Domain normalizer cleans protocols, subdomains, and trailing paths', () => {
      assert.strictEqual(normalizeDomain('https://www.acme-corp.com/about-us'), 'acme-corp.com');
      assert.strictEqual(normalizeDomain('http://sub.domain.io/page?id=123'), 'sub.domain.io');
      assert.strictEqual(normalizeDomain('WWW.OUTBOUND.AI/'), 'outbound.ai');
      assert.strictEqual(normalizeDomain('simple-site.org'), 'simple-site.org');
      assert.strictEqual(normalizeDomain(''), '');
      assert.strictEqual(normalizeDomain(null), '');
    });

    test('Phone normalizer extracts standardized numeric digits', () => {
      assert.strictEqual(normalizePhone('+1 (555) 234-5678'), '5552345678');
      assert.strictEqual(normalizePhone('+44 20 7946 0991'), '442079460991');
      assert.strictEqual(normalizePhone('555.432.1098 ext 12'), '555432109812');
      assert.strictEqual(normalizePhone(''), '');
      assert.strictEqual(normalizePhone(null), '');
    });

    test('Email normalizer trims whitespace and lowercases', () => {
      assert.strictEqual(normalizeEmail('  John.Doe@AcmeCorp.COM  '), 'john.doe@acmecorp.com');
      assert.strictEqual(normalizeEmail(''), '');
      assert.strictEqual(normalizeEmail(null), '');
    });

    test('Identifies duplicates across email, phone, and normalized domain', () => {
      const existingLeads = [
        { id: 'l1', email: 'alice@acme.com', phone: '+1 555 111 2222', website: 'https://acme.com' },
        { id: 'l2', email: 'bob@beta.org', phone: '+1 555 333 4444', website: 'https://beta.org' }
      ];

      const checkDuplicate = (row) => {
        const rowEmail = normalizeEmail(row.email);
        const rowPhone = normalizePhone(row.phone);
        const rowDomain = normalizeDomain(row.website);

        return existingLeads.find(l => {
          if (rowEmail && normalizeEmail(l.email) === rowEmail) return true;
          if (rowPhone && rowPhone.length >= 7 && normalizePhone(l.phone) === rowPhone) return true;
          if (rowDomain && normalizeDomain(l.website) === rowDomain) return true;
          return false;
        });
      };

      // Exact email match -> duplicate
      assert.ok(checkDuplicate({ email: 'ALICE@ACME.COM' }));

      // Phone match -> duplicate
      assert.ok(checkDuplicate({ phone: '(555) 111-2222' }));

      // Domain match with different protocol/path -> duplicate
      assert.ok(checkDuplicate({ website: 'http://www.beta.org/careers' }));

      // Completely unique row -> not duplicate
      assert.strictEqual(checkDuplicate({ email: 'charlie@gamma.co', phone: '5559998888', website: 'gamma.co' }), undefined);
    });

    test('Handles duplicate strategies: skip, update existing, import anyway', () => {
      let existing = [
        { id: 'lead_1', company_name: 'Old Name', email: 'test@dup.com', deal_value: 1000 }
      ];

      const importRow = { company_name: 'New Name', email: 'test@dup.com', deal_value: 5000 };

      // Strategy: Skip
      const applySkip = () => {
        const isDup = existing.some(l => l.email === importRow.email);
        return isDup ? [] : [importRow];
      };
      assert.deepStrictEqual(applySkip(), []);

      // Strategy: Update Existing
      const applyUpdate = () => {
        const target = existing.find(l => l.email === importRow.email);
        if (target) {
          Object.assign(target, importRow);
          return target;
        }
        return null;
      };
      const updated = applyUpdate();
      assert.strictEqual(updated.company_name, 'New Name');
      assert.strictEqual(updated.deal_value, 5000);

      // Strategy: Import Anyway
      const applyImportAnyway = () => {
        const newLead = { id: 'lead_2', ...importRow };
        existing.push(newLead);
        return existing;
      };
      const totalList = applyImportAnyway();
      assert.strictEqual(totalList.length, 2);
    });
  });

  // -------------------------------------------------------------
  // 2. Assignment Rules: Unassigned, Round-Robin, Location-Rule
  // -------------------------------------------------------------
  describe('2. Import Assignment Strategies', () => {
    const teamReps = [
      { user_id: 'rep_1', name: 'Alice Rep', territory: 'London' },
      { user_id: 'rep_2', name: 'Bob Rep', territory: 'Berlin' },
      { user_id: 'rep_3', name: 'Charlie Rep', territory: 'Paris' },
    ];

    test('Round-robin evenly distributes rows among team members', () => {
      const rows = [1, 2, 3, 4, 5];
      const assignedReps = rows.map((_, idx) => teamReps[idx % teamReps.length].user_id);
      
      assert.deepStrictEqual(assignedReps, ['rep_1', 'rep_2', 'rep_3', 'rep_1', 'rep_2']);
    });

    test('Location rule maps based on city/territory match or defaults to round-robin', () => {
      const assignByLocation = (leadCity, index) => {
        const match = teamReps.find(r => r.territory.toLowerCase() === leadCity.toLowerCase());
        if (match) return match.user_id;
        return teamReps[index % teamReps.length].user_id;
      };

      assert.strictEqual(assignByLocation('Berlin', 0), 'rep_2');
      assert.strictEqual(assignByLocation('Paris', 0), 'rep_3');
      assert.strictEqual(assignByLocation('Tokyo', 0), 'rep_1'); // default to round-robin
    });
  });

  // -------------------------------------------------------------
  // 3. CRM Dashboard Metrics & Scopes (Step 5b)
  // -------------------------------------------------------------
  describe('3. GET /api/dashboard Logic & Me/Team Scope Filtering', async () => {
    const orgId = 'org_test_metrics';
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const past2DaysStr = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
    const past10DaysTs = new Date(now - 10 * 86400000).toISOString();

    const sampleLeads = [
      // Rep 1 leads
      {
        id: 'lead_1',
        org_id: orgId,
        owner_id: 'usr_rep_1',
        status: 'won',
        deal_value: 20000,
        city: 'New York',
        country: 'US',
        source: 'Google Maps',
        created_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString()
      },
      {
        id: 'lead_2',
        org_id: orgId,
        owner_id: 'usr_rep_1',
        status: 'proposal',
        deal_value: 15000,
        city: 'New York',
        country: 'US',
        source: 'Google Maps',
        created_at: new Date().toISOString(),
        next_followup: past2DaysStr // overdue!
      },
      // Rep 2 leads
      {
        id: 'lead_3',
        org_id: orgId,
        owner_id: 'usr_rep_2',
        status: 'contacted',
        deal_value: 5000,
        city: 'London',
        country: 'UK',
        source: 'LinkedIn',
        created_at: new Date().toISOString(),
        next_followup: todayStr // due today!
      },
      {
        id: 'lead_4',
        org_id: orgId,
        owner_id: 'usr_rep_2',
        status: 'new',
        city: 'London',
        country: 'UK',
        source: 'CSV Import',
        created_at: past10DaysTs,
        last_contacted: past10DaysTs // stale 7d+
      }
    ];

    test('scope=me returns metrics scoped strictly to current rep', async () => {
      const repUser = { userId: 'usr_rep_1', role: 'rep' };
      const data = await getCRMDashboard({
        orgId,
        user: repUser,
        scope: 'me',
        range: 'all',
        leadsStore: sampleLeads
      });

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.kpis.totalLeads, 2); // lead_1 and lead_2
      assert.strictEqual(data.kpis.wonThisMonth.count, 1);
      assert.strictEqual(data.kpis.wonThisMonth.value, 20000);
      assert.strictEqual(data.kpis.followupsDueAndOverdue, 1); // lead_2
      assert.strictEqual(data.funnel.won, 1);
      assert.strictEqual(data.funnel.proposal, 1);
      assert.strictEqual(data.funnel.contacted, 0); // Rep 2's lead excluded
    });

    test('scope=team returns full organization aggregate with leaderboard stats', async () => {
      const managerUser = { userId: 'usr_mgr_1', role: 'manager' };
      const data = await getCRMDashboard({
        orgId,
        user: managerUser,
        scope: 'team',
        range: 'all',
        leadsStore: sampleLeads
      });

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.kpis.totalLeads, 4);
      assert.strictEqual(data.kpis.followupsDueAndOverdue, 2); // lead_2 and lead_3
      assert.strictEqual(data.kpis.staleLeadsCount, 1); // lead_4
      assert.strictEqual(data.leadsByLocation.length, 2); // New York (2), London (2)
      assert.strictEqual(data.leadsBySource.length, 3); // Google Maps (2), LinkedIn (1), CSV Import (1)
    });
  });

});
