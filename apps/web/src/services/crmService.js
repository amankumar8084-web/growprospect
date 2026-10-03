import { sessionManager } from './sessionManager.js';
import { storage } from './storage.js';
import { PIPELINE_STAGES, isValidStage } from '../constants/crm.js';

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3001';

export const crmService = {
  /**
   * Fetch pipeline leads grouped by the 7 fixed stages
   */
  async getPipeline(orgId) {
    const targetOrgId = orgId || sessionManager.getOrgId();
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/pipeline?org_id=${encodeURIComponent(targetOrgId)}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.warn('[crmService] Backend pipeline fetch failed, falling back to local storage:', err.message);
    }

    // Local reactive storage fallback
    const allLeads = storage.getLeads();
    const orgLeads = allLeads.filter(l => (l.org_id || 'org_default') === targetOrgId);

    const stages = {};
    const counts = {};
    let totalDealValue = 0;

    for (const stage of PIPELINE_STAGES) {
      stages[stage] = [];
      counts[stage] = 0;
    }

    for (const lead of orgLeads) {
      const stage = isValidStage(lead.pipeline_stage) ? lead.pipeline_stage : 'New';
      stages[stage].push(lead);
      counts[stage]++;
      if (lead.deal_value && !isNaN(Number(lead.deal_value))) {
        totalDealValue += Number(lead.deal_value);
      }
    }

    return {
      orgId: targetOrgId,
      stages,
      counts,
      totalLeads: orgLeads.length,
      totalDealValue
    };
  },

  /**
   * Transition a lead to a new pipeline stage
   * @param {string} leadId
   * @param {'New'|'Contacted'|'Replied'|'Meeting'|'Proposal'|'Won'|'Lost'} newStage
   * @param {string} [note]
   */
  async updateLeadStage(leadId, newStage, note = '') {
    if (!isValidStage(newStage)) {
      throw new Error(`Invalid stage: ${newStage}. Allowed stages: ${PIPELINE_STAGES.join(', ')}`);
    }

    // Sync with local reactive storage immediately for fast UI feedback
    const leads = storage.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.pipeline_stage = newStage;
      lead.last_activity_at = new Date().toISOString();
      storage.updateLead(lead);
    }

    // Sync with backend API
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/leads/${encodeURIComponent(leadId)}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, note })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[crmService] Backend stage update sync warning:', err.message);
    }

    return { success: true, lead };
  },

  /**
   * Assign lead to a team member
   * @param {string} leadId
   * @param {string} assignedTo
   * @param {string} assignedToName
   */
  async assignLead(leadId, assignedTo, assignedToName) {
    const leads = storage.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.assigned_to = assignedTo;
      lead.assigned_to_name = assignedToName;
      lead.last_activity_at = new Date().toISOString();
      storage.updateLead(lead);
    }

    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/leads/${encodeURIComponent(leadId)}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo, assignedToName })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[crmService] Backend assign sync warning:', err.message);
    }

    return { success: true, lead };
  },

  /**
   * Fetch activities/notes for a lead
   */
  async getLeadActivities(leadId) {
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/leads/${encodeURIComponent(leadId)}/activities`);
      if (res.ok) {
        const data = await res.json();
        return data.activities || [];
      }
    } catch {
      // offline fallback
    }
    return [];
  },

  /**
   * Add a note or activity log to a lead
   */
  async addLeadActivity(leadId, content, type = 'note') {
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/leads/${encodeURIComponent(leadId)}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[crmService] Add activity failed:', err.message);
    }
    return { success: true };
  },

  /**
   * Get team members in the current organization
   */
  async getTeamMembers(orgId) {
    const targetOrgId = orgId || sessionManager.getOrgId() || 'org_default';
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/team?org_id=${encodeURIComponent(targetOrgId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.members)) {
          localStorage.setItem(`growprospect_team_${targetOrgId}`, JSON.stringify(data.members));
          return data.members;
        }
      }
    } catch {
      // fallback to localStorage
    }

    // Check if team members list exists in localStorage (including empty [])
    const local = localStorage.getItem(`growprospect_team_${targetOrgId}`);
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {}
    }

    // Initial default seed if never accessed or modified before
    const initialList = [
      {
        user_id: 'usr_admin_1',
        name: 'Alex Rivera',
        email: 'alex@growprospect.local',
        role: 'admin',
        org_id: targetOrgId
      },
      {
        user_id: 'usr_manager_1',
        name: 'Elena Rostova',
        email: 'elena@growprospect.local',
        role: 'manager',
        org_id: targetOrgId
      },
      {
        user_id: 'usr_rep_1',
        name: 'David Kim',
        email: 'david@growprospect.local',
        role: 'rep',
        org_id: targetOrgId
      }
    ];
    localStorage.setItem(`growprospect_team_${targetOrgId}`, JSON.stringify(initialList));
    return initialList;
  },

  /**
   * Edit lead fields (status, owner, deal_value, notes, next_followup, etc.)
   */
  async editLead(leadId, updates) {
    // Update local reactive storage immediately
    const leads = storage.getLeads();
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      Object.assign(lead, updates);
      if (updates.status) {
        lead.pipeline_stage = updates.status.charAt(0).toUpperCase() + updates.status.slice(1);
      }
      storage.updateLead(lead);
    }

    const res = await sessionManager.authFetch(`${API_URL}/api/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update lead: status ${res.status}`);
    }
    const data = await res.json();
    if (data.lead) {
      storage.updateLead(data.lead);
    }
    return data;
  },

  /**
   * Claim an unassigned lead for current user
   */
  async claimLead(leadId) {
    const res = await sessionManager.authFetch(`${API_URL}/api/leads/${encodeURIComponent(leadId)}/claim`, {
      method: 'POST'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to claim lead`);
    }
    const data = await res.json();
    if (data.lead) {
      storage.updateLead(data.lead);
    }
    return data;
  },

  /**
   * Bulk update leads (status, assign, tag, delete)
   */
  async bulkUpdateLeads(action, leadIds, updates = {}) {
    const res = await sessionManager.authFetch(`${API_URL}/api/leads/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, lead_ids: leadIds, ...updates })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to perform bulk action ${action}`);
    }
    const data = await res.json();
    
    // Sync local storage
    if (action === 'delete') {
      storage.deleteLeads(leadIds);
    }
    return data;
  },

  /**
   * Get tasks (mine, due=today|overdue|upcoming)
   */
  async getTasks(filters = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, v);
    });
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/tasks?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.tasks || [];
      }
    } catch (err) {
      console.warn('[crmService] Fetch tasks failed:', err.message);
    }
    return [];
  },

  /**
   * Create task
   */
  async createTask(taskData) {
    const res = await sessionManager.authFetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create task`);
    }
    return await res.json();
  },

  /**
   * Update task (done, title, due_date)
   */
  async updateTask(taskId, updates) {
    const res = await sessionManager.authFetch(`${API_URL}/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update task`);
    }
    return await res.json();
  },

  /**
   * Get location summaries with lead counts
   */
  async getLocations() {
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/locations`);
      if (res.ok) {
        const data = await res.json();
        return data.locations || [];
      }
    } catch {
      // fallback
    }
    return [];
  },

  /**
   * Get CRM Dashboard stats and metrics
   */
  async getDashboard({ scope = 'me', range = 'all' } = {}) {
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/dashboard?scope=${encodeURIComponent(scope)}&range=${encodeURIComponent(range)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[crmService] Dashboard fetch failed:', err.message);
    }

    // Client-side fallback from storage
    const allLeads = storage.getLeads();
    const currentUser = sessionManager.getSessionInfo()?.user;
    const currentUserId = currentUser?.id;
    let leads = allLeads;
    if (scope === 'me') {
      leads = leads.filter(l => l.owner_id === currentUserId || l.assigned_to === currentUserId);
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const wonLeads = leads.filter(l => (l.status || '').toLowerCase() === 'won');
    const wonCount = wonLeads.length;
    const wonValue = wonLeads.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);

    const locationMap = new Map();
    leads.forEach(l => {
      const loc = (l.city ? `${l.city}, ${l.country || 'US'}` : l.location || 'Unknown').trim();
      locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
    });

    const sourceMap = new Map();
    leads.forEach(l => {
      const src = (l.source || l.scraperName || 'Manual Import').trim();
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    });

    return {
      success: true,
      scope,
      range,
      kpis: {
        totalLeads: leads.length,
        newThisWeek: leads.filter(l => new Date(l.created_at || l.scrapedAt || Date.now()).getTime() >= sevenDaysAgo).length,
        followupsDueAndOverdue: leads.filter(l => l.next_followup && l.next_followup.slice(0, 10) <= todayStr).length,
        wonThisMonth: { count: wonCount, value: wonValue },
        conversionRate: leads.length > 0 ? Number(((wonCount / leads.length) * 100).toFixed(1)) : 0,
        staleLeadsCount: leads.filter(l => {
          const ts = l.last_contacted || l.last_activity_at || l.status_changed_at || l.created_at;
          return !ts || new Date(ts).getTime() <= sevenDaysAgo;
        }).length
      },
      funnel: {
        new: leads.filter(l => (l.status || 'new').toLowerCase() === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        replied: leads.filter(l => l.status === 'replied').length,
        meeting: leads.filter(l => l.status === 'meeting').length,
        proposal: leads.filter(l => l.status === 'proposal').length,
        won: wonCount,
        lost: leads.filter(l => l.status === 'lost').length,
      },
      leadsByLocation: Array.from(locationMap.entries()).map(([location, count]) => ({ location, count })).sort((a,b) => b.count - a.count).slice(0, 10),
      leadsBySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })).sort((a,b) => b.count - a.count),
      dueTodayList: leads.filter(l => l.next_followup && l.next_followup.slice(0, 10) <= todayStr).slice(0, 10),
      teamStats: {
        leadsPerRep: [],
        overduePerRep: [],
        wonPerRep: []
      }
    };
  },

  /**
   * Invite new team member
   */
  async inviteTeamMember({ name, email, role = 'rep' }) {
    const orgId = sessionManager.getOrgId() || 'org_default';
    const newMember = {
      user_id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      email,
      role,
      org_id: orgId,
      created_at: new Date().toISOString()
    };

    const current = await this.getTeamMembers(orgId);
    const updated = [...current, newMember];
    localStorage.setItem(`growprospect_team_${orgId}`, JSON.stringify(updated));

    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, org_id: orgId })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Local storage already updated
    }

    return { success: true, member: newMember };
  },

  /**
   * Update team member role (Admin only)
   */
  async updateMemberRole(userId, newRole) {
    const orgId = sessionManager.getOrgId() || 'org_default';
    const current = await this.getTeamMembers(orgId);
    const updated = current.map(m => (m.user_id === userId || m.id === userId) ? { ...m, role: newRole } : m);
    localStorage.setItem(`growprospect_team_${orgId}`, JSON.stringify(updated));

    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/team/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, org_id: orgId })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local storage already updated
    }

    return { success: true };
  },

  /**
   * Delete team member (Admin only)
   */
  async deleteTeamMember(userId) {
    const orgId = sessionManager.getOrgId() || 'org_default';
    const current = await this.getTeamMembers(orgId);
    const updated = current.filter(m => m.user_id !== userId && m.id !== userId);
    localStorage.setItem(`growprospect_team_${orgId}`, JSON.stringify(updated));

    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/crm/team/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local storage already updated
    }

    return { success: true };
  },

  /**
   * Get configured lost reasons
   */
  getLostReasons() {
    try {
      const stored = localStorage.getItem('growprospect_lost_reasons');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      'no budget',
      'no response',
      'chose competitor',
      'not a fit',
      'other'
    ];
  },

  /**
   * Save configured lost reasons
   */
  saveLostReasons(reasons) {
    localStorage.setItem('growprospect_lost_reasons', JSON.stringify(reasons));
    return reasons;
  },

  /**
   * Get auto-assignment rules
   */
  getAutoAssignmentRules() {
    try {
      const stored = localStorage.getItem('growprospect_auto_assign_rules');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      strategy: 'manual', // 'manual' | 'round_robin' | 'location'
      fallbackRepId: '',
      locationRules: [
        { location: 'California', repId: 'usr_rep_1', repName: 'David Kim' },
        { location: 'New York', repId: 'usr_manager_1', repName: 'Elena Rostova' }
      ]
    };
  },

  /**
   * Save auto-assignment rules
   */
  saveAutoAssignmentRules(rules) {
    localStorage.setItem('growprospect_auto_assign_rules', JSON.stringify(rules));
    return rules;
  }
};
