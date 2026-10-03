import { PIPELINE_STAGES, isValidStage, normalizeRole, canTransitionLead, canAssignLead } from '../constants/crm.js';

// In-memory CRM stores for fast fallback / mock
export const crmActivitiesStore = [];
export const crmTeamStore = [
  {
    org_id: 'org_default',
    user_id: 'usr_admin_1',
    name: 'Alex Rivera (Admin)',
    email: 'admin@growprospect.local',
    role: 'admin',
    avatar_url: null,
    created_at: new Date().toISOString()
  },
  {
    org_id: 'org_default',
    user_id: 'usr_manager_1',
    name: 'Elena Rostova (Manager)',
    email: 'manager@growprospect.local',
    role: 'manager',
    avatar_url: null,
    created_at: new Date().toISOString()
  },
  {
    org_id: 'org_default',
    user_id: 'usr_rep_1',
    name: 'David Kim (Sales Rep)',
    email: 'david@growprospect.local',
    role: 'rep',
    avatar_url: null,
    created_at: new Date().toISOString()
  }
];

/**
 * Get pipeline summary and grouped leads for an organization
 * Enforces role boundaries: Reps only see own leads and unassigned leads.
 */
export async function getPipelineSummary({ orgId, user, leadsStore }) {
  const userRole = normalizeRole(user?.role);
  const currentUserId = user?.userId;

  const orgLeads = leadsStore.filter((l) => {
    if ((l.org_id || 'org_default') !== orgId) return false;
    if (userRole === 'rep') {
      const isUnassigned = !l.owner_id && !l.assigned_to;
      const isOwned = l.owner_id === currentUserId || l.assigned_to === currentUserId;
      if (!isUnassigned && !isOwned) return false;
    }
    return true;
  });

  const stages = {};
  const counts = {};
  let totalDealValue = 0;

  for (const stage of PIPELINE_STAGES) {
    stages[stage] = [];
    counts[stage] = 0;
  }

  for (const lead of orgLeads) {
    migrateOpportunityTypesToTags(lead);
    // Normalize or default pipeline stage
    const currentStage = isValidStage(lead.pipeline_stage) ? lead.pipeline_stage : 'New';
    stages[currentStage].push(lead);
    counts[currentStage]++;
    if (lead.deal_value && !isNaN(Number(lead.deal_value))) {
      totalDealValue += Number(lead.deal_value);
    }
  }

  return {
    orgId,
    stages,
    counts,
    totalLeads: orgLeads.length,
    totalDealValue
  };
}

/**
 * Transition a lead to a new pipeline stage
 */
export async function transitionLeadStage({ leadId, newStage, note, user, orgId, leadsStore }) {
  if (!isValidStage(newStage)) {
    throw new Error(`Invalid stage: "${newStage}". Must be one of: ${PIPELINE_STAGES.join(', ')}`);
  }

  const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === orgId);
  if (!lead) {
    throw new Error(`Lead not found in organization ${orgId}`);
  }

  const userRole = normalizeRole(user?.role);
  if (!canTransitionLead(userRole, lead.assigned_to, user?.userId)) {
    throw new Error('Permission denied: Sales reps may only update leads assigned to them or unassigned leads');
  }

  const oldStage = lead.pipeline_stage || 'New';
  lead.pipeline_stage = newStage;
  lead.last_activity_at = new Date().toISOString();

  // Create activity record
  const activity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    org_id: orgId,
    lead_id: leadId,
    user_id: user?.userId || 'unknown',
    user_name: user?.name || user?.username || 'Team Member',
    type: 'stage_change',
    content: note ? `Stage changed from ${oldStage} to ${newStage}: ${note}` : `Stage changed from ${oldStage} to ${newStage}`,
    metadata: {
      oldStage,
      newStage,
      note: note || null
    },
    created_at: new Date().toISOString()
  };
  crmActivitiesStore.unshift(activity);

  return {
    success: true,
    lead,
    activity
  };
}

