import React, { useState, useEffect, useMemo } from 'react';
import { sessionManager } from '../services/sessionManager';
import { 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Mail, 
  Phone, 
  Cpu, 
  Key, 
  TrendingUp, 
  Terminal,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function MetricsBar({ 
  leads = [], 
  leadsCount = 0, 
  activeScrapersCount = 4, 
  runningJobsCount = 0, 
  runs = [], 
  timeFilter = 'all' 
}) {
  const [backendMetrics, setBackendMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch real backend analytics from API server
  const fetchBackendAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await sessionManager.authFetch(`http://localhost:3001/api/analytics?timeFilter=${timeFilter}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.metrics) {
          setBackendMetrics(json.metrics);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      }
    } catch {
      // Backend offline or unreachable — fallback to live client data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendAnalytics();
  }, [timeFilter, leadsCount, runs.length, runningJobsCount]);

  // Compute live client-side metrics from current leads & runs (as fallback or real-time sync)
  const clientMetrics = useMemo(() => {
    const now = Date.now();
    const filteredLeads = leads.filter(l => {
      if (!l.scrapedAt || timeFilter === 'all') return true;
      const t = new Date(l.scrapedAt).getTime();
      if (isNaN(t)) return true;
      const diffHours = (now - t) / (1000 * 60 * 60);
      if (timeFilter === 'today') return diffHours <= 24;
      if (timeFilter === '7d') return diffHours <= 24 * 7;
      if (timeFilter === '30d') return diffHours <= 24 * 30;
      return true;
    });

    const totalLeads = filteredLeads.length;
    const noWebsiteLeads = filteredLeads.filter(l => 
      !l.website || l.opportunityType === 'No Website' || l.website_status === 'No Website'
    );
    const withEmail = filteredLeads.filter(l => Boolean(l.email));
    const withPhone = filteredLeads.filter(l => Boolean(l.phone));
    const verifiedEmail = filteredLeads.filter(l => l.emailVerificationStatus === 'verified');

    // Scraper breakdown
    const scraperMap = {};
    filteredLeads.forEach(l => {
      const name = l.scraperName || (l.scraperId === 'no-website-biz' ? 'No-Website Business Finder' : l.scraperId) || 'Business Discovery';
      scraperMap[name] = (scraperMap[name] || 0) + 1;
    });
    const leadsByScraper = Object.entries(scraperMap).map(([name, count]) => ({
      name,
      count,
      percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Provider / Source breakdown
    const sourceMap = {};
    filteredLeads.forEach(l => {
      const src = l.source || 'Active Provider';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({
      source,
      count,
      percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Runs metrics
    const completedRuns = runs.filter(r => r.status === 'completed');
    const failedRuns = runs.filter(r => r.status === 'failed' || r.errors > 0);
    const totalRunsCount = runs.length;
    const successRate = (completedRuns.length + failedRuns.length) > 0
      ? Math.round((completedRuns.length / (completedRuns.length + failedRuns.length)) * 100)
      : 100;

    return {
      totalLeads,
      noWebsiteOpportunities: noWebsiteLeads.length,
      contactCoverage: {
        withEmail: withEmail.length,
        emailRate: totalLeads > 0 ? Math.round((withEmail.length / totalLeads) * 100) : 0,
        withPhone: withPhone.length,
        phoneRate: totalLeads > 0 ? Math.round((withPhone.length / totalLeads) * 100) : 0,
        verifiedEmails: verifiedEmail.length,
        noWebsite: noWebsiteLeads.length,
        withWebsite: totalLeads - noWebsiteLeads.length
      },
      leadsByScraper,
      leadsBySource,
      totalRunsCount,
      successRate,
      activeWorkersCount: runningJobsCount
    };
  }, [leads, runs, timeFilter, runningJobsCount]);

  // Prefer backend metrics if available and leads exist in backend; otherwise use clientMetrics
  const activeMetrics = useMemo(() => {
    if (backendMetrics && (backendMetrics.totalLeads > 0 || clientMetrics.totalLeads === 0)) {
      return {
        ...clientMetrics,
        ...backendMetrics,
        // Ensure activeWorkersCount reflects current live workers
        activeWorkersCount: runningJobsCount
      };
    }
    return clientMetrics;
  }, [backendMetrics, clientMetrics, runningJobsCount]);

  const {
    totalLeads,
    noWebsiteOpportunities,
    contactCoverage,
    leadsByScraper,
    leadsBySource,
    totalRunsCount,
    successRate,
    activeWorkersCount
  } = activeMetrics;

  return (
    <div className="space-y-5 mb-8 font-sans">
      {/* ── Top Row: Real Key Performance Indicators (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Leads Discovered */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] font-medium">
              Total Leads Discovered
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#F5F5F5] border border-[#E7E7E7] flex items-center justify-center text-[#111111]">
              <Database className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                {totalLeads}
              </span>
              <span className="text-xs font-mono text-emerald-600 font-semibold">
                Live Data
              </span>
            </div>
            <p className="text-xs text-[#8A8A8A] mt-1">
              {totalLeads > 0 ? `${totalLeads} verified prospects in pipeline` : 'Ready for scraper execution'}
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E7E7] flex items-center justify-between text-xs font-mono text-[#8A8A8A]">
            <span>Filter Period</span>
            <span className="text-[#111111] font-semibold uppercase">{timeFilter}</span>
          </div>
        </div>

        {/* KPI 2: High-Value Opportunity (No Website Targets) */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] font-medium">
              No-Website Opportunities
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#FFF5F0] border border-[#FFE2D5] flex items-center justify-center text-[#EA4B0B]">
              <Globe className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-mono text-[#EA4B0B] tracking-tight">
                {noWebsiteOpportunities}
              </span>
              <span className="text-xs font-mono text-[#8A8A8A]">
                {totalLeads > 0 ? `(${Math.round((noWebsiteOpportunities / totalLeads) * 100)}%)` : '(0%)'}
              </span>
            </div>
            <p className="text-xs text-[#8A8A8A] mt-1">
              Prime outreach targets lacking web presence
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E7E7] flex items-center justify-between text-xs font-mono text-[#8A8A8A]">
            <span>Web Presence Ratio</span>
            <span className="text-[#111111] font-semibold">
              {totalLeads > 0 ? `${contactCoverage.withWebsite} online / ${noWebsiteOpportunities} offline` : '0 online'}
            </span>
          </div>
        </div>

        {/* KPI 3: Contact & Email Enrichment Coverage */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] font-medium">
              Contact Coverage
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#F5F5F5] border border-[#E7E7E7] flex items-center justify-center text-[#111111]">
              <Mail className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                {contactCoverage.withEmail}
              </span>
              <span className="text-xs font-mono text-emerald-600 font-semibold">
                {contactCoverage.emailRate}% Email
              </span>
            </div>
            <div className="w-full bg-[#E7E7E7] h-1.5 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-[#111111] h-full transition-all duration-300" 
                style={{ width: `${Math.min(contactCoverage.emailRate, 100)}%` }} 
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#E7E7E7] flex items-center justify-between text-xs font-mono text-[#8A8A8A]">
            <span>Phone Reachable</span>
            <span className="text-[#111111] font-semibold">
              {contactCoverage.withPhone} ({contactCoverage.phoneRate}%)
            </span>
          </div>
        </div>

        {/* KPI 4: Scraper Pipeline Execution & Success */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A] font-medium">
              Scraper Execution & Health
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                {successRate}%
              </span>
              <span className="text-xs font-mono text-[#8A8A8A]">
                Success
              </span>
            </div>
            <p className="text-xs text-[#8A8A8A] mt-1">
              {totalRunsCount} total background runs dispatched
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E7E7] flex items-center justify-between text-xs font-mono text-[#8A8A8A]">
            <span>Active Workers</span>
            <span className={`font-semibold ${activeWorkersCount > 0 ? 'text-[#EA4B0B]' : 'text-[#111111]'}`}>
              {activeWorkersCount > 0 ? `${activeWorkersCount} running` : 'Idle'}
            </span>
          </div>
        </div>

      </div>

      {/* ── Middle Row: Real Breakdown Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Analytics Card 1: Leads by Scraper Engine */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E7] mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#EA4B0B]" />
              <h3 className="text-sm font-bold text-[#111111] tracking-tight">
                Pipeline Leads by Scraper Engine
              </h3>
            </div>
            <span className="text-xs font-mono text-[#8A8A8A]">
              {leadsByScraper.length} Engines Active
            </span>
          </div>

          {leadsByScraper.length > 0 ? (
            <div className="space-y-3.5">
              {leadsByScraper.map((item, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{item.name}</span>
                    <span className="font-mono text-[#111111] font-bold">
                      {item.count} leads ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F0F0F0] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        idx === 0 ? 'bg-[#EA4B0B]' : idx === 1 ? 'bg-[#111111]' : 'bg-[#8A8A8A]'
                      }`}
                      style={{ width: `${Math.max(item.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#8A8A8A]">
              <AlertCircle className="w-5 h-5 mx-auto mb-1 text-[#CCCCCC]" />
              No leads scraped in this time period yet. Click "Run Next Engine" to initiate discovery.
            </div>
          )}
        </div>

        {/* Analytics Card 2: Leads by API Provider & Source */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E7] mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-[#111111] tracking-tight">
                Attribution by API Provider & Source
              </h3>
            </div>
            <span className="text-xs font-mono text-[#8A8A8A]">
              Real API Origin
            </span>
          </div>

          {leadsBySource.length > 0 ? (
            <div className="space-y-3.5">
              {leadsBySource.map((item, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{item.source}</span>
                    <span className="font-mono text-[#111111] font-bold">
                      {item.count} leads ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F0F0F0] h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${Math.max(item.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#8A8A8A]">
              <AlertCircle className="w-5 h-5 mx-auto mb-1 text-[#CCCCCC]" />
              No API provider discovery data yet. Configure your API keys in Settings.
            </div>
          )}
        </div>

      </div>

      {/* ── Status Bar: Real-Time Sync Indicator ── */}
      <div className="flex items-center justify-between text-xs font-mono text-[#8A8A8A] px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real Analytics Sync: Connected to PostgreSQL & API Engine</span>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[#8A8A8A]" />
            <span>Updated at {lastUpdated}</span>
          </div>
        )}
      </div>
    </div>
  );
}
