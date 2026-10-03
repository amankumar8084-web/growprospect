/**
 * AI Agents — GrowProspect CRM
 *
 * 10 modular AI-powered agents wired into the existing CRM data flow.
 * Each function is independently callable and returns structured JSON.
 * Uses Google Gemini API when GEMINI_API_KEY is set in environment.
 *
 * Agents:
 *  1. researchLead          — find/enrich lead intelligence
 *  2. scoreLead             — qualify & score lead 0-100
 *  3. generateOutreach      — personalized Email/WhatsApp/LinkedIn copy
 *  4. scheduleFollowup      — auto follow-up sequence management
 *  5. updateCRMFromContext  — auto-update stage/notes/next action
 *  6. generateProposal      — proposal/quotation from CRM data
 *  7. handleSupportQuery    — FAQ, order status, common queries
 *  8. reengageCustomer      — inactive customer re-engagement triggers
 *  9. recommendUpsell       — upsell/cross-sell opportunities
 * 10. analyzePerformance    — sales/revenue/performance analytics insights
 */

import https from 'node:https';
import http from 'node:http';

// ─── Gemini API helper ────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Call Google Gemini API with a prompt and return parsed JSON.
 * Falls back to a simple text response if JSON parsing fails.
 * @param {string} systemPrompt
 * @param {string} userContent
 * @returns {Promise<object>}
 */
