/**
 * AI Agent Service — GrowProspect CRM Frontend
 *
 * Client-side service layer that wraps all 10 AI agent API endpoints.
 * Uses the existing sessionManager for authenticated requests.
 * All calls go through /api/ai/* and fall back gracefully on error.
 */

import { sessionManager } from './sessionManager.js';

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3001';

async function aiPost(endpoint, payload) {
  const res = await sessionManager.authFetch(`${API_URL}/api/ai/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `AI agent "${endpoint}" request failed (${res.status})`);
  }
  return data;
}

export const aiAgentService = {
  /**
   * Get all available agents and their enabled/disabled state.
   * @returns {Promise<{ agents: Array, gemini_configured: boolean }>}
   */
  async getAgents() {
    try {
      const res = await sessionManager.authFetch(`${API_URL}/api/ai/agents`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[aiAgentService] getAgents failed:', err.message);
    }
    return { success: false, agents: [], gemini_configured: false };
  },

  /**
   * Enable or disable a specific agent (admin only).
   * @param {string} agentId
   * @param {boolean} enabled
   */
  async toggleAgent(agentId, enabled) {
    const res = await sessionManager.authFetch(`${API_URL}/api/ai/agents/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    return await res.json();
  },

  // ─── Agent 1: Lead Research ────────────────────────────────────────────────
  /**
   * Research a lead to get company intelligence, pain points, and approach.
   * @param {string} leadId
   * @param {object} [lead] - pass lead object directly if not in backend store
   * @param {string} [additionalContext]
   */
  async researchLead(leadId, lead = null, additionalContext = '') {
    return aiPost('research', { leadId, lead, additionalContext });
  },

  // ─── Agent 2: Lead Scoring ─────────────────────────────────────────────────
  /**
   * Score a lead 0-100 with BANT qualification breakdown.
   * Score is automatically persisted back to the lead in the backend store.
   * @param {string} leadId
   * @param {object} [scoringCriteria]
   */
  async scoreLead(leadId, scoringCriteria = {}) {
    return aiPost('score', { leadId, scoringCriteria });
  },

  // ─── Agent 3: Sales Outreach ───────────────────────────────────────────────
  /**
   * Generate personalized outreach copy for a lead.
   * @param {string} leadId
   * @param {'email'|'whatsapp'|'linkedin'} channel
   * @param {string} [productContext]
   */
  async generateOutreach(leadId, channel = 'email', productContext = '') {
    return aiPost('outreach', { leadId, channel, productContext });
  },

  // ─── Agent 4: Follow-up Scheduler ─────────────────────────────────────────
  /**
   * Get a follow-up sequence for a lead.
   * Automatically creates a follow-up task in the CRM if recommended.
   * @param {string} leadId
   * @param {number} [currentAttempt]
   * @param {boolean} [responseReceived]
   */
  async scheduleFollowup(leadId, currentAttempt = 1, responseReceived = false) {
    return aiPost('followup', { leadId, currentAttempt, responseReceived });
  },

  // ─── Agent 5: CRM Auto-Update ─────────────────────────────────────────────
  /**
   * Auto-determine the correct CRM stage, note, and next action.
   * Pass autoApply=true to automatically commit the changes to the CRM store.
   * @param {string} leadId
   * @param {string} [latestInteraction]
   * @param {boolean} [autoApply]
   */
  async updateCRM(leadId, latestInteraction = '', autoApply = false) {
    return aiPost('crm-update', { leadId, latestInteraction, autoApply });
  },

  // ─── Agent 6: Proposal Generator ──────────────────────────────────────────
  /**
   * Generate a professional proposal/quotation for a lead.
   * @param {string} leadId
   * @param {string[]} [services]
   * @param {string} [customRequirements]
   */
  async generateProposal(leadId, services = [], customRequirements = '') {
    return aiPost('proposal', { leadId, services, customRequirements });
  },

  // ─── Agent 7: Support Agent ────────────────────────────────────────────────
  /**
   * Handle a support query with optional lead context.
   * @param {string} query
   * @param {string} [leadId]
   */
  async handleSupport(query, leadId = null) {
    return aiPost('support', { query, leadId });
  },

  // ─── Agent 8: Customer Re-engagement ─────────────────────────────────────
  /**
   * Detect inactive customers and get re-engagement campaign recommendations.
   * Scans ALL leads in the organization — no leadId needed.
   * @param {number} [inactiveDaysThreshold]
   */
  async reengageCustomers(inactiveDaysThreshold = 30) {
    return aiPost('reengage', { inactiveDaysThreshold });
  },

  // ─── Agent 9: Upsell/Cross-sell ───────────────────────────────────────────
  /**
   * Identify upsell and cross-sell opportunities for a customer.
   * @param {string} leadId
   * @param {string[]} [currentServices]
   * @param {string[]} [purchaseHistory]
   */
  async recommendUpsell(leadId, currentServices = [], purchaseHistory = []) {
    return aiPost('recommend', { leadId, currentServices, purchaseHistory });
  },

  // ─── Agent 10: Business Analyst ───────────────────────────────────────────
  /**
   * Get pipeline performance analysis and business insights.
   * Reads all org leads automatically on the backend.
   * @param {'today'|'7d'|'30d'|'all'} [range]
   */
  async analyzePerformance(range = '7d') {
    return aiPost('analyze', { range });
  }
};