/**
 * Assign a lead to a team member
 */
export async function assignLeadMember({ leadId, assignedToUserId, assignedToName, user, orgId, leadsStore }) {
  const userRole = normalizeRole(user?.role);
  if (!canAssignLead(userRole)) {
    throw new Error('Permission denied: Only Admins and Managers can reassign leads');
  }

  const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === orgId);
  if (!lead) {
    throw new Error(`Lead not found in organization ${orgId}`);
  }

  const prevAssigned = lead.assigned_to_name || 'Unassigned';
  lead.assigned_to = assignedToUserId;
  lead.assigned_to_name = assignedToName;
  lead.last_activity_at = new Date().toISOString();

  const activity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    org_id: orgId,
    lead_id: leadId,
    user_id: user?.userId || 'unknown',
    user_name: user?.name || 'Manager',
    type: 'assignment',
    body: `Reassigned from ${prevAssigned} to ${assignedToName}`,
    content: `Reassigned from ${prevAssigned} to ${assignedToName}`,
    metadata: {
      previous: prevAssigned,
      assignedTo: assignedToName,
      assignedToUserId
    },
    created_at: new Date().toISOString()
  };
  crmActivitiesStore.unshift(activity);

  return {
    success: true,
    lead,
    activity
  };
}

/**
 * Add a CRM activity or note
 */
export async function addLeadActivity({ leadId, type = 'note', body, content, user, orgId, leadsStore }) {
  const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === orgId);
  if (!lead) {
    throw new Error(`Lead not found in organization ${orgId}`);
  }

  const text = (body || content || '').trim();
  if (!text) {
    throw new Error('Activity body cannot be empty');
  }

  const validTypes = ['note', 'call', 'email', 'whatsapp', 'status_change', 'assignment'];
  const normalizedType = validTypes.includes(type) ? type : 'note';

  const activity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    org_id: orgId,
    lead_id: leadId,
    user_id: user?.userId || 'unknown',
    user_name: user?.name || user?.username || 'Team Member',
    type: normalizedType,
    body: text,
    content: text,
    created_at: new Date().toISOString()
  };

  crmActivitiesStore.unshift(activity);
  lead.last_activity_at = new Date().toISOString();

  return {
    success: true,
    activity
  };
}

/**
 * Get activities for a specific lead
 */
export async function getLeadActivities({ leadId, orgId }) {
  return crmActivitiesStore.filter(
    (a) => a.lead_id === leadId && (a.org_id || 'org_default') === orgId
  );
}

/**
 * Get organization team members
 */
export async function getOrgTeamMembers(orgId) {
  const targetOrgId = orgId || 'org_default';
  return crmTeamStore.filter((m) => (m.org_id || 'org_default') === targetOrgId);
}

// In-memory Tasks Store
export const tasksStore = [];

/**
 * Helper to migrate opportunityType into tags array
 */
export function migrateOpportunityTypesToTags(lead) {
  if (!Array.isArray(lead.tags)) {
    lead.tags = lead.tags ? [lead.tags] : [];
  }
  if (lead.opportunityType && !lead.tags.includes(lead.opportunityType)) {
    lead.tags.push(lead.opportunityType);
  }
  // Ensure status and pipeline_stage stay in sync
  if (!lead.status && lead.pipeline_stage) {
    lead.status = lead.pipeline_stage.toLowerCase();
  } else if (!lead.status) {
    lead.status = 'new';
  }
  if (!lead.pipeline_stage && lead.status) {
    lead.pipeline_stage = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
  }
  if (!lead.owner_id && lead.assigned_to) {
    lead.owner_id = lead.assigned_to;
  }
  return lead;
}

/**
 * PATCH /api/leads/:id - Edit fields, auto-create activity on status/owner change, require lost_reason
 */
