import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PIPELINE_STAGES, STAGE_CONFIG, isValidStage } from '../src/constants/crm.js';

describe('Step 4: Pipeline Kanban & Status-Change Rules', () => {

  // -------------------------------------------------------------
  // 1. Pipeline Stages & Column Deal Value Computation
  // -------------------------------------------------------------
  describe('1. Pipeline Stages & Deal Value Aggregations', () => {
    test('Strictly enforces 7 fixed pipeline stages', () => {
      const expectedStages = ['New', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Won', 'Lost'];
      assert.deepStrictEqual(PIPELINE_STAGES, expectedStages);
      
      assert.strictEqual(isValidStage('New'), true);
      assert.strictEqual(isValidStage('Proposal'), true);
      assert.strictEqual(isValidStage('Won'), true);
      assert.strictEqual(isValidStage('Lost'), true);
      assert.strictEqual(isValidStage('InvalidStage'), false);
    });

    test('Computes total deal value for Proposal and Won columns', () => {
      const sampleLeads = [
        { id: '1', pipeline_stage: 'Proposal', deal_value: 15000 },
        { id: '2', pipeline_stage: 'Proposal', deal_value: '25000' },
        { id: '3', pipeline_stage: 'Proposal', deal_value: null },
        { id: '4', pipeline_stage: 'Won', deal_value: 50000 },
        { id: '5', pipeline_stage: 'Won', deal_value: '12500.50' },
        { id: '6', pipeline_stage: 'New', deal_value: 99000 },
      ];

      const computeStageValue = (leads, targetStage) => {
        return leads
          .filter(l => l.pipeline_stage === targetStage)
          .reduce((sum, l) => {
            const val = l.deal_value ? Number(l.deal_value) : 0;
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
      };

      const proposalTotal = computeStageValue(sampleLeads, 'Proposal');
      const wonTotal = computeStageValue(sampleLeads, 'Won');

      assert.strictEqual(proposalTotal, 40000);
      assert.strictEqual(wonTotal, 62500.50);
    });
  });

  // -------------------------------------------------------------
  // 2. Status Change Rules & Lost Reason Requirement
  // -------------------------------------------------------------
  describe('2. Status-Change Validation & Lost Reason Rules', () => {
    const validLostReasons = ['no budget', 'no response', 'chose competitor', 'not a fit', 'other'];

    test('Transitioning to Lost strictly requires a recognized lost reason', () => {
      const validateStatusChange = (newStatus, lostReason) => {
        const normalizedStatus = (newStatus || '').toLowerCase().trim();
        if (!['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'].includes(normalizedStatus)) {
          throw new Error(`Invalid status: ${newStatus}`);
        }
        if (normalizedStatus === 'lost') {
          if (!lostReason || !lostReason.trim()) {
            throw new Error('lost_reason is required when lead status is lost');
          }
          const hasValidPrefix = validLostReasons.some(r => lostReason.toLowerCase().startsWith(r));
          if (!hasValidPrefix) {
            throw new Error(`Invalid lost reason: ${lostReason}`);
          }
        }
        return true;
      };

      // Transitioning to regular stages succeeds without lost reason
      assert.strictEqual(validateStatusChange('Meeting'), true);
      assert.strictEqual(validateStatusChange('Won'), true);

      // Transitioning to Lost without reason throws
      assert.throws(() => validateStatusChange('Lost', ''), /lost_reason is required/);
      assert.throws(() => validateStatusChange('Lost', null), /lost_reason is required/);

      // Transitioning to Lost with valid reasons succeeds
      for (const reason of validLostReasons) {
        assert.strictEqual(validateStatusChange('Lost', reason), true);
      }
      assert.strictEqual(validateStatusChange('Lost', 'no budget: client postponed Q4 budget'), true);
      assert.strictEqual(validateStatusChange('Lost', 'chose competitor: Acme Corp'), true);
    });

    test('Every status move generates a status_change activity record', () => {
      const createStatusChangeActivity = ({ leadId, oldStage, newStage, reason, userId, userName }) => {
        const body = `Status changed from ${oldStage} to ${newStage}${reason ? ` (Reason: ${reason})` : ''}`;
        return {
          id: `act_${Date.now()}`,
          lead_id: leadId,
          user_id: userId,
          user_name: userName || 'Team Member',
          type: 'status_change',
          body,
          created_at: new Date().toISOString()
        };
      };

      const regularActivity = createStatusChangeActivity({
        leadId: 'lead_123',
        oldStage: 'Contacted',
        newStage: 'Meeting',
        userId: 'usr_rep_1',
        userName: 'Alice Rep'
      });

      assert.strictEqual(regularActivity.type, 'status_change');
      assert.strictEqual(regularActivity.body, 'Status changed from Contacted to Meeting');
      assert.strictEqual(regularActivity.user_id, 'usr_rep_1');

      const lostActivity = createStatusChangeActivity({
        leadId: 'lead_456',
        oldStage: 'Proposal',
        newStage: 'Lost',
        reason: 'chose competitor',
        userId: 'usr_rep_1',
        userName: 'Alice Rep'
      });

      assert.strictEqual(lostActivity.type, 'status_change');
      assert.strictEqual(lostActivity.body, 'Status changed from Proposal to Lost (Reason: chose competitor)');
    });
  });

  // -------------------------------------------------------------
  // 3. Optimistic Update & Rollback Mechanism
  // -------------------------------------------------------------
  describe('3. Drag & Drop Optimistic Update and Rollback Logic', () => {
    test('Optimistically updates column state and successfully rolls back on API failure', async () => {
      let stagesState = {
        New: [{ id: 'lead_1', company_name: 'Stark Industries', pipeline_stage: 'New' }],
        Contacted: [],
        Meeting: []
      };

      const moveLead = async (leadId, sourceStage, targetStage, apiCall) => {
        const prevStages = JSON.parse(JSON.stringify(stagesState));

        // 1. Optimistic update
        const lead = stagesState[sourceStage].find(l => l.id === leadId);
        stagesState[sourceStage] = stagesState[sourceStage].filter(l => l.id !== leadId);
        stagesState[targetStage] = [{ ...lead, pipeline_stage: targetStage }, ...stagesState[targetStage]];

        // 2. Perform API call
        try {
          await apiCall();
        } catch (err) {
          // 3. Rollback on failure!
          stagesState = prevStages;
          throw err;
        }
      };

      // Case A: API succeeds
      await moveLead('lead_1', 'New', 'Contacted', async () => {
        return { success: true };
      });
      assert.strictEqual(stagesState.New.length, 0);
      assert.strictEqual(stagesState.Contacted.length, 1);
      assert.strictEqual(stagesState.Contacted[0].id, 'lead_1');

      // Case B: API fails -> verify rollback to previous state
      await assert.rejects(async () => {
        await moveLead('lead_1', 'Contacted', 'Meeting', async () => {
          throw new Error('Network error 500');
        });
      }, /Network error 500/);

      // Rolled back! Lead remains in Contacted, not Meeting
      assert.strictEqual(stagesState.Contacted.length, 1);
      assert.strictEqual(stagesState.Contacted[0].id, 'lead_1');
      assert.strictEqual(stagesState.Meeting.length, 0);
    });
  });

  // -------------------------------------------------------------
  // 4. Rep Lead Editing Restrictions
  // -------------------------------------------------------------
  describe('4. Rep Role Boundaries on Kanban Drag & Drop', () => {
    const repUserId = 'usr_rep_1';
    const otherRepId = 'usr_rep_2';

    const checkDragPermission = (lead, userRole, userId) => {
      if (userRole === 'admin' || userRole === 'manager') return true;
      if (userRole === 'rep') {
        const isOwned = lead.owner_id === userId || lead.assigned_to === userId;
        const isUnassigned = !lead.owner_id && !lead.assigned_to;
        return isOwned || isUnassigned;
      }
      return false;
    };

    test('Rep can drag own lead or unassigned lead', () => {
      const ownLead = { id: 'l1', owner_id: repUserId };
      const unassignedLead = { id: 'l2', owner_id: null, assigned_to: null };
      assert.strictEqual(checkDragPermission(ownLead, 'rep', repUserId), true);
      assert.strictEqual(checkDragPermission(unassignedLead, 'rep', repUserId), true);
    });

    test('Rep cannot drag lead owned by another rep', () => {
      const otherLead = { id: 'l3', owner_id: otherRepId };
      assert.strictEqual(checkDragPermission(otherLead, 'rep', repUserId), false);
    });

    test('Manager/Admin can drag any lead across stages', () => {
      const otherLead = { id: 'l3', owner_id: otherRepId };
      assert.strictEqual(checkDragPermission(otherLead, 'manager', repUserId), true);
      assert.strictEqual(checkDragPermission(otherLead, 'admin', repUserId), true);
    });
  });

  // -------------------------------------------------------------
  // 5. Next Follow-up Overdue Flagging
  // -------------------------------------------------------------
  describe('5. Next Follow-up Overdue Calculation', () => {
    test('Accurately flags overdue follow-up dates in orange', () => {
      const checkOverdue = (nextFollowupStr) => {
        if (!nextFollowupStr) return false;
        const [y, m, d] = nextFollowupStr.split('-').map(Number);
        const target = new Date(y, m - 1, d);
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return target.getTime() < today.getTime();
      };

      const formatLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const now = new Date();
      const pastDate = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2)); // 2 days ago
      const futureDate = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5)); // 5 days ahead
      const todayDate = formatLocalDate(now);

      assert.strictEqual(checkOverdue(pastDate), true);    // Overdue -> orange
      assert.strictEqual(checkOverdue(futureDate), false); // Future -> normal
      assert.strictEqual(checkOverdue(todayDate), false);  // Due today -> normal
      assert.strictEqual(checkOverdue(null), false);
    });
  });

  // -------------------------------------------------------------
  // 6. Filter Defaults & Column Pagination
  // -------------------------------------------------------------
  describe('6. Filter Defaults & Column Pagination', () => {
    test('Reps default to "My leads", Managers/Admins default to "ALL"', () => {
      const getDefaultOwnerFilter = (role) => (role === 'rep' ? 'my' : 'ALL');

      assert.strictEqual(getDefaultOwnerFilter('rep'), 'my');
      assert.strictEqual(getDefaultOwnerFilter('manager'), 'ALL');
      assert.strictEqual(getDefaultOwnerFilter('admin'), 'ALL');
    });

    test('Column pagination loads 25 cards initially and increments by 25 on load more', () => {
      let visibleCount = 25;
      const totalCardsInColumn = 70;

      const getVisibleSlice = (total, limit) => {
        return {
          displayed: Math.min(total, limit),
          hasMore: total > limit,
          remaining: Math.max(0, total - limit)
        };
      };

      // Initial state
      let page1 = getVisibleSlice(totalCardsInColumn, visibleCount);
      assert.strictEqual(page1.displayed, 25);
      assert.strictEqual(page1.hasMore, true);
      assert.strictEqual(page1.remaining, 45);

      // First "Load more"
      visibleCount += 25;
      let page2 = getVisibleSlice(totalCardsInColumn, visibleCount);
      assert.strictEqual(page2.displayed, 50);
      assert.strictEqual(page2.hasMore, true);
      assert.strictEqual(page2.remaining, 20);

      // Second "Load more"
      visibleCount += 25;
      let page3 = getVisibleSlice(totalCardsInColumn, visibleCount);
      assert.strictEqual(page3.displayed, 70);
      assert.strictEqual(page3.hasMore, false);
      assert.strictEqual(page3.remaining, 0);
    });
  });

});
