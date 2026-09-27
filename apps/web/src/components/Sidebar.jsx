import React from 'react';
import { 
  Compass, 
  Layers, 
  Terminal, 
  Database, 
  Settings, 
  Plus, 
  Upload,
  Zap, 
  X, 
  ShieldCheck, 
  ChevronRight,
  User,
  Radio
} from 'lucide-react';

import { UserButton } from '@clerk/clerk-react';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  onNewScrapeClick, 
  leadsCount, 
  runningJobsCount,
  mobileOpen,
  setMobileOpen
}) {
  const scrapersList = [
    { id: 'no-website-biz', label: 'No-Website Business Finder' },
    { id: 'outdated-website-biz', label: 'Outdated-Website Business Finder' },
    { id: 'tech-hiring', label: 'Tech Hiring Finder' },
    { id: 'freelance-req', label: 'Freelancer Requirement Finder' }
  ];

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'scrapers', label: 'Scrapers', icon: Layers, badge: '4' },
    { id: 'runs', label: 'Runs', icon: Terminal, activeCount: runningJobsCount },
    { id: 'leads', label: 'Leads', icon: Database, badge: leadsCount ? `${leadsCount}` : null, subItems: scrapersList.map(s => ({ id: `leads_${s.id}`, label: s.label })) },
    { id: 'import', label: 'Import Leads', icon: Upload },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tabId) => {
    setCurrentTab(tabId);
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Vertical Sidebar */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#E7E7E7] flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Brand Header */}
        <div>
          <div className="h-16 px-5 border-b border-[#E7E7E7] flex items-center justify-between">
            <div 
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2 cursor-pointer group select-none"
            >
              <img 
                src="/logo-horizontal.png" 
                alt="GrowProspect" 
                className="h-9 w-auto max-w-[175px] object-contain transition-transform duration-150 group-hover:scale-[1.02]" 
              />
            </div>

            {/* Close button on mobile */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 text-[#8A8A8A] hover:text-[#111111]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1" aria-label="Sidebar Navigation">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Platform Navigation
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id || currentTab.startsWith(`${item.id}_`);
              const isExpanded = isActive;

              return (
                <div key={item.id} className="space-y-0.5">
                  <button
                    onClick={() => handleNavClick(item.subItems ? `${item.id}_${scrapersList[0].id}` : item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-[#111111] text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-[#F5F5F5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-[#EA4B0B]' : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.activeCount > 0 && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EA4B0B] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {item.activeCount}
                      </span>
                    )}

                    {item.badge && !item.activeCount && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isActive ? 'bg-[#EA4B0B] text-white font-semibold' : 'bg-[#F5F5F5] text-gray-700 border border-[#E7E7E7]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {item.subItems && isExpanded && (
                    <div className="pl-9 pr-2 space-y-0.5 pb-1">
                      {item.subItems.map((sub) => {
                        const isSubActive = currentTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleNavClick(sub.id)}
                            className={`w-full flex items-center px-2 py-1.5 text-[11px] font-medium rounded transition-colors text-left ${
                              isSubActive
                                ? 'text-[#EA4B0B] bg-[#EA4B0B]/10 font-bold'
                                : 'text-[#8A8A8A] hover:text-[#111111] hover:bg-[#F5F5F5]'
                            }`}
                          >
                            <span className="truncate flex-1">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-[#E7E7E7] bg-white">
          <UserButton
            showName
            appearance={{
              elements: {
                rootBox: 'w-full',
                userButtonBox: 'w-full flex-row-reverse justify-between items-center py-1 px-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors',
                userButtonOuterIdentifier: 'text-xs font-semibold text-[#111111] truncate max-w-[130px]',
                userButtonAvatarBox: 'w-7 h-7 rounded-full',
                userButtonTrigger: 'w-full justify-between focus:shadow-none focus:outline-none focus:ring-0',
                userButtonPopoverCard: 'shadow-xl border border-[#E7E7E7] rounded-xl max-w-[240px] w-[240px] text-xs overflow-hidden',
                userButtonPopoverFooter: 'hidden',
                userButtonPopoverMain: 'p-2 space-y-1',
                userProfileIdentification: 'p-2.5 gap-2.5 border-b border-[#F0F0F0]',
                userProfileIdentifier: 'text-xs font-bold text-[#111111]',
                userProfileSecondaryIdentifier: 'text-[11px] text-[#8A8A8A] truncate max-w-[160px]',
                userButtonPopoverActions: 'p-1.5 space-y-0.5',
                userButtonPopoverActionButton: 'py-2 px-2.5 rounded-lg hover:bg-[#F5F5F5] text-xs font-medium text-[#111111] transition-colors',
                userButtonPopoverActionButtonIcon: 'w-4 h-4 text-[#8A8A8A]',
                userButtonPopoverActionButtonText: 'text-xs text-[#111111]',
              },
            }}
          />
        </div>

      </aside>
    </>
  );
}