export async function editLead({ leadId, updates, user, orgId, leadsStore }) {
  const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === orgId);
  if (!lead) {
    const error = new Error(`Lead not found in organization ${orgId}`);
    error.statusCode = 404;
    throw error;
  }

  migrateOpportunityTypesToTags(lead);
  const userRole = normalizeRole(user?.role);

  // Status Change Validation
  if (updates.status !== undefined) {
    const targetStatus = updates.status.toLowerCase().trim();
    if (!['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'].includes(targetStatus)) {
      const error = new Error(`Invalid status: ${updates.status}. Must be one of: new, contacted, replied, meeting, proposal, won, lost`);
      error.statusCode = 400;
      throw error;
    }

    if (targetStatus === 'lost' && (!updates.lost_reason || !updates.lost_reason.trim())) {
      const error = new Error('lost_reason is required when lead status is lost');
      error.statusCode = 400;
      throw error;
    }

    const oldStatus = lead.status || 'new';
    if (targetStatus !== oldStatus) {
      lead.status = targetStatus;
      lead.pipeline_stage = targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1);
      lead.status_changed_at = new Date().toISOString();
      if (targetStatus === 'lost') {
        lead.lost_reason = updates.lost_reason.trim();
      }

      // Auto-create status_change activity
      const activityBody = `Status changed from ${oldStatus} to ${targetStatus}${lead.lost_reason ? ` (Reason: ${lead.lost_reason})` : ''}`;
      const statusActivity = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        org_id: orgId,
        lead_id: leadId,
        user_id: user?.userId || 'unknown',
        user_name: user?.name || 'Team Member',
        type: 'status_change',
        body: activityBody,
        content: activityBody,
        created_at: new Date().toISOString()
      };
      crmActivitiesStore.unshift(statusActivity);
    }
  }

  // Owner Change Validation
  const newOwnerId = updates.owner_id !== undefined ? updates.owner_id : updates.assigned_to;
  if (newOwnerId !== undefined && newOwnerId !== (lead.owner_id || lead.assigned_to)) {
    // Only manager/admin or self-assignment
    if (userRole === 'rep' && newOwnerId !== user?.userId) {
      const error = new Error('Permission denied: Only managers and admins can assign leads to other members');
      error.statusCode = 403;
      throw error;
    }

    const prevOwner = lead.assigned_to_name || lead.owner_id || 'unassigned';
    lead.owner_id = newOwnerId;
    lead.assigned_to = newOwnerId;
    lead.assigned_to_name = updates.assigned_to_name || updates.owner_name || (newOwnerId === user?.userId ? user?.name : 'Team Member');
    lead.assigned_at = new Date().toISOString();

    // Auto-create assignment activity
    const assignBody = `Lead owner changed from ${prevOwner} to ${lead.assigned_to_name}`;
    const assignActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      org_id: orgId,
      lead_id: leadId,
      user_id: user?.userId || 'unknown',
      user_name: user?.name || 'Team Member',
      type: 'assignment',
      body: assignBody,
      content: assignBody,
      created_at: new Date().toISOString()
    };
    crmActivitiesStore.unshift(assignActivity);
  }

  // Edit other fields
  const allowedFields = [
    'name', 'company_name', 'email', 'phone', 'website', 'city', 'state', 'country',
    'deal_value', 'notes', 'next_followup', 'last_contacted', 'tags', 'job_title'
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'tags' && Array.isArray(updates.tags)) {
        lead.tags = updates.tags;
      } else if (field === 'deal_value') {
        lead.deal_value = updates.deal_value !== null ? Number(updates.deal_value) : null;
      } else {
        lead[field] = updates[field];
      }
    }
  }

  lead.last_activity_at = new Date().toISOString();

  return {
    success: true,
    lead
  };
}

/**
 * POST /api/leads/:id/claim - Rep claims an unassigned lead
 */
