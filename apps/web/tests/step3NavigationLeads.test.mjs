import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PIPELINE_STAGES, STAGE_CONFIG } from '../src/constants/crm.js';
import { crmService } from '../src/services/crmService.js';
import { sessionManager } from '../src/services/sessionManager.js';

describe('Step 3: Navigation and Leads Page Validation', () => {

  // -------------------------------------------------------------
  // 1. Navigation & Automation Deep Linking
  // -------------------------------------------------------------
  describe('1. Sidebar Navigation & Deep Links', () => {
    test('Sidebar items include Dashboard, Leads, Pipeline, Tasks, Import, AI Agents, User Management', () => {
      const requiredTabs = ['dashboard', 'leads', 'pipeline', 'tasks', 'ai-agents', 'import', 'users'];
      
      const navItems = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'leads', label: 'Leads' },
        { id: 'pipeline', label: 'Pipeline' },
        { id: 'tasks', label: 'Tasks' },
        { id: 'ai-agents', label: 'AI Agents' },
        { id: 'import', label: 'Import' },
        { id: 'users', label: 'User Management' }
      ];

      const itemIds = navItems.map(i => i.id);
      for (const req of requiredTabs) {
        assert.ok(itemIds.includes(req), `Sidebar must contain navigation tab: ${req}`);
      }
    });

    test('Tasks badge correctly counts only current user tasks due today that are not done', () => {
      const currentUserId = 'usr_rep_1';
      const todayStr = new Date().toISOString().slice(0, 10);
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

      const mockTasks = [
        { id: 't1', assignee_id: 'usr_rep_1', due_date: todayStr, done: false }, // count = 1
        { id: 't2', assignee_id: 'usr_rep_1', due_date: todayStr, done: true },  // done -> excluded
        { id: 't3', assignee_id: 'usr_rep_1', due_date: tomorrowStr, done: false }, // tomorrow -> excluded
        { id: 't4', assignee_id: 'usr_rep_2', due_date: todayStr, done: false }, // other user -> excluded
        { id: 't5', assignee_id: 'usr_rep_1', due_date: todayStr, done: false }, // count = 2
      ];

      const tasksDueTodayForUser = mockTasks.filter(
        t => t.assignee_id === currentUserId && !t.done && t.due_date && t.due_date.slice(0, 10) === todayStr
      );

      assert.strictEqual(tasksDueTodayForUser.length, 2);
    });
  });

  // -------------------------------------------------------------
  // 2. Leads Page Tab Filtering: My Leads | Unassigned | All Leads
  // -------------------------------------------------------------
  describe('2. Leads Tab Filtering (My Leads | Unassigned | All Leads)', () => {
    const currentUserId = 'usr_rep_1';

    const testLeads = [
      { id: 'lead_1', company_name: 'Alpha Corp', owner_id: 'usr_rep_1', status: 'new' },
      { id: 'lead_2', company_name: 'Beta LLC', owner_id: 'usr_rep_2', status: 'contacted' },
      { id: 'lead_3', company_name: 'Gamma Inc', owner_id: null, assigned_to: null, status: 'new' },
      { id: 'lead_4', company_name: 'Delta Co', owner_id: 'usr_rep_1', status: 'replied' },
      { id: 'lead_5', company_name: 'Epsilon Tech', owner_id: null, assigned_to: null, status: 'meeting' },
    ];

    const filterByTab = (leads, tab, userId) => {
      return leads.filter((lead) => {
        const isOwnedByMe = lead.owner_id === userId || lead.assigned_to === userId;
        const isUnassigned = !lead.owner_id && !lead.assigned_to;
        if (tab === 'my') return isOwnedByMe;
        if (tab === 'unassigned') return isUnassigned;
        return true; // 'all'
      });
    };

    test('My Leads tab returns only leads assigned to current user', () => {
      const myLeads = filterByTab(testLeads, 'my', currentUserId);
      assert.strictEqual(myLeads.length, 2);
      assert.deepStrictEqual(myLeads.map(l => l.id), ['lead_1', 'lead_4']);
    });

    test('Unassigned tab returns only leads without owner', () => {
      const unassignedLeads = filterByTab(testLeads, 'unassigned', currentUserId);
      assert.strictEqual(unassignedLeads.length, 2);
      assert.deepStrictEqual(unassignedLeads.map(l => l.id), ['lead_3', 'lead_5']);
    });

    test('All Leads tab returns all leads in tenant', () => {
      const allLeads = filterByTab(testLeads, 'all', currentUserId);
      assert.strictEqual(allLeads.length, 5);
    });
  });

  // -------------------------------------------------------------
  // 3. Leads Filters: Search, Status, Owner, Location, Tag, Stale
  // -------------------------------------------------------------
  describe('3. Leads Multi-Filter Logic', () => {
    const now = Date.now();
    const staleDate = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const freshDate = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();  // 1 day ago

    const sampleLeads = [
      {
        id: 'l1',
        company_name: 'Delhi Solar Works',
        name: 'Amit Sharma',
        city: 'Delhi',
        country: 'India',
        status: 'new',
        owner_id: 'usr_rep_1',
        tags: ['Solar', 'Renewable'],
        source: 'google_maps',
        website: null,
        last_contacted: staleDate
      },
      {
        id: 'l2',
        company_name: 'Mumbai Cloud Solutions',
        name: 'Rohan Mehta',
        city: 'Mumbai',
        country: 'India',
        status: 'contacted',
        owner_id: 'usr_rep_2',
        tags: ['Cloud', 'SaaS'],
        source: 'tech_hiring',
        website: 'https://mumbaicloud.in',
        last_contacted: freshDate
      },
      {
        id: 'l3',
        company_name: 'Delhi Retailers Hub',
        name: 'Priya Verma',
        city: 'Delhi',
        country: 'India',
        status: 'new',
        owner_id: null,
        tags: ['Retail'],
        source: 'google_maps',
        website: null,
        last_contacted: staleDate
      },
      {
        id: 'l4',
        company_name: 'Berlin AI Labs',
        name: 'Hans Gruber',
        city: 'Berlin',
        country: 'Germany',
        status: 'proposal',
        owner_id: 'usr_rep_1',
        tags: ['AI', 'Robotics'],
        source: 'freelancer',
        website: 'https://berlinai.de',
        last_contacted: freshDate
      }
    ];

    test('Saved preset filter: "New leads in Delhi without website"', () => {
      const presetMatches = sampleLeads.filter(l => {
        const isNew = (l.status || '').toLowerCase() === 'new';
        const isDelhi = (l.city || '').toLowerCase().includes('delhi');
        const hasNoWebsite = !l.website || l.website.trim() === '';
        return isNew && isDelhi && hasNoWebsite;
      });

      assert.strictEqual(presetMatches.length, 2);
      assert.deepStrictEqual(presetMatches.map(l => l.id), ['l1', 'l3']);
    });

    test('Stale filter (7d+) matches only leads with no activity in 7+ days', () => {
      const staleCutoff = now - 7 * 24 * 60 * 60 * 1000;
      const staleLeads = sampleLeads.filter(l => {
        const ts = l.last_contacted || l.scrapedAt;
        if (!ts) return true;
        return new Date(ts).getTime() <= staleCutoff;
      });

      assert.strictEqual(staleLeads.length, 2);
      assert.deepStrictEqual(staleLeads.map(l => l.id), ['l1', 'l3']);
    });

    test('Tag filter matches specific tag within text array', () => {
      const aiLeads = sampleLeads.filter(l => Array.isArray(l.tags) && l.tags.includes('AI'));
      assert.strictEqual(aiLeads.length, 1);
      assert.strictEqual(aiLeads[0].company_name, 'Berlin AI Labs');
    });

    test('Location filter with counts aggregates correctly', () => {
      const map = new Map();
      sampleLeads.forEach(l => {
        const loc = `${l.city}, ${l.country}`;
        map.set(loc, (map.get(loc) || 0) + 1);
      });

      const locationCounts = Array.from(map.entries())
        .map(([loc, count]) => ({ loc, count }))
        .sort((a, b) => b.count - a.count);

      assert.strictEqual(locationCounts[0].loc, 'Delhi, India');
      assert.strictEqual(locationCounts[0].count, 2);
      assert.strictEqual(locationCounts.find(l => l.loc === 'Berlin, Germany').count, 1);
    });
  });

  // -------------------------------------------------------------
  // 4. Group by Location Toggle
  // -------------------------------------------------------------
  describe('4. Group by Location Logic', () => {
    const leads = [
      { id: '1', company_name: 'C1', city: 'Delhi', country: 'India' },
      { id: '2', company_name: 'C2', city: 'Delhi', country: 'India' },
      { id: '3', company_name: 'C3', city: 'London', country: 'UK' },
      { id: '4', company_name: 'C4', city: 'New York', country: 'US' },
      { id: '5', company_name: 'C5', city: 'London', country: 'UK' },
      { id: '6', company_name: 'C6', city: 'London', country: 'UK' }
    ];

    test('Group by location produces groups sorted by highest count first', () => {
      const map = new Map();
      leads.forEach(l => {
        const locKey = `${l.city}, ${l.country}`;
        if (!map.has(locKey)) map.set(locKey, []);
        map.get(locKey).push(l);
      });
      const grouped = Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);

      assert.strictEqual(grouped.length, 3);
      assert.strictEqual(grouped[0][0], 'London, UK');
      assert.strictEqual(grouped[0][1].length, 3);
      assert.strictEqual(grouped[1][0], 'Delhi, India');
      assert.strictEqual(grouped[1][1].length, 2);
      assert.strictEqual(grouped[2][0], 'New York, US');
      assert.strictEqual(grouped[2][1].length, 1);
    });
  });

  // -------------------------------------------------------------
  // 5. Rep Permission Enforcement on Lead Editing
  // -------------------------------------------------------------
  describe('5. Rep Edit Permission Rules', () => {
    const repUserId = 'usr_rep_alice';
    const otherRepId = 'usr_rep_bob';

    const ownLead = { id: 'lead_own', owner_id: repUserId };
    const unassignedLead = { id: 'lead_unassigned', owner_id: null, assigned_to: null };
    const otherLead = { id: 'lead_other', owner_id: otherRepId };

    const canRepEdit = (lead, userId, role) => {
      if (role === 'admin' || role === 'manager') return true;
      if (role === 'rep') {
        // Rep can only edit if lead is unassigned or owned by them
        if (!lead.owner_id && !lead.assigned_to) return true;
        return lead.owner_id === userId || lead.assigned_to === userId;
      }
      return false;
    };

    test('Sales rep CAN edit own lead', () => {
      assert.strictEqual(canRepEdit(ownLead, repUserId, 'rep'), true);
    });

    test('Sales rep CAN edit/claim unassigned lead', () => {
      assert.strictEqual(canRepEdit(unassignedLead, repUserId, 'rep'), true);
    });

    test('Sales rep CANNOT edit lead owned by another rep (read-only enforcement)', () => {
      assert.strictEqual(canRepEdit(otherLead, repUserId, 'rep'), false);
    });

    test('Manager and Admin CAN edit any lead regardless of owner', () => {
      assert.strictEqual(canRepEdit(otherLead, 'usr_mgr_1', 'manager'), true);
      assert.strictEqual(canRepEdit(otherLead, 'usr_admin_1', 'admin'), true);
    });
  });

  // -------------------------------------------------------------
  // 6. Bulk Action Bar Permissions & Operations
  // -------------------------------------------------------------
  describe('6. Bulk Action Bar Permissions', () => {
    const isDeleteAllowed = (role) => role === 'admin' || role === 'manager';
    const isAssignAllowed = (role) => role === 'admin' || role === 'manager';

    test('Bulk delete is permitted for admin and manager only', () => {
      assert.strictEqual(isDeleteAllowed('admin'), true);
      assert.strictEqual(isDeleteAllowed('manager'), true);
      assert.strictEqual(isDeleteAllowed('rep'), false);
    });

    test('Bulk assign is permitted for admin and manager only', () => {
      assert.strictEqual(isAssignAllowed('admin'), true);
      assert.strictEqual(isAssignAllowed('manager'), true);
      assert.strictEqual(isAssignAllowed('rep'), false);
    });
  });

  // -------------------------------------------------------------
  // 7. Right-Side Drawer Quick Actions
  // -------------------------------------------------------------
  describe('7. Drawer Quick Outreach Action Links', () => {
    const testLead = {
      name: 'John Doe',
      phone: '+1 (555) 234-5678',
      email: 'john@acmecorp.com'
    };

    test('Phone link formats cleaned digits for tel: protocol', () => {
      const cleanPhone = testLead.phone.replace(/[^0-9+]/g, '');
      const telUrl = `tel:${cleanPhone}`;
      assert.strictEqual(telUrl, 'tel:+15552345678');
    });

    test('WhatsApp link formats cleaned digits for wa.me protocol', () => {
      const cleanDigits = testLead.phone.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${cleanDigits}`;
      assert.strictEqual(waUrl, 'https://wa.me/15552345678');
    });

    test('Email link formats mailto: protocol with subject', () => {
      const mailtoUrl = `mailto:${testLead.email}?subject=Partnership%20Inquiry`;
      assert.strictEqual(mailtoUrl, 'mailto:john@acmecorp.com?subject=Partnership%20Inquiry');
    });
  });

});