async function callGemini(systemPrompt, userContent) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in apps/api/.env to enable AI agents.');
  }

  const payload = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n---\n${userContent}\n\nRespond ONLY with valid JSON. No markdown fences.` }]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`Gemini API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
            return;
          }
          const rawText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          // Strip markdown fences if present
          const clean = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
          try {
            resolve(JSON.parse(clean));
          } catch {
            resolve({ raw: rawText });
          }
        } catch (err) {
          reject(new Error(`Failed to parse Gemini response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Gemini API request timed out'));
    });
    req.write(payload);
    req.end();
  });
}

// ─── Lead context builder ─────────────────────────────────────────────────────

/**
 * Build a compact, structured context string from a lead object.
 * Strips undefined/null to keep prompt size small.
 */
function buildLeadContext(lead) {
  const fields = {
    id: lead.id,
    name: lead.name || lead.company_name,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    industry: lead.category || lead.industry,
    status: lead.status || lead.pipeline_stage,
    deal_value: lead.deal_value,
    source: lead.source,
    tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
    notes: lead.notes,
    last_contacted: lead.last_contacted,
    next_followup: lead.next_followup,
    assigned_to: lead.assigned_to_name,
    job_title: lead.job_title,
    opportunityType: lead.opportunityType,
    website_status: lead.website_status
  };
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// ─── 1. Lead Research Agent ────────────────────────────────────────────────────

/**
 * Research a lead to enrich intelligence about the company/contact.
 * Returns structured insights: company_overview, pain_points, buying_signals,
 * decision_makers, recommended_approach.
 */
export async function researchLead({ lead, additionalContext = '' }) {
  const ctx = buildLeadContext(lead);
  const system = `You are an expert B2B lead research analyst.
Given the information about a lead/company, provide a deep research summary.
Return JSON with keys:
- company_overview: string (2-3 sentences about the company)
- industry_insights: string (relevant market trends for their industry)
- pain_points: string[] (3-5 likely pain points this business faces)
- buying_signals: string[] (signals suggesting they are a good prospect)
- decision_makers: string[] (typical decision maker titles in this type of company)
- recommended_approach: string (specific outreach angle for this lead)
- research_confidence: "high"|"medium"|"low"
- priority_score: number 1-10 (how urgently to act on this lead)`;

  const userContent = `Lead Information:\n${ctx}${additionalContext ? `\n\nAdditional Context:\n${additionalContext}` : ''}`;
  return callGemini(system, userContent);
}

// ─── 2. Lead Scoring Agent ─────────────────────────────────────────────────────

/**
 * Qualify and score a lead 0-100 based on industry, company size,
 * requirements, and buying signals.
 * Returns score, tier, qualification breakdown, and recommended action.
 */
export async function scoreLead({ lead, scoringCriteria = {} }) {
  const ctx = buildLeadContext(lead);
  const system = `You are a B2B lead qualification expert using BANT and buying signal analysis.
Evaluate the lead and return JSON with:
- score: number 0-100 (overall lead quality score)
- tier: "A"|"B"|"C"|"D" (A = hot, D = cold)
- qualification: {
    budget_fit: number 0-10,
    authority_match: number 0-10,
    need_clarity: number 0-10,
    timing: number 0-10
  }
- buying_signals_detected: string[] (specific signals found)
- disqualifying_factors: string[] (concerns or red flags)
- recommended_action: string (next best action)
- urgency: "immediate"|"this_week"|"this_month"|"nurture"
- estimated_deal_size: string (rough range estimate)`;

  const userContent = `Lead to qualify:\n${ctx}${Object.keys(scoringCriteria).length ? `\n\nScoring Criteria:\n${JSON.stringify(scoringCriteria)}` : ''}`;
  return callGemini(system, userContent);
}

// ─── 3. AI Sales Outreach Agent ────────────────────────────────────────────────

/**
 * Generate personalized outreach messages for Email, WhatsApp, and LinkedIn.
 * Uses real lead data and the specified channel.
 */
export async function generateOutreach({ lead, channel = 'email', senderName = 'Sales Team', productContext = '' }) {
  const ctx = buildLeadContext(lead);
  const channelInstructions = {
    email: 'Write a personalized cold email. Include: subject line, opening (reference something specific), value proposition, social proof hint, and a soft CTA. Keep under 150 words.',
    whatsapp: 'Write a conversational WhatsApp message. Friendly, concise (under 60 words), personal opener, one clear value point, soft ask.',
    linkedin: 'Write a LinkedIn connection request note (under 300 chars) and a follow-up message (under 100 words).'
  };

  const system = `You are an expert B2B sales copywriter specializing in personalized outreach.
Channel: ${channel.toUpperCase()}
${channelInstructions[channel] || channelInstructions.email}
Return JSON with:
- channel: "${channel}"
- subject: string (for email) or null
- message: string (main message content)
- follow_up_message: string (follow-up variation)
- personalization_hooks: string[] (what made this personalized)
- tone: string
- estimated_open_rate: string`;

  const userContent = `Lead:\n${ctx}\nSender Name: ${senderName}${productContext ? `\nProduct/Service Context: ${productContext}` : ''}`;
  return callGemini(system, userContent);
}

// ─── 4. Automated Follow-up Agent ─────────────────────────────────────────────

/**
 * Design and schedule a follow-up sequence for a lead.
 * Returns a series of follow-up steps with timing, channel, and message.
 */
export async function scheduleFollowup({ lead, currentAttempt = 1, lastContactedAt = null, responseReceived = false }) {
  const ctx = buildLeadContext(lead);
  const system = `You are a sales follow-up automation expert.
Design a smart follow-up sequence based on the lead's current status.
Return JSON with:
- should_followup: boolean
- reason: string (why or why not)
- next_followup_date: string (ISO date, relative to today)
- sequence: array of {
    step: number,
    delay_days: number,
    channel: "email"|"whatsapp"|"linkedin"|"call",
    message_template: string,
    objective: string
  } (up to 5 steps)
- stop_condition: string (when to stop following up)
- escalation_flag: boolean (should this be escalated to manager?)`;

  const userContent = `Lead:\n${ctx}\nCurrent Attempt: ${currentAttempt}\nLast Contacted: ${lastContactedAt || 'Never'}\nResponse Received: ${responseReceived}`;
  return callGemini(system, userContent);
}

// ─── 5. AI CRM Update Agent ────────────────────────────────────────────────────

/**
 * Automatically determine the correct pipeline stage, notes, next action,
 * and reminders based on recent activity context.
 */
export async function updateCRMFromContext({ lead, activities = [], latestInteraction = '' }) {
  const ctx = buildLeadContext(lead);
  const activitySummary = activities
    .slice(0, 10)
    .map(a => `[${a.type}] ${a.content || a.body} (${a.created_at?.slice(0, 10)})`)
    .join('\n');

  const system = `You are an intelligent CRM automation assistant.
Based on a lead's current state and recent activities, determine the optimal CRM updates.
Return JSON with:
- recommended_stage: "New"|"Contacted"|"Replied"|"Meeting"|"Proposal"|"Won"|"Lost"
- stage_change_reason: string
- crm_note: string (auto-generated note to log)
- next_action: string (specific next step for the sales rep)
- next_followup_date: string (ISO date)
- deal_value_estimate: number or null
- tags_to_add: string[]
- priority: "urgent"|"high"|"normal"|"low"
- automation_confidence: number 0-100`;

  const userContent = `Lead:\n${ctx}\n\nRecent Activities:\n${activitySummary || 'None'}\n\nLatest Interaction:\n${latestInteraction || 'No new interaction'}`;
  return callGemini(system, userContent);
}

// ─── 6. AI Proposal Agent ─────────────────────────────────────────────────────

/**
 * Generate a professional proposal/quotation from CRM lead data.
 */
export async function generateProposal({ lead, services = [], customRequirements = '' }) {
  const ctx = buildLeadContext(lead);
  const servicesList = Array.isArray(services) && services.length
    ? services.join(', ')
    : 'Custom web development, digital transformation, UI/UX redesign';

  const system = `You are a professional proposal writer for a B2B agency.
Generate a structured proposal/quotation document for a lead.
Return JSON with:
- proposal_title: string
- executive_summary: string (3-4 sentences)
- problem_statement: string (their specific problem)
- proposed_solution: string (tailored solution overview)
- deliverables: string[] (list of specific deliverables)
- timeline: { total_weeks: number, phases: [{ phase: string, duration: string, tasks: string[] }] }
- investment: {
    base_price: number,
    currency: "USD",
    price_breakdown: [{ item: string, price: number }],
    payment_terms: string
  }
- why_us: string[] (3-4 value propositions)
- next_steps: string[]
- validity_days: number`;

  const userContent = `Lead/Client:\n${ctx}\nServices to Propose: ${servicesList}${customRequirements ? `\nCustom Requirements: ${customRequirements}` : ''}`;
  return callGemini(system, userContent);
}

// ─── 7. AI Support Agent ──────────────────────────────────────────────────────

/**
 * Handle FAQs, order/status queries, and common customer support questions.
 * Returns a structured support response.
 */
export async function handleSupportQuery({ query, lead = null, orgContext = '' }) {
  const leadCtx = lead ? buildLeadContext(lead) : '';
  const system = `You are a friendly and professional B2B customer support agent.
Answer the customer's query accurately and helpfully.
Return JSON with:
- answer: string (the support response, ready to send)
- confidence: number 0-100
- query_category: "faq"|"status"|"billing"|"technical"|"escalation"|"other"
- requires_human: boolean (true if this needs a human agent)
- escalation_reason: string or null
- suggested_resources: string[] (links/doc titles to share)
- follow_up_action: string (what the agent should do next)
- sentiment_detected: "positive"|"neutral"|"frustrated"|"urgent"`;

  const userContent = `Support Query: ${query}${leadCtx ? `\n\nCustomer CRM Data:\n${leadCtx}` : ''}${orgContext ? `\n\nOrg Context: ${orgContext}` : ''}`;
  return callGemini(system, userContent);
}

// ─── 8. AI Customer Re-engagement Agent ───────────────────────────────────────

/**
 * Detect inactive customers and generate targeted re-engagement campaigns.
 * Works across a batch of leads to find the most at-risk ones.
 */
export async function reengageCustomer({ leads = [], inactiveDaysThreshold = 30, orgContext = '' }) {
  const now = Date.now();
  const inactiveLeads = leads
    .filter(l => {
      const ts = l.last_contacted || l.last_activity_at || l.status_changed_at || l.created_at;
      if (!ts) return true;
      const daysSince = (now - new Date(ts).getTime()) / 86400000;
      return daysSince >= inactiveDaysThreshold;
    })
    .slice(0, 20); // Limit to top 20 for prompt size

  const leadsContext = inactiveLeads.map((l, i) => {
    const ts = l.last_contacted || l.last_activity_at || l.created_at;
    const daysSince = ts ? Math.round((now - new Date(ts).getTime()) / 86400000) : 'unknown';
    return `${i + 1}. ${l.name || l.company_name} (Status: ${l.status || 'new'}, Inactive: ${daysSince} days, Value: $${l.deal_value || 0})`;
  }).join('\n');

  const system = `You are a customer success and re-engagement specialist.
Analyze inactive customers and create targeted re-engagement strategies.
Return JSON with:
- inactive_count: number
- high_risk_leads: [{ name: string, days_inactive: number, risk_level: "critical"|"high"|"medium", reason: string }]
- re_engagement_campaign: {
    campaign_name: string,
    strategy: string,
    messages: [{ segment: string, channel: string, message: string }]
  }
- win_back_offers: string[] (specific offers/incentives to propose)
- recommended_schedule: string (when to launch the campaign)
- success_metrics: string[]`;

  const userContent = `Inactive Leads (${inactiveDaysThreshold}+ days):\n${leadsContext || 'No inactive leads found'}${orgContext ? `\n\nOrg Context: ${orgContext}` : ''}`;
  return callGemini(system, userContent);
}

// ─── 9. AI Recommendation Agent ───────────────────────────────────────────────

/**
 * Identify upsell and cross-sell opportunities from won/active customers.
 */
export async function recommendUpsell({ lead, currentServices = [], purchaseHistory = [] }) {
  const ctx = buildLeadContext(lead);
  const system = `You are a B2B sales strategy expert specializing in account expansion.
Identify the best upsell and cross-sell opportunities for this customer.
Return JSON with:
- upsell_opportunities: [{ service: string, rationale: string, estimated_value: number, probability: number }]
- cross_sell_opportunities: [{ service: string, rationale: string, estimated_value: number, probability: number }]
- expansion_strategy: string (overall approach)
- best_timing: string (when to approach)
- conversation_starter: string (how to open the upsell conversation)
- risk_of_churn: "high"|"medium"|"low"
- churn_indicators: string[]
- total_opportunity_value: number`;

  const userContent = `Customer:\n${ctx}\nCurrent Services: ${currentServices.join(', ') || 'Unknown'}\nPurchase History: ${purchaseHistory.join(', ') || 'None available'}`;
  return callGemini(system, userContent);
}

// ─── 10. AI Business Analyst Agent ────────────────────────────────────────────

/**
 * Analyze pipeline data and generate daily/weekly sales, revenue, and
 * performance insights with actionable recommendations.
 */
export async function analyzePerformance({ leads = [], tasks = [], activities = [], range = '7d', orgContext = '' }) {
  const now = new Date();
  const rangeMs = range === 'today' ? 86400000
    : range === '7d' ? 7 * 86400000
    : range === '30d' ? 30 * 86400000
    : 365 * 86400000;

  const cutoff = now.getTime() - rangeMs;

  // Build a compact analytics snapshot
  const stageBreakdown = {};
  let totalDeal = 0;
  let wonCount = 0;
  let wonValue = 0;
  let newLeads = 0;
  const repStats = {};

  for (const l of leads) {
    const stage = l.pipeline_stage || l.status || 'New';
    stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;
    totalDeal += Number(l.deal_value) || 0;

    const isWon = (l.status || '').toLowerCase() === 'won';
    if (isWon) { wonCount++; wonValue += Number(l.deal_value) || 0; }

    const created = new Date(l.created_at || l.scrapedAt || 0).getTime();
    if (created >= cutoff) newLeads++;

    const rep = l.assigned_to_name || 'Unassigned';
    if (!repStats[rep]) repStats[rep] = { leads: 0, won: 0, value: 0 };
    repStats[rep].leads++;
    if (isWon) { repStats[rep].won++; repStats[rep].value += Number(l.deal_value) || 0; }
  }

  const overdueTasks = tasks.filter(t => {
    if (t.done) return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < now;
  }).length;

  const activityBreakdown = {};
  for (const a of activities.slice(0, 200)) {
    activityBreakdown[a.type] = (activityBreakdown[a.type] || 0) + 1;
  }

  const snapshot = {
    range,
    total_leads: leads.length,
    new_leads_in_period: newLeads,
    stage_breakdown: stageBreakdown,
    pipeline_value: totalDeal,
    won_count: wonCount,
    won_value: wonValue,
    conversion_rate: leads.length > 0 ? ((wonCount / leads.length) * 100).toFixed(1) + '%' : '0%',
    overdue_tasks: overdueTasks,
    activity_breakdown: activityBreakdown,
    rep_performance: repStats
  };

  const system = `You are a senior B2B sales analyst and business intelligence expert.
Analyze the provided CRM performance data and generate actionable insights.
Return JSON with:
- executive_summary: string (2-3 sentence overview of performance)
- key_metrics: { metric: string, value: string, trend: "up"|"down"|"flat", insight: string }[]
- top_wins: string[] (what's working well)
- top_risks: string[] (concerns requiring immediate attention)
- pipeline_health: "excellent"|"good"|"fair"|"poor"
- pipeline_health_reason: string
- rep_insights: [{ rep: string, performance: string, recommendation: string }]
- weekly_priorities: string[] (top 3-5 actions to take this week)
- revenue_forecast: { optimistic: number, realistic: number, conservative: number, currency: "USD" }
- recommendations: [{ title: string, action: string, impact: "high"|"medium"|"low", effort: "high"|"medium"|"low" }]`;

  const userContent = `Performance Snapshot (${range}):\n${JSON.stringify(snapshot, null, 2)}${orgContext ? `\n\nOrg Context: ${orgContext}` : ''}`;
  return callGemini(system, userContent);
}

// ─── Agent registry for dynamic enable/disable ────────────────────────────────

export const AGENT_REGISTRY = {
  research:   { id: 'research',   name: 'Lead Research Agent',          description: 'Enriches leads with market intelligence, pain points, and approach recommendations', fn: researchLead },
  scoring:    { id: 'scoring',    name: 'Lead Scoring Agent',           description: 'Qualifies leads 0-100 using BANT + buying signals', fn: scoreLead },
  outreach:   { id: 'outreach',   name: 'AI Sales Agent',               description: 'Generates personalized Email, WhatsApp, and LinkedIn outreach', fn: generateOutreach },
  followup:   { id: 'followup',   name: 'Automated Follow-up Agent',    description: 'Schedules and manages multi-step follow-up sequences', fn: scheduleFollowup },
  crmupdate:  { id: 'crmupdate',  name: 'AI CRM Agent',                 description: 'Auto-updates stage, notes, next action and reminders from context', fn: updateCRMFromContext },
  proposal:   { id: 'proposal',   name: 'AI Proposal Agent',            description: 'Generates detailed proposals and quotations from CRM data', fn: generateProposal },
  support:    { id: 'support',    name: 'AI Support Agent',             description: 'Handles FAQs, order status and common customer queries', fn: handleSupportQuery },
  reengage:   { id: 'reengage',   name: 'AI Customer Re-engagement Agent', description: 'Detects inactive customers and triggers win-back campaigns', fn: reengageCustomer },
  recommend:  { id: 'recommend',  name: 'AI Recommendation Agent',      description: 'Identifies upsell and cross-sell opportunities per account', fn: recommendUpsell },
  analyze:    { id: 'analyze',    name: 'AI Business Analyst',          description: 'Daily/weekly sales, revenue and performance insights', fn: analyzePerformance },
};

// In-memory agent enable/disable state (per-org)
const agentEnabledState = {};

export function getAgentState(orgId) {
  if (!agentEnabledState[orgId]) {
    // Default: all agents enabled
    agentEnabledState[orgId] = Object.fromEntries(
      Object.keys(AGENT_REGISTRY).map(id => [id, true])
    );
  }
  return agentEnabledState[orgId];
}

export function setAgentState(orgId, agentId, enabled) {
  if (!agentEnabledState[orgId]) getAgentState(orgId);
  if (AGENT_REGISTRY[agentId]) {
    agentEnabledState[orgId][agentId] = Boolean(enabled);
    return true;
  }
  return false;
}
