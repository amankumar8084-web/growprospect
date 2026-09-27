import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MetricsBar from './components/MetricsBar';
import ScraperCard from './components/ScraperCard';
import ScraperModal from './components/ScraperModal';
import ActiveRunMonitor from './components/ActiveRunMonitor';
import LeadsTable from './components/LeadsTable';
import LeadDetailDrawer from './components/LeadDetailDrawer';
import RunsView from './components/RunsView';
import ScrapersView from './components/ScrapersView';
import SettingsView from './components/SettingsView';
import ImportPage from './pages/ImportPage';
import { storage } from './services/storage';
import { scraperEngine } from './services/scraperEngine';
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { Menu, Plus, Play } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [scrapers, setScrapers] = useState(storage.getScrapers());
  const [runs, setRuns] = useState(storage.getRuns());
  const [leads, setLeads] = useState(storage.getLeads());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalScraper, setModalScraper] = useState(null);
  const [timeFilter, setTimeFilter] = useState('7d');

  useEffect(() => {
    const unsubStorage = storage.subscribe(() => {
      setScrapers(storage.getScrapers());
      setRuns(storage.getRuns());
      setLeads(storage.getLeads());
    });
    return () => {
      unsubStorage();
    };
  }, []);

  // Determine currently active running job
  const activeRun = runs.find((r) => r.status === 'running') || null;
  const runningJobsCount = runs.filter((r) => r.status === 'running').length;

  // Handlers for scraper lifecycle
  const handleLaunchModal = (scraper) => {
    setModalScraper(scraper);
  };

  const handleLaunchDirect = async (scraperId, customFilters = {}) => {
    try {
      const run = await scraperEngine.startRun(scraperId, customFilters);
      if (currentTab !== 'dashboard' && currentTab !== 'runs') {
        setCurrentTab('dashboard');
      }
    } catch (err) {
      alert(`Error starting scraper: ${err.message}`);
    }
  };

  const handlePauseRun = (runId) => {
    scraperEngine.pauseRun(runId);
  };

  const handleStopRun = (runId) => {
    scraperEngine.stopRun(runId);
  };

  const handleTriggerAll = async () => {
    for (const scraper of scrapers) {
      if (scraper.status !== 'running') {
        await scraperEngine.startRun(scraper.id);
        break;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex font-sans">
      <SignedOut>
        <div className="flex flex-col w-full items-center justify-center min-h-screen bg-gray-50 p-4">
          <div className="mb-6 flex flex-col items-center">
            <img src="/logo.png" alt="GrowProspect" className="h-20 w-auto object-contain" />
          </div>
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                socialButtonsRoot: { display: 'none' },
                socialButtonsBlockButton: { display: 'none' },
                dividerRow: { display: 'none' },
                footerAction: { display: 'none' },
              },
            }}
          />
        </div>
      </SignedOut>

      <SignedIn>
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        leadsCount={leads.length}
        runningJobsCount={runningJobsCount}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 text-gray-900 hover:bg-gray-100 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img src="/logo-horizontal.png" alt="GrowProspect" className="h-7 w-auto object-contain" />
          </div>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Render Tab Views */}
          {currentTab === 'dashboard' && (
            <div>
              {/* Page Editorial Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-6 border-b border-gray-200">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Dashboard
                  </h1>
                  <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                    Overview of your lead discovery engines and pipeline.
                  </p>
                </div>

                {/* Time filter tags & Trigger action */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center bg-[#F5F5F5] border border-[#E7E7E7] rounded-md p-0.5 text-xs font-mono">
                    {['today', '7d', '30d', 'all'].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeFilter(tf)}
                        className={`px-2.5 py-1 rounded capitalize transition-all ${
                          timeFilter === tf
                            ? 'bg-white text-[#111111] font-semibold shadow-2xs'
                            : 'text-[#8A8A8A] hover:text-[#111111]'
                        }`}
                      >
                        {tf === 'today' ? 'Today' : tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : 'All Time'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleTriggerAll}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-sm font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run Next Engine</span>
                  </button>
                </div>
              </div>

              {/* Asymmetric Metrics Bar */}
              <MetricsBar
                leadsCount={leads.length}
                activeScrapersCount={scrapers.length}
                runningJobsCount={runningJobsCount}
                runs={runs}
              />

              {/* Active Run Diagnostic Panel (Progress & Live Event Stream) */}
              <ActiveRunMonitor
                activeRun={activeRun}
                onPause={handlePauseRun}
                onStop={handleStopRun}
                onViewAllRuns={() => setCurrentTab('runs')}
              />

              {/* Recent Leads Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold tracking-tight text-gray-900">
                    Recent Discovered Leads
                  </h2>
                  <button
                    onClick={() => setCurrentTab('leads')}
                    className="text-sm font-semibold text-[#111111] hover:text-[#EA4B0B] transition-colors"
                  >
                    View All Leads →
                  </button>
                </div>
                <LeadsTable
                  title="Aggregated Leads"
                  description="Most recent leads discovered across all engines."
                  leads={leads.slice(0, 10)}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                />
              </div>
            </div>
          )}

          {currentTab === 'scrapers' && (
            <ScrapersView
              scrapers={scrapers}
              onConfigure={handleLaunchModal}
              onLaunchDirect={handleLaunchDirect}
            />
          )}

          {currentTab === 'runs' && (
            <RunsView
              runs={runs}
              onPauseRun={handlePauseRun}
              onStopRun={handleStopRun}
              onRerun={handleLaunchDirect}
            />
          )}

          {currentTab.startsWith('leads') && (
            <div className="space-y-8">
              {scrapers
                .filter(s => !currentTab.includes('_') || currentTab === `leads_${s.id}`)
                .map((scraper) => (
                <LeadsTable
                  key={scraper.id}
                  title={`${scraper.name} Leads`}
                  description={`Discovered prospects from the ${scraper.name} engine.`}
                  leads={leads.filter((l) => l.scraperId === scraper.id || (!l.scraperId && scraper.id === 'no-website-biz'))}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                />
              ))}
            </div>
          )}

          {currentTab === 'import' && (
            <ImportPage />
          )}

          {currentTab === 'settings' && (
            <SettingsView />
          )}

        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">ScrapeCore</span>
              <span>•</span>
              <span>Lead Discovery Platform</span>
            </div>
          </div>
        </footer>

      </div>

      <ScraperModal
        isOpen={Boolean(modalScraper)}
        onClose={() => setModalScraper(null)}
        scraper={modalScraper}
        onLaunch={handleLaunchDirect}
      />

      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
      </SignedIn>
    </div>
  );
}
