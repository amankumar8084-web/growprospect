import React from 'react';
import { 
  Compass, 
  Layers, 
  Terminal, 
  Database, 
  Settings, 
  Plus, 
  X, 
  ShieldCheck, 
  ChevronRight,
  ChevronLeft,
  User,
  Users,
  Radio,
  Columns3,
  CheckSquare,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal
} from 'lucide-react';

import { sessionManager } from '../services/sessionManager';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  onNewScrapeClick, 
  leadsCount, 
  runningJobsCount,
  tasksDueTodayCount = 0,
  mobileOpen,
  setMobileOpen,
  isCollapsed = false,
  setIsCollapsed
}) {
  const userRole = sessionManager.getRole();
  const orgId = sessionManager.getOrgId();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'leads', label: 'Clients', icon: Users, badge: leadsCount ? `${leadsCount}` : null },
    { id: 'pipeline', label: 'Pipeline', icon: Columns3, badge: '7 Stages' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, activeCount: tasksDueTodayCount, badge: tasksDueTodayCount > 0 ? `${tasksDueTodayCount} due` : null },
    { id: 'users', label: 'Users', icon: UserCheck },
  ];

  const handleNavClick = (tabId) => {
    setCurrentTab(tabId);
    if (setMobileOpen) setMobileOpen(false);
  };

  const toggleCollapse = () => {
    if (setIsCollapsed) {
      setIsCollapsed(prev => !prev);
    }
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
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-[#E7E7E7] flex flex-col justify-between transition-all duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Top: Brand Header */}
        <div>
          <div className={`h-16 border-b border-[#E7E7E7] flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
            <div 
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2 cursor-pointer group select-none overflow-hidden"
              title="GrowProspect"
            >
              {isCollapsed ? (
                <div className="w-10 h-10 rounded-xl bg-orange-50/60 border border-orange-200/60 flex items-center justify-center group-hover:scale-105 transition-transform p-1.5">
                  <img 
                    src="/favicon.svg" 
                    alt="GrowProspect" 
                    className="w-7 h-7 object-contain" 
                  />
                </div>
              ) : (
                <img 
                  src="/logo-horizontal.png" 
                  alt="GrowProspect" 
                  className="h-9 w-auto max-w-[175px] object-contain transition-transform duration-150 group-hover:scale-[1.02]" 
                />
              )}
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
          <nav className="p-2 space-y-1" aria-label="Sidebar Navigation">
            {!isCollapsed && (
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Platform Navigation
              </div>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id || 
                currentTab.startsWith(`${item.id}_`);

              return (
                <div key={item.id} className="relative group/item">
                  <button
                    onClick={() => handleNavClick(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl transition-all cursor-pointer ${
                      isCollapsed 
                        ? `justify-center p-3 ${
                            isActive 
                              ? 'bg-[#111111] text-white shadow-xs' 
                              : 'text-gray-500 hover:text-gray-900 hover:bg-[#F5F5F5]'
                          }`
                        : `justify-between px-3.5 py-2.5 text-sm font-medium ${
                            isActive
                              ? 'bg-[#111111] text-white'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-[#F5F5F5]'
                          }`
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#EA4B0B]' : 'text-gray-400'}`} />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>

                    {!isCollapsed && item.activeCount > 0 && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EA4B0B] text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {item.activeCount}
                      </span>
                    )}

                    {!isCollapsed && item.badge && !item.activeCount && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isActive ? 'bg-[#EA4B0B] text-white font-semibold' : 'bg-[#F5F5F5] text-gray-700 border border-[#E7E7E7]'
                      }`}>
                        {item.badge}
                      </span>
                    )}

                    {/* Small Dot indicator for collapsed badge */}
                    {isCollapsed && (item.activeCount > 0 || item.badge) && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EA4B0B]" />
                    )}
                  </button>

                  {/* Floating tooltip on collapsed mode hover */}
                  {isCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-gray-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity z-60 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Left Corner: Slider / Collapse Toggle Option */}
        <div className="p-2 border-t border-[#E7E7E7] bg-white">
          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`w-full flex items-center rounded-xl text-gray-500 hover:text-gray-900 hover:bg-[#F5F5F5] transition-all cursor-pointer ${
              isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2 text-xs font-semibold'
            }`}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <>
                <div className="flex items-center gap-2 text-gray-600">
                  <SlidersHorizontal className="w-4 h-4 text-gray-400" />
                  <span>Collapse Sidebar</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </>
            )}
          </button>
        </div>

      </aside>
    </>
  );
}
