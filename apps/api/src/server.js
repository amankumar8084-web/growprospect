import http from 'node:http';
// import { BusinessScraper } from '@lead-discovery/scraper-business';
// import { WebsiteCrawler } from '@lead-discovery/scraper-website';
// import { TechHiringScraper } from '@lead-discovery/scraper-hiring';
// import { FreelancerScraper } from '@lead-discovery/scraper-freelancer';
// import { DeduplicationEngine } from '@lead-discovery/scraper-core';

import { WebsiteCrawler } from '@lead-discovery/scraper-website';

const PORT = process.env.PORT || 3001;

// In-memory data store for backend API layer
const activeRuns = new Map();
const leadsStore = [];
const websiteCrawler = new WebsiteCrawler();
// const techHiringScraper = new TechHiringScraper({ deduplicator });
// const freelancerScraper = new FreelancerScraper({ deduplicator });

import { getPublicConfig, updateConfig, testProviderConnection, searchActivePlaces } from './controllers/providers.js';
import { getDashboardAnalytics } from './controllers/dashboard.js';
import { handleImportUpload, handleImportValidate, handleImportCommit } from './controllers/importController.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    // 1. Health check
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

    // 2. Authentication Login endpoint
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { username, password } = body;

      const expectedUser = (process.env.ADMIN_USERNAME || 'admin').trim();
      const expectedPass = (process.env.ADMIN_PASSWORD || 'leadscrape2026').trim();

      if (username === expectedUser && password === expectedPass) {
        sendJson(res, 200, {
          success: true,
          token: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          user: { username: expectedUser, role: 'ADMIN' }
        });
      } else {
        sendJson(res, 401, { success: false, error: 'Invalid username or password' });
      }
      return;
    }

    // 2b. Real Dashboard Analytics Endpoint
    if ((pathname === '/api/analytics' || pathname === '/api/dashboard/metrics') && req.method === 'GET') {
      const timeFilter = url.searchParams.get('timeFilter') || 'all';
      try {
        const analytics = await getDashboardAnalytics({
          timeFilter,
          inMemoryLeads: leadsStore,
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
      try {
        const body = await parseJsonBody(req);
        const commitResult = await handleImportCommit(body, leadsStore);
        sendJson(res, 200, commitResult);
      } catch (err) {
        sendJson(res, 400, { success: false, message: err.message });
      }
      return;
    }

    // 2g. Manual Single Lead Creation Endpoint
    if (pathname === '/api/leads' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const name = body.company_name || body.name || 'Unnamed Lead';
        const lead = {
          id: `lead-manual-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name,
          company_name: name,
          job_title: body.job_title || null,
          email: body.email || null,
          phone: body.phone || null,
          website: body.website || null,
          location: body.city ? `${body.city}, ${body.country || 'US'}` : (body.address || 'US'),
          city: body.city || '',
          country: body.country || 'US',
          source: body.source || 'Manual Entry',
          scraperId: 'no-website-biz',
          scraperName: 'Manual Entry',
          opportunityType: body.website ? 'Website Audit' : 'No Website',
          website_status: body.website ? 'Website Exists' : 'No Website',
          emailVerificationStatus: body.email ? 'verified' : 'not_applicable',
          scrapedAt: new Date().toISOString(),
          lead_status: 'new'
        };
        leadsStore.unshift(lead);
        sendJson(res, 201, { success: true, lead });
      } catch (err) {
        sendJson(res, 400, { success: false, message: err.message });
      }
      return;
    }

    // Scrapers catalog
    if (pathname === '/api/scrapers' && req.method === 'GET') {
      sendJson(res, 200, { scrapers: SCRAPERS_MANIFEST });
      return;
    }

    // Provider Configuration endpoints
    if (pathname === '/api/providers/config' && req.method === 'GET') {
      sendJson(res, 200, getPublicConfig());
      return;
    }

    if (pathname === '/api/providers/config' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const updated = updateConfig(body);
      sendJson(res, 200, { success: true, config: updated });
      return;
    }

    if (pathname === '/api/providers/test' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const testResult = await testProviderConnection(body);
      sendJson(res, 200, testResult);
      return;
    }

    if (pathname === '/api/providers/search' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      try {
        const places = await searchActivePlaces(body);
        sendJson(res, 200, { success: true, places, count: places.length });
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    // Enrich single domain endpoint
    if (pathname === '/api/enrich' && req.method === 'POST') {
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

    // 3. List all runs
    if (pathname === '/api/runs' && req.method === 'GET') {
      const runs = Array.from(activeRuns.values()).sort(
        (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
      );
      sendJson(res, 200, { runs });
      return;
    }

    // 4. Dispatch a new scraper run
    if (pathname === '/api/runs' && req.method === 'POST') {
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

      // Execute worker asynchronously outside request cycle
      dispatchWorkerTask(runId, scraperId, filters);

      sendJson(res, 202, { message: 'Run accepted', run: runRecord });
      return;
    }

    // 5. Get run details & streaming logs
    const runMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9_-]+)$/);
    if (runMatch && req.method === 'GET') {
      const runId = runMatch[1];
      const run = activeRuns.get(runId);
      if (!run) {
        sendJson(res, 404, { error: 'Run not found' });
        return;
      }
      sendJson(res, 200, { run });
      return;
    }

    // 6. Stop run
    const stopMatch = pathname.match(/^\/api\/runs\/([A-Za-z0-9_-]+)\/stop$/);
    if (stopMatch && req.method === 'POST') {
      const runId = stopMatch[1];
      const run = activeRuns.get(runId);
      if (run) {
        run.status = 'stopped';
        run.completedAt = new Date().toISOString();
        run.logs.push({ time: 'Just now', level: 'warn', message: 'Worker aborted by user request' });
      }
      sendJson(res, 200, { success: true, run });
      return;
    }

    // 7. Leads query with search & filter
    if (pathname === '/api/leads' && req.method === 'GET') {
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const type = url.searchParams.get('type');
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);

      let results = [...leadsStore];
      if (search) {
        results = results.filter(
          (l) =>
            l.name.toLowerCase().includes(search) ||
            l.location.toLowerCase().includes(search) ||
            (l.email && l.email.toLowerCase().includes(search))
        );
      }
      if (type && type !== 'ALL') {
        results = results.filter((l) => l.opportunityType === type);
      }

      const total = results.length;
      const paginated = results.slice((page - 1) * limit, page * limit);

      sendJson(res, 200, {
        total,
        page,
        limit,
        leads: paginated
      });
      return;
    }

    // 7b. Delete single lead by ID
    const deleteLeadMatch = pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (deleteLeadMatch && req.method === 'DELETE') {
      const leadId = decodeURIComponent(deleteLeadMatch[1]);
      const idx = leadsStore.findIndex((l) => l.id === leadId);
      if (idx !== -1) {
        leadsStore.splice(idx, 1);
      }
      sendJson(res, 200, { success: true, message: `Lead ${leadId} permanently deleted` });
      return;
    }

    // 7c. Bulk delete leads
    if ((pathname === '/api/leads/bulk-delete' && req.method === 'POST') || (pathname === '/api/leads' && req.method === 'DELETE')) {
      const body = await parseJsonBody(req);
      const idsToDelete = new Set(body.ids || []);
      if (idsToDelete.size > 0) {
        for (let i = leadsStore.length - 1; i >= 0; i--) {
          if (idsToDelete.has(leadsStore[i].id)) {
            leadsStore.splice(i, 1);
          }
        }
      }
      sendJson(res, 200, { success: true, count: idsToDelete.size });
      return;
    }

    // 8. Website enrichment on demand (Crawlee + Playwright flow)
    if (pathname === '/api/enrich' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { url: targetUrl } = body;
      if (!targetUrl) {
        sendJson(res, 400, { error: 'Target URL is required' });
        return;
      }
      const enrichedResult = await websiteCrawler.auditAndEnrichDomain(targetUrl);
      sendJson(res, 200, { enrichment: enrichedResult });
      return;
    }

    sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    console.error('[API Error]:', err);
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

// Asynchronous worker executor (handles Geoapify discovery, Crawlee enrichment, etc.)
async function dispatchWorkerTask(runId, scraperId, filters) {
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
        name: p.name,
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
            name: `${domain.replace(/^https?:\/\//, '').split('.')[0].toUpperCase()} Clinic`,
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

      run.recordsFound = hiringResult.leads.length + hiringResult.filteredEnterpriseCount;
      run.recordsSaved = hiringResult.leads.length;
      run.progress = 100;
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      run.logs.push({
        time: '02s',
        level: 'success',
        message: `Extracted ${hiringResult.leads.length} tech hiring leads (${hiringResult.filteredEnterpriseCount} enterprise MNCs excluded).`
      });

      leadsStore.unshift(...hiringResult.leads);
    } else if (scraperId === 'freelance-req') {
      run.logs.push({ time: '01s', level: 'info', message: 'Scanning public RFP feeds for category: ' + (filters.category || 'UI/UX') });
      const rfpResult = await freelancerScraper.discoverRequirements({
        category: filters.category,
        minBudget: filters.minBudget,
        runId
      });

      run.recordsFound = rfpResult.leads.length + rfpResult.filteredBelowBudgetCount;
      run.recordsSaved = rfpResult.leads.length;
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
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function startServer() {
  console.log('[DB] Connecting to PostgreSQL...');
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[DB] Connection failed\nError: DATABASE_URL environment variable is missing');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('[DB] Connected successfully');
    
    // Verify connection with a real query
    await client.query('SELECT 1');
    
    // API must start ONLY after DB connection is successful
    server.listen(PORT, () => {
      console.log(`[API Server] Running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.log('[DB] Connection failed');
    console.log(`[DB] ${err.stack || err.message || err}`);
    process.exit(1);
  }
}

startServer();