export async function claimLead({ leadId, user, orgId, leadsStore }) {
  const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === orgId);
  if (!lead) {
    const error = new Error(`Lead not found in organization ${orgId}`);
    error.statusCode = 404;
    throw error;
  }

  migrateOpportunityTypesToTags(lead);

  // Check if lead is already assigned
  if (lead.owner_id || lead.assigned_to) {
    const error = new Error(`Lead is already claimed by ${lead.assigned_to_name || lead.owner_id}`);
    error.statusCode = 409;
    throw error;
  }

  lead.owner_id = user.userId;
  lead.assigned_to = user.userId;
  lead.assigned_to_name = user.name || 'Sales Rep';
  lead.assigned_at = new Date().toISOString();
  lead.last_activity_at = new Date().toISOString();

  // Create assignment activity
  const claimBody = `Lead claimed by ${lead.assigned_to_name}`;
  const claimActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    org_id: orgId,
    lead_id: leadId,
    user_id: user.userId,
    user_name: lead.assigned_to_name,
    type: 'assignment',
    body: claimBody,
    content: claimBody,
    created_at: new Date().toISOString()
  };
  crmActivitiesStore.unshift(claimActivity);

  return {
    success: true,
    message: 'Lead claimed successfully',
    lead,
    activity: claimActivity
  };
}

/**
 * POST /api/leads/bulk - Bulk status, assign, tag, delete
 */
export async function bulkUpdateLeads({ action, leadIds = [], updates = {}, user, orgId, leadsStore }) {
  const userRole = normalizeRole(user?.role);
  const targetIds = new Set(leadIds);

  if (targetIds.size === 0) {
    return { success: true, affected: 0, action };
  }

  // Bulk Delete
  if (action === 'delete') {
    if (userRole === 'rep') {
      const error = new Error('Permission denied: Only managers and admins can bulk delete leads');
      error.statusCode = 403;
      throw error;
    }
    let deletedCount = 0;
    for (let i = leadsStore.length - 1; i >= 0; i--) {
      if (targetIds.has(leadsStore[i].id) && (leadsStore[i].org_id || 'org_default') === orgId) {
        leadsStore.splice(i, 1);
        deletedCount++;
      }
    }
    return { success: true, affected: deletedCount, action: 'delete' };
  }

  // Bulk Assign
  if (action === 'assign') {
    if (userRole === 'rep') {
      const error = new Error('Permission denied: Only managers and admins can bulk assign leads');
      error.statusCode = 403;
      throw error;
    }
    const newOwnerId = updates.owner_id || updates.assigned_to;
    const newOwnerName = updates.assigned_to_name || updates.owner_name || 'Team Member';
    let assignedCount = 0;

    for (const lead of leadsStore) {
      if (targetIds.has(lead.id) && (lead.org_id || 'org_default') === orgId) {
        lead.owner_id = newOwnerId;
        lead.assigned_to = newOwnerId;
        lead.assigned_to_name = newOwnerName;
        lead.assigned_at = new Date().toISOString();
        lead.last_activity_at = new Date().toISOString();

        const actBody = `Bulk assigned to ${newOwnerName}`;
        crmActivitiesStore.unshift({
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          org_id: orgId,
          lead_id: lead.id,
          user_id: user.userId,
          user_name: user.name || 'Manager',
          type: 'assignment',
          body: actBody,
          content: actBody,
          created_at: new Date().toISOString()
        });
        assignedCount++;
      }
    }
    return { success: true, affected: assignedCount, action: 'assign' };
  }

  // Bulk Status
  if (action === 'status') {
    const newStatus = (updates.status || '').toLowerCase().trim();
    if (!['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'].includes(newStatus)) {
      const error = new Error(`Invalid status: ${updates.status}`);
      error.statusCode = 400;
      throw error;
    }
    if (newStatus === 'lost' && (!updates.lost_reason || !updates.lost_reason.trim())) {
      const error = new Error('lost_reason is required when lead status is lost');
      error.statusCode = 400;
      throw error;
    }

    let statusCount = 0;
    for (const lead of leadsStore) {
      if (targetIds.has(lead.id) && (lead.org_id || 'org_default') === orgId) {
        // If rep, can only edit assigned to them or unassigned
        if (userRole === 'rep' && lead.owner_id && lead.owner_id !== user.userId) {
          continue;
        }
        const oldStatus = lead.status || 'new';
        lead.status = newStatus;
        lead.pipeline_stage = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        lead.status_changed_at = new Date().toISOString();
        if (newStatus === 'lost') {
          lead.lost_reason = updates.lost_reason.trim();
        }
        lead.last_activity_at = new Date().toISOString();

        const actBody = `Bulk status changed from ${oldStatus} to ${newStatus}${lead.lost_reason ? ` (Reason: ${lead.lost_reason})` : ''}`;
        crmActivitiesStore.unshift({
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          org_id: orgId,
          lead_id: lead.id,
          user_id: user.userId,
          user_name: user.name || 'Team Member',
          type: 'status_change',
          body: actBody,
          content: actBody,
          created_at: new Date().toISOString()
        });
        statusCount++;
      }
    }
    return { success: true, affected: statusCount, action: 'status' };
  }

  // Bulk Tag
  if (action === 'tag') {
    const inputTags = Array.isArray(updates.tags) ? updates.tags : updates.tag ? [updates.tag] : [];
    const mode = updates.tag_mode || 'add';
    let tagCount = 0;

    for (const lead of leadsStore) {
      if (targetIds.has(lead.id) && (lead.org_id || 'org_default') === orgId) {
        migrateOpportunityTypesToTags(lead);
        if (mode === 'set') {
          lead.tags = [...inputTags];
        } else if (mode === 'remove') {
          lead.tags = lead.tags.filter((t) => !inputTags.includes(t));
        } else {
          // Add
          const tagSet = new Set(lead.tags);
          inputTags.forEach((t) => tagSet.add(t));
          lead.tags = Array.from(tagSet);
        }
        lead.last_activity_at = new Date().toISOString();
        tagCount++;
      }
    }
    return { success: true, affected: tagCount, action: 'tag' };
  }

  throw new Error(`Unknown bulk action: ${action}`);
}

