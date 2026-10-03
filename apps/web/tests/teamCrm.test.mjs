import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  PIPELINE_STAGES, 
  CRM_ROLES, 
  isValidStage, 
  isValidRole, 
  normalizeRole, 
  canTransitionLead, 
  canAssignLead 
} from '../src/constants/crm.js';
import { 
  getPipelineSummary, 
  transitionLeadStage, 
  assignLeadMember, 
  addLeadActivity, 
  getLeadActivities 
} from '../../api/src/controllers/crmController.js';

describe('Team CRM Pipeline Stages & Multi-Tenancy', () => {
  test('strictly enforces the fixed 7 pipeline stages', () => {
    assert.deepStrictEqual(PIPELINE_STAGES, [
      'New',
      'Contacted',
      'Replied',
      'Meeting',
      'Proposal',
      'Won',
      'Lost'
    ]);

    assert.strictEqual(isValidStage('New'), true);
    assert.strictEqual(isValidStage('Contacted'), true);
    assert.strictEqual(isValidStage('Replied'), true);
    assert.strictEqual(isValidStage('Meeting'), true);
    assert.strictEqual(isValidStage('Proposal'), true);
    assert.strictEqual(isValidStage('Won'), true);
    assert.strictEqual(isValidStage('Lost'), true);

    // Rejects non-fixed or invalid stages
    assert.strictEqual(isValidStage('In Review'), false);
    assert.strictEqual(isValidStage('Closed'), false);
    assert.strictEqual(isValidStage('Pending'), false);
    assert.strictEqual(isValidStage(''), false);
  });

  test('normalizes Clerk organization roles to admin, manager, rep', () => {
    assert.strictEqual(normalizeRole('org:admin'), 'admin');
    assert.strictEqual(normalizeRole('org:owner'), 'admin');
    assert.strictEqual(normalizeRole('admin'), 'admin');

    assert.strictEqual(normalizeRole('org:manager'), 'manager');
    assert.strictEqual(normalizeRole('manager'), 'manager');

    assert.strictEqual(normalizeRole('org:member'), 'rep');
    assert.strictEqual(normalizeRole('rep'), 'rep');
    assert.strictEqual(normalizeRole(''), 'rep');
  });

  test('enforces role-based permissions for transitions and assignments', () => {
    // Stage transitions: admin and manager can transition any lead
    assert.strictEqual(canTransitionLead('admin', 'rep_1', 'rep_2'), true);
    assert.strictEqual(canTransitionLead('manager', 'rep_1', 'rep_2'), true);

    // Reps can transition leads assigned to them or unassigned leads
    assert.strictEqual(canTransitionLead('rep', 'rep_1', 'rep_1'), true);
    assert.strictEqual(canTransitionLead('rep', null, 'rep_1'), true);
    assert.strictEqual(canTransitionLead('rep', 'rep_other', 'rep_1'), false);

    // Reassignments: only admin and manager
    assert.strictEqual(canAssignLead('admin'), true);
    assert.strictEqual(canAssignLead('manager'), true);
    assert.strictEqual(canAssignLead('rep'), false);
  });

  test('isolates pipeline summary by org_id (multi-tenant enforcement)', async () => {
    const mockLeads = [
      { id: 'l1', org_id: 'org_acme', name: 'Acme Deal 1', pipeline_stage: 'New', deal_value: 5000 },
      { id: 'l2', org_id: 'org_acme', name: 'Acme Deal 2', pipeline_stage: 'Meeting', deal_value: 12000 },
      { id: 'l3', org_id: 'org_beta', name: 'Beta Deal 1', pipeline_stage: 'Proposal', deal_value: 20000 }
    ];

    const acmePipeline = await getPipelineSummary({ orgId: 'org_acme', leadsStore: mockLeads });
    assert.strictEqual(acmePipeline.orgId, 'org_acme');
    assert.strictEqual(acmePipeline.totalLeads, 2);
    assert.strictEqual(acmePipeline.counts.New, 1);
    assert.strictEqual(acmePipeline.counts.Meeting, 1);
    assert.strictEqual(acmePipeline.counts.Proposal, 0);
    assert.strictEqual(acmePipeline.totalDealValue, 17000);

    const betaPipeline = await getPipelineSummary({ orgId: 'org_beta', leadsStore: mockLeads });
    assert.strictEqual(betaPipeline.orgId, 'org_beta');
    assert.strictEqual(betaPipeline.totalLeads, 1);
    assert.strictEqual(betaPipeline.counts.Proposal, 1);
    assert.strictEqual(betaPipeline.totalDealValue, 20000);
  });

  test('transitions stage and creates audit activity log', async () => {
    const mockStore = [
      { id: 'lead_test_1', org_id: 'org_test', name: 'Test Lead', pipeline_stage: 'New' }
    ];

    const result = await transitionLeadStage({
      leadId: 'lead_test_1',
      newStage: 'Contacted',
      note: 'Reached out via email',
      user: { userId: 'usr_1', role: 'admin', name: 'Admin User' },
      orgId: 'org_test',
      leadsStore: mockStore
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.lead.pipeline_stage, 'Contacted');
    assert.strictEqual(result.activity.type, 'stage_change');
    assert.strictEqual(result.activity.metadata.oldStage, 'New');
    assert.strictEqual(result.activity.metadata.newStage, 'Contacted');

    // Rejects invalid stage transition
    await assert.rejects(
      async () => {
        await transitionLeadStage({
          leadId: 'lead_test_1',
          newStage: 'NotAStage',
          user: { userId: 'usr_1', role: 'admin' },
          orgId: 'org_test',
          leadsStore: mockStore
        });
      },
      /Invalid stage/
    );
  });

  test('prevents cross-tenant lead access or modification', async () => {
    const mockStore = [
      { id: 'lead_tenant_a', org_id: 'tenant_a', name: 'Confidential Lead' }
    ];

    // Attempting to modify tenant_a lead using tenant_b orgId must fail
    await assert.rejects(
      async () => {
        await transitionLeadStage({
          leadId: 'lead_tenant_a',
          newStage: 'Meeting',
          user: { userId: 'usr_1', role: 'admin' },
          orgId: 'tenant_b',
          leadsStore: mockStore
        });
      },
      /Lead not found in organization/
    );
  });
});
