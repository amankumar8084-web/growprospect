import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Check, 
  Clock, 
  Users, 
  Sparkles, 
  X
} from 'lucide-react';
import { soundService } from '../services/soundService';
import { crmService } from '../services/crmService';
import { storage } from '../services/storage';

export default function NotificationPopover({ 
  onNavigate, 
  onSelectLead,
  tasksDueTodayCount = 0 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef(null);

  // Generate notifications from system state & recent events
  const refreshNotifications = async () => {
    const items = [];
    
    // 1. Fetch Due Tasks
    try {
      const tasks = await crmService.getTasks({ due: 'today', done: false });
      if (Array.isArray(tasks) && tasks.length > 0) {
        tasks.slice(0, 3).forEach(t => {
          items.push({
            id: `task_${t.id}`,
            type: 'task',
            title: `Task Due: ${t.title || 'Follow-up'}`,
            description: t.due_date ? `Due today · ${t.priority || 'medium'} priority` : 'Action required today',
            timestamp: 'Today',
            read: false,
            targetTab: 'tasks',
            leadId: t.lead_id
          });
        });
      }
    } catch {
      // Best effort
    }

    // 2. Fetch Recent Leads
    try {
      const leads = storage.getLeads() || [];
      if (leads.length > 0) {
        const recentLeads = [...leads].reverse().slice(0, 3);
        recentLeads.forEach((l, idx) => {
          items.push({
            id: `lead_${l.id || idx}`,
            type: 'client',
            title: `Client Added: ${l.name || l.company_name || 'New Client'}`,
            description: l.company_name ? `${l.company_name} · Stage: ${l.pipeline_stage || 'New'}` : 'Recently synced to workspace',
            timestamp: l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
            read: idx > 0, // mark first one unread
            targetTab: 'leads',
            lead: l
          });
        });
      }
    } catch {
      // Best effort
    }

    // 3. Welcome / System Notification
    items.push({
      id: 'system_ready',
      type: 'system',
      title: 'Workspace Active',
      description: 'Lead Discovery & CRM engine online. Audio notifications active.',
      timestamp: 'Online',
      read: true,
      targetTab: 'dashboard'
    });

    setNotifications(items);
    setUnreadCount(items.filter(n => !n.read).length);
  };

  useEffect(() => {
    refreshNotifications();
  }, [tasksDueTodayCount]);

  // Play sound on new task / unread notification detection if enabled
  useEffect(() => {
    if (tasksDueTodayCount > 0 && soundService.isSoundEnabled()) {
      soundService.playNotificationSound();
    }
  }, [tasksDueTodayCount]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);


  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    soundService.playPingSound();
  };

  const handleNotificationClick = (item) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    if (item.lead && onSelectLead) {
      onSelectLead(item.lead);
    }
    if (item.targetTab && onNavigate) {
      onNavigate(item.targetTab);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button 
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          if (!isOpen && unreadCount > 0) {
            soundService.playPingSound();
          }
        }}
        className={`relative p-2 border rounded-lg transition-all cursor-pointer ${
          isOpen 
            ? 'bg-orange-50 border-orange-200 text-orange-600' 
            : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        title="Notifications & Sounds"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ea580c] opacity-60"></span>
            <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-[#ea580c] text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-gray-900 uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No notifications right now
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 hover:bg-gray-50/90 transition-colors cursor-pointer flex items-start gap-3 ${
                    !item.read ? 'bg-orange-50/20' : ''
                  }`}
                >
                  <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                    item.type === 'task' 
                      ? 'bg-amber-100 text-amber-600' 
                      : item.type === 'client' 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {item.type === 'task' && <Clock className="w-4 h-4" />}
                    {item.type === 'client' && <Users className="w-4 h-4" />}
                    {item.type === 'system' && <Sparkles className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${!item.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">{item.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-[#ea580c] mt-2 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-[11px]">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-orange-600 hover:text-orange-700 font-semibold cursor-pointer"
              >
                Mark all as read
              </button>
            ) : (
              <span className="text-gray-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" />
                All caught up
              </span>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
