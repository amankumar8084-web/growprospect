import http from 'node:http';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { WebsiteCrawler } from '@lead-discovery/scraper-website';

const PORT = process.env.PORT || 3001;

// In-memory data store for backend API layer
const activeRuns = new Map();
const leadsStore = [];
const websiteCrawler = new WebsiteCrawler();

import { searchActivePlaces } from './controllers/providers.js';
import { getDashboardAnalytics } from './controllers/dashboard.js';
import { handleImportUpload, handleImportValidate, handleImportCommit } from './controllers/importController.js';
import { 
  getPipelineSummary, 
  transitionLeadStage, 
  assignLeadMember, 
  addLeadActivity, 
  getLeadActivities, 
  getOrgTeamMembers,
  crmTeamStore,
  editLead,
  claimLead,
  bulkUpdateLeads,
  getTasks,
  createTask,
  updateTask,
  getLocationSummaries,
  migrateOpportunityTypesToTags,
  getCRMDashboard
} from './controllers/crmController.js';
import { normalizeRole, PIPELINE_STAGES } from './constants/crm.js';
import { authenticateRequest, requireRole, canAccessLead } from './middlewares/authMiddleware.js';
import { filterStoreByTenantAndRole, validateOrgId } from './db/tenantQuery.js';
import {
  researchLead,
  scoreLead,
  generateOutreach,
  scheduleFollowup,
  updateCRMFromContext,
  generateProposal,
  handleSupportQuery,
  reengageCustomer,
  recommendUpsell,
  analyzePerformance,
  AGENT_REGISTRY,
  getAgentState,
  setAgentState
} from './agents/aiAgents.js';

const SCRAPERS_MANIFEST = [
  {
    id: 'no-website-biz',
    name: 'No-Website Business Finder',
    engine: 'Active Location Provider',
    engineBadge: 'Configurable Provider',
    status: 'ready',
    category: 'Business Discovery'
  },
  {
    id: 'outdated-website-biz',
    name: 'Outdated-Website Business Finder',
    engine: 'Crawlee + Playwright',
    engineBadge: 'Crawlee + Playwright',
    status: 'ready',
    category: 'Website Auditing'
  },
  {
    id: 'tech-hiring',
    name: 'Tech Hiring Finder',
    engine: 'Public Job Feeds & Web Adapters',
    engineBadge: 'Job Boards API',
    status: 'ready',
    category: 'Hiring & Talent'
  },
  {
    id: 'freelance-req',
    name: 'Freelancer Requirement Finder',
    engine: 'Public RFP Feeds & RSS',
    engineBadge: 'Contract RSS',
    status: 'ready',
    category: 'Contract RFP'
  }
];

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-org-id, x-org-role');
}

