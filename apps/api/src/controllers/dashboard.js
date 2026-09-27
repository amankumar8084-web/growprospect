import { pool } from '../db/index.js';

export async function getDashboardAnalytics({ timeFilter = 'all', inMemoryLeads = [], activeRuns = new Map() } = {}) {
  let dbLeads = [];
  let dbSuccess = false;

  try {
    const client = await pool.connect();
    try {
      let timeClause = '';
      if (timeFilter === 'today') {
        timeClause = `WHERE created_at >= NOW() - INTERVAL '24 hours'`;
      } else if (timeFilter === '7d') {
        timeClause = `WHERE created_at >= NOW() - INTERVAL '7 days'`;
      } else if (timeFilter === '30d') {
        timeClause = `WHERE created_at >= NOW() - INTERVAL '30 days'`;
      }

      const res = await client.query(`SELECT * FROM leads ${timeClause} ORDER BY created_at DESC LIMIT 1000`);
      dbLeads = res.rows.map(r => ({
        id: r.id,
        name: r.company_name || r.name || 'Unnamed Business',
        source: r.source,
        scraperId: r.source === 'Google Maps' ? 'no-website-biz' : (r.lead_type || 'no-website-biz'),
        scraperName: r.source,
        category: r.category || r.industry || 'General Services',
        location: r.city ? `${r.city}${r.state ? ', ' + r.state : ''}` : (r.address || 'Unknown'),
        email: r.email,
        phone: r.phone,
        website: r.website,
        emailVerificationStatus: r.email ? 'verified' : 'not_applicable',
        website_status: r.website_status || (r.website ? 'Website Exists' : 'No Website'),
        scrapedAt: r.created_at,
        lead_status: r.lead_status || 'new'
      }));
      dbSuccess = true;
    } finally {
      client.release();
    }
  } catch (err) {
    // If DB has error, fallback gracefully
    console.warn('[Analytics] DB query warning, falling back to active memory store:', err.message);
  }

  // Combine DB leads with inMemory leads (deduplicated by id or name)
  const combinedMap = new Map();
  dbLeads.forEach(l => combinedMap.set(l.id || l.name, l));
  inMemoryLeads.forEach(l => combinedMap.set(l.id || l.name, l));
  const allLeads = Array.from(combinedMap.values());

  // Filter allLeads by timeFilter if scrapedAt exists
  const now = Date.now();
  const filteredLeads = allLeads.filter(lead => {
    if (!lead.scrapedAt || timeFilter === 'all') return true;
    const leadTime = new Date(lead.scrapedAt).getTime();
    if (isNaN(leadTime)) return true;
    const diffHours = (now - leadTime) / (1000 * 60 * 60);
    if (timeFilter === 'today') return diffHours <= 24;
    if (timeFilter === '7d') return diffHours <= 24 * 7;
    if (timeFilter === '30d') return diffHours <= 24 * 30;
    return true;
  });

  // 1. Total Leads
  const totalLeads = filteredLeads.length;

  // 2. Breakdown by Scraper Engine
  const scraperCounts = {};
  filteredLeads.forEach(l => {
    const sName = l.scraperName || l.scraperId || 'No-Website Business Finder';
    scraperCounts[sName] = (scraperCounts[sName] || 0) + 1;
  });
  const leadsByScraper = Object.entries(scraperCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // 3. Breakdown by API Provider / Source
  const sourceCounts = {};
  filteredLeads.forEach(l => {
    const src = l.source || 'Other Source';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const leadsBySource = Object.entries(sourceCounts)
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // 4. Contact & Enrichment Metrics
  const withEmailCount = filteredLeads.filter(l => Boolean(l.email)).length;
  const withPhoneCount = filteredLeads.filter(l => Boolean(l.phone)).length;
  const verifiedEmailCount = filteredLeads.filter(l => l.emailVerificationStatus === 'verified').length;
  const noWebsiteCount = filteredLeads.filter(l => !l.website || l.website_status === 'No Website' || l.opportunityType === 'No Website').length;
  const withWebsiteCount = filteredLeads.filter(l => Boolean(l.website)).length;

  // 5. Scraper Runs Metrics
  const runsArray = Array.from(activeRuns.values());
  const completedRuns = runsArray.filter(r => r.status === 'completed');
  const failedRuns = runsArray.filter(r => r.status === 'failed' || r.errors > 0);
  const activeWorkersCount = runsArray.filter(r => r.status === 'running').length;
  const totalRunsCount = runsArray.length;
  const successRate = (completedRuns.length + failedRuns.length) > 0
    ? Math.round((completedRuns.length / (completedRuns.length + failedRuns.length)) * 100)
    : 100;

  return {
    success: true,
    timeFilter,
    timestamp: new Date().toISOString(),
    metrics: {
      totalLeads,
      activeScrapers: 4,
      activeWorkersCount,
      totalRunsCount,
      successRate,
      noWebsiteOpportunities: noWebsiteCount,
      contactCoverage: {
        withEmail: withEmailCount,
        emailRate: totalLeads > 0 ? Math.round((withEmailCount / totalLeads) * 100) : 0,
        withPhone: withPhoneCount,
        phoneRate: totalLeads > 0 ? Math.round((withPhoneCount / totalLeads) * 100) : 0,
        verifiedEmails: verifiedEmailCount,
        noWebsite: noWebsiteCount,
        withWebsite: withWebsiteCount
      },
      leadsByScraper,
      leadsBySource,
      recentRuns: runsArray.slice(0, 5).map(r => ({
        id: r.id,
        scraperName: r.scraperName,
        status: r.status,
        recordsSaved: r.recordsSaved || 0,
        startedAt: r.startedAt,
        completedAt: r.completedAt
      }))
    }
  };
}