/**
 * Tasks Controllers: getTasks, createTask, updateTask
 */
export async function getTasks({ orgId, user, filters = {} }) {
  const userRole = normalizeRole(user?.role);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return tasksStore.filter((t) => {
    if ((t.org_id || 'org_default') !== orgId) return false;

    // Reps only see tasks assigned to them or created by them
    if (userRole === 'rep') {
      if (t.assignee_id !== user.userId && t.created_by !== user.userId) return false;
    }

    // Filter mine
    if (filters.mine === 'true' || filters.mine === true) {
      if (t.assignee_id !== user.userId) return false;
    }

    // Filter assignee
    if (filters.assignee_id && t.assignee_id !== filters.assignee_id) return false;

    // Filter lead_id
    if (filters.lead_id && t.lead_id !== filters.lead_id) return false;

    // Filter done
    if (filters.done !== undefined) {
      const wantDone = String(filters.done) === 'true';
      if (t.done !== wantDone) return false;
    }

    // Filter due: today | overdue | upcoming
    if (filters.due) {
      if (!t.due_date) return false;
      const dueDateStr = t.due_date.slice(0, 10);
      if (filters.due === 'today') {
        if (dueDateStr !== todayStr) return false;
      } else if (filters.due === 'overdue') {
        if (t.done || dueDateStr >= todayStr) return false;
      } else if (filters.due === 'upcoming') {
        if (dueDateStr <= todayStr) return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}

export async function createTask({ orgId, user, taskData }) {
  if (!taskData.title || !taskData.title.trim()) {
    const error = new Error('Task title is required');
    error.statusCode = 400;
    throw error;
  }

  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    org_id: orgId,
    lead_id: taskData.lead_id || null,
    assignee_id: taskData.assignee_id || user.userId,
    title: taskData.title.trim(),
    due_date: taskData.due_date || null,
    done: false,
    created_by: user.userId,
    created_at: new Date().toISOString()
  };

  tasksStore.unshift(task);
  return { success: true, task };
}

export async function updateTask({ taskId, orgId, user, updates }) {
  const task = tasksStore.find((t) => t.id === taskId && (t.org_id || 'org_default') === orgId);
  if (!task) {
    const error = new Error(`Task ${taskId} not found`);
    error.statusCode = 404;
    throw error;
  }

  const userRole = normalizeRole(user?.role);
  if (userRole === 'rep' && task.assignee_id !== user.userId && task.created_by !== user.userId) {
    const error = new Error('Permission denied: You can only update tasks assigned to you or created by you');
    error.statusCode = 403;
    throw error;
  }

  if (updates.done !== undefined) {
    task.done = Boolean(updates.done);
  }
  if (updates.title !== undefined && updates.title.trim()) {
    task.title = updates.title.trim();
  }
  if (updates.due_date !== undefined) {
    task.due_date = updates.due_date;
  }
  if (updates.assignee_id !== undefined) {
    if (userRole === 'rep' && updates.assignee_id !== user.userId) {
      const error = new Error('Permission denied: Sales reps cannot reassign tasks');
      error.statusCode = 403;
      throw error;
    }
    task.assignee_id = updates.assignee_id;
  }

  return { success: true, task };
}

/**
 * GET /api/locations - Aggregated city/country with lead counts
 */
export async function getLocationSummaries({ orgId, leadsStore }) {
  const locationsMap = new Map();

  for (const lead of leadsStore) {
    if ((lead.org_id || 'org_default') !== orgId) continue;
    
    const city = (lead.city || '').trim() || 'Unknown City';
    const state = (lead.state || '').trim() || '';
    const country = (lead.country || 'US').trim();
    const key = `${city}|${state}|${country}`;

    if (!locationsMap.has(key)) {
      locationsMap.set(key, {
        city,
        state,
        country,
        lead_count: 0,
        pipeline_value: 0
      });
    }

    const loc = locationsMap.get(key);
    loc.lead_count++;
    if (lead.deal_value && !isNaN(Number(lead.deal_value))) {
      loc.pipeline_value += Number(lead.deal_value);
    }
  }

  return Array.from(locationsMap.values()).sort((a, b) => b.lead_count - a.lead_count);
}

/**
 * GET /api/dashboard?scope=me|team&range=today|7d|30d|all
 * Comprehensive CRM Dashboard metrics
 */
export async function getCRMDashboard({ orgId, user, scope = 'me', range = 'all', leadsStore, tasksStore = [] }) {
  const userRole = normalizeRole(user?.role);
  const userId = user?.userId;

  // 1. Filter by org
  let orgLeads = leadsStore.filter((l) => (l.org_id || 'org_default') === orgId);

  // 2. Filter by scope: me vs team
  if (scope === 'me') {
    orgLeads = orgLeads.filter((l) => l.owner_id === userId || l.assigned_to === userId);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // KPIs
  const totalLeads = orgLeads.length;

  const newThisWeek = orgLeads.filter((l) => {
    const t = new Date(l.created_at || l.scrapedAt || Date.now()).getTime();
    return t >= sevenDaysAgo;
  }).length;

  const followupsDueAndOverdue = orgLeads.filter((l) => {
    if (!l.next_followup) return false;
    const fDate = l.next_followup.slice(0, 10);
    return fDate <= todayStr;
  }).length;

  const wonLeads = orgLeads.filter((l) => {
    const isWon = (l.status || '').toLowerCase() === 'won' || (l.pipeline_stage || '').toLowerCase() === 'won';
    if (!isWon) return false;
    const t = new Date(l.status_changed_at || l.last_activity_at || l.created_at || Date.now()).getTime();
    return t >= startOfMonth;
  });
  const wonThisMonthCount = wonLeads.length;
  const wonThisMonthValue = wonLeads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);

  const allWonLeads = orgLeads.filter((l) => (l.status || '').toLowerCase() === 'won' || (l.pipeline_stage || '').toLowerCase() === 'won');
  const conversionRate = totalLeads > 0 ? Number(((allWonLeads.length / totalLeads) * 100).toFixed(1)) : 0;

  const staleCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const staleLeadsCount = orgLeads.filter((l) => {
    const ts = l.last_contacted || l.last_activity_at || l.status_changed_at || l.created_at || l.scrapedAt;
    if (!ts) return true;
    return new Date(ts).getTime() <= staleCutoff;
  }).length;

  // Funnel
  const funnel = {
    new: orgLeads.filter((l) => (l.status || 'new').toLowerCase() === 'new').length,
    contacted: orgLeads.filter((l) => (l.status || '').toLowerCase() === 'contacted').length,
    replied: orgLeads.filter((l) => (l.status || '').toLowerCase() === 'replied').length,
    meeting: orgLeads.filter((l) => (l.status || '').toLowerCase() === 'meeting').length,
    proposal: orgLeads.filter((l) => (l.status || '').toLowerCase() === 'proposal').length,
    won: orgLeads.filter((l) => (l.status || '').toLowerCase() === 'won').length,
    lost: orgLeads.filter((l) => (l.status || '').toLowerCase() === 'lost').length,
  };

  // Leads by location (top 10)
  const locationMap = new Map();
  orgLeads.forEach((l) => {
    const loc = (l.city ? `${l.city}, ${l.country || 'US'}` : l.location || 'Unknown Location').trim();
    locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
  });
  const leadsByLocation = Array.from(locationMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Leads by source
  const sourceMap = new Map();
  orgLeads.forEach((l) => {
    const src = (l.source || l.scraperName || 'Manual Import').trim();
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  });
  const leadsBySource = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Due today list
  const dueTodayList = orgLeads
    .filter((l) => {
      if (!l.next_followup) return false;
      return l.next_followup.slice(0, 10) <= todayStr;
    })
    .map((l) => ({
      id: l.id,
      company_name: l.company_name || l.name,
      name: l.name,
      next_followup: l.next_followup,
      deal_value: l.deal_value,
      status: l.status || 'new',
      owner_name: l.assigned_to_name || l.owner_id || 'Unassigned',
      isOverdue: l.next_followup.slice(0, 10) < todayStr
    }))
    .slice(0, 15);

  // Team Stats
  const teamMembers = crmTeamStore.filter((m) => (m.org_id || 'org_default') === orgId);
  const leadsPerRep = [];
  const overduePerRep = [];
  const wonPerRep = [];

  for (const member of teamMembers) {
    const repLeads = leadsStore.filter((l) => (l.org_id || 'org_default') === orgId && (l.owner_id === member.user_id || l.assigned_to === member.user_id));
    leadsPerRep.push({
      repId: member.user_id,
      name: member.name,
      role: member.role,
      count: repLeads.length
    });

    const repOverdue = repLeads.filter((l) => l.next_followup && l.next_followup.slice(0, 10) < todayStr).length;
    overduePerRep.push({
      repId: member.user_id,
      name: member.name,
      overdueCount: repOverdue
    });

    const repWon = repLeads.filter((l) => (l.status || '').toLowerCase() === 'won' || (l.pipeline_stage || '').toLowerCase() === 'won');
    const repWonValue = repWon.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
    wonPerRep.push({
      repId: member.user_id,
      name: member.name,
      wonCount: repWon.length,
      wonValue: repWonValue
    });
  }

  return {
    success: true,
    scope,
    range,
    kpis: {
      totalLeads,
      newThisWeek,
      followupsDueAndOverdue,
      wonThisMonth: {
        count: wonThisMonthCount,
        value: wonThisMonthValue
      },
      conversionRate,
      staleLeadsCount
    },
    funnel,
    leadsByLocation,
    leadsBySource,
    dueTodayList,
    teamStats: {
      leadsPerRep,
      overduePerRep,
      wonPerRep
    }
  };
}
