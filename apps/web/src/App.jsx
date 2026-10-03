import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MetricsBar from './components/MetricsBar';
import ScraperCard from './components/ScraperCard';
import ScraperModal from './components/ScraperModal';
import ActiveRunMonitor from './components/ActiveRunMonitor';
import LeadsTable from './components/LeadsTable';
import LeadDetailDrawer from './components/LeadDetailDrawer';
import TasksView from './components/TasksView';
import DashboardView from './components/DashboardView';
import UserManagementView from './components/UserManagementView';
import PipelineView from './components/PipelineView';
import NotificationPopover from './components/NotificationPopover';
import LoginPage from './components/LoginPage';
import UserButton from './components/UserButton';
import { storage } from './services/storage';
import { scraperEngine } from './services/scraperEngine';
import { sessionManager } from './services/sessionManager';
import { crmService } from './services/crmService';
import { useAuth } from './context/AuthContext';
import { Menu, Play, Bell, Search } from 'lucide-react';

export default function App() {
  const { user, role, orgId, isAuthenticated, isLoaded, logout } = useAuth();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [scrapers, setScrapers] = useState([]);
  const [runs, setRuns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tasksDueTodayCount, setTasksDueTodayCount] = useState(0);
  
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalScraper, setModalScraper] = useState(null);
  const [timeFilter, setTimeFilter] = useState('7d');

  useEffect(() => {
    if (!isLoaded) return;
    setScrapers(storage.getScrapers());
    setRuns(storage.getRuns());
    setLeads(storage.getLeads());
  }, [isLoaded]);

  // Refresh tasks due today for sidebar badge
  const refreshTasksDueToday = async () => {
    try {
      const todayTasks = await crmService.getTasks({ due: 'today', mine: true, done: false });
      setTasksDueTodayCount(Array.isArray(todayTasks) ? todayTasks.length : 0);
    } catch {
      // Backend sync is best-effort
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshTasksDueToday();
    }
  }, [user, isAuthenticated]);

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

  const handleDeleteLead = async (leadId) => {
    storage.deleteLead(leadId);
    try {
      await sessionManager.authFetch(`http://localhost:3001/api/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' });
    } catch {
      // Backend sync is best-effort
    }
  };

  const handleDeleteLeads = async (leadIds) => {
    storage.deleteLeads(leadIds);
    try {
      await sessionManager.authFetch('http://localhost:3001/api/leads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: leadIds })
      });
    } catch {
      // Backend sync is best-effort
    }
  };

  // Show spinner while session loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#EA4B0B] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-[#8A8A8A] tracking-wider uppercase">Loading GrowProspect…</span>
        </div>
      </div>
    );
  }

  // If not logged in, render native JWT Login/Register page
  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex font-sans">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        leadsCount={leads.length}
        runningJobsCount={runningJobsCount}
        tasksDueTodayCount={tasksDueTodayCount}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>

        {/* Global Persistent Top Header (Desktop & Mobile) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer flex items-center gap-2"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
              <img src="/favicon.svg" alt="GrowProspect" className="w-5 h-5 object-contain" />
            </button>

            {/* Quick Search on Desktop / Tablet */}
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Quick search clients, tasks, or pipeline..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentTab('leads');
                  }
                }}
                className="pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg w-64 md:w-80 focus:w-96 focus:bg-white focus:border-orange-400 focus:outline-none transition-all placeholder:text-gray-400 text-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Enabled Notification Center */}
            <NotificationPopover 
              onNavigate={(tab) => setCurrentTab(tab)}
              onSelectLead={(lead) => setSelectedLead(lead)}
              tasksDueTodayCount={tasksDueTodayCount}
            />

            {/* Top Right Profile Avatar */}
            <div className="flex items-center pl-1">
              <UserButton />
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Render Tab Views */}
          {currentTab === 'dashboard' && (
            <DashboardView
              onSelectLead={(lead) => setSelectedLead(lead)}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'pipeline' && (
            <PipelineView
              onSelectLead={(lead) => setSelectedLead(lead)}
              currentRole={role}
              currentUserId={user?.id || user?.user_id}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView
              onSelectLead={(lead) => setSelectedLead(lead)}
              onTasksChanged={refreshTasksDueToday}
            />
          )}

          {currentTab.startsWith('leads') && (
            <div className="space-y-6">
              <LeadsTable
                title="Clients"
                leads={leads}
                initialScraper={currentTab.includes('_') ? currentTab.replace('leads_', '') : 'ALL'}
                onSelectLead={(lead) => setSelectedLead(lead)}
                onDeleteLead={handleDeleteLead}
                onDeleteLeads={handleDeleteLeads}
                onLeadsUpdated={() => setLeads(storage.getLeads())}
              />
            </div>
          )}

          {(currentTab === 'users' || currentTab === 'settings') && (
            <UserManagementView />
          )}

        </main>

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
        onDeleteLead={handleDeleteLead}
        onLeadUpdated={(updatedLead) => {
          setSelectedLead(updatedLead);
          setLeads(storage.getLeads());
          refreshTasksDueToday();
        }}
      />
    </div>
  );
}
