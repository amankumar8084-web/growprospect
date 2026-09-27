import React, { useState } from 'react';
import { 
  Compass, 
  Terminal, 
  Layers, 
  Database, 
  Settings, 
  Search, 
  Plus, 
  Bell, 
  Menu, 
  X, 
  CheckCircle2, 
  Activity 
} from 'lucide-react';

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  onNewScrapeClick, 
  leadsCount, 
  runningJobsCount 
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'scrapers', label: 'Scrapers', icon: Layers, badge: '4' },
    { id: 'runs', label: 'Runs', icon: Terminal, activeCount: runningJobsCount },
    { id: 'leads', label: 'Leads', icon: Database, badge: leadsCount ? `${leadsCount}` : null },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E7E7E7] shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-8">
            <div 
              onClick={() => setCurrentTab('dashboard')} 
              className="flex items-center gap-2 cursor-pointer group"
            >
              <img 
                src="/logo-horizontal.png" 
                alt="GrowProspect" 
                className="h-9 w-auto max-w-[170px] object-contain transition-transform group-hover:scale-[1.02]" 
              />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-all rounded-md ${
                      isActive 
                        ? 'text-[#111111] bg-[#F5F5F5] font-semibold' 
                        : 'text-[#8A8A8A] hover:text-[#111111] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#EA4B0B]' : 'text-[#8A8A8A]'}`} />
                    <span>{item.label}</span>
                    
                    {item.activeCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EA4B0B] text-white animate-pulse">
                        {item.activeCount}
                      </span>
                    )}

                    {item.badge && !item.activeCount && (
                      <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#E7E7E7] text-[#111111] font-mono">
                        {item.badge}
                      </span>
                    )}

                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#EA4B0B] rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions, Search, CTA */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input
                type="text"
                placeholder="Search leads, runs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentTab('leads');
                  }
                }}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded-md w-48 focus:w-60 focus:bg-white focus:border-[#111111] focus:outline-none transition-all placeholder:text-[#8A8A8A]"
              />
            </div>

            {/* Launch Scraper CTA */}
            <button
              onClick={onNewScrapeClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#EA4B0B] hover:bg-[#d44000] text-white text-xs font-semibold rounded-md shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Scrape</span>
            </button>

            {/* Live Status Beacon */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md text-[11px] font-mono text-[#111111]">
              <span className={`w-2 h-2 rounded-full ${runningJobsCount > 0 ? 'bg-[#EA4B0B] animate-ping' : 'bg-emerald-500'}`} />
              <span>{runningJobsCount > 0 ? 'WORKERS BUSY' : 'ENGINES READY'}</span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onNewScrapeClick}
              className="p-1.5 bg-[#EA4B0B] text-white rounded-md text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#111111] hover:bg-[#F5F5F5] rounded-md"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer (Temporary - No Sidebar Rule Kept) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E7E7E7] bg-white px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md ${
                  isActive ? 'bg-[#F5F5F5] text-[#111111] font-semibold' : 'text-[#8A8A8A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#EA4B0B]' : 'text-[#8A8A8A]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#E7E7E7] font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