function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      } else if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
        if (!boundary) {
          return resolve({ raw: body, csvText: body });
        }
        const parts = body.split(`--${boundary}`);
        const result = {};
        for (const part of parts) {
          if (!part || part.trim() === '--' || part.trim() === '') continue;
          const splitIdx = part.indexOf('\r\n\r\n');
          if (splitIdx === -1) continue;
          const headersStr = part.slice(0, splitIdx);
          const partBody = part.slice(splitIdx + 4).replace(/\r\n$/, '');
          const filenameMatch = headersStr.match(/filename="([^"]+)"/i);
          const nameMatch = headersStr.match(/name="([^"]+)"/i);
          if (filenameMatch) {
            result.filename = filenameMatch[1];
            result.csvText = partBody;
          } else if (nameMatch) {
            result[nameMatch[1]] = partBody.trim();
          }
        }
        resolve(result);
      } else {
        try {
          resolve(body ? JSON.parse(body) : { raw: body, csvText: body });
        } catch {
          resolve({ raw: body, csvText: body });
        }
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // 1. Health check: the ONLY public unauthenticated endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        activeRunsCount: activeRuns.size,
        leadsCount: leadsStore.length
      });
      return;
    }

    // 2. Protect ALL other /api routes with @clerk/backend token verification
    if (pathname.startsWith('/api')) {
      try {
        await authenticateRequest(req);
      } catch (authErr) {
        sendJson(res, authErr.statusCode || 401, {
          success: false,
          error: authErr.message || 'Unauthorized: Missing or invalid token'
        });
        return;
      }
    }

    // 2a. Session Verification & Diagnostic endpoint
    if (pathname === '/api/auth/session' && req.method === 'GET') {
      sendJson(res, 200, {
        success: true,
        authenticated: true,
        session: req.auth,
        type: 'clerk_jwt',
        serverTimestamp: new Date().toISOString()
      });
      return;
    }

    // 2a-1. Team CRM Pipeline Summary Endpoint
    if (pathname === '/api/crm/pipeline' && req.method === 'GET') {
      requireRole('rep')(req);
      const pipelineData = await getPipelineSummary({ orgId: req.auth.orgId, user: req.auth, leadsStore });
      sendJson(res, 200, { success: true, ...pipelineData });
      return;
    }

    // 2a-2. Team CRM Lead Stage Transition Endpoint
    const stageMatch = pathname.match(/^\/api\/crm\/leads\/([^/]+)\/stage$/);
    if (stageMatch && req.method === 'PATCH') {
      requireRole('rep')(req);
      const leadId = decodeURIComponent(stageMatch[1]);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === req.auth.orgId);
      if (!lead) {
        sendJson(res, 404, { success: false, error: 'Lead not found in your organization' });
        return;
      }
      if (!canAccessLead(req.auth, lead)) {
        sendJson(res, 403, { success: false, error: 'Forbidden: Sales reps may only update leads assigned to them or unassigned leads' });
        return;
      }

      try {
        const result = await transitionLeadStage({
          leadId,
          newStage: body.stage,
          note: body.note,
          user: req.auth,
          orgId: req.auth.orgId,
          leadsStore
        });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    // 2a-3. Team CRM Lead Assignment Endpoint
    const assignMatch = pathname.match(/^\/api\/crm\/leads\/([^/]+)\/assign$/);
    if (assignMatch && req.method === 'PATCH') {
      requireRole('manager')(req);
      const leadId = decodeURIComponent(assignMatch[1]);
      const body = await parseJsonBody(req);

      try {
        const result = await assignLeadMember({
          leadId,
          assignedToUserId: body.assignedToUserId || body.assignedTo,
          assignedToName: body.assignedToName,
          user: req.auth,
          orgId: req.auth.orgId,
          leadsStore
        });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    // 2a-4. Team CRM Lead Activities / Notes Endpoints (supports /api/leads/:id/activities and /api/crm/leads/:id/activities)
    const actMatch = pathname.match(/^\/api\/(?:crm\/)?leads\/([^/]+)\/activities$/);
    if (actMatch && req.method === 'GET') {
      requireRole('rep')(req);
      const leadId = decodeURIComponent(actMatch[1]);
      const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === req.auth.orgId);
      if (!lead) {
        sendJson(res, 404, { success: false, error: 'Lead not found in your organization' });
        return;
      }
      if (!canAccessLead(req.auth, lead)) {
        sendJson(res, 403, { success: false, error: 'Forbidden: Sales reps may only access leads assigned to them or unassigned leads' });
        return;
      }
      const activities = await getLeadActivities({ leadId, orgId: req.auth.orgId });
      sendJson(res, 200, { success: true, activities });
      return;
    }

    if (actMatch && req.method === 'POST') {
      requireRole('rep')(req);
      const leadId = decodeURIComponent(actMatch[1]);
      const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === req.auth.orgId);
      if (!lead) {
        sendJson(res, 404, { success: false, error: 'Lead not found in your organization' });
        return;
      }
      if (!canAccessLead(req.auth, lead)) {
        sendJson(res, 403, { success: false, error: 'Forbidden: Sales reps may only access leads assigned to them or unassigned leads' });
        return;
      }
      const body = await parseJsonBody(req);

      try {
        const result = await addLeadActivity({
          leadId,
          type: body.type || 'note',
          body: body.body || body.content,
          content: body.content || body.body,
          user: req.auth,
          orgId: req.auth.orgId,
          leadsStore
        });
        sendJson(res, 201, result);
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    // 2a-5. Team CRM Organization Members Endpoint
    if (pathname === '/api/crm/team' && req.method === 'GET') {
      requireRole('rep')(req);
      const members = await getOrgTeamMembers(req.auth.orgId);
      sendJson(res, 200, { success: true, orgId: req.auth.orgId, members });
      return;
    }

    if ((pathname === '/api/crm/team' || pathname === '/api/crm/team/invite') && req.method === 'POST') {
      requireRole('admin')(req);
      const body = await parseJsonBody(req);
      const member = {
        id: `usr_${Date.now()}`,
        org_id: req.auth.orgId,
        user_id: body.userId || `usr_${Date.now()}`,
        name: body.name,
        email: body.email,
        role: normalizeRole(body.role || 'rep'),
        created_at: new Date().toISOString()
      };
      crmTeamStore.push(member);
      sendJson(res, 201, { success: true, member });
      return;
    }

    // Role update endpoint for user management
    const teamRoleMatch = pathname.match(/^\/api\/crm\/team\/([^/]+)\/role$/);
    if (teamRoleMatch && req.method === 'PATCH') {
      requireRole('admin')(req);
      const targetUserId = decodeURIComponent(teamRoleMatch[1]);
      const body = await parseJsonBody(req);
      const member = crmTeamStore.find(m => (m.user_id === targetUserId || m.id === targetUserId) && m.org_id === req.auth.orgId);
      if (member) {
        member.role = normalizeRole(body.role || 'rep');
      }
      sendJson(res, 200, { success: true, member });
      return;
    }

    // Delete team member endpoint
    const teamDeleteMatch = pathname.match(/^\/api\/crm\/team\/([^/]+)$/);
    if (teamDeleteMatch && req.method === 'DELETE') {
      requireRole('admin')(req);
      const targetUserId = decodeURIComponent(teamDeleteMatch[1]);
      const idx = crmTeamStore.findIndex(m => (m.user_id === targetUserId || m.id === targetUserId) && m.org_id === req.auth.orgId);
      if (idx !== -1) {
        crmTeamStore.splice(idx, 1);
      }
      sendJson(res, 200, { success: true });
      return;
    }

    // 2b-1. Unified CRM Dashboard Endpoint (GET /api/dashboard?scope=me|team&range=today|7d|30d|all)
    if (pathname === '/api/dashboard' && req.method === 'GET') {
      requireRole('rep')(req);
      const scope = url.searchParams.get('scope') || (req.auth.role === 'rep' ? 'me' : 'team');
      const range = url.searchParams.get('range') || 'all';

      try {
        const dashboardData = await getCRMDashboard({
          orgId: req.auth.orgId,
          user: req.auth,
          scope,
          range,
          leadsStore
        });
        sendJson(res, 200, dashboardData);
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // 2b. Real Dashboard Analytics Endpoint
    if ((pathname === '/api/analytics' || pathname === '/api/dashboard/metrics') && req.method === 'GET') {
      requireRole('rep')(req);
      const timeFilter = url.searchParams.get('timeFilter') || 'all';
      const scopedLeads = filterStoreByTenantAndRole(leadsStore, req.auth.orgId, req.auth.userId, req.auth.role);
      try {
        const analytics = await getDashboardAnalytics({
          timeFilter,
          inMemoryLeads: scopedLeads,
          activeRuns
        });
        sendJson(res, 200, analytics);
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // 2c. Analytics Sync Endpoint (sync client-side leads with backend store)
    if (pathname === '/api/analytics/sync' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const incomingLeads = body.leads || [];
      if (Array.isArray(incomingLeads)) {
        const existingSignatures = new Set(leadsStore.map(l => `${l.name}|${l.location}`));
        incomingLeads.forEach(l => {
          const sig = `${l.name}|${l.location}`;
          if (!existingSignatures.has(sig)) {
            existingSignatures.add(sig);
            leadsStore.unshift(l);
          }
        });
      }
      sendJson(res, 200, { success: true, count: leadsStore.length });
      return;
    }

    // 2d. Lead Import Upload / Preview Endpoint
    if ((pathname === '/api/import/upload' || pathname === '/api/imports/preview' || pathname === '/api/import/preview') && req.method === 'POST') {
      requireRole('manager')(req);
      try {
        const body = await parseJsonBody(req);
        const source = body.source || 'Google Maps';
        const previewResult = await handleImportUpload(body, source);
        sendJson(res, 200, previewResult);
      } catch (err) {
        sendJson(res, 400, { success: false, message: err.message });
      }
      return;
    }

    // 2e. Lead Import Validate Endpoint
    if ((pathname === '/api/import/validate' || pathname === '/api/imports/validate') && req.method === 'POST') {
      requireRole('manager')(req);
      try {
        const body = await parseJsonBody(req);
        const validationResult = await handleImportValidate(body);
        sendJson(res, 200, validationResult);
      } catch (err) {
        sendJson(res, 400, { success: false, message: err.message });
      }
      return;
    }

    // 2f. Lead Import Commit Endpoint
    if ((pathname === '/api/import/commit' || pathname === '/api/imports/commit') && req.method === 'POST') {
      requireRole('manager')(req);
      try {
        const body = await parseJsonBody(req);
        const orgId = req.auth.orgId;
        const commitResult = await handleImportCommit({ ...body, orgId }, leadsStore);
        sendJson(res, 200, commitResult);
      } catch (err) {
        sendJson(res, 400, { success: false, message: err.message });
      }
      return;
    }

    // 2g. Manual Single Lead Creation Endpoint
    if (pathname === '/api/leads' && req.method === 'POST') {
      requireRole('rep')(req);
      try {
        const body = await parseJsonBody(req);
        const orgId = req.auth.orgId;
        const name = body.company_name || body.name || 'Unnamed Lead';

        let assignedTo = body.assigned_to || null;
        let assignedToName = body.assigned_to_name || null;
        if (req.auth.role === 'rep') {
          // Reps automatically assign leads to themselves
          assignedTo = req.auth.userId;
          assignedToName = req.auth.userName || req.auth.email || 'Sales Rep';
        }

        const leadStatus = (body.status || body.pipeline_stage || 'new').toLowerCase();
        const initialStage = leadStatus.charAt(0).toUpperCase() + leadStatus.slice(1);

        const lead = {
          id: `lead-manual-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          org_id: orgId,
          status: leadStatus,
          pipeline_stage: initialStage,
          lost_reason: body.lost_reason || null,
          status_changed_at: new Date().toISOString(),
          owner_id: assignedTo,
          assigned_to: assignedTo,
          assigned_to_name: assignedToName,
          assigned_at: assignedTo ? new Date().toISOString() : null,
          created_by: req.auth.userId,
          deal_value: body.deal_value !== undefined && body.deal_value !== null ? Number(body.deal_value) : null,
          last_activity_at: new Date().toISOString(),
          name,
          company_name: name,
          job_title: body.job_title || null,
          email: body.email || null,
          phone: body.phone || null,
          website: body.website || null,
          location: body.city ? `${body.city}, ${body.state ? body.state + ', ' : ''}${body.country || 'US'}` : (body.address || 'US'),
          city: body.city || '',
          state: body.state || '',
          country: body.country || 'US',
          tags: Array.isArray(body.tags) ? body.tags : [],
          notes: body.notes || null,
          next_followup: body.next_followup || null,
          last_contacted: body.last_contacted || null,
          source: body.source || 'Manual Entry',
          scraperId: 'no-website-biz',
          scraperName: 'Manual Entry',
          opportunityType: body.opportunityType || (body.website ? 'Website Audit' : 'No Website'),
          website_status: body.website ? 'Website Exists' : 'No Website',
          emailVerificationStatus: body.email ? 'verified' : 'not_applicable',
          scrapedAt: new Date().toISOString(),
          lead_status: 'new'
        };
        migrateOpportunityTypesToTags(lead);
        leadsStore.unshift(lead);
        sendJson(res, 201, { success: true, lead });
      } catch (err) {
        sendJson(res, 400, { success: false, message: err.message });
      }
      return;
    }

    // Scrapers catalog (viewable by rep, manager, admin)
    if (pathname === '/api/scrapers' && req.method === 'GET') {
      requireRole('rep')(req);
      sendJson(res, 200, { scrapers: SCRAPERS_MANIFEST });
      return;
    }

    if (pathname === '/api/providers/search' && req.method === 'POST') {
      requireRole('manager')(req);
      const body = await parseJsonBody(req);
      try {
        const places = await searchActivePlaces(body);
        sendJson(res, 200, { success: true, places, count: places.length });
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    // Enrich single domain endpoint (Manager or Admin)
    if (pathname === '/api/enrich' && req.method === 'POST') {
      requireRole('manager')(req);
      const body = await parseJsonBody(req);
      const urlToEnrich = body.url;
      if (!urlToEnrich) {
        sendJson(res, 400, { error: 'url parameter is required' });
        return;
      }
      try {
        const enrichment = await websiteCrawler.auditAndEnrichDomain(urlToEnrich);
        sendJson(res, 200, { success: true, enrichment });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    // 3. List all runs (scoped to organization)
    if (pathname === '/api/runs' && req.method === 'GET') {
      requireRole('rep')(req);
      const runs = Array.from(activeRuns.values())
        .filter((r) => (r.org_id || 'org_default') === req.auth.orgId)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      sendJson(res, 200, { runs });
      return;
    }

    // 4. Dispatch a new scraper run (Manager or Admin)
    if (pathname === '/api/runs' && req.method === 'POST') {
      requireRole('manager')(req);
      const body = await parseJsonBody(req);
      const { scraperId, filters = {} } = body;

      const scraper = SCRAPERS_MANIFEST.find((s) => s.id === scraperId);
      if (!scraper) {
        sendJson(res, 400, { error: `Invalid scraperId: ${scraperId}` });
        return;
      }

      const runId = `RUN-${Math.floor(1000 + Math.random() * 9000)}`;
      const runRecord = {
        id: runId,
        org_id: req.auth.orgId,
        scraperId,
        scraperName: scraper.name,
        status: 'running',
        startedAt: new Date().toISOString(),
        completedAt: null,
        progress: 10,
        recordsFound: 0,
        recordsSaved: 0,
        duplicates: 0,
        errors: 0,
        filters,
        logs: [
          { time: 'Just now', level: 'info', message: `Background worker spawned for ${scraper.name}` },
          { time: 'Just now', level: 'info', message: `Applied filters: ${JSON.stringify(filters)}` }
        ]
      };

      activeRuns.set(runId, runRecord);

      // Execute worker asynchronously outside request cycle, stamping orgId
      dispatchWorkerTask(runId, scraperId, filters, req.auth.orgId);

      sendJson(res, 202, { message: 'Run accepted', run: runRecord });
      return;
    }

    // 5. Get run details & streaming logs (scoped to organization)
    const runMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9_-]+)$/);
    if (runMatch && req.method === 'GET') {
      requireRole('rep')(req);
      const runId = runMatch[1];
      const run = activeRuns.get(runId);
      if (!run || (run.org_id && run.org_id !== req.auth.orgId)) {
        sendJson(res, 404, { error: 'Run not found' });
        return;
      }
      sendJson(res, 200, { run });
      return;
    }

    // 6. Stop run (Manager or Admin)
    const stopMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9_-]+)\/stop$/);
    if (stopMatch && req.method === 'POST') {
      requireRole('manager')(req);
      const runId = stopMatch[1];
      const run = activeRuns.get(runId);
      if (!run || (run.org_id && run.org_id !== req.auth.orgId)) {
        sendJson(res, 404, { error: 'Run not found' });
        return;
      }
      run.status = 'stopped';
      run.completedAt = new Date().toISOString();
      run.logs.push({ time: 'Just now', level: 'warn', message: 'Worker aborted by user request' });
      sendJson(res, 200, { success: true, run });
      return;
    }

    // 6b. Location Aggregation Endpoint (city/country with lead counts)
    if (pathname === '/api/locations' && req.method === 'GET') {
      requireRole('rep')(req);
      const locations = await getLocationSummaries({ orgId: req.auth.orgId, leadsStore });
      sendJson(res, 200, { success: true, locations });
      return;
    }

    // 6c. Tasks API (GET /api/tasks, POST /api/tasks, PATCH /api/tasks/:id)
    if (pathname === '/api/tasks' && req.method === 'GET') {
      requireRole('rep')(req);
      const mine = url.searchParams.get('mine');
      const due = url.searchParams.get('due');
      const done = url.searchParams.get('done');
      const assignee_id = url.searchParams.get('assignee_id');
      const lead_id = url.searchParams.get('lead_id');

      const tasks = await getTasks({
        orgId: req.auth.orgId,
        user: req.auth,
        filters: { mine, due, done, assignee_id, lead_id }
      });
      sendJson(res, 200, { success: true, tasks });
      return;
    }

    if (pathname === '/api/tasks' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      try {
        const result = await createTask({ orgId: req.auth.orgId, user: req.auth, taskData: body });
        sendJson(res, 201, result);
      } catch (err) {
        sendJson(res, err.statusCode || 400, { success: false, error: err.message });
      }
      return;
    }

    const taskPatchMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskPatchMatch && req.method === 'PATCH') {
      requireRole('rep')(req);
      const taskId = decodeURIComponent(taskPatchMatch[1]);
      const body = await parseJsonBody(req);
      try {
        const result = await updateTask({ taskId, orgId: req.auth.orgId, user: req.auth, updates: body });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err.statusCode || 400, { success: false, error: err.message });
      }
      return;
    }

    // 6d. Bulk Lead Actions Endpoint (POST /api/leads/bulk)
    if (pathname === '/api/leads/bulk' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const action = body.action || 'status';
      const leadIds = body.lead_ids || body.ids || [];
      try {
        const result = await bulkUpdateLeads({
          action,
          leadIds,
          updates: body,
          user: req.auth,
          orgId: req.auth.orgId,
          leadsStore
        });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err.statusCode || 400, { success: false, error: err.message });
      }
      return;
    }

    // 6e. Claim Unassigned Lead Endpoint (POST /api/leads/:id/claim)
    const claimMatch = pathname.match(/^\/api\/leads\/([^/]+)\/claim$/);
    if (claimMatch && req.method === 'POST') {
      requireRole('rep')(req);
      const leadId = decodeURIComponent(claimMatch[1]);
      try {
        const result = await claimLead({ leadId, user: req.auth, orgId: req.auth.orgId, leadsStore });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err.statusCode || 400, { success: false, error: err.message });
      }
      return;
    }

    // 6f. Edit Single Lead Endpoint (PATCH /api/leads/:id)
    const patchLeadMatch = pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (patchLeadMatch && req.method === 'PATCH') {
      requireRole('rep')(req);
      const leadId = decodeURIComponent(patchLeadMatch[1]);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find((l) => l.id === leadId && (l.org_id || 'org_default') === req.auth.orgId);
      if (!lead) {
        sendJson(res, 404, { success: false, error: 'Lead not found in your organization' });
        return;
      }
      if (!canAccessLead(req.auth, lead)) {
        sendJson(res, 403, { success: false, error: 'Forbidden: Sales reps may only update leads assigned to them or unassigned leads' });
        return;
      }
      try {
        const result = await editLead({ leadId, updates: body, user: req.auth, orgId: req.auth.orgId, leadsStore });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err.statusCode || 400, { success: false, error: err.message });
      }
      return;
    }

    // 7. Leads query with multi-tenant filtering, tabs, stale, tag, location & role-based visibility
    if (pathname === '/api/leads' && req.method === 'GET') {
      requireRole('rep')(req);
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const type = url.searchParams.get('type');
      const stage = url.searchParams.get('stage');
      const status = url.searchParams.get('status');
      const owner = url.searchParams.get('owner') || url.searchParams.get('owner_id') || url.searchParams.get('assigned_to');
      const tag = url.searchParams.get('tag');
      const country = url.searchParams.get('country');
      const state = url.searchParams.get('state');
      const city = url.searchParams.get('city');
      const tab = url.searchParams.get('tab');
      const stale = url.searchParams.get('stale');
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);

      // Multi-tenant & Role isolation: reps only see their own assigned leads + unassigned leads
      let results = filterStoreByTenantAndRole(leadsStore, req.auth.orgId, req.auth.userId, req.auth.role);

      // Ensure tags and opportunityType migration
      results.forEach(migrateOpportunityTypesToTags);

      if (tab === 'mine') {
        results = results.filter((l) => l.owner_id === req.auth.userId || l.assigned_to === req.auth.userId);
      } else if (tab === 'unassigned') {
        results = results.filter((l) => !l.owner_id && !l.assigned_to);
      }

      if (status && status !== 'ALL') {
        const sLower = status.toLowerCase();
        results = results.filter((l) => (l.status || '').toLowerCase() === sLower || (l.pipeline_stage || '').toLowerCase() === sLower);
      }

      if (owner && owner !== 'ALL') {
        results = results.filter((l) => l.owner_id === owner || l.assigned_to === owner);
      }

      if (tag && tag !== 'ALL') {
        const tLower = tag.toLowerCase();
        results = results.filter((l) => Array.isArray(l.tags) && l.tags.some((t) => t.toLowerCase() === tLower));
      }

      if (country && country !== 'ALL') {
        results = results.filter((l) => (l.country || '').toLowerCase() === country.toLowerCase());
      }

      if (state && state !== 'ALL') {
        results = results.filter((l) => (l.state || '').toLowerCase() === state.toLowerCase());
      }

      if (city && city !== 'ALL') {
        results = results.filter((l) => (l.city || '').toLowerCase() === city.toLowerCase());
      }

      if (stale) {
        const days = parseInt(stale, 10);
        if (!isNaN(days) && days > 0) {
          const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
          results = results.filter((l) => {
            const ts = l.last_contacted || l.last_activity_at || l.status_changed_at || l.scrapedAt;
            if (!ts) return true;
            const timeMs = new Date(ts).getTime();
            return isNaN(timeMs) || timeMs <= cutoff;
          });
        }
      }

      if (search) {
        results = results.filter(
          (l) =>
            (l.name && l.name.toLowerCase().includes(search)) ||
            (l.company_name && l.company_name.toLowerCase().includes(search)) ||
            (l.location && l.location.toLowerCase().includes(search)) ||
            (l.email && l.email.toLowerCase().includes(search)) ||
            (l.city && l.city.toLowerCase().includes(search)) ||
            (Array.isArray(l.tags) && l.tags.some(t => t.toLowerCase().includes(search)))
        );
      }

      if (type && type !== 'ALL') {
        results = results.filter((l) => l.opportunityType === type || (Array.isArray(l.tags) && l.tags.includes(type)));
      }

      if (stage && stage !== 'ALL') {
        results = results.filter((l) => (l.pipeline_stage || 'New') === stage || (l.status || 'new') === stage.toLowerCase());
      }

      const total = results.length;
      const paginated = results.slice((page - 1) * limit, page * limit);

      sendJson(res, 200, {
        total,
        page,
        limit,
        orgId: req.auth.orgId,
        leads: paginated
      });
      return;
    }

    // 7b. Delete single lead by ID (Manager or Admin)
    const deleteLeadMatch = pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (deleteLeadMatch && req.method === 'DELETE') {
      requireRole('manager')(req);
      const leadId = decodeURIComponent(deleteLeadMatch[1]);
      const orgId = req.auth.orgId;
      const idx = leadsStore.findIndex((l) => l.id === leadId && (l.org_id || 'org_default') === orgId);
      if (idx === -1) {
        sendJson(res, 404, { success: false, error: 'Lead not found in your organization' });
        return;
      }
      leadsStore.splice(idx, 1);
      sendJson(res, 200, { success: true, message: `Lead ${leadId} permanently deleted` });
      return;
    }

    // 7c. Bulk delete leads (Manager or Admin)
    if ((pathname === '/api/leads/bulk-delete' && req.method === 'POST') || (pathname === '/api/leads' && req.method === 'DELETE')) {
      requireRole('manager')(req);
      const body = await parseJsonBody(req);
      const idsToDelete = new Set(body.ids || []);
      let deletedCount = 0;
      if (idsToDelete.size > 0) {
        for (let i = leadsStore.length - 1; i >= 0; i--) {
          if (idsToDelete.has(leadsStore[i].id) && (leadsStore[i].org_id || 'org_default') === req.auth.orgId) {
            leadsStore.splice(i, 1);
            deletedCount++;
          }
        }
      }
      sendJson(res, 200, { success: true, count: deletedCount });
      return;
    }

    // ─── AI AGENTS ROUTES (/api/ai/*) ─────────────────────────────────────────

    // GET /api/ai/agents — list all agents and their enabled/disabled state
    if (pathname === '/api/ai/agents' && req.method === 'GET') {
      requireRole('rep')(req);
      const state = getAgentState(req.auth.orgId);
      const agents = Object.values(AGENT_REGISTRY).map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        enabled: state[a.id] !== false
      }));
      sendJson(res, 200, { success: true, agents, gemini_configured: Boolean(process.env.GEMINI_API_KEY) });
      return;
    }

    // PATCH /api/ai/agents/:agentId — enable/disable a specific agent
    const agentToggleMatch = pathname.match(/^\/api\/ai\/agents\/([^/]+)$/);
    if (agentToggleMatch && req.method === 'PATCH') {
      requireRole('admin')(req);
      const agentId = agentToggleMatch[1];
      const body = await parseJsonBody(req);
      const ok = setAgentState(req.auth.orgId, agentId, body.enabled);
      if (!ok) { sendJson(res, 404, { success: false, error: `Unknown agent: ${agentId}` }); return; }
      sendJson(res, 200, { success: true, agentId, enabled: body.enabled });
      return;
    }

    // POST /api/ai/research — Agent 1: Lead Research
    if (pathname === '/api/ai/research' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      try {
        const result = await researchLead({ lead, additionalContext: body.additionalContext || '' });
        sendJson(res, 200, { success: true, agentId: 'research', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/score — Agent 2: Lead Scoring
    if (pathname === '/api/ai/score' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      try {
        const result = await scoreLead({ lead, scoringCriteria: body.scoringCriteria || {} });
        // Auto-update lead score in store if found
        const storeLead = leadsStore.find(l => l.id === (body.leadId || lead.id));
        if (storeLead && result.score !== undefined) {
          storeLead.ai_score = result.score;
          storeLead.ai_tier = result.tier;
          storeLead.last_activity_at = new Date().toISOString();
        }
        sendJson(res, 200, { success: true, agentId: 'scoring', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/outreach — Agent 3: Sales Outreach
    if (pathname === '/api/ai/outreach' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      try {
        const result = await generateOutreach({
          lead,
          channel: body.channel || 'email',
          senderName: req.auth.userName || req.auth.name || 'Sales Team',
          productContext: body.productContext || ''
        });
        sendJson(res, 200, { success: true, agentId: 'outreach', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/followup — Agent 4: Follow-up Scheduler
    if (pathname === '/api/ai/followup' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      const activities = crmActivitiesStore
        ? crmActivitiesStore.filter(a => a.lead_id === (body.leadId || lead.id)).slice(0, 10)
        : [];
      try {
        const result = await scheduleFollowup({
          lead,
          currentAttempt: body.currentAttempt || activities.length + 1,
          lastContactedAt: lead.last_contacted || activities[0]?.created_at,
          responseReceived: body.responseReceived || false
        });
        // Auto-create task if followup recommended
        if (result.should_followup && result.next_followup_date) {
          const followupTask = {
            id: `task_ai_fu_${Date.now()}`,
            org_id: req.auth.orgId,
            lead_id: body.leadId || lead.id,
            assignee_id: lead.assigned_to || req.auth.userId,
            title: `[AI] Follow up with ${lead.name || lead.company_name}`,
            due_date: result.next_followup_date,
            done: false,
            created_by: 'ai_followup_agent',
            created_at: new Date().toISOString()
          };
          const { tasksStore: ts } = await import('./controllers/crmController.js');
          if (Array.isArray(ts)) ts.unshift(followupTask);
        }
        sendJson(res, 200, { success: true, agentId: 'followup', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/crm-update — Agent 5: CRM Auto-Update
    if (pathname === '/api/ai/crm-update' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      const activities = crmActivitiesStore
        ? crmActivitiesStore.filter(a => a.lead_id === (body.leadId || lead.id)).slice(0, 10)
        : [];
      try {
        const result = await updateCRMFromContext({ lead, activities, latestInteraction: body.latestInteraction || '' });
        // Apply recommended updates to the lead in store
        const storeLead = leadsStore.find(l => l.id === (body.leadId || lead.id));
        if (storeLead && result.recommended_stage && body.autoApply) {
          storeLead.pipeline_stage = result.recommended_stage;
          storeLead.status = result.recommended_stage.toLowerCase();
          if (result.next_followup_date) storeLead.next_followup = result.next_followup_date;
          if (result.deal_value_estimate) storeLead.deal_value = result.deal_value_estimate;
          if (Array.isArray(result.tags_to_add) && result.tags_to_add.length) {
            if (!Array.isArray(storeLead.tags)) storeLead.tags = [];
            result.tags_to_add.forEach(t => { if (!storeLead.tags.includes(t)) storeLead.tags.push(t); });
          }
          storeLead.last_activity_at = new Date().toISOString();
          // Log CRM note
          if (result.crm_note && crmActivitiesStore) {
            crmActivitiesStore.unshift({
              id: `act_ai_${Date.now()}`,
              org_id: req.auth.orgId,
              lead_id: storeLead.id,
              user_id: 'ai_crm_agent',
              user_name: 'AI CRM Agent',
              type: 'note',
              body: result.crm_note,
              content: result.crm_note,
              created_at: new Date().toISOString()
            });
          }
        }
        sendJson(res, 200, { success: true, agentId: 'crmupdate', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/proposal — Agent 6: Proposal Generator
    if (pathname === '/api/ai/proposal' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      try {
        const result = await generateProposal({
          lead,
          services: body.services || [],
          customRequirements: body.customRequirements || ''
        });
        sendJson(res, 200, { success: true, agentId: 'proposal', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/support — Agent 7: Support Agent
    if (pathname === '/api/ai/support' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = body.leadId
        ? leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        : null;
      try {
        const result = await handleSupportQuery({
          query: body.query || '',
          lead,
          orgContext: body.orgContext || ''
        });
        sendJson(res, 200, { success: true, agentId: 'support', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/reengage — Agent 8: Customer Re-engagement
    if (pathname === '/api/ai/reengage' && req.method === 'POST') {
      requireRole('manager')(req);
      const body = await parseJsonBody(req);
      const orgLeads = leadsStore.filter(l => (l.org_id || 'org_default') === req.auth.orgId);
      try {
        const result = await reengageCustomer({
          leads: orgLeads,
          inactiveDaysThreshold: body.inactiveDaysThreshold || 30,
          orgContext: body.orgContext || ''
        });
        sendJson(res, 200, { success: true, agentId: 'reengage', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/recommend — Agent 9: Upsell/Cross-sell Recommendations
    if (pathname === '/api/ai/recommend' && req.method === 'POST') {
      requireRole('rep')(req);
      const body = await parseJsonBody(req);
      const lead = leadsStore.find(l => l.id === body.leadId && (l.org_id || 'org_default') === req.auth.orgId)
        || body.lead || {};
      try {
        const result = await recommendUpsell({
          lead,
          currentServices: body.currentServices || [],
          purchaseHistory: body.purchaseHistory || []
        });
        sendJson(res, 200, { success: true, agentId: 'recommend', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // POST /api/ai/analyze — Agent 10: Business Analyst
    if (pathname === '/api/ai/analyze' && req.method === 'POST') {
      requireRole('manager')(req);
      const body = await parseJsonBody(req);
      const orgLeads = leadsStore.filter(l => (l.org_id || 'org_default') === req.auth.orgId);
      const orgTasks = (await import('./controllers/crmController.js')).tasksStore
        ? (await import('./controllers/crmController.js')).tasksStore.filter(t => (t.org_id || 'org_default') === req.auth.orgId)
        : [];
      const orgActivities = crmActivitiesStore
        ? crmActivitiesStore.filter(a => (a.org_id || 'org_default') === req.auth.orgId).slice(0, 200)
        : [];
      try {
        const result = await analyzePerformance({
          leads: orgLeads,
          tasks: orgTasks,
          activities: orgActivities,
          range: body.range || '7d',
          orgContext: body.orgContext || ''
        });
        sendJson(res, 200, { success: true, agentId: 'analyze', result });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // ─── END AI AGENTS ROUTES ────────────────────────────────────────────────

    sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    if (err.statusCode) {
      sendJson(res, err.statusCode, { success: false, error: err.message });
      return;
    }
    console.error('[API Error]:', err);
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

// Asynchronous worker executor (handles Geoapify discovery, Crawlee enrichment, etc.)
async function dispatchWorkerTask(runId, scraperId, filters, orgId = 'org_default') {
  const run = activeRuns.get(runId);
  if (!run) return;

  try {
    if (scraperId === 'no-website-biz') {
      run.logs.push({ time: '01s', level: 'info', message: 'Querying configured location provider...' });
      const places = await searchActivePlaces({
        country: filters.country,
        state: filters.state,
        city: filters.city,
        category: filters.category,
        limit: filters.quantity || filters.limit || 20
      });

      const noWebsiteLeads = places.filter(p => !p.website).map(p => ({
        id: p.id,
        org_id: orgId,
        name: p.name,
        company_name: p.name,
        opportunityType: 'No Website',
        category: p.category || filters.category || 'Commercial Services',
        location: p.address || `${filters.city}, ${filters.country}`,
        website: null,
        phone: p.phone || null,
        email: null,
        emailVerificationStatus: 'not_applicable',
        source: p.source,
        scraperId: 'no-website-biz',
        scraperName: 'No-Website Business Finder',
        sourceUrl: p.sourceUrl,
        scrapedAt: new Date().toISOString(),
        scraperRunId: runId,
        pipeline_stage: 'New',
        deal_value: 0,
        assigned_to: null,
        assigned_to_name: null,
        last_activity_at: new Date().toISOString(),
        signals: {
          hasWebsite: false,
          discoveryConfidence: 'HIGH',
          address: p.address
        }
      }));

      run.recordsFound = places.length;
      run.recordsSaved = noWebsiteLeads.length;
      run.progress = 100;
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      run.logs.push({
        time: '03s',
        level: 'success',
        message: `Discovered ${places.length} businesses. Saved ${noWebsiteLeads.length} leads with NO website.`
      });
      leadsStore.unshift(...noWebsiteLeads);
    } else if (scraperId === 'outdated-website-biz') {
      run.logs.push({ time: '01s', level: 'info', message: 'Dispatching Crawlee crawler batch for website signal evaluation' });
      
      const domainResults = [];
      const candidateDomains = [
        'http://chicago-apex-dental.com',
        'http://austinapexrepair.com',
        'http://metro-barber-chicago.net',
        'https://modern-health-chicago.org'
      ];

      for (const domain of candidateDomains) {
        const enriched = await websiteCrawler.auditAndEnrichDomain(domain);
        if (enriched.qualifiedOutdated) {
          domainResults.push({
            id: `lead-outdated-${Date.now()}-${domainResults.length}`,
            org_id: orgId,
            name: `${domain.replace(/^https?:\/\//, '').split('.')[0].toUpperCase()} Clinic`,
            company_name: `${domain.replace(/^https?:\/\//, '').split('.')[0].toUpperCase()} Clinic`,
            opportunityType: 'Outdated Website UI',
            category: filters.category || 'Healthcare & Services',
            location: `${filters.city || 'Chicago, IL'}, ${filters.country || 'US'}`,
            website: domain,
            phone: enriched.extractedContacts.primaryPhone,
            email: enriched.extractedContacts.primaryEmail,
            emailVerificationStatus: enriched.emailVerification.status,
            source: 'Crawlee + Playwright',
            sourceUrl: domain,
            scrapedAt: new Date().toISOString(),
            scraperRunId: runId,
            pipeline_stage: 'New',
            deal_value: 0,
            assigned_to: null,
            assigned_to_name: null,
            last_activity_at: new Date().toISOString(),
            signals: enriched.audit.signals
          });
        }
      }

      run.recordsFound = candidateDomains.length;
      run.recordsSaved = domainResults.length;
      run.progress = 100;
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      run.logs.push({
        time: '04s',
        level: 'success',
        message: `Crawled ${candidateDomains.length} domains. Qualified ${domainResults.length} outdated websites.`
      });

      leadsStore.unshift(...domainResults);
    } else if (scraperId === 'tech-hiring') {
      run.logs.push({ time: '01s', level: 'info', message: 'Searching job feeds for query: ' + (filters.roleQuery || 'React') });
      const hiringResult = await techHiringScraper.discoverHiring({
        roleQuery: filters.roleQuery,
        excludeEnterprise: filters.excludeEnterprise,
        runId
      });

      const hiringLeads = (hiringResult.leads || []).map(l => ({
        ...l,
        org_id: orgId,
        pipeline_stage: l.pipeline_stage || 'New',
        deal_value: l.deal_value || 0,
        assigned_to: l.assigned_to || null,
        assigned_to_name: l.assigned_to_name || null,
        last_activity_at: new Date().toISOString()
      }));

      run.recordsFound = hiringResult.leads.length + hiringResult.filteredEnterpriseCount;
      run.recordsSaved = hiringLeads.length;
      run.progress = 100;
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      run.logs.push({
        time: '02s',
        level: 'success',
        message: `Extracted ${hiringLeads.length} tech hiring leads (${hiringResult.filteredEnterpriseCount} enterprise MNCs excluded).`
      });

      leadsStore.unshift(...hiringLeads);
    } else if (scraperId === 'freelance-req') {
      run.logs.push({ time: '01s', level: 'info', message: 'Scanning public RFP feeds for category: ' + (filters.category || 'UI/UX') });
      const rfpResult = await freelancerScraper.discoverRequirements({
        category: filters.category,
        minBudget: filters.minBudget,
        runId
      });

      const rfpLeads = (rfpResult.leads || []).map(l => ({
        ...l,
        org_id: orgId,
        pipeline_stage: l.pipeline_stage || 'New',
        deal_value: l.deal_value || 0,
        assigned_to: l.assigned_to || null,
        assigned_to_name: l.assigned_to_name || null,
        last_activity_at: new Date().toISOString()
      }));

      run.recordsFound = rfpResult.leads.length + rfpResult.filteredBelowBudgetCount;
      run.recordsSaved = rfpLeads.length;
      run.progress = 100;
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      run.logs.push({
        time: '02s',
        level: 'success',
        message: `Discovered ${rfpResult.leads.length} qualified RFPs (${rfpResult.filteredBelowBudgetCount} filtered below budget).`
      });

      leadsStore.unshift(...rfpResult.leads);
    }
  } catch (err) {
    run.status = 'failed';
    run.errors = 1;
    run.logs.push({ time: 'Error', level: 'error', message: err.message });
  }
}

import pg from 'pg';

const { Client } = pg;

async function startServer() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && process.env.NODE_ENV !== 'test') {
    console.log('[DB] Connection failed\nError: DATABASE_URL environment variable is missing');
    process.exit(1);
  }

  if (dbUrl) {
    console.log('[DB] Connecting to PostgreSQL...');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log('[DB] Connected successfully');
      await client.query('SELECT 1');
      await client.end();
    } catch (err) {
      if (process.env.NODE_ENV === 'test') {
        console.warn('[DB] PostgreSQL connection notice in test mode:', err.message);
      } else {
        console.log('[DB] Connection failed');
        console.log(`[DB] ${err.stack || err.message || err}`);
        process.exit(1);
      }
    }
  }

  // API starts after DB check
  server.listen(PORT, () => {
    console.log(`[API Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
